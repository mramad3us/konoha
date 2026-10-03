# Changelog

## 0.5.1

- Fix: the screen froze after leaving an ambush or a mission map (input still worked).
  Old maps now stay alive until the next one is shown, and a bad frame can no longer stop
  the render loop.
- Fix: you no longer arrive on a mission map standing next to the exit.
- Fix: the log no longer overlaps the action bar; hints and the tile tooltip moved right.
- Thrown weapons are real projectiles now. They take time to fly: step out of the line to
  dodge, or press Guard with nobody adjacent to brace and maybe knock them out of the air.
  Quick enemies sidestep yours.
- Squad: health strip under your vitals; roster with status in the Character panel (P).
  Squadmates cast Vanish with you when they know it.
- Stocky character bodies; fields in the village have gates; dev mode (Settings) starts new
  characters as elite jonin.

## 0.5.0 — The Remaster

A rebuild from the ground up. Same heart (a Naruto-inspired shinobi life in an isometric pixel
world), new everything else. Saves from 0.4 and earlier are not compatible.

### Play
- Melee redesigned around Strike / Break / Guard with telegraphed intents. Taijutsu decides how
  much of an enemy's next move you can read; winning builds tempo; Guard covers you from every
  attacker, the other moves leave you open to flankers.
- Stealth: vision cones, light and darkness, noise, awareness that rises and fades
  (unaware → suspicious → alert → searching), alarms that spread, discovered bodies,
  takedowns, binding, carrying, searching. Sneaking shows enemy sight lines.
- Missions from D to A rank: delivery, search, patrol, capture, eliminate, recover, escort,
  sweep, infiltrate, hunt. Travel across an ink map of the Land of Fire with roadside ambushes.
- Squadmates who keep pace with you and whose injuries and deaths persist.
- Ranks are earned: mission records plus a trial duel against a proctor.
- Ryo and a small shop (kunai, shuriken, bandages, soldier pills); hospital, ramen stand, home.
- Time-skip training at the shed, spars in the arena.
- You can no longer be killed outright: defeat sends you home to the hospital, poorer and
  with a failed mission.
- Contextual one-time tips teach each mechanic when it first matters.

### World
- A compact Konohagakure: palisade and gate, Main Street, plaza, Hokage Tower under the
  monument cliff, river and bridges, training grounds, market, residential quarter, fields.
- 22 original villagers with daily routines.

### Look and sound
- One pixel grid: native-resolution rendering scaled by an integer zoom, classic 2:1 tiles.
- New procedural art: blended terrain, ~30 props, paper-doll characters with 11 poses,
  timber-frame buildings, night lighting with torch glow.
- Washi-and-ink interface: hanko-sealed mission slips, scrolls, a hand-inked travel map.
- Generative music (koto by day, flute and crickets at night, taiko in combat) and new
  synthesized sound effects.

### Under the hood
- Headless simulation with a component registry, scheduler-driven turns, seeded RNG and a
  single action pipeline shared by the player and the AI.
- Whole-game saves (every level, mid-mission included) with JSON export/import.
- Vitest suite: unit tests, full campaign runs, balance probes. Headless Chrome QA tool.
