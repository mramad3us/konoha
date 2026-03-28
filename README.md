# Konoha — Path of the Shinobi

A Naruto-inspired, zone-based, top-down isometric pixel art browser game. Turn-based roguelike mechanics, fully offline, runs in any modern browser.

## Quick Start

```bash
# macOS / Linux
./play.sh

# Windows
play.cmd
```

Or manually:

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`.

## Controls

| Key | Action |
|-----|--------|
| `h` `j` `k` `l` | Move W / S / N / E |
| `y` `u` `b` `n` | Move NW / NE / SW / SE |
| `.` | Wait |
| `1` `2` `3` `4` | Stance: Sprint / Walk / Creep / Crawl |
| `?` | Toggle keybindings panel |

Movement is turn-based. Each move advances time by a number of ticks based on your stance (Sprint=1, Walk=2, Creep=3, Crawl=4). Bump into enemies to attack.

## Project Structure

```
src/
├── core/constants.ts        # Single source of truth for all config
├── types/                   # TypeScript type definitions
│   ├── ecs.ts               # Entity components (Position, Health, Combat, etc.)
│   ├── tiles.ts             # Tile types and registry
│   ├── actions.ts           # Game actions and log entries
│   ├── save.ts              # Save file & settings types
│   └── screens.ts           # Screen navigation types
├── engine/                  # Core game engine
│   ├── world.ts             # Central state: entity-component stores
│   ├── turnSystem.ts        # Turn execution: move, combat, tick advance
│   ├── fov.ts               # Symmetric recursive shadowcasting
│   ├── combat.ts            # Melee damage resolution
│   ├── actionResolver.ts    # Keyboard → GameAction mapping
│   ├── session.ts           # Active save ID holder
│   └── ai/aiSystem.ts       # AI dispatcher (static-only for v0.1.0)
├── map/                     # World map
│   ├── tileMap.ts           # Uint8Array-backed tile grid
│   ├── mapData.ts           # Hand-designed 40×40 training grounds layout
│   └── mapGenerator.ts      # Builds world + spawns entities
├── rendering/               # Canvas rendering pipeline
│   ├── isoRenderer.ts       # Isometric draw with FOV fog + depth sort
│   ├── camera.ts            # Smooth-follow camera with lerp
│   ├── spriteCache.ts       # SVG → OffscreenCanvas preloader
│   └── depthSort.ts         # Back-to-front draw ordering
├── sprites/                 # Inline SVG pixel art
│   ├── tiles.ts             # 48×24 iso tiles (grass, dirt, fence, water, etc.)
│   ├── objects.ts           # Training dummy, trees, rocks
│   ├── characters.ts        # Shinobi & Kunoichi (4 directions each)
│   └── manifest.ts          # Sprite registration for preloading
├── ui/                      # HUD components (DOM-based)
│   ├── gameHud.ts           # Right panel: bars + log + stance
│   ├── resourceBar.ts       # Pixel-art styled HP/Chakra/Will/Stamina bar
│   ├── gameLog.ts           # Scrollable RP message log
│   └── keybindingsPanel.ts  # Bottom keybinding reference (? to toggle)
├── screens/                 # Full-screen views
│   ├── landing.ts           # Main menu
│   ├── newGame.ts           # Character creation → game
│   ├── loadGame.ts          # Save management + export/import
│   ├── settings.ts          # Game settings (audio, dev mode)
│   └── game.ts              # Game screen: wires engine + rendering + UI
├── systems/                 # Singleton systems
│   ├── saveSystem.ts        # IndexedDB save/load/export/import
│   ├── screenManager.ts     # Screen navigation & transitions
│   └── inputSystem.ts       # Keyboard handler with debounce
├── components/              # Shared UI components
├── assets/                  # Fonts, menu sprites
├── styles/                  # CSS (variables, animations, game layout)
└── main.ts                  # Entry point
```

## Architecture

**Entity-Component system** — Typed `Map<EntityId, Component>` per component type on the World class. No framework, full TypeScript type safety.

**Rendering** — HTML5 Canvas with isometric projection (48×24 tiles). SVG pixel art preloaded to `OffscreenCanvas` for fast `drawImage()`. Depth-sorted back-to-front. FOV via symmetric recursive shadowcasting.

**Game loop** — Purely turn-based. `requestAnimationFrame` only handles camera interpolation and drawing. Game logic advances only on player input.

**UI** — Hybrid Canvas + DOM. Canvas for the world, DOM for the HUD (resource bars, game log, keybindings). DOM updates once per turn.

## Save System

Saves stored in **IndexedDB** (`konoha-saves`):

- Multiple save slots (up to 20)
- Auto-save every 20 turns + on screen exit
- Continue button loads last save
- **Export/Import** saves as `.json` files
- Full world state serialization (entities, map, FOV, log)

## Tech Stack

- **Vite** — Build & dev server
- **TypeScript** — Strict mode
- **Vanilla DOM + Canvas** — Zero framework dependencies
- **IndexedDB** — Persistence
- **Inline SVG Pixel Art** — Crisp at any scale

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |

## Version

Current: **0.1.0** — Training Grounds. Single source of truth in `src/core/constants.ts`.
