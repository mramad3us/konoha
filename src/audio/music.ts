/**
 * Generative music. Short phrases on Japanese pentatonic scales, chosen by context:
 * title, village by day, village by night, away (tense), combat (taiko).
 */

import { engine as E } from './engine.ts';
import type { Game } from '../sim/game.ts';
import { isStanding } from '../sim/vitals.ts';

type Mode = 'title' | 'day' | 'night' | 'away' | 'combat' | 'silent';

const HIRAJOSHI = [0, 2, 3, 7, 8];
const IN_SEN = [0, 1, 5, 7, 10];
const YO = [0, 2, 5, 7, 9];

function freq(root: number, scale: number[], step: number): number {
  const oct = Math.floor(step / scale.length);
  const deg = ((step % scale.length) + scale.length) % scale.length;
  return root * Math.pow(2, oct + scale[deg] / 12);
}

class Music {
  private mode: Mode = 'silent';
  private timer = 0;
  private bar = 0;
  private game: Game | null = null;
  private drone: OscillatorNode[] = [];
  private droneGain: GainNode | null = null;

  title(): void { this.game = null; this.set('title'); }

  play(g: Game): void {
    this.game = g;
    this.set(this.pick());
  }

  stop(): void { this.set('silent'); }

  private pick(): Mode {
    const g = this.game;
    if (!g) return 'title';
    const lv = g.level;
    for (const [id, aw] of lv.c.aware) if (aw.state === 'alert' && isStanding(lv, id) && aw.target === lv.playerId) return 'combat';
    if (lv.kind !== 'village') return 'away';
    return g.hour >= 19 || g.hour < 6 ? 'night' : 'day';
  }

  private set(m: Mode): void {
    if (m === this.mode && this.timer) return;
    this.mode = m;
    clearInterval(this.timer);
    this.timer = 0;
    this.setDrone(m === 'away' || m === 'night' || m === 'combat' || m === 'title');
    if (m === 'silent') return;
    this.bar = 0;
    this.timer = window.setInterval(() => this.tick(), 2400);
  }

  private setDrone(on: boolean): void {
    const ac = E.ctx;
    if (!ac || !E.ready) return;
    if (!on) {
      if (this.droneGain) { this.droneGain.gain.setTargetAtTime(0, ac.currentTime, 0.8); const d = this.drone; setTimeout(() => d.forEach(o => o.stop()), 3000); }
      this.drone = []; this.droneGain = null;
      return;
    }
    if (this.droneGain) return;
    const g = ac.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(0.05, ac.currentTime, 1.5);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 400;
    for (const f of [55, 82.4]) {
      const o = ac.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = f;
      o.detune.value = Math.random() * 8 - 4;
      o.connect(lp); o.start();
      this.drone.push(o);
    }
    lp.connect(g); g.connect(E.music);
    this.droneGain = g;
  }

  private tick(): void {
    if (!E.ready) return;
    // Re-evaluate context every few bars.
    if (this.game && this.bar % 2 === 1) {
      const m = this.pick();
      if (m !== this.mode) { this.set(m); return; }
    }
    const b = this.bar++;
    const dest = E.music;
    switch (this.mode) {
      case 'title':
      case 'night': {
        const root = 196;
        const steps = [4, 3, 2, 0, 2, 3, 5, 4];
        if (b % 2 === 0) {
          for (let i = 0; i < 3; i++) {
            const s = steps[(b + i * 3) % steps.length] + (i === 2 ? -2 : 0);
            this.flute(freq(root, HIRAJOSHI, s), i * 0.8, 0.7);
          }
        }
        if (this.mode === 'night') this.crickets();
        else E.pluck(freq(98, HIRAJOSHI, b % 5), 0.12, 0, dest, 2.4);
        break;
      }
      case 'day': {
        const root = 220;
        const phrase = [[0, 2, 4, 3], [2, 4, 5, 4], [4, 3, 2, 0], [1, 2, 0, -1]][b % 4];
        phrase.forEach((s, i) => E.pluck(freq(root, YO, s), 0.09, i * 0.6, dest, 1.4));
        if (b % 2 === 0) E.pluck(freq(110, YO, 0), 0.07, 0, dest, 2.2);
        break;
      }
      case 'away': {
        const root = 146.8;
        if (b % 2 === 0) E.pluck(freq(root, IN_SEN, [0, 3, 1, 4][(b / 2) % 4]), 0.08, 0.2, dest, 2.2);
        if (b % 4 === 3) this.taiko(0, 0.12);
        break;
      }
      case 'combat': {
        for (const [t, v] of [[0, 0.3], [0.6, 0.18], [1.2, 0.26], [1.5, 0.14], [1.8, 0.2]] as const) this.taiko(t, v);
        E.pluck(freq(146.8, IN_SEN, [0, 1, 0, 3][b % 4]), 0.08, 0, dest, 1.2);
        break;
      }
      default: break;
    }
  }

  private flute(f: number, at: number, dur: number): void {
    const ac = E.ctx!;
    const t = ac.currentTime + at;
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f * 0.985, t);
    o.frequency.linearRampToValueAtTime(f, t + 0.12);
    const vib = ac.createOscillator();
    vib.frequency.value = 5;
    const vg = ac.createGain();
    vg.gain.value = f * 0.006;
    vib.connect(vg); vg.connect(o.frequency);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.6);
    o.connect(g); g.connect(E.music);
    E.burst({ dur: dur * 0.6, vol: 0.012, freq: f * 2, q: 4, at, dest: E.music });
    o.start(t); vib.start(t);
    o.stop(t + dur + 0.7); vib.stop(t + dur + 0.7);
  }

  private taiko(at: number, vol: number): void {
    E.tone({ freq: 70, to: 45, dur: 0.35, vol, type: 'sine', at, dest: E.music });
    E.burst({ dur: 0.15, vol: vol * 0.5, freq: 180, q: 0.7, type: 'lowpass', at, dest: E.music });
  }

  private crickets(): void {
    for (let i = 0; i < 4; i++) {
      if (Math.random() < 0.5) continue;
      for (let k = 0; k < 3; k++) E.burst({ dur: 0.03, vol: 0.01, freq: 4800 + Math.random() * 600, q: 12, at: i * 0.6 + k * 0.06, dest: E.music });
    }
  }
}

export const music = new Music();
