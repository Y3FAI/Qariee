import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { downloadService, DownloadProgress } from '../services/downloadService';
import { getAllDownloads } from '../services/database';
import { Download } from '../types';

interface DownloadContextType {
  downloads: Download[];
  activeDownloads: Map<string, DownloadProgress>;
  downloadSurah: (reciterId: string, surahNumber: number) => Promise<void>;
  deleteDownload: (reciterId: string, surahNumber: number) => Promise<void>;
  cancelDownload: (reciterId: string, surahNumber: number) => Promise<void>;
  isDownloaded: (reciterId: string, surahNumber: number) => boolean;
  getProgress: (reciterId: string, surahNumber: number) => DownloadProgress | null;
  storageUsed: number;
  refreshDownloads: () => Promise<void>;
}

const DownloadContext = createContext<DownloadContextType | undefined>(undefined);

export function DownloadProvider({ children }: { children: ReactNode }) {
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [activeDownloads, setActiveDownloads] = useState<Map<string, DownloadProgress>>(new Map());
  const [deletingDownloads, setDeletingDownloads] = useState<Set<string>>(new Set());
  const [storageUsed, setStorageUsed] = useState(0);

  // Initialize download service
  useEffect(() => {
    const init = async () => {
      try {
        await downloadService.initialize();
        await refreshDownloads();
        await updateStorageUsed();
      } catch (error) {
        console.error('Error initializing download service:', error);
        // Continue anyway - downloads table should exist now
      }
    };

    init();
  }, []);

  // Refresh downloads list from database
  const refreshDownloads = async () => {
    try {
      const allDownloads = await getAllDownloads();
      setDownloads(allDownloads);
    } catch (error) {
      console.error('Error refreshing downloads:', error);
    }
  };

  // Update storage used
  const updateStorageUsed = async () => {
    try {
      const used = await downloadService.getStorageUsed();
      setStorageUsed(used);
    } catch (error) {
      console.error('Error updating storage used:', error);
    }
  };

  // Helper to get download key
  const getDownloadKey = (reciterId: string, surahNumber: number): string => {
    return `${reciterId}-${surahNumber}`;
  };

  // Download a surah
  const downloadSurah = async (reciterId: string, surahNumber: number) => {
    const key = getDownloadKey(reciterId, surahNumber);

    try {
      await downloadService.downloadSurah(reciterId, surahNumber, (progress) => {
        // Update active downloads state
        setActiveDownloads(prev => {
          const updated = new Map(prev);

          if (progress.status === 'completed') {
            updated.delete(key);
            // Refresh downloads list
            refreshDownloads();
            updateStorageUsed();
          } else if (progress.status === 'failed') {
            updated.delete(key);
          } else {
            updated.set(key, progress);
          }

          return updated;
        });
      });
    } catch (error) {
      console.error('Error downloading surah:', error);
      // Remove from active downloads on error
      setActiveDownloads(prev => {
        const updated = new Map(prev);
        updated.delete(key);
        return updated;
      });
    }
  };

  // Delete a download
  const deleteDownload = async (reciterId: string, surahNumber: number) => {
    const key = getDownloadKey(reciterId, surahNumber);

    try {
      // Mark as deleting
      setDeletingDownloads(prev => new Set(prev).add(key));

      await downloadService.deleteDownload(reciterId, surahNumber);
      await refreshDownloads();
      await updateStorageUsed();
    } catch (error) {
      console.error('Error deleting download:', error);
      throw error;
    } finally {
      // Remove from deleting set
      setDeletingDownloads(prev => {
        const updated = new Set(prev);
        updated.delete(key);
        return updated;
      });
    }
  };

  // Cancel an active download
  const cancelDownload = async (reciterId: string, surahNumber: number) => {
    const key = getDownloadKey(reciterId, surahNumber);

    try {
      await downloadService.cancelDownload(reciterId, surahNumber);

      // Remove from active downloads
      setActiveDownloads(prev => {
        const updated = new Map(prev);
        updated.delete(key);
        return updated;
      });
    } catch (error) {
      console.error('Error canceling download:', error);
      throw error;
    }
  };

  // Check if a surah is downloaded
  const isDownloaded = (reciterId: string, surahNumber: number): boolean => {
    return downloads.some(
      d => d.reciter_id === reciterId && d.surah_number === surahNumber
    );
  };

  // Get download progress
  const getProgress = (reciterId: string, surahNumber: number): DownloadProgress | null => {
    const key = getDownloadKey(reciterId, surahNumber);

    // Check if being deleted
    if (deletingDownloads.has(key)) {
      return {
        reciterId,
        surahNumber,
        progress: 0,
        status: 'deleting' as any, // Special status for deleting
        totalBytes: 0,
        downloadedBytes: 0,
      };
    }

    return activeDownloads.get(key) || null;
  };

  return (
    <DownloadContext.Provider
      value={{
        downloads,
        activeDownloads,
        downloadSurah,
        deleteDownload,
        cancelDownload,
        isDownloaded,
        getProgress,
        storageUsed,
        refreshDownloads,
      }}
    >
      {children}
    </DownloadContext.Provider>
  );
}

export function useDownload() {
  const context = useContext(DownloadContext);
  if (context === undefined) {
    throw new Error('useDownload must be used within a DownloadProvider');
  }
  return context;
}
