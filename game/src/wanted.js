// Porto Alba — the wanted system. Crimes raise heat; heat decays when the
// player lies low. Police interceptors spawn at the city edge, chase the
// player, ram their car, and arrest them on foot when they get close and
// the player stops moving. Busted or wasted costs money and resets heat.

import { clamp, dist2 } from './util.js';

export function createWanted(G) {
  let level = 0;
  let decayTimer = 0;
  let arrestTimer = 0;
  const police = [];
  let spawnCooldown = 0;

  function addHeat(amount, reason) {
    const before = level;
    level = clamp(level + amount, 0, 5);
    decayTimer = 0;
    if (level > before) {
      G.hud.setWanted(level);
      if (reason) G.hud.toast(reason + ` — wanted level ${level}.`);
      if (level > G.state.bestWanted) G.state.bestWanted = level;
    }
  }

  function spawnPolice() {
    const p = G.player;
    // Spawn at a street edge away from the player.
    const angle = Math.atan2(p.x, p.z) + Math.PI + (G.rng() - 0.5) * 1.2;
    const x = clamp(p.x + Math.sin(angle) * 90, -170, 170);
    const z = clamp(p.z + Math.cos(angle) * 90, -170, 170);
    const car = G.cars.addCar('police', x, z, Math.atan2(p.x - x, p.z - z));
    car.cruise = 19;
    car.speed = 16;
    police.push(car);
  }

  function removePolice(car) {
    const i = police.indexOf(car);
    if (i >= 0) police.splice(i, 1);
    G.cars.removeCar(car);
  }

  function busted() {
    const fine = Math.round(G.player.money * 0.15);
    G.player.money -= fine;
    G.audio.busted();
    G.hud.showBusted(`Busted! The Alba PD took $${fine} in fines.`);
    level = 0;
    G.hud.setWanted(0);
    for (const car of [...police]) removePolice(car);
    // Respawn outside the police station.
    const s = G.world.locations.policeStation;
    if (G.player.car) {
      G.player.car.driven = false;
      G.player.car = null;
    }
    G.player.onFoot = true;
    G.player.x = s.x + 16;
    G.player.z = s.z + 4;
    G.player.mesh.group.visible = true;
    G.player.health = 100;
    G.story.onBusted();
  }

  function wasted() {
    const bill = Math.round(G.player.money * 0.1);
    G.player.money -= bill;
    G.audio.busted();
    G.hud.showBusted(`Wasted! The hospital bill was $${bill}.`);
    level = 0;
    G.hud.setWanted(0);
    for (const car of [...police]) removePolice(car);
    const s = G.world.locations.hospital;
    if (G.player.car) {
      G.player.car.driven = false;
      G.player.car = null;
    }
    G.player.onFoot = true;
    G.player.x = s.x + 14;
    G.player.z = s.z;
    G.player.mesh.group.visible = true;
    G.player.health = 100;
    G.story.onBusted();
  }

  function update(dt) {
    const p = G.player;
    // Heat decays after 25 quiet seconds.
    if (level > 0) {
      decayTimer += dt;
      if (decayTimer > 25) {
        decayTimer = 0;
        level -= 1;
        G.hud.setWanted(level);
        if (level === 0) G.hud.toast('You lost the cops.');
      }
    }
    // Keep the right number of police cars on the street.
    spawnCooldown -= dt;
    if (level > 0 && police.length < level && spawnCooldown <= 0) {
      spawnPolice();
      spawnCooldown = 2.5;
    }
    if (level === 0) {
      for (const car of [...police]) removePolice(car);
    }
    // Chase: steer toward the player, faster than traffic.
    for (const car of [...police]) {
      const d2 = dist2(car.x, car.z, p.x, p.z);
      const d = Math.sqrt(d2);
      if (d > 260) { removePolice(car); continue; }
      const want = Math.atan2(p.x - car.x, p.z - car.z);
      let dh = want - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += clamp(dh, -2.4 * dt, 2.4 * dt);
      const targetSpeed = p.car ? 30 : 20;
      car.speed += (targetSpeed - car.speed) * dt * 0.7;
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      // Ram the player's car.
      if (p.car && d < 4.5) {
        p.car.health -= 14 * dt;
        const push = 3 * dt;
        p.car.x += Math.sin(car.heading) * push;
        p.car.z += Math.cos(car.heading) * push;
        if (p.car.health <= 0) {
          G.hud.toast('Your car is wrecked! Bail out!');
          p.car.driven = false;
          p.car = null;
          p.onFoot = true;
          p.mesh.group.visible = true;
        }
      }
      // On foot, too close for too long while barely moving: arrested.
      if (p.onFoot) {
        if (d < 4.5 && p.speed < 1.5) {
          arrestTimer += dt;
          if (arrestTimer > 2.5) {
            arrestTimer = 0;
            busted();
            return;
          }
        } else {
          arrestTimer = Math.max(0, arrestTimer - dt * 2);
        }
        // A police car clipping the player hurts.
        if (d < 2.2 && car.speed > 4) {
          G.damagePlayer(12 * dt * 4, null);
        }
      }
    }
    if (p.health <= 0) wasted();
  }

  return {
    get level() { return level; },
    police,
    addHeat,
    update,
    busted,
    wasted,
  };
}
