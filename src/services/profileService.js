import * as profileRepo from '../repositories/profileRepository';
import { validateProfile } from '../utils/validation';

function nowIso() {
  return new Date().toISOString();
}

export async function getProfile() {
  return profileRepo.getProfileRow();
}

/** True once the user has completed profile setup (has a saved name). */
export async function hasProfile() {
  const row = await getProfile();
  return !!(row && row.name && row.name.trim());
}

/**
 * Saves (creates or updates) the single-row profile. Throws a plain-language
 * validation error via err.message / err.code if required fields are missing.
 */
export async function saveProfile({ salutation, name, designation, dob, defaultFromLocation }) {
  const validation = validateProfile({ name, defaultFromLocation });
  if (!validation.valid) {
    const err = new Error(validation.message);
    err.code = 'VALIDATION';
    throw err;
  }

  const timestamp = nowIso();
  try {
    await profileRepo.upsertProfile({
      salutation: salutation || 'Mr.',
      name: name.trim(),
      designation: (designation || '').trim(),
      dob: dob || null,
      defaultFromLocation: defaultFromLocation.trim(),
      timestamp,
    });
  } catch (err) {
    const wrapped = new Error('Unable to save your profile. Please try again.');
    wrapped.code = 'SAVE_FAILED';
    throw wrapped;
  }

  return getProfile();
}
