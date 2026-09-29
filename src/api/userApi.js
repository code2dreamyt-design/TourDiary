// Maps 1:1 to src/routes/user.routes.js on the backend.
import { apiRequest, del, patch, post } from './client';

// The multer middleware on the backend expects the field name
// 'profilePic' (see upload.middleware.js: `.single("profilePic")`).
// localUri is a file:// (or content://) uri as returned by an image
// picker/camera — React Native's fetch/FormData accepts the
// { uri, name, type } shape directly, no need to read the file into
// memory first.
export function uploadProfilePic(localUri, mimeType = 'image/jpeg') {
  const form = new FormData();
  const name = localUri.split('/').pop() || `profile.${mimeType.split('/')[1] || 'jpg'}`;
  form.append('profilePic', { uri: localUri, name, type: mimeType });
  return apiRequest('/api/users/me/profile', { method: 'PATCH', body: form, isForm: true });
}

export const removeProfilePic = () => del('/api/users/remove/profile');

export const updateName = (name) => patch('/api/users/update/name', { name });

export const updateDesignation = ({ designation, usualTourStart, beatName, forestBlock, forestRange }) =>
  post('/api/users/designation', { designation, usualTourStart, beatName, forestBlock, forestRange });

export const updateDob = (dob) => patch('/api/users/dob', { dob });
