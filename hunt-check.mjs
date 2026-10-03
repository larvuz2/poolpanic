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
  "Hunt checks passed: switches from the address and the hunt, the plan, surviving the crashes it hunts, verdicts, damaged saves.",
);
