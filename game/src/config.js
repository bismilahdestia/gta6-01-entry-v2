// Porto Alba — config.js
// Every tunable constant for the game lives here: map size, colours, speeds,
// mission text and the deterministic shot seed. One clear job: constants only.

export const CONFIG = {
  // World
  MAP_SIZE: 400,
  HALF: 200,
  BLOCK: 40, // road centre spacing
  ROAD_WIDTH: 10,
  SIDEWALK: 3,
  SHOT_SEED: 91,
  SAVE_KEY: 'porto-alba-save-v2',

  // Palette — sun-soaked coastal city, warm stucco, terracotta, sea blue.
  COLORS: {
    sky: 0x8ec9e8,
    fog: 0xbfd9e8,
    ground: 0x9aa578,
    asphalt: 0x3a3f45,
    sidewalk: 0xb8b0a0,
    dash: 0xf2eeda,
    water: 0x2e7fa8,
    promenade: 0xd9c9a8,
    sand: 0xe3d3a4,
    building: [0xe8dcc4, 0xd9a06b, 0xc97b5a, 0x8fa8bf, 0xe6c9a0, 0xb5c4a8, 0xd4b48c, 0x9db3c4],
    warehouse: 0x7a6a58,
    playerCar: 0x1f8a8a, // teal — Rook's own car, never a steal target
    parkedRed: 0xc23b2e,
    police: 0x1c2733,
    beacon: 0xffc93c,
  },

  // Speeds (units per second)
  SPEEDS: {
    walk: 6,
    run: 10,
    carMax: 38,
    carAccel: 16,
    carBrake: 30,
    carReverseMax: 10,
    trafficCruise: 9,
    policeMax: 44,
    pedWalk: 1.6,
    turnRate: 2.1,
  },

  // Wanted
  WANTED_MAX: 5,
  HEAT_DECAY_PER_SEC: 0.06, // stars fall back toward 0 while unseen and calm
  HEAT_PER_CRIME: 1,

  // Combat
  PLAYER_HEALTH: 100,
  PISTOL_DAMAGE: 34,
  PISTOL_RANGE: 55,
  RIVAL_HEALTH: 70,

  // Camera
  CAM_FOV: 62,
  CAM_SHOT_CAR_DIST: 9,
  CAM_SHOT_CAR_HEIGHT: 4.0,
  CAM_SHOT_FOOT_DIST: 7,
  CAM_SHOT_FOOT_HEIGHT: 3.0,
  CAM_PLAY_CAR_DIST: 13,
  CAM_PLAY_CAR_HEIGHT: 5.5,
  CAM_PLAY_FOOT_DIST: 10,
  CAM_PLAY_FOOT_HEIGHT: 4.5,

  // Mission destinations
  WAREHOUSE: { x: 140, z: 140 },
  MEET_SPOT: { x: -60, z: 60 },
  BANK: { x: -160, z: -100 },
  DROP_OFF: { x: 60, z: -140 },

  // Missions: title, briefing shown on the banner, objective shown on the HUD.
  MISSIONS: [
    {
      id: 1,
      title: 'First Wheels',
      briefing: 'Rook needs wheels. Steal a parked car — walk up to one and press E.',
      objective: 'Steal a parked car (press E near one)',
    },
    {
      id: 2,
      title: 'Lose the Heat',
      briefing: 'The Alba police are on you. Break line of sight and cool off.',
      objective: 'Lose the heat — get back to 0 stars',
    },
    {
      id: 3,
      title: 'The Delivery',
      briefing: 'A package for the marina crew. Drive it to the drop-off, fast and clean.',
      objective: 'Drive the package to the drop-off by the marina',
    },
    {
      id: 4,
      title: 'The Warehouse Job',
      briefing: 'One last job: the warehouse vault. Rivals are waiting inside — be ready.',
      objective: 'Reach the warehouse and clear out the rivals',
    },
  ],

  STORY_INTRO:
    'Porto Alba, 2026. Rook came home with nothing but a name and a debt. ' +
    'The city runs on sun, salt and stolen cars — time to take it back, one job at a time.',

  // Traffic / pedestrians
  TRAFFIC_COUNT: 14,
  PARKED_COUNT: 10,
  PED_COUNT: 22,
  POLICE_PER_STAR: 1,
};
