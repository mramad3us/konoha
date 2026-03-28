# Konoha — Path of the Shinobi

A Naruto-inspired, zone-based, top-down isometric pixel art browser game. Fully offline, runs in any modern browser.

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

## Project Structure

```
src/
├── core/           # Constants, config — single sources of truth
│   └── constants.ts
├── types/          # TypeScript type definitions
│   ├── save.ts     # Save file & settings types
│   └── screens.ts  # Screen navigation types
├── utils/          # Pure utility functions
│   ├── dom.ts      # DOM creation helpers
│   ├── id.ts       # ID generation
│   └── time.ts     # Time/date formatting
├── systems/        # Singleton game systems
│   ├── saveSystem.ts    # IndexedDB save/load/export/import
│   └── screenManager.ts # Screen navigation & transitions
├── components/     # Reusable UI components
│   ├── confirmDialog.ts # Modal confirmation dialog
│   └── smokeEffect.ts   # Smoke particle VFX
├── assets/
│   └── sprites/
│       └── pixelArt.ts  # All pixel art as inline SVGs
├── screens/        # Full-screen views
│   ├── landing.ts  # Main menu
│   ├── newGame.ts  # Character creation
│   ├── loadGame.ts # Save management
│   └── settings.ts # Game settings
├── styles/         # CSS (variables, reset, typography, animations, components)
└── main.ts         # Entry point — boots systems, registers screens
```

## Save System

Saves are stored in **IndexedDB** (`konoha-saves` database). Features:

- Multiple save slots (up to 20)
- Auto-tracks last save for "Continue" button
- **Export**: Download all saves as a `.json` file
- **Import**: Load saves from a `.json` file
- Settings persisted separately in IndexedDB

## Tech Stack

- **Vite** — Build tool & dev server
- **TypeScript** — Strict mode enabled
- **Vanilla DOM** — No framework dependencies
- **IndexedDB** — Save persistence
- **CSS Animations** — Screen transitions, stagger reveals, particle effects
- **Inline SVG Pixel Art** — Crisp at any scale via `image-rendering: pixelated`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |

## Version

Current: **0.1.0** — Displayed on the landing page. Single source of truth in `src/core/constants.ts`.
