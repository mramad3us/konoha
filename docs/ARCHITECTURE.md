# Konoha — Architecture (v0.5 remaster)

## Rules

1. **The simulation is headless.** `src/sim`, `src/ecs`, `src/core`, `src/content`, `src/world`
   never touch the DOM, canvas or audio. They run in Node under Vitest.
2. **Sim talks outward through events.** Systems push typed `SimEvent`s into
   `level.outbox`; render, audio and UI drain it. Nothing subscribes inside the sim.
3. **One root state.** `GameState` owns the clock, RNG, player profile, missions, roster,
   travel and every live level. Save = serialize `GameState`. Load = rebuild it.
4. **Components are declared once.** `COMPONENTS` in `ecs/components.ts` drives storage,
   destruction and serialization. Adding a component is one edit.
5. **Every change of state is an action.** Player input and AI both produce `Action`s that go
   through `sim/actions`. Same rules for everyone, testable without a screen.
6. **Seeded randomness only.** `game.rng` (serialized). No `Math.random` in the sim.
7. **Content is data.** Techniques, items, enemies, missions, NPCs, dialogue live in
   `src/content` with typed schemas.

## Layout

```
src/
  core/      rng, scheduler (min-heap), geometry, config (all tuning numbers)
  ecs/       Level (entities + component stores + spatial grid + tile/prop layers), serialization
  world/     tiles & props registries, generators (village, mission, encounter), pathfinding, FOV
  content/   techniques, items, archetypes, missions, npcs, flavor text
  sim/       game state, turn loop, actions, combat, stealth, AI, progression, missions, travel
  art/       pixel patterns: palettes, characters (paper doll), tiles, props, buildings, icons, font
  render/    sprite atlas, camera, iso renderer, visuals (tweens, poses), effects, lighting
  audio/     synthesized sfx + music, event → sound mapping
  ui/        input (physical key codes, rebindable), HUD, panels, menus
  screens/   landing, new game, load, settings, game
tests/       Vitest: unit + headless simulation scenarios
tools/       shot.mjs (headless Chrome screenshots), dev pages
docs/        DESIGN.md, ARCHITECTURE.md, CONTROLS.md
```

## Time and turns

- `game.clock` is a global tick counter (0.1 s). Levels share it.
- Each level owns a scheduler of `{ tick, seq, entity | system }` entries.
- `runUntilPlayerTurn()` pops entries in order: NPCs decide and perform an action, then
  get rescheduled at `tick + duration`; the `pulse` system entry runs every second
  (bleeding, regen, statuses, awareness decay, NPC-vs-NPC melee); it stops on the
  player's entry and hands control to input.
- Fast-forward (rest, sleep, train) = run the scheduler with the player auto-waiting.

## Levels and the player

- `village` level persists for the whole game. `away` levels (mission map, ambush map)
  exist only during an away mission.
- The player's profile objects (sheet, vitals, inventory) are **shared by reference** with the
  player entity of the active level, so nothing needs copying back. Serialization skips those
  components on the player entity and re-links them on load.

## Presentation

- The renderer draws at native pixel resolution into an offscreen buffer and scales it by an
  integer factor: one pixel grid for everything.
- Isometric 2:1, tile 32×16. Terrain is cached in chunks; entities and props are depth-sorted.
- `Visuals` (presentation only) tween positions, play poses and flashes from sim events.
- DOM HUD over the canvas. Input uses `KeyboardEvent.code` so AZERTY and QWERTY share
  physical positions; labels come from the active keyboard layout.

## Saves

IndexedDB slots plus JSON export/import. `SAVE_VERSION` gates migrations; pre-remaster saves
are listed but marked incompatible.
