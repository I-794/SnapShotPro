// v23 — Haptics. Tiny guarded wrapper over the Vibration API.
//
// navigator.vibrate exists on Android Chrome but not iOS Safari/desktop, so
// every call is a silent no-op where unsupported. Used by the Mobile Studio
// bottom sheet to confirm detent snaps, tab switches, and tool swipes.

export function vibrate(pattern = 8) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
}

export const tap = () => vibrate(8);     // light confirm (tap a control)
export const snap = () => vibrate(12);   // sheet settles on a detent
export const tab = () => vibrate([6]);   // switch tool group
