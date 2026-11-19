// Porto Alba — the submission handoff: copy game/ and screenshots/ into
// /output and write the dossier the scorer reads. Run from the repo root
// with Node 22 or newer:
//
//   node main.ts
//
// The dossier is built from the same caps the bounty gate uses, so what this
// script writes is exactly what the scorer will see. It is deterministic:
// run it twice and the dossier bytes are identical.

import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const REPO = resolve(import.meta.dirname);
const OUT = '/output';

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
};

function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) {
    const src = join(from, name);
    const dst = join(to, name);
    if (statSync(src).isDirectory()) copyTree(src, dst);
    else copyFileSync(src, dst);
  }
}

function main() {
  const gameDir = join(REPO, 'game');
  const shotsDir = join(REPO, 'screenshots');
  if (!existsSync(join(gameDir, 'index.html'))) {
    throw new Error('game/index.html is missing — nothing to hand in.');
  }
  const shots = existsSync(shotsDir) ? readdirSync(shotsDir).filter((f) => /\.(png|jpe?g)$/i.test(f)) : [];
  if (shots.length === 0) {
    throw new Error('screenshots/ holds no image — the entry needs at least one.');
  }
  // Fail fast on an oversized screenshot instead of letting the dossier build throw.
  for (const shot of shots) {
    const size = statSync(join(shotsDir, shot)).size;
    if (size > CAPS.screenshots.max_bytes) {
      throw new Error(`screenshots/${shot} is ${size} bytes — over the ${CAPS.screenshots.max_bytes} cap.`);
    }
  }

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  copyTree(gameDir, join(OUT, 'game'));
  copyTree(shotsDir, join(OUT, 'screenshots'));

  const dossier = buildDossier(OUT, CAPS);
  writeFileSync(join(OUT, 'dossier.json'), dossier);
  const gameFiles = countFiles(join(OUT, 'game'));
  console.log(`handed in: ${shots.length} screenshot(s), ${gameFiles} game file(s), dossier ${dossier.length} bytes -> ${OUT}`);
}

function countFiles(dir) {
  let n = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    n += statSync(p).isDirectory() ? countFiles(p) : 1;
  }
  return n;
}

main();
