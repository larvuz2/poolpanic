// Recording a shift and playing it again (dist/replay.mjs, tools/replay.mjs). The simulation is seeded and ticks in fixed steps, so a shift
// is decided by its level, its seed and the player's inputs: a recording made while a bot plays must replay to exactly the same state, and a
// recording that is tampered with must say where it drifts. The bot gives every input the game has, at random, and the replay is run
// from the record after it has been through JSON as the crash log would send it.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PoolSimulation } from "./dist/sim.mjs";
import { DRILLS } from "./dist/drills.mjs";
import { CrashLog } from "./dist/crashlog.mjs";
import { Recorder, INPUTS, REPLAY_LIMITS, stateHash } from "./dist/replay.mjs";
import { replay, makeSim, readRecords, apply } from "./tools/replay.mjs";

const TOOL = fileURLToPath(new URL("./tools/replay.mjs", import.meta.url)); // (run with the node that is running this, from wherever it is run)
const random = (seed) => {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
};
const S = Math.SQRT1_2,
  VECTORS = [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [S, S],
    [-S, S],
    [S, -S],
    [-S, -S],
  ];

// A bot that gives the simulation every kind of input at random, and what it did.
function play(sim, seconds, seed, { recorder = null, extra = () => {} } = {}) {
  const r = random(seed * 7 + 1);
  for (let t = 0; t < seconds * 60 && sim.status !== "ended"; t++) {
    if (t % 25 === 0) sim.setMovement(...VECTORS[Math.floor(r() * VECTORS.length)]);
    const x = r();
    if (x < 0.01) sim.interact();
    else if (x < 0.014) sim.jump();
    else if (x < 0.017) sim.dash();
    else if (x < 0.02) sim.assign(Math.floor(r() * 3));
    else if (x < 0.022) sim.fetch(["fins", "chlorine", "relief", "lifering"][Math.floor(r() * 4)]);
    else if (x < 0.023) sim.returnItem();
    else if (x < 0.024) sim.tidy();
    else if (x < 0.0245) sim.setHold(r() < 0.5);
    else if (x < 0.025) sim.approachVisitor(sim.visitors[0]?.id ?? 0);
    else if (x < 0.0255)
      sim.useFixture(["fishNet", "treats", "fuseBox", "flashlight", "medkit"][Math.floor(r() * 5)]);
    extra(sim, t);
    sim.tick(1 / 60);
    sim.events.length = 0;
  }
}
const viaJson = (record) => JSON.parse(JSON.stringify(record));

// 1) Every kind of shift replays to the same state: a plain level, a trampoline level, the finale, Karen's level, a booking, a drill, and
// incidents and a cramp started by hand in the middle (those are inputs too).
{
  const cases = [
    { level: 3, seed: 41, seconds: 70 },
    { level: 4, seed: 2024, seconds: 100 },
    { level: 10, seed: 777, seconds: 100 },
    { level: 14, seed: 5, seconds: 100 },
    { level: 18, seed: 99, seconds: 100 },
    { level: 6, seed: 11, seconds: 60, booking: "regular" },
  ];
  for (const meta of cases) {
    const sim = makeSim({ ...meta, seed: meta.seed });
    const recorder = new Recorder(sim, { level: meta.level, seed: meta.seed, booking: meta.booking || "" });
    sim.start({ countdown: true });
    play(sim, meta.seconds, meta.seed, {
      extra(s, t) {
        if (t === 600) s.triggerChaos("fish");
        if (t === 1500) {
          const p = s.people.find((q) => q.status === "swim" && !q.problem);
          if (p) s.startCramp(p);
        }
      },
    });
    const record = viaJson(recorder.record);
    assert.ok(record.ticks > 60 * 30, "the shift ran");
    assert.ok(record.inputs.length > 50, "and it was given inputs");
    const out = replay(record);
    assert.equal(out.drift, null, `level ${meta.level} kept in step at every checkpoint`);
    assert.equal(out.hash, stateHash(sim), `level ${meta.level} ends in the very same state`);
    assert.equal(out.sim.score, sim.score);
    assert.equal(out.ticks, record.ticks);
    assert.ok(record.checks.length >= Math.floor(record.ticks / REPLAY_LIMITS.checkEvery));
    assert.ok(
      JSON.stringify(record).length < 15000,
      `a ${Math.round(record.ticks / 60)} s shift is ${JSON.stringify(record).length} bytes`,
    );
  }
}

// 2) A drill is replayed as the drill it was (its own configuration), and the cannonball man that was asked for is the one that comes.
{
  const id = Object.keys(DRILLS)[0];
  const drill = DRILLS[id];
  const meta = { level: drill.tier, seed: 31337, drill: id, man: "leopard" };
  const sim = makeSim(meta);
  const recorder = new Recorder(sim, meta);
  sim.start({ countdown: true });
  play(sim, 60, 5);
  const out = replay(viaJson(recorder.record));
  assert.equal(out.drift, null);
  assert.equal(out.hash, stateHash(sim));
  assert.equal(out.sim.drill, id);
  assert.equal(out.sim.config.cannonball, "leopard");
  assert.throws(() => makeSim({ ...meta, drill: "no-such-drill" }), /not in this build/);
}

// 3) Only the outermost call of an input is recorded: what the simulation does inside one (a click that sends the coach to a fixture
// calls other inputs of the simulation) is not logged twice, or the replay would do it twice.
{
  const sim = makeSim({ level: 10, seed: 3 });
  const recorder = new Recorder(sim, { level: 10, seed: 3 });
  sim.start({ countdown: true });
  for (let t = 0; t < 400; t++) sim.tick(1 / 60);
  const inner = [];
  const original = sim.interact;
  sim.useFixture("fuseBox");
  sim.fetch("lifering");
  sim.approachVisitor(0);
  const names = recorder.record.inputs.map((e) => e[1]);
  assert.deepEqual(
    names,
    ["useFixture", "fetch", "approachVisitor"],
    "one entry for each call that was made from outside",
  );
  assert.equal(typeof original, "function");
  void inner;
  // …and an input that fails to exist in this build is said, not skipped.
  assert.throws(() => apply(sim, [0, "noSuchInput"], { vecs: [] }), /no input noSuchInput/);
  // The inputs the recorder wraps are all there in the simulation.
  for (const name of INPUTS)
    assert.equal(typeof sim[name], "function", name + " is a method of the simulation");
}

// 4) Movement is a number into a table of the vectors seen (a keyboard has nine), and goes in only when it changes; clearing the input
// forgets what was last given; beyond the table's size the vectors are written out.
{
  const sim = makeSim({ level: 1, seed: 1 });
  const recorder = new Recorder(sim, { level: 1, seed: 1 });
  sim.start({ countdown: true });
  sim.setMovement(1, 0);
  sim.setMovement(1, 0); // (the game gives it every frame: only a change is news)
  sim.tick(1 / 60);
  sim.setMovement(0, 1);
  sim.tick(1 / 60);
  sim.setMovement(1, 0);
  sim.clearInput();
  sim.setMovement(1, 0);
  const r = recorder.record;
  assert.deepEqual(r.vecs, [
    [1, 0],
    [0, 1],
  ]);
  assert.deepEqual(r.inputs, [
    [0, "m", 0],
    [1, "m", 1],
    [2, "m", 0],
    [2, "clearInput"],
    [2, "m", 0],
  ]);
  const saved = REPLAY_LIMITS.vectors;
  REPLAY_LIMITS.vectors = 2;
  sim.setMovement(0.3, 0.4);
  REPLAY_LIMITS.vectors = saved;
  assert.deepEqual(r.inputs.at(-1), [2, "setMovement", 0.3, 0.4], "past the table: the numbers themselves");
  assert.equal(r.vecs.length, 2);
  assert.deepEqual(apply(makeSim({ level: 1, seed: 1 }), [0, "m", 1], r) ?? null, null);
}

// 5) The ticks are the shift's: a paused shift's ticks are not counted, so the replay does not wait through them.
{
  const sim = makeSim({ level: 3, seed: 8 });
  const recorder = new Recorder(sim, { level: 3, seed: 8 });
  sim.start({ countdown: true });
  for (let t = 0; t < 400; t++) sim.tick(1 / 60);
  const was = sim.status; // (the game puts back the status it paused)
  sim.status = "paused";
  for (let t = 0; t < 500; t++) sim.tick(1 / 60);
  assert.equal(recorder.record.ticks, 400, "nothing counted while paused");
  sim.status = was;
  sim.interact();
  for (let t = 0; t < 400; t++) sim.tick(1 / 60);
  const out = replay(viaJson(recorder.record));
  assert.equal(out.hash, stateHash(sim), "…and the replay still ends where the shift did");
}

// 6) A record that is cut short says so, and a replay of it still runs; a look angle that has not moved is not news.
{
  const sim = makeSim({ level: 3, seed: 8 });
  const recorder = new Recorder(sim, { level: 3, seed: 8 });
  const saved = REPLAY_LIMITS.inputs;
  REPLAY_LIMITS.inputs = 5;
  sim.start({ countdown: true });
  for (let i = 0; i < 20; i++) {
    sim.setMovement(i % 2, 1 - (i % 2));
    sim.tick(1 / 60);
  }
  REPLAY_LIMITS.inputs = saved;
  assert.equal(recorder.record.inputs.length, 5);
  assert.equal(recorder.record.truncated, true);
  assert.doesNotThrow(() => replay(viaJson(recorder.record)));

  const looking = new Recorder(makeSim({ level: 3, seed: 8 }), { level: 3, seed: 8 });
  looking.look(1.2);
  looking.look(1.2001);
  looking.look(1.21);
  looking.look(null);
  looking.look(null);
  looking.look(NaN);
  assert.deepEqual(looking.record.inputs, [
    [0, "look", 1.2],
    [0, "look", 1.21],
    [0, "look", null],
  ]);
  const watcher = makeSim({ level: 3, seed: 8 });
  apply(watcher, [0, "look", 0.7], { vecs: [] });
  assert.equal(watcher.coach.lookAngle, 0.7);
  apply(watcher, [0, "look", null], { vecs: [] });
  assert.equal(watcher.coach.lookAngle, null);
}

// 7) A recording that is altered says where it drifts, and before that point the replay was in step.
{
  const sim = makeSim({ level: 10, seed: 777 });
  const recorder = new Recorder(sim, { level: 10, seed: 777 });
  sim.start({ countdown: true });
  play(sim, 100, 777);
  const record = viaJson(recorder.record);
  const spoiled = viaJson(record);
  const at = spoiled.inputs.findIndex((e) => e[0] > 2000 && e[1] === "m");
  assert.ok(at > 0);
  spoiled.inputs[at] = [spoiled.inputs[at][0], "m", (spoiled.inputs[at][2] + 3) % spoiled.vecs.length];
  const out = replay(spoiled);
  assert.ok(out.drift, "the changed input leads somewhere else");
  assert.ok(out.drift.tick > spoiled.inputs[at][0], "and not before it was made");
  assert.notEqual(out.drift.want, out.drift.got);
  // A replay can stop at a time, and the simulation is there to look at.
  const early = replay(record, { until: 900 });
  assert.equal(early.ticks, 900);
  assert.equal(early.drift, null);
  assert.ok(early.sim.time < 16);
  // A record that does not fit this build is a plain error.
  assert.throws(() => replay({ ...record, level: 10, inputs: [[0, "teleport", 1]] }), /no input teleport/);
}

// 8) The recorder belongs in the crash log: attached by reference, the inputs added later are written at the next flush, the report
// carries the newest record as one line of JSON, and tools/replay.mjs reads it back out of the report.
{
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
  };
  const log = new CrashLog({ storage, now: () => 1_790_000_000_000, schedule: () => 1 });
  log.start({ build: { commit: "abc1234" } });
  const sim = makeSim({ level: 10, seed: 777 });
  const recorder = new Recorder(sim, { level: 10, seed: 777 });
  sim.start({ countdown: true });
  log.attach("replays", recorder.record);
  play(sim, 40, 777);
  log.flush(true);
  const stored = JSON.parse(store.get(log.key + "." + log.session.id));
  assert.equal(stored.replays.length, 1);
  assert.equal(
    stored.replays[0].ticks,
    recorder.record.ticks,
    "what the recorder added afterwards is what was stored",
  );
  const report = log.report(log.session, { replay: 1 });
  assert.match(report, /\n## Replay: level 10 seed 777 \(\d+ inputs\)\n\n```json\n\{"v":1,/);
  assert.ok(!log.report(log.session).includes("## Replay"), "a report asked for without it has none");
  const [back] = readRecords(report);
  assert.equal(replay(back).hash, stateHash(sim));
  assert.equal(readRecords(JSON.stringify(back)).length, 1, "a bare record reads too");
  assert.equal(readRecords(JSON.stringify([back, back])).length, 2);
  assert.equal(readRecords(JSON.stringify({ replays: [back] })).length, 1, "and a session");

  // The command line tool: replay a report, with the diary, to a time.
  const dir = mkdtempSync(join(tmpdir(), "replay-"));
  try {
    const file = join(dir, "report.md");
    writeFileSync(file, report);
    const out = execFileSync(process.execPath, [TOOL, file, "--diary", "--pulse", "--until", "30"], {
      encoding: "utf8",
    });
    assert.match(out, /^Replaying level 10 · seed 777 · \d+ ticks/);
    assert.match(out, /\nplan {6}plan: /);
    assert.match(out, /\nshift {5}t0s status none → countdown\n/);
    assert.match(out, /\npulse {5}t\d+s score /);
    assert.match(out, /Ended at tick 1800 \(shift time 2\d\.\d s\)/);
    assert.match(out, /Every checkpoint matched \(6\)\./);
    const whole = execFileSync(process.execPath, [TOOL, file], { encoding: "utf8" });
    assert.match(whole, /Every checkpoint matched/);
    assert.ok(!/\nincident /.test(whole), "without --diary it says only how it went");
    assert.throws(() => execFileSync(process.execPath, [TOOL], { stdio: "pipe" }), /usage/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// 9) The recorder only watches: when something in it breaks, the recording stops and says so, and the shift goes on untouched.
{
  const sim = makeSim({ level: 3, seed: 8 });
  const recorder = new Recorder(sim, { level: 3, seed: 8 });
  sim.start({ countdown: true });
  for (let t = 0; t < 120; t++) sim.tick(1 / 60);
  sim.interact();
  const before = recorder.record.inputs.length;
  recorder.after = () => {
    throw new Error("the hash broke");
  };
  assert.doesNotThrow(() => {
    for (let t = 0; t < 10; t++) sim.tick(1 / 60);
  }, "a tick whose recording failed is still a tick");
  assert.match(recorder.record.broken, /the hash broke/);
  assert.equal(sim.arrivalTime > 0 || sim.status === "countdown", true);
  assert.doesNotThrow(() => sim.interact());
  assert.doesNotThrow(() => recorder.look(1));
  assert.equal(recorder.record.inputs.length, before, "nothing more is recorded once it is broken");
  const log = recorder.log;
  recorder.log = () => {
    throw new Error("the log broke");
  };
  const fresh = new Recorder(makeSim({ level: 3, seed: 8 }), { level: 3, seed: 8 });
  fresh.log = recorder.log;
  assert.doesNotThrow(() => fresh.sim.jump(), "an input whose recording failed is still an input");
  assert.match(fresh.record.broken, /the log broke/);
  recorder.log = log;
}

// 10) The shift the crash hunt plays on the device (dist/hunt/lunch-rush.json: the level 2 shift that ended an iPad's page, as the recorder kept
// it) is a record this build can still play through, with every input given. (A balance change may move the simulation off the recording's
// hashes, and then the hunt plays a shift like it, not the same: that is said here, not failed on.) `apply` is the one the game itself uses.
{
  const text = readFileSync(new URL("./dist/hunt/lunch-rush.json", import.meta.url), "utf8"),
    [record] = readRecords(text);
  assert.equal(record.level, 2);
  assert.ok(record.inputs.length > 30 && record.ticks > 2400, "a real shift, played for more than 40 s");
  assert.ok(record.seed > 0 && !record.truncated && !record.broken, "a whole recording");
  const given = [];
  const result = replay(record, { onTick: (sim) => given.push(sim.status) });
  assert.equal(result.ticks, record.ticks, "played through to the last recorded tick");
  assert.ok(
    ["playing", "countdown"].includes(result.sim.status),
    "and still being played at it, not ended by it",
  );
  assert.equal(typeof apply, "function");
  if (result.drift)
    console.log(
      "(Note: the hunt's recorded shift has drifted from its recording at tick " +
        result.drift.tick +
        ": the simulation has changed since it was made. The hunt plays a shift like it, not the same one.)",
    );
}

console.log(
  "Replay checks passed: shifts of every kind (levels, a booking, a drill, incidents and a cramp started by hand) recorded while a bot gave every input and replayed to the very same state at every checkpoint, only outermost inputs recorded, movement kept as a table of vectors, paused ticks left out, a cut-short record, a recorder that breaks without breaking the shift, a tampered one that says where it drifts, the record carried by the crash log and read back out of a report, and the command line replayer.",
);
