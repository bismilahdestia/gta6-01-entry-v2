// Combat: ramming between cars and the on-foot shove. Both are pure functions
// over the world state, so the screenshot autopilot can use them too.
// Ramming is the game's only weapon: speed is damage, and every hit raises heat.

import { PLAYER, WANTED } from './config.js';
import { dist2d } from './util.js';

/**
 * The player car hits another car. Returns the heat the hit adds, or 0 when the
 * impact was too soft to count. Damage is proportional to the closing speed.
 */
export function ramCars(playerCar, other) {
  const closing = Math.abs(playerCar.speed - other.speed);
  if (closing < 3) return 0;
  other.damage += closing * 0.5;
  playerCar.speed *= 0.7;
  return WANTED.ram;
}

/**
 * On foot, Space shoves the nearest pedestrian (or a slow car) away from the
 * player. Returns the heat added, or 0 when nothing was in reach.
 */
export function shove(player, peds, cars) {
  let hit = false;
  for (const ped of peds) {
    const d = dist2d(player.x, player.z, ped.x, ped.z);
    if (d < PLAYER.shoveRange) {
      const away = Math.atan2(ped.x - player.x, ped.z - player.z);
      ped.x += Math.sin(away) * 3;
      ped.z += Math.cos(away) * 3;
      ped.mesh.position.set(ped.x, ped.mesh.position.y, ped.z);
      // Walk on to the next waypoint instead of straight back at the player.
      ped.pointIndex = (ped.pointIndex + 1) % ped.points.length;
      hit = true;
    }
  }
  for (const car of cars) {
    if (!car.active) continue;
    const d = dist2d(player.x, player.z, car.x, car.z);
    if (d < PLAYER.shoveRange + 1.5 && Math.abs(car.speed) < 4) {
      car.damage += 6;
      hit = true;
    }
  }
  return hit ? WANTED.shove : 0;
}

/** A wrecked car (damage past 100) stops being a threat and is towed off. */
export function isWrecked(car) {
  return car.damage >= 100;
}
