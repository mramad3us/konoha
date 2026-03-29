/**
 * Synthesized sound effects via Web Audio API.
 * Zero files, fully offline, infinite variation.
 *
 * Each sound is a short burst of shaped noise/oscillators
 * designed to feel punchy and retro.
 */

import { getSfxVolume } from './volumeManager.ts';
import { getAudioContext, isAudioUnlocked } from './audioContext.ts';

function getCtx(): AudioContext | null {
  if (!isAudioUnlocked()) return null;
  return getAudioContext();
}

/** Scale volume by SFX setting */
function vol(base: number): number {
  return base * getSfxVolume();
}

/** Short noise burst shaped by an envelope — the core of impact sounds */
function noiseHit(
  duration: number,
  attackMs: number,
  freq: number,
  volume: number,
  filterFreq: number,
): void {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;

  // White noise source
  const bufferSize = Math.floor(ac.sampleRate * duration);
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ac.createBufferSource();
  noise.buffer = buffer;

  // Bandpass filter to shape the character
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = filterFreq;
  filter.Q.value = 1.2;

  // Amplitude envelope
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + attackMs / 1000);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  // Optional tonal component for thud
  if (freq > 0) {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const oscGain = ac.createGain();
    oscGain.gain.setValueAtTime(volume * 0.4, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.6);
    osc.connect(oscGain).connect(ac.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  noise.connect(filter).connect(gain).connect(ac.destination);
  noise.start(now);
  noise.stop(now + duration);
}

// ── PUBLIC SOUND EFFECTS ──

/** Punch landing — sharp, mid-frequency crack */
export function sfxPunchHit(): void {
  const variation = 0.9 + Math.random() * 0.2;
  noiseHit(0.08 * variation, 3, 120 * variation, vol(0.35), 2000 + Math.random() * 800);
}

/** Kick landing — deeper, slightly longer thud */
export function sfxKickHit(): void {
  const variation = 0.9 + Math.random() * 0.2;
  noiseHit(0.12 * variation, 4, 80 * variation, vol(0.4), 1200 + Math.random() * 600);
}

/** Block/parry — short, high metallic clack */
export function sfxBlock(): void {
  const variation = 0.9 + Math.random() * 0.2;
  noiseHit(0.05 * variation, 2, 300 * variation, vol(0.2), 4000 + Math.random() * 1000);
}

/** Miss/whiff — quiet swoosh */
export function sfxWhiff(): void {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  const duration = 0.1 + Math.random() * 0.04;

  const bufferSize = Math.floor(ac.sampleRate * duration);
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ac.createBufferSource();
  noise.buffer = buffer;

  const filter = ac.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 3000;

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(vol(0.08), now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  noise.connect(filter).connect(gain).connect(ac.destination);
  noise.start(now);
  noise.stop(now + duration);
}

/** Critical hit — cinematic multi-layered impact */
export function sfxCritical(): void {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;

  // Layer 1: Sharp initial crack (high freq noise transient)
  noiseHit(0.04, 1, 0, vol(0.6), 5000);

  // Layer 2: Heavy body impact (slightly delayed, mid freq)
  noiseHit(0.12, 3, 90, vol(0.5), 1200);

  // Layer 3: Deep sub-bass boom (the "weight" of the hit)
  const sub = ac.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(60, now + 0.02);
  sub.frequency.exponentialRampToValueAtTime(20, now + 0.4);

  const subGain = ac.createGain();
  subGain.gain.setValueAtTime(vol(0.6), now + 0.02);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

  sub.connect(subGain).connect(ac.destination);
  sub.start(now + 0.02);
  sub.stop(now + 0.5);

  // Layer 4: Metallic ring (the "power" resonance, like a bell struck)
  const ring = ac.createOscillator();
  ring.type = 'triangle';
  ring.frequency.setValueAtTime(800, now + 0.01);
  ring.frequency.exponentialRampToValueAtTime(200, now + 0.5);

  const ringFilter = ac.createBiquadFilter();
  ringFilter.type = 'bandpass';
  ringFilter.frequency.value = 600;
  ringFilter.Q.value = 8;

  const ringGain = ac.createGain();
  ringGain.gain.setValueAtTime(vol(0.15), now + 0.01);
  ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

  ring.connect(ringFilter).connect(ringGain).connect(ac.destination);
  ring.start(now + 0.01);
  ring.stop(now + 0.65);

  // Layer 5: Reverse-swell tail (brief rising tone before silence — dramatic punctuation)
  const swell = ac.createOscillator();
  swell.type = 'sawtooth';
  swell.frequency.setValueAtTime(100, now + 0.15);
  swell.frequency.linearRampToValueAtTime(300, now + 0.35);

  const swellFilter = ac.createBiquadFilter();
  swellFilter.type = 'lowpass';
  swellFilter.frequency.value = 500;

  const swellGain = ac.createGain();
  swellGain.gain.setValueAtTime(0, now + 0.15);
  swellGain.gain.linearRampToValueAtTime(vol(0.08), now + 0.25);
  swellGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

  swell.connect(swellFilter).connect(swellGain).connect(ac.destination);
  swell.start(now + 0.15);
  swell.stop(now + 0.45);
}

/** Tempo gain — short ascending chime */
export function sfxTempoGain(): void {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;

  const osc = ac.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(600, now);
  osc.frequency.linearRampToValueAtTime(900, now + 0.08);

  const gain = ac.createGain();
  gain.gain.setValueAtTime(vol(0.15), now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  osc.connect(gain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.12);
}

/** Tempo spend — short descending tone */
export function sfxTempoSpend(): void {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;

  const osc = ac.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(800, now);
  osc.frequency.linearRampToValueAtTime(400, now + 0.1);

  const gain = ac.createGain();
  gain.gain.setValueAtTime(vol(0.12), now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

  osc.connect(gain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.1);
}

/** Stalemate clash — two sharp impacts overlapping */
export function sfxClash(): void {
  sfxBlock();
  setTimeout(() => noiseHit(0.06, 2, 150, 0.25, 2500), 20);
}

/** Menu click — short metallic kunai clash */
export function sfxMenuClick(): void {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  const v = vol(0.2);

  // Sharp metallic transient
  const bufSize = Math.floor(ac.sampleRate * 0.03);
  const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

  const noise = ac.createBufferSource();
  noise.buffer = buf;

  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 6000 + Math.random() * 2000;
  filter.Q.value = 3;

  const nGain = ac.createGain();
  nGain.gain.setValueAtTime(v, now);
  nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

  // Metallic ring
  const ring = ac.createOscillator();
  ring.type = 'triangle';
  ring.frequency.value = 2000 + Math.random() * 800;

  const rGain = ac.createGain();
  rGain.gain.setValueAtTime(v * 0.4, now);
  rGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  noise.connect(filter).connect(nGain).connect(ac.destination);
  ring.connect(rGain).connect(ac.destination);

  noise.start(now);
  noise.stop(now + 0.06);
  ring.start(now);
  ring.stop(now + 0.15);
}

/** Footstep — very quiet, subtle */
export function sfxStep(): void {
  noiseHit(0.04, 2, 0, vol(0.06), 800 + Math.random() * 400);
}
