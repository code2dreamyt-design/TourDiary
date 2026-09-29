// Maps 1:1 to src/routes/auth.routes.js on the backend. No business logic
// here — that lives in AuthContext, which is the only caller of this file.
import { get, post } from './client';

export const signup = (name, email, password) =>
  post('/api/auth/signup', { name, email, password }, { skipAuth: true });

export const login = (email, password) => post('/api/auth/login', { email, password }, { skipAuth: true });

export const refresh = (refreshToken) => post('/api/auth/refresh', { refreshToken }, { skipAuth: true });

export const logout = (refreshToken) => post('/api/auth/logout', { refreshToken }, { skipAuth: true });

export const getMe = () => get('/api/auth/getme');

export const resendVerificationEmail = () => post('/api/auth/resend', {});

export const verifyEmail = (token) => post(`/api/auth/verify-email/${encodeURIComponent(token)}`, {}, { skipAuth: true });

export const forgetPassword = (email) => post('/api/auth/forget-password', { email }, { skipAuth: true });

export const resetPassword = (rawPassResetToken, newPassword) =>
  post(`/api/auth/reset-password/${encodeURIComponent(rawPassResetToken)}`, { newPassword }, { skipAuth: true });

export const changePassword = (currentPassword, newPassword) =>
  post('/api/auth/change-password', { currentPassword, newPassword });
