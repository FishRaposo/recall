// Every sound is synthesized at runtime with WebAudio: no audio files, nothing to license, ~0 KB.

import type { Settings } from './settings.ts';
import type { SfxLike } from '../core/types.ts';

export class Sfx implements SfxLike {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  noiseBuf: AudioBuffer | null = null;
  muted = false;
  volume = 0.5;

  constructor() {
    // Settings are applied by the shell; these are safe defaults before the first gesture.
  }

  configure(settings: Settings): void {
    this.muted = settings.muted;
    this.volume = settings.volume;
    if (this.master) this.master.gain.value = settings.muted ? 0 : settings.volume;
  }

  // Browsers only allow audio after a user gesture, so this runs on the first click/key.
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = new AC();
      this.ctx = c;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.connect(c.destination);
      this.master = c.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(comp);
      const len = c.sampleRate;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => { /* page may be navigating */ });
  }

  get live(): boolean {
    return !!this.ctx && !this.muted && this.ctx.state === 'running';
  }

  private envelope(gain: GainNode, t: number, attack: number, dur: number, vol: number): void {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol = 0.2, delay = 0): void {
    if (!this.live || !this.ctx || !this.master) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    this.envelope(g, t, 0.005, dur, vol);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  private noise(dur: number, f0: number, f1: number, vol = 0.2, q = 1.2, type: BiquadFilterType = 'bandpass', delay = 0): void {
    if (!this.live || !this.ctx || !this.master || !this.noiseBuf) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    this.envelope(g, t, 0.004, dur, vol);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.03);
  }

  throw(): void { this.noise(0.17, 450, 2600, 0.28, 2.2); }
  recall(): void { this.noise(0.14, 2400, 650, 0.22, 2.2); this.tone('sine', 660, 990, 0.08, 0.05); }
  bounce(): void { this.tone('triangle', 1300, 800, 0.05, 0.06); }
  // Pitch climbs a semitone per consecutive hit, so a long chain sounds like a run up a scale.
  hit(step: number): void {
    const f = 196 * 2 ** (Math.min(step, 20) / 12);
    this.tone('square', f, f * 0.55, 0.07, 0.07);
    this.noise(0.05, 3200, 1400, 0.12, 1);
  }
  kill(): void { this.tone('sine', 150, 42, 0.22, 0.38); this.noise(0.12, 900, 180, 0.2, 0.8, 'lowpass'); }
  catch(mult: number): void {
    const f = 523.25 * 2 ** (((Math.min(mult, 8) - 1) * 2) / 12);
    this.tone('triangle', f, 0, 0.13, 0.15);
    this.tone('sine', f * 1.5, 0, 0.18, 0.07, 0.03);
  }
  catchSoft(): void { this.tone('triangle', 330, 0, 0.06, 0.06); }
  whiff(): void { this.tone('sine', 330, 200, 0.16, 0.07); }
  dash(): void { this.noise(0.12, 1500, 300, 0.18, 1); }
  hurt(): void { this.tone('sawtooth', 220, 55, 0.35, 0.18); this.noise(0.25, 700, 120, 0.25, 0.7, 'lowpass'); }
  spawn(): void { this.tone('sine', 85, 140, 0.25, 0.05); }
  shoot(): void { this.tone('square', 300, 110, 0.1, 0.04); }
  clink(): void { this.tone('square', 1900, 1400, 0.04, 0.06); }
  wave(): void { [0, 4, 7].forEach((s, i) => this.tone('triangle', 392 * 2 ** (s / 12), 0, 0.18, 0.09, i * 0.09)); }
  clear(): void { [0, 4, 7, 12].forEach((s, i) => this.tone('triangle', 523.25 * 2 ** (s / 12), 0, 0.2, 0.08, i * 0.07)); }
  heal(): void { [7, 12].forEach((s, i) => this.tone('sine', 523.25 * 2 ** (s / 12), 0, 0.25, 0.1, i * 0.1)); }
  gameOver(): void { [12, 7, 3, 0].forEach((s, i) => this.tone('triangle', 261.6 * 2 ** (s / 12), 0, 0.35, 0.1, i * 0.17)); }
}
