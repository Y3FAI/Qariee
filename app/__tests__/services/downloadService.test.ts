import { downloadService, DownloadProgress } from '../../src/services/downloadService';

// Mock external dependencies
jest.mock('expo-file-system', () => ({
  Directory: jest.fn(),
  File: jest.fn(),
  Paths: {
    document: 'mock-document-dir',
  },
}));

jest.mock('expo-file-system/legacy', () => ({
  createDownloadResumable: jest.fn(),
  DownloadResumable: jest.fn(),
}));

jest.mock('../../src/services/database', () => ({
  __esModule: true,
  insertDownload: jest.fn(),
  getDownload: jest.fn(),
  getAllDownloads: jest.fn(),
  getDownloadsByReciter: jest.fn(),
  deleteDownload: jest.fn(),
  isDownloaded: jest.fn(),
}));

jest.mock('../../src/constants/config', () => ({
  getAudioUrl: jest.fn(),
}));

// Import mocks after mocking
import { Directory, File, Paths } from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as database from '../../src/services/database';
import { getAudioUrl } from '../../src/constants/config';

// Mock types
const mockDirectory = Directory as jest.Mock;
const mockFile = File as jest.Mock;
const mockPaths = Paths;
const mockFileSystemLegacy = FileSystemLegacy as jest.Mocked<typeof FileSystemLegacy>;
const mockDatabase = database as jest.Mocked<typeof database>;
const mockGetAudioUrl = getAudioUrl as jest.MockedFunction<typeof getAudioUrl>;

// Test data
const TEST_RECITER_ID = 'test-reciter';
const TEST_SURAH_NUMBER = 1;
const TEST_DOWNLOAD_KEY = `${TEST_RECITER_ID}-${TEST_SURAH_NUMBER}`;
const TEST_LOCAL_PATH = `audio/${TEST_RECITER_ID}/${TEST_SURAH_NUMBER}.mp3`;
const TEST_FILE_URI = `file://mock/${TEST_LOCAL_PATH}`;
const TEST_URL = 'https://example.com/audio/test-reciter/001.mp3';

// Mock download task
const createMockDownloadTask = () => ({
  reciterId: TEST_RECITER_ID,
  surahNumber: TEST_SURAH_NUMBER,
  url: TEST_URL,
  destinationPath: TEST_LOCAL_PATH,
  downloadResumable: {
    downloadAsync: jest.fn(),
    pauseAsync: jest.fn(),
    resumeAsync: jest.fn(),
    savable: jest.fn(),
  },
});

describe('DownloadService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset singleton instance state
    (downloadService as any).downloadQueue = [];
    (downloadService as any).activeDownloads = new Map();
    (downloadService as any).progressCallbacks = new Map();

    // Setup default mocks
    mockGetAudioUrl.mockReturnValue(TEST_URL);

    // Default Directory mock
    mockDirectory.mockImplementation((base, path) => ({
      exists: false,
      create: jest.fn().mockResolvedValue(undefined),
    }));

    // Default File mock
    mockFile.mockImplementation((base, path) => ({
      exists: true,
      uri: TEST_FILE_URI,
      size: 1024 * 1024, // 1MB
      delete: jest.fn().mockResolvedValue(undefined),
    }));

    // Default database mocks
    mockDatabase.getDownload.mockResolvedValue({
      reciter_id: TEST_RECITER_ID,
      surah_number: TEST_SURAH_NUMBER,
      local_file_path: TEST_LOCAL_PATH,
      downloaded_at: new Date().toISOString(),
    });
    mockDatabase.insertDownload.mockResolvedValue();
    mockDatabase.deleteDownload.mockResolvedValue();
    mockDatabase.getAllDownloads.mockResolvedValue([]);

    // Default legacy module mock
    mockFileSystemLegacy.createDownloadResumable.mockImplementation(() => ({
      downloadAsync: jest.fn().mockResolvedValue({}),
      pauseAsync: jest.fn().mockResolvedValue(undefined),
      resumeAsync: jest.fn().mockResolvedValue(undefined),
      savable: jest.fn().mockReturnValue({}),
    }));
  });

  describe('initialize()', () => {
    it('should create audio directory if it does not exist', async () => {
      const mockCreate = jest.fn().mockResolvedValue(undefined);
      mockDirectory.mockImplementation((base, path) => ({
        exists: false,
        create: mockCreate,
      }));

      await downloadService.initialize();

      expect(mockDirectory).toHaveBeenCalledWith('mock-document-dir', 'audio');
      expect(mockCreate).toHaveBeenCalled();
    });

    it('should not create directory if it already exists', async () => {
      const mockCreate = jest.fn();
      mockDirectory.mockImplementation((base, path) => ({
        exists: true,
        create: mockCreate,
      }));

      await downloadService.initialize();

      expect(mockDirectory).toHaveBeenCalledWith('mock-document-dir', 'audio');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should throw error if directory creation fails', async () => {
      const mockCreate = jest.fn().mockRejectedValue(new Error('Disk full'));
      mockDirectory.mockImplementation((base, path) => ({
        exists: false,
        create: mockCreate,
      }));

      await expect(downloadService.initialize()).rejects.toThrow('Disk full');
    });
  });

  describe('isDownloaded()', () => {
    it('should return false when download does not exist in database', async () => {
      mockDatabase.getDownload.mockResolvedValue(null);

      const result = await downloadService.isDownloaded(TEST_RECITER_ID, TEST_SURAH_NUMBER);

      expect(result).toBe(false);
      expect(mockDatabase.getDownload).toHaveBeenCalledWith(TEST_RECITER_ID, TEST_SURAH_NUMBER);
    });

    it('should return true when download exists in database and file exists on disk', async () => {
      mockDatabase.getDownload.mockResolvedValue({
        reciter_id: TEST_RECITER_ID,
        surah_number: TEST_SURAH_NUMBER,
        local_file_path: TEST_LOCAL_PATH,
        downloaded_at: new Date().toISOString(),
      });
      mockFile.mockImplementation((base, path) => ({
        exists: true,
        uri: TEST_FILE_URI,
        size: 1024 * 1024,
        delete: jest.fn(),
      }));

      const result = await downloadService.isDownloaded(TEST_RECITER_ID, TEST_SURAH_NUMBER);

      expect(result).toBe(true);
      expect(mockFile).toHaveBeenCalledWith('mock-document-dir', TEST_LOCAL_PATH);
    });

    it('should clean up database record when file does not exist on disk', async () => {
      mockDatabase.getDownload.mockResolvedValue({
        reciter_id: TEST_RECITER_ID,
        surah_number: TEST_SURAH_NUMBER,
        local_file_path: TEST_LOCAL_PATH,
        downloaded_at: new Date().toISOString(),
      });
      mockFile.mockImplementation((base, path) => ({
        exists: false,
        uri: TEST_FILE_URI,
        size: 0,
        delete: jest.fn(),
      }));

      const result = await downloadService.isDownloaded(TEST_RECITER_ID, TEST_SURAH_NUMBER);

      expect(result).toBe(false);
      expect(mockDatabase.deleteDownload).toHaveBeenCalledWith(TEST_RECITER_ID, TEST_SURAH_NUMBER);
    });

    it('should return false on database error', async () => {
      mockDatabase.getDownload.mockRejectedValue(new Error('Database error'));

      const result = await downloadService.isDownloaded(TEST_RECITER_ID, TEST_SURAH_NUMBER);

      expect(result).toBe(false);
    });
  });

  describe('getLocalPath()', () => {
    it('should return null when surah is not downloaded', async () => {
      mockDatabase.getDownload.mockResolvedValue(null);

      const result = await downloadService.getLocalPath(TEST_RECITER_ID, TEST_SURAH_NUMBER);

      expect(result).toBeNull();
    });

    it('should return file URI when surah is downloaded', async () => {
      mockDatabase.getDownload.mockResolvedValue({
        reciter_id: TEST_RECITER_ID,
        surah_number: TEST_SURAH_NUMBER,
        local_file_path: TEST_LOCAL_PATH,
        downloaded_at: new Date().toISOString(),
      });
      mockFile.mockImplementation((base, path) => ({
        exists: true,
        uri: TEST_FILE_URI,
        size: 1024 * 1024,
        delete: jest.fn(),
      }));

      const result = await downloadService.getLocalPath(TEST_RECITER_ID, TEST_SURAH_NUMBER);

      expect(result).toBe(TEST_FILE_URI);
      expect(mockFile).toHaveBeenCalledWith('mock-document-dir', TEST_LOCAL_PATH);
    });

    it('should return null when database record exists but file does not exist', async () => {
      mockDatabase.getDownload.mockResolvedValue({
        reciter_id: TEST_RECITER_ID,
        surah_number: TEST_SURAH_NUMBER,
        local_file_path: TEST_LOCAL_PATH,
        downloaded_at: new Date().toISOString(),
      });
      mockFile.mockImplementation((base, path) => ({
        exists: false,
        uri: TEST_FILE_URI,
        size: 0,
        delete: jest.fn(),
      }));

      const result = await downloadService.getLocalPath(TEST_RECITER_ID, TEST_SURAH_NUMBER);

      expect(result).toBeNull();
      expect(mockDatabase.deleteDownload).toHaveBeenCalledWith(TEST_RECITER_ID, TEST_SURAH_NUMBER);
    });
  });

  describe('downloadSurah()', () => {
    it('should not download if already downloaded', async () => {
      // Mock isDownloaded to return true
      jest.spyOn(downloadService as any, 'isDownloaded').mockResolvedValue(true);
      const mockProgressCallback = jest.fn();

      await downloadService.downloadSurah(TEST_RECITER_ID, TEST_SURAH_NUMBER, mockProgressCallback);

      expect(mockFileSystemLegacy.createDownloadResumable).not.toHaveBeenCalled();
      expect(mockProgressCallback).not.toHaveBeenCalled();
    });

    it('should not create duplicate download if already in queue', async () => {
      jest.spyOn(downloadService as any, 'isDownloaded').mockResolvedValue(false);
      const mockProgressCallback = jest.fn();

      // Mock downloadAsync to not resolve immediately (keep download active)
      const mockDownloadAsync = jest.fn().mockImplementation(() => new Promise(() => {}));
      mockFileSystemLegacy.createDownloadResumable.mockReturnValue({
        downloadAsync: mockDownloadAsync,
        pauseAsync: jest.fn(),
        resumeAsync: jest.fn(),
        savable: jest.fn(),
      });

      // First call
      downloadService.downloadSurah(TEST_RECITER_ID, TEST_SURAH_NUMBER, mockProgressCallback);

      // Wait a bit for the download to start
      await new Promise(resolve => setTimeout(resolve, 10));

      // Second call with same parameters
      await downloadService.downloadSurah(TEST_RECITER_ID, TEST_SURAH_NUMBER, mockProgressCallback);

      // Should only create one download task
      expect(mockFileSystemLegacy.createDownloadResumable).toHaveBeenCalledTimes(1);
    });

    it('should add progress callback for existing download', async () => {
      jest.spyOn(downloadService as any, 'isDownloaded').mockResolvedValue(false);
      const mockProgressCallback1 = jest.fn();
      const mockProgressCallback2 = jest.fn();

      // Mock downloadAsync to not resolve immediately so callbacks stay registered
      const mockDownloadAsync = jest.fn().mockImplementation(() => new Promise(() => {}));
      mockFileSystemLegacy.createDownloadResumable.mockReturnValue({
        downloadAsync: mockDownloadAsync,
        pauseAsync: jest.fn(),
        resumeAsync: jest.fn(),
        savable: jest.fn(),
      });

      // Start download (don't await)
      downloadService.downloadSurah(TEST_RECITER_ID, TEST_SURAH_NUMBER, mockProgressCallback1);

      // Wait a bit for download to start
      await new Promise(resolve => setTimeout(resolve, 10));

      // Add another callback for same download
      await downloadService.downloadSurah(TEST_RECITER_ID, TEST_SURAH_NUMBER, mockProgressCallback2);

      // Both callbacks should be registered
      const progressCallbacks = (downloadService as any).progressCallbacks.get(TEST_DOWNLOAD_KEY);
      expect(progressCallbacks).toContain(mockProgressCallback1);
      expect(progressCallbacks).toContain(mockProgressCallback2);
    }, 10000);

    it('should create reciter directory if it does not exist', async () => {
      jest.spyOn(downloadService as any, 'isDownloaded').mockResolvedValue(false);
      const mockCreate = jest.fn().mockResolvedValue(undefined);
      mockDirectory.mockImplementation((base, path) => ({
        exists: path === 'audio' ? true : false, // Audio dir exists, reciter dir doesn't
        create: mockCreate,
      }));

      await downloadService.downloadSurah(TEST_RECITER_ID, TEST_SURAH_NUMBER);

      expect(mockDirectory).toHaveBeenCalledWith('mock-document-dir', `audio/${TEST_RECITER_ID}`);
      expect(mockCreate).toHaveBeenCalled();
    });

    it('should start download immediately if under concurrent limit', async () => {
      jest.spyOn(downloadService as any, 'isDownloaded').mockResolvedValue(false);

      // Mock downloadAsync to not resolve immediately so we can check activeDownloads
      const mockDownloadAsync = jest.fn().mockImplementation(() => new Promise(() => {}));
      mockFileSystemLegacy.createDownloadResumable.mockReturnValue({
        downloadAsync: mockDownloadAsync,
        pauseAsync: jest.fn(),
        resumeAsync: jest.fn(),
        savable: jest.fn(),
      });

      // Don't await - we want to check while download is still active
      downloadService.downloadSurah(TEST_RECITER_ID, TEST_SURAH_NUMBER);

      // Wait a bit for the download to start
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockDownloadAsync).toHaveBeenCalled();
      // The download should be in activeDownloads while it's running
      expect((downloadService as any).activeDownloads.has(TEST_DOWNLOAD_KEY)).toBe(true);
      expect((downloadService as any).downloadQueue.length).toBe(0);
    });

    it('should queue download if at concurrent limit', async () => {
      jest.spyOn(downloadService as any, 'isDownloaded').mockResolvedValue(false);

      // Fill up active downloads
      (downloadService as any).activeDownloads.set('download-1', createMockDownloadTask());
      (downloadService as any).activeDownloads.set('download-2', createMockDownloadTask());

      await downloadService.downloadSurah(TEST_RECITER_ID, TEST_SURAH_NUMBER);

      expect((downloadService as any).downloadQueue.length).toBe(1);
      expect((downloadService as any).activeDownloads.has(TEST_DOWNLOAD_KEY)).toBe(false);
    });
  });

  describe('startDownload()', () => {
    it('should save to database on successful download', async () => {
      const mockTask = createMockDownloadTask();
      const mockDownloadAsync = jest.fn().mockResolvedValue({});
      mockTask.downloadResumable.downloadAsync = mockDownloadAsync;

      await (downloadService as any).startDownload(mockTask);

      expect(mockDownloadAsync).toHaveBeenCalled();
      expect(mockDatabase.insertDownload).toHaveBeenCalledWith({
        reciter_id: TEST_RECITER_ID,
        surah_number: TEST_SURAH_NUMBER,
        local_file_path: TEST_LOCAL_PATH,
      });
      expect((downloadService as any).activeDownloads.has(TEST_DOWNLOAD_KEY)).toBe(false);
    });

    it('should notify progress callbacks on completion', async () => {
      const mockTask = createMockDownloadTask();
      const mockDownloadAsync = jest.fn().mockResolvedValue({});
      mockTask.downloadResumable.downloadAsync = mockDownloadAsync;

      const mockProgressCallback = jest.fn();
      (downloadService as any).progressCallbacks.set(TEST_DOWNLOAD_KEY, [mockProgressCallback]);

      await (downloadService as any).startDownload(mockTask);

      // Should have been called at least once for completed status
      expect(mockProgressCallback).toHaveBeenCalled();
      const completedCall = mockProgressCallback.mock.calls.find(call =>
        call[0].status === 'completed'
      );
      expect(completedCall).toBeDefined();
      expect(completedCall[0].progress).toBe(100);
    });

    it('should handle download failure and notify callbacks', async () => {
      const mockTask = createMockDownloadTask();
      const mockDownloadAsync = jest.fn().mockRejectedValue(new Error('Network error'));
      mockTask.downloadResumable.downloadAsync = mockDownloadAsync;

      const mockProgressCallback = jest.fn();
      (downloadService as any).progressCallbacks.set(TEST_DOWNLOAD_KEY, [mockProgressCallback]);

      await (downloadService as any).startDownload(mockTask);

      expect(mockProgressCallback).toHaveBeenCalled();
      const failedCall = mockProgressCallback.mock.calls.find(call =>
        call[0].status === 'failed'
      );
      expect(failedCall).toBeDefined();
      expect(failedCall[0].error).toBe('Network error');
      expect((downloadService as any).activeDownloads.has(TEST_DOWNLOAD_KEY)).toBe(false);
    });

    it('should start next download in queue after completion', async () => {
      const mockTask1 = createMockDownloadTask();
      const mockTask2 = createMockDownloadTask();
      mockTask2.reciterId = 'reciter-2';
      mockTask2.surahNumber = 2;

      const mockDownloadAsync = jest.fn().mockResolvedValue({});
      mockTask1.downloadResumable.downloadAsync = mockDownloadAsync;
      mockTask2.downloadResumable.downloadAsync = mockDownloadAsync;

      // Add task2 to queue
      (downloadService as any).downloadQueue.push(mockTask2);

      await (downloadService as any).startDownload(mockTask1);

      // Should have started both downloads
      expect(mockDownloadAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe('deleteDownload()', () => {
    it('should delete file and database record', async () => {
      const mockDelete = jest.fn().mockResolvedValue(undefined);
      mockFile.mockImplementation((base, path) => ({
        exists: true,
        uri: TEST_FILE_URI,
        size: 1024 * 1024,
        delete: mockDelete,
      }));

      await downloadService.deleteDownload(TEST_RECITER_ID, TEST_SURAH_NUMBER);

      expect(mockDatabase.getDownload).toHaveBeenCalledWith(TEST_RECITER_ID, TEST_SURAH_NUMBER);
      expect(mockFile).toHaveBeenCalledWith('mock-document-dir', TEST_LOCAL_PATH);
      expect(mockDelete).toHaveBeenCalled();
      expect(mockDatabase.deleteDownload).toHaveBeenCalledWith(TEST_RECITER_ID, TEST_SURAH_NUMBER);
    });

    it('should not throw error if download does not exist', async () => {
      mockDatabase.getDownload.mockResolvedValue(null);

      await expect(downloadService.deleteDownload(TEST_RECITER_ID, TEST_SURAH_NUMBER)).resolves.not.toThrow();

      expect(mockFile).not.toHaveBeenCalled();
      expect(mockDatabase.deleteDownload).not.toHaveBeenCalled();
    });

    it('should not throw error if file does not exist', async () => {
      mockFile.mockImplementation((base, path) => ({
        exists: false,
        uri: TEST_FILE_URI,
        size: 0,
        delete: jest.fn(),
      }));

      await expect(downloadService.deleteDownload(TEST_RECITER_ID, TEST_SURAH_NUMBER)).resolves.not.toThrow();

      expect(mockDatabase.deleteDownload).toHaveBeenCalledWith(TEST_RECITER_ID, TEST_SURAH_NUMBER);
    });
  });

  describe('cancelDownload()', () => {
    it('should cancel active download and delete partial file', async () => {
      const mockTask = createMockDownloadTask();
      const mockPauseAsync = jest.fn().mockResolvedValue(undefined);
      const mockDelete = jest.fn().mockResolvedValue(undefined);
      mockTask.downloadResumable.pauseAsync = mockPauseAsync;

      mockFile.mockImplementation((base, path) => ({
        exists: true,
        uri: TEST_FILE_URI,
        size: 1024 * 1024,
        delete: mockDelete,
      }));

      (downloadService as any).activeDownloads.set(TEST_DOWNLOAD_KEY, mockTask);

      await downloadService.cancelDownload(TEST_RECITER_ID, TEST_SURAH_NUMBER);

      expect(mockPauseAsync).toHaveBeenCalled();
      expect(mockDelete).toHaveBeenCalled();
      expect((downloadService as any).activeDownloads.has(TEST_DOWNLOAD_KEY)).toBe(false);
      expect((downloadService as any).progressCallbacks.has(TEST_DOWNLOAD_KEY)).toBe(false);
    });

    it('should remove download from queue', async () => {
      const mockTask = createMockDownloadTask();
      (downloadService as any).downloadQueue.push(mockTask);
      (downloadService as any).progressCallbacks.set(TEST_DOWNLOAD_KEY, [jest.fn()]);

      await downloadService.cancelDownload(TEST_RECITER_ID, TEST_SURAH_NUMBER);

      expect((downloadService as any).downloadQueue.length).toBe(0);
      expect((downloadService as any).progressCallbacks.has(TEST_DOWNLOAD_KEY)).toBe(false);
    });

    it('should do nothing if download is not active or queued', async () => {
      await expect(downloadService.cancelDownload(TEST_RECITER_ID, TEST_SURAH_NUMBER)).resolves.not.toThrow();
    });
  });

  describe('getStorageUsed()', () => {
    it('should calculate total storage used by downloads', async () => {
      const downloads = [
        {
          reciter_id: 'reciter-1',
          surah_number: 1,
          local_file_path: 'audio/reciter-1/1.mp3',
          downloaded_at: new Date().toISOString(),
        },
        {
          reciter_id: 'reciter-1',
          surah_number: 2,
          local_file_path: 'audio/reciter-1/2.mp3',
          downloaded_at: new Date().toISOString(),
        },
      ];

      mockDatabase.getAllDownloads.mockResolvedValue(downloads);

      let fileCount = 0;
      mockFile.mockImplementation((base, path) => {
        fileCount++;
        return {
          exists: true,
          uri: `file://mock/${path}`,
          size: 5 * 1024 * 1024, // 5MB each
          delete: jest.fn(),
        };
      });

      const result = await downloadService.getStorageUsed();

      expect(result).toBe(10 * 1024 * 1024); // 10MB total
      expect(mockFile).toHaveBeenCalledTimes(2);
    });

    it('should skip files that do not exist', async () => {
      const downloads = [
        {
          reciter_id: 'reciter-1',
          surah_number: 1,
          local_file_path: 'audio/reciter-1/1.mp3',
          downloaded_at: new Date().toISOString(),
        },
      ];

      mockDatabase.getAllDownloads.mockResolvedValue(downloads);
      mockFile.mockImplementation((base, path) => ({
        exists: false,
        uri: `file://mock/${path}`,
        size: 0,
        delete: jest.fn(),
      }));

      const result = await downloadService.getStorageUsed();

      expect(result).toBe(0);
    });

    it('should return 0 on database error', async () => {
      mockDatabase.getAllDownloads.mockRejectedValue(new Error('Database error'));

      const result = await downloadService.getStorageUsed();

      expect(result).toBe(0);
    });
  });

  describe('getProgress()', () => {
    it('should return downloading status for active download', () => {
      const mockTask = createMockDownloadTask();
      (downloadService as any).activeDownloads.set(TEST_DOWNLOAD_KEY, mockTask);

      const result = downloadService.getProgress(TEST_RECITER_ID, TEST_SURAH_NUMBER);

      expect(result).toEqual({
        reciterId: TEST_RECITER_ID,
        surahNumber: TEST_SURAH_NUMBER,
        progress: 0,
        totalBytes: 0,
        downloadedBytes: 0,
        status: 'downloading',
      });
    });

    it('should return queued status for download in queue', () => {
      const mockTask = createMockDownloadTask();
      (downloadService as any).downloadQueue.push(mockTask);

      const result = downloadService.getProgress(TEST_RECITER_ID, TEST_SURAH_NUMBER);

      expect(result).toEqual({
        reciterId: TEST_RECITER_ID,
        surahNumber: TEST_SURAH_NUMBER,
        progress: 0,
        totalBytes: 0,
        downloadedBytes: 0,
        status: 'queued',
      });
    });

    it('should return null for download not in progress', () => {
      const result = downloadService.getProgress(TEST_RECITER_ID, TEST_SURAH_NUMBER);

      expect(result).toBeNull();
    });
  });

  describe('concurrent download limiting', () => {
    it('should respect maxConcurrentDownloads limit', async () => {
      jest.spyOn(downloadService as any, 'isDownloaded').mockResolvedValue(false);

      // Mock downloadAsync to not resolve immediately
      const mockDownloadAsync = jest.fn().mockImplementation(() => new Promise(() => {}));
      mockFileSystemLegacy.createDownloadResumable.mockReturnValue({
        downloadAsync: mockDownloadAsync,
        pauseAsync: jest.fn(),
        resumeAsync: jest.fn(),
        savable: jest.fn(),
      });

      // Start 3 downloads (limit is 2) - don't await, just start them
      downloadService.downloadSurah('reciter-1', 1);
      downloadService.downloadSurah('reciter-1', 2);
      downloadService.downloadSurah('reciter-1', 3);

      // Wait a bit for downloads to start
      await new Promise(resolve => setTimeout(resolve, 10));

      expect((downloadService as any).activeDownloads.size).toBe(2);
      expect((downloadService as any).downloadQueue.length).toBe(1);
      expect(mockDownloadAsync).toHaveBeenCalledTimes(2); // Only 2 should start immediately
    }, 10000);

    it('should start queued downloads when active downloads complete', async () => {
      jest.spyOn(downloadService as any, 'isDownloaded').mockResolvedValue(false);

      let downloadResolve: () => void;
      const mockDownloadAsync = jest.fn().mockImplementation(() =>
        new Promise<void>((resolve) => {
          downloadResolve = resolve;
        })
      );

      mockFileSystemLegacy.createDownloadResumable.mockReturnValue({
        downloadAsync: mockDownloadAsync,
        pauseAsync: jest.fn(),
        resumeAsync: jest.fn(),
        savable: jest.fn(),
      });

      // Start 3 downloads
      downloadService.downloadSurah('reciter-1', 1);
      downloadService.downloadSurah('reciter-1', 2);
      downloadService.downloadSurah('reciter-1', 3);

      // Wait a bit for downloads to start
      await new Promise(resolve => setTimeout(resolve, 10));

      // First 2 should start immediately
      expect((downloadService as any).activeDownloads.size).toBe(2);
      expect((downloadService as any).downloadQueue.length).toBe(1);

      // Complete first download
      downloadResolve!();

      // Wait for queue processing
      await new Promise(resolve => setTimeout(resolve, 10));

      // Third download should now be active
      expect((downloadService as any).activeDownloads.size).toBe(2); // Still 2 active
      expect((downloadService as any).downloadQueue.length).toBe(0); // Queue empty
    }, 10000);
  });

  describe('progress tracking', () => {
    it('should notify multiple progress callbacks', async () => {
      jest.spyOn(downloadService as any, 'isDownloaded').mockResolvedValue(false);

      const mockProgressCallback1 = jest.fn();
      const mockProgressCallback2 = jest.fn();

      let progressCallback: any;
      mockFileSystemLegacy.createDownloadResumable.mockImplementation((url, uri, options, callback) => {
        progressCallback = callback;
        return {
          downloadAsync: jest.fn().mockImplementation(async () => {
            // Simulate progress
            if (progressCallback) {
              progressCallback({
                totalBytesWritten: 512 * 1024, // 0.5MB
                totalBytesExpectedToWrite: 1024 * 1024, // 1MB
              });
            }
            return {};
          }),
          pauseAsync: jest.fn(),
          resumeAsync: jest.fn(),
          savable: jest.fn(),
        };
      });

      await downloadService.downloadSurah(TEST_RECITER_ID, TEST_SURAH_NUMBER, mockProgressCallback1);
      await downloadService.downloadSurah(TEST_RECITER_ID, TEST_SURAH_NUMBER, mockProgressCallback2);

      // Both callbacks should receive progress updates
      expect(mockProgressCallback1).toHaveBeenCalled();
      expect(mockProgressCallback2).toHaveBeenCalled();

      // Check progress values
      const progressCall = mockProgressCallback1.mock.calls.find(call =>
        call[0].status === 'downloading'
      );
      expect(progressCall).toBeDefined();
      expect(progressCall[0].progress).toBe(50); // 50% progress
      expect(progressCall[0].downloadedBytes).toBe(512 * 1024);
      expect(progressCall[0].totalBytes).toBe(1024 * 1024);
    });
  });
});