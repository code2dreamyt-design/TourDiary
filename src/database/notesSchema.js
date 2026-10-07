import { getDatabase } from './database';

// ---------------------------------------------------------------------------
// Notes tables (simple notes, observations, reminders, observation photos and
// the diary-reminder settings).
//
// Same approach as the TD tables: created ON DEMAND with CREATE TABLE IF NOT
// EXISTS the first time the Notes feature touches the database — NOT through
// the numbered migration chain — so it works on a fresh install, on an old
// database and on every update, and never touches the diary tables.
//
// Times are stored as UTC ISO strings. Booleans are 0/1 INTEGERs.
//   notes.kind     SIMPLE | OBSERVATION | REMINDER
//   notes.pinned   pinned (simple) / marked important (observation)
//   notes.alerts   JSON array of "minutes before" for a reminder, e.g. [1440,60]
//   notes.base_at  start of a repeating reminder's series (keeps "31st" monthly
//                  reminders on the 31st); remind_at is the occurrence it is
//                  currently waiting for
//   notes.snooze_until  temporary "remind me again at"; cleared on Done / edit
// ---------------------------------------------------------------------------

let ready = null;

async function createAll(db) {
  await db.execAsync('PRAGMA foreign_keys = ON;');

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL CHECK(kind IN ('SIMPLE','OBSERVATION','REMINDER')),
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '',
      pinned INTEGER NOT NULL DEFAULT 0,
      category TEXT NOT NULL DEFAULT '',
      observed_at TEXT,
      place TEXT NOT NULL DEFAULT '',
      latitude REAL,
      longitude REAL,
      accuracy REAL,
      remind_at TEXT,
      base_at TEXT,
      repeat TEXT NOT NULL DEFAULT 'NONE',
      alerts TEXT NOT NULL DEFAULT '[]',
      follow_every INTEGER NOT NULL DEFAULT 0,
      snooze_until TEXT,
      done_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS note_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      uri TEXT NOT NULL,
      media_id TEXT,
      taken_at TEXT,
      latitude REAL,
      longitude REAL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notes_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notes_kind ON notes(kind);
    CREATE INDEX IF NOT EXISTS idx_notes_remind ON notes(kind, done_at, remind_at);
    CREATE INDEX IF NOT EXISTS idx_note_photos_note ON note_photos(note_id);
  `);
}

/**
 * Returns the shared database with the Notes tables guaranteed to exist.
 * The setup runs once per app launch; if it fails it is retried on the next call.
 */
export async function getNotesDb() {
  const db = await getDatabase();
  if (!ready) {
    ready = createAll(db).catch((e) => {
      ready = null;
      throw e;
    });
  }
  await ready;
  return db;
}
