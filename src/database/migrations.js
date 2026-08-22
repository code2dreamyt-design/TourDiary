import { getDatabase } from './database';

// Bump this and add a new migrateToVN() step whenever the schema changes.
const SCHEMA_VERSION = 3;

/**
 * Creates tables if they don't exist and applies any pending migrations,
 * tracked via SQLite's built-in PRAGMA user_version. Safe to call every
 * app launch — it's a no-op once the DB is already at SCHEMA_VERSION.
 */
export async function runMigrations() {
  const db = await getDatabase();

  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const versionRow = await db.getFirstAsync('PRAGMA user_version;');
  const currentVersion = versionRow ? versionRow.user_version : 0;

  if (currentVersion < 1) {
    await migrateToV1(db);
  }

  if (currentVersion < 2) {
    await migrateToV2(db);
  }

  if (currentVersion < 3) {
    await migrateToV3(db);
  }
}

async function migrateToV1(db) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS diaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(month, year)
    );

    CREATE TABLE IF NOT EXISTS diary_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      diary_id INTEGER NOT NULL,
      serial_number INTEGER NOT NULL,
      date TEXT NOT NULL,
      from_location TEXT,
      to_location TEXT,
      remarks TEXT,
      status TEXT NOT NULL CHECK(status IN ('EMPTY','COMPLETED')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(diary_id) REFERENCES diaries(id)
    );

    CREATE INDEX IF NOT EXISTS idx_diary_entries_diary_id ON diary_entries(diary_id);
    CREATE INDEX IF NOT EXISTS idx_diary_entries_date ON diary_entries(date);

    PRAGMA user_version = 1;
  `);
}

// Adds the single-row "profile" table: the user's name/designation/DOB and
// their usual tour start location, used to (a) title the exported Word
// document and (b) pre-fill each new diary entry's "From" field.
async function migrateToV2(db) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      salutation TEXT NOT NULL DEFAULT 'Mr.',
      name TEXT NOT NULL DEFAULT '',
      designation TEXT NOT NULL DEFAULT '',
      dob TEXT,
      default_from_location TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    PRAGMA user_version = 2;
  `);
}

// Adds photo_path: the on-device path to a single GPS-stamped photo attached
// to an entry (nullable — most entries have no photo). One photo per entry
// max; there's no separate photos table because the relationship is that
// simple. ALTER TABLE ADD COLUMN is safe here because this only ever runs
// once per device (guarded by the user_version check above).
async function migrateToV3(db) {
  await db.execAsync(`
    ALTER TABLE diary_entries ADD COLUMN photo_path TEXT;

    PRAGMA user_version = 3;
  `);
}
