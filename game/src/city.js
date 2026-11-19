// Porto Alba — city.js
// Procedural coastal city: road grid, building blocks with varied heights and
// colours, a marina and promenade on the south shore, the warehouse mission
// destination, and nine low unlit clouds near the horizon. Built once from a
// seeded RNG so the layout is identical every run (seed 91 for the shots).

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeRng, randRange, randInt, pick } from './util.js';

const C = CONFIG.COLORS;

/** Road centre-line positions along one axis: -200 .. 200 step 40 (x=0 is a street). */
export function roadAxes() {
  const axes = [];
  for (let v = -200; v <= 200; v += CONFIG.BLOCK) axes.push(v);
  return axes;
}

/** Build the whole city into G.scene. Returns handles the other systems use. */
export function buildCity(G) {
  const rng = makeRng(CONFIG.SHOT_SEED);
  const group = new THREE.Group();
  group.name = 'city';
  G.scene.add(group);
  const axes = roadAxes();
  const half = CONFIG.HALF;

  // Ground slab.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CONFIG.MAP_SIZE + 120, CONFIG.MAP_SIZE + 120),
    new THREE.MeshLambertMaterial({ color: C.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  group.add(ground);

  // Sea: a bright plane past the south edge (z > 185), plus a sand strip.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(CONFIG.MAP_SIZE + 240, 120),
    new THREE.MeshLambertMaterial({ color: C.water }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.02, half + 55);
  group.add(sea);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CONFIG.MAP_SIZE + 40, 12),
    new THREE.MeshLambertMaterial({ color: C.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.03, half - 2);
  group.add(sand);

  // Promenade boardwalk along the south shore.
  const prom = new THREE.Mesh(
    new THREE.BoxGeometry(CONFIG.MAP_SIZE, 0.3, 10),
    new THREE.MeshLambertMaterial({ color: C.promenade }),
  );
  prom.position.set(0, 0.15, half - 12);
  group.add(prom);

  // Road strips (asphalt) + sidewalks, both directions.
  const roadMat = new THREE.MeshLambertMaterial({ color: C.asphalt });
  const walkMat = new THREE.MeshLambertMaterial({ color: C.sidewalk });
  for (const a of axes) {
    const roadX = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.ROAD_WIDTH, CONFIG.MAP_SIZE), roadMat);
    roadX.rotation.x = -Math.PI / 2;
    roadX.position.set(a, 0.06, 0);
    group.add(roadX);
    const roadZ = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.MAP_SIZE, CONFIG.ROAD_WIDTH), roadMat);
    roadZ.rotation.x = -Math.PI / 2;
    roadZ.position.set(0, 0.06, a);
    group.add(roadZ);
    // Sidewalks flank every road.
    for (const off of [-CONFIG.ROAD_WIDTH / 2 - CONFIG.SIDEWALK / 2, CONFIG.ROAD_WIDTH / 2 + CONFIG.SIDEWALK / 2]) {
      const swX = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.SIDEWALK, CONFIG.MAP_SIZE), walkMat);
      swX.rotation.x = -Math.PI / 2;
      swX.position.set(a + off, 0.08, 0);
      group.add(swX);
      const swZ = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.MAP_SIZE, CONFIG.SIDEWALK), walkMat);
      swZ.rotation.x = -Math.PI / 2;
      swZ.position.set(0, 0.08, a + off);
      group.add(swZ);
    }
  }

  // Centre-line dashes: capacity = axes.length * (floor((span-6)/12)+1) * 2,
  // two dashes per slot (one per lane direction), so the mesh never overflows.
  const span = CONFIG.MAP_SIZE;
  const slots = Math.floor((span - 6) / 12) + 1;
  const dashCapacity = axes.length * slots * 2;
  const dashGeo = new THREE.BoxGeometry(0.5, 0.06, 3);
  const dashMat = new THREE.MeshBasicMaterial({ color: C.dash });
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashCapacity);
  const dummy = new THREE.Object3D();
  let di = 0;
  for (const a of axes) {
    for (let s = 0; s < slots; s++) {
      const along = -half + 6 + s * 12;
      // Along-X road: dash runs along Z; along-Z road: dash runs along X.
      dummy.rotation.set(0, 0, 0);
      dummy.position.set(a, 0.1, along);
      dummy.updateMatrix();
      dashes.setMatrixAt(di++, dummy.matrix);
      dummy.rotation.set(0, Math.PI / 2, 0);
      dummy.position.set(along, 0.1, a);
      dummy.updateMatrix();
      dashes.setMatrixAt(di++, dummy.matrix);
    }
  }
  dashes.count = di;
  dashes.instanceMatrix.needsUpdate = true;
  group.add(dashes);

  // Buildings: one or two per block, varied heights and warm colours.
  // Blocks sit between roads (centres at -180 .. 180 step 40); the warehouse
  // block (140, 140) stays clear.
  const buildings = [];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let bx = -180; bx <= 180; bx += CONFIG.BLOCK) {
    for (let bz = -180; bz <= 180; bz += CONFIG.BLOCK) {
      if (bx === 140 && bz === 140) continue; // warehouse plot
      if (rng() < 0.12) continue; // occasional plaza / empty lot
      const count = rng() < 0.45 ? 2 : 1;
      for (let k = 0; k < count; k++) {
        const w = randRange(rng, 14, 24);
        const d = randRange(rng, 14, 24);
        // Step the skyline down toward the sea: the marina row stays low.
        const hMax = bz >= 120 ? 16 : 42;
        const h = randRange(rng, 8, hMax);
        const x = bx + (count === 2 ? (k === 0 ? -7 : 7) : 0) + randRange(rng, -2, 2);
        const z = bz + randRange(rng, -2, 2);
        const mat = new THREE.MeshLambertMaterial({ color: pick(rng, C.building) });
        const b = new THREE.Mesh(boxGeo, mat);
        b.scale.set(w, h, d);
        b.position.set(x, h / 2, z);
        group.add(b);
        // Flat roof cap, slightly darker, for a finished skyline.
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6),
          new THREE.MeshLambertMaterial({ color: 0x6b5a48 }),
        );
        roof.position.set(x, h + 0.25, z);
        group.add(roof);
        buildings.push({ x, z, w, d, h });
        // A few tall towers get a rooftop beacon light.
        if (h > 30 && rng() < 0.5) {
          const beacon = new THREE.Mesh(
            new THREE.SphereGeometry(0.7, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xff5544 }),
          );
          beacon.position.set(x, h + 1, z);
          group.add(beacon);
        }
      }
    }
  }

  // Warehouse (mission 4 destination): a big low hall with a wide door on
  // its south face. Only 8 high, so the beacon at y=11 clears the roofline.
  const wh = CONFIG.WAREHOUSE;
  const warehouse = new THREE.Mesh(
    new THREE.BoxGeometry(34, 8, 22),
    new THREE.MeshLambertMaterial({ color: C.warehouse }),
  );
  warehouse.position.set(wh.x, 4, wh.z);
  group.add(warehouse);
  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 6),
    new THREE.MeshLambertMaterial({ color: 0x2e2a26 }),
  );
  door.position.set(wh.x, 3, wh.z + 11.1);
  group.add(door);
  const whSign = new THREE.Mesh(
    new THREE.BoxGeometry(20, 2.4, 0.4),
    new THREE.MeshBasicMaterial({ color: 0xffc93c }),
  );
  whSign.position.set(wh.x, 7.4, wh.z + 11.2);
  group.add(whSign);

  // Bank: a squat marble block at (-160, -100), on its own block centre.
  const bank = new THREE.Mesh(
    new THREE.BoxGeometry(26, 14, 20),
    new THREE.MeshLambertMaterial({ color: 0xd8d2c4 }),
  );
  bank.position.set(CONFIG.BANK.x, 7, CONFIG.BANK.z);
  group.add(bank);

  // Marina: a few moored boats (hull + mast) bobbing off the promenade.
  for (let i = 0; i < 5; i++) {
    const bx = -150 + i * 70 + randRange(rng, -8, 8);
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(12, 2, 4),
      new THREE.MeshLambertMaterial({ color: pick(rng, [0xf2f2f2, 0xd94f3d, 0x3d7ad9]) }),
    );
    hull.position.set(bx, 0.6, half + 22 + randRange(rng, 0, 18));
    group.add(hull);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 9, 6),
      new THREE.MeshLambertMaterial({ color: 0x5a4a38 }),
    );
    mast.position.set(bx, 5, half + 22);
    group.add(mast);
  }

  // Nine low clouds near the horizon: unlit white, seeded positions.
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const cloud = new THREE.Group();
    const puffs = randInt(rng, 2, 4);
    for (let p = 0; p < puffs; p++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(randRange(rng, 6, 12), 8, 6), cloudMat);
      s.scale.y = 0.45;
      s.position.set(p * randRange(rng, 7, 11) - puffs * 4, randRange(rng, -1, 1.5), randRange(rng, -3, 3));
      cloud.add(s);
    }
    const angle = randRange(rng, 0, Math.PI * 2);
    const radius = randRange(rng, 150, 230);
    cloud.position.set(Math.cos(angle) * radius, randRange(rng, 55, 85), Math.sin(angle) * radius);
    group.add(cloud);
    clouds.push(cloud);
  }

  // Palm trees along the promenade, for the coastal look.
  for (let x = -180; x <= 180; x += 30) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.5, 7, 6),
      new THREE.MeshLambertMaterial({ color: 0x7a5a38 }),
    );
    trunk.position.set(x, 3.5, half - 8);
    group.add(trunk);
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0x3f8f4f }),
    );
    crown.scale.y = 0.6;
    crown.position.set(x, 7.4, half - 8);
    group.add(crown);
  }

  G.city = { group, axes, buildings, warehouse: { x: wh.x, z: wh.z }, clouds, dashes };
  return G.city;
}
