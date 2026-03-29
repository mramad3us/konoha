/**
 * Synthesized sound effects via Web Audio API.
 * Zero files, fully offline, infinite variation.
 *
 * Each sound is a short burst of shaped noise/oscillators
 * designed to feel punchy and retro.
 */

import { getSfxVolume } from './volumeManager.ts';

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
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

/** Critical hit — heavy impact + low boom */
export function sfxCritical(): void {
  const ac = getCtx();
  const now = ac.currentTime;

  // Heavy noise burst
  noiseHit(0.15, 3, 60, vol(0.5), 1500);

  // Low boom
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(80, now);
  osc.frequency.exponentialRampToValueAtTime(30, now + 0.2);

  const gain = ac.createGain();
  gain.gain.setValueAtTime(vol(0.5), now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  osc.connect(gain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.25);
}

/** Tempo gain — short ascending chime */
export function sfxTempoGain(): void {
  const ac = getCtx();
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

/** Footstep — very quiet, subtle */
export function sfxStep(): void {
  noiseHit(0.04, 2, 0, vol(0.06), 800 + Math.random() * 400);
}
