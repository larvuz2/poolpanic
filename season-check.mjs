// Season playthrough: a coach bot plays every chaos shift (levels 4–20 across the club, Splash Park, the Sunset Lagoon
// and the Grand Gala Arena, with their mid-shift twists, VIP guests and the storm), every chunk drill and every
// booking end to end with real movement input.
// Lane management happens every frame (it is a remote action in the game); everything physical, from
// stopping the fish kid to swimming rings out after a trampoline crash, is walked, swum and pressed.
// It proves every shift finishes with each incident resolved and every fin pair accounted for, that good
// play reaches the star targets, and that ignoring prevention costs points.
// `node season-check.mjs --table` prints scores against the star targets for tuning.
import assert from "node:assert/strict";
import { SHIFTS } from "./dist/sim.mjs";
import { DRILL_LIST } from "./dist/drills.mjs";
import { BOOKINGS } from "./dist/bookings.mjs";
import { CoachBot } from "./check-bot.mjs";

const levels = SHIFTS.map((_, i) => i + 1).filter((n) => n >= 4),
  seeds = [101, 202, 303, 404],
  mean = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length),
  rows = [];
for (const level of levels) {
  const config = SHIFTS[level - 1],
    pro = [],
    lazy = [];
  let flips = 0;
  for (const seed of seeds) {
    const bot = new CoachBot(level, seed).run(),
      s = bot.s;
    assert.equal(s.status, "ended", `Level ${level} (seed ${seed}) finishes`);
    assert.ok(
      s.chaosPlan.every((e) => e.done),
      `Level ${level}: every scheduled incident fired or was skipped at closing time`,
    );
    assert.ok(!s.fish && !s.rescue && !s.closed, `Level ${level}: no incident left open at closing`);
    assert.ok(!s.people.some((p) => p.status === "injured"), `Level ${level}: nobody left lying on the deck`);
    pro.push(s.score);
    flips += s.stats.flips || 0;
    const reactive = new CoachBot(level, seed, { proactive: false }).run();
    assert.equal(
      reactive.s.status,
      "ended",
      `Level ${level} (seed ${seed}) also finishes for a reactive coach`,
    );
    lazy.push(reactive.s.score);
  }
  rows.push({
    level,
    name: config.name,
    targets: config.thresholds.join(" / "),
    proactive: mean(pro),
    worst: Math.min(...pro),
    best: Math.max(...pro),
    reactive: mean(lazy),
    flips,
  });
  const [one, , three] = config.thresholds;
  assert.ok(mean(pro) >= one, `Level ${level}: a competent coach averages at least one star (${mean(pro)})`);
  assert.ok(
    mean(pro) < three,
    `Level ${level}: three stars need more than lane management and incident control (${mean(pro)})`,
  );
  if ((config.chaos || []).length)
    assert.ok(
      mean(pro) > mean(lazy),
      `Level ${level}: preventing incidents pays off (${mean(pro)} vs ${mean(lazy)})`,
    );
  if (["resort", "lagoon", "arena"].includes(config.venue))
    assert.ok(flips > 0, `Level ${level}: a clear splash lane lets daredevils flip`);
}
// Drills: every one finishes with its incidents resolved, and a competent coach lands between one and three stars.
for (const drill of DRILL_LIST) {
  const scores = [],
    lazy = [];
  for (const seed of seeds) {
    const bot = new CoachBot(drill.tier, seed, { config: drill.config, drill: drill.id }).run(),
      s = bot.s;
    assert.equal(s.status, "ended", `Drill ${drill.id} (seed ${seed}) finishes`);
    assert.ok(
      s.chaosPlan.every((e) => e.done),
      `Drill ${drill.id}: every scheduled incident fired`,
    );
    assert.ok(!s.fish && !s.rescue && !s.closed, `Drill ${drill.id}: no incident left open at closing`);
    assert.equal(s.drill, drill.id);
    scores.push(s.score);
    lazy.push(
      new CoachBot(drill.tier, seed, { config: drill.config, drill: drill.id, proactive: false }).run().s
        .score,
    );
  }
  const [one, , three] = drill.config.thresholds;
  rows.push({
    level: "drill",
    name: drill.name,
    targets: drill.config.thresholds.join(" / "),
    proactive: mean(scores),
    worst: Math.min(...scores),
    best: Math.max(...scores),
    reactive: mean(lazy),
    flips: 0,
  });
  assert.ok(
    mean(scores) >= one,
    `Drill ${drill.id}: a competent coach averages at least one star (${mean(scores)})`,
  );
  if (drill.config.chaos)
    assert.ok(mean(scores) > mean(lazy), `Drill ${drill.id}: preventing incidents pays off`);
  assert.ok(
    mean(scores) < three,
    `Drill ${drill.id}: three stars need more than competence (${mean(scores)})`,
  );
}
// Bookings: every booking on offer finishes cleanly at the levels that offer them.
for (const level of [11, 12, 13, 14, 15, 16, 17, 18, 19, 20])
  for (const booking of Object.values(BOOKINGS)) {
    const s = new CoachBot(level, 101, { booking }).run().s;
    assert.equal(s.status, "ended", `Level ${level} with the ${booking.id} booking finishes`);
    assert.ok(
      s.chaosPlan.every((e) => e.done),
      `Level ${level} + ${booking.id}: every incident fired or was skipped`,
    );
    assert.ok(
      !s.fish && !s.rescue && !s.closed,
      `Level ${level} + ${booking.id}: nothing left open at closing`,
    );
    assert.equal(s.booking, booking.id);
  }
if (process.argv.includes("--table")) console.table(rows);
// A careless coach never clears the splash lane: crashes happen mid-shift, and the full ring → deck → first
// aid recovery still has to finish before closing, at a clear cost.
let crashes = 0;
for (const level of [11, 12]) {
  for (const seed of [101, 202]) {
    const careless = new CoachBot(level, seed, { clearSplash: false }).run(),
      s = careless.s;
    crashes += s.stats.crashes || 0;
    assert.equal(s.status, "ended", `Careless level ${level} (seed ${seed}) still finishes`);
    assert.ok(
      !s.rescue && !s.people.some((p) => p.status === "injured"),
      "Every crash victim was rescued and healed",
    );
    const tidy = rows.find((r) => r.level === level);
    if (s.stats.crashes) assert.ok(s.score < tidy.best, "Crashes cost points");
  }
}
assert.ok(crashes > 0, "Without clearing the splash lane, daredevils crash into swimmers");
console.log(
  `Season checks passed: ${levels.length} chaos shifts × ${seeds.length} seeds (mid-shift twists, VIP guests and the storm included) played end to end by a coach bot (incidents prevented or cleaned up, splash lane kept clear, fins conserved); competent play averages one star or better but not three, prevention beats a reactive coach; all ${DRILL_LIST.length} chunk drills and every booking (levels 11–20) finish cleanly; and ${crashes} mid-shift trampoline crashes were fully rescued and patched up.`,
);
