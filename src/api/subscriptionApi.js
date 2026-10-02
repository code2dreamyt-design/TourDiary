// Maps 1:1 to src/routes/subscription.routes.js on the backend.
import { get, post } from './client';

/** { active, entitlement } — entitlement is a signed ES256 JWT, see entitlementService.js */
export const getSubscriptionStatus = () => get('/api/subscription/status');

/** { orderId, amount, currency, keyId } — hand this straight to react-native-razorpay */
export const createCheckoutOrder = (plan) => post('/api/subscription/checkout', { plan });

/** Launch-offer free trial. Success: { granted, days, paidUntil, entitlement, title, message }.
 *  Errors (ApiError.code): EMAIL_NOT_VERIFIED | OFFER_CLOSED | ALREADY_CLAIMED */
export const claimTrial = () => post('/api/subscription/claim-trial', {});
