// Porto Alba — boot. Wires every system together: renderer, sky and lights,
// camera follow, the main loop, entering and leaving cars, the pistol,
// car-vs-pedestrian hits, saving, and the ?shot= staging used by the
// screenshot script. Nothing here fetches anything: the game is static files.

import * as THREE from '../vendor/three/three.module.min.js';
import { mulberry32, clamp, angleLerp, dist2 } from './util.js';
import { buildCity, STREETS, LOCATIONS } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createCarSystem } from './cars.js';
import { createPeopleSystem, createPlayer } from './people.js';
import { createCombat } from './combat.js';
import { createWanted } from './wanted.js';
import { createStory } from './story.js';
import { createHud } from './hud.js';
import { loadSave, writeSave } from './save.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = parseInt(params.get('seed') || '1337', 10) || 1337;
const rng = mulberry32(seed);

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ec3e8);
scene.fog = new THREE.Fog(0x9cc3de, 120, 420);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7a5a, 1.15);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d0, 1.6);
sun.position.set(120, 180, 60);
scene.add(sun);

const world = buildCity(scene, rng);
world.streets = STREETS;
world.locations = LOCATIONS;

const saved = loadSave() || { money: 250, missionsDone: [], bestWanted: 0, totalEarned: 0 };

const G = {
  scene, camera, renderer, rng,
  world,
  state: {
    money: saved.money,
    missionsDone: saved.missionsDone.slice(),
    bestWanted: saved.bestWanted,
    totalEarned: saved.totalEarned,
  },
  input: createInput(canvas),
  audio: createAudio(),
  shotMode: null,
  cameraMode: 'follow',
};

G.cars = createCarSystem(G);
G.people = createPeopleSystem(G);
const playerSys = createPlayer(G);
G.player = playerSys.player;
G.player.money = G.state.money;
G.combat = createCombat(G);
G.wanted = createWanted(G);
G.story = createStory(G);
G.hud = createHud(G);

G.save = () => {
  G.state.money = G.player.money;
  writeSave(G.state);
};
G.damagePlayer = (amount, reason) => {
  if (G.player.health <= 0) return;
  G.player.health = Math.max(0, G.player.health - amount);
  if (reason) G.hud.toast(reason);
};
G.onCrash = (speed) => {
  G.audio.crash();
  G.trauma = Math.min(0.6, (G.trauma || 0) + 0.25);
  if (speed > 12) G.hud.toast('Crash!');
};
G.trauma = 0;

// Camera follow state.
let camYaw = Math.PI * 0.85;
let camPitch = 0.32;
let lastDragAt = 0;
let running = false;
let paused = false;
let framesRendered = 0;
let saveTimer = 0;

function tryEnterCar() {
  const p = G.player;
  if (!p.onFoot) return;
  const car = G.cars.nearestStealable(p.x, p.z, 4.5);
  if (!car) return;
  if (car.kind === 'traffic') {
    G.hud.toast('That car is moving — find a parked one.');
    return;
  }
  p.car = car;
  p.onFoot = false;
  car.driven = true;
  car.parked = false;
  p.mesh.group.visible = false;
  G.audio.click();
  if (car.kind === 'parked') {
    G.wanted.addHeat(1, 'You stole the car!');
  }
}

function tryExitCar() {
  const p = G.player;
  if (p.onFoot || !p.car) return;
  const car = p.car;
  car.driven = false;
  car.parked = true;
  car.speed = 0;
  p.car = null;
  p.onFoot = true;
  p.x = car.x + Math.cos(car.heading) * 2.4;
  p.z = car.z - Math.sin(car.heading) * 2.4;
  p.heading = car.heading;
  p.mesh.group.visible = true;
  p.mesh.group.position.set(p.x, 0, p.z);
  p.mesh.group.rotation.y = p.heading;
  G.audio.click();
}

function carHitsPedestrians(dt) {
  const p = G.player;
  if (!p.car) return;
  const car = p.car;
  if (Math.abs(car.speed) < 3) return;
  for (const ped of G.people.peds) {
    if (ped.down > 0) continue;
    if (dist2(car.x, car.z, ped.x, ped.z) < 4.8) {
      G.people.knockDown(ped, true);
      G.wanted.addHeat(1, 'You ran someone over!');
      G.audio.crash();
      G.trauma = Math.min(0.6, (G.trauma || 0) + 0.2);
    }
  }
}

function updateCamera(dt) {
  const p = G.player;
  const look = G.input.takeLook();
  if (look.dx !== 0 || look.dy !== 0) {
    camYaw -= look.dx * 0.005;
    camPitch = clamp(camPitch + look.dy * 0.003, 0.08, 0.9);
    lastDragAt = performance.now();
  }
  const focus = p.car
    ? { x: p.car.x, z: p.car.z, heading: p.car.heading, speed: Math.abs(p.car.speed) }
    : { x: p.x, z: p.z, heading: p.heading, speed: p.speed };
  // While driving, the camera settles behind the car once the player stops
  // dragging it around.
  if (p.car && performance.now() - lastDragAt > 2000) {
    camYaw = angleLerp(camYaw, focus.heading, 1 - Math.exp(-1.1 * dt));
  }
  // v2: in shot mode the camera sits closer and lower, so the player, the
  // cars and the pedestrians fill more of the frame — v1's wide shot left
  // the street mostly empty asphalt.
  const dist = G.shotMode
    ? (p.car ? 9 + focus.speed * 0.08 : 7)
    : (p.car ? 11 + focus.speed * 0.14 : 8.5);
  const height = G.shotMode ? (p.car ? 4.0 : 3.0) : (p.car ? 4.6 : 3.6);
  const cx = focus.x - Math.sin(camYaw) * dist;
  const cz = focus.z - Math.cos(camYaw) * dist;
  const shake = G.trauma || 0;
  const shX = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  const shY = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  camera.position.set(cx + shX, height + Math.sin(camPitch) * dist * 0.4 + shY, cz);
  camera.lookAt(
    focus.x + Math.sin(camYaw) * 5,
    1.6,
    focus.z + Math.cos(camYaw) * 5
  );
  G.trauma = Math.max(0, (G.trauma || 0) - dt * 1.4);
}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  const now = performance.now();

  if (running && !paused) {
    const input = G.input;
    // Pause.
    if (input.wasPressed('Escape') || input.wasPressed('KeyP')) {
      paused = true;
      G.hud.showPause();
    }
    // Enter / exit cars.
    if (input.wasPressed('KeyE')) {
      if (G.player.onFoot) tryEnterCar();
      else tryExitCar();
    }
    // Pistol.
    if (input.wasPressed('Digit1')) {
      G.player.armed = true;
      document.getElementById('hud-crosshair').style.display = 'block';
      G.hud.toast('Pistol out. Left click to fire.');
    }
    if (input.wasPressed('Digit2')) {
      G.player.armed = false;
      document.getElementById('hud-crosshair').style.display = 'none';
    }
    if (input.takeClick() && G.player.onFoot) {
      if (G.player.armed) G.combat.playerShoot();
      else G.combat.playerPunch();
    }
    // Slow health regen on foot, none while wanted.
    if (G.player.onFoot && G.wanted.level === 0 && G.player.health < 100) {
      G.player.health = Math.min(100, G.player.health + 2 * dt);
    }

    playerSys.update(dt, camYaw);
    G.cars.update(dt);
    G.people.update(dt, { x: G.player.x, z: G.player.z },
      G.player.car ? Math.abs(G.player.car.speed) : G.player.speed);
    carHitsPedestrians(dt);
    G.combat.update(dt);
    G.wanted.update(dt);
    G.story.update(dt);
    G.audio.update(dt,
      G.player.car ? Math.abs(G.player.car.speed) / 34 : 0,
      G.wanted.level);
    G.hud.update(now);

    saveTimer += dt;
    if (saveTimer > 20) {
      saveTimer = 0;
      G.save();
    }
    input.endFrame();
  }

  updateCamera(dt);
  renderer.render(scene, camera);
  framesRendered++;
  if (shot && framesRendered === 6) {
    window.__shotReady = true;
  }
}

const clock = new THREE.Clock();

// Buttons.
document.getElementById('play-button').addEventListener('click', () => {
  G.audio.unlock();
  G.audio.click();
  G.hud.hideStart();
  running = true;
  const done = G.state.missionsDone;
  const next = G.story.missions.findIndex((m) => !done.includes(m.id));
  if (next >= 0) G.story.startMission(next);
  else G.hud.toast('Free roam — all jobs done. The city is yours.');
});
document.getElementById('resume-button').addEventListener('click', () => {
  paused = false;
  G.hud.hidePause();
});
document.getElementById('busted-continue').addEventListener('click', () => {
  G.hud.hideBusted();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Shot mode: no start screen, the game runs at once and the shot staging
// places the player, the car, the police and the mission.
if (shot) {
  G.hud.hideStart();
  running = true;
  // Set shotMode BEFORE staging: the mission banner's long shot-mode
  // timeout only applies once this flag is set.
  G.shotMode = shot;
  stageShot(G, shot);
  // The screenshot is taken about a second after load, long before the
  // follow camera's 2s idle lerp would swing it behind the player, so
  // aim it behind the staged player/car right away.
  camYaw = G.player.car ? G.player.car.heading : G.player.heading;
} else {
  G.hud.showStart();
}

frame();
