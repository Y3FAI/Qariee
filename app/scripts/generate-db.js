/**
 * Database Generation Script
 *
 * Generates a pre-populated SQLite database for bundling with the app.
 * Run with: npm run generate-db
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Paths
const DB_JSON_PATH = path.join(__dirname, '../../backend/r2/metadata/db.json');
const SURAHS_JSON_PATH = path.join(__dirname, '../assets/data/surahs.json');
const OUTPUT_PATH = path.join(__dirname, '../assets/data/database.db');

// Schema version (must match CURRENT_SCHEMA_VERSION in database.ts)
const SCHEMA_VERSION = 1;

function main() {
  console.log('🗄️  Generating bundled database...\n');

  // Read source data
  console.log('📖 Reading source data...');

  if (!fs.existsSync(DB_JSON_PATH)) {
    console.error(`❌ Error: db.json not found at ${DB_JSON_PATH}`);
    process.exit(1);
  }

  if (!fs.existsSync(SURAHS_JSON_PATH)) {
    console.error(`❌ Error: surahs.json not found at ${SURAHS_JSON_PATH}`);
    process.exit(1);
  }

  const dbJson = JSON.parse(fs.readFileSync(DB_JSON_PATH, 'utf8'));
  const surahsJson = JSON.parse(fs.readFileSync(SURAHS_JSON_PATH, 'utf8'));

  console.log(`   Found ${dbJson.reciters.length} reciters`);
  console.log(`   Found ${surahsJson.surahs.length} surahs`);

  // Remove existing database if it exists
  if (fs.existsSync(OUTPUT_PATH)) {
    console.log('\n🗑️  Removing existing database...');
    fs.unlinkSync(OUTPUT_PATH);
  }

  // Create new database
  console.log('\n🔨 Creating database...');
  const db = new Database(OUTPUT_PATH);

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');

  // Create tables
  console.log('📋 Creating tables...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS reciters (
      id TEXT PRIMARY KEY,
      name_en TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      color_primary TEXT NOT NULL,
      color_secondary TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS surahs (
      number INTEGER PRIMARY KEY,
      name_ar TEXT NOT NULL,
      name_en TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS downloads (
      reciter_id TEXT NOT NULL,
      surah_number INTEGER NOT NULL,
      local_file_path TEXT NOT NULL,
      downloaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (reciter_id, surah_number)
    );

    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Insert reciters
  console.log('👤 Inserting reciters...');
  const insertReciter = db.prepare(`
    INSERT INTO reciters (id, name_en, name_ar, color_primary, color_secondary)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertReciters = db.transaction((reciters) => {
    for (const reciter of reciters) {
      insertReciter.run(
        reciter.id,
        reciter.name_en,
        reciter.name_ar,
        reciter.color_primary,
        reciter.color_secondary
      );
    }
  });

  insertReciters(dbJson.reciters);
  console.log(`   Inserted ${dbJson.reciters.length} reciters`);

  // Insert surahs
  console.log('📖 Inserting surahs...');
  const insertSurah = db.prepare(`
    INSERT INTO surahs (number, name_ar, name_en)
    VALUES (?, ?, ?)
  `);

  const insertSurahs = db.transaction((surahs) => {
    for (const surah of surahs) {
      insertSurah.run(surah.number, surah.name_ar, surah.name_en);
    }
  });

  insertSurahs(surahsJson.surahs);
  console.log(`   Inserted ${surahsJson.surahs.length} surahs`);

  // Insert metadata
  console.log('⚙️  Setting metadata...');
  const insertMetadata = db.prepare(`
    INSERT INTO app_metadata (key, value)
    VALUES (?, ?)
  `);

  insertMetadata.run('schema_version', String(SCHEMA_VERSION));
  insertMetadata.run('data_version', dbJson.version);
  insertMetadata.run('cdn_base_url', dbJson.settings?.cdn_base_url || 'https://qariee-storage.y3f.me');

  console.log(`   schema_version: ${SCHEMA_VERSION}`);
  console.log(`   data_version: ${dbJson.version}`);

  // Close database
  db.close();

  // Get file size
  const stats = fs.statSync(OUTPUT_PATH);
  const fileSizeKB = (stats.size / 1024).toFixed(2);

  console.log('\n✅ Database generated successfully!');
  console.log(`   Output: ${OUTPUT_PATH}`);
  console.log(`   Size: ${fileSizeKB} KB`);
}

main();
