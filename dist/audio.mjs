import { AUDIO_FILES } from "./audio-files.mjs";
import { DiscoMusic } from "./music.mjs";

// The menu's recordings (ElevenLabs Music and Sound Effects, 20 October 2026; see assets/audio/README.md).
export const MENU_AUDIO = {
  theme: new URL("./assets/audio/menu-theme.mp3", import.meta.url).href,
  return: new URL("./assets/audio/menu-return.mp3", import.meta.url).href,
  ambience: new URL("./assets/audio/menu-ambience.mp3", import.meta.url).href,
  hover: new URL("./assets/audio/ui-hover.mp3", import.meta.url).href,
  click: new URL("./assets/audio/ui-click.mp3", import.meta.url).href,
};
// Where a recorded loop really starts and ends: the first and the last sample above silence (an mp3 carries a little
// padding at both ends, which would be a gap at every turn of the loop).
export function loopPoints(buffer, floor = 1e-4) {
  const data = buffer.getChannelData(0);
  let a = 0,
    b = data.length - 1;
  while (a < b && Math.abs(data[a]) < floor) a++;
  while (b > a && Math.abs(data[b]) < floor) b--;
  if (b - a < buffer.sampleRate) return [0, buffer.duration];
  return [a / buffer.sampleRate, (b + 1) / buffer.sampleRate];
}
const HISS_SECONDS = 3; // the longest burst of noise is 1.4 s
// Every sound is a little chain of nodes that is over a moment after it starts, and the music alone makes about 70 of them a
// second. A chain is let go of when its source ends (Safari holds on to a finished one that is still connected, and the page
// had been dying about 45 s into a shift: whether this is why is not known).
const release = (...nodes) => {
  for (const node of nodes)
    try {
      node.disconnect();
    } catch {}
};

export class PoolAudio {
  constructor() {
    this.buffers = new Map();
    this.ctx = null;
    this.enabled = true;
    this.step = 0;
    this.next = 0;
    this.urgency = 0;
    this.heat = 0; // the happy streak's tier (0 to 4): the song lifts with it
    this.playing = false;
    this.panic = false;
    // The Aqua Disco plays its own song on the shift's clock (music.mjs): `clock` is set by the app and says where the shift
    // is (null when no disco plays).
    this.clock = null;
    this.disco = new DiscoMusic(this);
    // Settings' volumes (0 to 1); `dest` is where a sound goes while the song's scheduler is making it (else the effects).
    this.volume = { master: 1, music: 1, effects: 1 };
    this.dest = null;
    this.menu = null; // the menu's recorded music (startMenu)
    this.menuToken = 0;
  }
  masterLevel() {
    return this.enabled ? 0.36 * this.volume.master : 0;
  }
  out() {
    return this.dest || this.fxBus || this.master;
  }
  // Settings' sliders: heard at once.
  setVolumes({ master = this.volume.master, music = this.volume.music, effects = this.volume.effects } = {}) {
    this.volume = { master, music, effects };
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.masterLevel(), t, 0.03);
    this.musicBus.gain.setTargetAtTime(music, t, 0.03);
    this.fxBus.gain.setTargetAtTime(effects, t, 0.03);
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
    this.master.gain.value = this.masterLevel();
    // Two mixes under the master, for Settings' sliders: the music (the shifts' songs, the menu's) and the effects.
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = this.volume.music;
    this.musicBus.connect(this.master);
    this.fxBus = this.ctx.createGain();
    this.fxBus.gain.value = this.volume.effects;
    this.fxBus.connect(this.master);
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
    g.connect(this.out());
    o.onended = () => release(o, g);
    o.start(time);
    o.stop(time + duration + 0.03);
  }
  // White noise for every hiss, tick and thump, made once (the music asked for a new buffer nine times a second).
  hissBuffer() {
    if (!this.hiss) {
      const rate = this.ctx.sampleRate,
        b = this.ctx.createBuffer(1, Math.floor(rate * HISS_SECONDS), rate),
        d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.hiss = b;
    }
    return this.hiss;
  }
  // A burst of it from a random place, fading out over its length.
  noise(t, duration, vol = 0.06, freq = 1400) {
    if (!this.ctx || !this.enabled) return;
    const hiss = this.hissBuffer(),
      s = this.ctx.createBufferSource(),
      g = this.ctx.createGain(),
      f = this.ctx.createBiquadFilter();
    s.buffer = hiss;
    f.type = "highpass";
    f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.linearRampToValueAtTime(0, t + duration);
    s.connect(f);
    f.connect(g);
    g.connect(this.out());
    s.onended = () => release(s, f, g);
    s.start(t, Math.random() * Math.max(0, hiss.duration - duration), duration);
  }
  // A recorded sound from audio-files.mjs, loaded once. Resolves to false when there is none (or it will not
  // load), so the caller can fall back to the synthesised placeholder.
  async playFile(key) {
    const urls = AUDIO_FILES[key] || [];
    if (!this.ctx || !this.enabled || !urls.length) return false;
    const url = new URL(urls[Math.floor(Math.random() * urls.length)], import.meta.url).href;
    try {
      if (!this.buffers.has(url))
        this.buffers.set(
          url,
          fetch(url)
            .then((r) => r.arrayBuffer())
            .then((data) => this.ctx.decodeAudioData(data)),
        );
      const source = this.ctx.createBufferSource();
      source.buffer = await this.buffers.get(url);
      source.connect(this.out());
      source.onended = () => release(source);
      source.start();
      return true;
    } catch {
      this.buffers.delete(url);
      AUDIO_FILES[key] = urls.filter((u) => new URL(u, import.meta.url).href !== url);
      return false;
    }
  }
  // Placeholder for Karen's voice: a little burst of nasal syllables, each at its own pitch, going up at the end
  // like a question. Swapped for recordings as soon as audio-files.mjs lists some.
  karenBabble(t = this.ctx.currentTime) {
    const syllables = 3 + Math.floor(Math.random() * 3),
      base = 210 + Math.random() * 70;
    for (let i = 0; i < syllables; i++) {
      const at = t + i * 0.13,
        pitch = base * (0.85 + Math.random() * 0.45) * (i === syllables - 1 ? 1.25 : 1);
      this.tone(pitch, at, 0.11, 0.07, "sawtooth", pitch * (0.8 + Math.random() * 0.5));
      this.tone(pitch * 2.02, at, 0.08, 0.025, "square");
      this.noise(at, 0.04, 0.03, 2500);
    }
  }
  schedule() {
    this.dest = this.musicBus;
    try {
      this.scheduleSong();
    } finally {
      this.dest = null;
    }
  }
  scheduleSong() {
    if (!this.ctx || !this.playing || !this.enabled) {
      if (this.ctx) this.next = this.ctx.currentTime + 0.05;
      return;
    }
    if (this.disco.tick(this.clock?.() ?? null)) {
      this.next = this.ctx.currentTime + 0.05;
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
      // The happy streak lifts the song (Phase 3): from ON A ROLL a sparkle of high notes, from ON FIRE handclaps on the
      // off-beats too.
      if (!this.panic && this.heat >= 2 && s % 2 === 1)
        this.tone(note(root + [24, 28, 31, 36][(s >> 1) % 4]), t, 0.06, 0.018 + this.heat * 0.004, "sine");
      if (!this.panic && this.heat >= 3 && s % 8 === 6) this.noise(t, 0.05, 0.06, 1900);
      this.step++;
      this.next += 60 / (this.panic ? 154 : 108 + this.urgency * 18 + (this.heat >= 4 ? 6 : 0)) / 4;
    }
  }
  effect(type, e = {}) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    if (this.waveEffect(type, e, t)) return;
    if (this.roofEffect(type, e, t)) return;
    if (this.shipEffect(type, e, t)) return;
    if (this.onsenEffect(type, e, t)) return;
    if (type === "doors-open") {
      // The menu's doors (scene/menu-stage.mjs): the latch, the morning air rushing in, a warm chord swelling up.
      this.noise(t, 0.05, 0.12, 2600);
      this.tone(180, t, 0.09, 0.1, "square", 90);
      this.noise(t + 0.08, 1.5, 0.06, 380);
      [262, 330, 392, 523, 659].forEach((f, i) => this.tone(f, t + 0.2 + i * 0.05, 1.8, 0.045, "sine"));
      return;
    }
    if (type === "streak-tier") {
      // A tier of the happy streak: a quick rising run, higher for each tier, and a bright chord on top.
      const base = 523 * Math.pow(2, Math.max(0, (e.mult || 1.2) - 1.2) * 0.75);
      [1, 1.25, 1.5, 2].forEach((k, i) => this.tone(base * k, t + i * 0.055, 0.16, 0.09, "triangle"));
      [1, 1.26, 1.5].forEach((k) => this.tone(base * 2 * k, t + 0.24, 0.45, 0.04, "sine"));
      this.noise(t + 0.22, 0.2, 0.03, 7000);
      return;
    }
    // The big moment (big-moment.mjs): a drum roll building under the countdown, a fanfare when it goes live, the race's
    // whistle and starter's horn, a bell at the finish, a sad trombone when it goes wrong.
    if (type === "big-announce") {
      for (let i = 0; i < 32; i++) this.noise(t + i * 0.25 * (1 - i / 48), 0.06, 0.02 + i * 0.0018, 900);
      [196, 247, 294].forEach((f, i) => this.tone(f, t + i * 0.12, 0.5, 0.05, "triangle"));
      return;
    }
    if (type === "big-live") {
      [392, 494, 587, 784].forEach((f, i) => this.tone(f, t + i * 0.09, 0.3, 0.1, "triangle"));
      this.tone(98, t, 0.4, 0.2, "sine", 60);
      return;
    }
    if (type === "whistle") {
      this.tone(2900, t, 0.5, 0.09, "sine", 3100);
      this.tone(2950, t + 0.02, 0.48, 0.05, "square", 3150);
      return;
    }
    if (type === "race-marks") {
      if (!e.byCoach) this.tone(220, t, 0.6, 0.12, "sawtooth", 210);
      return;
    }
    if (type === "race-go") {
      this.tone(440, t, 0.7, 0.14, "square", 430);
      this.noise(t, 0.4, 0.08, 1200);
      return;
    }
    if (type === "race-finish") {
      [1047, 1319, 1568].forEach((f, i) => this.tone(f, t + i * 0.18, 0.6, 0.06, "sine"));
      return;
    }
    if (type === "big-done") {
      if (e.result === "miss")
        [392, 370, 349, 294].forEach((f, i) =>
          this.tone(f, t + i * 0.28, i === 3 ? 0.8 : 0.3, 0.09, "sawtooth", i === 3 ? 270 : null),
        );
      return;
    }
    if (type === "tip-ask") {
      // A swimmer calls the coach: a bright little two-note "coach!".
      this.tone(784, t, 0.09, 0.07, "triangle");
      this.tone(1047, t + 0.1, 0.12, 0.07, "triangle");
      return;
    }
    if (type === "tip") {
      // The coach's tip: a whistle chirp and a happy chime.
      this.tone(2300, t, 0.08, 0.06, "sine", 2700);
      [659, 880, 1175].forEach((f, i) => this.tone(f, t + 0.09 + i * 0.06, 0.16, 0.07, "triangle"));
      return;
    }
    if (type === "tip-missed") {
      this.tone(392, t, 0.25, 0.05, "triangle", 311);
      return;
    }
    if (type === "streak-broken") {
      // The streak breaks: a glassy crack and a falling slide.
      this.noise(t, 0.12, 0.1, 5200);
      this.tone(880, t, 0.42, 0.08, "triangle", 220);
      this.tone(660, t + 0.04, 0.38, 0.05, "square", 150);
      return;
    }
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
    } else if (type === "karen-voice") {
      this.playFile("karen").then((played) => played || this.karenBabble());
    } else if (type === "karen-arrive") {
      // A stomp, and an indignant "HELLO?!".
      this.tone(90, t, 0.18, 0.2, "sine", 50);
      this.tone(380, t + 0.05, 0.28, 0.1, "sawtooth", 520);
      this.tone(380 * 1.5, t + 0.05, 0.2, 0.04, "square", 700);
    } else if (type === "team-up") {
      // Another pair of hands on a hold-E job (teamwork.mjs): a quick rising "ba-dum!", higher for a third.
      const up = Math.max(0, (e.helpers || 2) - 2) * 3;
      [523, 659, 784].forEach((f, i) => this.tone(f * 2 ** (up / 12), t + i * 0.06, 0.16, 0.11, "square"));
      this.tone(1046 * 2 ** (up / 12), t + 0.2, 0.3, 0.09, "triangle");
    } else if (type === "massage-lie") {
      // Flopping face down onto the padded table: a soft thump and a contented hum.
      this.tone(110, t, 0.22, 0.16, "sine", 70);
      this.noise(t, 0.18, 0.05, 500);
      this.tone(262, t + 0.18, 0.4, 0.06, "triangle", 247);
    } else if (type === "massage-done") {
      // Bliss: a long "aaah" sliding down, then a warm major chime.
      this.tone(392, t, 0.8, 0.09, "triangle", 262);
      this.noise(t, 0.6, 0.04, 600);
      [523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + 0.5 + i * 0.08, 0.3, 0.08, "sine"));
    } else if (type === "massage-angry") {
      // Up off the table in a huff: a slap on the cushion and a cross "hmph!".
      this.noise(t, 0.08, 0.14, 1600);
      this.tone(180, t + 0.05, 0.25, 0.14, "sawtooth", 120);
      this.tone(300, t + 0.3, 0.18, 0.1, "square", 220);
    } else if (type === "karen-calmed") {
      // A long sigh down, then a small relieved chime.
      this.noise(t, 0.7, 0.07, 700);
      this.tone(330, t, 0.7, 0.1, "triangle", 150);
      [659, 784, 988].forEach((f, i) => this.tone(f, t + 0.55 + i * 0.09, 0.2, 0.1, "sine"));
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
    } else if (type === "vip") {
      [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, t + i * 0.07, 0.3, 0.09, "triangle"));
      this.tone(196, t, 0.25, 0.1, "sine");
    } else if (type === "ended") {
      [523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + i * 0.13, 0.35, 0.13, "triangle"));
    } else if (type === "select") {
      this.tone(659, t, 0.11, 0.13, "sine");
      this.tone(988, t + 0.055, 0.16, 0.09, "sine");
    } else if (type === "tube-bump") {
      // The Lazy River: two rubber tubes bonk into each other.
      this.tone(240, t, 0.16, 0.14, "sine", 140);
      this.tone(420, t + 0.03, 0.12, 0.06, "triangle", 300);
    } else if (type === "board") {
      // Sitting down into a tube: a squeak of rubber, then the plop into the water.
      this.tone(900, t + 0.35, 0.12, 0.05, "sine", 1300);
      this.noise(t + 0.8, 0.22, 0.1, 700);
    } else if (type === "tube-returned") {
      this.tone(300, t, 0.1, 0.08, "triangle", 200);
    } else if (type === "coach-fell") {
      // Coach Waters misses his jump: a big splash and a sad trombone.
      this.noise(t, 0.5, 0.2, 400);
      [392, 370, 349, 294].forEach((f, i) =>
        this.tone(f, t + 0.25 + i * 0.22, i === 3 ? 0.5 : 0.2, 0.08, "sawtooth"),
      );
    }
  }
  // The Wave Pool's sounds (wave-pool.mjs, waves.mjs). True when `type` was one of them.
  waveEffect(type, e, t) {
    if (type === "waves-horn") {
      // The wave pool's horn: two long low blasts (a fifth apart, slightly out of tune with each other, like the real thing).
      for (const [d, f] of [
        [0, 110],
        [0.75, 110],
      ]) {
        this.tone(f, t + d, 0.6, 0.11, "sawtooth", f * 0.99);
        this.tone(f * 1.5, t + d, 0.6, 0.07, "sawtooth", f * 1.49);
        this.tone(f * 2.01, t + d, 0.55, 0.04, "square");
      }
    } else if (type === "wave-launch") {
      // The machine pushes a wave out of its chamber: a deep thump and a rush of water, bigger for a big one.
      const k = e.kind === "monster" ? 2.2 : e.kind === "big" ? 1.4 : 1;
      this.tone(70, t, 0.45 * k, 0.12 * Math.min(1.6, k), "sine", 40);
      this.noise(t, 0.7 * k, 0.05 * k, 260);
    } else if (type === "wave-break") {
      // The crest breaks: a long hiss of white water, a crash for a big one.
      const k = e.kind === "monster" ? 2 : e.kind === "big" ? 1.35 : 1;
      this.noise(t, 1.1 * k, 0.07 * k, 420);
      this.noise(t + 0.05, 0.5 * k, 0.05 * k, 1600);
      if (k > 1) this.tone(90, t, 0.35, 0.1 * k, "sine", 50);
    } else if (type === "monster-warning") {
      // The siren: a wail up and down, twice.
      for (const d of [0, 1.1]) {
        this.tone(440, t + d, 0.55, 0.09, "sawtooth", 880);
        this.tone(880, t + d + 0.55, 0.5, 0.08, "sawtooth", 440);
      }
    } else if (type === "dizzy") {
      // Seeing stars: a wobbly boing, falling.
      for (let i = 0; i < 5; i++) this.tone(760 - i * 70, t + i * 0.07, 0.09, 0.07, "sine", 900 - i * 90);
    } else if (type === "knockout") {
      // Under they go: a glug of bubbles.
      for (let i = 0; i < 6; i++)
        this.tone(300 + ((i * 137) % 260), t + 0.2 + i * 0.06, 0.06, 0.07, "sine", 900);
      this.noise(t, 0.5, 0.12, 500);
    } else if (type === "chant") {
      // "WAVES! WAVES! WAVES!": the crowd's voices, three shouts.
      for (let i = 0; i < 3; i++) {
        this.noise(t + i * 0.42, 0.26, 0.09, 700);
        this.tone(196, t + i * 0.42, 0.24, 0.05, "sawtooth", 175);
        this.tone(247, t + i * 0.42, 0.24, 0.035, "sawtooth", 220);
      }
    } else if (type === "waves-stopped") {
      // The machine winds down.
      this.tone(220, t, 0.9, 0.09, "sawtooth", 55);
      this.noise(t, 0.4, 0.04, 300);
    } else if (type === "tube-lost" || type === "bather-bump") {
      // A rubber squeak and a bonk.
      this.tone(type === "tube-lost" ? 1100 : 260, t, 0.14, 0.09, "sine", type === "tube-lost" ? 600 : 150);
      this.noise(t + 0.05, 0.2, 0.08, 800);
    } else if (type === "tube-ashore") {
      this.tone(320, t, 0.1, 0.07, "triangle", 220);
    } else if (type === "towel") {
      this.noise(t, 0.12, 0.04, 2400);
    } else return false;
    return true;
  }
  // The Rooftop Pool's sounds (rooftop.mjs). True when `type` was one of them.
  roofEffect(type, e, t) {
    if (type === "order") {
      // A guest orders: a little service bell.
      this.tone(1568, t, 0.5, 0.06, "sine");
      this.tone(2349, t, 0.35, 0.025, "sine");
    } else if (type === "serve") {
      // Served: the clink of a glass, and an "ahh".
      this.tone(2637, t, 0.25, 0.07, "sine");
      this.tone(3520, t + 0.02, 0.18, 0.04, "sine");
      this.tone(330, t + 0.12, 0.3, 0.04, "triangle", 260);
    } else if (type === "tray") {
      // A tray off the bar: glasses chinking.
      for (let i = 0; i < 3; i++) this.tone(2200 + i * 330, t + i * 0.05, 0.12, 0.04, "sine");
    } else if (type === "tipsy") {
      // Hic!
      this.tone(520, t, 0.08, 0.1, "square", 880);
      this.noise(t, 0.05, 0.05, 2000);
    } else if (type === "selfie-start") {
      // A phone camera's shutter, twice.
      for (const d of [0, 0.18]) {
        this.noise(t + d, 0.04, 0.12, 4200);
        this.tone(1900, t + d + 0.02, 0.03, 0.05, "square");
      }
    } else if (type === "overboard") {
      // A falling wail and a big splash below.
      this.tone(900, t, 0.6, 0.1, "sawtooth", 250);
      this.noise(t + 0.55, 0.8, 0.18, 380);
      this.tone(80, t + 0.55, 0.4, 0.14, "sine", 45);
    } else if (type === "drop") {
      // The drop: the crowd's "WOO!" over the bass (the song plays the drop itself).
      this.noise(t, 0.9, 0.08, 1200);
      for (const f of [330, 392, 494]) this.tone(f, t, 0.7, 0.03, "sawtooth", f * 1.25);
    } else if (type === "drop-splash") {
      this.noise(t, 0.6, 0.1, 500);
    } else if (type === "tidy") {
      // Fresh towels: a flap and a pat.
      this.noise(t, 0.12, 0.06, 1800);
      this.noise(t + 0.15, 0.06, 0.05, 900);
    } else return false;
    return true;
  }
  // The Cruise Ship's sounds (ship.mjs). True when `type` was one of them.
  shipEffect(type, e, t) {
    if (type === "swell-warning") {
      // The ship's bell, three double rings, and the foghorn under it.
      for (let i = 0; i < 3; i++)
        for (const d of [0, 0.22]) {
          this.tone(1318, t + i * 0.7 + d, 0.9, 0.06, "sine");
          this.tone(1318 * 2.76, t + i * 0.7 + d, 0.3, 0.012, "sine");
        }
      this.tone(98, t + 0.1, 1.6, 0.12, "sawtooth", 96);
      this.tone(147, t + 0.1, 1.6, 0.06, "sawtooth", 145);
    } else if (type === "roll") {
      // The hull's timbers creak as she leans (louder in a big swell).
      const vol = e.big ? 0.05 : 0.03;
      for (let i = 0; i < 4; i++) this.tone(140 + i * 23, t + i * 0.19, 0.22, vol, "sawtooth", 95 + i * 17);
    } else if (type === "loungers-slide") {
      // Lounger feet scraping across the teak.
      for (let i = 0; i < 5; i++) this.noise(t + i * 0.09, 0.12, 0.04, 700 + i * 80);
    } else if (type === "spill") {
      // A wash of water over the coping.
      this.noise(t, 0.9, 0.12, 600);
      this.noise(t + 0.1, 0.5, 0.06, 2200);
    } else if (type === "fell-in") {
      // "Whoa-oa!" and a splash.
      this.tone(620, t, 0.32, 0.09, "triangle", 300);
      this.noise(t + 0.3, 0.7, 0.16, 500);
      this.tone(90, t + 0.3, 0.3, 0.12, "sine", 50);
    } else if (type === "straightened") {
      // The loungers knocked back into line: thunk, thunk, thunk.
      for (let i = 0; i < 3; i++) this.tone(150, t + i * 0.12, 0.08, 0.1, "sine", 90);
    } else return false;
    return true;
  }
  // The Mountain Hot Springs' sounds (onsen.mjs). True when `type` was one of them.
  onsenEffect(type, e, t) {
    if (type === "monkey") {
      // A snow monkey out of the woods: a quick "ook-ook-ook" chatter.
      for (let i = 0; i < 3; i++) this.tone(640 + i * 40, t + i * 0.11, 0.08, 0.07, "triangle", 980 + i * 60);
    } else if (type === "monkey-in") {
      // In it goes: a plop, and a happy hoot.
      this.noise(t, 0.35, 0.12, 600);
      this.tone(70, t, 0.25, 0.1, "sine", 45);
      this.tone(520, t + 0.25, 0.3, 0.07, "triangle", 900);
    } else if (type === "monkey-shooed") {
      // A screech and a scamper through the snow.
      this.tone(1400, t, 0.18, 0.07, "sawtooth", 2100);
      for (let i = 0; i < 5; i++) this.noise(t + 0.15 + i * 0.07, 0.05, 0.05, 1500);
      if (e.out) this.noise(t, 0.3, 0.1, 700);
    } else if (type === "step-in") {
      // Stepping down into the hot water.
      this.noise(t, 0.25, 0.05, 700);
    } else if (type === "sit-in") {
      // Settling in up to the shoulders: a contented "ahh".
      this.tone(330, t, 0.5, 0.03, "triangle", 262);
      this.noise(t, 0.4, 0.03, 500);
    } else return false;
    return true;
  }
  // Incident sting: a brass-style stab under a short motif of its own, so each problem is recognisable by ear.
  // The first sighting gets a longer tail while the lesson is on screen.
  sting(kind, first = false) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime,
      danger = [
        "cramp",
        "spill",
        "fish-loose",
        "blackout",
        "tower-go",
        "crash",
        "knockout",
        "overboard",
        "monkey-in",
      ].includes(kind);
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
        karen: () => {
          [0, 1, 2].forEach((i) =>
            this.tone(520 - i * 70, at + i * 0.17, 0.2, 0.12, "sawtooth", 360 - i * 50),
          );
          this.noise(at + 0.5, 0.15, 0.06, 2800);
        },
        // A spa's three soft bells, rising (someone is waiting on the massage table).
        massage: () => [659, 784, 988].forEach((f, i) => this.tone(f, at + i * 0.16, 0.35, 0.09, "sine")),
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
        storm: () => {
          this.noise(at, 0.7, 0.16, 320);
          this.tone(92, at, 0.8, 0.16, "sawtooth", 46);
          [0.34, 0.5].forEach((d) => this.noise(at + d, 0.05, 0.08, 2400));
        },
        dizzy: () =>
          [0, 1, 2, 3].forEach((i) =>
            this.tone(700 - i * 60, at + i * 0.09, 0.1, 0.09, "sine", 860 - i * 80),
          ),
        knockout: () => {
          this.noise(at, 0.6, 0.16, 300);
          [523, 392, 330, 262].forEach((f, i) =>
            this.tone(f, at + 0.1 + i * 0.1, 0.12, 0.1, "sine", f * 0.7),
          );
        },
        monster: () => [0, 0.45].forEach((d) => this.tone(440, at + d, 0.4, 0.1, "sawtooth", 880)),
        selfie: () =>
          [0, 0.16, 0.32].forEach((d) => {
            this.noise(at + d, 0.04, 0.12, 4200);
            this.tone(1900, at + d + 0.02, 0.03, 0.05, "square");
          }),
        overboard: () => {
          this.tone(1200, at, 0.55, 0.1, "sine", 300);
          this.noise(at + 0.5, 0.5, 0.14, 420);
        },
        monkey: () =>
          [0, 1, 2, 3].forEach((i) =>
            this.tone(700 + (i % 2) * 180, at + i * 0.09, 0.08, 0.09, "triangle", 1100),
          ),
        "monkey-in": () => {
          this.noise(at, 0.4, 0.14, 500);
          [1200, 1500, 1200].forEach((f, i) =>
            this.tone(f, at + 0.2 + i * 0.1, 0.09, 0.08, "sawtooth", f * 1.3),
          );
        },
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
    g.connect(this.out());
    s.onended = () => release(s, f, g);
    s.start(t);
    for (let i = 0; i < (big ? 12 : 6); i++)
      this.noise(t + 0.05 + Math.random() * length * 0.7, 0.03, 0.08, 2600);
    (big ? [523, 659, 784, 1047] : [659, 784, 1047]).forEach((n, i) =>
      this.tone(n, t + i * 0.07, 0.22, big ? 0.11 : 0.08, "triangle"),
    );
    this.tone(110, t, 0.18, 0.2, "sine", 60);
  }
  // ---- the menu's recorded music and its buttons (20 October 2026) ----------------------------------------------------
  // Recorded once and looped (assets/audio/menu-*.mp3, made seamless before encoding): `startMenu` fades a track up with the
  // ambience of the empty hall under it, `stopMenu` fades it out. The encoder's padding is left out of the loop by looping
  // between the first and the last sound in the file.
  async buffer(url) {
    if (!this.ctx) return null;
    if (!this.buffers.has(url))
      this.buffers.set(
        url,
        fetch(url)
          .then((r) => {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.arrayBuffer();
          })
          .then((data) => this.ctx.decodeAudioData(data)),
      );
    try {
      return await this.buffers.get(url);
    } catch {
      this.buffers.delete(url);
      return null;
    }
  }
  preloadMenu() {
    if (!this.ctx) return;
    for (const url of Object.values(MENU_AUDIO)) this.buffer(url);
  }
  async startMenu(track = "theme", { fade = 3, level = 1 } = {}) {
    if (!this.ctx) return;
    if (this.menu?.track === track) {
      this.menuToken++;
      return this.menuLevel(level, fade);
    }
    this.stopMenu(0.8); // (which also cancels a track still loading)
    const token = this.menuToken;
    const [music, air] = await Promise.all([
      this.buffer(MENU_AUDIO[track]),
      this.buffer(MENU_AUDIO.ambience),
    ]);
    if (token !== this.menuToken || !music) return;
    const ctx = this.ctx,
      t = ctx.currentTime + 0.05,
      gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(level, t + fade);
    gain.connect(this.musicBus);
    const nodes = [];
    for (const [buf, vol] of [
      [music, 1],
      [air, 0.5],
    ]) {
      if (!buf) continue;
      const source = ctx.createBufferSource(),
        g = ctx.createGain(),
        [from, to] = loopPoints(buf);
      source.buffer = buf;
      source.loop = true;
      source.loopStart = from;
      source.loopEnd = to;
      g.gain.value = vol;
      source.connect(g);
      g.connect(gain);
      source.start(t, from);
      nodes.push(source, g);
    }
    this.menu = { track, gain, nodes, level };
  }
  menuLevel(level, fade = 1) {
    const m = this.menu;
    if (!m || !this.ctx) return;
    const t = this.ctx.currentTime,
      g = m.gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(level, t + fade);
    m.level = level;
  }
  stopMenu(fade = 1) {
    this.menuToken++;
    const m = this.menu;
    if (!m || !this.ctx) return;
    this.menu = null;
    const t = this.ctx.currentTime,
      g = m.gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + fade);
    setTimeout(
      () => {
        for (const node of m.nodes)
          try {
            node.stop?.();
          } catch {}
        release(...m.nodes, m.gain);
      },
      fade * 1000 + 150,
    );
  }
  // The page hidden: the menu's music waits silent (it is not the shift's, which `playing` stops).
  menuHush(hushed) {
    if (this.menu) this.menuLevel(hushed ? 0 : this.menu.level, hushed ? 0.2 : 1.2);
  }
  // A menu button: "hover" (a soft tick, a hair different every time) or "click" (with a short tail).
  ui(kind) {
    if (!this.ctx || !this.enabled) return;
    const url = MENU_AUDIO[kind === "hover" ? "hover" : "click"];
    const ready = this.buffers.get(url);
    if (!ready) return void this.buffer(url);
    ready.then(
      (buf) => {
        if (!buf || !this.ctx) return;
        const source = this.ctx.createBufferSource(),
          g = this.ctx.createGain();
        source.buffer = buf;
        source.playbackRate.value = kind === "hover" ? 0.96 + Math.random() * 0.08 : 1;
        g.gain.value = kind === "hover" ? 0.45 : 0.8;
        source.connect(g);
        g.connect(this.fxBus);
        source.onended = () => release(source, g);
        source.start();
      },
      () => {},
    );
  }
  toggle() {
    this.enabled = !this.enabled;
    if (this.master) this.master.gain.setTargetAtTime(this.masterLevel(), this.ctx.currentTime, 0.05);
    if (this.enabled) this.init();
    return this.enabled;
  }
}
