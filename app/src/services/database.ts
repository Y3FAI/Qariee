import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import { File } from 'expo-file-system';
import { Paths } from 'expo-file-system';
import { Asset } from 'expo-asset';
import { Reciter, Surah, Download } from '../types';

// =============================================================================
// Constants
// =============================================================================

const DATABASE_NAME = 'database.db';

// =============================================================================
// Database Instance
// =============================================================================

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Get the database instance, opening it if necessary
 */
const getDb = (): SQLite.SQLiteDatabase => {
  if (!db) {
    db = SQLite.openDatabaseSync(DATABASE_NAME);
  }
  return db;
};

/**
 * Close the database connection. Call this when the app is terminating.
 * In practice, React Native apps typically keep the DB open for the app's lifetime,
 * but this function is provided for cleanup during app background/termination events.
 */
export const closeDatabase = async (): Promise<void> => {
  if (db) {
    await db.closeAsync();
    db = null;
  }
};

// =============================================================================
// Database Initialization
// =============================================================================

/**
 * Ensures the SQLite directory exists (required on Android)
 */
const ensureSQLiteDirectoryExists = async (): Promise<void> => {
  const sqliteDir = `${FileSystem.documentDirectory}SQLite`;
  const dirInfo = await FileSystem.getInfoAsync(sqliteDir);

  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
  }
};

/**
 * Copies the bundled database to the document directory on first install.
 * Returns true if database was copied, false if it already exists.
 */
const copyBundledDatabase = async (): Promise<boolean> => {
  const dbPath = `${FileSystem.documentDirectory}SQLite/${DATABASE_NAME}`;
  const fileInfo = await FileSystem.getInfoAsync(dbPath);

  if (fileInfo.exists) {
    return false; // Already exists
  }

  // Load bundled database asset
  const asset = Asset.fromModule(require('../../assets/data/database.db'));
  await asset.downloadAsync();

  if (!asset.localUri) {
    throw new Error('Failed to load bundled database');
  }

  // Copy to document directory
  await FileSystem.copyAsync({
    from: asset.localUri,
    to: dbPath,
  });

  return true;
};

/**
 * Initialize database - call once on app start
 * Simple flow: ensure directory exists → copy bundled DB if needed
 */
export const initDatabase = async (): Promise<void> => {
  await ensureSQLiteDirectoryExists();
  await copyBundledDatabase();
};

// =============================================================================
// CDN Sync Version
// =============================================================================

/**
 * Gets the data version (for CDN sync)
 */
export const getDataVersion = async (): Promise<string | null> => {
  return getMetadata('data_version');
};

/**
 * Sets the data version (for CDN sync)
 */
export const setDataVersion = async (version: string): Promise<void> => {
  await setMetadata('data_version', version);
};

// =============================================================================
// Upsert Functions (for CDN sync)
// =============================================================================

/**
 * Upserts multiple reciters in a single transaction
 */
export const upsertReciters = async (reciters: Reciter[]): Promise<void> => {
  if (reciters.length === 0) return;

  const database = getDb();

  await database.withTransactionAsync(async () => {
    for (const reciter of reciters) {
      await database.runAsync(
        `INSERT INTO reciters (id, name_en, name_ar, color_primary, color_secondary, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name_en = excluded.name_en,
           name_ar = excluded.name_ar,
           color_primary = excluded.color_primary,
           color_secondary = excluded.color_secondary,
           sort_order = excluded.sort_order`,
        [reciter.id, reciter.name_en, reciter.name_ar, reciter.color_primary, reciter.color_secondary, reciter.sort_order]
      );
    }
  });
};

/**
 * Upserts multiple surahs in a single transaction
 */
export const upsertSurahs = async (surahs: Surah[]): Promise<void> => {
  if (surahs.length === 0) return;

  const database = getDb();

  await database.withTransactionAsync(async () => {
    for (const surah of surahs) {
      await database.runAsync(
        `INSERT INTO surahs (number, name_ar, name_en)
         VALUES (?, ?, ?)
         ON CONFLICT(number) DO UPDATE SET
           name_ar = excluded.name_ar,
           name_en = excluded.name_en`,
        [surah.number, surah.name_ar, surah.name_en]
      );
    }
  });
};

// =============================================================================
// Reciters CRUD
// =============================================================================

export const insertReciter = async (reciter: Reciter): Promise<void> => {
  const database = getDb();
  await database.runAsync(
    'INSERT OR REPLACE INTO reciters (id, name_en, name_ar, color_primary, color_secondary, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
    [reciter.id, reciter.name_en, reciter.name_ar, reciter.color_primary, reciter.color_secondary, reciter.sort_order]
  );
};

export const getAllReciters = async (): Promise<Reciter[]> => {
  const database = getDb();
  return database.getAllAsync<Reciter>('SELECT * FROM reciters ORDER BY sort_order');
};

export const getReciterById = async (id: string): Promise<Reciter | null> => {
  const database = getDb();
  const result = await database.getFirstAsync<Reciter>(
    'SELECT * FROM reciters WHERE id = ?',
    [id]
  );
  return result || null;
};

export const deleteAllReciters = async (): Promise<void> => {
  const database = getDb();
  await database.runAsync('DELETE FROM reciters');
};

// =============================================================================
// Surahs CRUD
// =============================================================================

export const insertSurah = async (surah: Surah): Promise<void> => {
  const database = getDb();
  await database.runAsync(
    'INSERT OR REPLACE INTO surahs (number, name_ar, name_en) VALUES (?, ?, ?)',
    [surah.number, surah.name_ar, surah.name_en]
  );
};

export const getAllSurahs = async (): Promise<Surah[]> => {
  const database = getDb();
  return database.getAllAsync<Surah>('SELECT * FROM surahs ORDER BY number');
};

export const getSurahByNumber = async (number: number): Promise<Surah | null> => {
  const database = getDb();
  const result = await database.getFirstAsync<Surah>(
    'SELECT * FROM surahs WHERE number = ?',
    [number]
  );
  return result || null;
};

// =============================================================================
// Downloads CRUD
// =============================================================================

export const insertDownload = async (download: Omit<Download, 'downloaded_at'>): Promise<void> => {
  const database = getDb();
  await database.runAsync(
    'INSERT OR REPLACE INTO downloads (reciter_id, surah_number, local_file_path) VALUES (?, ?, ?)',
    [download.reciter_id, download.surah_number, download.local_file_path]
  );
};

export const getDownload = async (
  reciterId: string,
  surahNumber: number
): Promise<Download | null> => {
  const database = getDb();
  const result = await database.getFirstAsync<Download>(
    'SELECT * FROM downloads WHERE reciter_id = ? AND surah_number = ?',
    [reciterId, surahNumber]
  );
  return result || null;
};

export const getAllDownloads = async (): Promise<Download[]> => {
  const database = getDb();
  return database.getAllAsync<Download>(
    'SELECT * FROM downloads ORDER BY downloaded_at DESC'
  );
};

export const getDownloadsByReciter = async (reciterId: string): Promise<Download[]> => {
  const database = getDb();
  return database.getAllAsync<Download>(
    'SELECT * FROM downloads WHERE reciter_id = ? ORDER BY surah_number',
    [reciterId]
  );
};

export const deleteDownload = async (
  reciterId: string,
  surahNumber: number
): Promise<void> => {
  const database = getDb();
  await database.runAsync(
    'DELETE FROM downloads WHERE reciter_id = ? AND surah_number = ?',
    [reciterId, surahNumber]
  );
};

export const isDownloaded = async (
  reciterId: string,
  surahNumber: number
): Promise<boolean> => {
  const download = await getDownload(reciterId, surahNumber);
  if (!download) {
    return false;
  }

  // Also verify the file actually exists on disk
  try {
    const file = new File(Paths.document, download.local_file_path);
    return file.exists;
  } catch {
    return false;
  }
};

// =============================================================================
// App Metadata
// =============================================================================

export const getMetadata = async (key: string): Promise<string | null> => {
  const database = getDb();
  const result = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_metadata WHERE key = ?',
    [key]
  );
  return result?.value || null;
};

export const setMetadata = async (key: string, value: string): Promise<void> => {
  const database = getDb();
  await database.runAsync(
    'INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)',
    [key, value]
  );
};
