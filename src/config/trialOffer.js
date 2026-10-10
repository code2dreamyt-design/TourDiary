// Launch-offer free trial (UI side).
//
// The offer end date is managed from the admin panel (Admin -> Offer) and served
// by GET /api/offer. The app fetches it (see refreshTrialOffer in
// services/trialOfferService.js) and remembers the last value, so extending or
// closing the offer needs NO app update.
//
// TRIAL_OFFER_ENDS_AT below is only the built-in DEFAULT: it is used until the
// first successful fetch on a fresh install, or if the server is unreachable and
// nothing is remembered. The backend is the real gate - if the app's date is
// ever wrong, the server still answers OFFER_CLOSED and the banner hides itself.
// 21 Oct 00:00 India time == 20 Oct 18:30 UTC (last day to claim: 20 Oct).
export const TRIAL_OFFER_ENDS_AT = new Date('2026-10-20T18:30:00Z');
export const TRIAL_DAYS = 30;

let endsAtMs = TRIAL_OFFER_ENDS_AT.getTime();

/** Current end moment (server value once fetched, otherwise the default above). */
export const getTrialOfferEndsAt = () => new Date(endsAtMs);

/** Called by refreshTrialOffer with the value from the server / local memory. */
export function setTrialOfferEndsAt(ms) {
  if (Number.isFinite(ms) && ms > 0) endsAtMs = ms;
}

export const isTrialOfferOpen = (nowMs = Date.now()) => nowMs < endsAtMs;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// e.g. "20 Oct" - the last day the offer can be claimed, in India time.
// Plain UTC maths on purpose (no Intl/timezone support needed on Hermes).
export function trialOfferLastDayLabel() {
  const ist = new Date(endsAtMs - 1 + 330 * 60 * 1000);
  return `${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]}`;
}
