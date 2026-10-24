// The Jumping Pool (24 October 2026, the creator: "an open-air country-club complex… one large, deep rectangular pool… two diving
// stations on opposite sides… LOW: a flexible springboard… MEDIUM: a rigid platform… HIGH: a rigid platform reached by stairs…
// assign the right height… some guests look confident but are actually beginners… a failed jump… the existing cramp-rescue
// mechanic… No chlorine problem here!! no poo or vomit here!!… LETS ADD A HOTTUB… we do have poo and pee problem here… add leopard
// man and carl as jumping NPC. not incidents!!!… make sure that player can make a mistake an assign the beginner to the highest
// platform and that will increase the failed by a lot!!… an adnvaceed assign to a low end creates frusstration and little points…
// a nice gravity system here so the jumps are random and funny").
import assert from "node:assert/strict";
import { SHIFTS } from "./dist/sim.mjs";
import { VENUES } from "./dist/spatial.mjs";
import {
  DIVE,
  HEIGHTS,
  BOARDS,
  STATIONS,
  LADDERS,
  TUB,
  TUB_LANE,
  LINE_MAX,
  MASSAGE_BEDS,
  tubSeats,
  tubSteps,
  inTub,
  diveWalkable,
  landingSpot,
} from "./dist/dive-plan.mjs";
import {
  DIVE_TUNING,
  SKILL,
  outcomeOdds,
  planJump,
  boardOpen,
  chooseBoard,
  tubGuests,
  shownType,
  STYLES,
} from "./dist/dive.mjs";
import { tablesOf, SPOTS, TABLE, tablePoint, tableApproach, tableRoute } from "./dist/incidents/massage.mjs";
import { POOLS, POOL_IDS, LADDER, POOL_INTROS, freePlayShift, scoreScale } from "./dist/week.mjs";
import { SONGS } from "./dist/music.mjs";
import { STINGS, SAVES } from "./dist/moments.mjs";
import { bigKind } from "./dist/big-moment.mjs";
import { CoachBot } from "./check-bot.mjs";

const v = VENUES.dive;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const inPool = (x, z, m = 0) => Math.abs(x) < DIVE.halfX + m && Math.abs(z) < DIVE.halfZ + m;
const inStation = (x, z) => STATIONS.some((s) => x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1);

// ---- the plan ------------------------------------------------------------------------------------------------------------

{
  assert.ok(v && v.dive, "the Jumping Pool is a venue");
  assert.deepEqual(
    HEIGHTS.map((h) => [h.name, h.color]),
    [
      ["LOW", "#46b553"],
      ["MID", "#f1c232"],
      ["HIGH", "#e2453c"],
    ],
    "three heights, green, yellow and red",
  );
  assert.ok(
    HEIGHTS[0].spring && !HEIGHTS[1].spring && !HEIGHTS[2].spring,
    "LOW is the springboard, the others platforms",
  );
  assert.ok(HEIGHTS[0].y < HEIGHTS[1].y && HEIGHTS[1].y < HEIGHTS[2].y, "each one higher");
  assert.equal(BOARDS.length, 6, "two stations of three");
  for (const side of [-1, 1])
    assert.equal(BOARDS.filter((b) => b.side === side).length, 3, "three boards at each end");
  for (const b of BOARDS) {
    assert.ok(inPool(b.x, b.tipZ), "board " + b.id + "'s tip over the water");
    assert.ok(!inPool(b.x, b.footZ), "board " + b.id + "'s stairs on the deck");
    const land = landingSpot(b, 2);
    assert.ok(inPool(land.x, land.z, -1), "board " + b.id + " lands in the pool");
    // Its own line, on the deck, clear of the pool, the stations, the tub, and reachable from the queue.
    for (const spot of b.line) {
      assert.ok(
        !inPool(spot.x, spot.z, 0.6) && !inStation(spot.x, spot.z),
        "board " + b.id + "'s line on open deck",
      );
      assert.ok(diveWalkable(spot.x, spot.z, 0.3), "and out of the tub");
      const from = { x: v.queue.startX, z: v.queue.startZ };
      assert.ok(v.route(from, spot).length > 0, "the line is reachable");
    }
  }
  assert.equal(
    new Set(BOARDS.flatMap((b) => b.line.map((s) => s.x + ":" + s.z))).size,
    6 * LINE_MAX,
    "lines apart",
  );
  assert.equal(LADDERS.length, 4, "four ladders out on the long sides");
  for (const l of LADDERS)
    assert.ok(inPool(l.water.x, l.water.z) && !inPool(l.deck.x, l.deck.z), "ladder in and out");
  // The hot tub: six seats in it, its steps on the deck.
  assert.equal(tubSeats().length, TUB.cap);
  for (const s of tubSeats()) assert.ok(inTub(s.x, s.z, 0.3), "a seat in the tub");
  assert.ok(
    diveWalkable(tubSteps().deck.x, tubSteps().deck.z) && inTub(tubSteps().water.x, tubSteps().water.z),
  );
  assert.ok(!inPool(TUB.x, TUB.z, TUB.r + 0.5), "the tub away from the pool");
  // The massage corner: two beds side by side.
  assert.equal(MASSAGE_BEDS.length, 2);
  assert.equal(tablesOf(v).length, 2, "the venue has both massage beds");
  assert.ok(Math.abs(MASSAGE_BEDS[0].z - MASSAGE_BEDS[1].z) < 0.01, "side by side");
  for (const t of tablesOf(v)) {
    for (const sp of SPOTS) {
      const at = tablePoint(t, sp.along, sp.side * TABLE.stand);
      assert.ok(v.isDeck(at.x, at.z, 9), "a coach can stand at each bed");
    }
    const on = tableApproach(t);
    assert.ok(v.isDeck(on.x, on.z, 9), "the guests' side of each bed is deck");
    // From every ladder's top, the walk to the bed keeps to the deck.
    for (const l of LADDERS) {
      let at = l.deck;
      for (const step of tableRoute(v, l.deck, t)) {
        for (let k = 1; k <= 20; k++) {
          const x = at.x + ((step.x - at.x) * k) / 20,
            z = at.z + ((step.z - at.z) * k) / 20;
          assert.ok(!inPool(x, z, 0.2) && diveWalkable(x, z), "the walk to a bed keeps out of the water");
        }
        at = step;
      }
    }
  }
}

// ---- the odds: the wrong height costs ------------------------------------------------------------------------------------

{
  for (const diff of [-2, -1, 0, 1, 2])
    for (const h of [0, 1, 2]) {
      const o = outcomeOdds(diff, h, 10),
        sum = Object.values(o).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sum - 1) < 1e-9, "odds sum to one");
    }
  const fail = (diff, h = 2, level = 10) => outcomeOdds(diff, h, level).fail || 0;
  assert.equal(fail(-1), 0, "a diver below their level never wipes out");
  assert.equal(outcomeOdds(0, 0).fail || 0, 0, "the springboard at your level: no wipeouts");
  assert.ok(fail(0) < 0.1, "the right height: a wipeout is rare");
  assert.ok(fail(1) > 0.35, "one too high: a wipeout in three");
  assert.ok(
    fail(2) > 0.65,
    "a beginner on the HIGH board: a wipeout most of the time (the creator: 'by a lot')",
  );
  assert.ok(fail(2, 2, 18) > fail(2, 2, 2), "and more so later in the run");
  assert.ok(!outcomeOdds(0, 1).chicken && outcomeOdds(2, 2).chicken > 0, "only the frightened chicken out");
  assert.ok(outcomeOdds(-1, 0).clean > 0.75, "an easy board is clean");
  // Points: a higher board is worth more, a Pro on the springboard is worth little (the creator: "frusstration and little points").
  const T = DIVE_TUNING;
  assert.ok(T.points[0] < T.points[1] && T.points[1] < T.points[2]);
  assert.ok(
    T.points[0] * T.tooLow[1] < T.points[2] * 0.5,
    "a Pro sent LOW earns well under half a HIGH dive",
  );
  assert.ok(T.boredHit[1] >= 40, "and is cross about it");
  assert.ok(T.fail[2] >= 200, "a wipeout off the HIGH board costs");
}

// ---- a quiet shift to test in --------------------------------------------------------------------------------------------

const game = (seed = 5, level = 10, extra = {}) => {
  const bot = new CoachBot(level, seed, {
    config: {
      ...SHIFTS[level - 1],
      venue: "dive",
      chaos: [],
      twist: [],
      sickRate: 0,
      duration: 900,
      ...extra,
    },
  });
  const s = bot.s;
  s.schedule = [];
  s.chaosPlan = [];
  s.start();
  s.dive.opens = [0, 0, 0];
  s.dive.nextCut = Infinity;
  s.dive.bigGuys = [];
  bot.cap = 1e9;
  const until = (done, n = 60 * 90) => {
    for (let i = 0; i < n && !done(); i++) {
      s.tick(1 / 60);
      s.events.length = 0;
    }
    return done();
  };
  return { bot, s, until };
};
const waiting = (s, until, type = "intermediate", extra = {}) => {
  const p = s.spawn({ entrance: true, type, sick: false });
  Object.assign(p, { type, tubOnly: false, bluff: false, sick: false, vip: false, ...extra });
  assert.ok(
    until(() => p.status === "queue", 60 * 25),
    "in through the gate and waiting",
  );
  return p;
};
const send = (s, p, k) => {
  s.select(p.id);
  return s.assign(k);
};

// A diver sent to the right height: up the stairs, off the board, into the water, out by a ladder, served.
{
  const { s, until } = game(3);
  const p = waiting(s, until, "intermediate");
  assert.ok(send(s, p, 1), "sent to MID");
  assert.equal(p.status, "dive");
  assert.ok([1, 4].includes(p.board), "to one of the two MID boards");
  const seen = new Set();
  let peak = 0;
  until(() => {
    seen.add(p.dive);
    peak = Math.max(peak, p.y || 0);
    return p.status !== "dive";
  });
  for (const st of ["walk", "climb", "out", "edge", "air"]) assert.ok(seen.has(st), "went through " + st);
  assert.ok(peak > HEIGHTS[1].y, "a hop above the platform (gravity: up, then down)");
  if (p.diveResult !== "fail") {
    assert.ok(p.served, "served when they hit the water");
    assert.ok(seen.has("ladder"), "out by a ladder");
  }
}

// The physics: a diver's flight is a parabola from the board to the water, and its time is what gravity says.
{
  const { s, until } = game(4);
  const p = waiting(s, until, "advanced");
  send(s, p, 2);
  until(() => p.dive === "edge");
  const J = p.jump,
    g = (2 * (J.y0 + J.vy * J.T)) / (J.T * J.T);
  assert.ok(Math.abs(g - 9.8) < 1e-6, "the fall is gravity's");
  assert.ok(J.T > 1 && J.T < 2.2, "about a second and a half off the HIGH board");
  assert.ok(Math.abs(J.land.z - BOARDS[p.board].tipZ) < 4, "lands a few metres out");
}

// The same mistake over and over: a beginner on the HIGH board wipes out most of the time; at the right height almost never.
// A jump is drawn differently every time (the creator: "random and funny not all systematic and the same").
{
  const { s, until } = game(6);
  const fakeBoard = BOARDS[2];
  const tally = (type, h) => {
    const out = {};
    const p = waiting(s, until, type);
    for (let i = 0; i < 400; i++) {
      const J = planJump(s, p, BOARDS[h]);
      out[J.outcome] = (out[J.outcome] || 0) + 1;
    }
    p.status = "gone";
    return out;
  };
  const bad = tally("beginner", 2),
    good = tally("beginner", 0),
    pro = tally("advanced", 2);
  assert.ok((bad.fail || 0) > 240, "a beginner off HIGH: most wipe out (" + bad.fail + "/400)");
  assert.ok((bad.chicken || 0) > 15, "some chicken out");
  assert.ok(!good.fail && (good.clean || 0) > 220, "a beginner on the springboard is fine");
  assert.ok((pro.fail || 0) < 50 && (pro.clean || 0) > 220, "a Pro off HIGH, mostly clean");
  // Variety: styles, spins, launches and landings all differ.
  const p = waiting(s, until, "advanced");
  const jumps = Array.from({ length: 40 }, () => planJump(s, p, fakeBoard));
  assert.ok(new Set(jumps.map((j) => j.style)).size >= 3, "a Pro has several dives");
  assert.ok(new Set(jumps.map((j) => j.vy.toFixed(2))).size > 30, "every launch its own");
  assert.ok(new Set(jumps.map((j) => j.turns.toFixed(2))).size > 30, "every spin its own");
  for (const j of jumps) assert.ok(STYLES[j.style], "a known style");
}

// A beginner sent to HIGH: scared at the edge, and when it goes wrong the cramp's rescue (a ring), and the coach saves them.
{
  const { bot, s, until } = game(8);
  const p = waiting(s, until, "beginner");
  send(s, p, 2);
  until(() => p.dive === "edge");
  assert.ok(p.jump.scared && p.hesitate > 2, "a beginner up there freezes at the edge");
  p.jump.outcome = "fail";
  p.jump.flail = true;
  const before = s.score;
  until(() => p.status !== "dive");
  assert.equal(p.status, "swim");
  assert.equal(p.problem, "cramp", "a wipeout is the cramp's rescue");
  assert.ok(s.rescue && s.rescue.kind === "dive" && s.rescue.victims.includes(p.id));
  assert.ok(s.score <= before - DIVE_TUNING.fail[2], "it costs");
  assert.equal(s.stats.diveFails, 1);
  // The next diver waits at the edge for the water to clear.
  const q = waiting(s, until, "intermediate");
  send(s, q, 1);
  until(() => q.dive === "edge" && q.hesitate === 0, 60 * 30);
  until(() => false, 60 * 3);
  assert.equal(q.dive, "edge", "nobody jumps into a rescue");
  bot.crash();
  assert.ok(!s.rescue || s.rescue.stage !== "stranded", "the coach brought them out");
  until(() => p.status !== "swim" && p.status !== "exit", 60 * 40);
  assert.ok(
    ["massage", "gone"].includes(p.status) || p.massage || p.exitPhase === "deck",
    "off to a massage bed or home",
  );
}

// A Pro on the springboard: bored, a lazy pencil jump, few points and a cross guest.
{
  const { s, until } = game(9);
  const p = waiting(s, until, "advanced");
  p.h = 100;
  const score = s.score;
  send(s, p, 0);
  until(() => p.dive === "edge");
  assert.equal(p.jump.style, "lazy", "a bored pencil jump");
  until(() => p.served || p.status !== "dive");
  assert.ok(p.served);
  assert.ok(s.score - score < DIVE_TUNING.points[2] * 0.5, "little points");
  assert.ok(p.h < 70, "frustrated");
  assert.equal(s.stats.bored, 1);
  // And a Pro off HIGH: the most points.
  const q = waiting(s, until, "advanced");
  q.h = 100;
  q.wait = 0;
  let got = 0;
  for (let tries = 0; tries < 6 && !got; tries++) {
    const at = s.score;
    if (q.status === "queue") send(s, q, 2);
    until(() => q.dive === "edge");
    q.jump.outcome = "clean";
    until(() => q.served);
    got = s.score - at;
  }
  assert.ok(
    got >= DIVE_TUNING.points[2] + DIVE_TUNING.clean,
    "a clean Pro dive off HIGH pays the most (" + got + ")",
  );
}

// A height not open yet is refused; the two boards of a height share the line; a full line refuses.
{
  const { s, until } = game(10);
  s.dive.opens = [0, 999, 999];
  const p = waiting(s, until, "advanced");
  assert.ok(!boardOpen(s, 2) && !send(s, p, 2), "HIGH is not open yet");
  assert.equal(p.status, "queue");
  s.dive.opens = [0, 0, 0];
  const a = waiting(s, until, "beginner"),
    b = waiting(s, until, "beginner");
  send(s, a, 0);
  send(s, b, 0);
  assert.notEqual(a.board, b.board, "the second goes to the other end's springboard");
  s.dive.boards[0].line = [1, 2, 3, 4];
  s.dive.boards[3].line = [1, 2, 3, 4];
  assert.equal(chooseBoard(s, p, 0), -1, "both lines full");
  s.dive.boards[0].line = [];
  s.dive.boards[3].line = [];
}

// A show-off: says Pro (the tag), is often a beginner. The coach checks them (E) and sees what they are.
{
  const { s, until } = game(12);
  const p = waiting(s, until, "beginner", { bluff: true });
  assert.equal(shownType(p), "advanced", "says Pro");
  const near = s.coach;
  near.x = p.x + 0.6;
  near.z = p.z;
  const it = s.nearestInteraction();
  assert.equal(it?.kind, "check", "E beside a show-off checks them");
  s.interact();
  until(() => p.revealed, 60 * 3);
  assert.ok(p.revealed && shownType(p) === "beginner", "a beginner after all");
  assert.equal(s.stats.checked, 1);
}

// A line-cutter: to the front and arguing; E beside them sends them to the back (+40); left alone they go first.
{
  const { s, until } = game(14);
  const ps = [0, 1, 2].map(() => waiting(s, until, "intermediate"));
  // Block the MID boards' stairs so a line forms at one of them.
  s.dive.boards[1].up = -1;
  s.dive.boards[4].up = -1;
  for (const p of ps) {
    send(s, p, 1);
    s.dive.boards[4].line = s.dive.boards[4].line.filter((id) => id !== p.id);
    if (!s.dive.boards[1].line.includes(p.id)) {
      p.board = 1;
      s.dive.boards[1].line.push(p.id);
      p.path = v.route(p, BOARDS[1].line[s.dive.boards[1].line.length - 1]);
    }
  }
  until(() => ps.every((p) => p.dive === "line"), 60 * 30);
  s.dive.nextCut = 0;
  until(() => s.dive.cut, 10);
  assert.ok(s.dive.cut, "someone cut in");
  const c = s.get(s.dive.cut.id);
  assert.equal(s.dive.boards[1].line[0], c.id, "to the front");
  s.coach.x = c.x + 0.6;
  s.coach.z = c.z;
  assert.equal(s.nearestInteraction()?.kind, "cut");
  const before = s.score;
  s.interact();
  assert.equal(s.dive.boards[1].line.at(-1), c.id, "to the back");
  assert.ok(s.score >= before + DIVE_TUNING.cutPoints);
  assert.equal(s.stats.cutsStopped, 1);
  assert.ok(STINGS["line-cut"] && SAVES["line-cut"], "a sting and a save");
}

// The hot tub: its guests only (♨️), six seats; tummy trouble only there, never in the diving pool.
{
  const { s, until } = game(16);
  const t = waiting(s, until, "intermediate", { tubOnly: true });
  const d = waiting(s, until, "intermediate");
  assert.ok(!send(s, d, TUB_LANE), "a diver is not here to soak");
  assert.ok(!send(s, t, 1), "a soaker is not here to dive");
  assert.ok(send(s, t, TUB_LANE), "to the tub");
  until(() => t.status === "swim", 60 * 20);
  assert.ok(inTub(t.x, t.z), "sitting in the tub");
  assert.equal(tubGuests(s).length, 1);
  // A sick soaker: the floater is in the tub.
  const sick = waiting(s, until, "intermediate", { tubOnly: true });
  Object.assign(sick, { sick: true, stomachDelay: 0.5, sickKind: "poo" });
  send(s, sick, TUB_LANE);
  until(() => s.cleanup || s.floater || s.people.some((p) => p.problem === "stomach"), 60 * 40);
  until(() => s.cleanup, 60 * 20);
  assert.ok(s.cleanup, "the tub has to be cleaned");
  const f = s.floater || s.cleanup?.floater;
  if (f && f.x != null) assert.ok(inTub(f.x, f.z, -0.2), "the floater is in the tub, not the pool");
}
// Nobody who dives is ever sick, and nobody needs fins or cramps.
{
  const { s, until } = game(18);
  for (let i = 0; i < 30; i++) {
    const p = s.spawn({ entrance: true });
    if (!p.tubOnly)
      assert.ok(!p.sick && !p.needsFins && p.crampAt === Infinity, "a diver: no tummy, no fins, no cramp");
  }
  until(() => false, 1);
}

// Carl and the leopard man come to dive (not incidents): their own figure, a cannonball (the leopard man sometimes flips into it).
{
  const { s, until } = game(20, 12);
  s.dive.bigGuys = [
    { at: s.dive.arrivals, figure: "carl" },
    { at: s.dive.arrivals + 1, figure: "leopard" },
  ];
  const carl = s.spawn({ entrance: true }),
    leo = s.spawn({ entrance: true });
  assert.equal(carl.bigGuy, "carl");
  assert.equal(leo.bigGuy, "leopard");
  assert.ok(["intermediate", "advanced"].includes(carl.type), "an intermediate or a Pro");
  until(() => carl.status === "queue", 60 * 25);
  send(s, carl, SKILL[carl.type]);
  until(() => carl.dive === "edge");
  assert.ok(carl.jump.ball, "a cannonball");
  const styles = new Set(Array.from({ length: 30 }, () => planJump(s, leo, BOARDS[2]).style));
  assert.ok(styles.has("flipball") && styles.has("cannonball"), "the leopard man flips into his");
}

// The venue in the week: the ladder's last pool, its intro, its song, its big moment, its scale.
{
  assert.ok(POOL_IDS.includes("dive") && POOLS.dive.name === "The Jumping Pool");
  assert.equal(LADDER.at(-1), "dive", "opened last on the ladder");
  assert.ok(POOL_INTROS.dive, "a card the first time");
  assert.ok(SONGS.dive, "its own song");
  assert.equal(bigKind(v), "showcase", "the big moment is the dive show");
  assert.ok(scoreScale("dive", 10) > 0.5 && scoreScale("dive", 10) < 2.6);
  assert.deepEqual(v.skips.slice().sort(), ["carl", "dog", "fish"], "no Carl incident, no fish kid, no dog");
}

// A whole shift with the bot, twice: the same seed plays the same (deterministic), and a good coach passes it.
{
  const play = (seed) => {
    const sh = freePlayShift("dive", "normal", seed);
    const bot = new CoachBot(sh.tier, seed, { config: sh.config }).run();
    return { sum: bot.s.summary(), sh, s: bot.s };
  };
  const a = play(31),
    b = play(31);
  assert.equal(a.sum.score, b.sum.score, "deterministic");
  assert.equal(a.sum.served, b.sum.served);
  assert.ok(a.sum.dives > 5, "plenty of dives (" + a.sum.dives + ")");
  assert.ok(
    a.sum.stars >= 1,
    "the bot passes a normal shift (" + a.sum.score + " vs " + a.sh.config.thresholds + ")",
  );
  for (const p of a.s.people) assert.ok(p.status !== "dive" || p.dive !== "air", "nobody left in the air");
}

console.log(
  "dive-check: the Jumping Pool's plan, odds, heights, show-offs, cutters, hot tub, big guys and shifts pass",
);
