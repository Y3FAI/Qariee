import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { Reciter, Surah, Download } from '../types';

// =============================================================================
// Constants
// =============================================================================

/**
 * Current schema version. Increment when making schema changes.
 * Migrations will be run for versions between local and current.
 */
export const CURRENT_SCHEMA_VERSION = 1;

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

// =============================================================================
// New Infrastructure Functions
// =============================================================================

/**
 * Ensures the SQLite directory exists (required on Android)
 * Returns true if directory exists or was created successfully
 */
export const ensureSQLiteDirectoryExists = async (): Promise<boolean> => {
  try {
    const sqliteDir = `${FileSystem.documentDirectory}SQLite`;
    const dirInfo = await FileSystem.getInfoAsync(sqliteDir);

    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
    }

    return true;
  } catch (error) {
    console.error('Error ensuring SQLite directory exists:', error);
    return false;
  }
};

/**
 * Copies the bundled database to the document directory on first install.
 * Returns true if database was copied, false if it already exists.
 */
export const copyBundledDatabaseIfNeeded = async (): Promise<boolean> => {
  try {
    const dbPath = `${FileSystem.documentDirectory}SQLite/${DATABASE_NAME}`;
    const fileInfo = await FileSystem.getInfoAsync(dbPath);

    if (fileInfo.exists) {
      return false; // Database already exists, skip copy
    }

    // Ensure directory exists
    await ensureSQLiteDirectoryExists();

    // Load bundled database asset
    const asset = Asset.fromModule(require('../../assets/data/database.db'));
    await asset.downloadAsync();

    if (!asset.localUri) {
      throw new Error('Failed to download bundled database asset');
    }

    // Copy to document directory
    await FileSystem.copyAsync({
      from: asset.localUri,
      to: dbPath,
    });

    return true;
  } catch (error) {
    console.error('Error copying bundled database:', error);
    return false;
  }
};

/**
 * Health check result interface
 */
export interface HealthCheckResult {
  isHealthy: boolean;
  tablesExist: boolean;
  hasReciters: boolean;
  hasSurahs: boolean;
  schemaVersion: number;
  errors: string[];
}

/**
 * Performs a health check on the database
 * Verifies tables exist and contain required data
 */
export const healthCheck = async (): Promise<HealthCheckResult> => {
  const result: HealthCheckResult = {
    isHealthy: false,
    tablesExist: false,
    hasReciters: false,
    hasSurahs: false,
    schemaVersion: 0,
    errors: [],
  };

  try {
    const database = getDb();

    // Check if tables exist by trying to query them
    try {
      const reciters = await database.getAllAsync<Reciter>('SELECT * FROM reciters LIMIT 1');
      result.hasReciters = reciters.length > 0;
    } catch {
      result.errors.push('reciters table missing or inaccessible');
    }

    try {
      const surahs = await database.getAllAsync<Surah>('SELECT * FROM surahs LIMIT 1');
      result.hasSurahs = surahs.length > 0;
    } catch {
      result.errors.push('surahs table missing or inaccessible');
    }

    // Tables exist if we didn't get errors
    result.tablesExist = result.errors.length === 0;

    // Get schema version
    result.schemaVersion = await getSchemaVersion();

    // Overall health
    result.isHealthy = result.tablesExist && result.hasReciters && result.hasSurahs;
  } catch (error) {
    result.errors.push(`Health check failed: ${error}`);
  }

  return result;
};

// =============================================================================
// Schema Version Management
// =============================================================================

/**
 * Gets the current schema version from the database
 * Returns 0 if no version is set
 */
export const getSchemaVersion = async (): Promise<number> => {
  try {
    const result = await getMetadata('schema_version');
    return result ? parseInt(result, 10) : 0;
  } catch {
    return 0;
  }
};

/**
 * Sets the schema version in the database
 */
export const setSchemaVersion = async (version: number): Promise<void> => {
  await setMetadata('schema_version', String(version));
};

/**
 * Gets the data version (CDN sync version)
 * Returns null if no version is set
 */
export const getDataVersion = async (): Promise<string | null> => {
  return getMetadata('data_version');
};

/**
 * Sets the data version (CDN sync version)
 */
export const setDataVersion = async (version: string): Promise<void> => {
  await setMetadata('data_version', version);
};

// =============================================================================
// Migrations
// =============================================================================

/**
 * Migration definitions
 * Key is the target version, value is array of SQL statements
 */
const MIGRATIONS: Record<number, string[]> = {
  // Version 1 is the initial schema (bundled database)
  1: [],
  // Future migrations go here:
  // 2: ['ALTER TABLE reciters ADD COLUMN sort_order INTEGER DEFAULT 0'],
};

/**
 * Runs pending database migrations
 */
export const runMigrations = async (): Promise<void> => {
  const currentVersion = await getSchemaVersion();

  if (currentVersion >= CURRENT_SCHEMA_VERSION) {
    return; // No migrations needed
  }

  const database = getDb();

  try {
    // Run migrations for each version between current and target
    for (let version = currentVersion + 1; version <= CURRENT_SCHEMA_VERSION; version++) {
      const statements = MIGRATIONS[version] || [];

      for (const sql of statements) {
        await database.execAsync(sql);
      }
    }

    // Update schema version
    await setSchemaVersion(CURRENT_SCHEMA_VERSION);
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error;
  }
};

// =============================================================================
// Batch Upsert Functions (with transactions)
// =============================================================================

/**
 * Upserts multiple reciters in a single transaction
 * Uses INSERT ... ON CONFLICT for safe concurrent access
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
// Legacy Database Initialization (kept for backwards compatibility)
// =============================================================================

/**
 * @deprecated Use copyBundledDatabaseIfNeeded() + runMigrations() instead
 * Initializes database with CREATE TABLE statements
 * Only needed if bundled database is not available
 */
export const initDatabase = async (): Promise<void> => {
  try {
    const database = getDb();

    // Create reciters table
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS reciters (
        id TEXT PRIMARY KEY,
        name_en TEXT NOT NULL,
        name_ar TEXT NOT NULL,
        color_primary TEXT NOT NULL,
        color_secondary TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      );
    `);

    // Create surahs table
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS surahs (
        number INTEGER PRIMARY KEY,
        name_ar TEXT NOT NULL,
        name_en TEXT NOT NULL
      );
    `);

    // Create downloads table
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS downloads (
        reciter_id TEXT NOT NULL,
        surah_number INTEGER NOT NULL,
        local_file_path TEXT NOT NULL,
        downloaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (reciter_id, surah_number)
      );
    `);

    // Create app metadata table
    await database.execAsync(`
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
  const result = await database.getAllAsync<Reciter>('SELECT * FROM reciters ORDER BY sort_order');
  return result;
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
  const result = await database.getAllAsync<Surah>('SELECT * FROM surahs ORDER BY number');
  return result;
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
  const result = await database.getAllAsync<Download>(
    'SELECT * FROM downloads ORDER BY downloaded_at DESC'
  );
  return result;
};

export const getDownloadsByReciter = async (reciterId: string): Promise<Download[]> => {
  const database = getDb();
  const result = await database.getAllAsync<Download>(
    'SELECT * FROM downloads WHERE reciter_id = ? ORDER BY surah_number',
    [reciterId]
  );
  return result;
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
  return download !== null;
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

// =============================================================================
// Exports
// =============================================================================

// Export db getter for direct access if needed
export { getDb as db };
