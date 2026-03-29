/**
 * Shared AudioContext — initialized on first user interaction.
 * Both SFX and music use this single context.
 * Browsers require a user gesture (click/keydown) to start audio.
 */

let ctx: AudioContext | null = null;
let unlocked = false;

/** Get the shared AudioContext, creating it if needed */
export function getAudioContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
  }
  return ctx;
}

/** Unlock audio on first user interaction — call from a click/keydown handler */
export function unlockAudio(): void {
  if (unlocked) return;
  const ac = getAudioContext();
  if (ac.state === 'suspended') {
    ac.resume().then(() => {
      unlocked = true;
    });
  } else {
    unlocked = true;
  }
}

/** Is audio unlocked? */
export function isAudioUnlocked(): boolean {
  return unlocked && ctx !== null && ctx.state === 'running';
}
