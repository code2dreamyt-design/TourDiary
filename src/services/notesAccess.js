import { isWriteAllowed } from './entitlementService';

// The Notes subscription gate — the same signed, offline-verified entitlement
// check the diary and the TD calculator use (entitlementService.isWriteAllowed).
// Reading notes is never gated; creating, editing, deleting, completing and
// changing reminder settings all are.

const WRITE_LOCK_MESSAGES = {
  CLOCK_ROLLBACK: 'Your device clock looks wrong. Please reconnect to the internet to continue.',
  NO_ENTITLEMENT: 'An active subscription is required to create, edit or delete notes and reminders.',
  EXPIRED: 'Your subscription has expired. Renew to continue creating, editing or deleting notes and reminders.',
};

/** Non-throwing check for screens. Returns { allowed, reason, message }. */
export async function checkWriteAccess() {
  const { allowed, reason } = await isWriteAllowed();
  if (allowed) return { allowed: true, reason: null, message: null };
  return { allowed: false, reason, message: WRITE_LOCK_MESSAGES[reason] || 'This action is currently locked.' };
}

/** Throws WRITE_LOCKED unless writes are allowed right now. Every mutating service call starts with this. */
export async function assertWriteAllowed() {
  const access = await checkWriteAccess();
  if (!access.allowed) {
    const err = new Error(access.message);
    err.code = 'WRITE_LOCKED';
    err.reason = access.reason;
    throw err;
  }
}
