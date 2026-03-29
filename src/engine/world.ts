import type { EntityId, PositionComponent, RenderableComponent, BlockingComponent, HealthComponent, CombatStatsComponent, PlayerControlledComponent, ResourcesComponent, AIControlledComponent, NameComponent, DestructibleComponent, CharacterSheet, UnconsciousComponent, DeadComponent, InteractableComponent, LightSourceComponent, ObjectSheetComponent, BleedingComponent, ProximityDialogueComponent, DoorComponent, AnchorComponent, NpcLifecycleComponent, AggroComponent, InvisibleComponent } from '../types/ecs.ts';
import type { GameLogEntry } from '../types/actions.ts';
import { TileMap } from '../map/tileMap.ts';
import { MAX_LOG_ENTRIES } from '../core/constants.ts';
import type { MissionBoard, MissionLog } from './missions.ts';
import { createMissionBoard, createMissionLog } from './missions.ts';

/**
 * Central game state container.
 * Typed component Maps keyed by entity ID — no framework, full type safety.
 */
export class World {
  // Entity tracking
  entities = new Set<EntityId>();
  private nextId = 1;

  // Component stores — one typed Map per component
  positions = new Map<EntityId, PositionComponent>();
  renderables = new Map<EntityId, RenderableComponent>();
  blockings = new Map<EntityId, BlockingComponent>();
  healths = new Map<EntityId, HealthComponent>();
  combatStats = new Map<EntityId, CombatStatsComponent>();
  playerControlled = new Map<EntityId, PlayerControlledComponent>();
  resources = new Map<EntityId, ResourcesComponent>();
  aiControlled = new Map<EntityId, AIControlledComponent>();
  names = new Map<EntityId, NameComponent>();
  destructibles = new Map<EntityId, DestructibleComponent>();
  characterSheets = new Map<EntityId, CharacterSheet>();
  unconscious = new Map<EntityId, UnconsciousComponent>();
  dead = new Map<EntityId, DeadComponent>();
  interactables = new Map<EntityId, InteractableComponent>();
  lightSources = new Map<EntityId, LightSourceComponent>();
  objectSheets = new Map<EntityId, ObjectSheetComponent>();
  bleeding = new Map<EntityId, BleedingComponent>();
  proximityDialogue = new Map<EntityId, ProximityDialogueComponent>();
  doors = new Map<EntityId, DoorComponent>();
  anchors = new Map<EntityId, AnchorComponent>();
  npcLifecycles = new Map<EntityId, NpcLifecycleComponent>();
  aggros = new Map<EntityId, AggroComponent>();
  invisible = new Map<EntityId, InvisibleComponent>();

  // Combat intent
  playerKillIntent = false;

  // Meditation tracking (productive sessions per day)
  meditationLastDay = -1;
  meditationSessionsToday = 0;

  // Mission system
  missionBoard: MissionBoard = createMissionBoard(1);
  missionLog: MissionLog = createMissionLog();

  // NPC lifecycle tracking
  lastDuskDayProcessed = -1;
  lastDawnDayProcessed = -1;
  /** NPC definitions despawned at dusk, to be respawned at dawn */
  despawnedNpcDefs: Array<{ anchorX: number; anchorY: number; npcIndex: number }> = [];

  // World systems data
  tileMap: TileMap;
  currentTick = 0;
  gameTimeSeconds = 0;  // elapsed in-game time in seconds
  playerEntityId: EntityId = 0;

  // FOV data
  fovVisible = new Set<string>();
  fovExplored = new Set<string>();

  // Game log
  gameLog: GameLogEntry[] = [];

  // Pending interaction (set by turnSystem, consumed by game.ts)
  _pendingInteraction: { entityId: number; type: string; candidates?: number[] } | null = null;

  // Spatial hash for O(1) entity position lookups
  private entityGrid = new Map<string, Set<EntityId>>();

  constructor(tileMap: TileMap) {
    this.tileMap = tileMap;
  }

  private gridKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  /** Register entity in spatial grid (call after setting position) */
  registerInGrid(id: EntityId, x: number, y: number): void {
    const key = this.gridKey(x, y);
    let set = this.entityGrid.get(key);
    if (!set) { set = new Set(); this.entityGrid.set(key, set); }
    set.add(id);
  }

  /** Remove entity from spatial grid */
  removeFromGrid(id: EntityId, x: number, y: number): void {
    const key = this.gridKey(x, y);
    const set = this.entityGrid.get(key);
    if (set) {
      set.delete(id);
      if (set.size === 0) this.entityGrid.delete(key);
    }
  }

  /** Move entity in spatial grid */
  moveInGrid(id: EntityId, oldX: number, oldY: number, newX: number, newY: number): void {
    this.removeFromGrid(id, oldX, oldY);
    this.registerInGrid(id, newX, newY);
  }

  /** Set entity position and update spatial grid */
  setPosition(id: EntityId, pos: PositionComponent): void {
    const old = this.positions.get(id);
    if (old) this.removeFromGrid(id, old.x, old.y);
    this.positions.set(id, pos);
    this.registerInGrid(id, pos.x, pos.y);
  }

  /** Rebuild spatial grid from all positions (for deserialization) */
  rebuildGrid(): void {
    this.entityGrid.clear();
    for (const [id, pos] of this.positions) {
      this.registerInGrid(id, pos.x, pos.y);
    }
  }

  /** Create a new entity and return its ID */
  createEntity(): EntityId {
    const id = this.nextId++;
    this.entities.add(id);
    return id;
  }

  /** Alias for destroyEntity — used by mission system */
  removeEntity(id: EntityId): void {
    this.destroyEntity(id);
  }

  /** Remove an entity and all its components */
  destroyEntity(id: EntityId): void {
    // Remove from spatial grid before deleting position
    const pos = this.positions.get(id);
    if (pos) this.removeFromGrid(id, pos.x, pos.y);

    this.entities.delete(id);
    this.positions.delete(id);
    this.renderables.delete(id);
    this.blockings.delete(id);
    this.healths.delete(id);
    this.combatStats.delete(id);
    this.playerControlled.delete(id);
    this.resources.delete(id);
    this.aiControlled.delete(id);
    this.names.delete(id);
    this.destructibles.delete(id);
    this.characterSheets.delete(id);
    this.unconscious.delete(id);
    this.dead.delete(id);
    this.interactables.delete(id);
    this.lightSources.delete(id);
    this.objectSheets.delete(id);
    this.bleeding.delete(id);
    this.proximityDialogue.delete(id);
    this.doors.delete(id);
    this.anchors.delete(id);
    this.npcLifecycles.delete(id);
    this.aggros.delete(id);
    this.invisible.delete(id);
  }

  /** Get entity at a specific tile position (first found) — O(1) via spatial hash */
  getEntityAt(x: number, y: number): EntityId | null {
    const set = this.entityGrid.get(this.gridKey(x, y));
    if (!set) return null;
    for (const id of set) return id;
    return null;
  }

  /** Get all entities at a specific tile position — O(1) via spatial hash */
  getEntitiesAt(x: number, y: number): EntityId[] {
    const set = this.entityGrid.get(this.gridKey(x, y));
    if (!set) return [];
    return Array.from(set);
  }

  /** Check if a tile is blocked by any entity — O(k) where k = entities at tile */
  isBlockedByEntity(x: number, y: number): boolean {
    const set = this.entityGrid.get(this.gridKey(x, y));
    if (!set) return false;
    for (const id of set) {
      const blocking = this.blockings.get(id);
      if (blocking?.blocksMovement) return true;
    }
    return false;
  }

  /** Check if a tile is blocked by an entity visible to the player */
  isBlockedByVisibleEntity(x: number, y: number): boolean {
    const set = this.entityGrid.get(this.gridKey(x, y));
    if (!set) return false;
    for (const id of set) {
      if (this.isInvisibleToPlayer(id)) continue;
      const blocking = this.blockings.get(id);
      if (blocking?.blocksMovement) return true;
    }
    return false;
  }

  /** Get blocking entity at position — O(k) where k = entities at tile */
  getBlockingEntityAt(x: number, y: number): EntityId | null {
    const set = this.entityGrid.get(this.gridKey(x, y));
    if (!set) return null;
    for (const id of set) {
      const blocking = this.blockings.get(id);
      if (blocking?.blocksMovement) return id;
    }
    return null;
  }

  /** Add a message to the game log */
  log(text: string, category: GameLogEntry['category']): void {
    this.gameLog.unshift({ tick: this.currentTick, text, category });
    if (this.gameLog.length > MAX_LOG_ENTRIES) {
      this.gameLog.length = MAX_LOG_ENTRIES;
    }
  }

  /**
   * Check if a given entity is invisible to the player.
   * An entity with InvisibleComponent requires the observer to have
   * ninjutsu >= casterNinjutsu + 5 to detect them.
   * Returns true if the entity CANNOT be seen by the player.
   */
  isInvisibleToPlayer(entityId: EntityId): boolean {
    const inv = this.invisible.get(entityId);
    if (!inv) return false;
    const playerSheet = this.characterSheets.get(this.playerEntityId);
    const playerNinjutsu = playerSheet?.skills.ninjutsu ?? 0;
    return playerNinjutsu < inv.casterNinjutsu + 5;
  }

  /**
   * Check if a given entity is invisible but DETECTABLE by the player.
   * The player can see them but they appear shrouded.
   */
  isInvisibleButDetected(entityId: EntityId): boolean {
    const inv = this.invisible.get(entityId);
    if (!inv) return false;
    const playerSheet = this.characterSheets.get(this.playerEntityId);
    const playerNinjutsu = playerSheet?.skills.ninjutsu ?? 0;
    return playerNinjutsu >= inv.casterNinjutsu + 5;
  }

  /** FOV helpers */
  fovKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  isVisible(x: number, y: number): boolean {
    return this.fovVisible.has(this.fovKey(x, y));
  }

  isExplored(x: number, y: number): boolean {
    return this.fovExplored.has(this.fovKey(x, y));
  }

  /** Serialize entire world state for save */
  serialize(): Record<string, unknown> {
    const serializeMap = <T>(map: Map<EntityId, T>) => {
      const obj: Record<string, T> = {};
      for (const [k, v] of map) obj[String(k)] = v;
      return obj;
    };

    return {
      nextId: this.nextId,
      entities: Array.from(this.entities),
      currentTick: this.currentTick,
      gameTimeSeconds: this.gameTimeSeconds,
      playerEntityId: this.playerEntityId,
      tileMap: this.tileMap.serialize(),
      fovExplored: Array.from(this.fovExplored),
      gameLog: this.gameLog,
      // Components
      positions: serializeMap(this.positions),
      renderables: serializeMap(this.renderables),
      blockings: serializeMap(this.blockings),
      healths: serializeMap(this.healths),
      combatStats: serializeMap(this.combatStats),
      playerControlled: serializeMap(this.playerControlled),
      resources: serializeMap(this.resources),
      aiControlled: serializeMap(this.aiControlled),
      names: serializeMap(this.names),
      destructibles: serializeMap(this.destructibles),
      characterSheets: serializeMap(this.characterSheets),
      unconscious: serializeMap(this.unconscious),
      dead: serializeMap(this.dead),
      interactables: serializeMap(this.interactables),
      lightSources: serializeMap(this.lightSources),
      objectSheets: serializeMap(this.objectSheets),
      bleeding: serializeMap(this.bleeding),
      proximityDialogue: serializeMap(this.proximityDialogue),
      doors: serializeMap(this.doors),
      anchors: serializeMap(this.anchors),
      npcLifecycles: serializeMap(this.npcLifecycles),
      aggros: serializeMap(this.aggros),
      invisible: serializeMap(this.invisible),
      playerKillIntent: this.playerKillIntent,
      missionBoard: this.missionBoard,
      missionLog: this.missionLog,
      meditationLastDay: this.meditationLastDay,
      meditationSessionsToday: this.meditationSessionsToday,
      lastDuskDayProcessed: this.lastDuskDayProcessed,
      lastDawnDayProcessed: this.lastDawnDayProcessed,
      despawnedNpcDefs: this.despawnedNpcDefs,
    };
  }

  /** Deserialize world state from save data */
  static deserialize(data: Record<string, unknown>): World {
    const tileMapData = data['tileMap'] as { width: number; height: number; tiles: number[] };
    const world = new World(TileMap.deserialize(tileMapData));

    world.nextId = data['nextId'] as number;
    world.currentTick = data['currentTick'] as number;
    world.gameTimeSeconds = (data['gameTimeSeconds'] as number) ?? 0;
    world.playerEntityId = data['playerEntityId'] as number;
    world.fovExplored = new Set(data['fovExplored'] as string[]);
    world.gameLog = data['gameLog'] as GameLogEntry[];

    for (const id of data['entities'] as number[]) {
      world.entities.add(id);
    }

    const deserializeMap = <T>(map: Map<EntityId, T>, raw: Record<string, T>) => {
      for (const [k, v] of Object.entries(raw)) map.set(Number(k), v);
    };

    deserializeMap(world.positions, data['positions'] as Record<string, PositionComponent>);
    deserializeMap(world.renderables, data['renderables'] as Record<string, RenderableComponent>);
    deserializeMap(world.blockings, data['blockings'] as Record<string, BlockingComponent>);
    deserializeMap(world.healths, data['healths'] as Record<string, HealthComponent>);
    deserializeMap(world.combatStats, data['combatStats'] as Record<string, CombatStatsComponent>);
    deserializeMap(world.playerControlled, data['playerControlled'] as Record<string, PlayerControlledComponent>);
    deserializeMap(world.resources, data['resources'] as Record<string, ResourcesComponent>);
    deserializeMap(world.aiControlled, data['aiControlled'] as Record<string, AIControlledComponent>);
    deserializeMap(world.names, data['names'] as Record<string, NameComponent>);
    deserializeMap(world.destructibles, data['destructibles'] as Record<string, DestructibleComponent>);
    if (data['characterSheets']) {
      deserializeMap(world.characterSheets, data['characterSheets'] as Record<string, CharacterSheet>);
    }
    if (data['unconscious']) {
      deserializeMap(world.unconscious, data['unconscious'] as Record<string, UnconsciousComponent>);
    }
    if (data['dead']) {
      deserializeMap(world.dead, data['dead'] as Record<string, DeadComponent>);
    }
    if (data['interactables']) {
      deserializeMap(world.interactables, data['interactables'] as Record<string, InteractableComponent>);
    }
    if (data['lightSources']) {
      deserializeMap(world.lightSources, data['lightSources'] as Record<string, LightSourceComponent>);
    }
    if (data['objectSheets']) {
      deserializeMap(world.objectSheets, data['objectSheets'] as Record<string, ObjectSheetComponent>);
    }
    if (data['bleeding']) {
      deserializeMap(world.bleeding, data['bleeding'] as Record<string, BleedingComponent>);
    }
    if (data['proximityDialogue']) {
      deserializeMap(world.proximityDialogue, data['proximityDialogue'] as Record<string, ProximityDialogueComponent>);
    }
    if (data['doors']) {
      deserializeMap(world.doors, data['doors'] as Record<string, DoorComponent>);
    }
    if (data['anchors']) {
      deserializeMap(world.anchors, data['anchors'] as Record<string, AnchorComponent>);
    }
    if (data['npcLifecycles']) {
      deserializeMap(world.npcLifecycles, data['npcLifecycles'] as Record<string, NpcLifecycleComponent>);
    }
    if (data['aggros']) {
      deserializeMap(world.aggros, data['aggros'] as Record<string, AggroComponent>);
    }
    if (data['invisible']) {
      deserializeMap(world.invisible, data['invisible'] as Record<string, InvisibleComponent>);
    }
    if (data['playerKillIntent'] !== undefined) {
      world.playerKillIntent = data['playerKillIntent'] as boolean;
    }
    if (data['missionBoard']) {
      world.missionBoard = data['missionBoard'] as MissionBoard;
    }
    if (data['missionLog']) {
      world.missionLog = data['missionLog'] as MissionLog;
    }
    if (data['meditationLastDay'] !== undefined) {
      world.meditationLastDay = data['meditationLastDay'] as number;
    }
    if (data['meditationSessionsToday'] !== undefined) {
      world.meditationSessionsToday = data['meditationSessionsToday'] as number;
    }
    if (data['lastDuskDayProcessed'] !== undefined) {
      world.lastDuskDayProcessed = data['lastDuskDayProcessed'] as number;
    }
    if (data['lastDawnDayProcessed'] !== undefined) {
      world.lastDawnDayProcessed = data['lastDawnDayProcessed'] as number;
    }
    if (data['despawnedNpcDefs']) {
      world.despawnedNpcDefs = data['despawnedNpcDefs'] as typeof world.despawnedNpcDefs;
    }

    // Rebuild spatial hash from deserialized positions
    world.rebuildGrid();

    return world;
  }
}
