// Validation for the TD form and size rows. Pure — used by the screens (to
// show messages) AND again by tdService.saveTd (so nothing invalid can reach
// the database even if a screen forgets to check).
import { computeSize } from './tdCalc';
import { KIND_SEIZED, KIND_TD, MAX_COMPARTMENT_LENGTH, MAX_TREES, STD_VOL } from '../constants/tdData';

const isBlank = (v) => !v || !String(v).trim();

/**
 * Details step. `d` = { kind, applicantName, fathersName, address, markingNo,
 * compartment, isFreeGrant, freeGrantStatus, trees:[{species,class}] }.
 * Whitespace-only values count as empty. A seized-timber record has no
 * marking number and no payment status, so neither is checked for it.
 */
export function validateDetails(d) {
  const errors = {};
  if (d.kind !== KIND_TD && d.kind !== KIND_SEIZED) errors.kind = 'Choose TD or Seized timber';
  if (isBlank(d.applicantName)) errors.applicantName = 'Enter name';
  if (isBlank(d.fathersName)) errors.fathersName = "Enter father's name";
  if (isBlank(d.address)) errors.address = 'Enter address';
  if (d.kind === KIND_TD && isBlank(d.markingNo)) errors.markingNo = 'Enter Marking No.';
  if (isBlank(d.compartment)) errors.compartment = 'Enter the compartment name';
  else if (String(d.compartment).trim().length > MAX_COMPARTMENT_LENGTH) {
    errors.compartment = `Compartment name is too long (max ${MAX_COMPARTMENT_LENGTH} characters)`;
  }
  const trees = Array.isArray(d.trees) ? d.trees : [];
  if (trees.length < 1 || trees.length > MAX_TREES) {
    errors.trees = `Select between 1 and ${MAX_TREES} trees`;
  } else if (trees.some((t) => !t || !STD_VOL[t.species] || typeof STD_VOL[t.species][t.class] !== 'number')) {
    errors.trees = 'Select species and class for every tree';
  }
  const keys = Object.keys(errors);
  return { valid: keys.length === 0, errors, message: keys.length ? errors[keys[0]] : null };
}

/**
 * Sizes step. `sizes` = [{ key, species, length, width, thickness, qty }] (strings).
 * Untouched (fully blank) rows are ignored. A half-filled or invalid row is an
 * ERROR — never silently dropped. At least one complete row is required.
 * Rows for a species that is no longer among the trees are ignored.
 */
export function validateSizes(sizes, trees) {
  const speciesOrder = [];
  for (const t of trees || []) if (!speciesOrder.includes(t.species)) speciesOrder.push(t.species);

  const rows = (sizes || []).map((s) => ({ key: s.key, species: s.species, calc: computeSize(s) }));
  const relevant = rows.filter((r) => speciesOrder.includes(r.species));
  const hasErrors = relevant.some((r) => !r.calc.blank && !r.calc.complete);

  const complete = [];
  for (const sp of speciesOrder) {
    for (const r of relevant) {
      if (r.species === sp && r.calc.complete) complete.push({ species: sp, ...r.calc });
    }
  }

  let message = null;
  if (hasErrors) message = 'Some size rows are incomplete or invalid. Fix or remove them to continue.';
  else if (complete.length === 0) message = 'Add at least one size (length, width, thickness and quantity).';

  return { rows, complete, hasErrors, valid: !hasErrors && complete.length > 0, message };
}
