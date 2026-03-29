/**
 * Village object spawns — organized by district.
 * Layer 5 (interiors) + Layer 7 (decoration).
 *
 * Every multi-room building has room-appropriate furniture.
 * Every house has a bedroom with a bed.
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
  interactType?: 'sleep' | 'examine' | 'talk' | 'mission_board' | 'meditate';
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
  spawn(world, { x, y, spriteId: sprites[v], layer: 'object', offsetY: -18,
    blocksMove: false, blocksSight: false, name: 'bush', article: 'a',
    description: 'A decorative bush.', category: 'terrain' });
}

function bed(world: World, x: number, y: number): void {
  spawn(world, { x, y, spriteId: 'obj_sleeping_bag', layer: 'object', offsetY: -14,
    blocksMove: false, blocksSight: false, name: 'bed', article: 'a',
    description: 'A comfortable futon.', category: 'object',
    interactType: 'sleep', interactLabel: 'Sleep' });
}

/** A bed that belongs to someone — can't sleep in it */
function ownedBed(world: World, x: number, y: number): void {
  spawn(world, { x, y, spriteId: 'obj_sleeping_bag', layer: 'object', offsetY: -14,
    blocksMove: false, blocksSight: false, name: 'bed', article: 'a',
    description: 'Someone\'s futon. You can\'t just sleep in a stranger\'s bed.', category: 'object' });
}

/** Meditation carpet — functional, improves ninjutsu + chakra */
function meditationCarpet(world: World, x: number, y: number): void {
  spawn(world, { x, y, spriteId: 'obj_sleeping_bag', layer: 'object', offsetY: -14,
    blocksMove: false, blocksSight: false, name: 'meditation carpet', article: 'a',
    description: 'A woven mat for chakra meditation. Sit and focus your energy.',
    category: 'object', interactType: 'meditate', interactLabel: 'Meditate' });
}

function desk(world: World, x: number, y: number, name: string, desc: string): void {
  spawn(world, { x, y, spriteId: 'obj_desk', layer: 'object', offsetY: -17,
    blocksMove: true, blocksSight: false, name, article: 'a',
    description: desc, category: 'object' });
}

function shelf(world: World, x: number, y: number, name: string, desc: string): void {
  spawn(world, { x, y, spriteId: 'obj_shelf', layer: 'object', offsetY: -20,
    blocksMove: true, blocksSight: false, name, article: 'a',
    description: desc, category: 'object' });
}

function counter(world: World, x: number, y: number, name: string, desc: string): void {
  spawn(world, { x, y, spriteId: 'obj_counter', layer: 'object', offsetY: -15,
    blocksMove: true, blocksSight: false, name, article: 'a',
    description: desc, category: 'object' });
}

function weaponsRack(world: World, x: number, y: number, name: string, desc: string): void {
  spawn(world, { x, y, spriteId: 'obj_weapons_rack', layer: 'object', offsetY: -20,
    blocksMove: true, blocksSight: false, name, article: 'a',
    description: desc, category: 'object' });
}

function medicineCabinet(world: World, x: number, y: number, name: string, desc: string): void {
  spawn(world, { x, y, spriteId: 'obj_medicine_cabinet', layer: 'object', offsetY: -20,
    blocksMove: true, blocksSight: false, name, article: 'a',
    description: desc, category: 'object' });
}

function barrel(world: World, x: number, y: number, name: string, desc: string): void {
  spawn(world, { x, y, spriteId: 'obj_barrel', layer: 'object', offsetY: -18,
    blocksMove: true, blocksSight: false, name, article: 'a',
    description: desc, category: 'object' });
}

function bench(world: World, x: number, y: number, name: string, desc: string): void {
  spawn(world, { x, y, spriteId: 'obj_bench', layer: 'object', offsetY: -18,
    blocksMove: false, blocksSight: false, name, article: 'a',
    description: desc, category: 'object' });
}

/** Spawn a door entity at a position */
export function spawnDoor(world: World, x: number, y: number): void {
  const id = world.createEntity();
  world.setPosition(id, { x, y, facing: 's' });
  world.renderables.set(id, { spriteId: 'obj_door_closed', layer: 'object', offsetY: -12 });
  world.blockings.set(id, { blocksMovement: true, blocksSight: true });
  world.names.set(id, { display: 'door', article: 'a' });
  world.objectSheets.set(id, { description: 'A wooden door. Press F to open or close.', category: 'object' });
  world.interactables.set(id, { interactionType: 'door', label: 'Open' });
  world.doors.set(id, { isOpen: false });
}

export function spawnVillageObjects(world: World, devMode: boolean): void {
  // ══════════════════════════════════════════
  //  LAYER 5: BUILDING INTERIORS
  //  Every room gets purpose-appropriate furniture
  // ══════════════════════════════════════════

  // ─── GOVERNMENT QUARTER ───────────────────

  // Hokage Tower (55,72 20×12) — single open hall: x=56-73, y=73-82
  torch(world, 57, 73, 'The Hokage Tower interior glows with warm light.');
  torch(world, 73, 73, 'A torch flanking the Hokage\'s seat.');
  desk(world, 64, 73, 'Hokage\'s desk', 'The desk where the Hokage reviews missions and signs orders. Scrolls are piled high.');
  desk(world, 68, 74, 'war table', 'A large table with a map of the shinobi nations. Pins mark known threats.');
  shelf(world, 57, 77, 'scroll shelf', 'Village records and sealed documents dating back generations.');
  weaponsRack(world, 73, 77, 'weapons rack', 'Ceremonial weapons displayed on the wall. Each has a story.');
  shelf(world, 60, 80, 'archive shelf', 'Historical records of every mission the village has undertaken.');
  shelf(world, 69, 80, 'sealed shelf', 'Classified documents. Several bear the Hokage\'s personal seal.');
  desk(world, 63, 81, 'meeting table', 'A table strewn with reports from various shinobi squads.');
  barrel(world, 72, 81, 'ink barrel', 'A barrel of ink for official documents. The village seal sits beside it.');

  // Mission Desk (58,86 14×7) — wall: h@89(door@64)
  // Counter Area (front): x=59-70, y=87-88
  torch(world, 60, 87, 'The mission desk is always busy.');
  counter(world, 64, 87, 'mission counter', 'Stacks of mission scrolls sorted by rank: D, C, B, A, S.');
  // Mission board — interactable
  spawn(world, { x: 67, y: 87, spriteId: 'obj_shelf', layer: 'object', offsetY: -20,
    blocksMove: true, blocksSight: false, name: 'Mission Board', article: 'the',
    description: 'A board showing current mission postings and team assignments. Press F to browse missions.',
    category: 'object', interactType: 'mission_board', interactLabel: 'Pick Mission' });
  // Back Office: x=59-70, y=90-91
  desk(world, 62, 91, 'filing desk', 'Where completed mission reports are reviewed and archived.');
  shelf(world, 68, 91, 'record shelf', 'Binders of mission completion records sorted by year.');

  // Council Chamber (55,93 10×6) — single room: x=56-63, y=94-97
  torch(world, 57, 94, 'Council room torch.');
  desk(world, 59, 95, 'council table', 'A round table where village elders debate policy and strategy.');
  shelf(world, 62, 97, 'law shelf', 'Village bylaws and treaties with allied nations.');

  // ─── ACADEMY DISTRICT ─────────────────────

  // Academy (56,10 20×10) — walls: v@66(11-15,door@13), h@16(57-74,door@62)
  // Classroom (top-left): x=57-65, y=11-15
  torch(world, 58, 11, 'Academy classroom torch.');
  desk(world, 61, 12, 'instructor\'s podium', 'Where the sensei lectures on jutsu theory and shinobi history.');
  desk(world, 59, 14, 'student desk', 'A small desk covered in practice notes and ink smudges.');
  desk(world, 63, 14, 'student desk', 'Carved initials from generations of academy students.');
  // Practice Hall (top-right): x=67-74, y=11-15
  torch(world, 73, 11, 'Practice hall torch.');
  weaponsRack(world, 70, 12, 'practice weapons', 'Blunted kunai and padded shuriken for training.');
  spawn(world, { x: 72, y: 14, spriteId: 'obj_dummy', layer: 'object', offsetY: -20,
    blocksMove: true, blocksSight: false, name: 'practice dummy', article: 'a',
    description: 'A wooden dummy for taijutsu practice. Well-worn from use.', category: 'object' });
  // Bottom corridor: x=57-74, y=17-18
  shelf(world, 60, 18, 'supply closet', 'Extra chalk, paper, and practice equipment.');
  barrel(world, 72, 18, 'water barrel', 'Fresh water for thirsty students.');

  // Library (78,10 10×8) — wall: h@14(door@83)
  // Reading Room: x=79-86, y=11-13
  shelf(world, 80, 11, 'bookshelf', 'Scrolls on jutsu theory, village history, and elemental chakra.');
  shelf(world, 83, 11, 'bookshelf', 'Texts on geography, mathematics, and the shinobi code.');
  torch(world, 86, 12, 'A quiet reading lamp.', 3);
  desk(world, 81, 13, 'reading desk', 'A shared desk with inkwells and blank scrolls for notes.');
  // Restricted Section: x=79-86, y=15-16
  shelf(world, 80, 15, 'sealed scrolls', 'Sealed scrolls. Some are marked classified.');
  shelf(world, 84, 15, 'rare texts', 'Ancient scrolls too fragile to handle without permission.');

  // Instructor Office (56,32 8×6) — single room: x=57-62, y=33-36
  torch(world, 58, 33, 'Instructor\'s oil lamp.', 3);
  desk(world, 60, 34, 'instructor desk', 'Grade books, attendance rolls, and a half-eaten bento.');
  shelf(world, 62, 36, 'curriculum shelf', 'Lesson plans for the semester. Notes in the margins.');

  // ─── COMMERCIAL STRIP ─────────────────────

  // Konoha Kitchen (62,97 10×8) — wall: v@67(98-103,door@100)
  // Dining (left): x=63-66, y=98-103
  torch(world, 64, 98, 'The warm glow of Konoha Kitchen. Smells incredible.', 4);
  counter(world, 66, 99, 'dining counter', 'A polished counter with steaming bowls of ramen.');
  bench(world, 64, 102, 'stool', 'A worn stool at the counter. Regulars have favorites.');
  // Kitchen (right): x=68-70, y=98-103
  barrel(world, 70, 99, 'broth barrel', 'A barrel of simmering broth. The secret recipe is inside.');
  shelf(world, 70, 102, 'spice rack', 'Dried herbs, chili flakes, and miso paste.');

  // Tea House (62,107 9×6) — wall: v@67(108-111,door@109)
  // Seating (left): x=63-66, y=108-111
  torch(world, 64, 108, 'A calming atmosphere.', 3);
  bench(world, 65, 110, 'cushion seat', 'A comfortable floor cushion for tea service.');
  desk(world, 63, 111, 'tea table', 'A low table set with ceramic cups and a pot of green tea.');
  // Prep room (right): x=68-69, y=108-111
  shelf(world, 69, 109, 'tea shelf', 'Varieties of tea: green, jasmine, barley, and medicinal blends.');
  barrel(world, 69, 111, 'water cistern', 'Filtered water kept at the perfect temperature for brewing.');

  // Inn (60,115 12×10) — walls: h@119(door@64), v@66(116-118,door@117)
  // Room 1 (top-left): x=61-65, y=116-118
  bed(world, 62, 117);
  torch(world, 64, 116, 'A quiet lamp by the bedside.', 3);
  shelf(world, 62, 116, 'nightstand', 'A small table with a water jug and a folded towel.');
  // Room 2 (top-right): x=67-70, y=116-118
  bed(world, 69, 117);
  torch(world, 68, 116, 'A quiet lamp by the bedside.', 3);
  shelf(world, 70, 118, 'nightstand', 'Clean linens stacked neatly. The inn is well-kept.');
  // Lobby (bottom): x=61-70, y=120-123
  torch(world, 62, 120, 'A warm lobby lantern.', 4);
  counter(world, 64, 120, 'front desk', 'The innkeeper\'s desk. A guest ledger sits open, ink still wet.');
  bench(world, 69, 120, 'lobby bench', 'A bench for travelers waiting to check in.');
  shelf(world, 62, 123, 'luggage shelf', 'A shelf holding a few forgotten bags and parcels.');
  bench(world, 69, 123, 'waiting seat', 'A comfortable spot near the door. A pot of tea stays warm.');

  // Barbershop (80,97 8×6) — single room: x=81-86, y=98-101
  torch(world, 82, 98, 'Barbershop lamp.', 3);
  counter(world, 84, 99, 'barber counter', 'Scissors, combs, and a mirror polished to a shine.');
  bench(world, 82, 101, 'barber chair', 'A chair facing the mirror. Hair clippings on the floor.');

  // Dango Shop (80,105 8×6) — single room: x=81-86, y=106-109
  torch(world, 82, 106, 'Sweet shop lantern. Smells of dango and syrup.', 3);
  counter(world, 84, 107, 'dango counter', 'Skewers of dango in three colors. Freshly grilled.');
  bench(world, 86, 109, 'stool', 'A stool sticky with sweet sauce from happy customers.');

  // General Store (80,113 10×7) — wall: v@85(114-118,door@116)
  // Front Shop (left): x=81-84, y=114-118
  torch(world, 82, 114, 'General store lamp.', 3);
  counter(world, 83, 115, 'shop counter', 'A counter with a cash box and wrapping paper.');
  shelf(world, 82, 118, 'supply shelf', 'Everything a shinobi or civilian might need: rope, oil, paper, ink.');
  // Back Storage (right): x=86-88, y=114-118
  barrel(world, 87, 115, 'storage barrel', 'Bulk supplies waiting to be shelved.');
  shelf(world, 87, 118, 'overflow shelf', 'Extra inventory stacked to the ceiling.');

  // ─── MARKET PLAZA ─────────────────────────

  // Weapons Shop (98,72 9×7) — wall: h@75(door@102)
  // Showroom: x=99-105, y=73-74
  torch(world, 100, 73, 'Blades gleam in the torchlight.', 3);
  weaponsRack(world, 103, 73, 'display rack', 'Kunai, shuriken, and tanto arranged by quality.');
  counter(world, 105, 74, 'sales counter', 'A counter with price tags and a sharpening stone.');
  // Back Room: x=99-105, y=76-77
  weaponsRack(world, 100, 77, 'reserve stock', 'Bulk weapons waiting to be displayed. Some are custom orders.');
  barrel(world, 104, 77, 'oil barrel', 'Weapon oil for maintenance. Keeps blades from rusting.');

  // Supply Shop (109,72 9×7) — wall: h@75(door@113)
  // Front: x=110-116, y=73-74
  torch(world, 111, 73, 'Shelves of pouches and tools.', 3);
  counter(world, 114, 74, 'supply counter', 'Wire, explosive tags, and smoke bombs behind glass.');
  shelf(world, 111, 74, 'display shelf', 'Pouches, holsters, and bandoliers in various sizes.');
  // Back: x=110-116, y=76-77
  barrel(world, 112, 77, 'stock barrel', 'Surplus supplies packed tight.');
  shelf(world, 115, 77, 'overflow stock', 'Boxes of caltrops, wire spools, and flash paper.');

  // Scroll Shop (120,72 9×7) — wall: h@75(door@124)
  // Front: x=121-127, y=73-74
  torch(world, 122, 73, 'Ink and parchment scent fills the air.', 3);
  shelf(world, 125, 73, 'scroll display', 'Blank scrolls and sealing ink for sale.');
  counter(world, 127, 74, 'shop counter', 'A magnifying lens and reference guides for scroll identification.');
  // Back: x=121-127, y=76-77
  shelf(world, 122, 77, 'rare scrolls', 'Scrolls from distant lands. Expensive but powerful.');
  desk(world, 126, 77, 'calligraphy desk', 'Where custom sealing scrolls are prepared to order.');

  // Forge (131,72 10×8) — wall: h@76(door@135)
  // Front Shop: x=132-139, y=73-75
  torch(world, 133, 73, 'Heat radiates from the back room.', 3);
  counter(world, 136, 74, 'forge counter', 'Custom weapon orders and repair tickets pinned to a board.');
  weaponsRack(world, 139, 73, 'finished weapons', 'Freshly forged blades cooling on the rack.');
  // Back Forge: x=132-139, y=77-78
  torch(world, 134, 77, 'The forge roars with heat.', 6);
  barrel(world, 138, 78, 'quench barrel', 'Water for quenching hot metal. Steam rises constantly.');

  // Clothing Shop (98,88 9×6) — single room: x=99-105, y=89-92
  torch(world, 100, 89, 'Fabrics and armor on display.', 3);
  shelf(world, 103, 90, 'fabric shelf', 'Bolts of cloth in navy, forest green, and black.');
  counter(world, 100, 92, 'fitting counter', 'Measuring tape and pins for custom tailoring.');

  // Food Stall (109,88 8×5) — single room: x=110-115, y=89-91
  torch(world, 111, 89, 'Fresh produce arranged neatly.', 3);
  counter(world, 113, 90, 'produce stand', 'Seasonal vegetables and rice from local farms.');
  barrel(world, 115, 91, 'pickle barrel', 'Pickled radish and fermented cabbage. Pungent but popular.');

  // ─── HOSPITAL ─────────────────────────────

  // Hospital (15,82 18×12) — walls: v@24(door@86), h@88(16-23,door@19), h@88(25-31,door@28)
  // Ward 1 (top-left): x=16-23, y=83-87
  bed(world, 17, 84);
  bed(world, 17, 86);
  torch(world, 22, 83, 'Ward light. Patients rest here.', 3);
  medicineCabinet(world, 22, 87, 'bedside supplies', 'Bandages and pain relief within arm\'s reach.');
  // Ward 2 (bottom-left): x=16-23, y=89-92
  bed(world, 17, 90);
  bed(world, 17, 92);
  medicineCabinet(world, 22, 90, 'medicine cabinet', 'Salves, pills, and chakra supplements organized by type.');
  torch(world, 22, 92, 'Ward lamp.', 3);
  // Treatment room (top-right): x=25-31, y=83-87
  torch(world, 26, 83, 'Medical examination lamp.', 3);
  desk(world, 28, 84, 'examination desk', 'Where the doctor reviews patient charts and writes prescriptions.');
  medicineCabinet(world, 30, 87, 'surgical supplies', 'Scalpels, sutures, and antiseptic. Everything sterilized.');
  // Supply room (bottom-right): x=25-31, y=89-92
  shelf(world, 27, 90, 'drug shelf', 'Rows of labeled medicine bottles. Some require authorization.');
  barrel(world, 30, 90, 'herb barrel', 'Dried medicinal herbs sorted by ailment.');
  shelf(world, 27, 92, 'bandage shelf', 'Clean bandages rolled and stacked. Restocked daily.');

  // Clinic (15,96 10×6) — single room: x=16-23, y=97-100
  bed(world, 17, 98);
  torch(world, 22, 97, 'Clinic examination lamp.', 3);
  medicineCabinet(world, 21, 100, 'herb cabinet', 'Dried medicinal herbs organized by ailment. The sharp scent is therapeutic.');
  desk(world, 18, 100, 'clinic desk', 'Patient intake forms and a worn stethoscope.');

  // ─── RESIDENTIAL WEST ─────────────────────
  // All houses: 10×8, internal wall splits into living room (top) and bedroom (bottom)
  // Row 1 at y=102, wall at y=106. Living: y=103-105, Bedroom: y=107-108
  // Row 2 at y=117, wall at y=121. Living: y=118-120, Bedroom: y=122-123

  // House W1 (8,102) — interior: 9-16
  torch(world, 10, 103, 'A small oil lamp.', 3);
  desk(world, 14, 104, 'writing desk', 'A simple desk with family letters and a candle.');
  shelf(world, 14, 103, 'cupboard', 'Cups, bowls, and a few jars of preserved fruit.');
  ownedBed(world, 10, 108);
  torch(world, 15, 107, 'Bedroom lamp.', 2);

  // House W2 (20,102) — interior: 21-28
  torch(world, 22, 103, 'A small oil lamp.', 3);
  shelf(world, 26, 104, 'bookshelf', 'A modest collection of novels and a family album.');
  ownedBed(world, 22, 108);
  torch(world, 27, 107, 'Bedroom lamp.', 2);

  // House W3 (34,102) — interior: 35-42
  torch(world, 40, 103, 'A small oil lamp.', 3);
  counter(world, 37, 104, 'kitchen counter', 'A cutting board, some rice, and dried fish.');
  ownedBed(world, 40, 108);
  torch(world, 36, 107, 'Bedroom lamp.', 2);

  // House W4 (46,102) — interior: 47-54
  torch(world, 52, 103, 'A small oil lamp.', 3);
  desk(world, 49, 104, 'hobby desk', 'Carving tools and a half-finished wooden figurine.');
  shelf(world, 52, 105, 'curio shelf', 'Trinkets and souvenirs from travels across the nations.');
  ownedBed(world, 52, 108);
  torch(world, 48, 107, 'Bedroom lamp.', 2);

  // House W5 (8,117) — interior: 9-16
  torch(world, 10, 118, 'A small oil lamp.', 3);
  shelf(world, 14, 119, 'spice shelf', 'Jars of spices — this household loves to cook.');
  ownedBed(world, 10, 123);
  torch(world, 15, 122, 'Bedroom lamp.', 2);

  // House W6 (20,117) — interior: 21-28
  torch(world, 22, 118, 'A small oil lamp.', 3);
  desk(world, 26, 119, 'work desk', 'Accounting ledgers for a small business.');
  ownedBed(world, 22, 123);
  torch(world, 27, 122, 'Bedroom lamp.', 2);

  // House W7 (34,117) — interior: 35-42
  torch(world, 40, 118, 'A small oil lamp.', 3);
  shelf(world, 37, 119, 'medicine shelf', 'Home remedies and herbal teas. Someone here knows their plants.');
  ownedBed(world, 40, 123);
  torch(world, 36, 122, 'Bedroom lamp.', 2);

  // House W8 (46,117) — interior: 47-54
  torch(world, 52, 118, 'A small oil lamp.', 3);
  weaponsRack(world, 49, 119, 'tool rack', 'Gardening tools hung neatly on the wall.');
  ownedBed(world, 52, 123);
  torch(world, 48, 122, 'Bedroom lamp.', 2);

  // ─── RESIDENTIAL EAST ─────────────────────

  // House E1 (96,102) — interior: 97-104
  torch(world, 98, 103, 'A small oil lamp.', 3);
  desk(world, 102, 104, 'writing desk', 'Ink-stained desk of a retired academy instructor.');
  shelf(world, 102, 103, 'bookshelf', 'Teaching materials and nostalgic graduation photos.');
  ownedBed(world, 98, 108);
  torch(world, 103, 107, 'Bedroom lamp.', 2);

  // House E2 (110,102) — interior: 111-118
  torch(world, 116, 103, 'A small oil lamp.', 3);
  counter(world, 113, 104, 'kitchen counter', 'A clean kitchen. Rice cooker and tea kettle ready.');
  ownedBed(world, 116, 108);
  torch(world, 112, 107, 'Bedroom lamp.', 2);

  // House E3 (124,102) — interior: 125-132
  torch(world, 130, 103, 'A small oil lamp.', 3);
  shelf(world, 127, 104, 'family shrine', 'A small altar with incense and ancestral photos.');
  ownedBed(world, 130, 108);
  torch(world, 126, 107, 'Bedroom lamp.', 2);

  // House E4 (96,117) — interior: 97-104
  torch(world, 98, 118, 'A small oil lamp.', 3);
  desk(world, 102, 119, 'craft table', 'Fabric scraps and sewing needles. A seamstress lives here.');
  ownedBed(world, 98, 123);
  torch(world, 103, 122, 'Bedroom lamp.', 2);

  // House E5 (110,117) — interior: 111-118
  torch(world, 116, 118, 'A small oil lamp.', 3);
  shelf(world, 113, 119, 'pottery shelf', 'Handmade ceramic bowls and vases. Some are quite good.');
  ownedBed(world, 116, 123);
  torch(world, 112, 122, 'Bedroom lamp.', 2);

  // House E6 (124,117) — interior: 125-132
  torch(world, 130, 118, 'A small oil lamp.', 3);
  weaponsRack(world, 127, 119, 'fishing rods', 'Rods and tackle for river fishing. A prized hobby.');
  ownedBed(world, 130, 123);
  torch(world, 126, 122, 'Bedroom lamp.', 2);

  // ─── HYUGA COMPOUND ───────────────────────

  // Main Hall (10,7 16×10) — wall: h@13(door@18)
  // Audience Hall: x=11-24, y=8-12
  torch(world, 12, 8, 'Hyuga hall lantern.', 4);
  torch(world, 24, 8, 'Hyuga hall lantern.', 4);
  desk(world, 17, 9, 'clan elder\'s seat', 'An elevated seat where the Hyuga elder presides over meetings.');
  shelf(world, 13, 12, 'clan records', 'Genealogical scrolls tracing the Hyuga bloodline back centuries.');
  // Meditation Room: x=11-24, y=14-15
  meditationCarpet(world, 16, 15);
  torch(world, 22, 14, 'Meditation lamp. Dim and focused.', 2);

  // Hyuga Dojo (28,7 12×8) — single room: x=29-38, y=8-13
  torch(world, 30, 8, 'Dojo torch.', 4);
  torch(world, 38, 8, 'Dojo torch.', 4);
  weaponsRack(world, 34, 9, 'training weapons', 'Wooden bokken and padded sparring gear.');
  spawn(world, { x: 33, y: 12, spriteId: 'obj_dummy', layer: 'object', offsetY: -20,
    blocksMove: true, blocksSight: false, name: 'practice target', article: 'a',
    description: 'A target dummy marked with tenketsu points for Gentle Fist practice.', category: 'object' });

  // Hyuga House 1 (10,21 10×7) — wall: h@24(door@14)
  // Living: y=22-23, Bedroom: y=25-26
  torch(world, 12, 22, 'Hyuga home lamp.', 3);
  shelf(world, 17, 23, 'family shelf', 'Clan history scrolls and a portrait of the Hyuga founders.');
  ownedBed(world, 12, 26);
  torch(world, 17, 25, 'Bedroom lamp.', 2);

  // Hyuga House 2 (22,21 10×7) — wall: h@24(door@26)
  // Living: y=22-23, Bedroom: y=25-26
  torch(world, 24, 22, 'Hyuga home lamp.', 3);
  desk(world, 29, 23, 'study desk', 'Notes on advanced Gentle Fist techniques.');
  ownedBed(world, 24, 26);
  torch(world, 29, 25, 'Bedroom lamp.', 2);

  // ─── UCHIHA COMPOUND ──────────────────────

  // Main Hall (108,7 18×10) — walls: h@13(door@117), v@118(14-15,door@14)
  // Audience Hall: x=109-124, y=8-12
  torch(world, 110, 8, 'Uchiha hall lantern.', 4);
  torch(world, 124, 8, 'Uchiha hall lantern.', 4);
  desk(world, 116, 9, 'clan leader\'s seat', 'A seat of authority bearing the Uchiha fan crest.');
  weaponsRack(world, 111, 12, 'ancestral weapons', 'Weapons carried by legendary Uchiha warriors of the past.');
  shelf(world, 122, 12, 'clan records', 'The Uchiha history — victories, losses, and the curse of hatred.');
  // Back-left room: x=109-117, y=14-15
  shelf(world, 111, 15, 'strategy scrolls', 'Battle tactics passed down through Uchiha generations.');
  torch(world, 116, 14, 'Back room lamp.', 2);
  // Back-right room: x=119-124, y=14-15
  weaponsRack(world, 121, 15, 'weapons cache', 'Emergency weapons kept ready. Old Uchiha tradition.');

  // Uchiha Armory (128,7 12×8) — single room: x=129-138, y=8-13
  torch(world, 130, 8, 'Armory torch.', 4);
  torch(world, 138, 8, 'Armory torch.', 4);
  weaponsRack(world, 132, 9, 'katana rack', 'Fine swords maintained to battle readiness.');
  weaponsRack(world, 136, 9, 'shuriken display', 'Throwing weapons of various sizes and shapes.');
  shelf(world, 134, 13, 'armor stand', 'Sets of Uchiha battle armor. Polished and ready.');

  // Uchiha House 1 (108,21 10×7) — wall: h@24(door@112)
  // Living: y=22-23, Bedroom: y=25-26
  torch(world, 110, 22, 'Uchiha home lamp.', 3);
  shelf(world, 115, 23, 'family shelf', 'Photos and a small Uchiha fan emblem on the wall.');
  ownedBed(world, 110, 26);
  torch(world, 115, 25, 'Bedroom lamp.', 2);

  // Uchiha House 2 (120,21 10×7) — wall: h@24(door@124)
  // Living: y=22-23, Bedroom: y=25-26
  torch(world, 122, 22, 'Uchiha home lamp.', 3);
  desk(world, 127, 23, 'training journal', 'A desk with detailed training logs and jutsu research.');
  ownedBed(world, 122, 26);
  torch(world, 127, 25, 'Bedroom lamp.', 2);

  // Uchiha House 3 (132,21 10×7) — wall: h@24(door@136)
  // Living: y=22-23, Bedroom: y=25-26
  torch(world, 134, 22, 'Uchiha home lamp.', 3);
  counter(world, 139, 23, 'kitchen counter', 'A tidy kitchen. Rice and grilled fish, the Uchiha staple.');
  ownedBed(world, 134, 26);
  torch(world, 139, 25, 'Bedroom lamp.', 2);

  // ─── GATE GUARD POSTS ─────────────────────

  // Guard Post W (66,147 6×5) — interior: 67-70, 148-150
  torch(world, 68, 148, 'Gate guard torch — never goes out.', 5);
  weaponsRack(world, 70, 150, 'guard weapons', 'Spare weapons for the gate watch. Always loaded.');

  // Guard Post E (88,147 6×5) — interior: 89-92, 148-150
  torch(world, 91, 148, 'Gate guard torch.', 5);
  desk(world, 89, 150, 'checkpoint desk', 'A logbook tracking every arrival and departure.');

  // ─── SHRINE ───────────────────────────────

  // Shrine (143,73 8×6) — interior: 144-149, 74-77
  torch(world, 145, 74, 'A sacred flame that never goes out.', 5);
  spawn(world, { x: 148, y: 75, spriteId: 'obj_rock_medium', layer: 'object', offsetY: -30,
    blocksMove: true, blocksSight: false, name: 'offering stone', article: 'an',
    description: 'A smooth stone altar for offerings to the village spirits.', category: 'object' });
  bench(world, 146, 77, 'prayer mat', 'A mat for kneeling in prayer. Worn smooth by many knees.');

  // ══════════════════════════════════════════
  //  LAYER 7: DECORATION
  // ══════════════════════════════════════════

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

  // --- North park decorations (42-55, 8-17) ---
  tree(world, 44, 10);
  tree(world, 50, 12);
  tree(world, 48, 16);
  bush(world, 43, 14);
  bush(world, 53, 14);
  bench(world, 46, 15, 'park bench', 'A wooden bench under the trees. A nice spot to rest.');

  // --- South park decorations (55-74, 130-139) ---
  tree(world, 58, 131);
  tree(world, 65, 135);
  tree(world, 72, 132);
  tree(world, 68, 138);
  bush(world, 56, 134);
  bush(world, 73, 134);
  bench(world, 63, 136, 'park bench', 'A bench overlooking the small pond. Peaceful.');

  // --- Farm plots decorations (6-13, 100-126) ---
  spawn(world, { x: 8, y: 105, spriteId: 'obj_scarecrow', layer: 'object', offsetY: -20,
    blocksMove: true, blocksSight: false, name: 'scarecrow', article: 'a',
    description: 'A scarecrow dressed in old shinobi gear. Effective, in a creepy sort of way.', category: 'object' });
  barrel(world, 10, 120, 'water barrel', 'A barrel collecting rainwater for the farm plots.');

  // --- Market plaza open area decorations ---
  spawn(world, { x: 110, y: 79, spriteId: 'obj_well', layer: 'object', offsetY: -20,
    blocksMove: true, blocksSight: false, name: 'market well', article: 'the',
    description: 'A stone well in the center of the market. Fresh water for all.', category: 'object' });
  bench(world, 120, 79, 'market bench', 'A bench for tired shoppers.');

  // --- Well plaza at crossroads (73-79, 78-82) ---
  spawn(world, { x: 76, y: 79, spriteId: 'obj_well', layer: 'object', offsetY: -20,
    blocksMove: true, blocksSight: false, name: 'village well', article: 'the',
    description: 'The main village well. A gathering point for gossip and news.', category: 'object' });

  // --- Rocks near river ---
  spawn(world, { x: 50, y: 63, spriteId: 'obj_rock_medium', layer: 'object', offsetY: -30, blocksMove: true, blocksSight: false, name: 'river stone', article: 'a', description: 'A smooth stone by the water.', category: 'terrain' });
  spawn(world, { x: 110, y: 63, spriteId: 'obj_rock_mossy', layer: 'object', offsetY: -10, blocksMove: true, blocksSight: false, name: 'mossy rock', article: 'a', description: 'A mossy stone.', category: 'terrain' });

  // --- Training Grounds objects ---
  spawnTrainingGroundsObjects(world, devMode);

  // --- Meditation carpet near training grounds ---
  meditationCarpet(world, TG_OFFSET_X + 21, TG_OFFSET_Y + 36);
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
