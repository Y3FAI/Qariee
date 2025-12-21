import { Directory, File, Paths } from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { getAudioUrl } from '../constants/config';
import { insertDownload, deleteDownload as dbDeleteDownload, getDownload, getAllDownloads } from './database';

export interface DownloadProgress {
  reciterId: string;
  surahNumber: number;
  progress: number; // 0-100
  totalBytes: number;
  downloadedBytes: number;
  status: 'queued' | 'downloading' | 'completed' | 'failed' | 'paused';
  error?: string;
}

export interface DownloadTask {
  reciterId: string;
  surahNumber: number;
  url: string;
  destinationPath: string;
  downloadResumable: FileSystemLegacy.DownloadResumable;
}

type ProgressCallback = (progress: DownloadProgress) => void;

class DownloadService {
  private downloadQueue: DownloadTask[] = [];
  private activeDownloads: Map<string, DownloadTask> = new Map();
  private progressCallbacks: Map<string, ProgressCallback[]> = new Map();
  private maxConcurrentDownloads = 2; // Limit concurrent downloads
  private audioDirectory = 'audio'; // Relative path from document directory

  /**
   * Initialize the download service
   */
  async initialize() {
    try {
      // Ensure download directory exists
      const dir = new Directory(Paths.document, this.audioDirectory);
      if (!dir.exists) {
        await dir.create();
        console.log('Created download directory:', dir.uri);
      }
    } catch (error) {
      console.error('Error initializing download service:', error);
      throw error;
    }
  }

  /**
   * Get unique key for a download
   */
  private getDownloadKey(reciterId: string, surahNumber: number): string {
    return `${reciterId}-${surahNumber}`;
  }

  /**
   * Get local file path for a surah
   */
  private getLocalFilePath(reciterId: string, surahNumber: number): string {
    // Returns relative path: audio/reciterId/surahNumber.mp3
    return `${this.audioDirectory}/${reciterId}/${surahNumber}.mp3`;
  }

  /**
   * Check if a surah is downloaded
   */
  async isDownloaded(reciterId: string, surahNumber: number): Promise<boolean> {
    try {
      const download = await getDownload(reciterId, surahNumber);
      if (!download) return false;

      // Verify file actually exists
      const file = new File(Paths.document, download.local_file_path);
      if (!file.exists) {
        // File is in database but doesn't exist on disk - clean up
        await dbDeleteDownload(reciterId, surahNumber);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking download status:', error);
      return false;
    }
  }

  /**
   * Get local file path if downloaded, otherwise return null
   */
  async getLocalPath(reciterId: string, surahNumber: number): Promise<string | null> {
    const isDownloaded = await this.isDownloaded(reciterId, surahNumber);
    if (!isDownloaded) return null;

    const download = await getDownload(reciterId, surahNumber);
    if (!download) return null;

    // Return the full URI for the audio player
    const file = new File(Paths.document, download.local_file_path);
    return file.uri;
  }

  /**
   * Download a surah
   */
  async downloadSurah(
    reciterId: string,
    surahNumber: number,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<void> {
    const key = this.getDownloadKey(reciterId, surahNumber);

    // Check if already downloaded
    if (await this.isDownloaded(reciterId, surahNumber)) {
      console.log(`Surah ${surahNumber} by ${reciterId} already downloaded`);
      return;
    }

    // Check if already downloading or queued
    if (this.activeDownloads.has(key) || this.downloadQueue.some(task => this.getDownloadKey(task.reciterId, task.surahNumber) === key)) {
      console.log(`Download already in progress or queued: ${key}`);
      if (onProgress) {
        this.addProgressCallback(key, onProgress);
      }
      return;
    }

    // Add progress callback
    if (onProgress) {
      this.addProgressCallback(key, onProgress);
    }

    // Create download task
    const url = getAudioUrl(reciterId, surahNumber);
    const destinationPath = this.getLocalFilePath(reciterId, surahNumber);

    // Ensure reciter directory exists
    const reciterDirPath = `${this.audioDirectory}/${reciterId}`;
    const dir = new Directory(Paths.document, reciterDirPath);
    if (!dir.exists) {
      await dir.create();
    }

    // Get full URI for download destination
    const destinationFile = new File(Paths.document, destinationPath);

    // Create resumable download with legacy API for progress tracking
    const downloadResumable = FileSystemLegacy.createDownloadResumable(
      url,
      destinationFile.uri,
      {},
      (downloadProgress) => {
        const progress: DownloadProgress = {
          reciterId,
          surahNumber,
          progress: Math.round((downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100),
          totalBytes: downloadProgress.totalBytesExpectedToWrite,
          downloadedBytes: downloadProgress.totalBytesWritten,
          status: 'downloading',
        };
        this.notifyProgress(key, progress);
      }
    );

    const task: DownloadTask = {
      reciterId,
      surahNumber,
      url,
      destinationPath,
      downloadResumable,
    };

    // Notify queued
    this.notifyProgress(key, {
      reciterId,
      surahNumber,
      progress: 0,
      totalBytes: 0,
      downloadedBytes: 0,
      status: 'queued',
    });

    // Add to queue or start immediately
    if (this.activeDownloads.size < this.maxConcurrentDownloads) {
      await this.startDownload(task);
    } else {
      this.downloadQueue.push(task);
    }
  }

  /**
   * Start a download task
   */
  private async startDownload(task: DownloadTask): Promise<void> {
    const key = this.getDownloadKey(task.reciterId, task.surahNumber);
    this.activeDownloads.set(key, task);

    try {
      // Execute the download (progress is tracked via callback in createDownloadResumable)
      const result = await task.downloadResumable.downloadAsync();

      if (result) {
        // Save to database (store relative path)
        await insertDownload({
          reciter_id: task.reciterId,
          surah_number: task.surahNumber,
          local_file_path: task.destinationPath,
        });

        // Get file size using new API
        const destinationFile = new File(Paths.document, task.destinationPath);
        const fileSize = destinationFile.size || 0;

        // Notify completed
        this.notifyProgress(key, {
          reciterId: task.reciterId,
          surahNumber: task.surahNumber,
          progress: 100,
          totalBytes: fileSize,
          downloadedBytes: fileSize,
          status: 'completed',
        });

        console.log(`Download completed: Surah ${task.surahNumber} by ${task.reciterId}`);
      }
    } catch (error) {
      console.error(`Error downloading surah ${task.surahNumber}:`, error);

      // Notify failed
      this.notifyProgress(key, {
        reciterId: task.reciterId,
        surahNumber: task.surahNumber,
        progress: 0,
        totalBytes: 0,
        downloadedBytes: 0,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      // Remove from active downloads
      this.activeDownloads.delete(key);
      this.progressCallbacks.delete(key);

      // Start next download in queue
      if (this.downloadQueue.length > 0) {
        const nextTask = this.downloadQueue.shift();
        if (nextTask) {
          await this.startDownload(nextTask);
        }
      }
    }
  }

  /**
   * Delete a downloaded surah
   */
  async deleteDownload(reciterId: string, surahNumber: number): Promise<void> {
    try {
      const download = await getDownload(reciterId, surahNumber);
      if (!download) {
        console.log(`Download not found: ${reciterId}-${surahNumber}`);
        return;
      }

      // Delete file from filesystem
      const file = new File(Paths.document, download.local_file_path);
      if (file.exists) {
        await file.delete();
        console.log(`Deleted file: ${download.local_file_path}`);
      }

      // Delete from database
      await dbDeleteDownload(reciterId, surahNumber);
      console.log(`Deleted download record: ${reciterId}-${surahNumber}`);
    } catch (error) {
      console.error(`Error deleting download:`, error);
      throw error;
    }
  }

  /**
   * Cancel an active download
   */
  async cancelDownload(reciterId: string, surahNumber: number): Promise<void> {
    const key = this.getDownloadKey(reciterId, surahNumber);

    // Check if in active downloads
    const task = this.activeDownloads.get(key);
    if (task) {
      await task.downloadResumable.pauseAsync();
      this.activeDownloads.delete(key);
      this.progressCallbacks.delete(key);

      // Delete partial file using new API
      const file = new File(Paths.document, task.destinationPath);
      if (file.exists) {
        await file.delete();
      }

      return;
    }

    // Check if in queue
    const queueIndex = this.downloadQueue.findIndex(
      t => this.getDownloadKey(t.reciterId, t.surahNumber) === key
    );
    if (queueIndex !== -1) {
      this.downloadQueue.splice(queueIndex, 1);
      this.progressCallbacks.delete(key);
    }
  }

  /**
   * Get total storage used by downloads
   */
  async getStorageUsed(): Promise<number> {
    try {
      const downloads = await getAllDownloads();
      let totalSize = 0;

      for (const download of downloads) {
        const file = new File(Paths.document, download.local_file_path);
        if (file.exists && file.size) {
          totalSize += file.size;
        }
      }

      return totalSize;
    } catch (error) {
      console.error('Error calculating storage used:', error);
      return 0;
    }
  }

  /**
   * Add a progress callback
   */
  private addProgressCallback(key: string, callback: ProgressCallback): void {
    const callbacks = this.progressCallbacks.get(key) || [];
    callbacks.push(callback);
    this.progressCallbacks.set(key, callbacks);
  }

  /**
   * Notify progress to all callbacks
   */
  private notifyProgress(key: string, progress: DownloadProgress): void {
    const callbacks = this.progressCallbacks.get(key);
    if (callbacks) {
      callbacks.forEach(callback => callback(progress));
    }
  }

  /**
   * Get download progress for a specific surah
   */
  getProgress(reciterId: string, surahNumber: number): DownloadProgress | null {
    const key = this.getDownloadKey(reciterId, surahNumber);

    // Check if in active downloads
    if (this.activeDownloads.has(key)) {
      return {
        reciterId,
        surahNumber,
        progress: 0, // Will be updated via callback
        totalBytes: 0,
        downloadedBytes: 0,
        status: 'downloading',
      };
    }

    // Check if in queue
    if (this.downloadQueue.some(task => this.getDownloadKey(task.reciterId, task.surahNumber) === key)) {
      return {
        reciterId,
        surahNumber,
        progress: 0,
        totalBytes: 0,
        downloadedBytes: 0,
        status: 'queued',
      };
    }

    return null;
  }
}

// Singleton instance
export const downloadService = new DownloadService();
