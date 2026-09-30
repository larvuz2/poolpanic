// The crash hunt: a plan of short tests, each with one suspect switched off (tuning.mjs), run one after another by
// the game itself on the device that crashes. A test that never finishes (the page died) counts as a crash; the state
// lives in storage so it survives the crash and the reload. Pure module: storage is passed in.
//
// Two plans: the main one takes the big parts of the game out one at a time; the hands plan (?bisect=hands) then looks
// inside the first-person hands layer, which the main plan found to be what crashed an iPad.

export const MAIN_PLAN = [
  { id: "control", label: "Everything on", flags: [] },
  { id: "noshadow", label: "Shadows off", flags: ["noshadow"] },
  { id: "noparticles", label: "Splash particles off", flags: ["noparticles"] },
  { id: "nohands", label: "Hands layer off", flags: ["nohands"] },
  { id: "nohall", label: "Hall and roof hidden", flags: ["nohall"] },
  { id: "nolights", label: "Extra lights off", flags: ["nolights"] },
  { id: "nopoints", label: "Glow points off", flags: ["nopoints"] },
  { id: "noaa", label: "Antialiasing off", flags: ["noaa"] },
  { id: "overview", label: "Overview camera", flags: ["overview"] },
  { id: "safe", label: "All of them off", flags: ["safe"], combined: true },
];

// The hands are on in every test here (`hands` overrides the browser default of leaving them off); each test changes
// one thing about how they are drawn.
export const HANDS_PLAN = [
  { id: "control", label: "Hands as they are", flags: ["hands"] },
  { id: "handsnodepth", label: "No depth clear before the hands", flags: ["hands", "handsnodepth"] },
  { id: "handsnoenv", label: "Hands without the room's reflections", flags: ["hands", "handsnoenv"] },
  { id: "handsnotorch", label: "Hands without their own lights", flags: ["hands", "handsnotorch"] },
  { id: "handsbasic", label: "Hands with plain unlit colours", flags: ["hands", "handsbasic"] },
  { id: "handsinline", label: "Hands drawn in the room's own pass", flags: ["hands", "handsinline"] },
  { id: "nohands", label: "No hands (should survive)", flags: ["nohands"] },
];

// Bring the same steps to a plan: a saved state, what a page finding it does, and the words for the results.
export function createHunt({ key, plan }) {
  const fresh = () => ({ v: 1, step: 0, running: false, results: {} });

  function load(storage) {
    try {
      const saved = JSON.parse(storage?.getItem(key) || "null");
      if (!saved || saved.v !== 1) return fresh();
      const results = {};
      for (const p of plan)
        if (saved.results?.[p.id] === "ok" || saved.results?.[p.id] === "crashed")
          results[p.id] = saved.results[p.id];
      return {
        v: 1,
        step: Math.max(0, Math.min(plan.length, Math.floor(Number(saved.step)) || 0)),
        running: !!saved.running,
        results,
      };
    } catch {
      return fresh();
    }
  }
  function save(storage, state) {
    try {
      storage?.setItem(key, JSON.stringify(state));
    } catch {}
  }
  function clear(storage) {
    try {
      storage?.removeItem(key);
    } catch {}
  }
  const finished = (state) => state.step >= plan.length;
  const current = (state) => plan[state.step] || null;

  // A page is loading: a test that was left running never finished, so the page died in it.
  function resume(state) {
    if (state.running && !finished(state)) {
      state.results[plan[state.step].id] = "crashed";
      state.step++;
    }
    state.running = false;
    return state;
  }
  function begin(state) {
    state.running = true;
    return current(state);
  }
  function pass(state) {
    if (!state.running || finished(state)) return;
    state.results[plan[state.step].id] = "ok";
    state.running = false;
    state.step++;
  }

  // What the results say, in words: one line per test and a verdict.
  function summary(state) {
    const lines = plan.map((p) => ({
        id: p.id,
        label: p.label,
        outcome: state.results[p.id] || (current(state)?.id === p.id ? "running" : "waiting"),
      })),
      r = state.results,
      saved = plan.filter((p) => p.id !== "control" && !p.combined && r[p.id] === "ok").map((p) => p.label),
      combined = plan.find((p) => p.combined);
    let verdict = "";
    if (!finished(state)) verdict = "Still testing.";
    else if (r.control === "ok" && Object.values(r).every((v) => v === "ok"))
      verdict =
        "Nothing crashed in this run, even with everything on. It may need a longer or different play; play a shift normally and send the report if it crashes.";
    else if (r.control === "crashed" && saved.length)
      verdict = "The crash went away with: " + saved.join(", ") + ". That is where to look.";
    else if (r.control === "crashed" && combined && r[combined.id] === "ok")
      verdict = "Only switching everything off avoided it, so it is a mix of causes.";
    else if (r.control === "crashed")
      verdict = "It crashed in every test, so it is not one of these switches.";
    else verdict = "The control run survived but another crashed; try again to see whether it repeats.";
    return { lines, verdict };
  }

  function report(state, device = "") {
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

  return {
    KEY: key,
    PLAN: plan,
    fresh,
    load,
    save,
    clear,
    finished,
    current,
    resume,
    begin,
    pass,
    summary,
    report,
  };
}

export const main = createHunt({ key: "pool-panic.hunt.v1", plan: MAIN_PLAN });
export const hands = createHunt({ key: "pool-panic.hunt.hands.v1", plan: HANDS_PLAN });

// The main plan's steps, as the plain functions the first version exported.
export const {
  KEY,
  PLAN,
  fresh,
  load,
  save,
  clear,
  finished,
  current,
  resume,
  begin,
  pass,
  summary,
  report,
} = main;
