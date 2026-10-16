// The Aqua Disco's song (dist/music.mjs): the score is a disco track that keeps time with the class (dance.mjs: a kick on
// every beat the dancers hit, a bar per clip), goes round its parts (intro, groove, hook, breakdown, build) for as long as a
// shift lasts, and the player keeps it on the shift's clock: beat 0 at the go, nothing in the countdown, nothing twice after
// a pause, quiet in a power cut, and the usual music back the moment no disco plays. Driven with a fake audio context.
import assert from "node:assert/strict";
import { PoolAudio } from "./dist/audio.mjs";
import {
  discoScore,
  section,
  DiscoMusic,
  STEP,
  STEPS_PER_BAR,
  ROOTS,
  HOOK,
  INTRO,
  CYCLE,
} from "./dist/music.mjs";
import { danceAt, BEAT, BAR } from "./dist/dance.mjs";

function fakeContext() {
  const nodes = [];
  const param = () => ({
    value: 1,
    calls: [],
    setValueAtTime(v, t) {
      this.calls.push(["set", v, t]);
    },
    linearRampToValueAtTime(v, t) {
      this.calls.push(["linear", v, t]);
    },
    exponentialRampToValueAtTime(v, t) {
      this.calls.push(["exp", v, t]);
    },
    cancelScheduledValues(t) {
      this.calls.push(["cancel", t]);
    },
  });
  const make = (kind, extra = {}) => {
    const n = {
      kind,
      outputs: [],
      connect(to) {
        n.outputs.push(to);
        return to;
      },
      disconnect() {},
      start(...args) {
        n.started = args;
      },
      stop() {},
      ...extra,
    };
    nodes.push(n);
    return n;
  };
  return {
    nodes,
    currentTime: 5,
    sampleRate: 44100,
    createOscillator: () => make("oscillator", { frequency: param(), type: "sine" }),
    createGain: () => make("gain", { gain: param() }),
    createBufferSource: () => make("source", { buffer: null }),
    createBiquadFilter: () => make("filter", { type: "", frequency: param(), Q: param() }),
    createDynamicsCompressor: () => make("compressor"),
    createBuffer: (channels, length, rate) => ({
      duration: length / rate,
      getChannelData: () => new Float32Array(length),
    }),
  };
}
const voices = (step) => discoScore(step).map((n) => n.voice);
const bars = (from, to) => Array.from({ length: to - from }, (_, i) => from + i);

// 1) The score keeps the dancers' time: sixteenths of the dance's beat, a bar of the song for a clip of the routine.
assert.equal(STEP * 4, BEAT);
assert.equal(STEPS_PER_BAR, BAR * 4);
for (let step = 0; step < 16 * 40; step++) {
  const at = danceAt(step * STEP + 1e-9);
  if (step % 4 === 0) assert.ok(at.phase < 1e-6, "A quarter of the song's steps fall on the dance's beats");
  assert.equal(at.bar, Math.floor(step / STEPS_PER_BAR), "The song's bar is the routine's bar");
}

// 2) Its parts: four bars of intro, then round 24 bars (eight of groove, eight of hook, four of breakdown, four of build).
assert.deepEqual(bars(0, 4 + CYCLE + 1).map(section), [
  ...Array(INTRO).fill("intro"),
  ...Array(8).fill("groove"),
  ...Array(8).fill("hook"),
  ...Array(4).fill("breakdown"),
  ...Array(4).fill("build"),
  "groove",
]);
// A two-minute shift (60 bars) hears every part, the hook more than once.
const heard = bars(0, 60).map(section);
for (const part of ["intro", "groove", "hook", "breakdown", "build"])
  assert.ok(heard.includes(part), `${part} is heard`);
assert.ok(heard.filter((p) => p === "hook").length >= 16);

// 3) Four on the floor: a kick on every beat outside the breakdown (which drops it until its last beat), and only on beats.
for (const bar of bars(0, 60)) {
  for (let s = 0; s < STEPS_PER_BAR; s++) {
    const step = bar * STEPS_PER_BAR + s,
      kick = voices(step).includes("kick"),
      c = (bar - INTRO) % CYCLE;
    if (s % 4) assert.ok(!kick, "No kick between the beats");
    else if (section(bar) !== "breakdown") assert.ok(kick, `A kick on beat ${s / 4 + 1} of bar ${bar}`);
    else assert.equal(kick, c === 19 && s === 12, "The breakdown drops the kick, then kicks back in");
  }
}
// Claps on two and four in the groove and the hook; the build's roll gets faster towards the drop.
for (const bar of [INTRO, INTRO + 9]) {
  const claps = bars(0, 16).filter((s) => voices(bar * 16 + s).includes("clap"));
  assert.deepEqual(claps, [4, 12], `Claps on two and four in bar ${bar}`);
}
const roll = (c) => bars(0, 16).filter((s) => voices((INTRO + c) * 16 + s).includes("clap")).length;
assert.ok(roll(20) < roll(22) && roll(22) < roll(23), "The snare roll speeds up through the build");
assert.equal(roll(23), 16);

// 4) The harmony: Am F C G, a bar each; the bass plays the bar's root (an octave apart), the hook is in the hook bars only.
for (const bar of bars(INTRO, INTRO + 8)) {
  const root = ROOTS[bar % 4],
    bass = bars(0, 12)
      .flatMap((s) => discoScore(bar * 16 + s))
      .filter((n) => n.voice === "bass");
  assert.ok(bass.length >= 6);
  for (const n of bass)
    assert.ok([root, root + 12].includes(n.note), `The bass in bar ${bar} plays its root`);
}
const leads = (from, to) =>
  bars(from * 16, to * 16)
    .flatMap((step) => discoScore(step))
    .filter((n) => n.voice === "lead").length;
assert.equal(leads(INTRO, INTRO + 8), 0, "No hook in the groove");
assert.equal(
  leads(INTRO + 8, INTRO + 12),
  HOOK.filter((n) => n !== null).length,
  "The hook's four bars in full",
);
assert.equal(HOOK.length, 4 * STEPS_PER_BAR);
// Every note is in A minor (A B C D E F G).
const scale = new Set([9, 11, 0, 2, 4, 5, 7]);
for (const step of bars(0, 60 * 16))
  for (const n of discoScore(step)) {
    for (const note of [n.note, ...(n.notes || [])].filter((x) => x !== undefined && n.voice !== "alarm"))
      assert.ok(scale.has(note % 12), `${n.voice} ${note} is in A minor`);
  }
// The pool in trouble adds an alarm on one and three; the song is the same.
assert.deepEqual(
  bars(0, 16).filter((s) => discoScore(INTRO * 16 + s, true).some((n) => n.voice === "alarm")),
  [0, 8],
);
assert.deepEqual(discoScore(77), discoScore(77), "The score is the same every time");

// 5) The player, on the shift's clock.
const game = () => {
  const a = new PoolAudio();
  a.ctx = fakeContext();
  a.master = a.ctx.createGain();
  const played = [];
  const m = new DiscoMusic(a),
    play = m.play.bind(m);
  m.play = (n, t) => {
    played.push({ ...n, t });
    play(n, t);
  };
  return { a, m, played };
};
{
  const { a, m, played } = game();
  // No disco: the usual music plays.
  assert.equal(m.tick(null), false);
  assert.equal(played.length, 0);
  // The countdown (the shift's clock not running yet): the song waits.
  assert.equal(m.tick({ time: 0, running: false, dark: false }), true);
  a.ctx.currentTime += 0.07;
  m.tick({ time: 0, running: false, dark: false });
  assert.equal(played.length, 0, "Nothing in the countdown");
  // The go: beat 0 (the kick) now, then the shift's seconds and the song's steps go together.
  const go = a.ctx.currentTime;
  let time = 0;
  for (let i = 0; i < 300; i++) {
    m.tick({ time, running: true, dark: false });
    a.ctx.currentTime += 0.07;
    time += 0.07;
  }
  assert.ok(
    played.some((n) => n.voice === "kick" && Math.abs(n.t - go) < 1e-6),
    "The first kick is on the go",
  );
  const kicks = played.filter((n) => n.voice === "kick").map((n) => n.t - go);
  kicks.forEach((t, i) => assert.ok(Math.abs(t - i * BEAT) < 1e-6, `Kick ${i} on beat ${i}`));
  assert.ok(Math.abs(m.done - Math.floor((time + 0.18) / STEP)) <= 1, "Scheduled a little ahead, no further");
  // A pause (no ticks for three seconds while the clock is stopped), then on: no step twice, and back on the clock.
  const before = m.done,
    count = played.length;
  a.ctx.currentTime += 3;
  for (let i = 0; i < 30; i++) {
    m.tick({ time, running: true, dark: false });
    a.ctx.currentTime += 0.07;
    time += 0.07;
  }
  assert.ok(m.done > before);
  const after = played.slice(count);
  assert.ok(
    after.every((n) => n.t >= a.ctx.currentTime - 30 * 0.07 - 1e-6),
    "Nothing scheduled in the past",
  );
  const steps = new Set();
  for (const n of played.filter((n) => n.voice === "hat")) {
    const k = Math.round((n.t / STEP) * 1000);
    assert.ok(!steps.has(k), "No step played twice");
    steps.add(k);
  }
  const anchor = a.ctx.currentTime - time;
  assert.ok(Math.abs(m.anchor - anchor) < 0.12, "Back on the shift's clock after the pause");
  // The power cut: the song goes quiet (the bus falls to 0) and no note plays in the dark; it comes back with the lights.
  const lit = played.length;
  for (let i = 0; i < 20; i++) {
    m.tick({ time, running: true, dark: true });
    a.ctx.currentTime += 0.07;
    time += 0.07;
  }
  assert.equal(played.length, lit, "Nothing plays in a power cut");
  assert.ok(
    m.bus.gain.calls.some((c) => c[0] === "linear" && c[1] === 0),
    "The song fades out with the lights",
  );
  m.tick({ time, running: true, dark: false });
  assert.ok(played.length > lit, "The song comes back with the lights");
  assert.ok(m.bus.gain.calls.some((c) => c[0] === "linear" && c[1] === 1));
}
// 6) PoolAudio plays the disco while its clock says one plays, and its own music otherwise.
{
  const a = new PoolAudio();
  a.ctx = fakeContext();
  a.master = a.ctx.createGain();
  a.playing = true;
  let disco = null;
  a.clock = () => disco;
  a.next = a.ctx.currentTime;
  a.schedule();
  const usual = a.step;
  assert.ok(usual > 0, "The usual music without a disco");
  disco = { time: 0, running: true, dark: false };
  a.schedule();
  assert.equal(a.step, usual, "The usual music stops in the disco");
  assert.ok(a.disco.done >= 0, "The disco's song plays");
  disco = null;
  a.ctx.currentTime += 0.07;
  a.schedule();
  assert.ok(a.step > usual, "And the usual music comes back after it");
}
console.log(
  "Music checks passed: the disco song keeps the dance's beat, goes round its parts, and keeps the shift's clock.",
);
