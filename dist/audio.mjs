export class PoolAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.step = 0;
    this.next = 0;
    this.urgency = 0;
    this.playing = false;
    this.panic = false;
  }
  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.36 : 0;
    const compressor = this.ctx.createDynamicsCompressor();
    this.master.connect(compressor);
    compressor.connect(this.ctx.destination);
    this.next = this.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(), 70);
  }
  tone(freq, time, duration, vol = 0.15, type = "sine", endFreq = null) {
    if (!this.ctx || !this.enabled) return;
    const o = this.ctx.createOscillator(),
      g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, time);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, time + duration);
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.009);
    g.gain.exponentialRampToValueAtTime(0.001, time + duration);
    o.connect(g);
    g.connect(this.master);
    o.start(time);
    o.stop(time + duration + 0.03);
  }
  noise(t, duration, vol = 0.06, freq = 1400) {
    if (!this.ctx || !this.enabled) return;
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = this.ctx.createBufferSource(),
      g = this.ctx.createGain(),
      f = this.ctx.createBiquadFilter();
    s.buffer = b;
    f.type = "highpass";
    f.frequency.value = freq;
    g.gain.value = vol;
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    s.start(t);
  }
  schedule() {
    if (!this.ctx || !this.playing || !this.enabled) {
      if (this.ctx) this.next = this.ctx.currentTime + 0.05;
      return;
    }
    while (this.next < this.ctx.currentTime + 0.17) {
      const t = this.next,
        s = this.step % 32,
        bar = Math.floor(this.step / 16) % 4;
      const roots = this.panic ? [45, 45, 46, 40] : [48, 53, 55, 53],
        root = roots[bar],
        note = (n) => 440 * Math.pow(2, (n - 69) / 12);
      const melody = [
        12,
        null,
        19,
        16,
        null,
        14,
        12,
        null,
        16,
        null,
        19,
        21,
        19,
        null,
        16,
        null,
        14,
        null,
        17,
        21,
        null,
        19,
        17,
        null,
        16,
        14,
        12,
        null,
        14,
        16,
        19,
        null,
      ];
      if (s % 4 === 0) {
        this.tone(145, t, 0.12, 0.3, "sine", 40);
        this.tone(note(root + (s % 8 === 4 ? 7 : 0)), t, 0.2, 0.22, "triangle");
      }
      if (s % 4 === 2) {
        this.noise(t, 0.08, 0.075, 1100);
        this.tone(195, t, 0.07, 0.07, "sine");
      }
      this.noise(t, 0.025, s % 2 === 0 ? 0.023 : 0.013, 6500);
      if (melody[s] !== null) {
        this.tone(
          note(root + melody[s] - (this.panic && melody[s] === 16 ? 1 : 0)),
          t,
          0.17,
          this.panic ? 0.13 : 0.09,
          this.panic ? "triangle" : "sine",
        );
        this.tone(note(root + melody[s] + 12), t, 0.065, 0.025, "triangle");
      }
      if (s % 8 === 0) {
        (this.panic ? [0, 3, 6] : [0, 4, 7]).forEach((n, i) =>
          this.tone(note(root + n + 12), t + i * 0.012, 0.15, 0.035, "triangle"),
        );
      }
      if (this.panic && s % 4 === 0) this.tone(s % 8 === 0 ? 660 : 880, t, 0.13, 0.08, "square");
      this.step++;
      this.next += 60 / (this.panic ? 154 : 108 + this.urgency * 18) / 4;
    }
  }
  effect(type) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    if (type === "cramp-alarm") {
      [880, 1047, 880].forEach((f, i) => this.tone(f, t + i * 0.16, 0.12, 0.14, "sine"));
    } else if (type === "rescue-safe") {
      [523, 659, 784].forEach((f, i) => this.tone(f, t + i * 0.09, 0.2, 0.13, "triangle"));
    } else if (type === "stomach-warning") {
      this.tone(220, t, 0.2, 0.13, "triangle", 120);
      this.tone(660, t + 0.15, 0.13, 0.1, "sine");
      this.tone(660, t + 0.35, 0.13, 0.1, "sine");
    } else if (type === "scoop-cast") {
      this.noise(t, 0.3, 0.08, 700);
    } else if (type === "scooped" || type === "waste-bin" || type === "reopened") {
      [523, 659, 784].forEach((f, i) => this.tone(f, t + i * 0.075, 0.16, 0.12, "triangle"));
    } else if (type === "scoop-miss") {
      this.tone(180, t, 0.15, 0.1, "triangle", 90);
    } else if (type === "door-open") {
      this.noise(t, 0.065, 0.055, 700);
      this.tone(135, t, 0.2, 0.045, "triangle", 210);
      this.tone(784, t + 0.08, 0.17, 0.11, "sine");
      this.tone(1047, t + 0.17, 0.23, 0.09, "sine");
    } else if (type === "countdown") {
      this.tone(440, t, 0.14, 0.15, "sine");
    } else if (type === "go") {
      this.tone(880, t, 0.22, 0.17, "sine");
      this.tone(1320, t, 0.3, 0.08, "triangle");
    } else if (type === "dash") {
      this.noise(t, 0.13, 0.075, 900);
      this.tone(180, t, 0.12, 0.055, "triangle", 370);
    } else if (type === "jump") {
      this.tone(210, t, 0.13, 0.075, "sine", 470);
    } else if (type === "drop") {
      this.tone(210, t, 0.1, 0.09, "triangle", 100);
    } else if (type === "land") {
      this.tone(105, t, 0.075, 0.09, "triangle", 65);
    } else if (type === "pickup") {
      this.tone(740, t, 0.1, 0.12);
      this.tone(1100, t + 0.055, 0.12, 0.075);
    } else if (type === "assigned" || type === "action") {
      this.tone(540, t, 0.08, 0.1, "sine");
      this.tone(800, t + 0.045, 0.1, 0.075, "sine");
    } else if (type === "served" || type === "helped" || type === "handoff") {
      [72, 76, 79].forEach((n, i) =>
        this.tone(440 * 2 ** ((n - 69) / 12), t + i * 0.065, 0.19, 0.12, "sine"),
      );
    } else if (type === "splash") {
      this.noise(t, 0.2, 0.12, 600);
      this.tone(330, t, 0.11, 0.045, "sine", 90);
    } else if (type === "collision" || type === "slip" || type === "coach-slip") {
      this.tone(140, t, 0.18, 0.17, "triangle", 55);
      this.noise(t, 0.075, 0.13, 500);
    } else if (type === "catastrophe") {
      [392, 370, 330, 261].forEach((f, i) => this.tone(f, t + i * 0.15, 0.25, 0.18, "sawtooth"));
    } else if (type === "ended") {
      [523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + i * 0.13, 0.35, 0.13, "triangle"));
    } else if (type === "select") {
      this.tone(659, t, 0.11, 0.13, "sine");
      this.tone(988, t + 0.055, 0.16, 0.09, "sine");
    }
  }
  toggle() {
    this.enabled = !this.enabled;
    if (this.master) this.master.gain.setTargetAtTime(this.enabled ? 0.36 : 0, this.ctx.currentTime, 0.05);
    if (this.enabled) this.init();
    return this.enabled;
  }
}
