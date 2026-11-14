// The fun report (docs/fun-plan.md, step 1): the coach bots play whole runs, and this prints the numbers the plan is tuned against.
//
//   node tools/fun-report.mjs [--runs 4] [--weeks 4] [--bots expert,steady,novice] [--policy build|plain] [--json file]
//
//   per shift   how long the coach's body had nothing to do (idle), how many things wanted him at once (the pressure, the most
//               at once, the longest calm), the stars
//   per week    on which day the Date Fund was decided (reached, or out of reach)
//   per run     where it ended, how long it took, and how alike two runs are (the pools, the day rules, the perks they share)
//
// Three coaches: `expert` stops trouble before it starts and answers the coaching tips, `steady` stops trouble but ignores the
// tips, `novice` only cleans up what cannot be ignored. `--policy build` shops and takes the spicier doors; `plain` never does.
// The bots are quicker and calmer than a person: read the numbers against each other, not as what a player will score.
import { writeFileSync } from "node:fs";
import * as W from "../dist/week.mjs";
import { CoachBot } from "../check-bot.mjs";
import { incidentCards } from "../dist/incident-cards.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a, i, all) => (a.startsWith("--") ? [[a.slice(2), all[i + 1] ?? "1"]] : [])),
);
const RUNS = Number(args.runs) || 4,
  WEEKS = Number(args.weeks) || 4,
  POLICY = args.policy || "build",
  BOTS = (args.bots || "expert,steady,novice").split(",");
const KINDS = {
  expert: { proactive: true, tips: true },
  steady: { proactive: true, tips: false },
  novice: { proactive: false, tips: false },
};
const mean = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);
const pct = (n) => Math.round(n * 100) + "%";

// One shift, played by a bot a frame at a time, sampled once a second.
function playShift(shift, kind, seed) {
  const bot = new CoachBot(shift.tier, seed, {
    ...KINDS[kind],
    config: shift.config,
    booking: shift.booking,
    perks: shift.perks,
  });
  const s = bot.s,
    gen = bot.run$(),
    curve = [];
  let calm = 0,
    longestCalm = 0,
    frame = 0;
  for (;;) {
    if (gen.next().done) break;
    bot.tickFrame();
    if (s.status !== "playing" || ++frame % 60) continue;
    const demands = incidentCards(s).length;
    curve.push(demands);
    calm = demands === 0 && !bot.doing ? calm + 1 : 0;
    longestCalm = Math.max(longestCalm, calm);
  }
  const summary = s.summary();
  return {
    summary,
    stats: s.stats,
    seconds: s.config.duration,
    idle: bot.idle / Math.max(1, frame),
    pile: Math.max(0, ...curve),
    busy: mean(curve.map((n) => (n > 0 ? 1 : 0))),
    longestCalm,
    curve,
  };
}

// The door a bot takes, and what it buys: `build` takes the best-paid door it dares and one perk a shift while the week is on pace.
function pickCard(shift, kind) {
  const cards = shift.cards || [];
  if (POLICY !== "build" || cards.length < 2) return cards[0]?.id ?? null;
  const dare = kind === "novice" ? 1 : kind === "steady" ? 2 : 3;
  const dared = cards.filter((c) => (c.danger || 1) <= dare);
  return (dared.length ? [...dared].sort((a, b) => b.payout - a.payout)[0] : cards[0]).id;
}
function shop(save, kind) {
  if (POLICY !== "build" || !save.week) return null;
  // (the pick after a shift, docs/fun-plan.md step 4; before it, the week's shop)
  if (W.pickOffer && W.takePick) {
    const offer = W.pickOffer(save);
    if (!offer?.length) return null;
    const o = W.outlook(save.week),
      free = offer.find((x) => x.price === 0),
      paid = offer
        .filter((x) => x.price > 0 && x.price <= save.week.fund * 0.35)
        .sort((a, b) => a.price - b.price)[0];
    const choice =
      kind === "novice" ? paid || null : free && save.week.shift % 2 ? free : o.onTrack ? paid || free : free;
    if (!choice) return (W.skipPick?.(save), null);
    return W.takePick(save, choice.id) ? choice.id : null;
  }
  const o = W.outlook(save.week),
    ch = W.chapterFor(save.week.chapter);
  if (!o.onTrack) return null;
  const id = W.shopOffer(save.week, save.week.rolls, save.known).find(
    (p) => W.perkPrice(p, ch) <= save.week.fund * 0.35,
  );
  return id && W.buyPerk(save.week, id) ? id : null;
}

function playRun(kind, seed) {
  const save = W.normalizeWeekSave({ tutorial: true, lesson2: true });
  const run = { kind, seed, weeks: [], shifts: [], signature: new Set(), seconds: 0, ended: "playing" };
  for (let guard = 0; guard < WEEKS * 8; guard++) {
    if (!save.week) {
      if (save.chapter > WEEKS) break;
      save.week = W.newWeek(save, (seed * 7919 + save.chapter * 104729) >>> 0);
      run.weeks.push({
        chapter: save.chapter,
        goal: W.chapterFor(save.chapter).goal,
        start: save.week.fund,
        funds: [],
        decided: null,
        deluxe: null,
      });
    }
    const week = run.weeks[run.weeks.length - 1],
      w = { ...save.week, gear: save.gear, done: save.done },
      first = W.buildShift(w, null, save.known, save.seen),
      card = pickCard(first, kind),
      shift = W.buildShift(w, card, save.known, save.seen),
      played = playShift(shift, kind, (seed * 31 + guard * 977) >>> 0),
      chapter = save.week.chapter,
      result = W.finishShift(save, shift, played.summary, played.stats);
    run.seconds += played.seconds;
    run.shifts.push({
      chapter,
      day: shift.day,
      pool: shift.pool,
      tier: shift.tier,
      rule: shift.card?.rule || shift.card?.id || "regular",
      stars: played.summary.stars,
      passed: result.passed,
      gained: result.gained,
      idle: played.idle,
      pile: played.pile,
      busy: played.busy,
      longestCalm: played.longestCalm,
    });
    run.signature.add(shift.pool + ":" + (shift.card?.rule || shift.card?.id || "regular"));
    week.funds.push(result.fund);
    // (the deluxe date, the stretch for a coach whose date is paid early: the day it was reached)
    if (week.deluxe === null && result.deluxe && result.fund >= result.deluxe)
      week.deluxe = week.funds.length;
    // The day the week was decided: the fund reached its goal, or what is left can no longer make it.
    if (week.decided === null) {
      const left = W.SHIFTS_PER_WEEK - week.funds.length,
        best = W.shiftPay(3, result.chapter, { payout: 1.4 }) + 60 * result.chapter.pay;
      if (result.fund >= result.goal) week.decided = week.funds.length;
      else if (result.fund + left * best < result.goal || result.over) week.decided = week.funds.length;
    }
    if (result.over) {
      run.ended = "game over, week " + chapter;
      break;
    }
    if (result.won) week.won = true;
    const bought = shop(save, kind);
    if (bought) run.signature.add("perk:" + bought);
  }
  if (run.ended === "playing") run.ended = "week " + WEEKS + " done";
  return run;
}

const jaccard = (a, b) => {
  const both = [...a].filter((x) => b.has(x)).length;
  return both / Math.max(1, a.size + b.size - both);
};

const out = { policy: POLICY, runs: RUNS, weeks: WEEKS, bots: {} };
console.log(`The fun report · ${RUNS} runs of up to ${WEEKS} weeks · policy ${POLICY}\n`);
for (const kind of BOTS) {
  const started = Date.now(),
    runs = Array.from({ length: RUNS }, (_, i) => playRun(kind, 4001 + i * 613));
  const shifts = runs.flatMap((r) => r.shifts),
    later = shifts.filter((s) => s.tier >= 6),
    weeks = runs.flatMap((r) => r.weeks).filter((w) => w.decided !== null),
    late = weeks.filter((w) => w.decided >= 5).length,
    pairs = runs.flatMap((a, i) => runs.slice(i + 1).map((b) => jaccard(a.signature, b.signature)));
  const row = {
    shifts: shifts.length,
    passed: mean(shifts.map((s) => (s.passed ? 1 : 0))),
    stars: mean(shifts.map((s) => s.stars)),
    idle: mean(shifts.map((s) => s.idle)),
    idleLater: mean(later.map((s) => s.idle)),
    busy: mean(shifts.map((s) => s.busy)),
    pile5: shifts.filter((s) => s.pile >= 5).length,
    pileMax: Math.max(0, ...shifts.map((s) => s.pile)),
    longestCalm: mean(shifts.map((s) => s.longestCalm)),
    weeksWon: runs.flatMap((r) => r.weeks).filter((w) => w.won).length,
    weeksPlayed: runs.flatMap((r) => r.weeks).length,
    decidedLate: weeks.length ? late / weeks.length : 0,
    endShare: mean(runs.flatMap((r) => r.weeks).map((w) => (w.funds[w.funds.length - 1] || 0) / w.goal)),
    deluxeWeeks: mean(runs.flatMap((r) => r.weeks).map((w) => (w.deluxe ? 1 : 0))),
    deluxeDays: runs
      .flatMap((r) => r.weeks)
      .map((w) => w.deluxe || "-")
      .join(""),
    decidedDays: weeks.map((w) => w.decided).join(""),
    endings: runs.map((r) => r.ended),
    minutes: mean(runs.map((r) => r.seconds / 60)),
    alike: mean(pairs),
    perks: mean(runs.map((r) => [...r.signature].filter((x) => x.startsWith("perk:")).length)),
  };
  out.bots[kind] = { ...row, runs: runs.map((r) => ({ ...r, signature: [...r.signature] })) };
  console.log(
    [
      `${kind.toUpperCase()} (${row.shifts} shifts, ${((Date.now() - started) / 1000).toFixed(0)} s to play)`,
      `  shifts passed ${pct(row.passed)} · stars ${row.stars.toFixed(2)} · weeks won ${row.weeksWon}/${row.weeksPlayed}`,
      `  idle ${pct(row.idle)} (level 6 and up: ${pct(row.idleLater)}) · something pending ${pct(row.busy)} of the time`,
      `  most at once ${row.pileMax} (shifts with five or more: ${row.pile5}) · longest calm ${row.longestCalm.toFixed(0)} s on average`,
      `  weeks decided on Friday or Saturday ${pct(row.decidedLate)} (days: ${row.decidedDays || "none"}) · a week ends at ${row.endShare.toFixed(2)} of its goal`,
      `  deluxe dates ${pct(row.deluxeWeeks)} of weeks (reached on day: ${row.deluxeDays || "none"})`,
      `  runs: ${row.endings.join(" · ")} · ${row.minutes.toFixed(0)} min of shifts a run`,
      `  two runs share ${pct(row.alike)} of their pools, day rules and perks · perks a run ${row.perks.toFixed(1)}`,
      "",
    ].join("\n"),
  );
}
if (args.json) writeFileSync(args.json, JSON.stringify(out, null, 1));
