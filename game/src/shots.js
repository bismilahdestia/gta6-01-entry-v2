// The screenshot scenes behind ?shot=chase|onfoot|drive|mission (with &seed=N).
// Each one plays the real rules forward from a fresh world for a fixed number
// of steps, steered by a simple autopilot, so the frame is what a short game
// really looks like and the same seed always gives the same frame.
//
// The mission shot and the HUD share one objective: the shot sets the story to
// the delivery job, and the beacon the HUD draws is the Marina itself — the
// text and the beacon can never disagree.

import { STEP } from './config.js';
import { SCREEN_PLAY } from './hud.js';
import { clamp, dist2d, wrapAngle } from './util.js';

const CHASE_SECONDS = 6;
const ONFOOT_SECONDS = 5;
const DRIVE_SECONDS = 6;
const MISSION_SECONDS = 6;

/** Steer a car toward a point: returns { steer, throttle, brake }. */
function driveToward(car, tx, tz, throttle = 1) {
  const want = Math.atan2(tx - car.x, tz - car.z);
  const turn = wrapAngle(want - car.heading);
  return {
    steer: clamp(turn * 1.6, -1, 1),
    throttle: Math.abs(turn) > 1.4 ? 0.3 : throttle,
    brake: 0,
  };
}

/** Follow a list of waypoints in order, one input at a time. */
function followWaypoints(car, points, state) {
  const goal = points[state.point];
  if (!goal) return { steer: 0, throttle: 0, brake: 1 };
  if (dist2d(car.x, car.z, goal.x, goal.z) < 9) {
    state.point += 1;
    return followWaypoints(car, points, state);
  }
  return driveToward(car, goal.x, goal.z);
}

export function stageShot(name, world) {
  world.reset();

  if (name === 'onfoot') {
    // On foot on the avenue sidewalk, walking north with the road, the
    // traffic and the city ahead. The current job is still "steal the
    // teal car".
    world.player.onFoot = true;
    world.player.x = 8;
    world.player.z = -100;
    world.player.heading = 0;
    world.player.speed = 0;
    for (let i = 0; i < ONFOOT_SECONDS / STEP; i += 1) {
      world.step(STEP, { steer: 0, throttle: 1, brake: 0, steal: false, shove: false });
    }
    return { screen: SCREEN_PLAY };
  }

  if (name === 'drive') {
    // Driving fast down the avenue at x = 0, overtaking slower traffic.
    world.story.index = 1;
    world.putPlayerInCar(world.ownCar, 0, -200, 0, 22);
    for (let i = 0; i < DRIVE_SECONDS / STEP; i += 1) {
      let desiredX = 0;
      for (const car of world.traffic) {
        const dz = car.z - world.playerCar.z;
        if (dz > 0 && dz < 18 && Math.abs(car.x - world.playerCar.x) < 3.5) desiredX = 5.5;
      }
      const steer = clamp((desiredX - world.playerCar.x) * 0.25 + wrapAngle(0 - world.playerCar.heading) * 1.2, -1, 1);
      world.step(STEP, { steer, throttle: 1, brake: 0, steal: false, shove: false });
    }
    return { screen: SCREEN_PLAY };
  }

  if (name === 'mission') {
    // The delivery job: drive from the crossroads at (60, 60) toward the
    // Marina — the frame catches the car mid-route, job still open, so the
    // HUD objective and the beacon still name the Marina.
    // The route stays on the roads — east along z = 60, then north along
    // x = 210 — and the HUD objective is the same Marina the beacon marks.
    world.story.index = 1;
    world.wanted.heat = 10;
    world.wanted.stars = 1;
    world.putPlayerInCar(world.ownCar, 60, 60, Math.PI / 2, 18);
    const route = { point: 0 };
    const points = [{ x: 210, z: 60 }, { x: 210, z: 210 }];
    for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) {
      const input = followWaypoints(world.playerCar, points, route);
      world.step(STEP, { ...input, steal: false, shove: false });
    }
    return { screen: SCREEN_PLAY };
  }

  // Default: the chase cover. The teal target drives ahead of the player on
  // the same avenue; the player closes to about 25 m and holds there, so the
  // frame reads as a pursuit. The objective line names the chase, and the
  // beacon follows the target car itself.
  world.putPlayerInCar(world.ownCar, 0, -60, 0, 20);
  world.targetCar.x = 0;
  world.targetCar.z = -35;
  world.targetCar.heading = 0;
  world.targetCar.speed = 22;
  world.targetCar.cruise = 22;
  world.objectiveOverride = {
    text: 'Chase down the teal car',
    getTarget: () => ({ x: world.targetCar.x, z: world.targetCar.z }),
  };
  for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) {
    // The target cruises its road; the player holds a ~25 m gap behind it.
    world.targetCar.z += world.targetCar.speed * STEP;
    const gap = world.targetCar.z - world.playerCar.z;
    const throttle = gap > 28 ? 1 : gap < 20 ? 0.25 : 0.55;
    const input = driveToward(world.playerCar, world.targetCar.x, world.targetCar.z, throttle);
    world.step(STEP, { ...input, steal: false, shove: false });
  }
  return { screen: SCREEN_PLAY };
}
