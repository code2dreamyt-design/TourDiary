import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { KIND_SEIZED, KIND_TD, MAX_TREES } from '../constants/tdData';
import { dimToText } from '../utils/tdCalc';

// In-progress TD (the form -> sizes -> result flow). Lives in memory only:
// NOTHING is written to the database until the user taps Save on the result
// screen, and that write goes through tdService.saveTd() — which is where the
// subscription gate is enforced. So an unsaved draft can never bypass it.
//
// Every input is kept as a STRING exactly as typed (parsing/validation is in
// utils/tdCalc.js + utils/tdValidation.js), so typing "1." or "0.0" is never
// mangled by number conversion while the user is mid-entry.

const TDDraftContext = createContext(null);

let keySeq = 0;
const nextKey = () => `sz${++keySeq}`;

const newTree = () => ({ species: 'Kail', class: 'IV' });
const blankSize = (species) => ({ key: nextKey(), species, length: '', width: '', thickness: '', qty: '' });

export function emptyDraft(kind = KIND_TD) {
  return {
    editingId: null,
    kind: kind === KIND_SEIZED ? KIND_SEIZED : KIND_TD,
    applicantName: '',
    fathersName: '',
    address: '',
    markingNo: '',
    isFreeGrant: false,
    freeGrantStatus: '',
    compartment: '',
    trees: [newTree()],
    sizes: [],
  };
}

function draftFromRecord(rec) {
  return {
    editingId: rec.id,
    kind: rec.kind,
    applicantName: rec.applicantName,
    fathersName: rec.fathersName,
    address: rec.address,
    markingNo: rec.markingNo,
    isFreeGrant: rec.isFreeGrant,
    freeGrantStatus: rec.isFreeGrant && rec.freeGrantStatus !== 'Free Grant' ? rec.freeGrantStatus : '',
    compartment: rec.compartment,
    trees: rec.trees.map((t) => ({ species: t.species, class: t.class })),
    sizes: rec.sizes.map((s) => ({
      key: nextKey(),
      species: s.species,
      length: dimToText(s.lengthMilli),
      width: dimToText(s.widthMilli),
      thickness: dimToText(s.thicknessMilli),
      qty: String(s.qty),
    })),
  };
}

/**
 * After the details step: drop size rows whose species is no longer among the
 * trees (so removed species can't linger and be counted), and make sure every
 * species that IS present has at least one row to type into.
 */
export function syncSizesToTrees(draft) {
  const species = [];
  for (const t of draft.trees) if (!species.includes(t.species)) species.push(t.species);
  const kept = draft.sizes.filter((s) => species.includes(s.species));
  const next = [];
  for (const sp of species) {
    const rows = kept.filter((s) => s.species === sp);
    if (rows.length === 0) next.push(blankSize(sp));
    else next.push(...rows);
  }
  return { ...draft, sizes: next };
}

export function TDDraftProvider({ children }) {
  const [draft, setDraft] = useState(emptyDraft);

  const startNew = useCallback((kind) => setDraft(emptyDraft(kind)), []);
  const startEdit = useCallback((record) => setDraft(draftFromRecord(record)), []);
  const clear = useCallback(() => setDraft(emptyDraft()), []);

  const setField = useCallback((name, value) => setDraft((d) => ({ ...d, [name]: value })), []);

  const setTreeCount = useCallback(
    (count) =>
      setDraft((d) => {
        const n = Math.max(1, Math.min(MAX_TREES, count));
        const trees = d.trees.slice(0, n);
        while (trees.length < n) trees.push(newTree());
        return { ...d, trees };
      }),
    []
  );

  const setTree = useCallback(
    (index, patch) =>
      setDraft((d) => ({ ...d, trees: d.trees.map((t, i) => (i === index ? { ...t, ...patch } : t)) })),
    []
  );

  const syncSizes = useCallback(() => setDraft((d) => syncSizesToTrees(d)), []);

  const setSizeField = useCallback(
    (key, field, value) =>
      setDraft((d) => ({ ...d, sizes: d.sizes.map((s) => (s.key === key ? { ...s, [field]: value } : s)) })),
    []
  );

  const addSize = useCallback(
    (species) => setDraft((d) => ({ ...d, sizes: [...d.sizes, blankSize(species)] })),
    []
  );

  const removeSize = useCallback(
    (key) => setDraft((d) => ({ ...d, sizes: d.sizes.filter((s) => s.key !== key) })),
    []
  );

  const value = useMemo(
    () => ({
      draft,
      startNew,
      startEdit,
      clear,
      setField,
      setTreeCount,
      setTree,
      syncSizes,
      setSizeField,
      addSize,
      removeSize,
    }),
    [draft, startNew, startEdit, clear, setField, setTreeCount, setTree, syncSizes, setSizeField, addSize, removeSize]
  );

  return <TDDraftContext.Provider value={value}>{children}</TDDraftContext.Provider>;
}

export function useTDDraft() {
  const ctx = useContext(TDDraftContext);
  if (!ctx) throw new Error('useTDDraft must be used within a TDDraftProvider');
  return ctx;
}
