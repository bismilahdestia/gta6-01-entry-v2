// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there.
//
// ?seed=N fixes the city and the traffic. ?shot=chase|onfoot|drive|mission
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.
//
// Pause freezes the world completely: while paused the loop never calls
// step(), so no car, pedestrian or cloud moves and no momentum survives.

import * as THREE from 'three';
import { STEP, SEED_DEFAULT, PLAYER, WORLD, PALETTE, MISSION_REWARD, SHIFT_JOBS, CAMERA } from './config.js';
import { createRandom, clamp, dist2d } from './util.js';
import { buildCity, AXES } from './city.js';
import { createCar, driveCar, createTraffic, updateTraffic, createPolice, updatePolice, collideCars } from './cars.js';
import { createPeople, updatePeople, buildPedMesh } from './people.js';
import { ramCars, shove, isWrecked } from './combat.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_STEAL, ACTION_SHOVE, ACTION_MUTE, createInput } from './input.js';
import { createWanted, addHeat, updateWanted } from './wanted.js';
import { createStory, currentObjective, missionProgress, PLACES, STEAL_SPOTS } from './story.js';
import { createHud, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER } from './hud.js';
import { createAudio } from './audio.js';
import { loadSave, storeSave, recordJob } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : SEED_DEFAULT;

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
window.addEventListener('resize', () => renderer.setSize(window.innerWidth, window.innerHeight));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 8, -14);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

const rng = createRandom(seed);
const city = buildCity(scene, rng);
const hud = createHud(document);
const audio = createAudio();
const saved = loadSave();

const world = {
  scene,
  camera,
  city,
  time: 0,
  cash: saved.cash,
  targetTaken: false,
  objectiveOverride: null,
  player: null,
  playerCar: null,
  ownCar: null,
  targetCar: null,
  traffic: [],
  peds: [],
  police: [],
  wanted: createWanted(),
  story: createStory(),

  /** Get in a car and drive it: the car becomes the player's car. */
  putPlayerInCar(car, x, z, heading, speed) {
    this.player.onFoot = false;
    this.player.mesh.visible = false;
    this.playerCar = car;
    this.playerCar.x = x;
    this.playerCar.z = z;
    this.playerCar.heading = heading;
    this.playerCar.speed = speed;
    this.playerCar.active = true;
    this.playerCar.mesh.visible = true;
    this.playerCar.mesh.position.set(x, 0, z);
    this.playerCar.mesh.rotation.y = heading;
  },

  reset() {
    this.time = 0;
    this.cash = saved.cash;
    this.targetTaken = false;
    this.objectiveOverride = null;
    this.wanted = createWanted();
    this.story = createStory();
    this.player.x = 0;
    this.player.z = -180;
    this.player.heading = 0;
    this.player.speed = 0;
    this.player.onFoot = true;
    this.player.mesh.visible = true;
    this.player.mesh.position.set(0, 0, -180);
    this.playerCar = this.ownCar;
    this.player.onFoot = true;
    this.player.mesh.visible = true;
    this.player.mesh.position.set(0, 0, -180);
    this.ownCar.active = false;
    this.ownCar.mesh.visible = false;
    this.ownCar.speed = 0;
    this.ownCar.damage = 0;
    this.targetCar.x = -210;
    this.targetCar.z = -210;
    this.targetCar.heading = Math.PI / 2;
    this.targetCar.speed = 0;
    this.targetCar.damage = 0;
    this.targetCar.active = true;
    this.targetCar.mesh.visible = true;
    this.targetCar.mesh.position.set(-210, 0, -210);
    this.targetCar.mesh.rotation.y = Math.PI / 2;
    for (const car of this.traffic) car.damage = 0;
    for (const car of this.police) {
      car.active = false;
      car.mesh.visible = false;
    }
  },

  step(dt, input) {
    this.time += dt;
    let crime = false;

    if (this.player.onFoot) {
      const speed = input.throttle ? (input.running ? PLAYER.runSpeed : PLAYER.walkSpeed) : 0;
      this.player.heading += input.steer * 2.8 * dt;
      this.player.speed = speed;
      this.player.x += Math.sin(this.player.heading) * speed * dt;
      this.player.z += Math.cos(this.player.heading) * speed * dt;
      this.player.x = clamp(this.player.x, -WORLD.half - 6, WORLD.half + 6);
      this.player.z = clamp(this.player.z, -WORLD.half - 6, WORLD.half + 6);
      this.player.mesh.position.set(this.player.x, 0, this.player.z);
      this.player.mesh.rotation.y = this.player.heading;
      if (input.steal && !this.targetTaken && dist2d(this.player.x, this.player.z, this.targetCar.x, this.targetCar.z) < PLAYER.stealRange) {
        this.targetTaken = true;
        // The player drives the teal car itself — no car swap, no vanishing.
        this.putPlayerInCar(this.targetCar, this.targetCar.x, this.targetCar.z, this.targetCar.heading, 0);
        addHeat(this.wanted, 25);
        crime = true;
        hud.banner('Car stolen! Get to the Marina.');
      }
      if (input.shove) {
        const heat = shove(this.player, this.peds, this.traffic);
        if (heat > 0) {
          addHeat(this.wanted, heat);
          crime = true;
        }
      }
    } else {
      driveCar(this.playerCar, input.steer, input.throttle, input.brake, dt);
      const allCars = [...this.traffic, ...this.police, this.targetCar];
      for (const other of allCars) {
        if (!other.active || other === this.playerCar) continue;
        if (collideCars(this.playerCar, other)) {
          if (this.time - (other.lastRam || -99) > 1.5) {
            other.lastRam = this.time;
            addHeat(this.wanted, ramCars(this.playerCar, other));
            crime = true;
          }
        }
      }
      if (isWrecked(this.playerCar)) {
        this.playerCar.speed = 0;
        hud.banner('Your car is wrecked!');
      }
    }

    updateTraffic(this.traffic, dt, this.playerCar.active ? this.playerCar : null);
    updatePeople(this.peds, dt, [...this.traffic, ...this.police, ...(this.playerCar.active ? [this.playerCar] : [])]);
    updatePolice(this.police, this.playerCar.active ? this.playerCar : this.player, dt, this.wanted.stars);
    updateWanted(this.wanted, dt, crime);
    this.city.update(dt);

    // Mission progress: reach the objective marker (in a car when the job needs one).
    const objective = this.objectiveOverride
      ? { text: this.objectiveOverride.text, target: this.objectiveOverride.getTarget() }
      : currentObjective(this.story);
    const reach = this.playerCar.active ? 10 : 6;
    const px = this.playerCar.active ? this.playerCar.x : this.player.x;
    const pz = this.playerCar.active ? this.playerCar.z : this.player.z;
    if (!this.objectiveOverride && dist2d(px, pz, objective.target.x, objective.target.z) < reach) {
      const done = missionProgress(this.story, this.playerCar.active, true);
      if (done) {
        this.cash += MISSION_REWARD;
        audio.blip();
        hud.banner(`Job done! +$${MISSION_REWARD} — ${currentObjective(this.story).text}`);
        storeSave(recordJob(this.cash, this.story.completed));
        // Handing the car over: step out at the Marina, the teal car stays
        // parked where it was delivered.
        if (done.id === 'deliver' && this.playerCar === this.targetCar) {
          this.player.onFoot = true;
          this.player.x = objective.target.x - 6;
          this.player.z = objective.target.z;
          this.player.heading = Math.PI;
          this.player.mesh.visible = true;
          this.player.mesh.position.set(this.player.x, 0, this.player.z);
          this.playerCar = this.ownCar;
          this.ownCar.active = false;
          this.ownCar.mesh.visible = false;
          this.targetCar.active = false;
        }
        // The next stealable car waits where the next driving job starts, so
        // the chain never strands the player on foot after a delivery.
        const next = currentObjective(this.story);
        const spot = STEAL_SPOTS[next.id];
        if (spot && !this.playerCar.active) {
          const place = PLACES[spot];
          this.targetTaken = false;
          this.targetCar.active = true;
          this.targetCar.mesh.visible = true;
          this.targetCar.x = place.x;
          this.targetCar.z = place.z;
          this.targetCar.heading = Math.PI / 2;
          this.targetCar.speed = 0;
          this.targetCar.damage = 0;
          this.targetCar.mesh.position.set(place.x, 0, place.z);
          this.targetCar.mesh.rotation.y = Math.PI / 2;
        }
      }
    }

    // Camera: follow behind the player, in the car or on foot.
    const fx = Math.sin(this.playerCar.active ? this.playerCar.heading : this.player.heading);
    const fz = Math.cos(this.playerCar.active ? this.playerCar.heading : this.player.heading);
    const dist = this.playerCar.active ? CAMERA.carDist : CAMERA.footDist;
    const height = this.playerCar.active ? CAMERA.carHeight : CAMERA.footHeight;
    const look = CAMERA.lookAhead;
    const desired = new THREE.Vector3(px - fx * dist, height, pz - fz * dist);
    camera.position.lerp(desired, 1 - Math.exp(-8 * dt));
    camera.lookAt(px + fx * look, 1.2, pz + fz * look);
  },
};

// The player on foot, the player's car and the teal target, placed by reset().
world.player = {
  x: 0,
  z: -180,
  heading: 0,
  speed: 0,
  onFoot: true,
  mesh: buildPedMesh(0x2e6fd8),
};
scene.add(world.player.mesh);
world.ownCar = createCar(scene, PALETTE.playerCar, { kind: 'player', x: 0, z: -180, heading: 0 });
world.ownCar.active = false;
world.ownCar.mesh.visible = false;
world.playerCar = world.ownCar;
world.targetCar = createCar(scene, PALETTE.targetCar, { kind: 'target', x: -210, z: -210, heading: Math.PI / 2, stripe: true });
world.traffic = createTraffic(scene, rng, AXES);
world.peds = createPeople(scene, rng, AXES);
world.police = createPolice(scene);
world.reset();

// Debug handle for the play-through harness (and curious players).
window.__porto = world;

function hudState() {
  const objective = world.objectiveOverride
    ? { text: world.objectiveOverride.text, target: world.objectiveOverride.getTarget() }
    : currentObjective(world.story);
  return {
    axes: AXES,
    objective: objective.target,
    player: world.playerCar.active ? world.playerCar : world.player,
    police: world.police,
    target: world.targetCar,
    targetTaken: world.targetTaken,
    time: world.time,
  };
}

function refreshHud() {
  hud.setStars(world.wanted.stars);
  const objective = world.objectiveOverride
    ? world.objectiveOverride.text
    : currentObjective(world.story).text;
  hud.setObjective(objective);
  const speed = world.playerCar.active ? Math.abs(world.playerCar.speed) * 3.6 : Math.abs(world.player.speed) * 3.6;
  hud.setSpeed(speed);
  hud.setCash(world.cash);
  hud.drawMinimap(hudState());
}

function runShot(name) {
  const staged = stageShot(name, world);
  refreshHud();
  let painted = 0;
  function paint() {
    renderer.render(world.scene, world.camera);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  hud.showScreen(SCREEN_PLAY);
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  // Jobs completed when the last shift ended; reset on every new shift so
  // the next shift ends at its own multiple of SHIFT_JOBS.
  let shiftDoneAt = 0;

  function startGame() {
    world.reset();
    shiftDoneAt = 0;
    accumulator = 0;
    screen = SCREEN_PLAY;
    hud.showScreen(SCREEN_PLAY);
    hud.announce('Playing. Steal the teal car at the North Docks.');
    audio.init();
  }

  function endShift() {
    screen = SCREEN_OVER;
    hud.showScreen(SCREEN_OVER);
    document.getElementById('shift-stats').textContent = `Shift complete — ${world.story.completed} jobs, $${world.cash.toLocaleString('en-US')} earned.`;
    hud.announce('Shift complete.');
    storeSave(recordJob(world.cash, world.story.completed));
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) audio.setMuted(!audio.isMuted());
    if (screen === SCREEN_TITLE && (actions & (ACTION_CONFIRM | ACTION_SHOVE))) startGame();
    else if (screen === SCREEN_OVER && (actions & ACTION_CONFIRM)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      hud.showScreen(SCREEN_PAUSED);
      audio.suspend();
      hud.announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      hud.showScreen(SCREEN_PLAY);
      audio.resume();
      hud.announce('Playing.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // Read the action keys once per frame: takeActions() clears the queue,
    // so the same press must serve both the screen handling and the first
    // simulation step — a second call would always see nothing (steal and
    // shove used to be eaten here and never reached the world).
    const frameActions = input.takeActions();
    handleActions(frameActions);
    if (screen === SCREEN_PLAY) {
      let firstStep = true;
      while (accumulator >= STEP) {
        const stepActions = firstStep ? frameActions : 0;
        firstStep = false;
        world.step(STEP, {
          steer: input.steer(),
          throttle: input.throttle(),
          brake: input.brake(),
          running: input.running(),
          steal: Boolean(stepActions & ACTION_STEAL),
          shove: Boolean(stepActions & ACTION_SHOVE),
        });
        accumulator -= STEP;
        if (world.story.completed > 0 && world.story.completed % SHIFT_JOBS === 0 && world.story.completed !== shiftDoneAt) {
          shiftDoneAt = world.story.completed;
          endShift();
          break;
        }
      }
      const speed01 = world.playerCar.active
        ? Math.abs(world.playerCar.speed) / 38
        : Math.abs(world.player.speed) / 11;
      audio.setEngine(speed01);
      audio.siren(world.wanted.stars >= 1);
      hud.tickBanner(STEP);
    } else {
      accumulator = 0;
      audio.setEngine(0);
    }
    refreshHud();
    renderer.render(scene, camera);
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      hud.showScreen(SCREEN_PAUSED);
      audio.suspend();
      hud.announce('Paused.');
    }
  });

  hud.showScreen(SCREEN_TITLE);
  hud.announce('Porto Alba. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
