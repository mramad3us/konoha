# Konoha — Remaster Design (v0.5)

> Single source of truth for *what* the game is. `ARCHITECTURE.md` covers *how* it is built.

## Pitch

You are a fresh genin of the Hidden Leaf. Take missions, sneak through bandit camps,
read your opponent's stance in close combat, and climb from Genin to Jonin.
Turn-based, isometric, pixel art, fully offline, in the browser.

## Pillars

1. **Read the opponent.** Melee is a triangle of three moves. Skill shows you more of the
   enemy's intent, so getting better *feels* like getting better.
2. **Be a shinobi, not a brawler.** Stealth is a first-class path: vision cones, noise,
   takedowns, carrying bodies, Vanish.
3. **Every outing matters.** Missions pay ryo and train skills; injuries, spent kunai and
   fallen squadmates carry consequences back to the village.
4. **Respect the player's time.** Compact village, facility menus, click-to-move, time-skip
   training, quick travel animation.

## Core loop

```
Village (prepare)  ──►  Mission desk  ──►  Travel (overmap, ambushes)
     ▲                                            │
     │                                            ▼
Report, ryo, rank ◄── Return travel ◄── Mission map (stealth / combat / objective / extract)
```

## Time

- One tick = 0.1 s of game time. Every action has a duration in ticks.
- Walk 1 s · Run 0.5 s (stamina) · Sneak 2 s · Melee exchange 1 s.
- A scheduler gives each actor its next turn; nothing is simulated tick-by-tick.
- Long waits (rest, sleep, train, travel) fast-forward the scheduler.

## Character

| Attribute | Drives |
|---|---|
| **Body** | Max HP, max stamina, melee damage |
| **Chakra** | Max chakra, chakra regen |
| **Mind** | Reading opponents, spotting hidden things, resisting panic |

| Skill | Drives |
|---|---|
| **Taijutsu** | Melee damage, tempo slots, read chance |
| **Bukijutsu** | Throw accuracy, damage, throw speed |
| **Ninjutsu** | Technique unlocks, chakra efficiency, sign speed |
| **Stealth** | Detection rate, takedown speed, noise |
| **Medicine** | Bandage/first-aid speed and potency |

Values are 0–100 and grow by use with diminishing returns. Every threshold that unlocks
something (tempo slot, technique, faster throws) is shown in the character sheet.

Resources: **HP**, **Stamina**, **Chakra**. Bleeding drains HP over time. At 0 HP an
entity is knocked out; a knocked-out entity that is still bleeding dies unless bandaged.

## Ranks

| Rank | Missions | Promotion |
|---|---|---|
| Genin | D, C (after 3 D) | — |
| Chunin | up to B | 5 C-rank + Taijutsu or Ninjutsu ≥ 25 + win the trial duel |
| Jonin | up to A | 6 B-rank + Taijutsu or Ninjutsu ≥ 50 + win the trial duel |

Trials are requested from the Hokage and fought in the training-ground arena.

## Melee — the exchange

Three moves (physical keys Q/W/E — **A/Z/E** on AZERTY):

| Move | Beats | Loses to | Stamina |
|---|---|---|---|
| **Strike** (打) | Break (interrupts) | Guard | 1 |
| **Break** (崩) | Guard (stagger) | Strike | 2 |
| **Guard** (受) | Strike (parry) | Break | recovers 1 |

- Mirror matches: Strike/Strike trade half damage, Guard/Guard both recover, Break/Break clinch.
- Each enemy commits to an **intent** before the exchange, shown above its head:
  - **clear**: you see its move;
  - **partial**: you see two candidates (one move always beats one and ties the other);
  - **hidden**: `?`.
  Read chance grows with Taijutsu, Mind and tempo versus the enemy's Taijutsu.
- **Tempo** (momentum): +1 for winning an exchange, −1 for losing one. Capped by Taijutsu.
  Each point adds damage and read chance. Spending 1 tempo lets you disengage cleanly or
  fuels Kawarimi.
- **Stagger**: the staggered side loses its next exchange automatically.
- Enemies read you too: skilled foes punish a move you keep repeating.
- Several enemies at once: your move targets one of them. Guard covers every attacker, but
  Strike or Break leaves you open to the others (flanked, +25 % damage).
- Acting out of turn (moving, using items, signing) while engaged leaves you open to every
  engaged enemy's committed move.

## Stealth

- Enemies have facing, a 120° view cone and a view distance (shorter at night and in
  darkness, longer near torches).
- **Awareness** per enemy: Unaware → `?` Suspicious (turns, investigates) → `!` Alert
  (fights, shouts to allies).
- Gain depends on distance, light, your stance (Sneak ≪ Walk < Run), cover (tall grass,
  bushes) and Stealth skill. Out of sight, awareness decays.
- **Noise**: running, fighting and impacts make noise; enemies who hear it investigate.
- **Takedown**: adjacent to a non-alert enemy that is not looking at you → instant
  Subdue (knockout) or Assassinate (kill).
- Bodies found by enemies raise alerts. Carry bodies (half speed) to hide them.
- While sneaking, enemy vision cones are tinted on the ground.

## Ranged

Kunai and shuriken. Hit chance from Bukijutsu, distance, target awareness (unaware targets
are easy) and evasion. Thrown weapons drop on the tile and can be recovered.

## Ninjutsu (no new techniques in this phase)

| Technique | Use | Unlock |
|---|---|---|
| Kawarimi | Escape a melee (1 tempo + chakra) | Ninjutsu 5 |
| Chakra Dash | Fast movement stance | Ninjutsu 10 |
| Water Walking | Cross water (chakra per step) | Ninjutsu 15 |
| Vanish | Hand signs: invisibility | Ninjutsu 5 |
| Shadow Step | Hand signs: blink to a visible tile | Ninjutsu 10 |

Hand signs live on the number row (12 signs). Signing takes time and is interrupted by hits.

## Village

Compact (≈ 96×96). Districts: Gate, Main Street (shop, ramen), Hospital, Hokage Tower
(mission desk, promotions), Training Grounds (dummies, targets, arena, meditation pond),
Residential (your home: sleep, save, stash).

Buildings are solid; their door opens a **facility panel** (shop, desk, hospital, home).

## Missions

| Rank | Where | Types |
|---|---|---|
| D | Village | Delivery, Search, Patrol, Training help |
| C | Away | Bandit capture, Gang elimination, Escort, Patrol |
| B | Away | Encampment assault, Asset recovery, Infiltration |
| A | Away | Rogue pursuit, Threat response, Assassination prevention |

Away missions: depart from the gate → overmap travel (camp at night, possible ambush on a
small encounter map) → mission map (64–96 tiles, bounded by forest, entry edge is the
extraction zone) → extract → travel home → report at the desk.

Rewards: ryo, skill XP from what you did, a completion bonus, rank progress.
Failure: no pay, nothing counts toward promotion.

## Squad

From C-rank, two roster shinobi join you. Orders: **Follow / Hold**, **Engage / Defensive**.
They can be injured (unavailable for days) or killed (gone for good).

## Defeat

- Knocked out in the village or in a trial: wake in hospital.
- Knocked out on a mission: surviving squadmates drag you home, otherwise a Leaf patrol finds
  you. The mission fails, you lose some ryo, and you start injured.
- No permadeath for the player in this phase.

## Economy (deliberately small)

Ryo from missions. Shop: kunai, shuriken, bandages, soldier pills. Hospital treatment.

## Out of scope until the remaster is stable and fun

New jutsu, genjutsu, clans, equipment slots, crafting, romance, the full Chunin Exam event.
