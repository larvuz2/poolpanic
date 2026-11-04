// The sound engineering pass (dist/sound-mix.mjs, dist/audio.mjs; README "Sound engineering"): the mix's tables (every venue
// with its room, ambience bed and floor, every coach with a voice, every effort made in both voices), the snapshots, the ducking,
// the placement on the deck, the footsteps' surfaces and strides, the swimmers' layer, the reverb's room; then the engine on a
// stand-in audio context: the bus tree and its limiter, voice limits and stealing, a snapshot blended in, a duck and its release,
// a loop crossfaded, a coach's footsteps and voice; and the game wired to it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BUSES,
  SNAPSHOTS,
  snapshotFor,
  DUCKS,
  dbToGain,
  LIMITS,
  limitFor,
  VOICE_CAP,
  placement,
  SPREAD,
  ROOMS,
  VENUES,
  venueSound,
  swimmersLevel,
  stepSurface,
  stride,
  stepGain,
  RUN_SPEED,
  VOICES,
  voiceOf,
  VOCALS,
  VOCAL_KINDS,
  impulse,
} from "./dist/sound-mix.mjs";
import { SFX } from "./dist/audio-files.mjs";
import { VENUES as PLACES } from "./dist/spatial.mjs";
import { COACHES } from "./dist/crew.mjs";

// 1) The tables: every venue heard, every coach with a voice, every effort in both voices, every sound made.
{
  for (const id of Object.keys(PLACES)) {
    const v = VENUES[id];
    assert.ok(v, id + ": a sound of its own");
    assert.ok(ROOMS[v.room], id + ": a room");
    assert.ok(SFX["amb-" + v.bed], id + ": its ambience bed made");
    assert.ok(SFX["step-" + v.floor], id + ": its floor's footsteps made");
    assert.ok(v.bedLevel > 0 && v.bedLevel <= 1);
  }
  assert.equal(venueSound("nowhere"), VENUES.club, "an unknown venue sounds like the Community Pool");
  for (const c of COACHES) assert.ok(VOICES[c.id], c.id + ": a voice");
  assert.equal(VOICES.rivers.set, "f", "Coach Rivers: a woman's voice");
  assert.ok(
    COACHES.filter((c) => c.id !== "rivers").every((c) => VOICES[c.id].set === "m"),
    "the others a man's, each at a pitch",
  );
  assert.equal(
    new Set(Object.values(VOICES).map((v) => v.set + v.pitch)).size,
    COACHES.length,
    "no two alike",
  );
  assert.equal(voiceOf("nobody"), VOICES.waters);
  for (const kind of VOCAL_KINDS)
    for (const set of ["m", "f"]) assert.ok(SFX[`vo-${set}-${kind}`], `vo-${set}-${kind}: made`);
  for (const r of Object.values(VOCALS)) assert.ok(r.chance > 0 && r.chance <= 1 && r.cooldown > 0);
  assert.ok(SFX["cramp-panic"] && SFX["amb-swimmers"] && SFX["door-close"]);
  for (const s of ["water", "skate"]) assert.ok(SFX["step-" + s]);
}

// 2) Snapshots and ducking.
{
  for (const [name, m] of Object.entries(SNAPSHOTS))
    for (const k of ["music", "sfx", "amb", "foley", "voice", "lowpass"])
      assert.ok(m[k] >= 0, name + "." + k);
  assert.equal(snapshotFor("playing"), "shift");
  assert.equal(snapshotFor("countdown"), "shift");
  assert.equal(snapshotFor("paused"), "paused");
  assert.equal(snapshotFor("help"), "paused");
  assert.equal(snapshotFor("menu"), "menu");
  assert.equal(snapshotFor("results"), "results");
  assert.equal(snapshotFor("replay"), "replay");
  assert.ok(SNAPSHOTS.paused.lowpass < 2000, "paused: heard as through a door");
  assert.equal(SNAPSHOTS.menu.amb, 0, "no venue's ambience under the menu's own");
  assert.equal(SNAPSHOTS.paused.foley + SNAPSHOTS.paused.voice, 0);
  for (const [type, [m, a, hold]] of Object.entries(DUCKS)) assert.ok(m < 0 && a <= 0 && hold > 0, type);
  assert.ok(DUCKS["cramp-alarm"] && DUCKS.catastrophe && DUCKS.sting && DUCKS.voice);
  assert.ok(Math.abs(dbToGain(-6) - 0.501) < 0.001);
}

// 3) Voice limits, placement, the swimmers' layer, footsteps.
{
  assert.equal(limitFor("step-tile"), LIMITS.step);
  assert.equal(limitFor("vo-f-gasp"), LIMITS.vo);
  assert.equal(limitFor("splash"), LIMITS.splash);
  assert.equal(limitFor("glug"), LIMITS.default);
  assert.ok(VOICE_CAP >= 16);
  const near = placement(0, 2),
    far = placement(1, 40),
    left = placement(-3, 10);
  assert.equal(near.pan, 0);
  assert.equal(near.gain, 1, "near: as loud as it was");
  assert.ok(far.gain < near.gain && far.gain >= 0.4, "far: softer, never lost");
  assert.ok(far.lowpass < near.lowpass, "far: duller");
  assert.equal(far.pan, SPREAD, "never hard to one side");
  assert.equal(left.pan, -SPREAD);
  assert.equal(swimmersLevel(0), 0);
  assert.ok(swimmersLevel(3) > 0 && swimmersLevel(3) < swimmersLevel(8));
  assert.equal(swimmersLevel(30), 1);
  const c = { x: 0, z: 0, y: 0 };
  assert.equal(stepSurface("club", c), "tile");
  assert.equal(stepSurface("lagoon", c), "wood");
  assert.equal(stepSurface("wave", c), "sand");
  assert.equal(stepSurface("roof", { ...c, wading: true }), "water");
  assert.equal(stepSurface("onsen", { ...c, onIce: true }), "skate");
  assert.equal(stepSurface("onsen", c), "snow");
  for (const quiet of [{ swimming: true }, { y: 0.4 }, { sliding: true }, { slipTime: 0.3 }])
    assert.equal(stepSurface("club", { ...c, ...quiet }), null, JSON.stringify(quiet));
  assert.ok(stride("tile", RUN_SPEED + 1) > stride("tile", 2), "a run's strides longer");
  assert.ok(stepGain(RUN_SPEED + 1, true) > stepGain(2, true), "and heavier");
  assert.ok(stepGain(2, false) < stepGain(2, true), "another coach's quieter");
}

// 4) The reverb's room: two channels, a moment of silence, then a tail that dies away.
{
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const made = [];
  const ctx = {
    sampleRate: 8000,
    createBuffer: (ch, n) => {
      const data = Array.from({ length: ch }, () => new Float32Array(n));
      const b = { length: n, numberOfChannels: ch, getChannelData: (i) => data[i] };
      made.push(b);
      return b;
    },
  };
  const b = impulse(ctx, ROOMS.hall, random),
    d = b.getChannelData(0);
  assert.equal(b.numberOfChannels, 2);
  assert.equal(b.length, Math.floor(8000 * ROOMS.hall.seconds));
  assert.equal(d[0], 0, "the first reflection comes a little later");
  const energy = (a, z) => d.slice(a, z).reduce((s, x) => s + x * x, 0);
  const q = Math.floor(d.length / 4);
  assert.ok(energy(q * 3, q * 4) < energy(0, q) / 50, "the tail dies away");
}

// 5) The engine, on a stand-in audio context.
{
  const { PoolAudio } = await import("./dist/audio.mjs");
  let now = 0;
  const param = (v) => {
    const p = {
      value: v,
      setValueAtTime: (x) => (p.value = x),
      setTargetAtTime: (x, t) => (t <= now + 1e-9 ? (p.value = x) : (p.later = x)),
      linearRampToValueAtTime: (x) => (p.value = x),
      exponentialRampToValueAtTime: (x) => (p.value = x),
      cancelScheduledValues: () => {},
      cancelAndHoldAtTime: () => {},
    };
    return p;
  };
  const node = (extra = {}) => ({
    out: [],
    connect(n) {
      this.out.push(n);
      return n;
    },
    disconnect() {
      this.out = [];
    },
    ...extra,
  });
  const started = [];
  const ctx = {
    sampleRate: 8000,
    state: "running",
    get currentTime() {
      return now;
    },
    destination: node({ name: "speakers" }),
    createGain: () => node({ gain: param(1) }),
    createBiquadFilter: () => node({ type: "", frequency: param(350), Q: param(1) }),
    createStereoPanner: () => node({ pan: param(0) }),
    createConvolver: () => node({ buffer: null }),
    createDynamicsCompressor: () =>
      node({
        threshold: param(-24),
        knee: param(30),
        ratio: param(12),
        attack: param(0.003),
        release: param(0.25),
      }),
    createOscillator: () => node({ frequency: param(440), type: "sine", start() {}, stop() {} }),
    createBuffer: (ch, n, rate) => {
      const data = Array.from({ length: ch }, () => new Float32Array(n));
      return {
        length: n,
        duration: n / rate,
        sampleRate: rate,
        numberOfChannels: ch,
        getChannelData: (i) => data[i],
      };
    },
    createBufferSource() {
      const s = node({
        playbackRate: param(1),
        start(at) {
          s.at = at;
          started.push(s);
        },
        stop() {
          s.stopped = true;
        },
      });
      return s;
    },
  };
  globalThis.window = {
    AudioContext: function () {
      return ctx;
    },
  };
  globalThis.setInterval = () => 0;
  const audio = new PoolAudio();
  audio.loadSfx = () => {};
  audio.init();
  // the tree: master → compressor → limiter → speakers; the game's mix through the low-pass; the interface beside it
  const comp = audio.master.out[0],
    limiter = comp.out[0];
  assert.equal(limiter.out[0], ctx.destination, "a limiter last, before the speakers");
  assert.equal(limiter.threshold.value, -2);
  assert.ok(limiter.ratio.value >= 20);
  assert.equal(audio.uiBus.out[0], audio.master, "the interface never muffled or ducked");
  assert.equal(audio.musicDuck.out[0], audio.game);
  assert.equal(audio.buses.amb.out[0], audio.ambDuck);
  assert.equal(audio.ambDuck.out[0], audio.fxBus);
  assert.ok(audio.buses.sfx.out.includes(audio.sends.sfx), "the one-shots sent to the reverb");
  assert.equal(audio.room, "outdoor");
  assert.equal(audio.snap, "menu");
  // takes: three splashes, a footstep, a voice
  const take = (seconds) => ctx.createBuffer(1, Math.floor(8000 * seconds), 8000);
  audio.sfxTakes = {
    splash: [take(1), take(1)],
    "step-tile": [take(0.3)],
    "vo-m-gasp": [take(0.6)],
    "cramp-panic": [take(6)],
    "vo-f-yelp": [take(0.7)],
    "vo-f-oof": [take(0.5)],
  };
  audio.sfxLast = {};
  // the gap: a second splash on the same instant is dropped (but counts as played: no synthesised one under it)
  assert.ok(audio.sfx("splash", 0));
  assert.equal(audio.sfx("splash", 0), true);
  assert.equal(audio.voices.length, 1);
  // the most at once: the oldest stolen
  for (let i = 1; i <= LIMITS.splash.max; i++) audio.sfx("splash", i);
  assert.equal(audio.voices.filter((v) => v.key === "splash").length, LIMITS.splash.max);
  assert.ok(started[0].stopped, "the oldest splash stolen");
  // a snapshot blended in
  audio.snapshot("paused", 0);
  assert.equal(audio.lowpass.frequency.value, SNAPSHOTS.paused.lowpass);
  assert.equal(audio.buses.foley.gain.value, 0);
  audio.snapshot("shift", 0);
  assert.equal(audio.lowpass.frequency.value, 20000);
  assert.equal(audio.buses.amb.gain.value, BUSES.amb);
  // a duck, its release scheduled after the hold; the deeper of two kept
  audio.duck(DUCKS["cramp-alarm"]);
  assert.ok(Math.abs(audio.musicDuck.gain.value - dbToGain(DUCKS["cramp-alarm"][0])) < 1e-9);
  assert.equal(audio.musicDuck.gain.later, 1, "and back up after the hold");
  audio.duck(DUCKS.voice);
  assert.ok(
    Math.abs(audio.musicDuck.gain.value - dbToGain(DUCKS["cramp-alarm"][0])) < 1e-9,
    "the deeper duck kept",
  );
  // a place on the deck: panned, softer, duller
  audio.listen = (x) => ({ sx: x / 10, distance: Math.abs(x) });
  assert.equal(audio.placeAt(0, 0), null, "right where the ear is: no chain");
  const placed = audio.placeAt(10, 0);
  assert.ok(placed.pan.value > 0, "to the right");
  // an event at a place: its sound goes through that place
  now = 10;
  audio.enabled = true;
  audio.effect("splash", { x: 10, z: 0 });
  assert.notEqual(started.at(-1).out[0].out[0], audio.buses.sfx, "placed, not straight to the bus");
  assert.equal(audio.route, null, "the place let go of after the event");
  // the shift's frame: the bed (fetched when wanted), the swimmers' layer, the struggle while someone is stranded
  audio.loopBuffer = (key) => take(4);
  audio.frame({ snapshot: "shift", venue: "senior", swimmers: 6, distress: { x: 2, z: 0 } });
  assert.equal(audio.room, "glass");
  assert.equal(audio.loops.get("bed").key, "amb-conservatory");
  assert.ok(Math.abs(audio.loops.get("swimmers").level - swimmersLevel(6)) < 1e-9);
  assert.equal(audio.loops.get("distress").key, "cramp-panic");
  audio.frame({ snapshot: "shift", venue: "senior", swimmers: 6, distress: null });
  assert.ok(!audio.loops.has("distress"), "the struggle stops with the rescue");
  audio.frame({ snapshot: "menu", venue: null });
  assert.equal(audio.loops.size, 0, "the menu: no venue's loops");
  // a coach walking: a step every stride; standing: none; a trouble clip: a voice, once
  audio.frame({ snapshot: "shift", venue: "club" });
  let stepped = 0;
  const realSfx = audio.sfx.bind(audio);
  audio.sfx = (k, ...a) => {
    if (k === "step-tile") stepped++;
    return realSfx(k, ...a);
  };
  const c = { x: 0, z: 0, y: 0, vx: 3, vz: 0 };
  for (let i = 0; i < 60; i++) {
    now += 1 / 60;
    c.x += 3 / 60;
    audio.coachFrame(0, c, { local: true, clip: "run", look: "waters" });
  }
  assert.ok(stepped >= 2 && stepped <= 3, "three metres at a walk: two or three steps (" + stepped + ")");
  const before = stepped;
  for (let i = 0; i < 60; i++) audio.coachFrame(0, c, { local: true, clip: "idle", look: "waters" });
  assert.equal(stepped, before, "standing: no steps");
  const realRandom = Math.random;
  Math.random = () => 0;
  audio.coachFrame(0, c, { local: true, clip: "startle", look: "waters" });
  audio.coachFrame(0, c, { local: true, clip: "startle", look: "waters" });
  assert.equal(audio.voices.filter((v) => v.key === "vo-m-gasp").length, 1, "the jolt: one gasp");
  // a slip: Coach Rivers yelps, and down she goes (her own voice, the oof straight after)
  audio.vocal("coach-slip", 1, "rivers", true, c);
  assert.ok(audio.voices.some((v) => v.key === "vo-f-yelp"));
  assert.ok(
    audio.voices.some((v) => v.key === "vo-f-oof" && v.at > now),
    "the oof after the yelp",
  );
  audio.vocal("coach-slip", 1, "rivers", true, c);
  assert.equal(audio.voices.filter((v) => v.key === "vo-f-yelp").length, 1, "one mouth: not twice at once");
  Math.random = realRandom;
}

// 6) Wired in.
{
  const audio = readFileSync("dist/audio.mjs", "utf8"),
    app = readFileSync("dist/app.mjs", "utf8"),
    scene = readFileSync("dist/scene.mjs", "utf8");
  assert.match(audio, /if \(DUCKS\[type\]\) this\.duck\(DUCKS\[type\]\);/);
  assert.match(audio, /this\.route = e\.x != null && e\.z != null \? this\.placeAt\(e\.x, e\.z\) : null;/);
  assert.match(audio, /this\.duck\(DUCKS\.sting\);/);
  assert.match(audio, /g\.connect\(this\.uiBus\);/, "the menu's buttons on the interface bus");
  assert.match(app, /stage\("sound", soundFrame\);/);
  assert.match(
    app,
    /audio\.frame\(\{ snapshot: snapshotFor\(mode\), venue: venue\?\.id \?\? null, swimmers, distress \}\);/,
  );
  assert.match(app, /audio\.effect\("door-close", venue\.arrival\.at\(side, "door"\)\);/);
  assert.match(app, /world\.onCoach = \(i, c, o\) => audio\.coachFrame\(i, c, o\);/);
  assert.match(app, /audio\.away\(document\.hidden\);/);
  assert.match(scene, /this\.onCoach\?\.\(index, c, \{ local, clip: rig\?\.current \?\? null/);
}

console.log(
  `Sound mix checks passed: ${Object.keys(VENUES).length} venues each with a room, an ambience bed and a floor; ${Object.keys(VOICES).length} coaches each with a voice (Coach Rivers a woman's), ${VOCAL_KINDS.length} efforts in both voices; snapshots, ducking, voice limits, placement, footsteps and the reverb's room; the engine's bus tree with a limiter, stealing, a snapshot, a duck, a placed event, the loops and a coach's steps and gasp on a stand-in context; and the game wired to it.`,
);
