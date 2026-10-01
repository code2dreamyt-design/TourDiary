import { getDatabase } from './database';

// ---------------------------------------------------------------------------
// TD Calculator tables.
//
// These are created ON DEMAND the first time the TD feature touches the
// database (see getTdDb), using CREATE TABLE IF NOT EXISTS — NOT through the
// numbered migration chain in migrations.js. That makes them independent of
// whatever PRAGMA user_version the database is at, so they get created
// correctly on a fresh install, on an old database, and on a database that
// already ran an earlier TD build. Nothing in the diary tables is touched.
//
// Money-style rule: dimensions are whole millimetres and volumes are whole
// thousandths of a cubic metre (INTEGER, never REAL) — see utils/tdCalc.js.
// ---------------------------------------------------------------------------

let ready = null;

async function hasColumn(db, table, column) {
  const cols = await db.getAllAsync(`PRAGMA table_info(${table});`);
  return cols.some((c) => c.name === column);
}

async function createAll(db) {
  await db.execAsync('PRAGMA foreign_keys = ON;');

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS td_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL DEFAULT 'TD',
      applicant_name TEXT NOT NULL,
      fathers_name TEXT NOT NULL,
      address TEXT NOT NULL,
      marking_no TEXT NOT NULL DEFAULT '',
      range_name TEXT NOT NULL DEFAULT '',
      beat TEXT NOT NULL DEFAULT '',
      compartments TEXT NOT NULL DEFAULT '',
      is_free_grant INTEGER NOT NULL DEFAULT 0,
      free_grant_status TEXT NOT NULL DEFAULT '',
      standing_milli INTEGER NOT NULL,
      converted_milli INTEGER NOT NULL,
      total_qty INTEGER NOT NULL,
      conversion_hundredths INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS td_trees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      td_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      species TEXT NOT NULL,
      class TEXT NOT NULL,
      FOREIGN KEY(td_id) REFERENCES td_records(id)
    );

    CREATE TABLE IF NOT EXISTS td_sizes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      td_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      species TEXT NOT NULL,
      length_mm INTEGER NOT NULL,
      width_mm INTEGER NOT NULL,
      thickness_mm INTEGER NOT NULL,
      qty INTEGER NOT NULL,
      unit_milli INTEGER NOT NULL,
      total_milli INTEGER NOT NULL,
      FOREIGN KEY(td_id) REFERENCES td_records(id)
    );

    CREATE INDEX IF NOT EXISTS idx_td_records_created ON td_records(created_at);
    CREATE INDEX IF NOT EXISTS idx_td_trees_td_id ON td_trees(td_id);
    CREATE INDEX IF NOT EXISTS idx_td_sizes_td_id ON td_sizes(td_id);
  `);

  // Tables created by the first TD build don't have `kind` yet (every record
  // in them is a normal TD, which is exactly the column default).
  if (!(await hasColumn(db, 'td_records', 'kind'))) {
    await db.execAsync(`ALTER TABLE td_records ADD COLUMN kind TEXT NOT NULL DEFAULT 'TD';`);
  }
}

/**
 * Returns the shared database with the TD tables guaranteed to exist.
 * The setup runs once per app launch; if it fails it is retried on the next call.
 */
export async function getTdDb() {
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
