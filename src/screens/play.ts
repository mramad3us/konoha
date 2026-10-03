/**
 * The play screen: a GameView plus the flow logic that answers the sim's UI requests —
 * facilities, conversations, the gate, travel, ambushes, extraction, defeat, duels, pause.
 */

import type { Game, UiRequest } from '../sim/game.ts';
import type { Rank } from '../ecs/components.ts';
import { GameView } from '../ui/gameView.ts';
import { inkWipe, h, button } from '../ui/kit.ts';
import { Sheet } from '../ui/sheet.ts';
import { openDesk, openShop, openHospital, openRamen, openHome, openTraining, openAcademy } from '../ui/facilities.ts';
import { TravelView } from '../ui/travel.ts';
import { saveGame } from '../sim/save.ts';
import { writeSave, loadSettings, saveSettings, type Settings } from '../ui/storage.ts';
import { active, isAway, fieldDone, objectives } from '../sim/missions.ts';
import { depart, travel, enterAmbush, leaveAmbush, arrive, extract, returnHome, rescue, journey, startHome } from '../sim/journey.ts';
import { startDuel, duelOf } from '../sim/duel.ts';
import { spotsOf } from '../sim/campaign.ts';
import { place, TRAVEL_KMH } from '../content/world.ts';
import { atlas } from '../render/atlas.ts';
import { cap as capName, displayName } from '../sim/names.ts';
import { engine } from '../audio/engine.ts';
import { music } from '../audio/music.ts';
import { chebyshev } from '../core/geometry.ts';
import { isStanding } from '../sim/vitals.ts';
import { advance } from '../sim/turn.ts';

export interface PlayHost {
  toTitle: () => void;
}

export class PlayFlow {
  readonly root: HTMLElement;
  game: Game;
  view: GameView;
  readonly slot: string;
  private started = performance.now();
  private played: number;
  private host: PlayHost;
  private autosaveTimer = 0;
  settings: Settings = loadSettings();

  constructor(root: HTMLElement, game: Game, slot: string, playedSeconds: number, host: PlayHost) {
    this.root = root;
    this.game = game;
    this.slot = slot;
    this.played = playedSeconds;
    this.host = host;
    this.view = new GameView(root, game, {
      onRequest: (_v, r) => this.handle(r),
      onMenu: () => { void this.pause(); },
    });
    this.applySettings();
  }

  start(): void {
    this.view.start();
    this.syncObjectives();
    this.autosaveTimer = window.setInterval(() => { if (this.game.level.kind === 'village' && !this.view.locked) void this.autosave(); }, 180_000);
    music.play(this.game);
  }

  dispose(): void {
    clearInterval(this.autosaveTimer);
    music.stop();
    this.view.dispose();
  }

  applySettings(): void {
    engine.setVolumes({ master: this.settings.master, music: this.settings.music, sfx: this.settings.sfx });
    this.view.renderer.setZoom(this.settings.zoom);
  }

  playSeconds(): number {
    return this.played + (performance.now() - this.started) / 1000;
  }

  async save(): Promise<void> {
    await writeSave(this.slot, saveGame(this.game, this.playSeconds()));
  }

  async autosave(): Promise<void> {
    try { await this.save(); } catch (e) { console.warn('Autosave failed', e); }
  }

  /** Fade through ink while changing the world. */
  async wipe(fn: () => void): Promise<void> {
    await inkWipe(this.root, () => {
      fn();
      this.view.rebind(this.game);
      this.syncObjectives();
    });
    music.play(this.game);
  }

  syncObjectives(): void {
    this.game.ext.objectives = objectives(this.game);
    this.view.hud.refresh();
  }

  // ── Requests from the sim ──

  private async handle(r: UiRequest): Promise<void> {
    const g = this.game;
    switch (r.kind) {
      case 'facility': {
        const f = r.facility;
        if (f === 'desk') await openDesk(this);
        else if (f === 'shop') await openShop(this);
        else if (f === 'hospital') await openHospital(this);
        else if (f === 'ramen') await openRamen(this);
        else if (f === 'home') await openHome(this);
        else if (f === 'training') await openTraining(this);
        else if (f === 'academy') await openAcademy(this);
        break;
      }
      case 'talk':
        await this.talk(r.entity);
        break;
      case 'defeat':
        await new Promise(res => setTimeout(res, 700));
        await this.wipe(() => { rescue(g); });
        void this.autosave();
        break;
      case 'leave_area':
        await this.leaveArea();
        break;
      default:
        break;
    }
    this.syncObjectives();
    this.view.flush();
  }

  private async talk(id: number): Promise<void> {
    const g = this.game, lv = g.level;
    const talk = lv.c.talk.get(id);
    const name = lv.c.name.get(id);
    if (!talk || !name) return;
    const line = talk.lines[(talk.next ?? 0) % talk.lines.length];
    talk.next = (talk.next ?? 0) + 1;
    g.say(`${name.name}: "${line}"`, 'speech');
    const box = h('div', 'talk');
    const app = lv.c.appearance.get(id);
    if (app) {
      const f = atlas.character(app, 'idle', false, false);
      const c = document.createElement('canvas');
      c.width = 22; c.height = 18;
      c.getContext('2d')!.drawImage(f.cv, 0, 3, 22, 18, 0, 0, 22, 18);
      c.className = 'talk__face';
      box.append(c);
    }
    box.append(h('div', 'talk__text', h('div', 'talk__name', name.name, h('span', 'talk__title', name.title ?? '')), h('p', 'talk__line', line)));
    this.root.appendChild(box);
    await new Promise<void>(res => {
      const close = () => { window.removeEventListener('keydown', onKey, true); box.remove(); res(); };
      const onKey = (e: KeyboardEvent) => { e.preventDefault(); e.stopPropagation(); close(); };
      setTimeout(() => window.addEventListener('keydown', onKey, true), 120);
      box.addEventListener('click', close);
    });
  }

  private async choose(title: string, text: string, options: Array<{ id: string; label: string }>): Promise<string | null> {
    const sheet = new Sheet(this.root, title, 'washi');
    sheet.body.append(h('p', 'svc__line', text));
    let picked: string | null = null;
    const row = h('div', 'svc__actions svc__actions--col');
    options.forEach((o, i) => {
      const go = () => { picked = o.id; sheet.close(); };
      row.append(button(o.label, go, 'btn', String(i + 1)));
      sheet.bind(`Digit${i + 1}`, go);
    });
    sheet.body.append(row);
    await sheet.wait();
    return picked;
  }

  private stepBack(): void {
    const lv = this.game.level;
    const p = lv.c.pos.get(lv.playerId)!;
    for (const [dx, dy] of [[0, -1], [-1, -1], [1, -1], [0, 1]]) {
      if (lv.isFree(p.x + dx, p.y + dy)) { lv.moveTo(lv.playerId, p.x + dx, p.y + dy); break; }
    }
    this.view.renderer.visuals.snapAll(lv);
  }

  private async leaveArea(): Promise<void> {
    const g = this.game, lv = g.level;
    const a = active(g);
    if (lv.kind === 'village') {
      if (!a || !isAway(a.m) || a.status !== 'active') {
        g.say(a && isAway(a.m) ? 'Your work out there is done. Report to the Mission Desk.' : 'You have no business outside the walls without a mission.', 'info');
        this.stepBack();
        return;
      }
      const dest = place(a.m.place!);
      const hours = dest.km / TRAVEL_KMH;
      const eta = Math.floor((g.hour + hours) % 24);
      const choice = await this.choose(`Depart for ${dest.name}`, `${dest.blurb} About ${dest.km} km — ${hours.toFixed(1)} hours on the move. Leaving now, you'd arrive around ${String(eta).padStart(2, '0')}:00.`, [
        { id: 'now', label: 'Depart now' },
        { id: 'dusk', label: 'Leave so you arrive after dark' },
        { id: 'no', label: 'Not yet' },
      ]);
      if (choice !== 'now' && choice !== 'dusk') { this.stepBack(); return; }
      await this.autosave();
      depart(g, choice === 'dusk');
      await this.journeyLoop();
      return;
    }
    if (lv.kind === 'encounter') {
      const cid = a?.refs.client;
      const pp = lv.c.pos.get(lv.playerId)!;
      if (cid !== undefined && lv.entities.has(cid) && isStanding(lv, cid) && chebyshev(lv.c.pos.get(cid)!, pp) > 4) {
        g.say('You can\'t leave the client behind.', 'bad');
        this.stepBack();
        return;
      }
      const foes = [...lv.c.aware].filter(([id, aw]) => isStanding(lv, id) && aw.state === 'alert').length;
      const choice = await this.choose('Back to the road', foes ? 'Enemies are still on your trail. Run for it?' : 'The way ahead is clear.', [
        { id: 'go', label: foes ? 'Run' : 'Continue the journey' },
        { id: 'stay', label: 'Stay' },
      ]);
      if (choice !== 'go') { this.stepBack(); return; }
      leaveAmbush(g);
      await this.journeyLoop();
      return;
    }
    // Mission map
    const done = fieldDone(g);
    const failed = a?.status === 'failed';
    const choice = await this.choose(`Leave ${lv.meta.name}`, failed ? 'The mission is lost. Head home.' : done ? 'The job is done. Head home and report.' : 'The job isn\'t done. If you leave now, the mission fails.', [
      { id: 'go', label: done || failed ? 'Head home' : 'Leave anyway' },
      { id: 'stay', label: 'Stay' },
    ]);
    if (choice !== 'go') { this.stepBack(); return; }
    extract(g);
    this.syncObjectives();
    await this.journeyLoop();
  }

  /** Show the map and advance the journey until the player has control again. */
  private async journeyLoop(): Promise<void> {
    const g = this.game;
    const tv = new TravelView(this.root);
    try {
      for (;;) {
        const j = journey(g);
        if (!j) return;
        const from = j.done;
        const step = travel(g);
        await tv.show(g, j, from, j.done);
        if (step.kind === 'ambush') {
          await tv.stamp('Ambush');
          tv.close();
          await this.wipe(() => { enterAmbush(g); advance(g); });
          return;
        }
        if (step.kind === 'arrive') {
          let lv: ReturnType<typeof arrive> = null;
          tv.close();
          await this.wipe(() => { lv = arrive(g); if (lv) advance(g); });
          if (lv) return;
          // Escort: no map. Turn around.
          startHome(g, j);
          continue;
        }
        tv.close();
        await this.wipe(() => { returnHome(g); });
        void this.autosave();
        return;
      }
    } finally {
      tv.close();
    }
  }

  // ── Duels ──

  async startSpar(name: string): Promise<void> {
    const g = this.game, lv = g.level;
    const id = [...lv.c.name].find(([, n]) => n.name === name)?.[0];
    if (id === undefined || !isStanding(lv, id)) { g.say(`${name} isn't around right now.`, 'info'); return; }
    await this.wipe(() => { startDuel(g, lv, spotsOf(g).arena, id, 'spar'); });
  }

  async startTrial(rank: Rank): Promise<void> {
    const g = this.game, lv = g.level;
    await this.wipe(() => {
      startDuel(g, lv, spotsOf(g).arena, rank === 'chunin' ? 'examiner_chunin' : 'examiner_jonin', 'trial', rank);
      void duelOf;
    });
  }

  // ── Pause ──

  private async pause(): Promise<void> {
    const sheet = new Sheet(this.root, 'Paused', 'ink', `${this.game.player.name.name}, ${capName(this.game.player.sheet.rank).toLowerCase()}, on day ${this.game.day}`);
    let result: 'quit' | null = null;
    const col = h('div', 'svc__actions svc__actions--col');
    const add = (label: string, key: string, fn: () => void) => { col.append(button(label, fn, 'btn', key)); sheet.bind(`Digit${key}`, fn); };
    add('Resume', '1', () => sheet.close());
    add('Save', '2', () => { void this.save().then(() => { this.game.say('Progress saved.', 'system'); this.view.hud.refresh(); }); sheet.close(); });
    add('Controls', '3', () => { sheet.close(); this.view.hud.toggle('help'); });
    add('Settings', '4', () => { sheet.close(); void this.settingsSheet(); });
    add('Save and quit to title', '5', () => { result = 'quit'; sheet.close(); });
    sheet.body.append(col);
    await sheet.wait();
    if (result === 'quit') {
      await this.save();
      this.host.toTitle();
    }
  }

  async settingsSheet(): Promise<void> {
    const sheet = new Sheet(this.root, 'Settings', 'ink');
    sheet.body.append(settingsForm(this.settings, s => { this.settings = s; saveSettings(s); this.applySettings(); }));
    await sheet.wait();
  }
}

export function settingsForm(s: Settings, onChange: (s: Settings) => void): HTMLElement {
  const form = h('div', 'settings');
  const slider = (label: string, key: 'master' | 'music' | 'sfx') => {
    const input = h('input', 'settings__range');
    input.type = 'range'; input.min = '0'; input.max = '1'; input.step = '0.05'; input.value = String(s[key]);
    const out = h('span', 'settings__val', `${Math.round(s[key] * 100)}%`);
    input.addEventListener('input', () => { s = { ...s, [key]: Number(input.value) }; out.textContent = `${Math.round(s[key] * 100)}%`; onChange(s); });
    form.append(h('label', 'settings__row', h('span', 'settings__label', label), input, out));
  };
  slider('Master volume', 'master');
  slider('Music', 'music');
  slider('Sound effects', 'sfx');
  const zoom = h('div', 'settings__row', h('span', 'settings__label', 'Zoom'));
  for (const z of [2, 3, 4]) {
    zoom.append(button(`${z}×`, () => { s = { ...s, zoom: z }; onChange(s); zoom.querySelectorAll('.btn').forEach((b, i) => b.classList.toggle('btn--on', [2, 3, 4][i] === z)); }, `btn btn--small${s.zoom === z ? ' btn--on' : ''}`));
  }
  form.append(zoom);
  void displayName;
  return form;
}
