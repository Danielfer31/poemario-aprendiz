export function clampIndex(i, length) {
  if (length <= 0) return 0;
  return Math.min(Math.max(i, 0), length - 1);
}

/** Move one room forward (1) or back (-1); stays put at the edges. */
export function step(i, dir, length) {
  return clampIndex(i + dir, length);
}
