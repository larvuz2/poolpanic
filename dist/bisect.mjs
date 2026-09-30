// The crash hunt: a plan of short tests, each with one suspect switched off (tuning.mjs), run one after another by
// the game itself on the device that crashes. A test that never finishes (the page died) counts as a crash; the state
// lives in storage so it survives the crash and the reload. Pure module: storage is passed in.

export const KEY = "pool-panic.hunt.v1";

export const PLAN = [
  { id: "control", label: "Everything on", flags: [] },
  { id: "noshadow", label: "Shadows off", flags: ["noshadow"] },
  { id: "noparticles", label: "Splash particles off", flags: ["noparticles"] },
  { id: "nohands", label: "Hands layer off", flags: ["nohands"] },
  { id: "nohall", label: "Hall and roof hidden", flags: ["nohall"] },
  { id: "nolights", label: "Extra lights off", flags: ["nolights"] },
  { id: "overview", label: "Overview camera", flags: ["overview"] },
  { id: "safe", label: "All of them off", flags: ["safe"] },
];

export const fresh = () => ({ v: 1, step: 0, running: false, results: {} });

export function load(storage) {
  try {
    const saved = JSON.parse(storage?.getItem(KEY) || "null");
    if (!saved || saved.v !== 1) return fresh();
    const results = {};
    for (const p of PLAN)
      if (saved.results?.[p.id] === "ok" || saved.results?.[p.id] === "crashed")
        results[p.id] = saved.results[p.id];
    return {
      v: 1,
      step: Math.max(0, Math.min(PLAN.length, Math.floor(Number(saved.step)) || 0)),
      running: !!saved.running,
      results,
    };
  } catch {
    return fresh();
  }
}

export function save(storage, state) {
  try {
    storage?.setItem(KEY, JSON.stringify(state));
  } catch {}
}

export const clear = (storage) => {
  try {
    storage?.removeItem(KEY);
  } catch {}
};

export const finished = (state) => state.step >= PLAN.length;
export const current = (state) => PLAN[state.step] || null;

// A page is loading: a test that was left running never finished, so the page died in it.
export function resume(state) {
  if (state.running && !finished(state)) {
    state.results[PLAN[state.step].id] = "crashed";
    state.step++;
  }
  state.running = false;
  return state;
}

export function begin(state) {
  state.running = true;
  return current(state);
}

export function pass(state) {
  if (!state.running || finished(state)) return;
  state.results[PLAN[state.step].id] = "ok";
  state.running = false;
  state.step++;
}

// What the results say, in words: one line per test and a verdict.
export function summary(state) {
  const lines = PLAN.map((p) => ({
      id: p.id,
      label: p.label,
      outcome: state.results[p.id] || (current(state)?.id === p.id ? "running" : "waiting"),
    })),
    r = state.results,
    saved = PLAN.filter((p) => p.id !== "control" && p.id !== "safe" && r[p.id] === "ok").map((p) => p.label);
  let verdict = "";
  if (!finished(state)) verdict = "Still testing.";
  else if (r.control === "ok" && Object.values(r).every((v) => v === "ok"))
    verdict =
      "Nothing crashed in this run, even with everything on. It may need a longer or different play; play a shift normally and send the report if it crashes.";
  else if (r.control === "crashed" && saved.length)
    verdict = "The crash went away with: " + saved.join(", ") + ". That is where to look.";
  else if (r.control === "crashed" && r.safe === "ok")
    verdict = "Only switching everything off avoided it, so it is a mix of causes.";
  else if (r.control === "crashed") verdict = "It crashed in every test, so it is not one of these switches.";
  else verdict = "The control run survived but another crashed; try again to see whether it repeats.";
  return { lines, verdict };
}

export function report(state, device = "") {
  const { lines, verdict } = summary(state);
  return [
    "# Pool Panic crash hunt",
    device && "- **Device:** " + device,
    "",
    ...lines.map((l) => `- ${l.label} (${l.id}): **${l.outcome}**`),
    "",
    verdict,
  ]
    .filter((x) => x !== false && x !== "")
    .join("\n");
}
