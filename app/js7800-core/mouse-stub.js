// Worker-safe stand-in for js7800's web/mouse.js (GPL v2 or later).
// Light guns aren't supported in the worker; the core only asks for a position.

export function enableMouseTracking() {}
export function isLeftButtonDown() {
  return false;
}
export function getLightGunScanline() {
  return 0;
}
export function getLightGunCycle() {
  return 0;
}
