// Porto Alba — story missions. Four jobs from Nadia Ferrante and Marco Voss,
// played in order: steal wheels, run a package, shake the heat, hit the
// vault. Each mission has objectives with a beacon marker in the world, a
// minimap pin and HUD text. Rewards pay in cash and are saved.

import * as THREE from '../vendor/three/three.module.min.js';
import { dist2 } from './util.js';

const MISSIONS = [
  {
    id: 'wheels', name: 'First Wheels', giver: 'Nadia Ferrante',
    briefing: 'Rook, you are nobody on foot in this city. Steal a parked car, then bring it to the marina so I can see it runs.',
    objectives: [
      { text: 'Steal a parked car (press E near one)', kind: 'steal' },
      { text: 'Drive the car to the marina marker', kind: 'goto', at: 'marina', radius: 10 },
    ],
    reward: 500,
  },
  {
    id: 'package', name: 'The Package', giver: 'Marco Voss',
    briefing: 'A package is waiting at the market stalls. Pick it up and bring it to my warehouse. No cops, no questions.',
    objectives: [
      { text: 'Pick up the package at the market (press E)', kind: 'pickup', at: 'market', radius: 6 },
      { text: 'Deliver the package to the warehouse', kind: 'goto', at: 'warehouse', radius: 10 },
    ],
    reward: 800,
  },
  {
    id: 'heat', name: 'Heat', giver: 'Nadia Ferrante',
    briefing: 'The Alba PD needs to learn your name, then forget it. Get to 3 stars, then lose them. Drive like you mean it.',
    objectives: [
      { text: 'Raise your wanted level to 3 stars', kind: 'wanted', stars: 3 },
      { text: 'Lose the heat — get back to 0 stars', kind: 'nowanted' },
    ],
    reward: 1200,
  },
  {
    id: 'vault', name: 'The Vault', giver: 'Marco Voss',
    briefing: 'The Alba Bank keeps its cash in the back room. Grab it, hold E at the vault, and get out. The crew at the door will not wave.',
    objectives: [
      { text: 'Go to the Alba Bank', kind: 'goto', at: 'bank', radius: 12 },
      { text: 'Grab the cash — hold E at the vault door', kind: 'channel', at: 'bank', radius: 7, hold: 3 },
      { text: 'Escape to the safehouse', kind: 'goto', at: 'safehouse', radius: 10 },
    ],
    reward: 2500,
  },
];

export function createStory(G) {
  let index = 0;
  let objIndex = 0;
  let active = false;
  let channelTime = 0;
  let rivalsSpawned = false;
  let beacon = null;
  let diamond = null;
  let bannerTimer = 0;

  function markerPos(obj) {
    if (!obj.at) return null;
    return G.world.locations[obj.at];
  }

  function showMarker(at) {
    hideMarker();
    if (!at) return;
    beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 40, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffc93c, transparent: true, opacity: 0.38,
        side: THREE.DoubleSide, depthWrite: false,
      })
    );
    beacon.position.set(at.x, 20, at.z);
    G.scene.add(beacon);
    diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.6),
      new THREE.MeshBasicMaterial({ color: 0xffc93c })
    );
    // Floats above the beacon base so it clears low rooftops (the
    // warehouse is 9 units tall) and reads from the street.
    diamond.position.set(at.x, 11, at.z);
    G.scene.add(diamond);
  }

  function hideMarker() {
    if (beacon) { G.scene.remove(beacon); beacon = null; }
    if (diamond) { G.scene.remove(diamond); diamond = null; }
  }

  function currentMission() {
    return MISSIONS[index] || null;
  }

  function currentObjective() {
    const m = currentMission();
    return m ? m.objectives[objIndex] : null;
  }

  function startMission(i) {
    index = i;
    objIndex = 0;
    active = true;
    channelTime = 0;
    rivalsSpawned = false;
    const m = MISSIONS[i];
    G.hud.showBanner(`${m.name} — ${m.giver}`, m.briefing);
    G.audio.pickup();
    const obj = currentObjective();
    if (obj && obj.at) showMarker(G.world.locations[obj.at]);
    G.hud.setObjective(obj ? obj.text : '');
    bannerTimer = 4;
  }

  function completeObjective() {
    objIndex++;
    channelTime = 0;
    const m = currentMission();
    const obj = currentObjective();
    if (!obj) {
      completeMission();
      return;
    }
    G.audio.pickup();
    if (obj.at) showMarker(G.world.locations[obj.at]);
    G.hud.setObjective(obj.text);
    if (obj.kind === 'channel' && !rivalsSpawned) {
      rivalsSpawned = true;
      const b = G.world.locations.bank;
      G.combat.addRival(b.x + 8, b.z - 6);
      G.combat.addRival(b.x - 8, b.z - 6);
      G.combat.addRival(b.x + 4, b.z + 10);
      G.hud.toast('Rivals are guarding the vault!');
    }
  }

  function completeMission() {
    const m = currentMission();
    active = false;
    hideMarker();
    G.player.money += m.reward;
    G.state.totalEarned += m.reward;
    if (!G.state.missionsDone.includes(m.id)) G.state.missionsDone.push(m.id);
    G.hud.setObjective('');
    G.hud.showBanner('Job done', `${m.name} complete — $${m.reward} earned.`);
    G.hud.toast(`$${m.reward} earned.`);
    G.audio.missionDone();
    G.save();
    if (index + 1 < MISSIONS.length) {
      window.setTimeout(() => {
        if (!active) startMission(index + 1);
      }, 4000);
    } else {
      G.hud.showBanner('Porto Alba Legend', 'All four jobs done. The city is yours, Rook.');
    }
  }

  function objectiveTarget() {
    const obj = currentObjective();
    if (!active || !obj || !obj.at) return null;
    return G.world.locations[obj.at];
  }

  function update(dt) {
    if (beacon) beacon.rotation.y += dt * 0.8;
    if (diamond) {
      diamond.rotation.y += dt * 1.4;
      diamond.position.y = 11 + Math.sin(performance.now() * 0.003) * 0.8;
    }
    if (bannerTimer > 0) bannerTimer -= dt;
    if (!active) return;
    const m = currentMission();
    const obj = currentObjective();
    if (!m || !obj) return;
    const p = G.player;
    const pos = { x: p.car ? p.car.x : p.x, z: p.car ? p.car.z : p.z };
    if (obj.kind === 'steal') {
      if (p.car) completeObjective();
    } else if (obj.kind === 'goto') {
      const at = G.world.locations[obj.at];
      if (dist2(pos.x, pos.z, at.x, at.z) < obj.radius * obj.radius) completeObjective();
    } else if (obj.kind === 'pickup') {
      const at = G.world.locations[obj.at];
      if (p.onFoot && dist2(p.x, p.z, at.x, at.z) < obj.radius * obj.radius && G.input.wasPressed('KeyE')) {
        G.audio.pickup();
        G.hud.toast('Package collected.');
        completeObjective();
      }
    } else if (obj.kind === 'wanted') {
      if (G.wanted.level >= obj.stars) completeObjective();
    } else if (obj.kind === 'nowanted') {
      if (G.wanted.level === 0) completeObjective();
    } else if (obj.kind === 'channel') {
      const at = G.world.locations[obj.at];
      const near = p.onFoot && dist2(p.x, p.z, at.x, at.z) < obj.radius * obj.radius;
      if (near && G.input.held('KeyE')) {
        channelTime += dt;
        G.hud.setObjective(`Cracking the vault… ${Math.ceil(obj.hold - channelTime)}s (hold E)`);
        if (channelTime >= obj.hold) {
          G.wanted.addHeat(3, 'The vault alarm is screaming!');
          G.hud.toast('Cash grabbed — run!');
          completeObjective();
        }
      } else {
        channelTime = Math.max(0, channelTime - dt * 2);
        if (channelTime === 0) G.hud.setObjective(obj.text);
      }
    }
  }

  // A bust or a hospital trip ends the current job attempt: the player keeps
  // completed missions but restarts the one they were on.
  function onBusted() {
    if (!active) return;
    objIndex = 0;
    channelTime = 0;
    G.combat.clearRivals();
    rivalsSpawned = false;
    const obj = currentObjective();
    if (obj && obj.at) showMarker(G.world.locations[obj.at]);
    G.hud.setObjective(obj ? obj.text : '');
    G.hud.toast('The job fell apart — start it over.');
  }

  // Shot mode: jump straight into a mission state for the screenshot.
  function stageForShot(shot) {
    if (shot === 'mission') {
      index = 1;
      objIndex = 1;
      active = true;
      showMarker(G.world.locations.warehouse);
      G.hud.setObjective(MISSIONS[1].objectives[1].text);
    }
  }

  return {
    missions: MISSIONS,
    get index() { return index; },
    get active() { return active; },
    startMission,
    completeMission,
    objectiveTarget,
    onBusted,
    stageForShot,
    update,
  };
}
