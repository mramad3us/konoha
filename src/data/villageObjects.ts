/**
 * Village object spawns — organized by district.
 * Layer 5 (interiors) + Layer 7 (decoration).
 */

import type { World } from '../engine/world.ts';
import { TG_OFFSET_X, TG_OFFSET_Y } from '../core/constants.ts';
import { cellHash } from '../sprites/pixelPatterns.ts';
import type { ObjectCategory } from '../types/ecs.ts';

interface ObjSpawn {
  x: number; y: number;
  spriteId: string; layer: 'object' | 'character'; offsetY: number;
  blocksMove: boolean; blocksSight: boolean;
  name: string; article: 'a' | 'an' | 'the' | '';
  description: string; category: ObjectCategory;
  interactType?: 'sleep' | 'examine' | 'talk';
  interactLabel?: string; lightRadius?: number;
}

function spawn(world: World, o: ObjSpawn): void {
  const id = world.createEntity();
  world.setPosition(id, { x: o.x, y: o.y, facing: 's' });
  world.renderables.set(id, { spriteId: o.spriteId, layer: o.layer, offsetY: o.offsetY });
  world.blockings.set(id, { blocksMovement: o.blocksMove, blocksSight: o.blocksSight });
  world.names.set(id, { display: o.name, article: o.article });
  world.objectSheets.set(id, { description: o.description, category: o.category });
  if (o.interactType) world.interactables.set(id, { interactionType: o.interactType, label: o.interactLabel ?? 'Use' });
  if (o.lightRadius) world.lightSources.set(id, { radius: o.lightRadius, activeAtNight: true });
}

function torch(world: World, x: number, y: number, desc: string = 'A torch.', radius: number = 4): void {
  spawn(world, { x, y, spriteId: 'obj_torch_pillar', layer: 'object', offsetY: -20,
    blocksMove: true, blocksSight: false, name: 'torch', article: 'a',
    description: desc, category: 'object', lightRadius: radius });
}

function tree(world: World, x: number, y: number): void {
  const v = cellHash(x, y) % 3;
  const sprites = ['obj_tree_small', 'obj_tree_large', 'obj_tree_willow'];
  const offsets = [-28, -36, -32];
  spawn(world, { x, y, spriteId: sprites[v], layer: 'object', offsetY: offsets[v],
    blocksMove: true, blocksSight: true, name: 'tree', article: 'a',
    description: 'A tree growing in the village.', category: 'terrain' });
}

function bush(world: World, x: number, y: number): void {
  const v = cellHash(x, y) % 4;
  const sprites = ['obj_bush_small', 'obj_bush_berry', 'obj_bush_flower', 'obj_bush_small'];
  spawn(world, { x, y, spriteId: sprites[v], layer: 'object', offsetY: -8,
    blocksMove: false, blocksSight: false, name: 'bush', article: 'a',
    description: 'A decorative bush.', category: 'terrain' });
}

function bed(world: World, x: number, y: number): void {
  spawn(world, { x, y, spriteId: 'obj_sleeping_bag', layer: 'object', offsetY: -4,
    blocksMove: false, blocksSight: false, name: 'bed', article: 'a',
    description: 'A comfortable futon.', category: 'object',
    interactType: 'sleep', interactLabel: 'Sleep' });
}

export function spawnVillageObjects(world: World, devMode: boolean): void {
  // ══════════════════════════════
  //  LAYER 5: BUILDING INTERIORS
  // ══════════════════════════════

  // --- Hokage Tower (58-73, 72-79) ---
  torch(world, 60, 74, 'The Hokage Tower interior glows with warm light.');
  torch(world, 72, 74, 'A torch flanking the Hokage\'s seat.');
  torch(world, 60, 78, 'A torch in the lower hall.');
  torch(world, 72, 78, 'A torch in the lower hall.');
  spawn(world, { x: 65, y: 74, spriteId: 'obj_rock_small', layer: 'object', offsetY: -4,
    blocksMove: true, blocksSight: false, name: 'Hokage\'s desk', article: 'the',
    description: 'The desk where the Hokage reviews missions and signs orders. Scrolls are piled high.', category: 'object' });
  spawn(world, { x: 68, y: 74, spriteId: 'obj_rock_small', layer: 'object', offsetY: -4,
    blocksMove: true, blocksSight: false, name: 'war table', article: 'a',
    description: 'A large table with a map of the shinobi nations. Pins mark known threats.', category: 'object' });
  spawn(world, { x: 62, y: 77, spriteId: 'obj_rock_small', layer: 'object', offsetY: -4,
    blocksMove: true, blocksSight: false, name: 'scroll shelf', article: 'a',
    description: 'Village records and sealed documents dating back generations.', category: 'object' });
  spawn(world, { x: 70, y: 77, spriteId: 'obj_rock_small', layer: 'object', offsetY: -4,
    blocksMove: true, blocksSight: false, name: 'weapons rack', article: 'a',
    description: 'Ceremonial weapons displayed on the wall. Each has a story.', category: 'object' });

  // --- Mission Desk (60-71, 83-87) ---
  torch(world, 62, 85, 'The mission desk is always busy.');
  spawn(world, { x: 66, y: 84, spriteId: 'obj_rock_small', layer: 'object', offsetY: -4,
    blocksMove: true, blocksSight: false, name: 'mission counter', article: 'the',
    description: 'Stacks of mission scrolls sorted by rank: D, C, B, A, S.', category: 'object' });

  // --- Academy (58-73, 12-19) ---
  torch(world, 60, 14, 'Academy classroom torch.');
  torch(world, 72, 14, 'Academy classroom torch.');
  spawn(world, { x: 65, y: 16, spriteId: 'obj_rock_small', layer: 'object', offsetY: -4,
    blocksMove: true, blocksSight: false, name: 'instructor\'s podium', article: 'the',
    description: 'Where the sensei lectures on jutsu theory and shinobi history.', category: 'object' });

  // --- Library (78-85, 12-17) ---
  spawn(world, { x: 80, y: 14, spriteId: 'obj_rock_small', layer: 'object', offsetY: -4,
    blocksMove: true, blocksSight: false, name: 'bookshelf', article: 'a',
    description: 'Scrolls on jutsu theory, village history, and elemental chakra.', category: 'object' });
  spawn(world, { x: 83, y: 14, spriteId: 'obj_rock_small', layer: 'object', offsetY: -4,
    blocksMove: true, blocksSight: false, name: 'scroll rack', article: 'a',
    description: 'Sealed scrolls. Some are marked classified.', category: 'object' });
  torch(world, 81, 16, 'A quiet reading lamp.', 3);

  // --- Hospital (18-31, 82-91) ---
  bed(world, 22, 84); bed(world, 22, 86); bed(world, 22, 88);
  torch(world, 28, 84, 'Medical examination lamp.', 3);
  spawn(world, { x: 28, y: 88, spriteId: 'obj_rock_small', layer: 'object', offsetY: -4,
    blocksMove: true, blocksSight: false, name: 'medicine cabinet', article: 'a',
    description: 'Bandages, salves, and chakra supplements organized by type.', category: 'object' });

  // --- Market shops interiors ---
  // Weapons Shop (98-104, 72-76)
  torch(world, 100, 74, 'Blades gleam in the torchlight.', 3);
  // Supply Shop (108-114, 72-76)
  torch(world, 110, 74, 'Shelves of pouches and tools.', 3);
  // Scroll Shop (118-124, 72-76)
  torch(world, 120, 74, 'Ink and parchment scent fills the air.', 3);
  // Forge (128-135, 72-77)
  torch(world, 131, 74, 'The forge roars with heat.', 6);
  // Clothing Shop (98-104, 88-92)
  torch(world, 100, 90, 'Fabrics and armor on display.', 3);
  // Food Stall (108-114, 88-92)
  torch(world, 110, 90, 'Fresh produce arranged neatly.', 3);

  // --- Commercial strip interiors ---
  // Konoha Kitchen (62-69, 97-102)
  torch(world, 65, 99, 'The warm glow of Konoha Kitchen. Smells incredible.', 4);
  // Tea House (62-68, 105-109)
  torch(world, 64, 107, 'A calming atmosphere.', 3);
  // Inn (62-69, 112-117)
  bed(world, 64, 114);
  bed(world, 66, 114);
  torch(world, 67, 116, 'Inn room lamp.', 3);

  // --- Residential interiors (bed + lamp in each house) ---
  const westHouses = [
    [12, 104], [22, 104], [36, 104], [46, 104],
    [12, 119], [22, 119], [36, 119], [46, 119],
  ];
  for (const [hx, hy] of westHouses) {
    bed(world, hx, hy);
    torch(world, hx + 3, hy, 'A small oil lamp.', 3);
  }
  const eastHouses = [
    [100, 104], [112, 104], [126, 104],
    [100, 119], [112, 119], [126, 119],
  ];
  for (const [hx, hy] of eastHouses) {
    bed(world, hx, hy);
    torch(world, hx + 3, hy, 'A small oil lamp.', 3);
  }

  // --- Guard posts ---
  torch(world, 70, 148, 'Gate guard torch — never goes out.', 5);
  torch(world, 90, 148, 'Gate guard torch.', 5);

  // --- Clan compounds ---
  torch(world, 14, 12, 'Hyuga compound lantern.', 4);
  torch(world, 26, 12, 'Hyuga compound lantern.', 4);
  torch(world, 114, 12, 'Uchiha compound lantern.', 4);
  torch(world, 128, 12, 'Uchiha compound lantern.', 4);

  // ══════════════════════════════
  //  LAYER 7: DECORATION
  // ══════════════════════════════

  // --- Road lanterns (every 8 tiles along main avenue) ---
  for (let y = 40; y <= 145; y += 8) {
    torch(world, 74, y, 'A street lantern along the main avenue.');
  }
  // --- Road lanterns along market road ---
  for (let x = 20; x <= 140; x += 10) {
    torch(world, x, 83, 'A lantern along the market road.');
  }

  // --- Trees between districts (not inside them) ---
  const treeClusters = [
    // Between training grounds and academy
    [48, 20], [50, 22], [52, 18],
    // Between academy and clans
    [90, 10], [92, 14], [95, 12], [100, 10], [105, 14],
    // River banks
    [10, 62], [20, 61], [40, 62], [55, 61], [90, 62], [100, 61], [140, 62],
    [10, 70], [25, 71], [50, 70], [90, 71], [140, 70],
    // Between residential areas
    [55, 105], [55, 120], [55, 135],
    [90, 105], [90, 120], [90, 135],
    // Village edges (inside cliff border)
    [8, 40], [8, 50], [8, 60], [150, 40], [150, 50], [150, 60],
    [8, 100], [8, 130], [150, 100], [150, 130],
    // Near gate
    [65, 140], [95, 140],
  ];
  for (const [tx, ty] of treeClusters) tree(world, tx, ty);

  // --- Bushes along major roads ---
  for (let y = 42; y <= 140; y += 6) bush(world, 73, y);
  for (let y = 42; y <= 140; y += 6) bush(world, 79, y);

  // --- Memorial Stone ---
  spawn(world, { x: 51, y: 59, spriteId: 'obj_rock_large', layer: 'object', offsetY: -14,
    blocksMove: true, blocksSight: false, name: 'Memorial Stone', article: 'the',
    description: 'A polished monument inscribed with names of fallen shinobi. Fresh flowers rest at its base.', category: 'object' });

  // --- Council Room interior (60-67, 92-96) ---
  torch(world, 62, 93, 'Council room torch.');
  spawn(world, { x: 64, y: 93, spriteId: 'obj_rock_small', layer: 'object', offsetY: -4,
    blocksMove: true, blocksSight: false, name: 'council table', article: 'the',
    description: 'A round table where village elders debate policy and strategy.', category: 'object' });

  // --- Clinic interior (18-25, 94-98) ---
  bed(world, 20, 95);
  torch(world, 24, 96, 'Clinic examination lamp.', 3);
  spawn(world, { x: 22, y: 95, spriteId: 'obj_rock_small', layer: 'object', offsetY: -4,
    blocksMove: true, blocksSight: false, name: 'herb cabinet', article: 'an',
    description: 'Dried medicinal herbs organized by ailment. The sharp scent is therapeutic.', category: 'object' });

  // --- Shrine interior (143-148, 73-77) ---
  torch(world, 145, 75, 'A sacred flame that never goes out.', 5);
  spawn(world, { x: 147, y: 75, spriteId: 'obj_rock_medium', layer: 'object', offsetY: -8,
    blocksMove: true, blocksSight: false, name: 'offering stone', article: 'an',
    description: 'A smooth stone altar for offerings to the village spirits.', category: 'object' });

  // --- Dango Shop interior (80-86, 104-108) ---
  torch(world, 82, 106, 'Sweet shop lantern. Smells of dango and syrup.', 3);

  // --- General Store interior (80-86, 111-115) ---
  torch(world, 82, 113, 'General store lamp.', 3);
  spawn(world, { x: 84, y: 113, spriteId: 'obj_rock_small', layer: 'object', offsetY: -4,
    blocksMove: true, blocksSight: false, name: 'supply shelf', article: 'a',
    description: 'Everything a shinobi or civilian might need: rope, oil, paper, ink.', category: 'object' });

  // --- North park decorations (42-55, 8-17) ---
  tree(world, 44, 10);
  tree(world, 50, 12);
  tree(world, 48, 16);
  bush(world, 43, 14);
  bush(world, 53, 14);
  spawn(world, { x: 46, y: 15, spriteId: 'obj_sleeping_bag', layer: 'object', offsetY: -4,
    blocksMove: false, blocksSight: false, name: 'park bench', article: 'a',
    description: 'A stone bench under the trees. A nice spot to rest.', category: 'object' });

  // --- South park decorations (55-74, 130-139) ---
  tree(world, 58, 131);
  tree(world, 65, 135);
  tree(world, 72, 132);
  tree(world, 68, 138);
  bush(world, 56, 134);
  bush(world, 73, 134);
  spawn(world, { x: 63, y: 136, spriteId: 'obj_sleeping_bag', layer: 'object', offsetY: -4,
    blocksMove: false, blocksSight: false, name: 'park bench', article: 'a',
    description: 'A bench overlooking the small pond. Peaceful.', category: 'object' });

  // --- Farm plots decorations (6-13, 100-126) ---
  spawn(world, { x: 8, y: 105, spriteId: 'obj_rock_small', layer: 'object', offsetY: -4,
    blocksMove: true, blocksSight: false, name: 'scarecrow', article: 'a',
    description: 'A scarecrow dressed in old shinobi gear. Effective, in a creepy sort of way.', category: 'object' });
  spawn(world, { x: 10, y: 120, spriteId: 'obj_rock_small', layer: 'object', offsetY: -4,
    blocksMove: true, blocksSight: false, name: 'water barrel', article: 'a',
    description: 'A barrel collecting rainwater for the farm plots.', category: 'object' });

  // --- Market plaza open area decorations ---
  spawn(world, { x: 110, y: 79, spriteId: 'obj_rock_small', layer: 'object', offsetY: -4,
    blocksMove: true, blocksSight: false, name: 'market well', article: 'the',
    description: 'A stone well in the center of the market. Fresh water for all.', category: 'object' });
  spawn(world, { x: 120, y: 79, spriteId: 'obj_sleeping_bag', layer: 'object', offsetY: -4,
    blocksMove: false, blocksSight: false, name: 'market bench', article: 'a',
    description: 'A bench for tired shoppers.', category: 'object' });

  // --- Well plaza at crossroads (73-79, 78-82) ---
  spawn(world, { x: 76, y: 79, spriteId: 'obj_rock_medium', layer: 'object', offsetY: -8,
    blocksMove: true, blocksSight: false, name: 'village well', article: 'the',
    description: 'The main village well. A gathering point for gossip and news.', category: 'object' });

  // --- Rocks near river ---
  spawn(world, { x: 50, y: 63, spriteId: 'obj_rock_medium', layer: 'object', offsetY: -8, blocksMove: true, blocksSight: false, name: 'river stone', article: 'a', description: 'A smooth stone by the water.', category: 'terrain' });
  spawn(world, { x: 110, y: 63, spriteId: 'obj_rock_mossy', layer: 'object', offsetY: -10, blocksMove: true, blocksSight: false, name: 'mossy rock', article: 'a', description: 'A mossy stone.', category: 'terrain' });

  // --- Training Grounds objects ---
  spawnTrainingGroundsObjects(world, devMode);

  // --- Sleeping bag near training grounds ---
  spawn(world, { x: TG_OFFSET_X + 21, y: TG_OFFSET_Y + 36, spriteId: 'obj_sleeping_bag', layer: 'object', offsetY: -4,
    blocksMove: false, blocksSight: false, name: 'sleeping bag', article: 'a',
    description: 'A well-worn bedroll for training rest.', category: 'object',
    interactType: 'sleep', interactLabel: 'Sleep' });
}

function spawnTrainingGroundsObjects(world: World, _devMode: boolean): void {
  const ox = TG_OFFSET_X;
  const oy = TG_OFFSET_Y;

  // Training dummies
  for (const [dx, dy] of [[14,20],[14,24],[20,17],[26,20],[26,24],[20,27],[16,22],[24,22]]) {
    const id = world.createEntity();
    world.setPosition(id, { x: ox + dx, y: oy + dy, facing: 's' });
    world.renderables.set(id, { spriteId: 'obj_dummy', layer: 'object', offsetY: -20 });
    world.blockings.set(id, { blocksMovement: true, blocksSight: false });
    world.names.set(id, { display: 'training dummy', article: 'a' });
    world.objectSheets.set(id, { description: 'A training dummy made of wood and straw.', category: 'object' });
    world.combatStats.set(id, { damage: 0, accuracy: 0, evasion: 0, attackVerb: '' });
    world.characterSheets.set(id, {
      class: 'civilian', rank: 'academy_student', title: 'Training Equipment',
      skills: { taijutsu: 10, bukijutsu: 0, ninjutsu: 0, genjutsu: 0, med: 0 },
      stats: { phy: 10, cha: 0, men: 0, soc: 0 }, learnedJutsus: [],
    });
    world.destructibles.set(id, { onDestroyMessage: 'The training dummy splinters apart!', respawnTicks: 50 });
    world.aiControlled.set(id, { behavior: 'static' });
  }

  // Training grounds trees
  for (const [dx, dy, s] of [
    [3,2,'obj_tree_large'],[5,3,'obj_tree_small'],[2,5,'obj_tree_willow'],
    [6,5,'obj_tree_large'],[4,7,'obj_tree_small'],[3,32,'obj_tree_large'],
    [5,34,'obj_tree_willow'],[2,36,'obj_tree_large'],[7,33,'obj_tree_small'],
    [33,32,'obj_tree_large'],[35,34,'obj_tree_small'],[37,33,'obj_tree_large'],
    [34,36,'obj_tree_willow'],[35,3,'obj_tree_willow'],[37,5,'obj_tree_small'],
    [35,10,'obj_tree_large'],[37,15,'obj_tree_small'],
  ] as [number, number, string][]) {
    const off = s.includes('large') ? -36 : s.includes('willow') ? -32 : -28;
    spawn(world, { x: ox+dx, y: oy+dy, spriteId: s, layer: 'object', offsetY: off,
      blocksMove: true, blocksSight: true, name: 'tree', article: 'a',
      description: 'A tree in the training grounds.', category: 'terrain' });
  }

  // Training grounds torches
  for (const [dx, dy] of [[5,1],[20,1],[35,1],[1,15],[38,15],[1,30],[38,30],[18,38],[22,38]]) {
    torch(world, ox+dx, oy+dy, 'Training grounds torch pillar.', 5);
  }
}
