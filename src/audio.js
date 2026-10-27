// Every sound is synthesized at runtime with WebAudio: no audio files, nothing to license, ~0 KB.

const MUTE_KEY = 'recall.muted.v1';

export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      /* storage blocked: default unmuted */
    }
  }

  // Browsers only allow audio after a user gesture, so this runs on the first click/key.
  unlock() {
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
      this.master.gain.value = 0.5;
      this.master.connect(comp);
      const len = c.sampleRate;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    return this.muted;
  }

  get live() {
    return this.ctx && !this.muted && this.ctx.state === 'running';
  }

  envelope(gain, t, attack, dur, vol) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  tone(type, f0, f1, dur, vol = 0.2, delay = 0) {
    if (!this.live) return;
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

  noise(dur, f0, f1, vol = 0.2, q = 1.2, type = 'bandpass', delay = 0) {
    if (!this.live) return;
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

  throw() { this.noise(0.17, 450, 2600, 0.28, 2.2); }
  recall() { this.noise(0.14, 2400, 650, 0.22, 2.2); this.tone('sine', 660, 990, 0.08, 0.05); }
  bounce() { this.tone('triangle', 1300, 800, 0.05, 0.06); }
  // Pitch climbs a semitone per consecutive hit, so a long chain sounds like a run up a scale.
  hit(step) {
    const f = 196 * 2 ** (Math.min(step, 20) / 12);
    this.tone('square', f, f * 0.55, 0.07, 0.07);
    this.noise(0.05, 3200, 1400, 0.12, 1);
  }
  kill() { this.tone('sine', 150, 42, 0.22, 0.38); this.noise(0.12, 900, 180, 0.2, 0.8, 'lowpass'); }
  catch(mult) {
    const f = 523.25 * 2 ** (((Math.min(mult, 8) - 1) * 2) / 12);
    this.tone('triangle', f, 0, 0.13, 0.15);
    this.tone('sine', f * 1.5, 0, 0.18, 0.07, 0.03);
  }
  catchSoft() { this.tone('triangle', 330, 0, 0.06, 0.06); }
  whiff() { this.tone('sine', 330, 200, 0.16, 0.07); }
  dash() { this.noise(0.12, 1500, 300, 0.18, 1); }
  hurt() { this.tone('sawtooth', 220, 55, 0.35, 0.18); this.noise(0.25, 700, 120, 0.25, 0.7, 'lowpass'); }
  spawn() { this.tone('sine', 85, 140, 0.25, 0.05); }
  shoot() { this.tone('square', 300, 110, 0.1, 0.04); }
  clink() { this.tone('square', 1900, 1400, 0.04, 0.06); }
  wave() { [0, 4, 7].forEach((s, i) => this.tone('triangle', 392 * 2 ** (s / 12), 0, 0.18, 0.09, i * 0.09)); }
  clear() { [0, 4, 7, 12].forEach((s, i) => this.tone('triangle', 523.25 * 2 ** (s / 12), 0, 0.2, 0.08, i * 0.07)); }
  heal() { [7, 12].forEach((s, i) => this.tone('sine', 523.25 * 2 ** (s / 12), 0, 0.25, 0.1, i * 0.1)); }
  gameOver() { [12, 7, 3, 0].forEach((s, i) => this.tone('triangle', 261.6 * 2 ** (s / 12), 0, 0.35, 0.1, i * 0.17)); }
}
