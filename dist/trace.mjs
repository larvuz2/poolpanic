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
  // `note(kind, text)`: where the lines go (the crash log's crumb).
  constructor(note) {
    this.note = note;
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
    const where = c.waterTransition
      ? c.waterTransition.kind
      : c.swimming
        ? "swimming"
        : c.y > 0.5
          ? "airborne"
          : "deck";
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
    // Swimmers: everybody in trouble, and everybody on an odd status, line by line; the ordinary comings and goings are not.
    const people = sim.people || [];
    for (const p of people) {
      let m = this.people.get(p.id);
      if (!m) this.people.set(p.id, (m = {}));
      if (
        p.status === m.status &&
        p.exitPhase === m.exitPhase &&
        p.recoveryStage === m.recoveryStage &&
        p.problem === m.problem
      )
        continue;
      if (interesting(m) || interesting(p)) {
        const phase = [p.exitPhase, p.recoveryStage].filter(Boolean).join("/");
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
      m.problem = p.problem;
    }
    if (this.people.size > people.length + 20) {
      const live = new Set(people.map((p) => p.id));
      for (const id of this.people.keys()) if (!live.has(id)) this.people.delete(id);
    }
  }
}
