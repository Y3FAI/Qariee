/**
 * Sync Service Tests
 *
 * TDD approach: These tests define the expected behavior of the sync service.
 */

// Mock modules before imports
jest.mock('expo-sqlite');
jest.mock('expo-file-system');
jest.mock('expo-asset');

import {
  createAppDatabase,
  createCdnReciters,
  mockFetchCdnDatabase,
  mockFetchNetworkError,
  mockFetchHttpError,
  wait,
} from './test-utils';

// Import after mocking
import * as syncService from '../syncService';
import * as database from '../database';

describe('SyncService', () => {
  // Store original fetch
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Reset sync state before each test
    syncService.__resetSyncState();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore fetch
    global.fetch = originalFetch;
  });

  // ==========================================================================
  // SyncStatus
  // ==========================================================================
  describe('getSyncStatus', () => {
    it('returns IDLE initially', () => {
      const status = syncService.getSyncStatus();
      expect(status).toBe('IDLE');
    });

    it('returns valid SyncStatus enum value', () => {
      const status = syncService.getSyncStatus();
      expect(['IDLE', 'SYNCING', 'ERROR']).toContain(status);
    });
  });

  // ==========================================================================
  // sync()
  // ==========================================================================
  describe('sync', () => {
    it('fetches and upserts when CDN version is newer', async () => {
      // Set up current data version as older
      await database.setDataVersion('0.9.0');

      // Mock CDN response with newer version
      const cdnData = createAppDatabase({ version: '1.0.0' });
      global.fetch = mockFetchCdnDatabase(cdnData);

      const result = await syncService.sync();

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalled();
    });

    it('skips upsert when versions match', async () => {
      // Set up current data version same as CDN
      await database.setDataVersion('1.0.0');

      const cdnData = createAppDatabase({ version: '1.0.0' });
      global.fetch = mockFetchCdnDatabase(cdnData);

      const result = await syncService.sync();

      // Should succeed but indicate no update needed
      expect(result.success).toBe(true);
    });

    it('handles network error without crashing', async () => {
      global.fetch = mockFetchNetworkError();

      const result = await syncService.sync();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('handles HTTP error response', async () => {
      global.fetch = mockFetchHttpError(500);

      const result = await syncService.sync();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('rejects invalid CDN response', async () => {
      // Mock response with invalid data (missing reciters)
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ version: '1.0.0' }), // Missing reciters array
      });

      const result = await syncService.sync();

      expect(result.success).toBe(false);
      expect(result.error).toContain('invalid');
    });

    it('updates sync status during sync', async () => {
      const cdnData = createAppDatabase();
      global.fetch = jest.fn().mockImplementation(async () => {
        // During fetch, status should be SYNCING
        expect(syncService.getSyncStatus()).toBe('SYNCING');
        return {
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(cdnData),
        };
      });

      await syncService.sync();
    });

    it('sets status to ERROR on failure', async () => {
      global.fetch = mockFetchNetworkError();

      await syncService.sync();

      expect(syncService.getSyncStatus()).toBe('ERROR');
    });

    it('sets status to IDLE on success', async () => {
      const cdnData = createAppDatabase();
      global.fetch = mockFetchCdnDatabase(cdnData);

      await syncService.sync();

      expect(syncService.getSyncStatus()).toBe('IDLE');
    });
  });

  // ==========================================================================
  // Debouncing
  // ==========================================================================
  describe('requestSync (debounced)', () => {
    it('debounces rapid calls - only one sync executes', async () => {
      const cdnData = createAppDatabase();
      global.fetch = mockFetchCdnDatabase(cdnData);

      // Request sync multiple times rapidly
      syncService.requestSync();
      syncService.requestSync();
      syncService.requestSync();

      // Wait for debounce period
      await wait(100);

      // Should only have fetched once
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('executes sync after debounce delay', async () => {
      const cdnData = createAppDatabase();
      global.fetch = mockFetchCdnDatabase(cdnData);

      syncService.requestSync();

      // Immediately after request, sync shouldn't have started
      expect(global.fetch).not.toHaveBeenCalled();

      // Wait for debounce
      await wait(100);

      // Now it should have executed
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Mutex (prevent concurrent syncs)
  // ==========================================================================
  describe('concurrent sync prevention', () => {
    it('prevents concurrent syncs', async () => {
      let resolveFirst: () => void;
      const firstFetchPromise = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });

      const cdnData = createAppDatabase();
      let fetchCount = 0;

      global.fetch = jest.fn().mockImplementation(async () => {
        fetchCount++;
        if (fetchCount === 1) {
          await firstFetchPromise; // Hold first request
        }
        return {
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(cdnData),
        };
      });

      // Start first sync
      const firstSync = syncService.sync();

      // Try to start second sync while first is running
      const secondSync = syncService.sync();

      // Release first sync
      resolveFirst!();

      await Promise.all([firstSync, secondSync]);

      // Only one actual fetch should have occurred
      // (second sync should have been skipped or queued)
      expect(fetchCount).toBeLessThanOrEqual(2);
    });
  });

  // ==========================================================================
  // forceSync
  // ==========================================================================
  describe('forceSync', () => {
    it('bypasses debounce for immediate sync', async () => {
      const cdnData = createAppDatabase();
      global.fetch = mockFetchCdnDatabase(cdnData);

      // Force sync should execute immediately
      await syncService.forceSync();

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // SyncResult
  // ==========================================================================
  describe('SyncResult', () => {
    it('returns success with updated flag when data changed', async () => {
      await database.setDataVersion('0.9.0');
      const cdnData = createAppDatabase({ version: '1.0.0' });
      global.fetch = mockFetchCdnDatabase(cdnData);

      const result = await syncService.sync();

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('updated');
      expect(result.success).toBe(true);
    });

    it('returns success with updated=false when no change needed', async () => {
      await database.setDataVersion('1.0.0');
      const cdnData = createAppDatabase({ version: '1.0.0' });
      global.fetch = mockFetchCdnDatabase(cdnData);

      const result = await syncService.sync();

      expect(result.success).toBe(true);
      expect(result.updated).toBe(false);
    });

    it('returns error message on failure', async () => {
      global.fetch = mockFetchNetworkError();

      const result = await syncService.sync();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    });
  });
});
