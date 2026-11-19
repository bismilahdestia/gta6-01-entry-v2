# gta6-01-entry-v2

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/bismilahdestia/gta6-01-entry-v2/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/bismilahdestia/gta6-01-entry-v2/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Porto Alba** — a sun-soaked open-city chase game in three.js. Steal the teal car at the North Docks, bring it to the Marina, and stay ahead of the Porto Alba police. Every job pays $500; finish a shift of four jobs to win the day. Traffic, pedestrians, police chases, ramming, a wanted system with 0–4 stars, a high-contrast minimap and a deterministic seeded city.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — no build step, no dependencies beyond the vendored three.js 0.187.0.

## Controls

- **WASD / arrows** — drive & walk
- **E / F** — steal a car
- **Space** — shove (on foot)
- **P** — pause (freezes the world completely)
- **M** — mute
- **Shift** — run

## Systems

- **Procedural city** — a 480×480 m road grid with buildings, sidewalks, road dashes, sun and drifting clouds, all placed from a single seed (`?seed=N`).
- **Chase & drive** — third-person follow camera, traffic that cruises its lanes and brakes for cars ahead, police that spawn with the wanted level and chase the player.
- **Wanted** — heat 0–100 from stealing, ramming and shoving, shown as 0–4 stars; heat cools when you lie low.
- **Jobs** — a looping chain of objectives (steal → deliver → next job → getaway run), each with one beacon the minimap and the HUD agree on.
- **Screenshots** — `?shot=chase|onfoot|drive|mission&seed=91` stages each scene from the real simulation; see `shots.json`. Seed 91 is the default everywhere, so a shot and a play session build the same city.

---

<sub>Entered on [make.fun](https://make.fun/?ref=ej1cw7nv&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
