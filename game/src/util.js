// Porto Alba — util.js
// Small deterministic helpers: a seeded RNG so screenshots and staging are
// reproducible, plus clamp/lerp and tiny 2D vector math. No game logic here.

/** Mulberry32 — a tiny fast seeded PRNG. Same seed, same city, every run. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Create a fresh RNG from an integer seed. */
export function makeRng(seed) {
  return mulberry32(seed);
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Random float in [min, max) from a seeded RNG function. */
export function randRange(rng, min, max) {
  return min + rng() * (max - min);
}

/** Random integer in [min, max] from a seeded RNG function. */
export function randInt(rng, min, max) {
  return Math.floor(randRange(rng, min, max + 1));
}

/** Pick one element of an array using a seeded RNG function. */
export function pick(rng, array) {
  return array[Math.floor(rng() * array.length)];
}

/** 2D distance on the XZ plane. */
export function dist2D(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Squared 2D distance — cheaper when only a comparison is needed. */
export function dist2DSq(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

/** Shortest signed angle difference, wrapped to [-PI, PI]. */
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Ease an angle toward a target at a capped turn rate. */
export function turnToward(current, target, maxStep) {
  const d = angleDiff(target, current);
  return current + clamp(d, -maxStep, maxStep);
}

/** Format a speed (units/s) as a HUD km/h readout. */
export function speedKmh(unitsPerSec) {
  return Math.round(Math.abs(unitsPerSec) * 3.2);
}
