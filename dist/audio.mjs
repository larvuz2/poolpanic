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
    if (type === "dog-notice" || type === "dog-steal" || type === "dog-bowl") {
      const n = type === "dog-notice" ? 3 : 2;
      for (let i = 0; i < n; i++) {
        this.tone(
          type === "dog-notice" ? 520 : 330,
          t + i * 0.16,
          0.09,
          0.14,
          "square",
          type === "dog-notice" ? 680 : 240,
        );
        this.noise(t + i * 0.16, 0.06, 0.05, 900);
      }
    } else if (type === "dog-shake") {
      for (let i = 0; i < 6; i++) this.noise(t + i * 0.05, 0.05, 0.05, 2400);
    } else if (type === "red-card") {
      [2400, 2600, 2400, 2600, 2400].forEach((f, i) => this.tone(f, t + i * 0.05, 0.06, 0.07, "sine"));
      this.tone(2500, t + 0.3, 0.35, 0.08, "sine");
    } else if (type === "carl-windup") {
      this.tone(160, t, 0.5, 0.12, "sawtooth", 420);
    } else if (type === "carl-jump") {
      this.tone(420, t, 0.7, 0.1, "triangle", 900);
    } else if (type === "cannonball") {
      this.tone(70, t, 0.6, 0.35, "sine", 35);
      this.noise(t, 0.9, 0.3, 250);
      this.noise(t + 0.15, 0.7, 0.18, 1200);
    } else if (type === "outage-flicker") {
      for (let i = 0; i < 5; i++) this.tone(120, t + i * 0.13, 0.08, 0.06, "square");
    } else if (type === "blackout") {
      this.tone(880, t, 0.9, 0.15, "sawtooth", 55);
    } else if (type === "power-restored") {
      this.tone(80, t, 0.6, 0.12, "sawtooth", 900);
      [523, 784, 1047].forEach((f, i) => this.tone(f, t + 0.45 + i * 0.08, 0.18, 0.1, "triangle"));
    } else if (type === "thunder") {
      this.noise(t + 0.2, 1.4, 0.22, 90);
      this.tone(48, t + 0.2, 1.2, 0.2, "sine", 30);
    } else if (type === "busy") {
      this.tone(300, t, 0.05, 0.06, "square");
    } else if (type === "trampoline-bounce") {
      this.tone(150, t, 0.28, 0.16, "sine", 420);
      this.tone(300, t, 0.2, 0.05, "triangle", 700);
    } else if (type === "trampoline-launch") {
      this.tone(260, t, 0.55, 0.12, "triangle", 1400);
      this.noise(t, 0.4, 0.06, 2600);
    } else if (type === "trampoline-splash") {
      this.noise(t, 0.6, 0.22, 380);
      [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, t + 0.12 + i * 0.06, 0.2, 0.11, "triangle"));
    } else if (type === "crash") {
      this.tone(90, t, 0.5, 0.35, "sine", 40);
      this.noise(t, 0.8, 0.28, 300);
      [440, 415, 392, 311].forEach((f, i) => this.tone(f, t + 0.2 + i * 0.14, 0.22, 0.14, "sawtooth"));
    } else if (type === "healed") {
      [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, t + i * 0.05, 0.18, 0.09, "sine"));
    } else if (type === "lane-switch") {
      this.noise(t, 0.15, 0.06, 900);
      this.tone(420, t, 0.12, 0.06, "sine", 620);
    } else if (type === "fish-dumped") {
      this.noise(t, 0.5, 0.2, 400);
      [660, 523, 392, 262].forEach((f, i) => this.tone(f, t + 0.1 + i * 0.12, 0.2, 0.15, "sawtooth"));
    } else if (type === "fish-dart") {
      this.noise(t, 0.12, 0.06, 1200);
      this.tone(520, t, 0.08, 0.05, "sine", 900);
    } else if (type === "fish-caught" || type === "prevented") {
      [523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + i * 0.08, 0.2, 0.13, "triangle"));
    } else if (type === "kid-dodge") {
      this.noise(t, 0.18, 0.08, 1500);
      this.tone(700, t, 0.12, 0.06, "sine", 1100);
    } else if (type === "cramp-alarm") {
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
  // Incident sting: a brass-style stab under a short motif of its own, so each problem is recognisable by ear.
  // The first sighting gets a longer tail while the lesson is on screen.
  sting(kind, first = false) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime,
      danger = ["cramp", "spill", "fish-loose", "blackout", "tower-go", "crash"].includes(kind);
    // The hit: a low thump, a burst of air, and a two-note stab (a tritone when someone is in danger).
    this.tone(95, t, 0.35, 0.3, "sine", 45);
    this.noise(t, 0.25, 0.12, 700);
    for (const f of danger ? [233, 330] : [262, 392]) {
      this.tone(f, t, 0.42, 0.09, "sawtooth");
      this.tone(f * 2, t + 0.01, 0.3, 0.035, "square");
    }
    const at = t + 0.22,
      motif = {
        cramp: () => [988, 1175, 988, 1175].forEach((f, i) => this.tone(f, at + i * 0.1, 0.09, 0.1, "sine")),
        stomach: () => {
          this.tone(196, at, 0.2, 0.16, "triangle", 185);
          this.tone(147, at + 0.24, 0.35, 0.16, "triangle", 131);
        },
        spill: () =>
          [392, 370, 349, 262].forEach((f, i) =>
            this.tone(f, at + i * 0.13, 0.2, 0.12, "sawtooth", f * 0.97),
          ),
        fish: () =>
          [523, 659, 784, 1047].forEach((f, i) => this.tone(f, at + i * 0.05, 0.08, 0.08, "sine", f * 1.3)),
        "fish-loose": () => {
          this.noise(at, 0.35, 0.14, 500);
          [880, 740, 587].forEach((f, i) => this.tone(f, at + 0.08 + i * 0.1, 0.12, 0.1, "sine", f * 0.8));
        },
        dog: () =>
          [0, 0.2].forEach((d) => {
            this.tone(420, at + d, 0.1, 0.16, "square", 620);
            this.noise(at + d, 0.07, 0.07, 900);
          }),
        carl: () => {
          this.tone(1800, at, 0.3, 0.07, "sine", 2400);
          this.tone(160, at + 0.05, 0.45, 0.12, "sawtooth", 420);
        },
        flicker: () => [0, 1, 2, 3].forEach((i) => this.tone(118, at + i * 0.08, 0.05, 0.08, "square")),
        blackout: () => this.tone(660, at, 0.7, 0.13, "sawtooth", 60),
        tower: () => [0, 1, 2, 3, 4, 5, 6].forEach((i) => this.noise(at + i * 0.055, 0.04, 0.09, 1800)),
        "tower-go": () => {
          [0, 1, 2, 3, 4, 5, 6, 7, 8].forEach((i) => this.noise(at + i * 0.04, 0.03, 0.1, 1800));
          this.tone(300, at + 0.36, 0.3, 0.12, "triangle", 1200);
        },
        crash: () =>
          [440, 415, 392, 311].forEach((f, i) => this.tone(f, at + i * 0.12, 0.2, 0.12, "sawtooth")),
        rush: () => {
          this.tone(233, at, 0.16, 0.14, "square");
          this.tone(311, at + 0.2, 0.3, 0.14, "square");
        },
        closure: () => [0, 1, 2].forEach((i) => this.tone(880, at + i * 0.16, 0.08, 0.1, "square")),
        team: () => this.tone(1500, at, 0.4, 0.09, "sine", 2300),
        class: () =>
          [0, 1, 2, 3, 4].forEach((i) =>
            this.tone(500 + i * 90, at + i * 0.06, 0.1, 0.07, "sine", 900 + i * 60),
          ),
      }[kind];
    motif?.();
    if (first)
      (danger ? [233, 277, 330] : [262, 330, 392]).forEach((f, i) =>
        this.tone(f, t + 0.75 + i * 0.02, 1.1, 0.045, "triangle"),
      );
  }
  // A save: the crowd on the deck cheers (a swell of voices and a scatter of claps) over a rising fanfare.
  cheer(tier = 1) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime,
      big = tier > 1,
      length = big ? 1.4 : 0.8;
    const b = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * length), this.ctx.sampleRate),
      d = b.getChannelData(0);
    // Voices: noise with a quick swell and a long fall, gently wobbling like a crowd.
    for (let i = 0; i < d.length; i++) {
      const x = i / d.length,
        env = Math.min(1, x * 9) * Math.pow(1 - x, 1.6);
      d[i] = (Math.random() * 2 - 1) * env * (0.75 + 0.25 * Math.sin(i / 700));
    }
    const s = this.ctx.createBufferSource(),
      f = this.ctx.createBiquadFilter(),
      g = this.ctx.createGain();
    s.buffer = b;
    f.type = "bandpass";
    f.frequency.value = 1100;
    f.Q.value = 0.7;
    g.gain.value = big ? 0.2 : 0.12;
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    s.start(t);
    for (let i = 0; i < (big ? 12 : 6); i++)
      this.noise(t + 0.05 + Math.random() * length * 0.7, 0.03, 0.08, 2600);
    (big ? [523, 659, 784, 1047] : [659, 784, 1047]).forEach((n, i) =>
      this.tone(n, t + i * 0.07, 0.22, big ? 0.11 : 0.08, "triangle"),
    );
    this.tone(110, t, 0.18, 0.2, "sine", 60);
  }
  toggle() {
    this.enabled = !this.enabled;
    if (this.master) this.master.gain.setTargetAtTime(this.enabled ? 0.36 : 0, this.ctx.currentTime, 0.05);
    if (this.enabled) this.init();
    return this.enabled;
  }
}
