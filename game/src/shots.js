// Porto Alba — shots.js
// Screenshot staging for the four shots (seed 91). Each shot arranges the
// world into a readable tableau — chase, on foot, driving, mission — then
// raises window.__shotReady. The world is frozen in shot mode, so the frame
// the camera takes is exactly the frame staged here.

import { CONFIG } from './config.js';
import { setWanted } from './wanted.js';
import { setMission } from './story.js';
import { placePed } from './people.js';
import { updateHud, showBanner } from './hud.js';

/** Reposition existing traffic cars to exact staging spots (frozen tableau). */
export function placeTraffic(G, spots) {
  spots.forEach((s, i) => {
    const car = G.cars.traffic[i];
    if (!car) return;
    car.mesh.position.set(s.x, 0, s.z);
    car.mesh.rotation.y = s.heading ?? 0;
    car.heading = s.heading ?? 0;
    car.cruise = 0;
    car.speed = 0;
    car.active = true;
    car.mesh.visible = true;
  });
}

/** Drop pedestrians on both pavements at exact staging spots. */
export function sidewalkPeds(G, spots) {
  for (const s of spots) placePed(G, s.x, s.z, s.heading ?? 0);
}

/** Put Rook in his teal car at a spot, facing a heading, at a HUD speed. */
function putPlayerInCar(G, x, z, heading, speed) {
  const car = G.cars.playerCar;
  car.mesh.position.set(x, 0, z);
  car.mesh.rotation.y = heading;
  car.heading = heading;
  car.speed = speed;
  G.player.onFoot = false;
  G.player.car = car;
  G.player.pos.set(x, 0, z);
  G.player.heading = heading;
  G.player.speed = speed;
  G.player.mesh.visible = false;
}

/** Put Rook on foot at a spot, facing a heading. */
function putPlayerOnFoot(G, x, z, heading) {
  G.player.onFoot = true;
  G.player.car = null;
  G.player.pos.set(x, 0, z);
  G.player.heading = heading;
  G.player.speed = 0;
  G.player.mesh.visible = true;
  G.player.mesh.position.set(x, 0, z);
  G.player.mesh.rotation.y = heading;
}

/** Move a parked car to an exact kerb spot (used for the red steal target). */
function placeParked(G, index, x, z, heading) {
  const car = G.cars.parked[index];
  if (!car) return;
  car.mesh.position.set(x, 0, z);
  car.mesh.rotation.y = heading;
  car.heading = heading;
}

/** Hide the start screen and mark the game started for a staged shot. */
function beginShot(G) {
  G.started = true;
  G.onStartScreen = false;
  const start = document.getElementById('start-screen');
  if (start) start.style.display = 'none';
}

/** Stage one of the four shots, then raise the ready flag. */
export function stageShot(G, name) {
  beginShot(G);
  if (name === 'chase') stageChase(G);
  else if (name === 'onfoot') stageOnFoot(G);
  else if (name === 'drive') stageDrive(G);
  else if (name === 'mission') stageMission(G);
  updateHud(G);
  window.__shotReady = true;
}

/**
 * 1-chase (cover): 3 police interceptors 20-35 units ahead of Rook, a traffic
 * car threading between them, 4 pedestrians 14+ units clear of the cops in
 * depth, wanted 3 stars, the Heat objective, speed on the HUD, banner on top.
 */
function stageChase(G) {
  putPlayerInCar(G, 0, 60, 0, 24);
  setWanted(G, 3);
  // Clear any pooled police, then place exactly three interceptors ahead.
  for (const car of G.cars.police) {
    car.active = false;
    car.mesh.visible = false;
  }
  const spots = [
    { x: -4, z: 30 },
    { x: 3, z: 38 },
    { x: 0, z: 25 },
  ];
  spots.forEach((s, i) => {
    const car = G.cars.police[i];
    if (!car) return;
    car.active = true;
    car.mesh.visible = true;
    car.mesh.position.set(s.x, 0, s.z);
    car.mesh.rotation.y = Math.PI; // facing back toward Rook (south)
    car.heading = Math.PI;
    car.speed = 18;
  });
  // One traffic car threading between the interceptors.
  placeTraffic(G, [{ x: 0.5, z: 32, heading: 0 }]);
  // Four pedestrians on the pavements, 14+ units clear of the cops in depth.
  sidewalkPeds(G, [
    { x: -6.5, z: 10, heading: 0 },
    { x: 6.5, z: 5, heading: Math.PI },
    { x: -6.5, z: 0, heading: 0 },
    { x: 6.5, z: -5, heading: Math.PI },
  ]);
  setMission(G, 1);
  G.setObjective('Heat — lose the cops, get back to 0 stars');
  G.player.money = 1250; // a mid-chase bankroll, so the HUD money reads live
  showBanner(G, 'HEAT — 3 STARS', 'Three interceptors on your tail. Lose them, Rook.');
}

/**
 * 2-onfoot: Rook on foot downtown on street x=0, traffic ahead in both
 * lanes, pedestrians on both pavements, a parked red car at the kerb to
 * steal, mission 1 briefing + objective.
 */
function stageOnFoot(G) {
  putPlayerOnFoot(G, 0, 40, 0);
  setWanted(G, 0);
  placeParked(G, 0, 6.8, 28, 0); // the red car, at the kerb to steal
  placeTraffic(G, [
    { x: -2.5, z: 20, heading: 0 },
    { x: 2.5, z: 12, heading: Math.PI },
    { x: -2.5, z: 2, heading: 0 },
    { x: 2.5, z: -8, heading: Math.PI },
  ]);
  sidewalkPeds(G, [
    { x: -6.5, z: 25, heading: 0 },
    { x: 6.5, z: 18, heading: Math.PI },
    { x: -6.5, z: 8, heading: 0 },
    { x: 6.5, z: 30, heading: Math.PI },
  ]);
  setMission(G, 0);
}

/**
 * 3-drive: Rook driving with traffic in both lanes around him (4 cars),
 * pedestrians about, a parked car at the kerb mid-block.
 */
function stageDrive(G) {
  putPlayerInCar(G, 0, 50, 0, 18);
  setWanted(G, 0);
  placeTraffic(G, [
    { x: -2.5, z: 30, heading: 0 },
    { x: 2.5, z: 36, heading: Math.PI },
    { x: -2.5, z: 68, heading: 0 },
    { x: 2.5, z: 74, heading: Math.PI },
  ]);
  sidewalkPeds(G, [
    { x: -6.5, z: 40, heading: 0 },
    { x: 6.5, z: 45, heading: Math.PI },
    { x: -6.5, z: 60, heading: 0 },
    { x: 6.5, z: 28, heading: Math.PI },
  ]);
  placeParked(G, 1, 6.8, 40, 0); // parked car at the kerb, mid-block
  setMission(G, 2);
}

/**
 * 4-mission: Rook 31 units from the warehouse so the beacon clears the
 * roofline, traffic ahead, pedestrians on the pavements short of the
 * warehouse block.
 */
function stageMission(G) {
  putPlayerOnFoot(G, 140, 171, 0); // 31 units south of the warehouse (140, 140)
  setWanted(G, 0);
  placeTraffic(G, [
    { x: 137.5, z: 156, heading: 0 },
    { x: 142.5, z: 162, heading: Math.PI },
  ]);
  sidewalkPeds(G, [
    { x: 133.5, z: 158, heading: 0 },
    { x: 146.5, z: 162, heading: Math.PI },
    { x: 133.5, z: 166, heading: 0 },
  ]);
  setMission(G, 3);
}

export { CONFIG };
