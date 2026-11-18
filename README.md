[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![make.fun rank](https://make.fun/badge/gta6-01/bismilahdestia/gta6-01-entry-v2/rank.svg)](https://make.fun/bounty/gta6-01)
[![make.fun reward](https://make.fun/badge/gta6-01/bismilahdestia/gta6-01-entry-v2/reward.svg)](https://make.fun/bounty/gta6-01)

# Porto Alba

An original open-world crime game set in Porto Alba, a harbour city of
streets, traffic, pedestrians and police. You play Rook, a nobody with
empty pockets, taking jobs from Nadia Ferrante and Marco Voss.

## How to play

- **WASD** — walk, or drive when in a car
- **E** — enter / exit a parked car (stealing one raises your wanted level)
- **Mouse drag** — look around / orbit the camera
- **1 / 2** — pistol out / away; left click to fire while on foot
- **Esc** — pause

## Missions

Four story jobs, played in order, with cash rewards and a save that
persists in localStorage:

1. **First Wheels** — steal a parked car and bring it to the marina.
2. **The Package** — run a package across town for Marco Voss.
3. **Shake the Heat** — lose a three-star police chase.
4. **The Vault** — the big one.

Running over pedestrians or stealing cars raises your wanted level
(1–5 stars); police interceptors hunt you down while it is up, and
getting busted ends the run.

## Tech

- three.js 0.187.0, vendored under `game/vendor/three/` — no CDN, no
  network requests at all; the whole game is static files.
- Open `game/index.html` in a browser, or run `node serve.ts` and open
  http://localhost:8080.
- Screenshots in `screenshots/` are rendered headlessly from
  `shots.json` (`?shot=chase|onfoot|drive|mission&seed=19`).
  See `BUILD-v2.md` for what changed vs v1 and why.
