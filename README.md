# Konoha — Path of the Shinobi

A turn-based, isometric pixel-art shinobi game that runs entirely in your browser, offline.
You are a fresh genin of the Hidden Leaf: take missions, read your opponents, sneak through
bandit camps, and climb from Genin to Jonin.

## Play

```bash
./play.sh          # macOS / Linux
play.cmd           # Windows
```

or `npm install && npm run dev`, then open http://localhost:5173.

## What you do

- **Village life.** Konohagakure is a small, living place: villagers keep daily routines, shops
  open and close, the Mission Desk posts new requests every morning. Train at the shed, spar in
  the arena, eat ramen, sleep at home.
- **Missions.** D-rank errands inside the walls, then C, B and A-rank jobs across the Land of
  Fire: captures, eliminations, escorts, recoveries, sweeps, infiltrations, hunts. Travel on an
  ink map, survive roadside ambushes, do the job, get out, report, get paid.
- **The exchange.** Melee is Strike, Break and Guard. Strike beats Break, Break beats Guard,
  Guard beats Strike. Enemies telegraph their next move; the better your Taijutsu, the clearer
  you read it. Winning builds tempo.
- **Stealth.** Sneak to see enemy sight lines. Stay in tall grass and shadow. Strike an unaware
  enemy from behind for a silent takedown, then bind, search, carry or finish them.
- **Ninjutsu.** Kawarimi, Chakra Dash, Water Walking, and hand-sign techniques (Vanish, Shadow
  Step) typed on the number row.
- **Growth.** Skills improve by use. Ranks are earned: complete missions, then pass a trial
  duel against a proctor.

See [docs/CONTROLS.md](docs/CONTROLS.md) for every key. AZERTY and QWERTY both work: keys are
read by position, and the game shows your layout's labels.

## Development

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Vitest: unit tests, headless campaign runs, balance probes |
| `npm run build` | Typecheck and production build to `dist/` |
| `npm run check` | All of the above |
| `node tools/shot.mjs <script.json> [outDir]` | Drive the game in headless Chrome and take screenshots |

Dev shortcuts: `?dev=mission`, `?dev=duel`, `?dev=village&at=plaza`, plus `&hour=22&seed=7`.
The art gallery lives at `/dev/art.html?s=chars|props|terrain|buildings`.

Design and architecture: [docs/DESIGN.md](docs/DESIGN.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
History: [CHANGELOG.md](CHANGELOG.md).

## Tech

TypeScript (strict) and Vite. No framework, no runtime dependencies, no network access at
runtime. Everything — pixel art, music, sound — is generated in code. Saves live in IndexedDB
and can be exported to JSON.
