// Small math helpers and the seeded random generator (mulberry32).
// The same seed gives the same city, the same traffic and the same screenshots,
// which is what makes the game deterministic and its scenes repeatable.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Shortest signed turn from angle `from` to angle `to`, in radians. */
export function wrapAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

export function dist2d(ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  return Math.sqrt(dx * dx + dz * dz);
}

export function angleTo(ax, az, bx, bz) {
  return Math.atan2(bx - ax, bz - az);
}

export function randRange(rng, min, max) {
  return min + rng() * (max - min);
}

export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

export function randPick(rng, list) {
  return list[Math.floor(rng() * list.length) % list.length];
}

/** A point on the road grid: snap x or z to the nearest road axis. */
export function nearestAxis(value, every) {
  return Math.round(value / every) * every;
}
