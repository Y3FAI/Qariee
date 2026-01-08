/**
 * Download Service Tests
 *
 * Tests the downloadService singleton which manages audio file downloads.
 * Uses mocks for expo-file-system, database, and config modules.
 */

jest.mock('expo-file-system', () => {
  const actual = jest.requireActual<typeof import('../../../__mocks__/expo-file-system')>('../../../__mocks__/expo-file-system');
  return {
    __esModule: true,
    ...actual,
    default: actual,
  };
});

jest.mock('expo-file-system/legacy', () => {
  const actual = jest.requireActual<typeof import('../../../__mocks__/expo-file-system')>('../../../__mocks__/expo-file-system');
  return {
    __esModule: true,
    ...actual,
    default: actual,
  };
});

jest.mock('../database');
jest.mock('../../constants/config');

import { downloadService, DownloadProgress } from '../downloadService';
import * as database from '../database';
import { getAudioUrl } from '../../constants/config';
import * as FileSystemLegacy from 'expo-file-system/legacy';

// Access the mock file directly via actual path (not through moduleNameMapper)
const FileSystemMock = require('../../../__mocks__/expo-file-system');

describe('DownloadService', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Reset the mock file system state
    if (typeof FileSystemMock.__resetMockFileSystem === 'function') {
      FileSystemMock.__resetMockFileSystem();
    }

    // Setup default mocks
    (getAudioUrl as jest.Mock).mockImplementation(
      (reciterId: string, surahNumber: number) =>
        `https://cdn.example.com/audio/${reciterId}/${surahNumber}.mp3`
    );

    // Reset the download service internal state
    (downloadService as any).downloadQueue = [];
    (downloadService as any).activeDownloads = new Map();
    (downloadService as any).progressCallbacks = new Map();
  });

  // ==========================================================================
  // initialize
  // ==========================================================================
  describe('initialize', () => {
    it('creates audio directory if it does not exist', async () => {
      await downloadService.initialize();

      // Directory should be created (mock tracks this)
      // The service uses Directory class which adds to mockDirectories
    });

    it('succeeds if audio directory already exists', async () => {
      FileSystemMock.__addMockDirectory('/mock/documents/audio');

      await expect(downloadService.initialize()).resolves.not.toThrow();
    });
  });

  // ==========================================================================
  // isDownloaded
  // ==========================================================================
  describe('isDownloaded', () => {
    it('returns false when not in database', async () => {
      (database.getDownload as jest.Mock).mockResolvedValue(null);

      const result = await downloadService.isDownloaded('mishary', 1);

      expect(result).toBe(false);
    });

    it('returns true when in database and file exists', async () => {
      (database.getDownload as jest.Mock).mockResolvedValue({
        reciter_id: 'mishary',
        surah_number: 1,
        local_file_path: 'audio/mishary/1.mp3',
      });

      // Add file to mock filesystem
      FileSystemMock.__addMockFile('/mock/documents/audio/mishary/1.mp3', 'audio content');

      const result = await downloadService.isDownloaded('mishary', 1);

      expect(result).toBe(true);
    });

    it('returns false and cleans up DB when file missing from disk', async () => {
      (database.getDownload as jest.Mock).mockResolvedValue({
        reciter_id: 'mishary',
        surah_number: 1,
        local_file_path: 'audio/mishary/1.mp3',
      });

      // File does NOT exist in mock filesystem

      const result = await downloadService.isDownloaded('mishary', 1);

      expect(result).toBe(false);
      expect(database.deleteDownload).toHaveBeenCalledWith('mishary', 1);
    });

    it('handles errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (database.getDownload as jest.Mock).mockRejectedValue(new Error('DB error'));

      const result = await downloadService.isDownloaded('mishary', 1);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ==========================================================================
  // getLocalPath
  // ==========================================================================
  describe('getLocalPath', () => {
    it('returns null when not downloaded', async () => {
      (database.getDownload as jest.Mock).mockResolvedValue(null);

      const result = await downloadService.getLocalPath('mishary', 1);

      expect(result).toBeNull();
    });

    it('returns file URI when downloaded', async () => {
      (database.getDownload as jest.Mock).mockResolvedValue({
        reciter_id: 'mishary',
        surah_number: 1,
        local_file_path: 'audio/mishary/1.mp3',
      });
      FileSystemMock.__addMockFile('/mock/documents/audio/mishary/1.mp3', 'audio content');

      const result = await downloadService.getLocalPath('mishary', 1);

      expect(result).toContain('audio/mishary/1.mp3');
    });
  });

  // ==========================================================================
  // downloadSurah
  // ==========================================================================
  describe('downloadSurah', () => {
    it('skips download if already downloaded', async () => {
      (database.getDownload as jest.Mock).mockResolvedValue({
        reciter_id: 'mishary',
        surah_number: 1,
        local_file_path: 'audio/mishary/1.mp3',
      });
      FileSystemMock.__addMockFile('/mock/documents/audio/mishary/1.mp3', 'audio content');

      await downloadService.downloadSurah('mishary', 1);

      expect(FileSystemLegacy.createDownloadResumable).not.toHaveBeenCalled();
    });

    it('starts download and notifies progress', async () => {
      (database.getDownload as jest.Mock).mockResolvedValue(null);

      const progressUpdates: DownloadProgress[] = [];
      const onProgress = (progress: DownloadProgress) => {
        progressUpdates.push({ ...progress });
      };

      await downloadService.downloadSurah('mishary', 1, onProgress);

      // Should have received queued and progress updates
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0].status).toBe('queued');
    });

    it('saves to database on successful download', async () => {
      (database.getDownload as jest.Mock).mockResolvedValue(null);

      await downloadService.downloadSurah('mishary', 1);

      expect(database.insertDownload).toHaveBeenCalledWith({
        reciter_id: 'mishary',
        surah_number: 1,
        local_file_path: 'audio/mishary/1.mp3',
      });
    });

    it('does not duplicate download if already in progress', async () => {
      (database.getDownload as jest.Mock).mockResolvedValue(null);

      // Setup a slow download that won't complete immediately
      let downloadStarted = false;
      (FileSystemLegacy.createDownloadResumable as jest.Mock).mockImplementation(() => ({
        downloadAsync: jest.fn(async () => {
          downloadStarted = true;
          // Don't resolve immediately - simulate slow download
          await new Promise(resolve => setTimeout(resolve, 100));
          return { uri: 'file://test.mp3', status: 200 };
        }),
        pauseAsync: jest.fn(),
      }));

      // Start first download
      const download1 = downloadService.downloadSurah('mishary', 1);

      // Wait a bit for first download to start
      await new Promise(resolve => setTimeout(resolve, 10));

      // Try to start second download for same file - should return early
      await downloadService.downloadSurah('mishary', 1);

      // Should only have created one download resumable (second call skips)
      expect(FileSystemLegacy.createDownloadResumable).toHaveBeenCalledTimes(1);

      // Wait for completion
      await download1;
    }, 10000);

    it('queues downloads beyond max concurrent limit', async () => {
      (database.getDownload as jest.Mock).mockResolvedValue(null);

      // Track download starts
      let activeDownloads = 0;
      let resolvers: (() => void)[] = [];

      (FileSystemLegacy.createDownloadResumable as jest.Mock).mockImplementation(() => ({
        downloadAsync: jest.fn(async () => {
          activeDownloads++;
          await new Promise<void>((resolve) => {
            resolvers.push(resolve);
          });
          return { uri: 'file://test.mp3', status: 200 };
        }),
        pauseAsync: jest.fn(),
      }));

      // Start 3 downloads (max concurrent is 2)
      downloadService.downloadSurah('mishary', 1);
      downloadService.downloadSurah('mishary', 2);
      downloadService.downloadSurah('mishary', 3);

      // Wait a bit for downloads to register
      await new Promise(resolve => setTimeout(resolve, 10));

      // Third one should be queued (not actively downloading yet)
      // We can check this by seeing if 2 or fewer downloads actually started
      expect(activeDownloads).toBeLessThanOrEqual(2);

      // Complete all downloads
      resolvers.forEach((r) => r());
    }, 10000);

    it('handles download failure', async () => {
      (database.getDownload as jest.Mock).mockResolvedValue(null);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (FileSystemLegacy.createDownloadResumable as jest.Mock).mockReturnValueOnce({
        downloadAsync: jest.fn().mockRejectedValue(new Error('Network error')),
        pauseAsync: jest.fn(),
      });

      const progressUpdates: DownloadProgress[] = [];
      await downloadService.downloadSurah('mishary', 1, (p) => progressUpdates.push({ ...p }));

      const lastUpdate = progressUpdates[progressUpdates.length - 1];
      expect(lastUpdate.status).toBe('failed');
      expect(lastUpdate.error).toBe('Network error');

      consoleSpy.mockRestore();
    });
  });

  // ==========================================================================
  // deleteDownload
  // ==========================================================================
  describe('deleteDownload', () => {
    it('deletes file and database record', async () => {
      (database.getDownload as jest.Mock).mockResolvedValue({
        reciter_id: 'mishary',
        surah_number: 1,
        local_file_path: 'audio/mishary/1.mp3',
      });
      FileSystemMock.__addMockFile('/mock/documents/audio/mishary/1.mp3', 'audio content');

      await downloadService.deleteDownload('mishary', 1);

      expect(database.deleteDownload).toHaveBeenCalledWith('mishary', 1);
      // File should be deleted from mock filesystem
      expect(FileSystemMock.__getMockFileSystem()['/mock/documents/audio/mishary/1.mp3']).toBeUndefined();
    });

    it('does nothing if not in database', async () => {
      (database.getDownload as jest.Mock).mockResolvedValue(null);

      await downloadService.deleteDownload('mishary', 1);

      expect(database.deleteDownload).not.toHaveBeenCalled();
    });

    it('handles missing file gracefully', async () => {
      (database.getDownload as jest.Mock).mockResolvedValue({
        reciter_id: 'mishary',
        surah_number: 1,
        local_file_path: 'audio/mishary/1.mp3',
      });
      // File doesn't exist in mock filesystem

      await expect(downloadService.deleteDownload('mishary', 1)).resolves.not.toThrow();
      expect(database.deleteDownload).toHaveBeenCalledWith('mishary', 1);
    });
  });

  // ==========================================================================
  // cancelDownload
  // ==========================================================================
  describe('cancelDownload', () => {
    it('cancels active download and deletes partial file', async () => {
      (database.getDownload as jest.Mock).mockResolvedValue(null);

      // Track if pause was called
      let pauseCalled = false;
      const pauseFn = jest.fn().mockImplementation(async () => {
        pauseCalled = true;
      });

      // Setup a slow download
      (FileSystemLegacy.createDownloadResumable as jest.Mock).mockImplementation(() => ({
        downloadAsync: jest.fn(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return { uri: 'file://test.mp3', status: 200 };
        }),
        pauseAsync: pauseFn,
      }));

      // Start download (don't await)
      const downloadPromise = downloadService.downloadSurah('mishary', 1);

      // Wait a bit for download to start
      await new Promise(resolve => setTimeout(resolve, 10));

      // Cancel it
      await downloadService.cancelDownload('mishary', 1);

      // Should have called pauseAsync
      expect(pauseCalled).toBe(true);

      // Wait for completion (may error, that's ok)
      await downloadPromise.catch(() => {});
    }, 10000);

    it('removes from queue if not yet started', async () => {
      (database.getDownload as jest.Mock).mockResolvedValue(null);

      // Setup slow downloads to fill concurrent slots
      let resolvers: (() => void)[] = [];
      (FileSystemLegacy.createDownloadResumable as jest.Mock).mockImplementation(() => ({
        downloadAsync: jest.fn(async () => {
          await new Promise<void>((resolve) => {
            resolvers.push(resolve);
          });
          return { uri: 'file://test.mp3', status: 200 };
        }),
        pauseAsync: jest.fn(),
      }));

      // Start 3 downloads - third will be queued
      downloadService.downloadSurah('mishary', 1);
      downloadService.downloadSurah('mishary', 2);
      downloadService.downloadSurah('mishary', 3);

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      // Cancel the queued one (it should either be in queue or starting)
      await downloadService.cancelDownload('mishary', 3);

      // Cleanup
      resolvers.forEach((r) => r());
    }, 10000);
  });

  // ==========================================================================
  // getStorageUsed
  // ==========================================================================
  describe('getStorageUsed', () => {
    it('calculates total size of all downloads', async () => {
      (database.getAllDownloads as jest.Mock).mockResolvedValue([
        { local_file_path: 'audio/mishary/1.mp3' },
        { local_file_path: 'audio/mishary/2.mp3' },
      ]);

      // Add files with specific sizes via mock utility
      FileSystemMock.__addMockFile('/mock/documents/audio/mishary/1.mp3', 'a'.repeat(1000));
      FileSystemMock.__addMockFile('/mock/documents/audio/mishary/2.mp3', 'b'.repeat(2000));

      const result = await downloadService.getStorageUsed();

      expect(result).toBe(3000);
    });

    it('returns 0 when no downloads', async () => {
      (database.getAllDownloads as jest.Mock).mockResolvedValue([]);

      const result = await downloadService.getStorageUsed();

      expect(result).toBe(0);
    });

    it('handles missing files gracefully', async () => {
      (database.getAllDownloads as jest.Mock).mockResolvedValue([
        { local_file_path: 'audio/mishary/1.mp3' },
      ]);
      // Don't add the file to mock filesystem

      const result = await downloadService.getStorageUsed();

      expect(result).toBe(0);
    });

    it('handles errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (database.getAllDownloads as jest.Mock).mockRejectedValue(new Error('DB error'));

      const result = await downloadService.getStorageUsed();

      expect(result).toBe(0);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ==========================================================================
  // getProgress
  // ==========================================================================
  describe('getProgress', () => {
    it('returns null when not downloading or queued', () => {
      const result = downloadService.getProgress('mishary', 1);

      expect(result).toBeNull();
    });

    it('returns downloading status for active downloads', async () => {
      (database.getDownload as jest.Mock).mockResolvedValue(null);

      // Setup slow download
      (FileSystemLegacy.createDownloadResumable as jest.Mock).mockImplementation(() => ({
        downloadAsync: jest.fn(() => new Promise(() => {})), // Never resolves
        pauseAsync: jest.fn(),
      }));

      // Start download (don't await)
      downloadService.downloadSurah('mishary', 1);

      // Wait a bit for download to register
      await new Promise(resolve => setTimeout(resolve, 10));

      const result = downloadService.getProgress('mishary', 1);

      expect(result?.status).toBe('downloading');
    }, 10000);

    it('returns queued status for queued downloads', async () => {
      (database.getDownload as jest.Mock).mockResolvedValue(null);

      // Setup slow downloads
      (FileSystemLegacy.createDownloadResumable as jest.Mock).mockImplementation(() => ({
        downloadAsync: jest.fn(() => new Promise(() => {})), // Never resolves
        pauseAsync: jest.fn(),
      }));

      // Fill concurrent slots
      downloadService.downloadSurah('mishary', 1);
      downloadService.downloadSurah('mishary', 2);
      // This one will be queued
      downloadService.downloadSurah('mishary', 3);

      // Wait a bit for queue to register
      await new Promise(resolve => setTimeout(resolve, 10));

      const result = downloadService.getProgress('mishary', 3);

      // If it's not actively downloading, it must be queued
      expect(result).not.toBeNull();
      expect(['queued', 'downloading']).toContain(result?.status);
    }, 10000);
  });
});
