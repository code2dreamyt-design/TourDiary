// Reference data for the TD (Timber Distribution) Calculator.
// Values are carried over UNCHANGED from the web version's DataForm.jsx.
//
// NOTE FOR REVIEW: for every species the "ID" and "IE" (Over 100) volumes are
// identical in the web version's table, and they are kept identical here so
// results match the web app exactly. Please confirm against the official
// volume table — if they should differ, this is the only place to change.
export const STD_VOL = {
  Deodar: { IV: 0.3, III: 0.6, IIA: 1.3, IIB: 2.1, IA: 3.66, IB: 5.5, IC: 7, ID: 8.25, IE: 8.25 },
  Kail: { IV: 0.35, III: 0.7, IIA: 1.6, IIB: 2.42, IA: 3.63, IB: 5.1, IC: 6.65, ID: 9.75, IE: 9.75 },
  Rai: { IV: 0.32, III: 0.7, IIA: 1.58, IIB: 3.02, IA: 5.5, IB: 7.3, IC: 9.35, ID: 10.92, IE: 10.92 },
  Tosh: { IV: 0.3, III: 0.72, IIA: 1.6, IIB: 2.85, IA: 4.92, IB: 7.3, IC: 10.2, ID: 12.85, IE: 12.85 },
  Chil: { IV: 0.3, III: 0.85, IIA: 1.6, IIB: 2.95, IA: 4.45, IB: 6.02, IC: 7.5, ID: 9.65, IE: 9.65 },
};

// Same order as the web version's species dropdown.
export const SPECIES_LIST = ['Kail', 'Deodar', 'Rai', 'Tosh', 'Chil'];

// `value` is what gets stored/printed; `label` is what the form shows
// (the web form labels IE as "Over 100").
export const CLASS_OPTIONS = [
  { value: 'IV', label: 'IV' },
  { value: 'III', label: 'III' },
  { value: 'IIA', label: 'IIA' },
  { value: 'IIB', label: 'IIB' },
  { value: 'IA', label: 'IA' },
  { value: 'IB', label: 'IB' },
  { value: 'IC', label: 'IC' },
  { value: 'ID', label: 'ID' },
  { value: 'IE', label: 'Over 100' },
];

// The two kinds of measurement. Same calculation for both; they differ only in
// the details collected and in how they are labelled / exported:
//  - TD     : timber legally taken from the forest (has a marking number and a
//             paid / free-grant status)
//  - SEIZED : timber seized by the department (no marking number, no status)
export const KIND_TD = 'TD';
export const KIND_SEIZED = 'SEIZED';
export const KIND_OPTIONS = [
  { value: KIND_TD, label: 'TD' },
  { value: KIND_SEIZED, label: 'Seized timber' },
];
export const KIND_TITLES = {
  [KIND_TD]: 'Timber Distribution Record',
  [KIND_SEIZED]: 'Seized Timber Record',
};

// Range, block and beat are NOT asked for here: they come from the user's
// profile whenever a TD is shown or exported. The compartment is free text,
// because every beat has its own compartments.
export const MAX_COMPARTMENT_LENGTH = 100;

export const MAX_TREES = 4;

// Conversion limit: converted volume may be at most this % of standing volume.
export const LIMIT_PERCENT = 65;

// Accent per tree slot (tree 1..4), same hues as the web version's chips.
export const TREE_COLORS = [
  { dot: '#3F8FDB', bg: '#12263B', text: '#B5D4F4', border: '#2A6FB0' },
  { dot: '#2FB38F', bg: '#123528', text: '#5DCAA5', border: '#1F8A6D' },
  { dot: '#D39A3A', bg: '#33240B', text: '#FAC775', border: '#9A6A1A' },
  { dot: '#E5714A', bg: '#33170C', text: '#F0997B', border: '#B04A28' },
];
