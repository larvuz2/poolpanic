// Recording a shift so it can be played again exactly. The simulation is seeded and ticks in fixed steps of 1/60 s, so a shift is fully
// decided by its level, its seed and what the player did, tick by tick. The recorder keeps that: the way the shift began, every input
// the player gave (stamped with the tick it came before), and a hash of the simulation every few seconds. A record is a few kilobytes of
// plain data that goes in the crash log (a playtest only), and tools/replay.mjs runs it again headlessly, so a stuck incident on someone
// else's iPad can be watched, stopped and debugged here.
//
// The hashes say how faithful the replay is: it should match at every one, and when it stops matching it says at which tick it drifted.
// (Two JavaScript engines may disagree about the last digit of a sine or a hypotenuse, so a shift recorded in Safari can drift from one
// replayed in Node after a while, while one recorded in Chrome or Node does not.)
//
// Pure, no DOM. It wraps the simulation's input methods on the instance and logs only the outermost call of each, so what an input does
// inside the simulation (calling other methods of it) is not recorded twice.

// The simulation's methods that the game, or a tester, calls to act on it. Anything the simulation does by itself is not in this list.
export const INPUTS = [
  "setMovement",
  "clearInput",
  "setHold",
  "jump",
  "dash",
  "interact",
  "assist",
  "assign",
  "assignTrampoline",
  "fetch",
  "returnItem",
  "tidy",
  "scoop",
  "select",
  "deliver",
  "tendInjured",
  "useFixture",
  "approachVisitor",
  "disposeWaste",
  "pickup",
  "home",
  "triggerChaos",
  "startCramp",
];
export const REPLAY_LIMITS = { inputs: 4000, vectors: 200, checkEvery: 300 };

// One recorded input applied to a simulation (tools/replay.mjs plays a whole record with it, and so does the crash hunt's shift plan
// on the device itself, through the game's own frame loop).
export function apply(sim, entry, record) {
  const [, name, ...args] = entry;
  if (name === "m") return sim.setMovement(...record.vecs[args[0]]);
  if (name === "look") {
    sim.coach.lookAngle = args[0];
    return;
  }
  if (typeof sim[name] !== "function") throw new Error("this build's simulation has no input " + name);
  return sim[name](...args);
}

// A hash of what matters in the simulation: the score, the clocks, the coach, everybody's place. Any drift shows in it quickly.
export function stateHash(sim) {
  let h = 2166136261;
  const mix = (n) => {
    h = Math.imul(h ^ (Number.isFinite(n) ? Math.round(n) | 0 : 0), 16777619) >>> 0;
  };
  mix(sim.score);
  mix(sim.time * 100);
  mix(sim.arrivalTime * 100);
  mix(sim.coach.x * 100);
  mix(sim.coach.z * 100);
  mix(sim.people.length);
  mix(sim.visitors?.length ?? 0);
  for (const p of sim.people) {
    mix(p.id);
    mix(p.x * 100);
    mix(p.z * 100);
  }
  for (const v of sim.visitors || []) {
    mix(v.id);
    mix(v.x * 100);
    mix(v.z * 100);
  }
  return h.toString(36);
}

export class Recorder {
  // `meta`: how the shift began (level, seed, booking, drill, man): what tools/replay.mjs needs to make the same simulation.
  constructor(sim, meta = {}) {
    this.sim = sim;
    this.depth = 0;
    this.ticks = 0;
    this.last = { move: "", look: null };
    this.vectors = new Map();
    this.record = {
      v: 1,
      ...meta,
      ticks: 0,
      vecs: [], // the movement vectors the inputs refer to by number (a keyboard or the touch pad has about nine)
      inputs: [], // [tick, name, ...arguments]
      checks: [], // [ticks, hash]
      truncated: false,
    };
    this.patch();
  }
  patch() {
    const sim = this.sim;
    for (const name of INPUTS) {
      const original = sim[name];
      if (typeof original !== "function") continue;
      sim[name] = (...args) => {
        if (this.depth === 0) this.guard(() => this.log(name, args));
        this.depth++;
        try {
          return original.apply(sim, args);
        } finally {
          this.depth--;
        }
      };
    }
    const tick = sim.tick;
    sim.tick = (dt) => {
      // (a tick the simulation ignores, a paused shift's, is not a tick of the shift)
      const live = sim.status === "playing" || sim.status === "countdown";
      this.depth++;
      try {
        return tick.call(sim, dt);
      } finally {
        this.depth--;
        if (live) this.guard(() => this.after());
      }
    };
  }
  // The recorder only watches: whatever goes wrong in it stops the recording (and says so in the record), never the shift.
  guard(fn) {
    if (this.record.broken) return;
    try {
      fn();
    } catch (e) {
      this.record.broken = String(e?.message || e).slice(0, 120);
    }
  }
  after() {
    const r = this.record;
    this.ticks++;
    r.ticks = this.ticks;
    if (this.ticks % REPLAY_LIMITS.checkEvery === 0) r.checks.push([this.ticks, stateHash(this.sim)]);
  }
  push(entry) {
    const r = this.record;
    if (r.inputs.length >= REPLAY_LIMITS.inputs) {
      r.truncated = true;
      return;
    }
    r.inputs.push(entry);
  }
  log(name, args) {
    if (name === "setMovement") {
      // Only when it changes, and as a number into the table of vectors seen (one value is 18 characters, a number 1).
      const [x, z] = args,
        key = x + "," + z;
      if (key === this.last.move) return;
      this.last.move = key;
      let index = this.vectors.get(key);
      if (index === undefined && this.vectors.size < REPLAY_LIMITS.vectors) {
        index = this.vectors.size;
        this.vectors.set(key, index);
        this.record.vecs.push([x, z]);
      }
      return this.push(index === undefined ? [this.ticks, "setMovement", x, z] : [this.ticks, "m", index]);
    }
    if (name === "clearInput") this.last.move = "";
    this.push([
      this.ticks,
      name,
      ...args.filter((a) => ["string", "number", "boolean"].includes(typeof a) || a === null),
    ]);
  }
  // The direction the coach looks (the Coach Cam turns it; null is the overview, where he faces the way he walks), when it has changed
  // enough to matter.
  look(angle) {
    this.guard(() => this.noteLook(angle));
  }
  noteLook(angle) {
    const a = Number.isFinite(angle) ? Math.round(angle * 10000) / 10000 : null,
      was = this.last.look;
    if (a === was || (a !== null && was !== null && Math.abs(a - was) < 0.003)) return;
    this.last.look = a;
    this.push([this.ticks, "look", a]);
  }
}
