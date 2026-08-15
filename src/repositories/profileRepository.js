import { getDatabase } from '../database/database';

// Local Repository (SQLite), mirroring the pattern in diaryRepository.js.
// The profile is a single row (id = 1) — there is only ever one user per
// device for this app, so we upsert that one row rather than modeling a
// full table of users.

export async function getProfileRow() {
  const db = await getDatabase();
  return db.getFirstAsync('SELECT * FROM profile WHERE id = 1;');
}

export async function upsertProfile({
  salutation,
  name,
  designation,
  dob,
  defaultFromLocation,
  timestamp,
}) {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO profile (id, salutation, name, designation, dob, default_from_location, created_at, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       salutation = excluded.salutation,
       name = excluded.name,
       designation = excluded.designation,
       dob = excluded.dob,
       default_from_location = excluded.default_from_location,
       updated_at = excluded.updated_at;`,
    [salutation, name, designation, dob, defaultFromLocation, timestamp, timestamp]
  );
}
