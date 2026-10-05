// The shift's diary for the crash log. The game shows this the simulation after every frame and it says, in plain words, what changed since
// the last look: the coach picked something up or went into the water, a rescue moved on, a ring changed hands, a swimmer got a problem or
// got out, an incident began or ended. The crash log keeps the newest few hundred lines, so what a shift that crashed was doing in its last
// minute can be read like a diary instead of guessed from a stack. Pure: it only reads the simulation, never changes it, and a look costs a
// few field comparisons (a line is only built when something moved).

// What every swimmer goes through on an ordinary visit: only the odd statuses, and anybody in trouble, get a line of their own.
const ORDINARY = new Set(["arriving", "queue", "enter", "swim", "exit", "gone"]);
const round = (n) => Math.round(n * 10) / 10;
const at = (e) => (Number.isFinite(e?.x) && Number.isFinite(e?.z) ? "@" + round(e.x) + "," + round(e.z) : "");
const interesting = (p) =>
  !!(p.problem || p.exitPhase || p.recoveryStage || (p.status && !ORDINARY.has(p.status)));
const who = (p) => "#" + p.id + (p.name ? " " + p.name : "") + (p.type ? " (" + p.type + ")" : "");
// A value from an incident's `detail` as the pulse says it: a number rounded, a thing with a place as that place, a word as it is.
const show = (v) =>
  v === undefined || v === null
    ? "-"
    : typeof v === "number"
      ? String(Number.isFinite(v) ? round(v) : "?")
      : typeof v === "object"
        ? at(v) || "-"
        : String(v);
// Where the coach is and what he carries, as the diary says it.
const coachWhere = (c) =>
  c.waterTransition ? c.waterTransition.kind : c.swimming ? "swimming" : c.y > 0.5 ? "airborne" : "deck";
// A state that has lasted this many seconds (of the shift's own time, so a pause does not count) is said to be waiting, and again each
// time that doubles. What a stuck incident is stuck in is the most useful thing a diary can say.
const WAIT_FIRST = 25;
// Gear that has a place to hang and may end up somewhere else: where each piece is, whenever it moves.
const GEAR = ["fishNet", "flashlight", "medkit"];

// Events that happen all the time and say nothing about how the shift is going (the log is short: these would fill it).
const NOISY = new Set([
  "points",
  "splash",
  "collision",
  "countdown",
  "select",
  "door-open",
  "arrived",
  "spawn",
  "served",
  "dash",
  "jump",
  "land",
  "drop",
  "trampoline-bounce",
  "trampoline-climb",
  "karen-voice",
  "outage-flicker",
  "busy",
  "blocked",
  "scoop-miss",
  "scoop-cast",
]);

// One simulation event as a line: its type and the small facts it carries (ids, names, kinds, a place), nothing else.
export function describeEvent(e) {
  const bits = [String(e.type)];
  for (const [k, v] of Object.entries(e)) {
    if (k === "type" || v === undefined || v === null) continue;
    if (typeof v === "string")
      bits.push(k === "text" ? JSON.stringify(v.slice(0, 80)) : k + " " + v.slice(0, 40));
    else if (typeof v === "number" && Number.isFinite(v)) {
      if (k !== "x" && k !== "z") bits.push(k + " " + round(v));
    } else if (typeof v === "boolean") {
      if (v) bits.push(k);
    } else if (typeof v === "object" && Number.isFinite(v.x) && Number.isFinite(v.z))
      bits.push(k === "to" ? "to " + at(v) : k + at(v));
  }
  if (Number.isFinite(e.x) && Number.isFinite(e.z)) bits.push(at(e));
  return bits.join(" ");
}
export const isNoisy = (e) => NOISY.has(e.type);

// How many of each status are in the pool and on the deck, as one short string for the log's state line.
export function crowdSummary(sim) {
  const counts = {};
  for (const p of sim.people || []) counts[p.status] = (counts[p.status] || 0) + 1;
  return Object.entries(counts)
    .map(([k, n]) => k + " " + n)
    .join(", ");
}

export class Tracer {
  // `note(kind, text)`: where the lines go (the crash log's crumb). `verbose`: a line for every change in an incident's state, not just
  // when its stage changes (a playtest wants every step of a cannonball man's run; an ordinary report would be mostly that).
  constructor(note, { verbose = false } = {}) {
    this.note = note;
    this.verbose = verbose;
    this.reset();
  }
  reset() {
    this.status = null;
    this.coach = null;
    this.rescue = "";
    this.rings = new Map();
    this.people = new Map();
    this.systems = [];
    this.cleanup = null;
    this.stages = new Map(); // each running incident's last described state
    this.gear = new Map();
    this.closed = false;
    this.twist = "";
    this.waits = new Map(); // state -> {value, since, said}: what has been the same for how long
  }
  // Look at the simulation after a frame's ticks.
  look(sim) {
    const t = "t" + Math.floor(sim.time || 0) + "s ";
    if (sim.status !== this.status) {
      this.note("shift", t + "status " + (this.status ?? "none") + " → " + sim.status);
      this.status = sim.status;
    }
    // The coach: what he carries and where he is (on the deck, in the air, diving in, swimming, climbing out). His position
    // goes in the line, but a step along the deck is not a change.
    const c = sim.coach;
    const where = coachWhere(c);
    const holds = c.carry || "";
    if (where !== this.coach?.where || holds !== this.coach?.holds) {
      this.note("coach", t + where + (holds ? " carrying " + holds : "") + " " + at(c));
      this.coach = { where, holds };
    }
    // The rescue: from the cramp to the swimmer's rest on the bench.
    const r = sim.rescue;
    const rescueKey = r ? r.stage + "|" + r.kind + "|" + (r.victims || []).join() : "";
    if (rescueKey !== this.rescue) {
      this.note(
        "rescue",
        t +
          (r
            ? r.stage +
              " " +
              (r.kind || "") +
              " victims " +
              (r.victims || []).map((id) => who(sim.get?.(id) || { id })).join(", ")
            : "over"),
      );
      this.rescue = rescueKey;
    }
    for (const ring of sim.lifeRings || []) {
      const was = this.rings.get(ring.id),
        key = ring.state + (ring.owner != null ? " #" + ring.owner : "");
      // (where it lies matters only when it is down on the deck; on the wall it is where it always is)
      if (was !== undefined && was !== key)
        this.note(
          "ring",
          t +
            "life ring " +
            ring.id +
            ": " +
            was +
            " → " +
            key +
            (ring.state === "deck" ? " " + at(ring) : ""),
        );
      this.rings.set(ring.id, key);
    }
    // Incidents that are running, and a cleanup in the water.
    const systems = sim.activeSystems?.() || [];
    if (systems.length !== this.systems.length || systems.some((s, i) => s.key !== this.systems[i])) {
      this.note(
        "incident",
        t + (systems.length ? "running: " + systems.map((s) => s.key).join(", ") : "none running"),
      );
      this.systems = systems.map((s) => s.key);
    }
    const cleanup = sim.cleanup?.stage || null;
    if (cleanup !== this.cleanup) {
      this.note("incident", t + "cleanup " + (this.cleanup ?? "none") + " → " + (cleanup ?? "none"));
      this.cleanup = cleanup;
    }
    // Where each running incident stands (its own `describe`), a line each time that changes.
    const now = sim.arrivalTime ?? sim.time ?? 0,
      seen = new Set();
    const context = " (coach " + where + (holds ? " carrying " + holds : "") + " " + at(c) + ")";
    const wait = (key, value, label) => {
      seen.add(key);
      const w = this.waits.get(key);
      if (!w || w.value !== value) return void this.waits.set(key, { value, since: now, said: WAIT_FIRST });
      if (now - w.since >= w.said) {
        this.note(
          "waiting",
          t + label + " has been like this for " + Math.round(now - w.since) + " s" + context,
        );
        w.said *= 2;
      }
    };
    for (const system of systems) {
      let state = "";
      try {
        state = system.describe?.(sim) || "";
      } catch {}
      // (the first part of the state, up to the first "·", is the incident's stage: that alone is news in a short report)
      const key = this.verbose ? state : state.split(" · ")[0];
      if (state && key !== this.stages.get(system.key)) {
        this.note("incident", t + system.key + ": " + state);
        this.stages.set(system.key, key);
      }
      if (state) wait("incident:" + system.key, state, system.key + ": " + state);
    }
    for (const key of [...this.stages.keys()])
      if (!systems.some((s) => s.key === key)) this.stages.delete(key);
    if (rescueKey) wait("rescue", rescueKey, "rescue " + r.stage + " " + (r.kind || ""));
    if (cleanup) wait("cleanup", cleanup, "cleanup " + cleanup);
    // (a closed pool that an incident or a rescue explains is not said again on its own)
    if (sim.closed && !cleanup && !r && !systems.length) wait("closed", "closed", "the pool is closed");
    // The pool closed and reopened, a lane out of service, the storm, the fish net on its hook or in somebody's hands.
    const closed = !!sim.closed;
    if (closed !== this.closed) {
      this.note("incident", t + (closed ? "pool closed" : "pool reopened"));
      this.closed = closed;
    }
    const twist =
      (sim.laneClosure >= 0 ? "lane " + (sim.laneClosure + 1) + " out of service" : "") +
      (sim.storm ? (sim.laneClosure >= 0 ? ", " : "") + "storm" : "");
    if (twist !== this.twist) {
      this.note("incident", t + (twist ? "twist: " + twist : "twist over"));
      this.twist = twist;
    }
    for (const name of GEAR) {
      const state = sim[name]?.state;
      if (state === undefined) continue;
      const was = this.gear.get(name);
      if (was !== undefined && was !== state) this.note("gear", t + name + ": " + was + " → " + state);
      this.gear.set(name, state);
    }
    for (const key of this.waits.keys()) if (!seen.has(key)) this.waits.delete(key);
    // Swimmers: everybody in trouble, and everybody on an odd status, line by line; the ordinary comings and goings are not.
    const people = sim.people || [];
    for (const p of people) {
      let m = this.people.get(p.id);
      if (!m) this.people.set(p.id, (m = {}));
      if (
        p.status === m.status &&
        p.exitPhase === m.exitPhase &&
        p.recoveryStage === m.recoveryStage &&
        p.jumpStage === m.jumpStage &&
        p.problem === m.problem
      )
        continue;
      if (interesting(m) || interesting(p)) {
        const phase = [p.exitPhase, p.recoveryStage, p.jumpStage].filter(Boolean).join("/");
        this.note(
          "person",
          t +
            who(p) +
            " " +
            (m.status ?? "new") +
            " → " +
            p.status +
            (phase ? " (" + phase + ")" : "") +
            (p.problem ? " problem " + p.problem : "") +
            " " +
            at(p),
        );
      }
      m.status = p.status;
      m.exitPhase = p.exitPhase;
      m.recoveryStage = p.recoveryStage;
      m.jumpStage = p.jumpStage;
      m.problem = p.problem;
    }
    if (this.people.size > people.length + 20) {
      const live = new Set(people.map((p) => p.id));
      for (const id of this.people.keys()) if (!live.has(id)) this.people.delete(id);
    }
  }

  // The shift's incident plan, in one line: what the level has in store and when (the shift's own seconds), so what happened can be
  // set beside what was meant to.
  plan(sim) {
    const entries = (sim.chaosPlan || []).map((e) => e.kind + "@" + Math.round(e.at) + "s");
    return "plan: " + (entries.length ? entries.join(", ") : "no incidents");
  }

  // The state of the shift in one line, for the periodic pulse: the clock, the score, the coach, the crowd, and each running incident's
  // numbers (its `detail`). Written every few seconds, so a page that died leaves its last known positions behind.
  pulse(sim) {
    const c = sim.coach,
      bits = [
        "score " + Math.round(sim.score || 0),
        "coach " + coachWhere(c) + (c.carry ? " carrying " + c.carry : "") + " " + at(c),
        crowdSummary(sim),
      ];
    if (sim.rescue) bits.push("rescue " + sim.rescue.stage + " " + (sim.rescue.kind || ""));
    for (const system of sim.activeSystems?.() || []) {
      let detail = null;
      try {
        detail = system.detail?.(sim);
      } catch {}
      if (detail)
        bits.push(
          system.key +
            " " +
            Object.entries(detail)
              .map(([k, v]) => k + " " + show(v))
              .join(" "),
        );
    }
    return "t" + Math.floor(sim.time || 0) + "s " + bits.filter(Boolean).join(" · ");
  }
}
