import * as SQLite from 'expo-sqlite';
import { Reciter, Surah, Download } from '../types';

const db = SQLite.openDatabaseSync('rabi.db');

export const initDatabase = async (): Promise<void> => {
  try {
    // Create reciters table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS reciters (
        id TEXT PRIMARY KEY,
        name_en TEXT NOT NULL,
        name_ar TEXT NOT NULL,
        color_primary TEXT NOT NULL,
        color_secondary TEXT NOT NULL
      );
    `);

    // Create surahs table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS surahs (
        number INTEGER PRIMARY KEY,
        name_ar TEXT NOT NULL,
        name_en TEXT NOT NULL
      );
    `);

    // Create downloads table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS downloads (
        reciter_id TEXT NOT NULL,
        surah_number INTEGER NOT NULL,
        local_file_path TEXT NOT NULL,
        downloaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (reciter_id, surah_number)
      );
    `);

    // Create app metadata table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS app_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Run migrations
    await runMigrations();
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

const runMigrations = async (): Promise<void> => {
  try {
    // Check if color columns exist in reciters table
    const tableInfo = await db.getAllAsync<{ name: string }>(
      'PRAGMA table_info(reciters)'
    );

    const hasColorPrimary = tableInfo.some((col) => col.name === 'color_primary');
    const hasColorSecondary = tableInfo.some((col) => col.name === 'color_secondary');

    // Add color columns if they don't exist
    if (!hasColorPrimary) {
      await db.execAsync('ALTER TABLE reciters ADD COLUMN color_primary TEXT DEFAULT "#282828"');
    }

    if (!hasColorSecondary) {
      await db.execAsync('ALTER TABLE reciters ADD COLUMN color_secondary TEXT DEFAULT "#404040"');
    }
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error;
  }
};

// Reciters
export const insertReciter = async (reciter: Reciter): Promise<void> => {
  await db.runAsync(
    'INSERT OR REPLACE INTO reciters (id, name_en, name_ar, color_primary, color_secondary) VALUES (?, ?, ?, ?, ?)',
    [reciter.id, reciter.name_en, reciter.name_ar, reciter.color_primary, reciter.color_secondary]
  );
};

export const getAllReciters = async (): Promise<Reciter[]> => {
  const result = await db.getAllAsync<Reciter>('SELECT * FROM reciters ORDER BY id');
  return result;
};

export const getReciterById = async (id: string): Promise<Reciter | null> => {
  const result = await db.getFirstAsync<Reciter>(
    'SELECT * FROM reciters WHERE id = ?',
    [id]
  );
  return result || null;
};

export const deleteAllReciters = async (): Promise<void> => {
  await db.runAsync('DELETE FROM reciters');
};

// Surahs
export const insertSurah = async (surah: Surah): Promise<void> => {
  await db.runAsync(
    'INSERT OR REPLACE INTO surahs (number, name_ar, name_en) VALUES (?, ?, ?)',
    [surah.number, surah.name_ar, surah.name_en]
  );
};

export const getAllSurahs = async (): Promise<Surah[]> => {
  const result = await db.getAllAsync<Surah>('SELECT * FROM surahs ORDER BY number');
  return result;
};

export const getSurahByNumber = async (number: number): Promise<Surah | null> => {
  const result = await db.getFirstAsync<Surah>(
    'SELECT * FROM surahs WHERE number = ?',
    [number]
  );
  return result || null;
};

// Downloads
export const insertDownload = async (download: Omit<Download, 'downloaded_at'>): Promise<void> => {
  await db.runAsync(
    'INSERT OR REPLACE INTO downloads (reciter_id, surah_number, local_file_path) VALUES (?, ?, ?)',
    [download.reciter_id, download.surah_number, download.local_file_path]
  );
};

export const getDownload = async (
  reciterId: string,
  surahNumber: number
): Promise<Download | null> => {
  const result = await db.getFirstAsync<Download>(
    'SELECT * FROM downloads WHERE reciter_id = ? AND surah_number = ?',
    [reciterId, surahNumber]
  );
  return result || null;
};

export const getAllDownloads = async (): Promise<Download[]> => {
  const result = await db.getAllAsync<Download>(
    'SELECT * FROM downloads ORDER BY downloaded_at DESC'
  );
  return result;
};

export const getDownloadsByReciter = async (reciterId: string): Promise<Download[]> => {
  const result = await db.getAllAsync<Download>(
    'SELECT * FROM downloads WHERE reciter_id = ? ORDER BY surah_number',
    [reciterId]
  );
  return result;
};

export const deleteDownload = async (
  reciterId: string,
  surahNumber: number
): Promise<void> => {
  await db.runAsync(
    'DELETE FROM downloads WHERE reciter_id = ? AND surah_number = ?',
    [reciterId, surahNumber]
  );
};

export const isDownloaded = async (
  reciterId: string,
  surahNumber: number
): Promise<boolean> => {
  const download = await getDownload(reciterId, surahNumber);
  return download !== null;
};

// App metadata
export const getMetadata = async (key: string): Promise<string | null> => {
  const result = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_metadata WHERE key = ?',
    [key]
  );
  return result?.value || null;
};

export const setMetadata = async (key: string, value: string): Promise<void> => {
  await db.runAsync(
    'INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)',
    [key, value]
  );
};

export { db };
