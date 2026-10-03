/**
 * App shell: title → creator / saves / settings → play. Dev scenarios (?dev=…) jump straight in.
 */

import { renderTitle } from './title.ts';
import { renderCreator } from './creator.ts';
import { renderSaves } from './saves.ts';
import { PlayFlow, settingsForm } from './play.ts';
import { newGame } from '../sim/campaign.ts';
import { loadGame } from '../sim/save.ts';
import { readSave, lastSaveId, newSlotId, loadSettings, saveSettings, writeSave } from '../ui/storage.ts';
import { saveGame } from '../sim/save.ts';
import { engine } from '../audio/engine.ts';
import { inkWipe, h, button } from '../ui/kit.ts';
import { devScenario } from '../dev/scenarios.ts';
import type { Game } from '../sim/game.ts';
import { knownTechniques } from '../content/techniques.ts';
import { refreshMaxima } from '../sim/vitals.ts';
import { refreshBoard } from '../sim/missions.ts';

export async function boot(root: HTMLElement): Promise<void> {
  const unlock = () => engine.unlock();
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  const s = loadSettings();
  engine.setVolumes({ master: s.master, music: s.music, sfx: s.sfx });
  await document.fonts.ready;
  const app = new App(root);
  const dev = new URLSearchParams(location.search).get('dev');
  if (dev) app.play(devScenario(dev), 'dev', 0);
  else await app.title();
}

class App {
  private root: HTMLElement;
  private stage: HTMLDivElement;
  private cleanup: (() => void) | null = null;
  private flow: PlayFlow | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.stage = h('div', 'stage');
    root.appendChild(this.stage);
  }

  private clear(): void {
    this.cleanup?.();
    this.cleanup = null;
    this.flow?.dispose();
    this.flow = null;
    this.stage.innerHTML = '';
  }

  private async go(fn: () => void | Promise<void>): Promise<void> {
    await inkWipe(this.root, async () => { this.clear(); await fn(); }, 300);
  }

  async title(): Promise<void> {
    const last = lastSaveId();
    const save = last ? await readSave(last).catch(() => null) : null;
    this.clear();
    this.cleanup = renderTitle(this.stage, {
      continueGame: save ? () => void this.go(() => this.load(last!)) : null,
      newGame: () => void this.go(() => this.creator()),
      load: () => void this.go(() => this.saves()),
      settings: () => void this.go(() => this.settings()),
    });
  }

  private creator(): void {
    this.cleanup = renderCreator(this.stage, r => {
      void this.go(async () => {
        const g = newGame(r.name, r.frame, r.appearance, (Math.random() * 2 ** 31) | 0);
        if (loadSettings().dev) makeElite(g);
        const slot = newSlotId();
        await writeSave(slot, saveGame(g, 0));
        this.play(g, slot, 0);
      });
    }, () => void this.go(() => this.title()));
  }

  private saves(): void {
    this.cleanup = renderSaves(this.stage, id => void this.go(() => this.load(id)), () => void this.go(() => this.title()));
  }

  private settings(): void {
    let s = loadSettings();
    const panel = h('div', 'saves__panel', h('h2', 'saves__title', 'Settings'), settingsForm(s, n => { s = n; saveSettings(n); engine.setVolumes({ master: n.master, music: n.music, sfx: n.sfx }); }));
    panel.append(h('div', 'saves__actions', button('Back', () => void this.go(() => this.title()), 'btn btn--ghost')));
    this.stage.append(h('div', 'saves', panel));
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape') void this.go(() => this.title()); };
    window.addEventListener('keydown', onKey);
    this.cleanup = () => window.removeEventListener('keydown', onKey);
  }

  private async load(id: string): Promise<void> {
    const data = await readSave(id);
    if (!data) { await this.title(); return; }
    try {
      this.play(loadGame(data), id, data.meta.playSeconds);
    } catch (e) {
      console.error(e);
      await this.title();
    }
  }

  play(g: Game, slot: string, played: number): void {
    this.clear();
    this.flow = new PlayFlow(this.stage, g, slot, played, { toTitle: () => void this.go(() => this.title()) });
    this.flow.start();
    (window as unknown as { __view: unknown; __flow: unknown }).__view = this.flow.view;
    (window as unknown as { __flow: unknown }).__flow = this.flow;
  }
}

/** Dev mode: an elite jonin with everything unlocked, for testing. */
function makeElite(g: Game): void {
  const sh = g.player.sheet;
  for (const k of Object.keys(sh.skills) as Array<keyof typeof sh.skills>) sh.skills[k] = 90;
  for (const k of Object.keys(sh.attrs) as Array<keyof typeof sh.attrs>) sh.attrs[k] = 90;
  sh.rank = 'jonin';
  sh.techniques = knownTechniques(90);
  g.player.name.title = 'Jonin';
  g.player.appearance.vest = 'chunin';
  refreshMaxima(g.player.vitals, sh);
  Object.assign(g.player.vitals, { hp: g.player.vitals.hpMax, sta: g.player.vitals.staMax, chakra: g.player.vitals.chakraMax });
  g.player.inventory.ryo = 10000;
  Object.assign(g.player.inventory.items, { kunai: 20, shuriken: 20, bandage: 10, soldier_pill: 5 });
  g.player.record.missions = { D: 5, C: 10, B: 10, A: 0 };
  refreshBoard(g);
  g.say('Dev mode: you start as an elite jonin.', 'system');
}
