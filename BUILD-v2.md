# Porto Alba — BUILD-v2 notes

Fresh rewrite of the gta6-01 round 5 entry ("Porto Alba" v2 resubmit), written
from the prose spec in a single recorded session. No file was copied from the
earlier v2 attempt; every source file below was written fresh here, in paced
batches with sleeps between them.

## What it is

An original open-world crime game in the spirit of GTA 6 (no Rockstar names,
characters, map, art or music). Sun-soaked coastal city "Porto Alba",
protagonist "Rook". Static files under `game/`, no build step, no network
requests: three.js is vendored at `game/vendor/three/three.module.min.js` and
loaded through an import map. Keyboard + mouse in desktop Chrome.

Systems: explore on foot and by car; traffic cars and pedestrians; cars to
steal and drive (arcade physics); a wanted level (0–5 stars) with police
interceptors who chase; 4 missions + story; pistol combat with rivals; HUD
with a high-contrast minimap; start screen; save via localStorage; sound via
synthesized WebAudio (no audio files).

## Files (21 + 4 screenshots)

- `game/src/config.js` (113 lines) — constants: 400×400 map, colours, speeds, mission data, shot seed 91
- `game/src/util.js` (76) — seeded RNG (mulberry32), clamp/lerp, 2D helpers
- `game/src/city.js` (244) — procedural city: road grid (x=0 is a street), buildings, marina/promenade, warehouse, 9 low clouds
- `game/src/cars.js` (268) — traffic + player car + police interceptors; steal targets the NEAREST parked car only, never the player's own teal car
- `game/src/people.js` (136) — pedestrians on both pavements, wander, step clear of cars
- `game/src/wanted.js` (100) — stars 0–5, heat decay, 1 interceptor per star
- `game/src/combat.js` (232) — pistol raycast shooting, rivals, health/damage
- `game/src/story.js` (149) — 4 missions, briefings, gold beacon (diamond y=11, column opacity 0.38), mission flow
- `game/src/hud.js` (182) — health, stars, speed, objective chip, high-contrast minimap, banner (shot 30 s at top 9%, play 5 s at 28%)
- `game/src/boot.js` (281) — loop, renderer, camera (shot: car 9 + speed×0.08 / foot 7; heights 4.0/3.0), pause freezes the world
- `game/src/shots.js` (198) — staging for the 4 shots, `window.__shotReady`
- `game/src/input.js` (83) — WASD/arrows, E steal, P/F pause, R reload, Space handbrake, mouse orbit
- `game/src/audio.js` (125) — WebAudio synth: engine hum, siren, blip, gunshot
- `game/src/save.js` (79) — save/load via localStorage
- `game/index.html` (91) — import map, HUD DOM, CSS incl. `.screen[hidden]{display:none}` and `#hud-objective:empty{display:none}`
- `main.ts` (37) — copies game/ + screenshots/ to /output, writes dossier.json via vendor/makefun-game.ts
- `serve.ts` (75) — static dev server for game/ on 127.0.0.1:8123
- `shots.json` — 4 shot definitions, seed 91
- `README.md`, `LICENSE` (MIT), `BUILD-v2.md` (this file)
- `screenshots/1-chase.jpg`, `2-onfoot.jpg`, `3-drive.jpg`, `4-mission.jpg` — shot by this session, seed 91, 1280×800

Total: 2,469 lines across the 17 counted code files above (14 src modules +
index.html + main.ts + serve.ts).

## Fixes found by visual inspection (this session)

1. The first road grid (axes −180…180 step 40) made x=0 a building block, not
   a street — shots 1–3 were blocked by building walls. Fixed: axes are now
   −200…200 step 40, so x=0 is a street and blocks sit at ±20, ±60, … The
   re-shot frames show the road, traffic and kerb cars correctly.
2. The warehouse was 11 high, hiding its own y=11 beacon behind the roofline.
   Fixed: warehouse is 8 high, door + sign moved to the south face, so the
   beacon clears the roofline from 31 units (verified in 4-mission.jpg).

## Test results (measured this session, seed 91)

- `node --check` on all 14 `game/src/*.js` files: 0 errors. (One real syntax
  error was caught and fixed during the run: `wy` declared twice in hud.js.)
- Screenshots (`render-shots-91.mjs`): all 4 reached `window.__shotReady`,
  0 page errors, 0 console errors, 0 failed requests, 0 external requests.
  Sizes (limit 256 KiB each): 1-chase 60,356 B, 2-onfoot 67,001 B,
  3-drive 63,901 B, 4-mission 72,354 B. All 1280×800.
  - 1-chase sha256: 51bdc1b82919640f6125cfa3f42e24928cf126262eb2ec89b1032a7c6a126d0f
  - 2-onfoot sha256: a039b3309833facf4cf27641bf1028eefb12db29d05170bd757d1db7f84c864f
  - 3-drive sha256: d23e2582254553c6116192b88391fd5d83fb7c901a8d26d654be55f472d1dffa
  - 4-mission sha256: 0aae047aeb8b91739172b781b94838ad1a289c3e5f8bebaa46d3b9244f2b337a
- Play-through (`playthrough-check-91.mjs`): start screen renders, Play hides
  it and starts mission 1 with objective "Steal a parked car (press E near
  one)", HUD updates (100% health, $0, 0 stars), 0 errors.
- Steal check: Rook placed beside the nearest parked car, E pressed through
  the real key handler — stole THAT car (red, colour 0xc23b2e), not the teal
  player car; mission advanced to 2, wanted went to 1 star, parked count
  10 → 9, 0 errors.
- Pause check: two screenshots taken 1.5 s apart while paused are byte-identical
  (sha256 e430803ffc4e… both); after resume the next frame differs — the world
  freezes on pause and moves again on resume.
- Dossier: `MAKEFUN_OUTPUT_DIR=/tmp/gta6r5-out1 node main.ts` and a second run
  to `/tmp/gta6r5-out2` — dossier.json byte-identical across runs.
  sha256: 25f05b68072a520eb8dc806602549ed21f0e9f9e8c73181765c424cd182c729c,
  437,956 bytes (limit 1.5 MiB). Temp dirs deleted afterwards.
- Limits: game/ 2,216,960 bytes (limit 48 MiB), 22 entries (limit 993),
  index.html 6,092 bytes (limit 1 MiB).

## Pacing log (WIB, 2026-11-19)

- 18:49 session start, kit + tooling read
- 18:50 Batch 1 written (config, util, city, input, save)
- 18:50–18:53 sleep 150 s
- 18:53 Batch 2 written (cars, people, wanted, combat)
- 18:53–18:56 sleep 150 s
- 18:56 Batch 3 written (story, hud, boot, shots)
- 18:56–19:00 sleep 150 s
- 19:00 Batch 4 written (audio, index.html, main.ts, serve.ts, shots.json, README, LICENSE)
- 19:01–19:02 revision pass, first half (10 files, one real improvement each) + 60 s sleep
- 19:02 revision pass, second half (10 files)
- 19:03 syntax checks (hud.js `wy` fix), server up, first screenshot shoot
- 19:04–19:05 visual inspection found the road-grid + warehouse bugs; fixed, re-shot
- 19:05 play-through check passed
- 19:06–19:07 steal + pause checks passed
- 19:07 dossier runs byte-identical; temp dirs removed; test server stopped
- 19:08 BUILD-v2.md written last
- 19:10 final verification sweep (all checks, screenshots, limits) — build complete
