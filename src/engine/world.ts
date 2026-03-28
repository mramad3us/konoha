import type { EntityId, PositionComponent, RenderableComponent, BlockingComponent, HealthComponent, CombatStatsComponent, PlayerControlledComponent, ResourcesComponent, AIControlledComponent, NameComponent, DestructibleComponent } from '../types/ecs.ts';
import type { GameLogEntry } from '../types/actions.ts';
import { TileMap } from '../map/tileMap.ts';
import { MAX_LOG_ENTRIES } from '../core/constants.ts';

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

  // World systems data
  tileMap: TileMap;
  currentTick = 0;
  playerEntityId: EntityId = 0;

  // FOV data
  fovVisible = new Set<string>();
  fovExplored = new Set<string>();

  // Game log
  gameLog: GameLogEntry[] = [];

  constructor(tileMap: TileMap) {
    this.tileMap = tileMap;
  }

  /** Create a new entity and return its ID */
  createEntity(): EntityId {
    const id = this.nextId++;
    this.entities.add(id);
    return id;
  }

  /** Remove an entity and all its components */
  destroyEntity(id: EntityId): void {
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
  }

  /** Get entity at a specific tile position (first found) */
  getEntityAt(x: number, y: number): EntityId | null {
    for (const [id, pos] of this.positions) {
      if (pos.x === x && pos.y === y) return id;
    }
    return null;
  }

  /** Get all entities at a specific tile position */
  getEntitiesAt(x: number, y: number): EntityId[] {
    const result: EntityId[] = [];
    for (const [id, pos] of this.positions) {
      if (pos.x === x && pos.y === y) result.push(id);
    }
    return result;
  }

  /** Check if a tile is blocked by any entity */
  isBlockedByEntity(x: number, y: number): boolean {
    for (const [id, pos] of this.positions) {
      if (pos.x === x && pos.y === y) {
        const blocking = this.blockings.get(id);
        if (blocking?.blocksMovement) return true;
      }
    }
    return false;
  }

  /** Get blocking entity at position (for combat targeting) */
  getBlockingEntityAt(x: number, y: number): EntityId | null {
    for (const [id, pos] of this.positions) {
      if (pos.x === x && pos.y === y) {
        const blocking = this.blockings.get(id);
        if (blocking?.blocksMovement) return id;
      }
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
    };
  }

  /** Deserialize world state from save data */
  static deserialize(data: Record<string, unknown>): World {
    const tileMapData = data['tileMap'] as { width: number; height: number; tiles: number[] };
    const world = new World(TileMap.deserialize(tileMapData));

    world.nextId = data['nextId'] as number;
    world.currentTick = data['currentTick'] as number;
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

    return world;
  }
}
