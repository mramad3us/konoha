/**
 * Synthesized music via Web Audio API.
 * Epic main menu theme — dark, atmospheric, shinobi-inspired.
 *
 * Uses a pentatonic minor scale (Japanese-flavored) with:
 * - Deep taiko-style drum pulse
 * - Haunting melodic lead (square wave, filtered)
 * - Atmospheric pad drone
 * - Shakuhachi-like breathy melody fragments
 */

import { getMusicVolume } from './volumeManager.ts';
import { getAudioContext, isAudioUnlocked } from './audioContext.ts';
let isPlaying = false;
let masterGain: GainNode | null = null;
let loopTimers: number[] = [];

function getCtx(): AudioContext | null {
  if (!isAudioUnlocked()) return null;
  return getAudioContext();
}

// ── JAPANESE PENTATONIC MINOR (In Sen scale in D) ──
// D - Eb - G - A - Bb
const SCALE = [146.83, 155.56, 196.00, 220.00, 233.08]; // D3, Eb3, G3, A3, Bb3
const SCALE_HIGH = SCALE.map(f => f * 2); // octave up
const SCALE_LOW = SCALE.map(f => f / 2);  // octave down

function noteFromScale(scale: number[], index: number): number {
  return scale[((index % scale.length) + scale.length) % scale.length];
}

// ── TAIKO DRUM ──
function playDrum(ac: AudioContext, time: number, volume: number, pitch: number = 55): void {
  // Membrane (sine with pitch drop)
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(pitch * 1.5, time);
  osc.frequency.exponentialRampToValueAtTime(pitch, time + 0.05);
  osc.frequency.exponentialRampToValueAtTime(pitch * 0.5, time + 0.3);

  const gain = ac.createGain();
  gain.gain.setValueAtTime(volume, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);

  // Noise transient (the "thwack")
  const bufSize = Math.floor(ac.sampleRate * 0.05);
  const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

  const noise = ac.createBufferSource();
  noise.buffer = buf;

  const nFilter = ac.createBiquadFilter();
  nFilter.type = 'lowpass';
  nFilter.frequency.value = 400;

  const nGain = ac.createGain();
  nGain.gain.setValueAtTime(volume * 0.6, time);
  nGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

  osc.connect(gain).connect(masterGain!);
  noise.connect(nFilter).connect(nGain).connect(masterGain!);

  osc.start(time);
  osc.stop(time + 0.5);
  noise.start(time);
  noise.stop(time + 0.1);
}

// ── PAD DRONE ──
function startDrone(ac: AudioContext, time: number): OscillatorNode[] {
  const oscs: OscillatorNode[] = [];
  const root = SCALE_LOW[0]; // D2

  for (const detune of [0, 7.02, -5.01]) { // slight detuning for richness
    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = root;
    osc.detune.value = detune;

    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    filter.Q.value = 2;

    // Slow filter sweep for movement
    filter.frequency.setValueAtTime(200, time);
    filter.frequency.linearRampToValueAtTime(400, time + 8);
    filter.frequency.linearRampToValueAtTime(200, time + 16);

    const gain = ac.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.06, time + 2);

    osc.connect(filter).connect(gain).connect(masterGain!);
    osc.start(time);
    oscs.push(osc);
  }

  return oscs;
}

// ── MELODIC LEAD ──
function playNote(ac: AudioContext, time: number, freq: number, duration: number, vol: number): void {
  const osc = ac.createOscillator();
  osc.type = 'square';
  osc.frequency.value = freq;

  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1200, time);
  filter.frequency.exponentialRampToValueAtTime(400, time + duration);

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(vol, time + 0.02);
  gain.gain.setValueAtTime(vol * 0.7, time + duration * 0.3);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

  osc.connect(filter).connect(gain).connect(masterGain!);
  osc.start(time);
  osc.stop(time + duration + 0.05);
}

// ── BREATHY FLUTE (shakuhachi-like) ──
function playFlute(ac: AudioContext, time: number, freq: number, duration: number, vol: number): void {
  // Breathy noise component
  const bufSize = Math.floor(ac.sampleRate * duration);
  const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

  const noise = ac.createBufferSource();
  noise.buffer = buf;

  const nFilter = ac.createBiquadFilter();
  nFilter.type = 'bandpass';
  nFilter.frequency.value = freq * 2;
  nFilter.Q.value = 5;

  const nGain = ac.createGain();
  nGain.gain.setValueAtTime(0, time);
  nGain.gain.linearRampToValueAtTime(vol * 0.3, time + 0.05);
  nGain.gain.exponentialRampToValueAtTime(0.001, time + duration);

  // Tone component (triangle = soft)
  const osc = ac.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, time);
  // Slight vibrato
  const lfo = ac.createOscillator();
  lfo.frequency.value = 5;
  const lfoGain = ac.createGain();
  lfoGain.gain.value = 3;
  lfo.connect(lfoGain).connect(osc.frequency);
  lfo.start(time);
  lfo.stop(time + duration);

  const tGain = ac.createGain();
  tGain.gain.setValueAtTime(0, time);
  tGain.gain.linearRampToValueAtTime(vol, time + 0.08);
  tGain.gain.setValueAtTime(vol * 0.8, time + duration * 0.4);
  tGain.gain.exponentialRampToValueAtTime(0.001, time + duration);

  noise.connect(nFilter).connect(nGain).connect(masterGain!);
  osc.connect(tGain).connect(masterGain!);

  noise.start(time);
  noise.stop(time + duration + 0.05);
  osc.start(time);
  osc.stop(time + duration + 0.05);
}

// ── MELODY PATTERNS ──
// Each number is a scale degree (0-4), -1 = rest

const MELODY_A = [0, -1, 3, 4, -1, 3, 1, -1];
const MELODY_B = [3, 4, 3, 1, 0, -1, -1, -1];
const FLUTE_A = [4, -1, -1, 3, -1, -1, 1, -1];

// ── MAIN LOOP SCHEDULER ──

function scheduleLoop(ac: AudioContext): void {
  const bpm = 70;
  const beatLen = 60 / bpm;
  const barLen = beatLen * 4;
  const loopLen = barLen * 4; // 4 bars per loop
  let startTime = ac.currentTime + 0.1;

  function scheduleBar(barOffset: number, barIndex: number): void {
    const t = startTime + barOffset;

    // ── Taiko pattern ──
    // Bar 1 & 3: strong beat pattern
    // Bar 2 & 4: variation
    if (barIndex % 2 === 0) {
      playDrum(ac, t, 0.3);
      playDrum(ac, t + beatLen * 2, 0.2);
      playDrum(ac, t + beatLen * 3, 0.15, 70);
    } else {
      playDrum(ac, t, 0.25);
      playDrum(ac, t + beatLen * 1.5, 0.15, 70);
      playDrum(ac, t + beatLen * 2.5, 0.2);
      playDrum(ac, t + beatLen * 3.5, 0.12, 80);
    }

    // ── Melodic lead ──
    const melody = barIndex < 2 ? MELODY_A : MELODY_B;
    const noteLen = beatLen * 0.45;
    for (let i = 0; i < melody.length; i++) {
      if (melody[i] >= 0) {
        const freq = noteFromScale(SCALE_HIGH, melody[i]);
        playNote(ac, t + i * (beatLen / 2), freq, noteLen, 0.08);
      }
    }

    // ── Flute (bars 2 & 4 only — sparse, haunting) ──
    if (barIndex >= 2) {
      const flute = FLUTE_A;
      for (let i = 0; i < flute.length; i++) {
        if (flute[i] >= 0) {
          const freq = noteFromScale(SCALE_HIGH, flute[i]);
          playFlute(ac, t + i * (beatLen / 2), freq, beatLen * 0.8, 0.07);
        }
      }
    }
  }

  // Schedule 4 bars
  for (let bar = 0; bar < 4; bar++) {
    scheduleBar(bar * barLen, bar);
  }

  // Start drone (will be stopped at end of loop)
  const droneOscs = startDrone(ac, startTime);

  // Schedule drone fade-out near end of loop
  const fadeStart = startTime + loopLen - 1.0;
  for (const osc of droneOscs) {
    try { osc.stop(fadeStart + 1.5); } catch { /* */ }
  }

  // Schedule next loop — no overlap, exact boundary
  const timer = window.setTimeout(() => {
    if (isPlaying) scheduleLoop(ac);
  }, loopLen * 1000);

  loopTimers.push(timer);
}

// ── PUBLIC API ──

export function startMenuMusic(): void {
  if (isPlaying) return;
  const ac = getCtx();
  if (!ac) return;

  masterGain = ac.createGain();
  const musicVol = getMusicVolume() * 0.6;
  masterGain.gain.value = musicVol;
  console.log('[AUDIO DEBUG] Music starting, volume:', musicVol, 'context state:', ac.state);
  masterGain.connect(ac.destination);

  isPlaying = true;
  scheduleLoop(ac);
}

export function stopMenuMusic(): void {
  if (!isPlaying) return;
  isPlaying = false;

  // Fade out
  if (masterGain) {
    const ac = getCtx();
    if (ac) masterGain.gain.linearRampToValueAtTime(0, ac.currentTime + 1.0);
    setTimeout(() => {
      masterGain?.disconnect();
      masterGain = null;
    }, 1200);
  }

  // Clear timers
  for (const t of loopTimers) clearTimeout(t);
  loopTimers = [];
}

export function isMenuMusicPlaying(): boolean {
  return isPlaying;
}
