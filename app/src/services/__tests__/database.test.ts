/**
 * Database Service Tests
 */

jest.mock('expo-sqlite');
jest.mock('expo-file-system');
jest.mock('expo-asset');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sqliteMock = require('../../../__mocks__/expo-sqlite');

import {
  createReciter,
  createReciters,
  createSurah,
  createSurahs,
} from './test-utils';

import * as database from '../database';

describe('Database Service', () => {
  beforeEach(() => {
    sqliteMock.__resetMockDatabase();
  });

  // ==========================================================================
  // initDatabase
  // ==========================================================================
  describe('initDatabase', () => {
    it('completes without error', async () => {
      await expect(database.initDatabase()).resolves.not.toThrow();
    });
  });

  // ==========================================================================
  // upsertReciters
  // ==========================================================================
  describe('upsertReciters', () => {
    it('inserts new reciters', async () => {
      const reciters = createReciters(3);

      await database.upsertReciters(reciters);

      const allReciters = await database.getAllReciters();
      expect(allReciters.length).toBeGreaterThanOrEqual(3);
    });

    it('updates existing reciters', async () => {
      const initial = createReciter({
        id: 'update-test-reciter',
        name_en: 'Old Name',
      });
      await database.insertReciter(initial);

      const updated = createReciter({
        id: 'update-test-reciter',
        name_en: 'New Name',
      });
      await database.upsertReciters([updated]);

      const result = await database.getReciterById('update-test-reciter');
      expect(result?.name_en).toBe('New Name');
    });

    it('handles empty array without error', async () => {
      await expect(database.upsertReciters([])).resolves.not.toThrow();
    });
  });

  // ==========================================================================
  // upsertSurahs
  // ==========================================================================
  describe('upsertSurahs', () => {
    it('inserts new surahs', async () => {
      const surahs = createSurahs(5);

      await database.upsertSurahs(surahs);

      const allSurahs = await database.getAllSurahs();
      expect(allSurahs.length).toBeGreaterThanOrEqual(5);
    });

    it('updates existing surahs', async () => {
      await database.insertSurah(createSurah({ number: 999, name_en: 'Old' }));

      await database.upsertSurahs([createSurah({ number: 999, name_en: 'Updated' })]);

      const result = await database.getSurahByNumber(999);
      expect(result?.name_en).toBe('Updated');
    });

    it('handles empty array without error', async () => {
      await expect(database.upsertSurahs([])).resolves.not.toThrow();
    });
  });

  // ==========================================================================
  // getDataVersion / setDataVersion
  // ==========================================================================
  describe('getDataVersion / setDataVersion', () => {
    beforeEach(() => {
      sqliteMock.__setMockDatabase({
        reciters: [],
        surahs: [],
        downloads: [],
        app_metadata: [],
      });
    });

    it('returns null if no version is set', async () => {
      const version = await database.getDataVersion();
      expect(version).toBeNull();
    });

    it('persists version correctly', async () => {
      await database.setDataVersion('1.0.0');

      const version = await database.getDataVersion();
      expect(version).toBe('1.0.0');
    });

    it('updates existing version', async () => {
      await database.setDataVersion('1.0.0');
      await database.setDataVersion('1.1.0');

      const version = await database.getDataVersion();
      expect(version).toBe('1.1.0');
    });
  });

  // ==========================================================================
  // Reciters CRUD
  // ==========================================================================
  describe('reciters CRUD', () => {
    beforeEach(() => {
      sqliteMock.__resetMockDatabase();
    });

    it('inserts and retrieves reciters', async () => {
      const reciter = createReciter({ id: 'test-reciter' });

      await database.insertReciter(reciter);
      const reciters = await database.getAllReciters();

      expect(reciters.length).toBeGreaterThanOrEqual(1);
      expect(reciters.find(r => r.id === 'test-reciter')).toBeDefined();
    });

    it('returns reciter by id', async () => {
      const reciter = createReciter({ id: 'get-by-id-test' });
      await database.insertReciter(reciter);

      const result = await database.getReciterById('get-by-id-test');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('get-by-id-test');
    });

    it('returns null for non-existent id', async () => {
      const result = await database.getReciterById('non-existent-id');
      expect(result).toBeNull();
    });

    it('deletes all reciters', async () => {
      await database.insertReciter(createReciter({ id: 'reciter-1' }));
      await database.insertReciter(createReciter({ id: 'reciter-2' }));

      await database.deleteAllReciters();

      const reciters = await database.getAllReciters();
      expect(reciters.length).toBe(0);
    });
  });

  // ==========================================================================
  // Surahs CRUD
  // ==========================================================================
  describe('surahs CRUD', () => {
    beforeEach(() => {
      sqliteMock.__resetMockDatabase();
    });

    it('inserts and retrieves surahs', async () => {
      const surah = createSurah({ number: 997 });

      await database.insertSurah(surah);
      const surahs = await database.getAllSurahs();

      expect(surahs.length).toBeGreaterThanOrEqual(1);
      expect(surahs.find(s => s.number === 997)).toBeDefined();
    });

    it('returns surah by number', async () => {
      await database.insertSurah(createSurah({ number: 998 }));

      const result = await database.getSurahByNumber(998);

      expect(result).not.toBeNull();
      expect(result?.number).toBe(998);
    });

    it('returns null for non-existent number', async () => {
      const result = await database.getSurahByNumber(999);
      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // Downloads CRUD
  // ==========================================================================
  describe('downloads CRUD', () => {
    beforeEach(() => {
      sqliteMock.__resetMockDatabase();
    });

    it('inserts and retrieves downloads', async () => {
      await database.insertDownload({
        reciter_id: 'test-reciter',
        surah_number: 1,
        local_file_path: '/path/to/file.mp3',
      });

      const download = await database.getDownload('test-reciter', 1);

      expect(download).not.toBeNull();
      expect(download?.reciter_id).toBe('test-reciter');
      expect(download?.surah_number).toBe(1);
    });

    it('returns all downloads', async () => {
      await database.insertDownload({
        reciter_id: 'reciter-1',
        surah_number: 1,
        local_file_path: '/path/1.mp3',
      });
      await database.insertDownload({
        reciter_id: 'reciter-1',
        surah_number: 2,
        local_file_path: '/path/2.mp3',
      });

      const downloads = await database.getAllDownloads();
      expect(downloads.length).toBeGreaterThanOrEqual(2);
    });

    it('returns downloads by reciter', async () => {
      await database.insertDownload({
        reciter_id: 'reciter-a',
        surah_number: 1,
        local_file_path: '/path/1.mp3',
      });
      await database.insertDownload({
        reciter_id: 'reciter-b',
        surah_number: 1,
        local_file_path: '/path/2.mp3',
      });

      const downloads = await database.getDownloadsByReciter('reciter-a');
      expect(downloads.every(d => d.reciter_id === 'reciter-a')).toBe(true);
    });

    it('deletes download', async () => {
      await database.insertDownload({
        reciter_id: 'delete-test',
        surah_number: 1,
        local_file_path: '/path/file.mp3',
      });

      await database.deleteDownload('delete-test', 1);

      const download = await database.getDownload('delete-test', 1);
      expect(download).toBeNull();
    });

    it('checks if downloaded', async () => {
      await database.insertDownload({
        reciter_id: 'check-test',
        surah_number: 1,
        local_file_path: '/path/file.mp3',
      });

      const downloaded = await database.isDownloaded('check-test', 1);
      const notDownloaded = await database.isDownloaded('different-reciter', 1);

      expect(downloaded).toBe(true);
      expect(notDownloaded).toBe(false);
    });
  });

  // ==========================================================================
  // Metadata
  // ==========================================================================
  describe('metadata', () => {
    beforeEach(() => {
      sqliteMock.__resetMockDatabase();
    });

    it('stores and retrieves metadata', async () => {
      await database.setMetadata('test_key', 'test_value');

      const value = await database.getMetadata('test_key');
      expect(value).toBe('test_value');
    });

    it('returns null for non-existent key', async () => {
      const value = await database.getMetadata('non_existent_key');
      expect(value).toBeNull();
    });

    it('updates existing metadata', async () => {
      await database.setMetadata('update_key', 'old_value');
      await database.setMetadata('update_key', 'new_value');

      const value = await database.getMetadata('update_key');
      expect(value).toBe('new_value');
    });
  });
});
