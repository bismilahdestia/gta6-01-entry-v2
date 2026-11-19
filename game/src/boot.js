// Porto Alba — boot.js
// The game loop: renderer, camera, the shared G state, start / pause, the
// per-frame updates and the shot-mode freeze. G.shotMode is set BEFORE
// stageShot() runs, so banners and the camera use shot framing from the start.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { clamp, makeRng } from './util.js';
import { buildCity } from './city.js';
import {
  spawnTraffic, spawnParked, spawnPlayerCar,
  updateTraffic, updatePlayerCar, updatePolice,
  stealNearestParkedCar, exitCar,
} from './cars.js';
import { spawnPeds, updatePeds } from './people.js';
import { initWanted, updateWanted } from './wanted.js';
import { initCombat, fireWeapon, reloadWeapon, updateRivals } from './combat.js';
import { initStory, setMission, completeMission, onCarStolen, updateStory } from './story.js';
import { initHud, showBanner, setObjective, updateHud } from './hud.js';
import { initInput, throttleInput, steerInput } from './input.js';
import { initAudio } from './audio.js';
import { saveGame, loadGame, applySave } from './save.js';
import { stageShot } from './shots.js';

const C = CONFIG.COLORS;
const params = new URLSearchParams(window.location.search);

// Shared game state — every system reads and writes this one object.
const G = {
  scene: null,
  camera: null,
  renderer: null,
  clock: new THREE.Clock(),
  elapsed: 0,
  seed: Number(params.get('seed') || CONFIG.SHOT_SEED),
  shotMode: params.get('shot') || null, // set BEFORE stageShot()
  started: false,
  onStartScreen: true,
  paused: false,
  queueSteal: false,
  saveNote: '',
  player: {
    pos: new THREE.Vector3(0, 0, 20),
    heading: 0,
    speed: 0,
    onFoot: true,
    health: CONFIG.PLAYER_HEALTH,
    money: 0,
    car: null,
    mesh: null,
  },
  cars: { traffic: [], parked: [], police: [], playerCar: null },
  peds: [],
  rivals: [],
  wanted: null,
  weapon: null,
  mission: null,
  city: null,
  hud: null,
  input: null,
  audio: null,
  cameraOrbit: 0,
  saveTimer: 0,
  rng: makeRng(Number(params.get('seed') || CONFIG.SHOT_SEED) + 77), // shared seeded RNG for ambient behaviour
};

/** Build Rook: dark jacket, cap, the face of Porto Alba. */
function buildRookMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.85, 0.45),
    new THREE.MeshLambertMaterial({ color: 0x1f3a4d }),
  );
  jacket.position.y = 1.15;
  group.add(jacket);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 12, 10),
    new THREE.MeshLambertMaterial({ color: 0xe8b88a }),
  );
  head.position.y = 1.82;
  group.add(head);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.29, 0.29, 0.14, 12),
    new THREE.MeshLambertMaterial({ color: 0xc23b2e }),
  );
  cap.position.y = 2.02;
  group.add(cap);
  for (const sx of [-0.19, 0.19]) {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.8, 0.32),
      new THREE.MeshLambertMaterial({ color: 0x2e3a4a }),
    );
    leg.position.set(sx, 0.4, 0);
    group.add(leg);
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.75, 0.24),
      new THREE.MeshLambertMaterial({ color: 0x1f3a4d }),
    );
    arm.position.set(sx * 2.5, 1.15, 0);
    group.add(arm);
  }
  return group;
}

/** Set up renderer, scene, lights and camera. */
function initRender() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.getElementById('game-container').appendChild(renderer.domElement);
  G.renderer = renderer;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.sky);
  scene.fog = new THREE.Fog(C.fog, 140, 460);
  G.scene = scene;

  const camera = new THREE.PerspectiveCamera(CONFIG.CAM_FOV, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(0, 5, 32);
  G.camera = camera;

  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7a5a, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2cc, 1.6);
  sun.position.set(120, 180, 60);
  scene.add(sun);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

/** Start the game from the start screen (Play button or Enter). */
function startGame() {
  if (G.started) return;
  G.started = true;
  G.onStartScreen = false;
  const start = document.getElementById('start-screen');
  if (start) start.style.display = 'none';
  initAudio(G); // audio needs a user gesture; Play is the gesture
  const save = loadGame();
  if (save) applySave(G, save);
  setMission(G, G.mission.index || 0);
  G.player.mesh.position.copy(G.player.pos);
  showBanner(G, 'Porto Alba', CONFIG.STORY_INTRO);
}

/** Pause / resume. Pausing FREEZES the world — updates stop entirely. */
function togglePause() {
  if (!G.started) return;
  G.paused = !G.paused;
  const pauseEl = document.getElementById('pause-screen');
  if (pauseEl) pauseEl.style.display = G.paused ? 'flex' : 'none';
}

/** Walk Rook on foot: W/S move along the heading, A/D turn, Shift runs. */
function updateOnFoot(dt) {
  const p = G.player;
  const run = G.input.keys.ShiftLeft || G.input.keys.ShiftRight;
  const speed = run ? CONFIG.SPEEDS.run : CONFIG.SPEEDS.walk;
  const throttle = throttleInput(G);
  const steer = steerInput(G);
  p.heading -= steer * 2.4 * dt;
  if (throttle !== 0) {
    p.speed = throttle * speed;
    p.pos.x -= Math.sin(p.heading) * p.speed * dt;
    p.pos.z -= Math.cos(p.heading) * p.speed * dt;
    p.pos.x = clamp(p.pos.x, -196, 196);
    p.pos.z = clamp(p.pos.z, -196, 196);
  } else {
    p.speed = 0;
  }
  p.mesh.position.copy(p.pos);
  p.mesh.rotation.y = p.heading;
  // Walk bob.
  p.mesh.position.y = Math.abs(Math.sin(G.elapsed * 9)) * (throttle !== 0 ? 0.05 : 0);
}

/** Chase camera. Shot mode is tighter; normal play is wider. */
function updateCamera(dt) {
  const p = G.player;
  const inCar = !p.onFoot;
  const speed = Math.abs(p.speed || 0);
  let dist;
  let height;
  if (G.shotMode) {
    dist = inCar ? CONFIG.CAM_SHOT_CAR_DIST + speed * 0.08 : CONFIG.CAM_SHOT_FOOT_DIST;
    height = inCar ? CONFIG.CAM_SHOT_CAR_HEIGHT : CONFIG.CAM_SHOT_FOOT_HEIGHT;
  } else {
    dist = inCar ? CONFIG.CAM_PLAY_CAR_DIST + speed * 0.06 : CONFIG.CAM_PLAY_FOOT_DIST;
    height = inCar ? CONFIG.CAM_PLAY_CAR_HEIGHT : CONFIG.CAM_PLAY_FOOT_HEIGHT;
  }
  // Mouse drag orbits the camera around the player.
  G.cameraOrbit += (G.input?.orbitDelta || 0) * 0.9;
  if (G.input) G.input.orbitDelta = 0;
  const yaw = p.heading + G.cameraOrbit;
  const cx = p.pos.x + Math.sin(yaw) * dist;
  const cz = p.pos.z + Math.cos(yaw) * dist;
  G.camera.position.set(cx, height, cz);
  G.camera.lookAt(p.pos.x, 1.6, p.pos.z);
}

/** One frame. */
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(G.clock.getDelta(), 0.05);
  const frozen = !G.started || G.paused || !!G.shotMode;
  if (!frozen) {
    G.elapsed += dt;
    // Steal / exit with E.
    if (G.queueSteal) {
      G.queueSteal = false;
      if (G.player.onFoot) {
        const stolen = stealNearestParkedCar(G);
        if (stolen) onCarStolen(G);
      } else {
        exitCar(G);
      }
    }
    if (G.player.onFoot) updateOnFoot(dt);
    else updatePlayerCar(G, dt);
    updateTraffic(G, dt);
    updatePeds(G, dt);
    updatePolice(G, dt);
    updateWanted(G, dt);
    updateRivals(G, dt);
    updateStory(G, dt);
    // Autosave every 20 seconds of play.
    G.saveTimer += dt;
    if (G.saveTimer > 20) {
      G.saveTimer = 0;
      saveGame(G);
    }
  }
  updateCamera(dt);
  updateHud(G);
  G.renderer.render(G.scene, G.camera);
}

// ---- Wire everything together (fresh session, fresh build) ----
initRender();
G.player.mesh = buildRookMesh();
G.player.mesh.position.copy(G.player.pos);
G.scene.add(G.player.mesh);
buildCity(G);
spawnTraffic(G);
spawnParked(G);
spawnPlayerCar(G, 0, -30);
spawnPeds(G);
initWanted(G);
initCombat(G);
initStory(G);
initHud(G);
initInput(G);

// Callbacks the other systems invoke through G.
G.startGame = startGame;
G.togglePause = togglePause;
G.showBanner = (title, text) => showBanner(G, title, text);
G.setObjective = (text) => setObjective(G, text);
G.completeMission = () => completeMission(G);
G.fireWeapon = (x, y) => fireWeapon(G, x, y);
G.reloadWeapon = () => reloadWeapon(G);
G.saveGameNow = () => saveGame(G);

document.getElementById('play-button')?.addEventListener('click', startGame);
document.getElementById('resume-button')?.addEventListener('click', togglePause);

// Debug handle: lets automated checks inspect live state (position, cars,
// wanted level) without changing how the game plays.
window.__portoAlba = G;

// Shot staging happens after G.shotMode is set — never before.
if (G.shotMode) {
  stageShot(G, G.shotMode);
}

updateHud(G);
frame();
