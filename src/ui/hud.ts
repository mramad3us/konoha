/**
 * In-game HUD (DOM over the canvas): vitals, clock, objectives, target & intent, action bar,
 * log, hover tooltip and the character/journal/inventory/help panels.
 */

import type { GameView } from './gameView.ts';
import type { Vec } from '../core/geometry.ts';
import type { EntityId, Move, Skill, Attr } from '../ecs/components.ts';
import { SKILLS, ATTRS } from '../ecs/components.ts';
import { atlas } from '../render/atlas.ts';
import { labelFor, keyLabel, signLabel, BINDINGS } from './keys.ts';
import { tempoSlots, TICKS_PER_DAY, TICKS_PER_HOUR } from '../core/config.ts';
import { engagedWith, adjacentFoes, COUNTER } from '../sim/combat.ts';
import { isStanding } from '../sim/vitals.ts';
import { cap, displayName } from '../sim/names.ts';
import { TECHNIQUES, TECHNIQUE_ORDER, HAND_SIGNS } from '../content/techniques.ts';
import { ITEMS, ITEM_ORDER } from '../content/items.ts';
import { STAT_LABEL } from '../sim/progress.ts';
import { PROPS, TILES } from '../world/tiles.ts';
import { ambientLight } from '../sim/stealth.ts';
import type { LogCat } from '../sim/game.ts';
import { MOVE_LABEL } from '../content/flavor.ts';
import { nextTip, markTip } from './tips.ts';
import { objectives } from '../sim/missions.ts';
import { roster } from '../sim/squad.ts';

type Panel = 'profile' | 'journal' | 'inventory' | 'help';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

const SKILL_HELP: Record<Skill | Attr, string> = {
  taijutsu: 'Melee damage, tempo capacity and how well you read opponents.',
  bukijutsu: 'Throwing accuracy, damage and speed.',
  ninjutsu: 'Unlocks techniques, faster hand signs, cheaper chakra.',
  stealth: 'Harder to spot, faster takedowns.',
  medicine: 'Faster, stronger bandaging.',
  body: 'Health, stamina and striking power.',
  chakra: 'Chakra reserves and recovery.',
  mind: 'Reading opponents, staying composed.',
};

export class Hud {
  private view: GameView;
  private root: HTMLDivElement;
  private vit: HTMLDivElement;
  private portrait: HTMLCanvasElement;
  private nameEl: HTMLDivElement;
  private bars: Record<'hp' | 'sta' | 'cha', { fill: HTMLDivElement; ghost: HTMLDivElement; text: HTMLSpanElement }>;
  private chips: HTMLDivElement;
  private squadEl!: HTMLDivElement;
  private clock: HTMLDivElement;
  private objectives: HTMLDivElement;
  private target: HTMLDivElement;
  private bar: HTMLDivElement;
  private log: HTMLDivElement;
  private tip: HTMLDivElement;
  private tipCard: HTMLDivElement;
  private tipId: string | null = null;
  private tipShownAt = 0;
  private panel: HTMLDivElement;
  private panelKind: Panel | null = null;
  private lastLog = 0;
  private portraitKey = '';
  private tipShown = false;

  constructor(parent: HTMLElement, view: GameView) {
    this.view = view;
    this.root = el('div', 'hud');
    parent.appendChild(this.root);

    // Vitals (top-left)
    this.vit = el('div', 'hud-vit');
    this.portrait = el('canvas', 'hud-portrait');
    this.portrait.width = 22; this.portrait.height = 18;
    const id = el('div', 'hud-id');
    this.nameEl = el('div', 'hud-name');
    id.appendChild(this.nameEl);
    const mk = (cls: string, label: string) => {
      const row = el('div', `bar bar--${cls}`);
      row.appendChild(el('span', 'bar__label', label));
      const track = el('div', 'bar__track');
      const ghost = el('div', 'bar__ghost');
      const fill = el('div', 'bar__fill');
      track.append(ghost, fill);
      const text = el('span', 'bar__text');
      row.append(track, text);
      id.appendChild(row);
      return { fill, ghost, text };
    };
    this.bars = { hp: mk('hp', 'HP'), sta: mk('sta', 'STA'), cha: mk('cha', 'CHK') };
    this.chips = el('div', 'hud-chips');
    id.appendChild(this.chips);
    this.vit.append(this.portrait, id);
    this.root.appendChild(this.vit);
    this.squadEl = el('div', 'hud-squad');
    this.root.appendChild(this.squadEl);

    // Clock & objectives (top-right)
    const tr = el('div', 'hud-tr');
    this.clock = el('div', 'hud-clock');
    this.objectives = el('div', 'hud-obj');
    tr.append(this.clock, this.objectives);
    this.root.appendChild(tr);

    this.target = el('div', 'hud-target');
    this.root.appendChild(this.target);
    this.bar = el('div', 'hud-bar');
    this.root.appendChild(this.bar);
    this.log = el('div', 'hud-log');
    this.root.appendChild(this.log);
    this.tip = el('div', 'hud-tip');
    this.tip.hidden = true;
    this.root.appendChild(this.tip);
    this.tipCard = el('div', 'hud-hint');
    this.tipCard.hidden = true;
    this.tipCard.addEventListener('click', () => this.dismissTip());
    this.root.appendChild(this.tipCard);
    this.panel = el('div', 'hud-panel');
    this.panel.hidden = true;
    this.root.appendChild(this.panel);
  }

  get panelOpen(): boolean {
    return this.panelKind !== null;
  }

  /** Keys while a panel is open. Returns true if consumed. */
  panelKey(e: KeyboardEvent): boolean {
    const map: Record<string, Panel> = { KeyP: 'profile', KeyO: 'journal', KeyI: 'inventory', Slash: 'help', F1: 'help' };
    if (e.code === 'Escape') { this.close(); return true; }
    if (map[e.code]) { this.toggle(map[e.code]); return true; }
    return true;
  }

  toggle(p: Panel): void {
    if (this.panelKind === p) { this.close(); return; }
    this.panelKind = p;
    this.panel.hidden = false;
    this.renderPanel();
  }

  close(): void {
    this.panelKind = null;
    this.panel.hidden = true;
  }

  frame(_now: number): void {
    // Ghost bars catch up smoothly to the real value.
    for (const b of Object.values(this.bars)) {
      const target = parseFloat(b.fill.style.width) || 0;
      const cur = parseFloat(b.ghost.style.width) || 0;
      if (Math.abs(cur - target) > 0.2) b.ghost.style.width = `${cur + (target - cur) * 0.08}%`;
      else b.ghost.style.width = `${target}%`;
    }
  }

  refresh(): void {
    const g = this.view.game, lv = g.level, pid = lv.playerId;
    const v = g.player.vitals;
    const set = (k: 'hp' | 'sta' | 'cha', cur: number, max: number) => {
      const pct = Math.max(0, Math.min(100, (cur / Math.max(1, max)) * 100));
      const b = this.bars[k];
      const prev = parseFloat(b.fill.style.width) || 0;
      b.fill.style.width = `${pct}%`;
      if (pct > prev) b.ghost.style.width = `${pct}%`;
      b.text.textContent = `${Math.ceil(cur)}/${max}`;
    };
    set('hp', v.hp, v.hpMax);
    set('sta', v.sta, v.staMax);
    set('cha', v.chakra, v.chakraMax);
    this.nameEl.innerHTML = '';
    this.nameEl.append(el('span', 'hud-name__n', g.player.name.name), el('span', 'hud-name__r', cap(g.player.sheet.rank)));
    this.drawPortrait();

    // Status chips
    this.chips.innerHTML = '';
    const chip = (t: string, cls: string) => this.chips.appendChild(el('span', `chip chip--${cls}`, t));
    const actor = lv.c.actor.get(pid);
    const stanceName = { walk: 'Walking', run: 'Running', sneak: 'Sneaking', dash: 'Chakra dash' }[actor?.stance ?? 'walk'];
    chip(stanceName, actor?.stance ?? 'walk');
    if (g.player.lethal) chip('Kunai drawn', 'lethal');
    if (lv.c.bleed.has(pid)) chip('Bleeding', 'bleed');
    if (lv.c.invisible.has(pid)) chip('Vanished', 'vanish');
    if (lv.c.combat.get(pid)?.staggered) chip('Staggered', 'stagger');
    if (lv.c.carrying.has(pid)) chip('Carrying', 'carry');
    if (lv.c.signing.has(pid)) {
      const s = lv.c.signing.get(pid)!.signs.map(i => HAND_SIGNS[i].jp).join(', ');
      chip(`Signs: ${s}`, 'sign');
    }

    // Clock
    const day = Math.floor(g.clock / TICKS_PER_DAY) + 1;
    const hour = Math.floor((g.clock % TICKS_PER_DAY) / TICKS_PER_HOUR);
    const min = Math.floor(((g.clock % TICKS_PER_HOUR) / TICKS_PER_HOUR) * 60);
    const light = ambientLight(g.hour);
    const phase = light >= 0.99 ? 'Day' : light <= 0.2 ? 'Night' : g.hour < 12 ? 'Dawn' : 'Dusk';
    this.clock.innerHTML = '';
    this.clock.append(
      el('span', 'hud-clock__loc', lv.meta.name),
      el('span', 'hud-clock__time', `Day ${day}, ${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`),
      el('span', `hud-clock__phase hud-clock__phase--${phase.toLowerCase()}`, phase),
    );

    // Objectives
    const lines = objectives(g);
    this.objectives.innerHTML = '';
    this.objectives.hidden = lines.length === 0;
    for (const l of lines) this.objectives.appendChild(el('div', `obj${l.done ? ' obj--done' : ''}`, l.text));

    this.renderSquad();
    this.updateTip();
    this.renderTarget();
    this.renderBar();
    this.renderLog();
    if (this.panelKind) this.renderPanel();
  }

  private renderSquad(): void {
    const lv = this.view.game.level;
    this.squadEl.innerHTML = '';
    for (const [id, tag] of lv.c.squad) {
      const v = lv.c.vitals.get(id);
      const down = lv.c.ko.has(id), dead = lv.c.dead.has(id);
      const row = el('div', `sq${down ? ' sq--down' : ''}${dead ? ' sq--gone' : ''}`);
      const name = lv.c.name.get(id)?.name ?? tag.rosterId;
      row.append(el('span', 'sq__name', dead ? `${name} (dead)` : down ? `${name} (down)` : lv.c.invisible.has(id) ? `${name} (vanished)` : name));
      const bar = el('div', 'sq__bar');
      const fill = el('div', 'sq__fill');
      fill.style.width = `${v ? Math.max(0, (v.hp / v.hpMax) * 100) : 0}%`;
      bar.append(fill);
      row.append(bar);
      this.squadEl.append(row);
    }
  }

  private updateTip(): void {
    const g = this.view.game;
    if (this.tipId) {
      // A shown tip stays a while, then yields to the next one.
      if (performance.now() - this.tipShownAt > 14000) this.dismissTip();
      return;
    }
    const t = nextTip(g);
    if (!t) return;
    this.tipId = t.id;
    this.tipShownAt = performance.now();
    markTip(g, t.id);
    this.tipCard.innerHTML = '';
    this.tipCard.append(el('p', 'hud-hint__text', t.text), el('span', 'hud-hint__close', 'Click to dismiss'));
    this.tipCard.hidden = false;
  }

  dismissTip(): void {
    this.tipId = null;
    this.tipCard.hidden = true;
  }

  private drawPortrait(): void {
    const a = this.view.game.player.appearance;
    const key = JSON.stringify(a);
    if (key === this.portraitKey) return;
    this.portraitKey = key;
    const f = atlas.character(a, 'idle', false, false);
    const ctx = this.portrait.getContext('2d')!;
    ctx.clearRect(0, 0, 22, 18);
    ctx.drawImage(f.cv, 0, 3, 22, 18, 0, 0, 22, 18);
  }

  private renderTarget(): void {
    const lv = this.view.game.level, pid = lv.playerId;
    const t = this.view.currentTarget;
    this.target.innerHTML = '';
    const aim = this.view.aimInfo();
    if (aim) {
      this.target.hidden = false;
      this.target.append(
        el('div', 'tg__name', `Throw ${aim.weapon} at ${cap(displayName(lv, aim.target))}`),
        el('div', 'tg__aim', `${aim.chance}% to hit`),
        el('div', 'tg__keys', `${labelFor('target')} next target · ${labelFor('throw')} switch weapon · ${labelFor('interact')} throw · Esc cancel`),
      );
      return;
    }
    if (this.view.modeName === 'shadow') {
      this.target.hidden = false;
      this.target.append(el('div', 'tg__name', 'Shadow Step'), el('div', 'tg__keys', `Move the cursor · ${labelFor('interact')} / click to step · Esc cancel`));
      return;
    }
    if (t === null || !isStanding(lv, t)) { this.target.hidden = true; return; }
    this.target.hidden = false;
    const name = lv.c.name.get(t);
    const v = lv.c.vitals.get(t);
    const head = el('div', 'tg__head');
    head.append(el('span', 'tg__name', cap(displayName(lv, t))));
    if (name?.title) head.append(el('span', 'tg__title', name.title));
    this.target.appendChild(head);
    if (v && !lv.c.dummy.has(t)) {
      const track = el('div', 'tg__hp');
      const fill = el('div', 'tg__hpfill');
      fill.style.width = `${Math.max(0, (v.hp / v.hpMax) * 100)}%`;
      track.appendChild(fill);
      this.target.appendChild(track);
    }
    const c = lv.c.combat.get(t);
    const intent = el('div', 'tg__intent');
    if (lv.c.dummy.has(t)) {
      intent.append(el('span', 'tg__read', 'Training dummy — it only absorbs blows.'));
    } else if (c?.intent && c.intentTarget === pid) {
      const icon = (m: Move, dim = false) => {
        const s = el('span', `mv mv--${m}${dim ? ' mv--dim' : ''}`, MOVE_LABEL[m]);
        return s;
      };
      if (c.reveal === 'clear') {
        intent.append(el('span', 'tg__read', 'You read'), icon(c.intent), el('span', 'tg__counter', `→ ${MOVE_LABEL[COUNTER[c.intent]]} beats it`));
      } else if (c.reveal === 'partial' && c.revealAlt) {
        intent.append(el('span', 'tg__read', 'Either'), icon(c.intent), el('span', 'tg__or', 'or'), icon(c.revealAlt));
      } else {
        intent.append(el('span', 'tg__read tg__read--hidden', 'You can\'t read their intent'));
      }
    } else {
      const aw = lv.c.aware.get(t);
      intent.append(el('span', 'tg__read', aw?.state === 'alert' ? 'Ready to fight' : 'Unaware of you — strike for a takedown'));
    }
    this.target.appendChild(intent);
    const others = engagedWith(lv, pid).filter(o => o !== t).length;
    if (others) this.target.appendChild(el('div', 'tg__warn', `${others} more on you — only Guard covers you from them`));
    if (adjacentFoes(lv, pid).length > 1) this.target.appendChild(el('div', 'tg__keys', `${labelFor('target')} switch target`));
  }

  private renderBar(): void {
    const g = this.view.game, lv = g.level, pid = lv.playerId;
    this.bar.innerHTML = '';
    const group = (title: string) => {
      const gEl = el('div', 'hb-group');
      gEl.title = title;
      const row = el('div', 'hb-row');
      gEl.appendChild(row);
      this.bar.appendChild(gEl);
      return row;
    };
    const btn = (row: HTMLElement, key: string, label: string, opts: { cls?: string; count?: number | string; off?: boolean; on?: boolean; title?: string } = {}) => {
      const b = el('div', `hb ${opts.cls ?? ''}${opts.off ? ' hb--off' : ''}${opts.on ? ' hb--on' : ''}`);
      b.append(el('span', 'hb__key', key), el('span', 'hb__label', label));
      if (opts.count !== undefined) b.append(el('span', 'hb__count', String(opts.count)));
      if (opts.title) b.title = opts.title;
      row.appendChild(b);
      return b;
    };
    // Melee
    const c = lv.c.combat.get(pid);
    const melee = group('Melee');
    const sta = g.player.vitals.sta;
    btn(melee, labelFor('strike'), 'Strike', { cls: 'hb--strike', off: sta < 1, title: 'Beats Break. Loses to Guard. 1 stamina.' });
    btn(melee, labelFor('break'), 'Break', { cls: 'hb--break', off: sta < 2, title: 'Beats Guard (staggers). Loses to Strike. 2 stamina.' });
    btn(melee, labelFor('guard'), 'Guard', { cls: 'hb--guard', title: 'Beats Strike (parry). Loses to Break. Recovers stamina.' });
    const slots = tempoSlots(g.player.sheet.skills.taijutsu);
    const pips = el('div', 'tempo');
    pips.title = 'Tempo: win exchanges to build it. Spend to slip away or for Kawarimi.';
    for (let i = 0; i < slots; i++) pips.appendChild(el('span', `tempo__pip${i < (c?.tempo ?? 0) ? ' tempo__pip--on' : ''}`));
    melee.appendChild(pips);

    // Movement
    const mv = group('Stance');
    const st = lv.c.actor.get(pid)?.stance;
    btn(mv, labelFor('sneak'), 'Sneak', { on: st === 'sneak' });
    btn(mv, labelFor('run'), 'Run', { on: st === 'run' });
    if (g.player.sheet.techniques.includes('dash')) btn(mv, labelFor('dash'), 'Dash', { on: st === 'dash' });

    // Tools
    const inv = g.player.inventory.items;
    const tools = group('Tools');
    btn(tools, labelFor('throw'), 'Throw', { count: `${inv.kunai ?? 0}/${inv.shuriken ?? 0}`, off: !(inv.kunai || inv.shuriken), title: 'Kunai / shuriken' });
    btn(tools, labelFor('bandage'), 'Bandage', { count: inv.bandage ?? 0, off: !inv.bandage });
    btn(tools, labelFor('lethal'), g.player.lethal ? 'Kunai' : 'Fists', { on: g.player.lethal, title: 'Lethal intent: blades bleed and can kill' });

    // Ninjutsu
    const known = g.player.sheet.techniques;
    if (known.length) {
      const nj = group('Ninjutsu');
      if (known.includes('kawarimi')) btn(nj, labelFor('kawarimi'), 'Kawarimi', { off: g.player.vitals.chakra < TECHNIQUES.kawarimi.cost(g.player.sheet.skills.ninjutsu), title: TECHNIQUES.kawarimi.description });
      for (const id of known) {
        const t = TECHNIQUES[id];
        if (!t.signs) continue;
        btn(nj, t.signs.map(s => signLabel(s)).join(''), t.name, { cls: 'hb--signs', title: `${t.signs.map(s => HAND_SIGNS[s].jp).join(' – ')} · ${t.description}` });
      }
    }
  }

  private renderLog(): void {
    const g = this.view.game;
    // Collapse runs of identical lines ("The way is blocked. ×3").
    const merged: Array<{ text: string; cat: LogCat; n: number }> = [];
    for (const e of g.log.slice(-30)) {
      const last = merged[merged.length - 1];
      if (last && last.text === e.text) last.n++;
      else merged.push({ text: e.text, cat: e.cat, n: 1 });
    }
    const entries = merged.slice(-6);
    const newest = g.log.length ? g.log[g.log.length - 1].tick : 0;
    this.log.innerHTML = '';
    entries.forEach((e, i) => {
      const age = entries.length - 1 - i;
      const line = el('div', `log log--${e.cat}`, e.n > 1 ? `${e.text} ×${e.n}` : e.text);
      line.style.opacity = String(Math.max(0.35, 1 - age * 0.11));
      this.log.appendChild(line);
    });
    if (newest !== this.lastLog) this.lastLog = newest;
  }

  hover(t: Vec): void {
    const lv = this.view.game.level;
    if (!lv.inBounds(t.x, t.y) || !lv.explored[lv.idx(t.x, t.y)]) { this.tip.hidden = true; return; }
    if (this.tip.hidden && !this.tipShown) this.tipShown = true;
    const parts: string[] = [];
    const vis = lv.visible[lv.idx(t.x, t.y)];
    if (vis) {
      for (const id of lv.at(t.x, t.y)) {
        if (id === lv.playerId || lv.c.carried.has(id)) continue;
        if (lv.c.invisible.has(id)) continue;
        const n = lv.c.name.get(id);
        if (!n) continue;
        let s = cap(n.name);
        if (n.title && n.title !== n.name) s += ` (${n.title})`;
        if (lv.c.dead.has(id)) s += ' — dead';
        else if (lv.c.ko.has(id)) s += ' — unconscious';
        parts.push(s);
      }
    }
    const p = lv.prop(t.x, t.y);
    if (p) parts.push(cap(PROPS[p].name) + (PROPS[p].cover ? ' — cover' : ''));
    parts.push(cap(TILES[lv.tile(t.x, t.y)].name));
    this.tip.hidden = false;
    this.tip.textContent = parts.join(' · ');
  }

  private renderPanel(): void {
    const g = this.view.game;
    const p = this.panel;
    p.innerHTML = '';
    const close = el('div', 'panel__close', `Esc`);
    p.appendChild(close);
    switch (this.panelKind) {
      case 'profile': {
        p.appendChild(el('h2', 'panel__title', g.player.name.name));
        p.appendChild(el('div', 'panel__sub', `${cap(g.player.sheet.rank)} of the Hidden Leaf, carrying ${g.player.inventory.ryo} ryo`));
        const sec = (t: string) => { p.appendChild(el('h3', 'panel__h', t)); };
        const row = (k: Skill | Attr, v: number) => {
          const r = el('div', 'stat');
          r.append(el('span', 'stat__name', STAT_LABEL[k]));
          const tr = el('div', 'stat__track');
          const f = el('div', 'stat__fill');
          f.style.width = `${v}%`;
          const frac = el('div', 'stat__frac');
          frac.style.width = `${(v % 1) * 100}%`;
          tr.append(f);
          r.append(tr, el('span', 'stat__val', String(Math.floor(v))));
          r.append(el('div', 'stat__help', SKILL_HELP[k]));
          const next = el('div', 'stat__next');
          next.appendChild(frac);
          r.appendChild(next);
          p.appendChild(r);
        };
        sec('Attributes');
        for (const a of ATTRS) row(a, g.player.sheet.attrs[a]);
        sec('Skills');
        for (const s of SKILLS) row(s, g.player.sheet.skills[s]);
        sec('Techniques');
        for (const id of TECHNIQUE_ORDER) {
          const t = TECHNIQUES[id];
          const known = g.player.sheet.techniques.includes(id);
          const r = el('div', `tech${known ? '' : ' tech--locked'}`);
          r.append(el('span', 'tech__name', known ? t.name : `${t.name} — Ninjutsu ${t.unlock}`));
          if (t.signs) r.append(el('span', 'tech__signs', t.signs.map(s => `${HAND_SIGNS[s].jp} [${signLabel(s)}]`).join('  ')));
          r.append(el('div', 'tech__desc', t.description));
          p.appendChild(r);
        }
        sec('Squad');
        for (const m of roster(g)) {
          const r = el('div', 'tech');
          const state = m.status === 'dead' ? 'killed in action' : m.status === 'injured' ? `recovering until day ${Math.floor(m.until / TICKS_PER_DAY) + 1}` : 'ready';
          r.append(el('span', 'tech__name', m.name), el('span', 'tech__desc', `${m.personality}, ${m.missions} mission${m.missions === 1 ? '' : 's'} with you, ${state}`));
          p.appendChild(r);
        }
        p.appendChild(el('p', 'panel__p', 'Squadmates train alongside you: on a mission they fight at roughly your level, a little better or worse in each skill. They copy your stance and, if they know it, your Vanish.'));
        const rec = g.player.record;
        sec('Record');
        p.appendChild(el('div', 'panel__sub', `Missions D ${rec.missions.D} · C ${rec.missions.C} · B ${rec.missions.B} · A ${rec.missions.A} · Failed ${rec.failed} · Takedowns ${rec.takedowns}`));
        break;
      }
      case 'inventory': {
        p.appendChild(el('h2', 'panel__title', 'Pack'));
        p.appendChild(el('div', 'panel__sub', `${g.player.inventory.ryo} ryo`));
        for (const k of ITEM_ORDER) {
          const n = g.player.inventory.items[k] ?? 0;
          const r = el('div', 'item');
          r.append(el('span', 'item__name', `${cap(ITEMS[k].plural)}`), el('span', 'item__n', `× ${n}`), el('div', 'item__desc', ITEMS[k].description));
          p.appendChild(r);
        }
        break;
      }
      case 'journal': {
        p.appendChild(el('h2', 'panel__title', 'Journal'));
        const lines = (g.ext.journal as string[] | undefined) ?? [];
        const obj = objectives(g);
        if (obj.length) { p.appendChild(el('h3', 'panel__h', 'Current')); for (const o of obj) p.appendChild(el('div', `obj${o.done ? ' obj--done' : ''}`, o.text)); }
        if (lines.length) { p.appendChild(el('h3', 'panel__h', 'Notes')); for (const l of lines) p.appendChild(el('p', 'panel__p', l)); }
        p.appendChild(el('h3', 'panel__h', 'Recent'));
        for (const e of g.log.slice(-18).reverse()) p.appendChild(el('div', `log log--${e.cat}`, e.text));
        break;
      }
      case 'help': {
        p.appendChild(el('h2', 'panel__title', 'Controls'));
        const seen = new Set<string>();
        const grid = el('div', 'keys');
        for (const b of BINDINGS) {
          if (b.cmd.k === 'sign' || seen.has(b.label + b.cmd.k)) continue;
          seen.add(b.label + b.cmd.k);
          const r = el('div', 'keys__row');
          r.append(el('span', 'keys__k', b.codes.slice(0, 3).map(keyLabel).join(' ')), el('span', 'keys__l', b.cmd.k === 'move' ? `Move ${(b.cmd as { dir: string }).dir}` : b.label));
          grid.appendChild(r);
        }
        const r = el('div', 'keys__row');
        r.append(el('span', 'keys__k', HAND_SIGNS.map((_, i) => signLabel(i)).join(' ')), el('span', 'keys__l', 'Hand signs (' + HAND_SIGNS.map(h => h.jp).join(', ') + ')'));
        grid.appendChild(r);
        p.appendChild(grid);
        p.appendChild(el('h3', 'panel__h', 'The exchange'));
        p.appendChild(el('p', 'panel__p', 'Strike beats Break. Break beats Guard. Guard beats Strike. Enemies show what they intend above their heads — the better your Taijutsu, the clearer the read. Winning builds tempo; tempo hits harder, reads better, and pays for Kawarimi or a clean escape.'));
        p.appendChild(el('h3', 'panel__h', 'Stealth'));
        p.appendChild(el('p', 'panel__p', 'Sneak to see enemy sight lines. Stay out of their cones, keep to grass and shadow, and strike an unaware enemy from behind for a silent takedown. Running and fighting make noise.'));
        break;
      }
    }
  }
}

export type { EntityId };
