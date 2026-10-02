// Launch-offer free trial (UI side). MUST match the backend's
// src/config/trial.js (TRIAL_OFFER_ENDS_AT / TRIAL_DAYS).
//
// TO EXTEND THE OFFER: change the date below (and the backend date) and
// ship an app update. 10 Oct 00:00 India time == 9 Oct 18:30 UTC, so the
// last day anyone can claim is 9 Oct. The banner's "claim before" label is
// computed from this date, so nothing else needs editing.
// The backend is the real gate - if this date is wrong the server still
// answers OFFER_CLOSED and the banner hides itself.
export const TRIAL_OFFER_ENDS_AT = new Date('2026-10-09T18:30:00Z');
export const TRIAL_DAYS = 30;

export const isTrialOfferOpen = (nowMs = Date.now()) => nowMs < TRIAL_OFFER_ENDS_AT.getTime();

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// e.g. "9 Oct" - the last day the offer can be claimed, in India time.
// Plain UTC maths on purpose (no Intl/timezone support needed on Hermes).
export function trialOfferLastDayLabel() {
  const ist = new Date(TRIAL_OFFER_ENDS_AT.getTime() - 1 + 330 * 60 * 1000);
  return `${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]}`;
}
