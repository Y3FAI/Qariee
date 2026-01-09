/**
 * Sync Service Tests
 */

jest.mock('expo-sqlite');
jest.mock('expo-file-system');
jest.mock('expo-asset');

import {
  createAppDatabase,
  mockFetchCdnDatabase,
  mockFetchNetworkError,
  mockFetchHttpError,
} from './test-utils';

import * as syncService from '../syncService';
import * as database from '../database';

describe('SyncService', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // ==========================================================================
  // sync()
  // ==========================================================================
  describe('sync', () => {
    it('fetches and upserts when CDN version is newer', async () => {
      await database.setDataVersion('0.9.0');

      const cdnData = createAppDatabase({ version: '1.0.0' });
      global.fetch = mockFetchCdnDatabase(cdnData);

      const result = await syncService.sync();

      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
      expect(global.fetch).toHaveBeenCalled();
    });

    it('skips upsert when versions match', async () => {
      await database.setDataVersion('1.0.0');

      const cdnData = createAppDatabase({ version: '1.0.0' });
      global.fetch = mockFetchCdnDatabase(cdnData);

      const result = await syncService.sync();

      expect(result.success).toBe(true);
      expect(result.updated).toBe(false);
    });

    it('handles network error', async () => {
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

    it('rejects invalid CDN response - missing reciters', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ version: '1.0.0' }),
      });

      const result = await syncService.sync();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    it('rejects invalid CDN response - missing version', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ reciters: [] }),
      });

      const result = await syncService.sync();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    it('rejects invalid CDN response - invalid reciter data', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          version: '1.0.0',
          reciters: [{ id: 'test' }], // Missing required fields
        }),
      });

      const result = await syncService.sync();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });
  });

  // ==========================================================================
  // SyncResult
  // ==========================================================================
  describe('SyncResult', () => {
    it('returns success with updated=true when data changed', async () => {
      await database.setDataVersion('0.9.0');
      const cdnData = createAppDatabase({ version: '1.0.0' });
      global.fetch = mockFetchCdnDatabase(cdnData);

      const result = await syncService.sync();

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('updated');
      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
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

  // ==========================================================================
  // Version updates
  // ==========================================================================
  describe('version updates', () => {
    it('updates local data version after successful sync', async () => {
      await database.setDataVersion('0.9.0');
      const cdnData = createAppDatabase({ version: '1.0.0' });
      global.fetch = mockFetchCdnDatabase(cdnData);

      await syncService.sync();

      const newVersion = await database.getDataVersion();
      expect(newVersion).toBe('1.0.0');
    });

    it('does not update version on failed sync', async () => {
      await database.setDataVersion('0.9.0');
      global.fetch = mockFetchNetworkError();

      await syncService.sync();

      const version = await database.getDataVersion();
      expect(version).toBe('0.9.0');
    });
  });
});
