// The guided first shift (Phase 1, 19 October 2026). The first shift of a player's first run teaches the job by doing it, one short
// line at a time, instead of a page of rules: send a swimmer to a lane, carry fins to the guest who asks for them, mop a wet spot.
// The simulation sets the stage when `config.tutorial` is on (sim.mjs: the second guest asks for fins first, everyone is patient;
// incidents/wet.mjs: the first swimmer out drips a wet spot). This module only reads the simulation and says what to do next.
//
// Each lesson has `ready` (its moment has come), `done` (the player did it) and `text`. The current tip is the first lesson that
// is ready and not done; a lesson once done stays done. When all are done, a last line says well done for a few seconds.

const queued = (sim) => sim.people.filter((p) => p.status === "queue");
const finsGuest = (sim) => sim.people.find((p) => p.finsFirst && p.status !== "gone");

export const LESSONS = [
  {
    id: "select",
    ready: (sim) => queued(sim).some((p) => !p.finsFirst),
    done: (sim, seen) => seen.assigned > 0 || queued(sim).some((p) => p.id === sim.selected),
    text: () => "A swimmer is waiting on the deck. Click them, or their card on the left.",
  },
  {
    id: "lane",
    ready: (sim, seen) => seen.selectDone,
    done: (sim, seen) => seen.assigned > 0,
    text: () => "Now click a lane, or press 1. A swimmer on their own swims fastest.",
  },
  {
    id: "fins",
    ready: (sim, seen) => seen.assigned > 0 && !!finsGuest(sim) && finsGuest(sim).status === "queue",
    done: (sim) => !finsGuest(sim) || finsGuest(sim).hasFins || finsGuest(sim).status !== "queue",
    text: (sim) =>
      sim.coach.carry === "fins"
        ? "Got them. Walk up to " + finsGuest(sim).name + " and press E to hand them over."
        : finsGuest(sim).name +
          " won't swim without fins 🦶. Walk to the fin rack (F shows the way) and press E to take a pair.",
  },
  {
    id: "fins-lane",
    ready: (sim) => !!finsGuest(sim)?.hasFins && finsGuest(sim).status === "queue",
    done: (sim) => !finsGuest(sim) || finsGuest(sim).status !== "queue",
    text: (sim) => "Now " + finsGuest(sim).name + " can swim: click them, then a lane.",
  },
  {
    id: "mop",
    ready: (sim) => (sim.wetSpots?.length || 0) > 0,
    done: (sim, seen) => seen.mopped > 0,
    text: (sim) =>
      sim.coach.carry === "mop"
        ? "Walk onto the wet spot and press E to mop it."
        : "A wet spot 💧! Anyone who runs over it slips. Walk to the mop bucket (Q shows the way), press E.",
  },
];

export const FINALE = "That's the job, coach! Keep them happy: a happy streak multiplies your points.";
export const FINALE_SECONDS = 6;

export class Tutor {
  constructor() {
    this.done = new Set();
    this.armed = new Set();
    this.seen = { assigned: 0, mopped: 0, selectDone: false };
    this.finishedAt = null;
    this.skipped = false;
  }
  // Read what happened this frame (the simulation's events), then work out the tip to show.
  update(sim, events = [], now = sim.time) {
    for (const e of events) {
      if (e.type === "assigned") this.seen.assigned++;
      if (e.type === "save" && e.kind === "mopped") this.seen.mopped++;
      if (e.type === "mopped") this.seen.mopped++;
    }
    // A lesson is armed once its moment has come, and done once armed and done (even if its moment has passed by then: a guest
    // sent to a lane is no longer waiting).
    for (const lesson of LESSONS) {
      if (this.done.has(lesson.id)) continue;
      if (lesson.ready(sim, this.seen)) this.armed.add(lesson.id);
      if (this.armed.has(lesson.id) && lesson.done(sim, this.seen)) {
        this.done.add(lesson.id);
        if (lesson.id === "select") this.seen.selectDone = true;
      }
    }
    // (the select lesson is also done once the lane lesson is: someone was sent, so someone was selected)
    if (this.seen.assigned > 0 && !this.done.has("select")) {
      this.done.add("select");
      this.seen.selectDone = true;
    }
    if (this.done.size === LESSONS.length && this.finishedAt === null) this.finishedAt = now;
    return this.current(sim, now);
  }
  // The tip on screen now: { id, text, step, total } or null (nothing to say yet, or all said).
  current(sim, now = sim.time) {
    if (this.skipped) return null;
    if (this.finishedAt !== null)
      return now - this.finishedAt < FINALE_SECONDS
        ? { id: "finale", text: FINALE, step: LESSONS.length, total: LESSONS.length }
        : null;
    const lesson = LESSONS.find((l) => !this.done.has(l.id) && l.ready(sim, this.seen));
    if (!lesson) return null;
    return { id: lesson.id, text: lesson.text(sim), step: this.done.size + 1, total: LESSONS.length };
  }
  skip() {
    this.skipped = true;
  }
}
