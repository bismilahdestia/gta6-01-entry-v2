// Porto Alba — the city of Porto Alba. Builds a sun-soaked harbour city on a
// street grid: roads, sidewalks, seeded buildings with lit windows, a marina
// with water, pier and boats, palms, lamps and named mission landmarks.
// Deterministic: the same seed always builds the same city.

import * as THREE from '../vendor/three/three.module.min.js';
import { pick } from './util.js';

export const STREETS = [-168, -126, -84, -42, 0, 42, 84, 126, 168];
export const ROAD_HALF = 6;
export const BOUND = 190;

// Named places the missions use. Block centres sit between street lines.
export const LOCATIONS = {
  marina: { x: -156, z: 42 },
  market: { x: 63, z: -63 },
  warehouse: { x: 126, z: 126 },
  safehouse: { x: 147, z: -147 },
  bank: { x: -42, z: 126 },
  hospital: { x: 42, z: -126 },
  policeStation: { x: -84, z: -84 },
  plaza: { x: 21, z: 21 },
};

const PALETTE = [
  0xe8dcc8, 0xd9a066, 0xc97b4a, 0xf2e6d0, 0x9fc3d4,
  0xe0b48f, 0xd18f5f, 0xefe3c8, 0xb7c9a8, 0xe6c9a8,
];

function windowTexture(rng, litRatio) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#efe9dc';
  g.fillRect(0, 0, 128, 256);
  const cols = 4, rows = 9;
  const cw = 128 / cols, ch = 256 / rows;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const lit = rng() < litRatio;
      g.fillStyle = lit ? '#ffd98a' : '#3a4a5a';
      g.fillRect(col * cw + 6, r * ch + 8, cw - 12, ch - 16);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function roadTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#33363b';
  g.fillRect(0, 0, 64, 256);
  g.fillStyle = '#45484e';
  for (let i = 0; i < 200; i++) {
    g.fillRect(Math.random() * 64, Math.random() * 256, 2, 2);
  }
  g.fillStyle = '#e8e4d2';
  g.fillRect(29, 20, 6, 70);
  g.fillRect(29, 150, 6, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  const winTexA = windowTexture(rng, 0.22);
  const winTexB = windowTexture(rng, 0.12);
  const roadTex = roadTexture();

  // Ground: warm paved city floor.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshLambertMaterial({ color: 0xcfc4ae })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  group.add(ground);

  // Harbour water, west of the promenade.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 420),
    new THREE.MeshLambertMaterial({ color: 0x2e7f9e })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(-245, 0.05, 0);
  group.add(water);

  // Roads: one dark strip per street line, both directions.
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  for (const s of STREETS) {
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(380, 12), roadMat);
      road.rotation.x = -Math.PI / 2;
      if (horizontal) {
        road.rotation.z = Math.PI / 2;
        road.position.set(s, 0.02, 0);
      } else {
        road.position.set(0, 0.02, s);
      }
      road.material.map.repeat.set(1, 1);
      group.add(road);
    }
  }

  // Sidewalk slabs, one per block.
  const walkMat = new THREE.MeshLambertMaterial({ color: 0xddd2ba });
  const blockCentres = [];
  for (let i = 0; i < STREETS.length - 1; i++) {
    for (let j = 0; j < STREETS.length - 1; j++) {
      blockCentres.push({ x: (STREETS[i] + STREETS[i + 1]) / 2, z: (STREETS[j] + STREETS[j + 1]) / 2 });
    }
  }
  for (const b of blockCentres) {
    const slab = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), walkMat);
    slab.rotation.x = -Math.PI / 2;
    slab.position.set(b.x, 0.015, b.z);
    group.add(slab);
  }

  function addBox(x, z, w, h, d, color, tex, y0) {
    const mat = new THREE.MeshLambertMaterial({ color, map: tex || null });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, (y0 || 0) + h / 2, z);
    group.add(mesh);
    return mesh;
  }

  function addCollider(x, z, w, d) {
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  }

  // Landmark blocks get purpose-built buildings instead of random ones.
  const landmarkBlocks = new Set([
    `${LOCATIONS.bank.x},${LOCATIONS.bank.z}`,
    `${LOCATIONS.warehouse.x},${LOCATIONS.warehouse.z}`,
    `${LOCATIONS.safehouse.x},${LOCATIONS.safehouse.z}`,
    `${LOCATIONS.market.x},${LOCATIONS.market.z}`,
    `${LOCATIONS.hospital.x},${LOCATIONS.hospital.z}`,
    `${LOCATIONS.policeStation.x},${LOCATIONS.policeStation.z}`,
  ]);

  for (const b of blockCentres) {
    const key = `${b.x},${b.z}`;
    if (landmarkBlocks.has(key)) continue;
    const count = 1 + Math.floor(rng() * 3);
    for (let k = 0; k < count; k++) {
      const w = 8 + rng() * 12;
      const d = 8 + rng() * 12;
      const h = 6 + rng() * rng() * 24;
      const ox = (rng() - 0.5) * (28 - w);
      const oz = (rng() - 0.5) * (28 - d);
      const x = b.x + ox, z = b.z + oz;
      const tex = rng() < 0.5 ? winTexA : winTexB;
      addBox(x, z, w, h, d, pick(rng, PALETTE), tex);
      addCollider(x, z, w, d);
      // Rooftop clutter on some buildings.
      if (rng() < 0.45) {
        addBox(x + (rng() - 0.5) * w * 0.4, z + (rng() - 0.5) * d * 0.4,
          2 + rng() * 2, 1.2, 2 + rng() * 2, 0x8a7f6d, null, h);
      }
    }
  }

  // Alba Bank: tall pale-stone tower with columns.
  addBox(LOCATIONS.bank.x, LOCATIONS.bank.z, 20, 34, 16, 0xe9e2cf, winTexA);
  addCollider(LOCATIONS.bank.x, LOCATIONS.bank.z, 20, 16);
  for (let i = -1; i <= 1; i++) {
    addBox(LOCATIONS.bank.x + i * 6, LOCATIONS.bank.z - 9.5, 1.6, 10, 1.6, 0xf5efdd, null);
  }
  // Warehouse: long low shed.
  addBox(LOCATIONS.warehouse.x, LOCATIONS.warehouse.z, 24, 9, 14, 0x9a8f7a, null);
  addCollider(LOCATIONS.warehouse.x, LOCATIONS.warehouse.z, 24, 14);
  // Safehouse: small two-storey house with a red roof.
  addBox(LOCATIONS.safehouse.x, LOCATIONS.safehouse.z, 12, 8, 10, 0xf2e6d0, winTexB);
  addCollider(LOCATIONS.safehouse.x, LOCATIONS.safehouse.z, 12, 10);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(9.5, 4, 4),
    new THREE.MeshLambertMaterial({ color: 0xb0503c })
  );
  roof.position.set(LOCATIONS.safehouse.x, 10, LOCATIONS.safehouse.z);
  roof.rotation.y = Math.PI / 4;
  group.add(roof);
  // Hospital: white block with a red cross slab.
  addBox(LOCATIONS.hospital.x, LOCATIONS.hospital.z, 18, 16, 14, 0xf4f4ee, winTexA);
  addCollider(LOCATIONS.hospital.x, LOCATIONS.hospital.z, 18, 14);
  addBox(LOCATIONS.hospital.x, LOCATIONS.hospital.z - 7.6, 6, 2.4, 0.6, 0xc23b2e, null, 12);
  addBox(LOCATIONS.hospital.x, LOCATIONS.hospital.z - 7.6, 2.4, 6, 0.6, 0xc23b2e, null, 10.8);
  // Police station: blue-grey block.
  addBox(LOCATIONS.policeStation.x, LOCATIONS.policeStation.z, 18, 12, 14, 0x5a6d84, winTexB);
  addCollider(LOCATIONS.policeStation.x, LOCATIONS.policeStation.z, 18, 14);

  // Market square: stalls with striped awnings, no buildings.
  const stallCols = [0xd95f4b, 0x4b8fd9, 0x58b368, 0xe0a83c];
  for (let i = 0; i < 5; i++) {
    const sx = LOCATIONS.market.x - 10 + i * 5;
    const sz = LOCATIONS.market.z + (i % 2 === 0 ? -6 : 6);
    addBox(sx, sz, 3.4, 2.4, 3, 0x8a6f4d, null);
    const awn = new THREE.Mesh(
      new THREE.BoxGeometry(4, 0.3, 3.6),
      new THREE.MeshLambertMaterial({ color: stallCols[i % stallCols.length] })
    );
    awn.position.set(sx, 2.8, sz);
    group.add(awn);
    addCollider(sx, sz, 3.4, 3);
  }

  // Marina pier, crates and moored boats.
  const pier = new THREE.Mesh(
    new THREE.BoxGeometry(24, 0.6, 110),
    new THREE.MeshLambertMaterial({ color: 0x9c8a6d })
  );
  pier.position.set(-182, 0.3, 0);
  group.add(pier);
  for (let i = 0; i < 6; i++) {
    addBox(-176 + (rng() - 0.5) * 8, -40 + i * 16 + (rng() - 0.5) * 4,
      2.5, 2.5, 2.5, 0xa08050, null);
  }
  const boatCols = [0xdde8ee, 0xe8b04b, 0x7fb069];
  for (let i = 0; i < 3; i++) {
    const bx = -215 - i * 14, bz = -70 + i * 70;
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(10, 2.4, 4),
      new THREE.MeshLambertMaterial({ color: boatCols[i] })
    );
    hull.position.set(bx, 0.8, bz);
    group.add(hull);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 9, 6),
      new THREE.MeshLambertMaterial({ color: 0x6b5a44 })
    );
    mast.position.set(bx, 5, bz);
    group.add(mast);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 2, 3),
      new THREE.MeshLambertMaterial({ color: 0xffffff })
    );
    cabin.position.set(bx - 1, 2.8, bz);
    group.add(cabin);
  }

  // Palms along the promenade.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  for (let z = -150; z <= 150; z += 30) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 7, 6), trunkMat);
    trunk.position.set(-174, 3.5, z);
    group.add(trunk);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(2.6, 8, 6), leafMat);
    crown.scale.y = 0.55;
    crown.position.set(-174, 7.4, z);
    group.add(crown);
    addCollider(-174, z, 1, 1);
  }

  // Street lamps at intersections.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3c4148 });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xaa8833 });
  for (const s of STREETS) {
    for (const t of [-84, 0, 84]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 6, 6), poleMat);
      pole.position.set(s + 6.5, 3, t + 6.5);
      group.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), lampMat);
      head.position.set(s + 6.5, 6.2, t + 6.5);
      group.add(head);
    }
  }

  // A few soft clouds, low near the horizon so they read in the sky band
  // of the screenshots (v1's sky was one flat blue sheet). Unlit white:
  // Lambert-shaded puffs read as grey UFOs from below.
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < 9; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rng() * 3);
    for (let k = 0; k < puffs; k++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(4 + rng() * 4, 8, 6), cloudMat);
      puff.position.set((rng() - 0.5) * 16, (rng() - 0.5) * 2, (rng() - 0.5) * 6);
      puff.scale.y = 0.45;
      cloud.add(puff);
    }
    cloud.position.set(-180 + rng() * 360, 32 + rng() * 12, -180 + rng() * 360);
    group.add(cloud);
  }

  // Playable bounds: four invisible walls keep the player off the water and
  // out of the void.
  colliders.push({ minX: -194, maxX: -193, minZ: -200, maxZ: 200 });
  colliders.push({ minX: 193, maxX: 194, minZ: -200, maxZ: 200 });
  colliders.push({ minX: -200, maxX: 200, minZ: -194, maxZ: -193 });
  colliders.push({ minX: -200, maxX: 200, minZ: 193, maxZ: 194 });

  return { colliders, group };
}
