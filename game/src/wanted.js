// Wanted level: heat 0..100, shown as 0..4 stars. Heat rises with crimes
// (stealing, ramming, shoving) and cools off when the player lies low.
// Stars are thresholds on heat, and the police answer to the stars.

import { WANTED } from './config.js';

/** The most stars the HUD ever shows. */
export const MAX_STARS = 4;

export function createWanted() {
  return { heat: 0, stars: 0 };
}

export function starsForHeat(heat) {
  let stars = 0;
  for (let i = 0; i < WANTED.starAt.length; i += 1) {
    if (heat >= WANTED.starAt[i]) stars = i + 1;
  }
  return Math.min(stars, MAX_STARS);
}

export function addHeat(wanted, amount) {
  wanted.heat = Math.min(100, Math.max(0, wanted.heat + amount));
  wanted.stars = starsForHeat(wanted.heat);
}

/** Cool down over time; cooling stops while the player is committing crimes. */
export function updateWanted(wanted, dt, committingCrime) {
  if (committingCrime) return;
  if (wanted.heat <= 0) return;
  wanted.heat = Math.max(0, wanted.heat - WANTED.coolPerSecond * dt);
  wanted.stars = starsForHeat(wanted.heat);
}

/** A star row for the HUD, e.g. ★★☆☆ at 2 stars. */
export function starsText(stars) {
  return '★'.repeat(stars) + '☆'.repeat(MAX_STARS - stars);
}
