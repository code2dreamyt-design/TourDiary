import * as SQLite from 'expo-sqlite';

const DB_NAME = 'tourdiary.db';

let dbPromise = null;

/**
 * Returns a shared, lazily-opened SQLite database connection.
 * Using a single cached promise avoids opening the DB file multiple times
 * and avoids race conditions if several screens ask for it during startup.
 */
export function getDatabase() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  }
  return dbPromise;
}
