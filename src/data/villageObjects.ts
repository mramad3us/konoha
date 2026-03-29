/**
 * Village object spawns — trees, benches, lanterns, signs, etc.
 * Placed per district for a lived-in feel.
 */

import type { World } from '../engine/world.ts';
import { TG_OFFSET_X, TG_OFFSET_Y } from '../core/constants.ts';
import { cellHash } from '../sprites/pixelPatterns.ts';

interface ObjSpawn {
  x: number;
  y: number;
  spriteId: string;
  layer: 'object' | 'character';
  offsetY: number;
  blocksMove: boolean;
  blocksSight: boolean;
  name: string;
  article: 'a' | 'an' | 'the' | '';
  description: string;
  category: import('../types/ecs.ts').ObjectCategory;
  interactType?: 'sleep' | 'examine' | 'talk';
  interactLabel?: string;
  lightRadius?: number;
}

function spawn(world: World, o: ObjSpawn): void {
  const id = world.createEntity();
  world.setPosition(id, { x: o.x, y: o.y, facing: 's' });
  world.renderables.set(id, { spriteId: o.spriteId, layer: o.layer, offsetY: o.offsetY });
  world.blockings.set(id, { blocksMovement: o.blocksMove, blocksSight: o.blocksSight });
  world.names.set(id, { display: o.name, article: o.article });
  world.objectSheets.set(id, { description: o.description, category: o.category });
  if (o.interactType) {
    world.interactables.set(id, { interactionType: o.interactType, label: o.interactLabel ?? 'Use' });
  }
  if (o.lightRadius) {
    world.lightSources.set(id, { radius: o.lightRadius, activeAtNight: true });
  }
}

export function spawnVillageObjects(world: World, devMode: boolean): void {
  // ── Training Grounds objects (offset from existing data) ──
  // Re-use the training grounds spawn logic but offset by TG_OFFSET
  spawnTrainingGroundsObjects(world, devMode);

  // ── Road lanterns (along main N-S road) ──
  for (let y = 15; y < 145; y += 8) {
    spawn(world, {
      x: 77, y, spriteId: 'obj_torch_pillar', layer: 'object', offsetY: -20,
      blocksMove: true, blocksSight: false, name: 'lantern', article: 'a',
      description: 'A stone lantern lining the main road. It glows warmly at night.',
      category: 'object', lightRadius: 4,
    });
  }

  // ── Road lanterns (along E-W road) ──
  for (let x = 10; x < 150; x += 10) {
    spawn(world, {
      x, y: 75, spriteId: 'obj_torch_pillar', layer: 'object', offsetY: -20,
      blocksMove: true, blocksSight: false, name: 'lantern', article: 'a',
      description: 'A lantern illuminating the east-west road.',
      category: 'object', lightRadius: 4,
    });
  }

  // ── Village trees (scattered) ──
  const treePositions = [
    { x: 55, y: 30 }, { x: 60, y: 35 }, { x: 95, y: 25 }, { x: 130, y: 30 },
    { x: 15, y: 65 }, { x: 145, y: 65 }, { x: 55, y: 100 }, { x: 130, y: 110 },
    { x: 62, y: 80 }, { x: 95, y: 130 }, { x: 50, y: 140 }, { x: 140, y: 140 },
    { x: 10, y: 100 }, { x: 150, y: 100 }, { x: 88, y: 40 }, { x: 100, y: 30 },
    { x: 20, y: 80 }, { x: 48, y: 95 },
  ];
  for (const pos of treePositions) {
    const variant = cellHash(pos.x, pos.y) % 3;
    const sprites = ['obj_tree_small', 'obj_tree_large', 'obj_tree_willow'];
    const names = ['tree', 'large tree', 'willow tree'];
    const offsets = [-28, -36, -32];
    spawn(world, {
      x: pos.x, y: pos.y, spriteId: sprites[variant], layer: 'object', offsetY: offsets[variant],
      blocksMove: true, blocksSight: true, name: names[variant], article: 'a',
      description: 'A tree growing in the village. Its shade offers respite from the sun.',
      category: 'terrain',
    });
  }

  // ── Memorial stone ──
  spawn(world, {
    x: 52, y: 33, spriteId: 'obj_rock_large', layer: 'object', offsetY: -14,
    blocksMove: true, blocksSight: false, name: 'Memorial Stone', article: 'the',
    description: 'A polished stone monument inscribed with the names of shinobi who gave their lives for the village. Fresh flowers rest at its base.',
    category: 'object',
  });

  // ── Sleeping bag near training grounds ──
  spawn(world, {
    x: TG_OFFSET_X + 21, y: TG_OFFSET_Y + 36, spriteId: 'obj_sleeping_bag', layer: 'object', offsetY: -4,
    blocksMove: false, blocksSight: false, name: 'sleeping bag', article: 'a',
    description: 'A well-worn bedroll. It looks warm enough for a few hours of rest.',
    category: 'object', interactType: 'sleep', interactLabel: 'Sleep',
  });

  // ── Gate area decorations ──
  spawn(world, {
    x: 75, y: 146, spriteId: 'obj_torch_pillar', layer: 'object', offsetY: -20,
    blocksMove: true, blocksSight: false, name: 'gate torch', article: 'a',
    description: 'A tall torch flanking the village gate. Its flame never goes out.',
    category: 'object', lightRadius: 5,
  });
  spawn(world, {
    x: 86, y: 146, spriteId: 'obj_torch_pillar', layer: 'object', offsetY: -20,
    blocksMove: true, blocksSight: false, name: 'gate torch', article: 'a',
    description: 'A tall torch flanking the village gate.',
    category: 'object', lightRadius: 5,
  });

  // ── Bushes along roads ──
  const bushPositions = [
    { x: 76, y: 20 }, { x: 82, y: 25 }, { x: 76, y: 35 },
    { x: 82, y: 45 }, { x: 76, y: 55 }, { x: 82, y: 65 },
    { x: 76, y: 100 }, { x: 82, y: 110 }, { x: 76, y: 120 },
    { x: 82, y: 130 }, { x: 65, y: 77 }, { x: 90, y: 77 },
  ];
  for (const pos of bushPositions) {
    const variant = cellHash(pos.x, pos.y) % 4;
    const sprites = ['obj_bush_small', 'obj_bush_berry', 'obj_bush_flower', 'obj_bush_small'];
    spawn(world, {
      x: pos.x, y: pos.y, spriteId: sprites[variant], layer: 'object',
      offsetY: -8, blocksMove: false, blocksSight: false,
      name: 'bush', article: 'a',
      description: 'A decorative bush lining the road.',
      category: 'terrain',
    });
  }

  // ── Rocks near river ──
  spawn(world, { x: 50, y: 67, spriteId: 'obj_rock_medium', layer: 'object', offsetY: -8, blocksMove: true, blocksSight: false, name: 'rock', article: 'a', description: 'A river stone.', category: 'terrain' });
  spawn(world, { x: 110, y: 67, spriteId: 'obj_rock_mossy', layer: 'object', offsetY: -10, blocksMove: true, blocksSight: false, name: 'mossy rock', article: 'a', description: 'A mossy stone by the water.', category: 'terrain' });
}

/** Spawn training grounds objects at the village offset */
function spawnTrainingGroundsObjects(world: World, _devMode: boolean): void {
  const ox = TG_OFFSET_X;
  const oy = TG_OFFSET_Y;

  // Import spawn data from original mapGenerator pattern
  // Training dummies
  const dummyPositions = [
    { x: 14, y: 20 }, { x: 14, y: 24 }, { x: 20, y: 17 },
    { x: 26, y: 20 }, { x: 26, y: 24 }, { x: 20, y: 27 },
    { x: 16, y: 22 }, { x: 24, y: 22 },
  ];
  for (const pos of dummyPositions) {
    const id = world.createEntity();
    world.setPosition(id, { x: ox + pos.x, y: oy + pos.y, facing: 's' });
    world.renderables.set(id, { spriteId: 'obj_dummy', layer: 'object', offsetY: -20 });
    world.blockings.set(id, { blocksMovement: true, blocksSight: false });
    world.names.set(id, { display: 'training dummy', article: 'a' });
    world.objectSheets.set(id, {
      description: 'A training dummy made of wood and straw.',
      category: 'object',
    });
    world.combatStats.set(id, { damage: 0, accuracy: 0, evasion: 0, attackVerb: '' });
    world.characterSheets.set(id, {
      class: 'civilian', rank: 'academy_student', title: 'Training Equipment',
      skills: { taijutsu: 10, bukijutsu: 0, ninjutsu: 0, genjutsu: 0, med: 0 },
      stats: { phy: 10, cha: 0, men: 0, soc: 0 },
      learnedJutsus: [],
    });
    world.destructibles.set(id, { onDestroyMessage: 'The training dummy splinters apart!', respawnTicks: 50 });
    world.aiControlled.set(id, { behavior: 'static' });
  }

  // Training grounds trees
  const tgTrees = [
    { x: 3, y: 2, s: 'obj_tree_large' }, { x: 5, y: 3, s: 'obj_tree_small' },
    { x: 2, y: 5, s: 'obj_tree_willow' }, { x: 6, y: 5, s: 'obj_tree_large' },
    { x: 4, y: 7, s: 'obj_tree_small' }, { x: 3, y: 32, s: 'obj_tree_large' },
    { x: 5, y: 34, s: 'obj_tree_willow' }, { x: 2, y: 36, s: 'obj_tree_large' },
    { x: 7, y: 33, s: 'obj_tree_small' }, { x: 33, y: 32, s: 'obj_tree_large' },
    { x: 35, y: 34, s: 'obj_tree_small' }, { x: 37, y: 33, s: 'obj_tree_large' },
    { x: 34, y: 36, s: 'obj_tree_willow' }, { x: 35, y: 3, s: 'obj_tree_willow' },
    { x: 37, y: 5, s: 'obj_tree_small' }, { x: 35, y: 10, s: 'obj_tree_large' },
    { x: 37, y: 15, s: 'obj_tree_small' },
  ];
  for (const t of tgTrees) {
    spawn(world, {
      x: ox + t.x, y: oy + t.y, spriteId: t.s, layer: 'object',
      offsetY: t.s.includes('large') ? -36 : t.s.includes('willow') ? -32 : -28,
      blocksMove: true, blocksSight: true, name: 'tree', article: 'a',
      description: 'A tree in the training grounds.', category: 'terrain',
    });
  }

  // Torch pillars around training grounds
  const tgTorches = [
    { x: 5, y: 1 }, { x: 20, y: 1 }, { x: 35, y: 1 },
    { x: 1, y: 15 }, { x: 38, y: 15 }, { x: 1, y: 30 },
    { x: 38, y: 30 }, { x: 18, y: 38 }, { x: 22, y: 38 },
  ];
  for (const t of tgTorches) {
    spawn(world, {
      x: ox + t.x, y: oy + t.y, spriteId: 'obj_torch_pillar', layer: 'object', offsetY: -20,
      blocksMove: true, blocksSight: false, name: 'torch pillar', article: 'a',
      description: 'A torch pillar lighting the training grounds.',
      category: 'object', lightRadius: 5,
    });
  }
}
