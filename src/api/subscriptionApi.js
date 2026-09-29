// Maps 1:1 to src/routes/subscription.routes.js on the backend.
import { get, post } from './client';

/** { active, entitlement } — entitlement is a signed ES256 JWT, see entitlementService.js */
export const getSubscriptionStatus = () => get('/api/subscription/status');

/** { orderId, amount, currency, keyId } — hand this straight to react-native-razorpay */
export const createCheckoutOrder = (plan) => post('/api/subscription/checkout', { plan });
