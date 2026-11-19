// The job chain: a short sequence of objectives that loops with harder jobs.
// Every objective has one place and one line of text, and the HUD and the
// mission screenshot both read the same current objective — the beacon and the
// text can never disagree, because there is only one source of truth.
//
// Places: the teal car waits at the North Docks (-210, -210); the drop-off is
// the Marina (210, 210); the next job starts at Warehouse Row (-210, 210).

export const PLACES = {
  northDocks: { x: -210, z: -210, name: 'North Docks' },
  marina: { x: 210, z: 210, name: 'Marina' },
  warehouseRow: { x: -210, z: 210, name: 'Warehouse Row' },
  oldTown: { x: 210, z: -210, name: 'Old Town' },
};

const JOB_CHAIN = [
  { id: 'steal', text: 'Steal the teal car at the North Docks', place: 'northDocks', needCar: false },
  { id: 'deliver', text: 'Bring the car to the Marina', place: 'marina', needCar: true },
  { id: 'pickup', text: 'Pick up the next job at Warehouse Row', place: 'warehouseRow', needCar: false },
  { id: 'run', text: 'Drive the getaway car to Old Town', place: 'oldTown', needCar: true },
];

/**
 * Where each stealable car waits: the first at the North Docks, the next at
 * Warehouse Row once the delivery job is done. The boot loop respawns the
 * target car here so the chain never strands the player on foot.
 */
export const STEAL_SPOTS = { steal: 'northDocks', run: 'warehouseRow' };

export function createStory() {
  return { index: 0, completed: 0, cash: 0 };
}

/** The objective the HUD shows and the beacon points at, right now. */
export function currentObjective(story) {
  const job = JOB_CHAIN[story.index % JOB_CHAIN.length];
  return { ...job, target: PLACES[job.place] };
}

/**
 * Advance the chain when the player reaches the current objective.
 * `inCar` is whether the player is driving; `atTarget` is whether they are
 * within reach of the objective marker. Returns the completed job, or null.
 */
export function missionProgress(story, inCar, atTarget) {
  const job = JOB_CHAIN[story.index % JOB_CHAIN.length];
  if (!atTarget) return null;
  if (job.needCar && !inCar) return null;
  story.index += 1;
  story.completed += 1;
  return job;
}

/** How many jobs the player has finished, for the save and the HUD. */
export function jobsDone(story) {
  return story.completed;
}
