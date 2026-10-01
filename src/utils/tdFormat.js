// Small pure helpers shared by the TD screens and the Word export builders.
import { toLocalDateString, formatDisplayDate } from './dateUtils';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** ISO timestamp → local calendar day 'YYYY-MM-DD' (device timezone, same rule as dateUtils). */
export function isoToLocalDateString(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return toLocalDateString(d);
}

/** "30 Sep 2026" */
export function formatIsoDate(iso) {
  const s = isoToLocalDateString(iso);
  return s ? formatDisplayDate(s) : '';
}

/** "30 Sep 2026, 3:45 PM" — built by hand so it never depends on Intl support. */
export function formatIsoDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}, ${h}:${mm} ${ampm}`;
}

/** [{species}, ...] → [{ species, count }] in first-seen order (Kail, Kail, Rai → Kail×2, Rai×1). */
export function groupTreesBySpecies(trees) {
  const order = [];
  const counts = {};
  for (const t of trees || []) {
    if (!(t.species in counts)) {
      counts[t.species] = 0;
      order.push(t.species);
    }
    counts[t.species] += 1;
  }
  return order.map((species) => ({ species, count: counts[species] }));
}

/** "Deodar (IA), Kail (III)" — a real joined string, not an array coerced to text. */
export function speciesSummary(trees) {
  return (trees || []).map((t) => `${t.species} (${t.class})`).join(', ');
}

/** "Paid", "Free Grant", or "Free Grant — Order No. 123". Seized timber has no status (empty string). */
export function statusText(record) {
  if (record.kind === 'SEIZED') return '';
  if (!record.isFreeGrant) return 'Paid';
  const detail = (record.freeGrantStatus || '').trim();
  return !detail || detail === 'Free Grant' ? 'Free Grant' : `Free Grant — ${detail}`;
}

/** Safe file-name fragment: letters/digits/_/- only, so no name can break the path. */
export function safeFileName(text, fallback = 'TD') {
  const cleaned = String(text || '')
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return cleaned || fallback;
}

/** Case-insensitive match of a search string against a record's searchable fields (range/beat are not stored per record). */
export function recordMatchesSearch(record, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  return [record.applicantName, record.fathersName, record.address, record.compartment, record.markingNo]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(q));
}

/**
 * Parses a user-typed DD/MM/YYYY (or DD-MM-YYYY) date into 'YYYY-MM-DD'.
 * Returns null unless it's a real calendar date (rejects 31/02/2026 etc.).
 */
export function parseUserDate(text) {
  const m = String(text || '').trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  const probe = new Date(year, month - 1, day);
  if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) return null;
  return toLocalDateString(probe);
}

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' for showing inside the date inputs. */
export function toUserDate(dateString) {
  const [y, m, d] = String(dateString).split('-');
  return `${d}/${m}/${y}`;
}
