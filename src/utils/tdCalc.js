// ---------------------------------------------------------------------------
// TD calculation core — PURE functions, no React / storage / device deps.
//
// Why integers: every volume is carried as whole THOUSANDTHS of a cubic metre
// ("milli" units) and every dimension as whole millimetres. All arithmetic is
// done on integers that stay below 2^53, so there is no floating-point
// drift, and rounding is an explicit, testable "round half up" at exactly the
// precision the permits use: 3 decimal places for volumes, 2 for percentages.
//
// Rounding rule (kept from the web version): the size's volume is computed
// from the EXACT product length × width × thickness, and only then rounded —
// so the row total = round(L×W×T×Qty), NOT round(L×W×T) × Qty. Example:
// 1.8 × 0.15 × 0.05 × 10 pcs = 0.135 m³ (not 0.014 × 10 = 0.140).
// ---------------------------------------------------------------------------
import { STD_VOL, LIMIT_PERCENT } from '../constants/tdData';

const DIM_SCALE = 1000; // 1 m = 1000 mm; input allows up to 3 decimals
export const MAX_DIM_MILLI = 99999; // 99.999 m
export const MAX_QTY = 9999;
const MILLI_DIV = 1000000; // (mm × mm × mm) → milli-m³ needs ÷ 1e6

// ---- parsing --------------------------------------------------------------

function normalize(text) {
  return String(text ?? '').trim().replace(',', '.');
}

/**
 * Parses a dimension typed in metres ("1.8", "0,15", ".5") into whole
 * millimetres. Returns { empty: true } for a blank field,
 * { error } for an invalid one, or { value } (a positive integer).
 */
export function parseDimension(text) {
  const s = normalize(text);
  if (s === '') return { empty: true };
  if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return { error: 'Enter a valid number' };
  const [intPart = '', fracPart = ''] = s.split('.');
  if (fracPart.length > 3) return { error: 'Max 3 decimal places' };
  if (intPart.length > 2 && parseInt(intPart, 10) > 99) return { error: 'Too large (max 99.999)' };
  const value = parseInt(intPart || '0', 10) * DIM_SCALE + parseInt((fracPart + '000').slice(0, 3), 10);
  if (value <= 0) return { error: 'Must be more than 0' };
  if (value > MAX_DIM_MILLI) return { error: 'Too large (max 99.999)' };
  return { value };
}

/** Parses a whole-number piece count. Same return shape as parseDimension. */
export function parseQty(text) {
  const s = String(text ?? '').trim();
  if (s === '') return { empty: true };
  if (!/^\d+$/.test(s)) return { error: 'Whole number only' };
  const value = parseInt(s, 10);
  if (value <= 0) return { error: 'Must be at least 1' };
  if (value > MAX_QTY) return { error: `Too large (max ${MAX_QTY})` };
  return { value };
}

// ---- size (one L × W × T × Qty row) ----------------------------------------

/**
 * Evaluates one size row typed as strings.
 *  - blank: every field empty (an untouched row — ignored, not an error)
 *  - complete: all four fields valid and volume > 0
 *  - errors: per-field messages for anything filled-in but wrong/missing
 *  - lengthMilli/widthMilli/thicknessMilli (mm), qty, unitMilli, totalMilli
 */
export function computeSize({ length, width, thickness, qty }) {
  const l = parseDimension(length);
  const w = parseDimension(width);
  const t = parseDimension(thickness);
  const q = parseQty(qty);

  if (l.empty && w.empty && t.empty && q.empty) {
    return { blank: true, complete: false, errors: {} };
  }

  const errors = {};
  const check = (key, parsed) => {
    if (parsed.empty) errors[key] = 'Required';
    else if (parsed.error) errors[key] = parsed.error;
  };
  check('length', l);
  check('width', w);
  check('thickness', t);
  check('qty', q);
  if (Object.keys(errors).length > 0) return { blank: false, complete: false, errors };

  const product = l.value * w.value * t.value; // mm³ ≤ 1e15, exact
  const unitMilli = Math.floor((2 * product + MILLI_DIV) / (2 * MILLI_DIV));
  const whole = Math.floor(product / MILLI_DIV);
  const rest = product % MILLI_DIV;
  const totalMilli = whole * q.value + Math.floor((2 * rest * q.value + MILLI_DIV) / (2 * MILLI_DIV));

  if (totalMilli <= 0) {
    return {
      blank: false,
      complete: false,
      errors: { total: 'Volume is too small — it rounds to 0.000 m³' },
    };
  }

  return {
    blank: false,
    complete: true,
    errors: {},
    lengthMilli: l.value,
    widthMilli: w.value,
    thicknessMilli: t.value,
    qty: q.value,
    unitMilli,
    totalMilli,
  };
}

// ---- record-level totals ----------------------------------------------------

/** Standing volume of one tree in milli-m³ (throws on an unknown species/class). */
export function treeStandingMilli(species, cls) {
  const v = STD_VOL[species] && STD_VOL[species][cls];
  if (typeof v !== 'number') throw new Error(`Unknown species/class: ${species} / ${cls}`);
  return Math.round(v * 1000);
}

export function standingMilliOf(trees) {
  return trees.reduce((sum, t) => sum + treeStandingMilli(t.species, t.class), 0);
}

/** Conversion % in hundredths of a percent (65.00% → 6500), rounded half up. */
export function conversionHundredths(convertedMilli, standingMilli) {
  if (!standingMilli || standingMilli <= 0) return 0;
  return Math.floor((2 * convertedMilli * 10000 + standingMilli) / (2 * standingMilli));
}

/** True when converted ≤ LIMIT_PERCENT of standing — exactly 65% is WITHIN the limit. */
export function isWithinLimit(convertedMilli, standingMilli) {
  return convertedMilli * 100 <= LIMIT_PERCENT * standingMilli;
}

/**
 * Totals for a record from its trees and its COMPLETE sizes (computeSize
 * results). Converted volume is the sum of the rounded row totals, so the
 * printed rows always add up to the printed total.
 */
export function summarize(trees, completeSizes) {
  const standingMilli = standingMilliOf(trees);
  const convertedMilli = completeSizes.reduce((s, x) => s + x.totalMilli, 0);
  const totalQty = completeSizes.reduce((s, x) => s + x.qty, 0);
  return {
    standingMilli,
    convertedMilli,
    totalQty,
    conversionHundredths: conversionHundredths(convertedMilli, standingMilli),
    withinLimit: isWithinLimit(convertedMilli, standingMilli),
  };
}

// ---- formatting ---------------------------------------------------------------

/** 3660 → "3.660" — pure integer formatting, no toFixed float surprises. */
export function formatMilli(n) {
  const v = Math.round(Number(n) || 0);
  const sign = v < 0 ? '-' : '';
  const a = Math.abs(v);
  return `${sign}${Math.floor(a / 1000)}.${String(a % 1000).padStart(3, '0')}`;
}

/** 6500 → "65.00" */
export function formatHundredths(n) {
  const v = Math.round(Number(n) || 0);
  return `${Math.floor(v / 100)}.${String(v % 100).padStart(2, '0')}`;
}

/** Whole millimetres back to an editable metres string: 1800 → "1.8", 150 → "0.15". */
export function dimToText(milli) {
  const v = Math.round(Number(milli) || 0);
  const whole = Math.floor(v / 1000);
  const frac = String(v % 1000).padStart(3, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : String(whole);
}
