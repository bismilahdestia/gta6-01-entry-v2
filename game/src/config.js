// Porto Alba — every tuning number and colour in one place.
// The city is a 480 by 480 metre grid; nothing below depends on the screen size.

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The seed the game and its screenshots share unless ?seed= says otherwise. */
export const SEED_DEFAULT = 91;

/** World extents: roads run from -240 to +240 on both axes. */
export const WORLD = { half: 240, roadEvery: 60, roadWidth: 11, sidewalk: 4 };

/** Dashes sit every 12 m along a road, first one 6 m in from the edge. */
export const DASH = { every: 12, offset: 6 };

export const PLAYER = {
  walkSpeed: 7,
  runSpeed: 11,
  carAccel: 26,
  carBrake: 42,
  carReverse: 12,
  carTopSpeed: 38, // about 137 km/h
  carTurn: 2.4,
  stealRange: 4.5,
  shoveRange: 2.2,
};

export const TRAFFIC = { count: 10, cruise: 11, gap: 9 };
export const PEDS = { count: 14, walk: 1.6, flee: 4.5 };
export const POLICE = { max: 3, cruise: 20, chase: 30, ramHeat: 8 };

/** Heat 0..100; stars are what the HUD shows and what the police answer to. */
export const WANTED = {
  steal: 25,
  ram: 8,
  shove: 4,
  coolPerSecond: 2.2,
  starAt: [1, 25, 50, 75],
};

export const MISSION_REWARD = 500;

/** Jobs in one shift; finishing this many shows the shift-complete screen. */
export const SHIFT_JOBS = 4;

/** Follow-camera distances: behind the player, and how high. */
export const CAMERA = { carDist: 12, carHeight: 6, footDist: 7, footHeight: 4, lookAhead: 10 };

export const PALETTE = {
  sky: 0x8ec8e8,
  sun: 0xfff1cf,
  ground: 0xd9c9a4,
  road: 0x3b3b42,
  dash: 0xe8e4d2,
  sidewalk: 0xb9b3a4,
  building: [0xe8dcc0, 0xd9a06b, 0xc97b5a, 0x9fc3d4, 0xe6cfae, 0xb98a68],
  playerCar: 0x2e6fd8,
  targetCar: 0x18b5a6,
  trafficCar: [0xd84b4b, 0xe8c33c, 0x7a7f8c, 0x4b9e5f, 0xe8e8e8, 0x5a4b8c],
  policeCar: 0x1c1e24,
  ped: [0xc96a4a, 0x4a7ac9, 0x7ac94a, 0xc9a24a, 0x8c4ac9],
  hudPanel: 'rgba(12, 16, 24, 0.72)',
  hudText: '#f2f0e8',
  hudAccent: '#ffd34d',
};

/** Where the save lives between visits (this browser only). */
export const SAVE_KEY = 'porto-alba.save.v1';

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
