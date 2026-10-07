// One-slot hand-off between the Notes camera screen and the observation
// editor that opened it (same idea as the diary camera's "justSavedPhoto"):
// the camera drops the finished photo here and goes back; the editor picks it
// up when it regains focus. A module variable (not navigation params) so the
// half-written observation in the editor is never rebuilt or lost.
let pending = null;

export function setPendingPhoto(photo) {
  pending = photo;
}

export function takePendingPhoto() {
  const p = pending;
  pending = null;
  return p;
}
