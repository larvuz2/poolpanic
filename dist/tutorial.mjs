// The guided shifts (Phase 1, 19 October 2026; split in two on 5 November 2026, the creator: "let the first level only be assigning
// swimmers into the swim lanes, and then we have a second level, the third or fourth, for fins… and then also for a cramp. I think
// that's it for the tutorial"). They teach the job by doing it, one short line at a time, instead of a page of rules:
//   1. the run's first shift (`config.tutorial` 1): send a swimmer to a lane, and that is all;
//   2. its third shift, always at the Community Pool (`config.tutorial` 2, week.mjs `LESSON_STEP`): carry fins to the guest who asks
//      for them (the rack a few steps from the waiting line), then rescue a swimmer with a cramp: the ring, the dive, the swim, the
//      climb out, the ring back on its hook. Not finished, it comes back the next shift until it is (or the tips are skipped).
// The simulation sets the stage (sim.mjs: everyone patient, no illness, the fins guest and the lesson's cramp in the second; no wet
// spots in the first, incidents/wet.mjs; the second's incidents wait until its lessons are done, chaos.mjs). This module only reads
// the simulation and says what to do next.
//
// Each lesson has `ready` (its moment has come), `done` (the player did it) and `text`. The current tip is the first lesson that
// is ready and not done; a lesson once done stays done. When all are done, a last line says well done for a few seconds.

const queued = (sim) => sim.people.filter((p) => p.status === "queue");
const finsGuest = (sim) => sim.people.find((p) => p.finsFirst && p.status !== "gone");
const victim = (sim) => (sim.rescue ? sim.get(sim.rescue.victim) : null);
const stranded = (sim) => sim.rescue?.kind === "cramp" && sim.rescue.stage === "stranded";
const inWater = (sim) => !!(sim.coach.swimming || sim.coach.waterTransition);

// The first shift: lanes.
const FIRST = [
  {
    id: "select",
    ready: (sim) => queued(sim).length > 0,
    done: (sim, seen) => seen.assigned > 0 || queued(sim).some((p) => p.id === sim.selected),
    text: () => "A swimmer is waiting on the deck. Click them, or walk up to them and press E.",
  },
  {
    id: "lane",
    ready: (sim, seen) => seen.selectDone,
    done: (sim, seen) => seen.assigned > 0,
    text: () => "Now click a lane, or press 1. A swimmer on their own swims fastest.",
  },
  {
    id: "more",
    ready: (sim, seen) => seen.assigned > 0 && queued(sim).length > 0,
    done: (sim, seen) => seen.assigned >= 3,
    skip: (sim, seen) => seen.assigned >= 3,
    text: () =>
      "That's the job! Keep sending them: slow swimmers in one lane, fast ones in another, so nobody gets stuck behind.",
  },
];

// The second: fins, then a cramp.
const SECOND = [
  {
    id: "fins",
    ready: (sim) => !!finsGuest(sim) && finsGuest(sim).status === "queue",
    done: (sim) => !finsGuest(sim) || finsGuest(sim).hasFins || finsGuest(sim).status !== "queue",
    text: (sim) =>
      sim.coach.carry === "fins"
        ? "Got them. Walk up to " + finsGuest(sim).name + " and press E to hand them over."
        : finsGuest(sim).name +
          " won't swim without fins 🦶. The fin rack is right by the line: walk to it and press E to take a pair.",
  },
  {
    id: "fins-lane",
    ready: (sim) => !!finsGuest(sim)?.hasFins && finsGuest(sim).status === "queue",
    done: (sim) => !finsGuest(sim) || finsGuest(sim).status !== "queue",
    skip: (sim, seen, done) => done.has("fins") && (!finsGuest(sim) || finsGuest(sim).status !== "queue"),
    text: (sim) => "Now " + finsGuest(sim).name + " can swim: click them, then a lane.",
  },
  {
    id: "ring",
    ready: (sim) => stranded(sim) && sim.coach.carry !== "lifering" && !inWater(sim),
    done: (sim) => sim.coach.carry === "lifering" || inWater(sim) || !stranded(sim),
    text: (sim) =>
      "😱 " +
      (victim(sim)?.name || "A swimmer") +
      " has a cramp and can't swim! Run to a glowing life ring on the wall and press E.",
  },
  {
    id: "dive",
    ready: (sim) => stranded(sim) && sim.coach.carry === "lifering" && !inWater(sim),
    done: (sim) => inWater(sim) || !stranded(sim),
    text: () => "Got the ring. Walk to the edge of the pool: you'll dive straight in.",
  },
  {
    id: "swim",
    ready: (sim) => stranded(sim) && inWater(sim),
    done: (sim) => !stranded(sim),
    text: (sim) => "Swim to " + (victim(sim)?.name || "them") + ". Touch them and they grab the ring.",
  },
  {
    id: "climb",
    ready: (sim, seen) => seen.rescued && inWater(sim),
    done: (sim) => !inWater(sim),
    skip: (sim, seen) => seen.rescued && !inWater(sim),
    text: () => "Saved! Now swim to the edge and keep pushing into it to climb out.",
  },
  {
    id: "hang",
    // (once the swimmer on the bench has let go of it, or the coach has it)
    ready: (sim, seen) =>
      seen.rescued &&
      !inWater(sim) &&
      (sim.coach.carry === "lifering" || sim.lifeRings.some((r) => r.state === "deck")),
    done: (sim) => sim.lifeRings.every((r) => r.state === "wall"),
    skip: (sim, seen) => seen.rescued && !inWater(sim) && sim.lifeRings.every((r) => r.state === "wall"),
    text: (sim) =>
      sim.coach.carry === "lifering"
        ? "Hang the life ring back on its hook on the wall: walk up to it and press E."
        : "Pick up the life ring by the bench (E), then hang it back on its hook.",
  },
];

export const LESSON_SETS = { 1: FIRST, 2: SECOND };
export const LESSONS = FIRST; // (the first shift's, as before)
export const FINALES = {
  1: "That's the job, coach! Keep them happy: a happy streak multiplies your points.",
  2: "You're a real lifeguard now! Fins and rescues: you've got this.",
};
export const FINALE = FINALES[1];
export const FINALE_SECONDS = 6;

export class Tutor {
  constructor(set = 1) {
    this.set = set === 2 ? 2 : 1;
    this.lessons = LESSON_SETS[this.set];
    this.done = new Set();
    this.armed = new Set();
    this.seen = { assigned: 0, selectDone: false, rescued: false };
    this.finishedAt = null;
    this.skipped = false;
  }
  // Read what happened this frame (the simulation's events), then work out the tip to show.
  update(sim, events = [], now = sim.time) {
    for (const e of events) {
      if (e.type === "assigned") this.seen.assigned++;
      if (e.type === "save" && e.kind === "rescue") this.seen.rescued = true;
    }
    // (the ring handed over: the rescue is no longer waiting for it)
    if (this.armed.has("swim") && !stranded(sim)) this.seen.rescued = true;
    // A lesson is armed once its moment has come, and done once armed and done (even if its moment has passed by then: a guest
    // sent to a lane is no longer waiting).
    for (const lesson of this.lessons) {
      if (this.done.has(lesson.id)) continue;
      // (a step the player has already got past without its tip: done, so the well done still comes)
      if (lesson.skip?.(sim, this.seen, this.done)) {
        this.done.add(lesson.id);
        continue;
      }
      if (lesson.ready(sim, this.seen)) this.armed.add(lesson.id);
      if (this.armed.has(lesson.id) && lesson.done(sim, this.seen)) {
        this.done.add(lesson.id);
        if (lesson.id === "select") this.seen.selectDone = true;
      }
    }
    // (the select lesson is also done once the lane lesson is: someone was sent, so someone was selected)
    if (this.set === 1 && this.seen.assigned > 0 && !this.done.has("select")) {
      this.done.add("select");
      this.seen.selectDone = true;
    }
    // (in the second: a rescue step passed by quickly, say a dive straight from the ring, counts as done once the rescue moves on)
    if (this.set === 2 && this.seen.rescued)
      for (const id of ["ring", "dive", "swim"]) if (!this.done.has(id)) this.done.add(id);
    if (this.done.size === this.lessons.length && this.finishedAt === null) this.finishedAt = now;
    return this.current(sim, now);
  }
  // The tip on screen now: { id, text, step, total } or null (nothing to say yet, or all said).
  current(sim, now = sim.time) {
    if (this.skipped) return null;
    const total = this.lessons.length;
    if (this.finishedAt !== null)
      return now - this.finishedAt < FINALE_SECONDS
        ? { id: "finale", text: FINALES[this.set], step: total, total }
        : null;
    const lesson = this.lessons.find((l) => !this.done.has(l.id) && l.ready(sim, this.seen));
    if (!lesson) return null;
    return { id: lesson.id, text: lesson.text(sim), step: this.done.size + 1, total };
  }
  skip() {
    this.skipped = true;
  }
}
