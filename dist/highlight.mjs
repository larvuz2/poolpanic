// 🎬 The highlight replay (Phase 3, 20 October 2026). The diagnostic: "A 10-second highlight replay at the end of a shift is cheap,
// because shifts already replay exactly, and it gives streamers and the store page their clips." While a shift is played, every
// funny or dramatic moment is noted with the simulation's tick (`HighlightPicker.note`: a cannonball, a mess in the water, a trampoline
// crash, a guest over the edge, the race…), weighted by how good a clip it makes. At the end the best one is played again: the shift
// is rebuilt from its record (replay.mjs: its level, seed and every input), run fast to a few seconds before the moment (the app shows
// a REWIND) and played through for about ten seconds, slowed down at the moment itself. Pure: no DOM, so a check can play it.
import { PoolSimulation, SHIFTS } from "./sim.mjs";
import { DRILLS } from "./drills.mjs";
import { apply, stateHash } from "./replay.mjs";

export const HIGHLIGHT = {
  before: 4, // s of the clip before the moment
  after: 6, // s after it
  slow: { from: -0.4, to: 1.4, scale: 0.4 }, // the slow motion round the moment (s from it)
  least: 4, // the least weight worth a clip
  auto: 7, // weight from which the clip plays by itself at the end of the shift
  rewind: 1500, // ticks of fast-forward a frame
};

// What makes a clip, and how good a one: an event of the simulation, its weight and its title.
const INCIDENTS = {
  crash: [10, "💥 TRAMPOLINE CRASH!"],
  spill: [9, "💩 EVERYBODY OUT!"],
  pee: [8, "💛 WHO PEED?!"],
  "fish-loose": [8, "🐟 FISH IN THE POOL!"],
  overboard: [9, "🆘 OVER THE EDGE!"],
  "fell-in": [8, "🌊 SPLASH! INTO THE POOL"],
  knockout: [8, "🌊 KNOCKED UNDER!"],
  "monkey-in": [7, "🐒 MONKEY IN THE SPRING!"],
  "tower-go": [7, "🤸 INCOMING!"],
  blackout: [6, "🔦 BLACKOUT!"],
  karen: [5, "😡 KAREN!"],
  dog: [5, "🐶 LOOSE DOG!"],
  cramp: [5, "🛟 TO THE RESCUE!"],
  monster: [6, "🌊 MONSTER WAVE!"],
  selfie: [4, "📸 SELFIE ON THE EDGE!"],
  fish: [4, "🐟 FISH KID!"],
};
const OTHERS = {
  cannonball: () => [9, "💣 CANNONBALL!"],
  "race-go": () => [7, "🏁 THE RACE!"],
  landing: () => [5, "🤸 STUCK THE LANDING!"],
  drop: (e) => (e.headline ? [8, "🎧 THE HEADLINE DROP!"] : null),
  "big-done": (e) => (e.result === "great" ? [8, "⭐ " + (e.words || "SHOWSTOPPER").toUpperCase()] : null),
  rapids: (e) => (e.thrill ? null : [5, "😱 THE RAPIDS!"]),
  "streak-tier": (e) => (e.mult >= 2.5 ? [6, "⚡ UNSTOPPABLE!"] : null),
};
export function clipOf(e) {
  if (e.type === "incident") {
    const c = INCIDENTS[e.kind];
    return c ? { weight: c[0], title: c[1] } : null;
  }
  if (e.type === "save" && e.kind === "landing") return { weight: 5, title: "🤸 STUCK THE LANDING!" };
  const f = OTHERS[e.type];
  const c = f ? f(e) : null;
  return c ? { weight: c[0], title: c[1] } : null;
}

export class HighlightPicker {
  constructor() {
    this.clips = [];
  }
  // An event of the shift at `tick` (the recorder's count). Two of the same kind within a few seconds are one.
  note(e, tick) {
    const c = clipOf(e);
    if (!c || !Number.isFinite(tick)) return;
    const last = this.clips[this.clips.length - 1];
    if (last && last.title === c.title && tick - last.tick < 6 * 60) return;
    this.clips.push({
      ...c,
      tick,
      x: Number.isFinite(e.x) ? e.x : null,
      z: Number.isFinite(e.z) ? e.z : null,
    });
  }
  // The best clip: the heaviest, the latest of equals (the shift's own climax wins a tie). Null when nothing was worth one.
  best() {
    let best = null;
    for (const c of this.clips)
      if (c.weight >= HIGHLIGHT.least && (!best || c.weight >= best.weight)) best = c;
    return best;
  }
}

// The shift a record was made of, built again (tools/replay.mjs uses the same).
export function simFromRecord(record) {
  const man = record.man && { cannonball: record.man };
  if (record.drill) {
    const drill = DRILLS[record.drill];
    if (!drill) throw new Error("this record is of a drill that is not in this build: " + record.drill);
    return new PoolSimulation(drill.tier, record.seed, {
      config: { ...drill.config, ...man },
      drill: drill.id,
    });
  }
  if (record.week?.config)
    return new PoolSimulation(record.level, record.seed, {
      config: { ...record.week.config, ...man },
      booking: record.booking || null,
      perks: record.week.perks || {},
      // (a co-op shift: its crew, a coach each)
      ...(record.crew && { crew: record.crew }),
    });
  return new PoolSimulation(record.level, record.seed, {
    booking: record.booking || null,
    config: { ...SHIFTS[record.level - 1], ...record.guests, ...man },
  });
}

// Plays a record again from the start: `seek(tick)` runs it fast (a slice a call: true when there), `step()` one tick. `drift` says
// when it stopped matching the record's checkpoints (null while it does). `window` is the clip's: from, to and the moment's tick.
export class ClipPlayer {
  constructor(record, clip) {
    this.record = record;
    this.clip = clip;
    this.sim = simFromRecord(record);
    this.sim.start({ countdown: true });
    this.tick = 0;
    this.next = 0;
    this.checks = new Map(record.checks || []);
    this.drift = null;
    const at = clip.tick;
    this.from = Math.max(0, at - HIGHLIGHT.before * 60);
    this.to = Math.min(record.ticks, at + HIGHLIGHT.after * 60);
    this.at = at;
  }
  step() {
    const r = this.record,
      s = this.sim;
    if (this.tick >= r.ticks) return false;
    while (this.next < r.inputs.length && r.inputs[this.next][0] <= this.tick)
      apply(s, r.inputs[this.next++], r);
    s.tick(1 / 60);
    this.tick++;
    const want = this.checks.get(this.tick);
    if (want !== undefined && !this.drift && stateHash(s) !== want) this.drift = { tick: this.tick, want };
    return true;
  }
  // Fast to the start of the clip, `budget` ticks a call (the events are dropped: nothing of it is shown).
  seek(budget = HIGHLIGHT.rewind) {
    for (let n = 0; n < budget && this.tick < this.from; n++) {
      if (!this.step()) break;
      this.sim.events.length = 0;
    }
    return this.tick >= this.from;
  }
  // How far through the clip (0 to 1), and how fast to play it now (slowed round the moment).
  get progress() {
    return Math.max(0, Math.min(1, (this.tick - this.from) / Math.max(1, this.to - this.from)));
  }
  get done() {
    return this.tick >= this.to || this.sim.status === "ended";
  }
  speed() {
    const t = (this.tick - this.at) / 60,
      S = HIGHLIGHT.slow;
    return t >= S.from && t <= S.to ? S.scale : 1;
  }
}
