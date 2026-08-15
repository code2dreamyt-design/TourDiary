// Validates a diary entry draft before it can be saved via "Done".
// Returns plain-language messages only — never raw technical/DB errors.
export function validateEntry({ fromLocation, toLocation, remarks }) {
  if (!fromLocation || !fromLocation.trim()) {
    return { valid: false, message: 'Please enter the From location.' };
  }
  if (!toLocation || !toLocation.trim()) {
    return { valid: false, message: 'Please enter the To location.' };
  }
  if (!remarks || !remarks.trim()) {
    return { valid: false, message: 'Please enter the Remarks.' };
  }
  return { valid: true, message: null };
}

// Validates the profile setup/edit form before it can be saved.
// Name and usual start location are required (the latter is what actually
// gets used to pre-fill each new diary entry's "From" field); designation
// and date of birth are informational and stay optional.
export function validateProfile({ name, defaultFromLocation }) {
  if (!name || !name.trim()) {
    return { valid: false, message: 'Please enter your name.' };
  }
  if (!defaultFromLocation || !defaultFromLocation.trim()) {
    return { valid: false, message: 'Please enter the place you usually start your tour from.' };
  }
  return { valid: true, message: null };
}
