// The crash hunt: the URL switches, and the plan that runs them one test at a time and survives the crashes it
// hunts (a test left running when the next page loads counts as a crash).
import assert from "node:assert/strict";
import { readTuning, SAFE, isWebKit } from "./dist/tuning.mjs";
import * as hunt from "./dist/bisect.mjs";

const memory = () => {
  const data = new Map();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
  };
};

// 1) Switches: from the address, from the hunt, and `safe` means all of them.
{
  const t = readTuning("?nosound&dpr=1&foo");
  assert.ok(t.has("nosound") && t.has("foo") && !t.has("noshadow"));
  assert.equal(t.number("dpr", 1.7), 1);
  assert.equal(readTuning("").number("dpr", 1.7), 1.7, "No switch, the default");
  assert.equal(readTuning("?dpr=abc").number("dpr", 1.7), 1.7, "Not a number, the default");
  assert.equal(readTuning("?dpr=-2").number("dpr", 1.7), 1.7, "Not a sane number, the default");
  assert.ok(readTuning("", ["noshadow"]).has("noshadow"), "The hunt adds its own");
  const safe = readTuning("?safe");
  for (const k of SAFE) assert.ok(safe.has(k), k);
  assert.ok(!safe.has("overview"), "safe keeps the camera");
  assert.deepEqual(readTuning("").list(), []);
  assert.deepEqual(
    readTuning("?trial&noparticles&trialsecs=45&dpr=1").list().sort(),
    ["dpr", "noparticles"],
    "Only switches are listed",
  );
  assert.ok(safe.has("nopoints") && safe.has("noaa"));
}

// 2) The plan: a control first, one switch per test, every switch is one tuning.mjs knows.
{
  assert.equal(hunt.PLAN[0].id, "control");
  assert.deepEqual(hunt.PLAN[0].flags, []);
  const known = new Set([...SAFE, "safe", "overview", "dpr"]);
  for (const p of hunt.PLAN) for (const f of p.flags) assert.ok(known.has(f), f);
  assert.deepEqual(
    hunt.PLAN.find((p) => p.id === "nomodels")?.flags,
    ["nomodels"],
    "the character models are a suspect of their own",
  );
  assert.ok(
    readTuning("?nomodels").has("nomodels") && readTuning("?safe").has("nomodels"),
    "and part of safe",
  );
  assert.equal(new Set(hunt.PLAN.map((p) => p.id)).size, hunt.PLAN.length, "Unique ids");
}

// 2b) Which browsers leave the hands layer off by default: Safari's engine, wherever it runs.
{
  const safariMac =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.1 Safari/605.1.15";
  assert.ok(isWebKit(safariMac), "Safari on a Mac, and on an iPad that claims to be one");
  assert.ok(
    isWebKit(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    ),
  );
  assert.ok(
    isWebKit(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1",
    ),
    "Chrome on iOS is WebKit",
  );
  assert.ok(
    isWebKit(
      "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15",
    ),
    "Firefox on iOS is WebKit",
  );
  assert.ok(
    !isWebKit(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    ),
    "Chrome",
  );
  assert.ok(
    !isWebKit(
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
    ),
    "Chrome on Android",
  );
  assert.ok(
    !isWebKit(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
    ),
    "Edge",
  );
  assert.ok(
    !isWebKit("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0"),
    "Firefox",
  );
  assert.ok(!isWebKit(""));
  assert.ok(!isWebKit(undefined));
}

// 2c) The hands plan: the hands are on in every test but the last, and every switch is one the game knows.
{
  const known = new Set([
    ...SAFE,
    "hands",
    "handsnodepth",
    "handsnoenv",
    "handsnotorch",
    "handsbasic",
    "handsinline",
  ]);
  const plan = hunt.hands.PLAN;
  assert.equal(plan[0].id, "control");
  for (const p of plan) for (const f of p.flags) assert.ok(known.has(f), f);
  for (const p of plan.slice(0, -1)) assert.ok(p.flags.includes("hands"), p.id + " keeps the hands on");
  assert.deepEqual(plan.at(-1).flags, ["nohands"]);
  assert.notEqual(hunt.hands.KEY, hunt.KEY, "The two plans keep separate results");
  const state = hunt.hands.fresh();
  for (const p of plan) {
    hunt.hands.begin(state);
    if (p.id === "handsinline" || p.id === "nohands") hunt.hands.pass(state);
    else Object.assign(state, hunt.hands.resume(state)); // the page dies, the next one finds it
  }
  assert.match(
    hunt.hands.summary(state).verdict,
    /went away with: Hands drawn in the room's own pass, No hands/,
  );
}

// 2d) Numbers from the hunt (`dpr=1`), and the shift plan: the overview, a plain shift, one part out per test, the first test again.
{
  const t = readTuning("", ["overview", "dpr=1"]);
  assert.ok(t.has("dpr") && t.has("overview"), "A number's switch is on, whatever its number");
  assert.equal(t.number("dpr", 1.7), 1);
  assert.equal(readTuning("?dpr=1.25", ["dpr=1"]).number("dpr", 1.7), 1.25, "The address wins over the hunt");
  assert.equal(readTuning("", ["dpr=zero"]).number("dpr", 1.7), 1.7, "Not a number, the default");
  assert.deepEqual(t.describe().sort(), ["dpr=1", "overview"], "The diary says the numbers too");
  assert.deepEqual(readTuning("?nosound").describe(), ["nosound"]);
  assert.deepEqual(readTuning("?trial&noparticles&trialsecs=45&dpr=1").list().sort(), ["dpr", "noparticles"]);
  assert.ok(readTuning("?norender").has("norender") && readTuning("?nosync").list().includes("nosync"));
  assert.ok(!readTuning("?safe").has("norender") && !readTuning("?safe").has("nosync"), "safe still draws");

  const plan = hunt.shift.PLAN,
    known = new Set([...SAFE, "safe", "overview", "dpr", "norender", "nosync"]);
  assert.equal(plan[0].id, "control");
  assert.equal(plan.at(-1).again, "control", "The last test is the first again");
  assert.deepEqual(plan.at(-1).flags, plan[0].flags);
  for (const p of plan) {
    assert.ok(p.flags.includes("overview"), p.id + " plays in the overview, where the crash was");
    for (const f of p.flags) assert.ok(known.has(f.split("=")[0]), f);
  }
  for (const id of ["dpr1", "norender", "nosync", "nomodels", "noshadow", "noaa", "nohall"])
    assert.ok(
      plan.some((p) => p.id === id),
      id,
    );
  assert.equal(new Set(plan.map((p) => p.id)).size, plan.length, "Unique ids");
  assert.notEqual(hunt.shift.KEY, hunt.KEY);
  assert.notEqual(hunt.shift.KEY, hunt.hands.KEY, "The three plans keep separate results");

  // Every test that is not named dies (a crash saves nothing: the next page finds the test still running).
  const play = (outcomes) => {
    const store = memory();
    let state = hunt.shift.resume(hunt.shift.load(store));
    while (!hunt.shift.finished(state)) {
      const step = hunt.shift.begin(state);
      hunt.shift.save(store, state);
      const outcome = outcomes[step.id] ?? "crashed";
      if (outcome === "ok") hunt.shift.pass(state);
      else if (outcome === "unclear") hunt.shift.skip(state);
      hunt.shift.save(store, state);
      state = hunt.shift.resume(hunt.shift.load(store));
    }
    return { state, ...hunt.shift.summary(state) };
  };
  const allOk = Object.fromEntries(plan.map((p) => [p.id, "ok"]));
  let run = play({ dpr1: "ok" });
  assert.equal(run.state.results.control, "crashed");
  assert.equal(run.state.results.control2, "crashed");
  assert.match(
    run.verdict,
    /went away with: Pixel ratio 1 \(a third of the pixels\)\. That is where to look\.$/,
  );
  assert.ok(!/again/.test(run.verdict), "Both controls crashed: nothing more to say");
  // The two that split the crash into drawing and script say which side it is on.
  run = play({ norender: "ok", dpr1: "ok" });
  assert.match(run.verdict, /went away with: Pixel ratio 1 .*, 3D scene updated, never drawn\./);
  run = play({ dpr1: "ok", control2: "ok" });
  assert.match(
    run.verdict,
    /did not do what the first did/,
    "A crash that came once and not twice is said so",
  );
  assert.ok(
    !/Pixel ratio 1 \(a third of the pixels\), Everything on, again/.test(run.verdict),
    "The repeat is no cure",
  );
  run = play({ control: "unclear", control2: "unclear", dpr1: "ok" });
  assert.match(run.verdict, /control run could not be played through/);
  run = play(allOk);
  assert.match(run.verdict, /^Nothing crashed/);
  run = play({ ...allOk, nomodels: "unclear" });
  assert.match(
    run.verdict,
    /^Nothing crashed.* Not played through \(hidden or paused\): Character models off/,
  );
  assert.equal(run.lines.find((l) => l.id === "nomodels").outcome, "unclear");
  assert.match(
    hunt.shift.report(run.state, "iPad"),
    /Character models off \(classic characters\) \(nomodels\): \*\*unclear\*\*/,
  );
  // Skipping a test that is not running changes nothing; a saved "unclear" survives a reload.
  const idle = hunt.shift.fresh();
  hunt.shift.skip(idle);
  assert.equal(idle.step, 0);
  const store = memory();
  hunt.shift.save(store, {
    v: 1,
    step: 2,
    running: false,
    results: { control: "unclear", dpr1: "ok", nomodels: "weird" },
  });
  assert.deepEqual(hunt.shift.load(store).results, { control: "unclear", dpr1: "ok" });
}

// 3) A full run where every test survives.
{
  const store = memory(),
    state = hunt.resume(hunt.load(store));
  assert.equal(state.step, 0);
  for (let i = 0; i < hunt.PLAN.length; i++) {
    assert.equal(hunt.current(state).id, hunt.PLAN[i].id);
    hunt.begin(state);
    hunt.save(store, state);
    hunt.pass(state);
    hunt.save(store, state);
    // A reload between tests changes nothing.
    Object.assign(state, hunt.resume(hunt.load(store)));
  }
  assert.ok(hunt.finished(state));
  const { verdict } = hunt.summary(state);
  assert.match(verdict, /Nothing crashed/);
}

// 4) A crash: the page dies inside a test; the next page finds it still running and records it.
{
  const store = memory();
  let state = hunt.resume(hunt.load(store));
  while (!hunt.finished(state)) {
    const step = hunt.begin(state);
    hunt.save(store, state);
    // The control and the tests without the culprit die; the one without shadows survives.
    if (step.id === "noshadow") hunt.pass(state);
    else {
      // page dies here: nothing else is saved
      state = hunt.resume(hunt.load(store));
      continue;
    }
    hunt.save(store, state);
    state = hunt.resume(hunt.load(store));
  }
  assert.equal(state.results.control, "crashed");
  assert.equal(state.results.noshadow, "ok");
  assert.equal(state.results.safe, "crashed");
  const { verdict, lines } = hunt.summary(state);
  assert.match(verdict, /went away with: Shadows off/);
  assert.equal(lines.length, hunt.PLAN.length);
  assert.match(hunt.report(state, "iPad"), /Shadows off \(noshadow\): \*\*ok\*\*/);
}

// 5) Other verdicts, and damaged saves.
{
  const s = hunt.fresh();
  for (const p of hunt.PLAN) s.results[p.id] = "crashed";
  s.step = hunt.PLAN.length;
  assert.match(hunt.summary(s).verdict, /not one of these switches/);
  s.results.safe = "ok";
  assert.match(hunt.summary(s).verdict, /mix of causes/);
  const store = memory();
  store.setItem(hunt.KEY, "not json");
  assert.deepEqual(hunt.load(store), hunt.fresh());
  store.setItem(
    hunt.KEY,
    JSON.stringify({ v: 1, step: 99, running: true, results: { control: "weird", noshadow: "ok" } }),
  );
  const loaded = hunt.load(store);
  assert.equal(loaded.step, hunt.PLAN.length, "The step is clamped");
  assert.deepEqual(loaded.results, { noshadow: "ok" }, "Only known outcomes survive");
  assert.deepEqual(hunt.load(null), hunt.fresh(), "No storage at all");
  hunt.save(null, s);
  hunt.clear(null);
}

console.log(
  "Hunt checks passed: switches from the address and the hunt, the plans (the shift plan's numbers, its repeat and its unclear tests included), surviving the crashes it hunts, verdicts, damaged saves.",
);
