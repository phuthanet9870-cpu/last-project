/** Original procedural audio (§54): generated chiptune BGM per area mood, SFX, and an in-game radio. No external audio files. */
const MOODS: Record<string, { scale: number[]; bpm: number; wave: OscillatorType; root: number; bass: OscillatorType }> = {
  town: { scale: [0, 2, 4, 7, 9], bpm: 92, wave: 'triangle', root: 60, bass: 'sine' },
  forest: { scale: [0, 2, 3, 7, 9], bpm: 84, wave: 'triangle', root: 57, bass: 'sine' },
  hills: { scale: [0, 2, 4, 5, 7, 9], bpm: 104, wave: 'square', root: 62, bass: 'triangle' },
  snow: { scale: [0, 3, 5, 7, 10], bpm: 70, wave: 'sine', root: 64, bass: 'sine' },
  dungeon: { scale: [0, 1, 3, 7, 8], bpm: 96, wave: 'sawtooth', root: 50, bass: 'square' },
  boss: { scale: [0, 1, 3, 6, 7], bpm: 140, wave: 'square', root: 52, bass: 'sawtooth' },
  farm: { scale: [0, 2, 4, 7, 9], bpm: 76, wave: 'triangle', root: 65, bass: 'sine' },
};
export const RADIO = [
  { id: 'hearth_fm', name: 'Hearth FM — Cozy Village', mood: 'town' }, { id: 'grove', name: 'Grove Radio — Forest Lofi', mood: 'forest' },
  { id: 'peaks', name: 'Peaks 104 — Adventure', mood: 'hills' }, { id: 'aurora', name: 'Aurora Waves — Calm Snow', mood: 'snow' }, { id: 'arena', name: 'Arena Beats — Battle', mood: 'boss' },
];
export class Audio {
  ctx: AudioContext | null = null; master!: GainNode; music!: GainNode; sfx!: GainNode; vol = { master: 0.6, music: 0.5, sfx: 0.7, ambient: 0.4 }; muted = false;
  private timer: number | null = null; private step = 0; private mood = 'town'; private seed = 1; radio: string | null = null; shuffle = false; favorites: string[] = [];
  ensure() {
    if (this.ctx) return; try { const AC = (window as any).AudioContext || (window as any).webkitAudioContext; if (!AC) return; this.ctx = new AC(); } catch { return; }
    const c = this.ctx!; this.master = c.createGain(); this.music = c.createGain(); this.sfx = c.createGain(); this.music.connect(this.master); this.sfx.connect(this.master); this.master.connect(c.destination); this.apply();
  }
  apply() { if (!this.ctx) return; this.master.gain.value = this.muted ? 0 : this.vol.master; this.music.gain.value = this.vol.music * 0.35; this.sfx.gain.value = this.vol.sfx * 0.5; }
  setMood(m: string) { if (this.radio) return; if (m === this.mood && this.timer) return; this.mood = MOODS[m] ? m : 'town'; this.seed = m.length * 7 + 3; this.restart(); }
  playRadio(id: string | null) { this.radio = id; const st = RADIO.find((r) => r.id === id); if (st) { this.mood = st.mood; this.seed = id!.length * 13; } this.restart(); }
  nextTrack() { this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff; this.step = 0; }
  restart() { if (this.timer) clearInterval(this.timer); this.ensure(); if (!this.ctx) return; const md = MOODS[this.mood]!; const stepMs = 60000 / md.bpm / 2; this.step = 0; this.timer = window.setInterval(() => this.tickMusic(), stepMs); }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
  private rnd(n: number) { const x = Math.sin(this.seed * 9301 + n * 49297) * 233280; return x - Math.floor(x); }
  private tickMusic() {
    if (!this.ctx || this.ctx.state !== 'running') return; const md = MOODS[this.mood]!; const s = this.step++; const bar = Math.floor(s / 8) % 4; const t = this.ctx.currentTime;
    if (s % 64 === 63 && this.radio && this.shuffle) this.nextTrack();
    const prog = [0, 5, 3, 4][bar]!; const deg = md.scale;
    if (this.rnd(s % 32) > 0.35) { const note = md.root + 12 + deg[Math.floor(this.rnd(s % 32 + 100) * deg.length)]! + (prog > 3 ? 0 : 0); this.tone(note + prog, t, 0.22, md.wave, 0.09, this.music); }
    if (s % 4 === 0) this.tone(md.root - 12 + prog, t, 0.45, md.bass, 0.12, this.music);
    if (s % 8 === 4 && (this.mood === 'boss' || this.mood === 'dungeon' || this.mood === 'hills')) this.noise(t, 0.05, 0.05);
  }
  tone(midi: number, t: number, dur: number, type: OscillatorType, gain: number, dest: AudioNode) {
    const c = this.ctx!; const o = c.createOscillator(); const g = c.createGain(); o.type = type; o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
  }
  noise(t: number, dur: number, gain: number) { const c = this.ctx!; const b = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); const s = c.createBufferSource(); s.buffer = b; const g = c.createGain(); g.gain.value = gain; s.connect(g); g.connect(this.sfx); s.start(t); }
  play(kind: 'hit' | 'crit' | 'skill' | 'heal' | 'level' | 'coin' | 'ui' | 'death' | 'refine_ok' | 'refine_fail' | 'step' | 'card') {
    this.ensure(); if (!this.ctx || this.ctx.state !== 'running') return; const t = this.ctx.currentTime;
    switch (kind) {
      case 'hit': this.noise(t, 0.06, 0.25); this.tone(45, t, 0.08, 'square', 0.1, this.sfx); break;
      case 'crit': this.noise(t, 0.1, 0.35); this.tone(57, t, 0.12, 'sawtooth', 0.12, this.sfx); break;
      case 'skill': this.tone(72, t, 0.15, 'triangle', 0.12, this.sfx); this.tone(79, t + 0.05, 0.2, 'triangle', 0.1, this.sfx); break;
      case 'heal': for (let i = 0; i < 3; i++) this.tone(76 + i * 4, t + i * 0.06, 0.25, 'sine', 0.1, this.sfx); break;
      case 'level': [72, 76, 79, 84].forEach((n, i) => this.tone(n, t + i * 0.1, 0.35, 'square', 0.1, this.sfx)); break;
      case 'coin': this.tone(88, t, 0.08, 'square', 0.07, this.sfx); this.tone(93, t + 0.06, 0.12, 'square', 0.07, this.sfx); break;
      case 'ui': this.tone(80, t, 0.05, 'triangle', 0.06, this.sfx); break;
      case 'death': [60, 56, 52].forEach((n, i) => this.tone(n, t + i * 0.12, 0.3, 'sawtooth', 0.08, this.sfx)); break;
      case 'refine_ok': [76, 81, 88].forEach((n, i) => this.tone(n, t + i * 0.08, 0.3, 'triangle', 0.12, this.sfx)); break;
      case 'refine_fail': this.tone(50, t, 0.4, 'sawtooth', 0.12, this.sfx); this.noise(t, 0.2, 0.2); break;
      case 'card': this.noise(t, 0.04, 0.15); this.tone(84, t, 0.05, 'triangle', 0.06, this.sfx); break;
    }
  }
  unlock() { this.ensure(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => undefined); }
}
