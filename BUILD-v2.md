# Porto Alba — BUILD v2 (resubmit for make.fun gta6-01)

Built 19 Nov 2026 from a copy of the v1 entry (`~/workspace/makefun/gta6-01/bot/`,
submission 01a1eadf, provisional judge rate 970,915, rank 5025/5216). The v1
directory was not touched. v2 must be strictly better than v1 (Force_Last:
a resubmit REPLACES v1 as the final entry), so every change below targets a
judge criterion and was verified by looking at the new screenshots.

## What was wrong with v1 (judge's view)

The judge sees only a contact sheet (cover large on top, 3 small beneath)
plus a short source outline — screenshots dominate. v1's sheet was weak:

- **Cover was an empty beach.** `1-start.jpg`: Rook alone on the marina
  promenade, no city, no traffic, no pedestrians, health bar hidden behind
  the objective box. The strongest image (the chase) was buried third.
- **Roads were empty in every shot.** Only 12 traffic cars and 22
  pedestrians spread over a 400×400 map; none landed in frame on their own.
- **Minimap was an unreadable dark blob** at contact-sheet size (dark-grey
  roads `#555a61` on near-black `#10141a`).
- **Mission beacon invisible** in `4-mission.jpg`: the player was staged
  48+ units out and the beacon diamond hid behind the 9-unit warehouse roof.
- **Mission banner never visible**: the 5 s banner expired during
  swiftshader's slow first frames, before the shutter fired.
- **Empty-objective chip bug**: with no mission active the objective div
  rendered as a small dark rectangle (padding + border, no text).
- Clouds: none — flat blue sky.

Non-issue found while checking: the "nearly empty health bar" in v1's
cover was a misread — the bar was full; the objective box overlapped it.
Health is 100% in all v2 shots (confirmed in the render diagnostics).

## What changed vs v1 (file by file)

### `game/src/shots.js` — re-staged all four shots (criterion 1, 2)
- Shot order renamed so the **chase is the cover**: `1-chase.jpg`,
  `2-onfoot.jpg`, `3-drive.jpg`, `4-mission.jpg`. New seed **19**; the
  whole set was re-shot in this session and `shots.json` regenerated from
  that shoot (never reused v1's files — the v1 422 lesson).
- New helpers `placeTraffic()` (slow cruise, no intersection turns for
  60 s so staged cars hold their lane) and `sidewalkPeds()` (walkers on
  both pavements). Every shot now has traffic + pedestrians in frame.
- **chase (cover):** 3 police interceptors 20–35 units ahead (v1: 40–50,
  too small to read), a traffic car threading between them, 4 pedestrians
  placed well clear of the cops in depth — a walker a unit behind a police
  car reads as standing *on its roof*, so the peds sit 14+ units clear.
  Wanted 3 stars + "Heat" mission objective + speed on the HUD.
- **onfoot (replaces the beach cover):** Rook on foot downtown on street
  x=0, traffic ahead in both lanes, pedestrians on both pavements, a
  parked red car at the kerb to steal, mission 1 briefing + objective.
- **drive:** traffic in both lanes around the player (4 cars), pedestrians,
  parked car at the kerb (moved mid-block — at the intersection corner it
  read as parked on the crossing).
- **mission:** player moved to 31 units from the warehouse (was 48+) so
  the beacon clears the roofline; traffic ahead, pedestrians on the
  pavements (kept short of the warehouse block).

### `game/src/hud.js` — minimap contrast + banner (criteria 1, 3)
- Minimap redrawn high-contrast: near-white roads (`#d7dde5`, width 5)
  on slate `#232d38`, mid-slate building blocks, brighter water, white
  3 px traffic dots, red police dots with white rings, gold mission marker
  with white ring, larger player arrow with a dark outline. At ~90 px on
  the contact sheet the grid now reads as a map, not a blob.
- `showBanner()`: in shot mode the banner lasts 30 s (was 5 s) and moves
  to `top: 9%` (was 28%) so it no longer sits over the street and hides
  the cops/traffic. In normal play it is unchanged (5 s, 28%).

### `game/src/boot.js` — tighter shot camera (criterion 1)
- In shot mode only: camera distance 9 + speed×0.08 (was 11 + speed×0.14)
  in a car, 7 (was 8.5) on foot; height 4.0/3.0 (was 4.6/3.6). The player,
  cars and pedestrians fill more of the frame; v1's wide shot left the
  street mostly empty asphalt.
- `G.shotMode` is now set *before* `stageShot()` so the banner's long
  shot-mode timeout applies to the mission briefing shown during staging.

### `game/src/story.js` — beacon readability (criterion 1, 2)
- Mission diamond floats at y=11 (was 9) so it clears the 9-unit
  warehouse roof; beacon column opacity 0.28 → 0.38. Gameplay effect:
  the marker is simply easier to see from the street.

### `game/src/city.js` — sky (criterion 4)
- 9 low clouds near the horizon (unlit white `MeshBasicMaterial` —
  Lambert-shaded puffs read as grey UFOs from below). Deterministic
  from the seeded rng, like the rest of the city.

### `game/index.html` — empty-objective chip fix (criterion 3)
- `#hud-objective:empty { display: none; }`. The drive shot no longer
  shows a stray dark rectangle.

### Not changed
- `vendor/makefun-game.ts` — byte-identical to v1 (verified with diff).
- `main.ts`, `serve.ts`, `LICENSE`, game systems (`cars.js`, `people.js`,
  `wanted.js`, `combat.js`, `audio.js`, `input.js`, `save.js`, `util.js`),
  the four missions, story text, city layout logic, three.js vendor.
- No new files under `game/` (still 17 files); no network references added.

## How it was tested

All tests run headless in this session (chrome-headless-shell +
swiftshader WebGL, `puppeteer`), game served by `node serve.ts` on
`127.0.0.1:8123`.

1. **Screenshot shoot** (`render-shots.mjs`, seed 19, 3 passes — the
   last after the beacon/banner/cloud fixes): all 4 shots reached
   `window.__shotReady`, **zero page errors, zero console errors, zero
   failed requests, zero external (non-localhost/data:) requests** in
   every shot. Diagnostics at shutter time: health 100% in all shots;
   stars `★★★☆☆` (chase) / `☆☆☆☆☆` (others); objectives
   "Lose the heat — get back to 0 stars" / "Steal a parked car (press E
   near one)" / "" / "Deliver the package to the warehouse"; banner
   visible (opacity 1) in chase + onfoot.
2. **Visual inspection** of all 4 final JPEGs (this session): cover shows
   3 stars, 3 police cars (one closing in large at right), traffic,
   pedestrians, mission banner at top, readable minimap; onfoot shows
   Rook, parked car, 3 traffic cars, 6+ pedestrians; drive shows traffic
   in both lanes + pedestrians; mission shows the gold beacon column +
   diamond above the warehouse roof, 2 traffic cars, pedestrians.
3. **Play-through test** (no `?shot=`): start screen renders, Play
   button starts mission 1 with its objective, HUD updates, zero errors
   and zero external requests.
4. **Movement test**: two frames of the drive shot 1.5 s apart differ
   (SHA-256 differs), speedometer live at 37 km/h — the loop and the
   driving physics actually run, the shots are not a static scene.
5. **Dossier build**: `MAKEFUN_OUTPUT_DIR=/tmp/gta6v2-out1 node main.ts`
   (and a second run to `/tmp/gta6v2-out2`): **dossier.json byte-identical
   across runs**, 574,259 bytes. Dossier contains the v2 source markers
   (`sidewalkPeds`, `placeTraffic`) and `1-chase.jpg`. Temp output dirs
   deleted afterwards; the test server was stopped.

## Measured numbers (gate limits in brackets)

| item | v2 | limit |
|---|---|---|
| `game/` total | 2,223,529 bytes (2.2 MB) | ≤ 48 MiB |
| `game/` files | 17 (0 symlinks) | ≤ 993 |
| `game/index.html` | 5,603 bytes | ≤ 1 MiB |
| screenshots | 4 files, 1280×800 each | 3–4, long ≤ 1280, short ≥ 480 |
| `1-chase.jpg` | 96,072 bytes | ≤ 256 KiB |
| `2-onfoot.jpg` | 104,950 bytes | ≤ 256 KiB |
| `3-drive.jpg` | 87,547 bytes | ≤ 256 KiB |
| `4-mission.jpg` | 72,276 bytes | ≤ 256 KiB |
| `dossier.json` | 574,259 bytes | ≤ 1.5 MiB |
| render errors | 0 page / 0 console / 0 failed / 0 external | 0 |

## Honest caveats

- **No judge score can be verified locally.** The +15,038 judge points
  needed (970,915 → 985,953) is a prediction, not a measurement: the
  changes target exactly what the judge's criteria reward (busy shots
  showing wanted/police/missions/traffic/pedestrians/minimap, readable
  HUD, clearer structure), but the dev grade after submit is the first
  real number.
- **The game is still low-poly flat-shaded three.js.** Criterion 4
  (look/originality) got only clouds + tighter framing; a richer art
  direction (shadows, varied rooflines, more landmarks) would need a
  bigger rebuild than this task's tight scope allowed.
- **Combat is not shown in any shot.** The pistol/rivals exist (mission 4
  spawns rivals at the bank) but no shot stages a firefight; the 4-shot
  budget was spent on the open-world criteria, which the judge ranks
  first. A combat shot would mean dropping the drive or mission shot.
- **The warehouse is a big blank slab** in the mission shot — it is the
  destination, so it dominates the frame, but it has no signage or
  detail. The beacon above it is what carries the shot.
- The v1 rank/rate figures above (970,915, rank 5025) are the parent
  worker's measurements from this run; v2's rate is unknown until graded.
