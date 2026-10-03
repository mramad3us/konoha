/**
 * Web Audio engine: one context, master → (music, sfx) buses, cached noise, and small synth
 * building blocks. Silent until unlocked by a user gesture (browser autoplay rules).
 */

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  music!: GainNode;
  sfx!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  volumes = { master: 0.8, music: 0.5, sfx: 0.8 };

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.music = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.ratio.value = 4;
      this.music.connect(this.master);
      this.sfx.connect(this.master);
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolumes(v: Partial<AudioEngine['volumes']>): void {
    Object.assign(this.volumes, v);
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.master, t, 0.05);
    this.music.gain.setTargetAtTime(this.volumes.music * 0.6, t, 0.05);
    this.sfx.gain.setTargetAtTime(this.volumes.sfx, t, 0.05);
  }

  noise(): AudioBuffer {
    if (!this.noiseBuf) {
      const ac = this.ctx!;
      const len = ac.sampleRate * 1.5;
      this.noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuf;
  }

  /** Filtered noise burst. */
  burst(opts: { dur: number; vol: number; freq: number; q?: number; type?: BiquadFilterType; attack?: number; at?: number; dest?: AudioNode; sweepTo?: number }): void {
    const ac = this.ctx;
    if (!ac || !this.ready) return;
    const t = ac.currentTime + (opts.at ?? 0);
    const src = ac.createBufferSource();
    src.buffer = this.noise();
    const f = ac.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
    f.frequency.setValueAtTime(opts.freq, t);
    if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, t + opts.dur);
    f.Q.value = opts.q ?? 1;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(opts.vol, t + (opts.attack ?? 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    src.connect(f); f.connect(g); g.connect(opts.dest ?? this.sfx);
    src.start(t, Math.random() * 1.2, opts.dur + 0.05);
  }

  /** Enveloped oscillator, optional pitch glide. */
  tone(opts: { freq: number; dur: number; vol: number; type?: OscillatorType; to?: number; attack?: number; at?: number; dest?: AudioNode; release?: number }): void {
    const ac = this.ctx;
    if (!ac || !this.ready) return;
    const t = ac.currentTime + (opts.at ?? 0);
    const o = ac.createOscillator();
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(opts.freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + opts.dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(opts.vol, t + (opts.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur + (opts.release ?? 0));
    o.connect(g); g.connect(opts.dest ?? this.sfx);
    o.start(t);
    o.stop(t + opts.dur + (opts.release ?? 0) + 0.05);
  }

  /** Plucked string (koto-ish): decaying triangle + soft noise transient. */
  pluck(freq: number, vol: number, at = 0, dest?: AudioNode, dur = 1.2): void {
    this.tone({ freq, dur, vol, type: 'triangle', attack: 0.003, at, dest });
    this.tone({ freq: freq * 2, dur: dur * 0.4, vol: vol * 0.3, type: 'sine', attack: 0.002, at, dest });
    this.burst({ dur: 0.03, vol: vol * 0.4, freq: freq * 4, q: 2, at, dest });
  }
}

export const engine = new AudioEngine();
