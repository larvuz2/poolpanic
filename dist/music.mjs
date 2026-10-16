// The Aqua Disco's song (16 October 2026): an original disco track played live in the game's audio, on the same beat as the
// class in the water, Valentina on the stage and the lights (dance.mjs). 120 BPM in A minor, Am F C G a bar each: four on the
// floor, claps on two and four, offbeat open hats, an octave bass, chord stabs and a hook. It plays only in a class venue
// (the Aqua Disco), only while a shift plays, and it stops dead when the power cuts.
//
// Two halves. `discoScore(step)` is the song itself, pure: a sixteenth-note step in (0 is the whistle), the notes on it out, so
// a check can read it without a sound card. `DiscoMusic` plays it through a PoolAudio, a sixteenth at a time, ahead of the
// clock, kept on the shift's clock (beat 0 at the go, as the dancers are).

import { BEAT, BAR } from "./dance.mjs";

export const STEP = BEAT / 4; // one sixteenth, in seconds
export const STEPS_PER_BAR = BAR * 4;
// A2 F2 C3 G2: the bar's root, as a MIDI note.
export const ROOTS = [45, 41, 48, 43];
// Each chord's notes above its root (minor, major, major, major).
const CHORD = [
  [0, 3, 7],
  [0, 4, 7],
  [0, 4, 7],
  [0, 4, 7],
];
// The hook, four bars of sixteenths (MIDI notes, null a rest): the line a player hums on the way out.
// prettier-ignore
export const HOOK = [
  76, null, 81, null, 84, null, 83, 81, null, 79, null, 81, null, null, 76, null,
  77, null, 81, null, 84, null, 81, null, 79, null, 77, null, 76, null, null, null,
  76, null, 79, null, 84, null, 83, null, 84, null, 86, null, 88, null, null, null,
  86, null, 83, null, 79, null, 81, null, 83, null, 86, null, 83, null, null, null,
];
// After four bars of intro the song goes round in 24 bars: eight of groove, eight with the hook, four of breakdown (the kick
// drops out, pads hold the chords, the filter closes) and four of build (a snare roll, the filter opening, a sweep).
export const INTRO = 4;
export const CYCLE = 24;
export function section(bar) {
  if (bar < INTRO) return "intro";
  const c = (bar - INTRO) % CYCLE;
  return c < 8 ? "groove" : c < 16 ? "hook" : c < 20 ? "breakdown" : "build";
}
// A minor's notes (as pitch classes), and a note `degrees` steps up it.
const SCALE = [0, 2, 4, 5, 7, 9, 11];
const climb = (note, degrees) => {
  let n = note;
  for (let k = 0; k < degrees; k++)
    do n++;
    while (!SCALE.includes(n % 12));
  return n;
};
export const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// What plays on sixteenth `step` (from 0): a list of notes, each { voice, note?, len?, vol? }. `panic` is the pool in
// trouble (the alarm joins in).
export function discoScore(step, panic = false) {
  const out = [],
    bar = Math.floor(step / STEPS_PER_BAR),
    s = step % STEPS_PER_BAR, // the sixteenth in the bar
    chord = bar % 4,
    root = ROOTS[chord],
    part = section(bar),
    inCycle = bar < INTRO ? bar : (bar - INTRO) % CYCLE,
    lastOfPart = part === "intro" ? bar === INTRO - 1 : inCycle === 7 || inCycle === 15 || inCycle === 23,
    add = (voice, extra = {}) => out.push({ voice, ...extra });
  const beatStep = s % 4 === 0,
    beat = Math.floor(s / 4);
  // A crash on the first beat of every part after the intro.
  if (s === 0 && bar >= INTRO && (inCycle === 0 || inCycle === 8 || inCycle === 16)) add("crash");
  // The kick: on every beat, except in the breakdown (only its last bar's last beat, a kick back in).
  if (beatStep && (part !== "breakdown" || (inCycle === 19 && beat === 3))) add("kick");
  // Claps on two and four (from the intro's third bar); in the build, the snare roll, faster every bar.
  if (part === "build") {
    const every = inCycle === 23 ? 1 : inCycle === 22 ? 2 : 4;
    if (s % every === 0 && (every < 4 || beat % 2 === 1))
      add("clap", { vol: 0.4 + (inCycle - 20) * 0.15 + s / 64 });
  } else if (s % 8 === 4 && (part !== "intro" || bar >= 2)) add("clap");
  // Hats: a closed tick on every sixteenth (accented on the eighths), an open one on every offbeat eighth.
  if (part !== "breakdown") {
    add("hat", { vol: s % 2 === 0 ? 1 : 0.55 });
    if (s % 4 === 2 && part !== "intro") add("open");
  } else if (s % 4 === 2) add("hat", { vol: 0.7 });
  // The bass: disco octaves on the eighths (root, then the root an octave up); from the intro's second bar; held in the
  // breakdown. The last bar of each part climbs into the next.
  if (part === "breakdown") {
    if (s === 0) add("bass", { note: root, len: BEAT * 3.6, vol: 0.8 });
  } else if (s % 2 === 0 && (part !== "intro" || bar >= 1)) {
    const up = (s / 2) % 2 === 1,
      note = root + (up ? 12 : 0);
    // The fill walks up the scale: two degrees, then three.
    add("bass", { note: lastOfPart && s >= 12 ? climb(note, s === 12 ? 2 : 3) : note, len: STEP * 1.7 });
  }
  // Chord stabs on the "and" of every beat in the groove and the hook; pads held a bar in the breakdown and the build.
  if (part === "groove" || part === "hook") {
    if (s % 4 === 2)
      add("stab", { notes: CHORD[chord].map((n) => root + 24 + n), vol: s % 8 === 6 ? 1 : 0.8 });
  } else if ((part === "breakdown" || part === "build") && s === 0)
    add("pad", { notes: CHORD[chord].map((n) => root + 24 + n), len: BEAT * BAR });
  // The hook in its eight bars and over the breakdown (softer); an arpeggio of the chord in the groove.
  if (part === "hook" || part === "breakdown") {
    const n = HOOK[((inCycle - 8) % 4) * STEPS_PER_BAR + s];
    if (n !== null) add("lead", { note: n, vol: part === "breakdown" ? 0.6 : 1 });
  } else if (part === "groove" && s % 2 === 0) {
    const tones = [0, 7, 12, CHORD[chord][1] + 12, 12, 7, 19, 12];
    add("arp", { note: root + 24 + tones[(s / 2) % tones.length] });
  }
  // A rising sweep into each new part.
  if (lastOfPart && s === 0) add("sweep", { len: BEAT * BAR });
  // The pool in trouble: an alarm on one and three.
  if (panic && beatStep && beat % 2 === 0) add("alarm", { note: beat === 0 ? 88 : 84 });
  return out;
}

// ---- the Kids Pool's song (16 October 2026) -----------------------------------------------------------------------------------
// A bouncy playground tune at 132 BPM in C major (C G Am F, a bar each, the same notes as the disco's A minor): a boom-chick beat,
// an oom-pah bass, ukulele strums on two and four, a xylophone melody a child could sing, and now and then a boing or a slide
// whistle. Two bars of strumming to start, then round 16 bars: eight with the tune, eight of xylophone runs answering it.
export const KIDS_BPM = 132;
export const KIDS_STEP = 60 / KIDS_BPM / 4;
export const KIDS_ROOTS = [48, 43, 45, 41]; // C3 G2 A2 F2
const KIDS_CHORD = [
  [0, 4, 7],
  [0, 4, 7],
  [0, 3, 7],
  [0, 4, 7],
];
// prettier-ignore
export const KIDS_TUNE = [
  76, null, 76, null, 79, null, null, null, 76, null, 76, null, 79, null, null, null,
  79, null, 81, null, 79, null, 77, null, 76, null, 74, null, null, null, null, null,
  72, null, 76, null, 81, null, null, null, 79, null, 76, null, 72, null, null, null,
  77, null, 76, null, 74, null, 72, null, 74, null, null, null, null, null, null, null,
];
export const KIDS_INTRO = 2;
export const KIDS_CYCLE = 16;
export const kidsSection = (bar) =>
  bar < KIDS_INTRO ? "intro" : (bar - KIDS_INTRO) % KIDS_CYCLE < 8 ? "tune" : "runs";
export function kidsScore(step, panic = false) {
  const out = [],
    bar = Math.floor(step / STEPS_PER_BAR),
    s = step % STEPS_PER_BAR,
    chord = bar % 4,
    root = KIDS_ROOTS[chord],
    part = kidsSection(bar),
    inCycle = bar < KIDS_INTRO ? bar : (bar - KIDS_INTRO) % KIDS_CYCLE,
    beat = Math.floor(s / 4),
    add = (voice, extra = {}) => out.push({ voice, ...extra });
  // Boom on one and three, chick on two and four (from the second bar), a shaker on the eighths.
  if (s % 8 === 0 && (part !== "intro" || bar >= 1)) add("boom");
  if (s % 8 === 4 && (part !== "intro" || bar >= 1)) add("snap");
  if (s % 2 === 0) add("shaker", { vol: s % 4 === 2 ? 1 : 0.6 });
  // Oom-pah: the root on the beat, the fifth up on the off-beat.
  if (s % 4 === 0) add("kbass", { note: root, len: KIDS_STEP * 1.8 });
  if (s % 4 === 2) add("kbass", { note: root + 7, len: KIDS_STEP * 1.5, vol: 0.7 });
  // Ukulele strums on two and four, and a quick one on the "and" of four.
  if (s === 4 || s === 12 || s === 14)
    add("strum", { notes: KIDS_CHORD[chord].map((n) => root + 24 + n), vol: s === 14 ? 0.6 : 1 });
  if (part === "tune") {
    const n = KIDS_TUNE[(inCycle % 4) * STEPS_PER_BAR + s];
    if (n !== null) add("bell", { note: n });
  } else if (part === "runs" && s % 2 === 0) {
    // Xylophone runs up the chord, answered by a high note at the bar's end.
    const run = [0, 4, 7, 12, 7, 12, 16, 19];
    const pick = KIDS_CHORD[chord],
      degree = run[(s / 2) % run.length];
    const note = root + 36 + (degree === 4 ? pick[1] : degree === 16 ? pick[1] + 12 : degree);
    add("bell", { note, vol: 0.6 });
  }
  // A boing at the end of every fourth bar, a slide whistle into each new eight.
  if (s === 14 && inCycle % 4 === 3) add("boing");
  if (s === 8 && (inCycle === 7 || inCycle === 15)) add("whistle");
  if (panic && s % 4 === 0 && beat % 2 === 0) add("alarm", { note: beat === 0 ? 84 : 79 });
  return out;
}
// ---- Senior Aqua Fit's song (16 October 2026) ---------------------------------------------------------------------------------
// A tea dance in the conservatory: a gentle swing at 104 BPM in F major (Fmaj7 Dm7 Gm7 C7, a bar each). A walking bass, brushes on
// two and four, a ride cymbal's "ding, ding-a ding", piano chords on the Charleston beat (one, and the "and" of two), and a
// vibraphone tune, then eight bars of the vibes wandering over the chords; a teacup clinks at the end of every eight. The off-beat
// eighths are swung (`delay`, a third of a step late).
export const SENIOR_BPM = 104;
export const SENIOR_STEP = 60 / SENIOR_BPM / 4;
export const SENIOR_ROOTS = [41, 38, 43, 36]; // F2 D2 G2 C2
const SENIOR_CHORD = [
  [0, 4, 7, 11],
  [0, 3, 7, 10],
  [0, 3, 7, 10],
  [0, 4, 7, 10],
];
// prettier-ignore
export const SENIOR_TUNE = [
  69, null, null, null, 72, null, null, null, 69, null, 67, null, 65, null, null, null,
  74, null, 72, null, 69, null, null, null, 65, null, 69, null, 72, null, null, null,
  70, null, null, null, 69, null, 67, null, 70, null, 74, null, 72, null, null, null,
  67, null, 70, null, 69, null, 67, null, 64, null, null, null, null, null, null, null,
  69, null, null, null, 72, null, null, null, 77, null, 76, null, 74, null, null, null,
  74, null, 72, null, 69, null, null, null, 65, null, 69, null, 74, null, null, null,
  70, null, null, null, 74, null, 72, null, 70, null, 69, null, 67, null, null, null,
  72, null, 70, null, 69, null, 67, null, 65, null, null, null, null, null, null, null,
];
export const SENIOR_INTRO = 2;
export const SENIOR_CYCLE = 16;
export const seniorSection = (bar) =>
  bar < SENIOR_INTRO ? "intro" : (bar - SENIOR_INTRO) % SENIOR_CYCLE < 8 ? "tune" : "vibes";
export function seniorScore(step, panic = false) {
  const out = [],
    bar = Math.floor(step / STEPS_PER_BAR),
    s = step % STEPS_PER_BAR,
    chord = bar % 4,
    root = SENIOR_ROOTS[chord],
    next = SENIOR_ROOTS[(chord + 1) % 4],
    part = seniorSection(bar),
    inCycle = bar < SENIOR_INTRO ? bar : (bar - SENIOR_INTRO) % SENIOR_CYCLE,
    beat = Math.floor(s / 4),
    swing = s % 4 === 2 ? SENIOR_STEP / 3 : 0,
    add = (voice, extra = {}) => out.push({ voice, delay: swing, ...extra });
  // A walking bass: the root, the third, the fifth, then a half step into the next chord.
  if (s % 4 === 0) {
    const third = SENIOR_CHORD[chord][1];
    const walk = [root, root + third, root + 7, next + (next > root ? -1 : 1)][beat];
    add("walk", { note: walk, len: SENIOR_STEP * 3.4, vol: beat === 0 ? 1 : 0.8 });
  }
  // Brushes on two and four, the ride's "ding, ding-a ding".
  if (s === 4 || s === 12) add("brush");
  if (s === 0 || s === 4 || s === 8 || s === 12) add("ride", { vol: s % 8 === 4 ? 1 : 0.7 });
  if (s === 6 || s === 14) add("ride", { vol: 0.5 });
  // Piano on the Charleston beat.
  if (s === 0 || s === 6)
    add("comp", { notes: SENIOR_CHORD[chord].map((n) => root + 24 + n), vol: s === 0 ? 0.8 : 1 });
  if (part === "tune") {
    const n = SENIOR_TUNE[(inCycle % 8) * STEPS_PER_BAR + s];
    if (n !== null) add("vibe", { note: n });
  } else if (part === "vibes" && s % 2 === 0) {
    // The vibes wander up and down the chord in swung eighths, resting on the bar's last beat.
    const tones = SENIOR_CHORD[chord],
      path = [0, 1, 2, 3, 2, 1, 2, null],
      i = path[(s / 2) % path.length];
    if (i !== null) add("vibe", { note: root + 24 + tones[i] + (inCycle % 2 ? 12 : 0), vol: 0.55 });
  }
  if (s === 12 && inCycle % 8 === 7) add("clink", { delay: 0 });
  if (panic && s % 4 === 0 && beat % 2 === 0) add("alarm", { note: beat === 0 ? 84 : 79, delay: 0 });
  return out;
}

// The songs the player knows: the step length, the score, and how loud it plays.
export const SONGS = {
  disco: { step: STEP, score: discoScore, level: 1 },
  // (The kids' lighter voices, brought up to the disco's loudness: measured from both songs rendered offline.)
  kids: { step: KIDS_STEP, score: kidsScore, level: 1.6 },
  // (The tea dance is quieter still: brought up to the kids' loudness the same way.)
  senior: { step: SENIOR_STEP, score: seniorScore, level: 2.35 },
};

const release = (...nodes) => {
  for (const node of nodes)
    try {
      node.disconnect();
    } catch {}
};

// The player. `audio` is the game's PoolAudio (its context, master and noise). `clock()` says where the shift is: null when
// no song of its own plays, else { time, running, dark, song } (the shift's seconds, whether its clock runs, whether the power
// is out, and which song: "disco", the default, "kids" or "senior").
export class DiscoMusic {
  constructor(audio) {
    this.audio = audio;
    this.bus = null;
    this.anchor = null; // the audio time of the shift's second 0
    this.done = -1; // the last step scheduled
    this.dark = false;
    this.lastTick = 0;
  }
  setup() {
    const ctx = this.audio.ctx;
    if (this.bus) return;
    // Drums straight to the master; the synths through a low-pass the song opens and closes.
    this.drums = ctx.createGain();
    this.drums.gain.value = 0.9;
    this.synth = ctx.createGain();
    this.synth.gain.value = 0.85;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 2600;
    this.filter.Q.value = 2.2;
    this.bus = ctx.createGain();
    this.synth.connect(this.filter);
    this.filter.connect(this.bus);
    this.drums.connect(this.bus);
    this.bus.connect(this.audio.master);
  }
  // Called by the audio's scheduler (about 14 times a second). Returns false when no disco plays, so the usual music does.
  tick(state) {
    const a = this.audio,
      ctx = a.ctx;
    if (!state || !ctx) {
      this.anchor = null;
      return false;
    }
    this.setup();
    const song = SONGS[state.song] || SONGS.disco,
      STEP = song.step;
    if (this.song !== song) {
      this.song = song;
      this.anchor = null;
      this.drums.gain.value = 0.9 * song.level;
      this.synth.gain.value = 0.85 * song.level;
    }
    const now = ctx.currentTime,
      wanted = now - state.time;
    // Keep on the shift's clock: start on it, and come back to it after a pause, a held clock or a slowed sting.
    if (
      this.anchor === null ||
      now - this.lastTick > 0.4 ||
      Math.abs(wanted - this.anchor) > 0.12 ||
      !state.running
    ) {
      this.anchor = wanted;
      this.done = Math.max(Math.ceil((now - this.anchor) / STEP) - 1, state.time > 0 ? this.done : -1);
    }
    this.lastTick = now;
    if (state.dark !== this.dark) {
      this.dark = state.dark;
      this.powerCut(now, state.dark);
    }
    if (!state.running) return true;
    while (this.anchor + (this.done + 1) * STEP < now + 0.18) {
      const step = ++this.done,
        t = Math.max(now, this.anchor + step * STEP);
      if (this.dark) continue;
      if (step % STEPS_PER_BAR === 0) this.barFilter(step / STEPS_PER_BAR, t, song);
      for (const n of song.score(step, a.panic)) this.play(n, t + (n.delay || 0));
    }
    return true;
  }
  // The lights go and the song with them, with a record winding down; it comes back up when the fuse is reset.
  powerCut(t, dark) {
    const g = this.bus.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    if (dark) {
      g.linearRampToValueAtTime(0, t + 0.6);
      this.voice("sawtooth", 220, t, 0.8, 0.12, this.audio.master, 30);
    } else {
      g.setValueAtTime(0, t);
      g.linearRampToValueAtTime(1, t + 0.4);
      this.voice("sawtooth", 60, t, 0.5, 0.08, this.audio.master, 440);
    }
  }
  voice(type, freq, t, len, vol, out, endFreq = null, attack = 0.006) {
    const ctx = this.audio.ctx,
      o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + len);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(g);
    g.connect(out);
    o.onended = () => release(o, g);
    o.start(t);
    o.stop(t + len + 0.03);
  }
  hiss(t, len, vol, freq, type = "highpass", out = this.drums, rise = null) {
    const ctx = this.audio.ctx,
      buffer = this.audio.hissBuffer(),
      s = ctx.createBufferSource(),
      f = ctx.createBiquadFilter(),
      g = ctx.createGain();
    s.buffer = buffer;
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (rise) f.frequency.exponentialRampToValueAtTime(rise, t + len);
    if (type === "bandpass") f.Q.value = 1.4;
    if (rise) {
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + len * 0.95);
      g.gain.linearRampToValueAtTime(0, t + len);
    } else {
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + len);
    }
    s.connect(f);
    f.connect(g);
    g.connect(out);
    s.onended = () => release(s, f, g);
    s.start(t, Math.random() * Math.max(0, buffer.duration - len - 0.05), len + 0.02);
  }
  play(n, t) {
    const vol = n.vol ?? 1;
    switch (n.voice) {
      case "kick":
        this.voice("sine", 150, t, 0.32, 0.55, this.drums, 42, 0.002);
        this.hiss(t, 0.012, 0.05, 3000);
        break;
      case "clap":
        this.hiss(t, 0.14, 0.13 * Math.min(1.2, vol), 1500, "bandpass");
        this.hiss(t + 0.012, 0.05, 0.06 * Math.min(1.2, vol), 2400, "bandpass");
        break;
      case "hat":
        this.hiss(t, 0.03, 0.03 * vol, 8000);
        break;
      case "open":
        this.hiss(t, 0.16, 0.035, 7000);
        break;
      case "crash":
        this.hiss(t, 1.6, 0.06, 5000);
        break;
      case "sweep":
        this.hiss(t, n.len, 0.05, 400, "bandpass", this.drums, 6000);
        break;
      case "bass":
        this.voice("sawtooth", midi(n.note), t, n.len, 0.11 * vol, this.synth, null, 0.004);
        this.voice("sine", midi(n.note), t, n.len, 0.12 * vol, this.drums, null, 0.004);
        break;
      case "stab":
        n.notes.forEach((note, i) =>
          this.voice("sawtooth", midi(note), t + i * 0.004, 0.16, 0.035 * vol, this.synth),
        );
        break;
      case "pad":
        n.notes.forEach((note) => this.voice("triangle", midi(note), t, n.len, 0.05, this.synth, null, 0.4));
        break;
      case "lead":
        this.voice("square", midi(n.note), t, 0.2, 0.045 * vol, this.synth);
        this.voice("triangle", midi(n.note + 12), t, 0.12, 0.02 * vol, this.synth);
        break;
      case "arp":
        this.voice("triangle", midi(n.note), t, 0.1, 0.035, this.synth);
        break;
      // The kids' song's own voices.
      case "boom":
        this.voice("sine", 120, t, 0.24, 0.42, this.drums, 50, 0.002);
        break;
      case "snap":
        this.hiss(t, 0.09, 0.09, 2600, "bandpass");
        break;
      case "shaker":
        this.hiss(t, 0.05, 0.022 * vol, 7500);
        break;
      case "kbass":
        this.voice("triangle", midi(n.note), t, n.len, 0.16 * vol, this.drums, null, 0.004);
        break;
      case "strum":
        n.notes.forEach((note, i) =>
          this.voice("triangle", midi(note), t + i * 0.018, 0.22, 0.05 * vol, this.synth, null, 0.003),
        );
        break;
      case "bell":
        this.voice("sine", midi(n.note), t, 0.32, 0.075 * vol, this.synth, null, 0.002);
        this.voice("sine", midi(n.note) * 3.01, t, 0.12, 0.018 * vol, this.synth, null, 0.002);
        break;
      case "boing":
        this.voice("sine", 640, t, 0.32, 0.07, this.drums, 140, 0.004);
        break;
      case "whistle":
        this.voice("sine", 880, t, 0.5, 0.045, this.synth, 1760, 0.05);
        break;
      // Senior Aqua Fit's song's own voices.
      case "walk":
        this.voice("triangle", midi(n.note), t, n.len, 0.15 * vol, this.drums, null, 0.006);
        this.voice("sine", midi(n.note) * 2, t, n.len * 0.6, 0.03 * vol, this.drums, null, 0.006);
        break;
      case "brush":
        this.hiss(t, 0.16, 0.045, 2200, "bandpass");
        break;
      case "ride":
        this.hiss(t, 0.22, 0.018 * vol, 7000);
        this.voice("sine", 4180, t, 0.18, 0.004 * vol, this.drums, null, 0.002);
        break;
      case "comp":
        n.notes.forEach((note, i) => {
          this.voice("sine", midi(note), t + i * 0.006, 0.34, 0.03 * vol, this.synth, null, 0.004);
          this.voice("triangle", midi(note) * 2, t + i * 0.006, 0.12, 0.008 * vol, this.synth, null, 0.003);
        });
        break;
      case "vibe":
        // Two sines a hair apart: the vibraphone's shimmer.
        this.voice("sine", midi(n.note), t, 1.0, 0.06 * vol, this.synth, null, 0.003);
        this.voice("sine", midi(n.note) * 1.004, t, 1.0, 0.04 * vol, this.synth, null, 0.003);
        this.voice("sine", midi(n.note) * 4, t, 0.08, 0.01 * vol, this.synth, null, 0.002);
        break;
      case "clink":
        this.voice("sine", 2637, t, 0.5, 0.03, this.drums, null, 0.001);
        this.voice("sine", 3520, t + 0.07, 0.4, 0.022, this.drums, null, 0.001);
        break;
      case "alarm":
        this.voice("square", midi(n.note), t, 0.12, 0.05, this.drums);
        break;
    }
  }
  // Where the synths' filter sits each bar: open in the groove and the hook, shut in the breakdown, opening through the build.
  barFilter(bar, t, song = SONGS.disco) {
    if (song !== SONGS.disco) {
      // (The kids' song keeps its filter open; the tea dance a little warmer.)
      this.filter.frequency.cancelScheduledValues(t);
      this.filter.frequency.setValueAtTime(song === SONGS.senior ? 2400 : 3400, t);
      return;
    }
    const part = section(bar),
      c = (bar - INTRO) % CYCLE,
      f = this.filter.frequency,
      target =
        part === "intro" ? 1600 : part === "breakdown" ? 650 : part === "build" ? 900 + (c - 20) * 550 : 2600;
    f.cancelScheduledValues(t);
    f.setValueAtTime(f.value, t);
    f.exponentialRampToValueAtTime(target, t + (part === "build" ? BEAT * BAR : 0.35));
  }
}
