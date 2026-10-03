/**
 * GameView: the in-game controller. Owns the renderer, HUD and input; turns commands into sim
 * actions; drains sim events into visuals/audio/HUD; handles UI requests raised by the sim.
 */

import type { Game } from '../sim/game.ts';
import type { EntityId, Move, Stance } from '../ecs/components.ts';
import type { Vec } from '../core/geometry.ts';
import { SCREEN_TO_GRID, chebyshev } from '../core/geometry.ts';
import { Renderer } from '../render/renderer.ts';
import { commandFor, learnKey, loadLayoutLabels, type Command } from './keys.ts';
import { playerAct, advance, primeLevel, rest } from '../sim/turn.ts';
import type { Action } from '../sim/actions.ts';
import { throwHitChance } from '../sim/actions.ts';
import { adjacentFoes, engagedWith } from '../sim/combat.ts';
import { isStanding, isDown } from '../sim/vitals.ts';
import { canAttack, isHostile } from '../sim/factions.ts';
import { findPath } from '../world/path.ts';
import { hasLos } from '../world/fov.ts';
import { THROWN, TICKS_PER_HOUR } from '../core/config.ts';
import { Hud } from './hud.ts';
import { Menu, type MenuOption } from './menu.ts';
import { audio } from '../audio/audio.ts';
import { displayName, cap } from '../sim/names.ts';
import { squadOrders } from '../sim/ai.ts';

type Mode =
  | { m: 'play' }
  | { m: 'aim'; weapon: 'kunai' | 'shuriken'; targets: EntityId[]; idx: number }
  | { m: 'shadow'; range: number; cursor: Vec }
  | { m: 'menu' };

export interface GameViewHooks {
  /** A UI request the view doesn't handle itself (facilities, defeat, leaving the area…). */
  onRequest: (view: GameView, r: Game['requests'][number]) => Promise<void> | void;
  onMenu: (view: GameView) => void;
}

export class GameView {
  readonly root: HTMLElement;
  game: Game;
  readonly renderer: Renderer;
  readonly hud: Hud;
  readonly menu: Menu;
  private hooks: GameViewHooks;
  private mode: Mode = { m: 'play' };
  private raf = 0;
  private walk: Vec[] = [];
  private walkTimer = 0;
  private target: EntityId | null = null;
  private busy = false;
  private disposed = false;
  private loggedFrameError = false;
  private readonly onKey = (e: KeyboardEvent) => this.key(e);
  private readonly onResize = () => this.fit();
  private resizeObs: ResizeObserver;

  constructor(root: HTMLElement, game: Game, hooks: GameViewHooks) {
    this.root = root;
    this.game = game;
    this.hooks = hooks;
    root.classList.add('gv');
    const canvas = document.createElement('canvas');
    canvas.className = 'gv-canvas';
    root.appendChild(canvas);
    this.renderer = new Renderer(canvas);
    this.hud = new Hud(root, this);
    this.menu = new Menu(root);
    this.resizeObs = new ResizeObserver(this.onResize);
    this.resizeObs.observe(root);
    window.addEventListener('keydown', this.onKey);
    canvas.addEventListener('mousemove', e => this.mouseMove(e));
    canvas.addEventListener('mousedown', e => this.mouseDown(e));
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => { e.preventDefault(); this.renderer.setZoom(this.renderer.zoom + (e.deltaY < 0 ? 1 : -1)); }, { passive: false });
    void loadLayoutLabels().then(() => this.hud.refresh());
    this.fit();
  }

  start(): void {
    primeLevel(this.game, this.game.level);
    advance(this.game);
    this.renderer.visuals.snapAll(this.game.level);
    this.renderer.snapCamera();
    this.flush();
    const loop = (now: number) => {
      if (this.disposed) return;
      // Never let one bad frame stop the loop (that froze the screen while input kept working).
      try {
        this.tickWalk(now);
        this.renderer.draw(this.game, now);
        this.hud.frame(now);
      } catch (e) {
        if (!this.loggedFrameError) { console.error('[render]', e); this.loggedFrameError = true; }
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKey);
    this.resizeObs.disconnect();
    this.root.innerHTML = '';
    this.root.classList.remove('gv');
  }

  /** Switch to another game instance or level (after travel / load). */
  rebind(game: Game): void {
    this.game = game;
    primeLevel(game, game.level);
    this.renderer.visuals.snapAll(game.level);
    this.renderer.snapCamera();
    this.target = null;
    this.walk = [];
    this.mode = { m: 'play' };
    this.flush();
  }

  private fit(): void {
    const r = this.root.getBoundingClientRect();
    this.renderer.resize(r.width, r.height);
  }

  get locked(): boolean {
    return this.busy || this.mode.m === 'menu' || this.menu.open;
  }

  // ── Event plumbing ──

  /** Drain sim events and requests into presentation. Call after any sim change. */
  flush(): void {
    const lv = this.game.level;
    const events = lv.outbox.splice(0);
    const now = performance.now();
    this.renderer.visuals.apply(lv, events, now);
    audio.events(lv, events);
    this.ensureTarget();
    this.hud.refresh();
    void this.processRequests();
  }

  private async processRequests(): Promise<void> {
    const g = this.game;
    while (g.requests.length && !this.busy) {
      const r = g.requests.shift()!;
      if (r.kind === 'aim_shadow_step') {
        const p = g.level.c.pos.get(g.level.playerId)!;
        this.mode = { m: 'shadow', range: r.range, cursor: { x: p.x, y: p.y } };
        this.syncOverlay();
        g.say('Shadow Step: choose a tile you can see (move the cursor, F to step, Esc to cancel).', 'system');
        this.hud.refresh();
        continue;
      }
      if (r.kind === 'examine') {
        this.examine(r.entity);
        continue;
      }
      this.busy = true;
      this.walk = [];
      try {
        await this.hooks.onRequest(this, r);
      } finally {
        this.busy = false;
      }
    }
  }

  /** Perform a player action and update everything. */
  act(a: Action): boolean {
    const r = playerAct(this.game, a);
    this.flush();
    return r.ok;
  }

  // ── Input ──

  private key(e: KeyboardEvent): void {
    learnKey(e);
    if (this.menu.open) { this.menu.key(e); return; }
    if (this.hud.panelOpen) {
      if (this.hud.panelKey(e)) { e.preventDefault(); return; }
    }
    const cmd = commandFor(e);
    if (!cmd) return;
    e.preventDefault();
    if (this.busy) return;
    if (cmd.k === 'cancel' && this.mode.m === 'play') { this.hooks.onMenu(this); return; }
    if (this.mode.m === 'aim') { this.aimKey(cmd); return; }
    if (this.mode.m === 'shadow') { this.shadowKey(cmd); return; }
    if (this.mode.m !== 'play') return;
    this.walk = [];
    this.command(cmd);
  }

  command(cmd: Command): void {
    const g = this.game, lv = g.level, pid = lv.playerId;
    if (!isStanding(lv, pid)) return;
    switch (cmd.k) {
      case 'move': {
        const d = SCREEN_TO_GRID[cmd.dir];
        this.act({ type: 'move', dx: d.x, dy: d.y });
        break;
      }
      case 'wait': this.act({ type: 'wait' }); break;
      case 'rest': this.restMenu(); break;
      case 'strike': case 'break': case 'guard': this.melee(cmd.k); break;
      case 'target': this.cycleTarget(); break;
      case 'run': this.stance('run'); break;
      case 'sneak': this.stance('sneak'); break;
      case 'dash': this.stance('dash'); break;
      case 'interact': this.interact(); break;
      case 'throw': this.startAim(); break;
      case 'kawarimi': this.act({ type: 'kawarimi' }); break;
      case 'sign': this.act({ type: 'sign', sign: cmd.sign }); break;
      case 'lethal':
        g.player.lethal = !g.player.lethal;
        g.say(g.player.lethal ? 'You draw your kunai. You fight to kill.' : 'You sheathe your kunai. You fight to subdue.', 'system');
        this.flush();
        break;
      case 'bandage': this.act({ type: 'use', item: 'bandage' }); break;
      case 'squad': {
        const o = squadOrders(g);
        if (o.follow && o.engage) { o.engage = false; g.say('Squad: follow me, defend only.', 'system'); }
        else if (o.follow) { o.follow = false; g.say('Squad: hold position.', 'system'); }
        else { o.follow = true; o.engage = true; g.say('Squad: follow me, engage on sight.', 'system'); }
        this.flush();
        break;
      }
      case 'profile': this.hud.toggle('profile'); break;
      case 'journal': this.hud.toggle('journal'); break;
      case 'inventory': this.hud.toggle('inventory'); break;
      case 'help': this.hud.toggle('help'); break;
      case 'zoomIn': this.renderer.setZoom(this.renderer.zoom + 1); break;
      case 'zoomOut': this.renderer.setZoom(this.renderer.zoom - 1); break;
      default: break;
    }
  }

  private stance(s: Stance): void {
    const lv = this.game.level;
    const actor = lv.c.actor.get(lv.playerId)!;
    const next: Stance = actor.stance === s ? 'walk' : s;
    if (this.act({ type: 'stance', stance: next })) {
      this.renderer.overlay.cones = next === 'sneak';
      this.hud.refresh();
    }
  }

  // ── Combat ──

  private ensureTarget(): void {
    const lv = this.game.level;
    const pid = lv.playerId;
    const foes = adjacentFoes(lv, pid);
    if (this.target !== null && foes.includes(this.target)) return;
    const engaged = engagedWith(lv, pid);
    this.target = engaged[0] ?? foes[0] ?? null;
  }

  get currentTarget(): EntityId | null {
    return this.target;
  }

  private cycleTarget(): void {
    const lv = this.game.level;
    const foes = adjacentFoes(lv, lv.playerId);
    if (!foes.length) return;
    const i = this.target === null ? -1 : foes.indexOf(this.target);
    this.target = foes[(i + 1) % foes.length];
    this.hud.refresh();
  }

  private melee(m: Move): void {
    this.ensureTarget();
    if (this.target === null) {
      // Guard with nobody adjacent: brace against anything thrown at you.
      if (m === 'guard') { this.act({ type: 'brace' }); return; }
      this.game.say('No one within reach.', 'info');
      this.hud.refresh();
      return;
    }
    this.act({ type: 'melee', move: m, target: this.target });
  }

  // ── Throwing ──

  private throwTargets(): EntityId[] {
    const lv = this.game.level, pid = lv.playerId;
    const p = lv.c.pos.get(pid)!;
    const out: Array<[EntityId, number]> = [];
    for (const [id] of lv.c.vitals) {
      if (id === pid || !isStanding(lv, id) || !canAttack(lv, pid, id)) continue;
      const q = lv.c.pos.get(id);
      if (!q || !lv.visible[lv.idx(q.x, q.y)]) continue;
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d > THROWN.kunai.range + 1 || !hasLos(lv, p.x, p.y, q.x, q.y)) continue;
      out.push([id, d]);
    }
    return out.sort((a, b) => a[1] - b[1]).map(([id]) => id);
  }

  private startAim(): void {
    const g = this.game;
    const inv = g.player.inventory.items;
    const weapon = (inv.kunai ?? 0) > 0 ? 'kunai' : (inv.shuriken ?? 0) > 0 ? 'shuriken' : null;
    if (!weapon) { g.say('You have nothing to throw.', 'info'); this.hud.refresh(); return; }
    const targets = this.throwTargets();
    if (!targets.length) { g.say('No target in sight.', 'info'); this.hud.refresh(); return; }
    this.mode = { m: 'aim', weapon, targets, idx: 0 };
    this.syncOverlay();
    this.hud.refresh();
  }

  aimInfo(): { weapon: 'kunai' | 'shuriken'; target: EntityId; chance: number } | null {
    if (this.mode.m !== 'aim') return null;
    const t = this.mode.targets[this.mode.idx];
    return { weapon: this.mode.weapon, target: t, chance: Math.round(throwHitChance(this.game, this.game.level, this.game.level.playerId, this.mode.weapon, t)) };
  }

  private aimKey(cmd: Command): void {
    if (this.mode.m !== 'aim') return;
    const mode = this.mode;
    switch (cmd.k) {
      case 'cancel': this.mode = { m: 'play' }; break;
      case 'target': case 'cycle': case 'move':
        mode.idx = (mode.idx + (cmd.k === 'move' && (cmd.dir === 'left' || cmd.dir === 'up') ? -1 : 1) + mode.targets.length) % mode.targets.length;
        break;
      case 'throw': {
        const other = mode.weapon === 'kunai' ? 'shuriken' : 'kunai';
        if ((this.game.player.inventory.items[other] ?? 0) > 0) mode.weapon = other;
        break;
      }
      case 'interact': case 'confirm': case 'strike': {
        const t = mode.targets[mode.idx];
        this.mode = { m: 'play' };
        this.syncOverlay();
        this.act({ type: 'throw', weapon: mode.weapon, target: t });
        return;
      }
      default: break;
    }
    this.syncOverlay();
    this.hud.refresh();
  }

  // ── Shadow Step ──

  private shadowKey(cmd: Command): void {
    if (this.mode.m !== 'shadow') return;
    const mode = this.mode;
    const lv = this.game.level;
    if (cmd.k === 'cancel') {
      this.mode = { m: 'play' };
      delete this.game.player.flags.shadowStep;
      this.game.say('You let the technique go.', 'info');
    } else if (cmd.k === 'move') {
      const d = SCREEN_TO_GRID[cmd.dir];
      const n = { x: mode.cursor.x + d.x, y: mode.cursor.y + d.y };
      const p = lv.c.pos.get(lv.playerId)!;
      if (chebyshev(n, p) <= mode.range && lv.inBounds(n.x, n.y)) mode.cursor = n;
    } else if (cmd.k === 'interact' || cmd.k === 'confirm') {
      const c = mode.cursor;
      this.mode = { m: 'play' };
      this.syncOverlay();
      this.act({ type: 'shadow_step', x: c.x, y: c.y });
      return;
    }
    this.syncOverlay();
    this.hud.refresh();
  }

  private syncOverlay(): void {
    const o = this.renderer.overlay;
    o.aimTarget = this.mode.m === 'aim' ? this.mode.targets[this.mode.idx] : null;
    o.shadowStep = this.mode.m === 'shadow' ? { range: this.mode.range, cursor: this.mode.cursor } : null;
  }

  get modeName(): Mode['m'] { return this.mode.m; }

  // ── Interaction ──

  /** Things the player could do with an adjacent entity. */
  optionsFor(id: EntityId): MenuOption[] {
    const g = this.game, lv = g.level, pid = lv.playerId;
    const opts: MenuOption[] = [];
    const name = cap(displayName(lv, id));
    const door = lv.c.door.get(id);
    if (door) opts.push({ id: 'interact', label: door.open ? 'Close door' : 'Open door' });
    const it = lv.c.interact.get(id);
    if (it) opts.push({ id: 'interact', label: it.label });
    if (isStanding(lv, id) && lv.c.talk.has(id) && !it) opts.push({ id: 'talk', label: `Talk to ${name}` });
    const down = isDown(lv, id) || lv.c.restrained.has(id);
    if (down && lv.c.vitals.has(id) && !lv.c.dummy.has(id)) {
      if (!lv.c.dead.has(id)) {
        if (!lv.c.restrained.has(id) && lv.c.ko.has(id)) opts.push({ id: 'restrain', label: 'Bind and gag' });
        if (lv.c.bleed.has(id) && (g.player.inventory.items.bandage ?? 0) > 0) opts.push({ id: 'bandage', label: 'Bandage wounds' });
        if (isHostile(lv, pid, id) && lv.c.ko.has(id)) opts.push({ id: 'finish', label: 'Finish them', danger: true });
      }
      opts.push({ id: 'search', label: 'Search' });
      if (!lv.c.carrying.has(pid)) opts.push({ id: 'carry', label: 'Carry' });
    }
    if (!down && lv.c.squad.has(id) && lv.c.bleed.has(id)) opts.push({ id: 'bandage', label: `Bandage ${name}` });
    opts.push({ id: 'examine', label: 'Examine' });
    return opts;
  }

  private doOption(id: EntityId, opt: string): void {
    switch (opt) {
      case 'interact': case 'talk': this.act({ type: 'interact', target: id }); break;
      case 'restrain': this.act({ type: 'restrain', target: id }); break;
      case 'bandage': this.act({ type: 'bandage', target: id }); break;
      case 'search': this.act({ type: 'search', target: id }); break;
      case 'carry': this.act({ type: 'carry', target: id }); break;
      case 'finish': this.act({ type: 'finish', target: id }); break;
      case 'examine': this.examine(id); break;
    }
  }

  async interact(): Promise<void> {
    const g = this.game, lv = g.level, pid = lv.playerId;
    if (lv.c.carrying.has(pid)) {
      const choice = await this.menu.show('Carrying', [{ id: 'drop', label: 'Set them down' }, { id: 'cancel', label: 'Keep carrying' }]);
      if (choice === 'drop') this.act({ type: 'drop' });
      return;
    }
    const p = lv.c.pos.get(pid)!;
    const near: EntityId[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      for (const id of lv.at(p.x + dx, p.y + dy)) {
        if (id === pid || lv.c.item.has(id)) continue;
        if (lv.c.door.has(id) || lv.c.interact.has(id) || lv.c.talk.has(id) || (lv.c.vitals.has(id) && !lv.c.dummy.has(id) && (isDown(lv, id) || lv.c.restrained.has(id)))) near.push(id);
      }
    }
    if (!near.length) { g.say('Nothing to interact with here.', 'info'); this.hud.refresh(); return; }
    let id = near[0];
    if (near.length > 1) {
      const pick = await this.menu.show('Interact with…', near.map(e => ({ id: String(e), label: cap(displayName(lv, e)) })));
      if (!pick) return;
      id = Number(pick);
    }
    const opts = this.optionsFor(id);
    // Single obvious action: do it directly.
    const primary = opts.filter(o => o.id !== 'examine');
    if (primary.length === 1 && (lv.c.door.has(id) || lv.c.interact.has(id) || lv.c.talk.has(id))) { this.doOption(id, primary[0].id); return; }
    const choice = await this.menu.show(cap(displayName(lv, id)), opts);
    if (choice) this.doOption(id, choice);
  }

  examine(id: EntityId): void {
    const lv = this.game.level;
    const n = lv.c.name.get(id);
    const parts: string[] = [];
    if (n) parts.push(n.title ? `${n.name}, ${n.title.toLowerCase()}.` : `${cap(n.name)}.`);
    const v = lv.c.vitals.get(id);
    if (lv.c.dead.has(id)) parts.push('Dead.');
    else if (lv.c.ko.has(id)) parts.push(lv.c.restrained.has(id) ? 'Unconscious, bound and gagged.' : 'Unconscious.');
    else if (lv.c.restrained.has(id)) parts.push('Awake, bound and gagged.');
    else if (v && !lv.c.dummy.has(id)) {
      const f = v.hp / v.hpMax;
      parts.push(f > 0.9 ? 'Unhurt.' : f > 0.6 ? 'Lightly wounded.' : f > 0.3 ? 'Badly hurt.' : 'Barely standing.');
    }
    if (lv.c.bleed.has(id)) parts.push('Bleeding.');
    const sheet = lv.c.sheet.get(id);
    if (sheet && id !== lv.playerId && !lv.c.dead.has(id)) {
      const mine = this.game.player.sheet.skills.taijutsu;
      const d = sheet.skills.taijutsu - mine;
      parts.push(d > 15 ? 'Far more skilled than you.' : d > 5 ? 'More skilled than you.' : d < -15 ? 'No match for you.' : d < -5 ? 'Less skilled than you.' : 'About your level.');
    }
    this.game.say(parts.join(' ') || 'Nothing remarkable.', 'info');
    this.hud.refresh();
  }

  private async restMenu(): Promise<void> {
    const g = this.game;
    const lv = g.level;
    if (adjacentFoes(lv, lv.playerId).some(f => isHostile(lv, lv.playerId, f))) { g.say('Not with enemies this close.', 'info'); this.hud.refresh(); return; }
    const choice = await this.menu.show('Pass time', [
      { id: '600', label: 'Wait 1 minute' },
      { id: '6000', label: 'Wait 10 minutes' },
      { id: '36000', label: 'Wait 1 hour' },
      { id: 'dusk', label: 'Wait until nightfall' },
      { id: 'dawn', label: 'Wait until morning' },
    ]);
    if (!choice) return;
    let ticks = Number(choice);
    if (choice === 'dusk' || choice === 'dawn') {
      const target = choice === 'dusk' ? 20 : 6;
      let h = target - g.hour;
      if (h <= 0) h += 24;
      ticks = Math.round(h * TICKS_PER_HOUR);
    }
    const r = rest(g, ticks, true);
    if (r.interrupted === 'enemy') g.say('You are interrupted — someone has spotted you!', 'bad');
    else if (r.interrupted === 'hurt') g.say('Pain jolts you out of your rest.', 'bad');
    this.flush();
  }

  // ── Mouse ──

  private mouseMove(e: MouseEvent): void {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const t = this.renderer.screenToTile(e.clientX - rect.left, e.clientY - rect.top);
    this.renderer.overlay.hover = t;
    if (this.mode.m === 'shadow') {
      const lv = this.game.level;
      const p = lv.c.pos.get(lv.playerId)!;
      if (chebyshev(t, p) <= this.mode.range) { this.mode.cursor = t; this.syncOverlay(); }
    }
    this.hud.hover(t);
  }

  private mouseDown(e: MouseEvent): void {
    if (this.locked) return;
    const g = this.game, lv = g.level, pid = lv.playerId;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const t = this.renderer.screenToTile(e.clientX - rect.left, e.clientY - rect.top);
    if (!lv.inBounds(t.x, t.y) || !lv.explored[lv.idx(t.x, t.y)]) return;
    if (this.mode.m === 'shadow' && e.button === 0) { this.shadowKey({ k: 'confirm' }); return; }
    if (this.mode.m === 'aim') {
      const hit = this.mode.targets.findIndex(id => { const q = lv.c.pos.get(id)!; return q.x === t.x && q.y === t.y; });
      if (hit >= 0) { this.mode.idx = hit; this.aimKey({ k: 'confirm' }); }
      return;
    }
    const p = lv.c.pos.get(pid)!;
    const ents = lv.at(t.x, t.y).filter(id => id !== pid && (lv.c.vitals.has(id) || lv.c.interact.has(id) || lv.c.door.has(id) || lv.c.talk.has(id)));
    if (e.button === 2 && ents.length) {
      if (chebyshev(p, t) <= 1) void this.menu.show(cap(displayName(lv, ents[0])), this.optionsFor(ents[0])).then(c => c && this.doOption(ents[0], c));
      else this.examine(ents[0]);
      return;
    }
    if (e.button !== 0) return;
    const ent = ents[0];
    if (ent !== undefined && chebyshev(p, t) === 1) {
      if (canAttack(lv, pid, ent) && isStanding(lv, ent)) { this.target = ent; this.melee('strike'); return; }
      void this.interact();
      return;
    }
    const path = findPath(lv, p, t, { self: pid, near: ent !== undefined ? 1 : 0, limit: 6000 });
    if (!path || !path.length) return;
    this.walk = path;
    this.walkTimer = 0;
  }

  private tickWalk(now: number): void {
    if (!this.walk.length || this.locked || this.mode.m !== 'play') return;
    if (now < this.walkTimer) return;
    const lv = this.game.level, pid = lv.playerId;
    // Stop when danger appears.
    for (const [id, aw] of lv.c.aware) {
      if (aw.state === 'alert' && aw.target === pid && isStanding(lv, id) && lv.visible[lv.idx(lv.c.pos.get(id)!.x, lv.c.pos.get(id)!.y)]) {
        this.walk = [];
        this.game.say('You stop — you\'ve been spotted.', 'bad');
        this.hud.refresh();
        return;
      }
    }
    const p = lv.c.pos.get(pid)!;
    const next = this.walk.shift()!;
    const ok = this.act({ type: 'move', dx: next.x - p.x, dy: next.y - p.y });
    if (!ok) this.walk = [];
    const stance = lv.c.actor.get(pid)!.stance;
    this.walkTimer = now + (stance === 'sneak' ? 200 : stance === 'run' || stance === 'dash' ? 90 : 130);
  }
}
