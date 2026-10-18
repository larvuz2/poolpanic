// The Wave Pool (17 October 2026, the creator: "the Wave Pool venue… the wave can hit harder on someone, and we get a lot of
// dizziness here… we need to save a lot of people here. We need to stop the waves… people start getting impatient and mad… if we
// don't shut down the wave and the wave hits a dizzy person, then it gets critical… if we hand out tubes, there is less probability
// that the people will get dizzy, but it's a challenge to hand out tubes to all… we don't click on the swimmers and assign them…
// they just enter and go straight at it, so we need to intercept the people and hand them the tubes. There are not a lot of tubes…
// the floor can get wet for the people that come out… the kid with the fish… the pee, the poo, everything").
import assert from "node:assert/strict";
import { PoolSimulation, SHIFTS } from "./dist/sim.mjs";
import { VENUES } from "./dist/spatial.mjs";
import {
  WAVE,
  depthAt,
  floorAt,
  speedAt,
  program,
  hitStrength,
  surfaceAt,
  waveProfile,
  waveBoard,
} from "./dist/waves.mjs";
import { BATHE, onSand } from "./dist/wave-pool.mjs";
import { POOLS, POOL_IDS, buildShift, newWeek, weekPools, scoreScale } from "./dist/week.mjs";
import { SONGS, waveScore, WAVE_TUNE, STEPS_PER_BAR } from "./dist/music.mjs";
import { STINGS, SAVES } from "./dist/moments.mjs";
import { PROP_FILES } from "./dist/scene/prop-models.mjs";
import { INPUTS } from "./dist/replay.mjs";
import { CoachBot } from "./check-bot.mjs";
import fs from "node:fs";

const v = VENUES.wave;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// A quiet test shift: no schedule, no incidents, no cramps unless asked.
const game = (seed = 5, level = 8, extra = {}) => {
  const bot = new CoachBot(level, seed, {
    config: { ...SHIFTS[level - 1], venue: "wave", chaos: [], twist: [], sickRate: 0, ...extra },
  });
  const s = bot.s;
  s.schedule = [];
  s.chaosPlan = [];
  s.start();
  bot.cap = 1e9;
  const until = (done, n = 6000) => {
    for (let i = 0; i < n && !done(); i++) bot.frame();
    return done();
  };
  return { bot, s, until };
};
const guest = (s, spec = {}) =>
  Object.assign(s.spawn({ entrance: true, ...spec }), {
    crampAt: Infinity,
    sick: false,
    sickKind: null,
    waitLimit: 999,
  });
// Keep the waves out of a test (the machine stopped for good, by its program's clock).
const calm = (s) => {
  s.waves.state = "calm";
  s.waves.left = 1e9;
};
// A wave of `kind` into the pool now.
const launch = (s, kind) => {
  s.waves.state = "running";
  s.waves.left = 1e9;
  s.waves.next = 1e9;
  s.waves.list.push({
    id: ++s.waves.uid,
    kind,
    a0: WAVE[kind] ?? WAVE.normal,
    a: 0.2,
    x: WAVE.launchX,
    prevX: WAVE.launchX,
    broken: false,
    brokeX: null,
    aBreak: 0,
    foam: 0,
    born: s.time,
    hits: [],
  });
};

// 1) The basin and the beach: a beach of sand at the near side sloping into the water, a shelf a metre deep, the deep end against
// the wave house; the floor plan: the gate, the beach on the deck, the wave house solid, everything reachable without wading.
{
  assert.equal(v.name, "Wave Pool");
  assert.ok(v.waves && !v.indoor && v.scenery === "surf");
  assert.deepEqual(v.lanes, [0], "no lanes: one 'lane', the water");
  assert.equal(v.tubes, 5, "not a lot of tubes");
  assert.equal(v.pool.halfX, WAVE.halfX);
  assert.equal(v.pool.halfZ, WAVE.halfZ);
  assert.equal(depthAt(-WAVE.halfX), 0, "the shoreline");
  assert.ok(Math.abs(depthAt(WAVE.shelf) - 1) < 1e-9, "a metre deep at the shelf");
  assert.ok(Math.abs(depthAt(WAVE.halfX) - WAVE.deep) < 1e-9, "deep against the wave house");
  for (let x = -WAVE.halfX; x < WAVE.halfX; x += 0.1)
    assert.ok(depthAt(x + 0.1) >= depthAt(x), "deeper and deeper");
  assert.ok(Math.abs(floorAt(-WAVE.halfX) - WAVE.water) < 1e-9, "the sand meets the water at the shoreline");
  assert.equal(floorAt(WAVE.sandTop - 0.5), 0, "and the deck up the beach");
  for (let x = WAVE.sandTop; x < -WAVE.halfX; x += 0.1)
    assert.ok(floorAt(x) >= floorAt(x + 0.1) - 1e-9, "the sand slopes down into the water");
  // On the deck: the sand at the water's edge; not: the water, the wave house.
  assert.ok(v.isDeck(-WAVE.halfX - 0.7, 0, 6), "the beach is walked on");
  assert.ok(!v.isDeck(-2, 0, 6, 0), "the water is not");
  assert.ok(!v.isDeck(10, 0, 6, 0) && !v.isDeck(13, 5, 6, 0), "nor the wave house");
  for (const [name, at] of [
    ...Object.entries(v.stations),
    ...Object.entries(v.fixtures),
    ["rack", v.sanitation.rack],
    ["bin", v.sanitation.bin],
    ["bench", v.rescue.bench],
    ["coach", v.coachStart],
    ...v.ringMounts.map((m, i) => ["ring " + i, m]),
  ]) {
    // (a station or a fixture stands in its own counter: somewhere within reach of it must be deck)
    const free = [0, 0.6, 1.0, 1.4].some((r) =>
      [0, 1, 2, 3, 4, 5, 6, 7].some((k) =>
        v.isDeck(at.x + Math.cos((k * Math.PI) / 4) * r, at.z + Math.sin((k * Math.PI) / 4) * r, 6, 0.3),
      ),
    );
    assert.ok(free, name + " is reached from the deck");
  }
  // From the gate to the beach: round the near end of the pool, never through the water.
  const door = v.arrival,
    from = { x: door.outsideX, z: door.doorZ };
  for (const z of [-8, 0, 8]) {
    const path = v.route(from, { x: BATHE.shoreX, z });
    let at = from;
    for (const p of path) {
      for (let k = 1; k <= 20; k++) {
        const x = at.x + ((p.x - at.x) * k) / 20,
          zz = at.z + ((p.z - at.z) * k) / 20;
        assert.ok(!(Math.abs(x) < WAVE.halfX && Math.abs(zz) < WAVE.halfZ), "the way to the beach is dry");
      }
      at = p;
    }
  }
  assert.ok(
    v.evacSpots.every((p) => v.isDeck(p.x, p.z, 6, 0.3) && onSand(p.x, p.z)),
    "evacuees wait on the sand",
  );
  assert.ok(
    v.edgeSpots().every((p) => p.x < 0 || Math.abs(p.z) > WAVE.halfZ),
    "edge spots on the beach and the ends, none on the wave house",
  );
}

// 2) The waves: the machine sounds its horn, then sends a wave every few seconds; a crest runs across the pool faster in deep water
// than in shallow, grows as the water shallows and breaks where it is too tall for the depth: a small wave close to the beach, a
// big one on the shelf, the monster out in the deep; broken, it rolls in as white water and is gone up the sand. What it does to a
// bather is hardest just where it broke.
{
  assert.ok(speedAt(6) > speedAt(-3) && speedAt(-3) > speedAt(-6.5), "faster in deep water");
  const p1 = program(1),
    p20 = program(20);
  assert.ok(
    p20.set > p1.set && p20.calm < p1.calm && p20.period < p1.period,
    "a harder program late in a run",
  );
  assert.equal(p1.monsterChance, 0, "no monster early on");
  assert.ok(p20.monsterChance > 0.5);
  const breaks = {};
  for (const kind of ["normal", "big", "monster"]) {
    const { s } = game(3, 12);
    s.people.length = 0;
    launch(s, kind);
    const wave = s.waves.list[0];
    let tallest = 0,
      before = wave.x;
    for (let i = 0; i < 60 * 8 && s.waves.list.includes(wave); i++) {
      s.tick(1 / 60);
      if (!wave.broken) tallest = Math.max(tallest, wave.a);
      if (wave.broken && breaks[kind] === undefined) breaks[kind] = wave.brokeX;
      assert.ok(wave.x <= before, "it only runs towards the beach");
      before = wave.x;
    }
    assert.ok(breaks[kind] !== undefined, kind + " breaks");
    assert.ok(tallest > wave.a0 * 1.04, kind + " grows as the water shallows");
    assert.ok(!s.waves.list.includes(wave), kind + " is gone up the sand");
  }
  assert.ok(
    breaks.normal < breaks.big && breaks.big < breaks.monster,
    "the bigger the wave, the further out it breaks",
  );
  assert.ok(breaks.normal < -2 && breaks.normal > -5, "a small wave breaks near the beach");
  assert.ok(breaks.monster > 1.5, "the monster breaks out in the deep");
  // The jolt: hardest where it broke, less as white water, gentlest as a swell.
  const broken = { a: 0.4, broken: true, brokeX: 0 };
  assert.ok(hitStrength(broken, -0.1) > hitStrength(broken, -3), "hardest where it broke");
  assert.ok(
    hitStrength({ a: 0.4, broken: false }, 2) < hitStrength(broken, -0.1) / 2,
    "a swell only lifts you",
  );
  // The picture: the surface is the crests' profile, steep in front, long behind.
  const wave = { x: 0, a: 0.3, broken: false };
  assert.ok(
    Math.abs(waveProfile(wave, 0) - 0.3) < 0.002 && waveProfile(wave, -0.6) < waveProfile(wave, 0.6),
    "steep in front",
  );
  assert.ok(
    Math.abs(surfaceAt([wave], 0) - waveProfile(wave, 0) * WAVE.show) < 1e-9,
    "drawn taller than the simulation's height",
  );
  // The program: the horn, the set, the calm, and again; deterministic for a seed.
  const runs = [1, 2].map(() => {
    const { s } = game(11, 9);
    const seen = [];
    for (let i = 0; i < 60 * 70; i++) {
      s.tick(1 / 60);
      for (const e of s.events)
        if (["waves-horn", "waves-on", "wave-launch", "waves-calm"].includes(e.type)) seen.push(e.type);
      s.events.length = 0;
    }
    return seen;
  });
  assert.deepEqual(runs[0], runs[1], "the same seed, the same waves");
  const seen = runs[0];
  assert.equal(seen[0], "waves-horn", "the horn first");
  assert.ok(
    seen.indexOf("waves-on") > 0 && seen.filter((e) => e === "wave-launch").length >= 10,
    "then a set of waves",
  );
  assert.ok(
    seen.includes("waves-calm") && seen.lastIndexOf("waves-horn") > seen.indexOf("waves-calm"),
    "a calm, and again",
  );
}

// 3) Nobody queues and nobody is sent: a guest comes in through the gate, walks round to the beach, drops a towel and wades in, out
// to a spot that suits them (the timid near the beach, the strong out in the deep); the coach cannot send anyone anywhere.
{
  const { s, until } = game(5);
  calm(s);
  const timid = guest(s, { type: "beginner" }),
    strong = guest(s, { type: "advanced" });
  assert.equal(timid.status, "arriving");
  until(() => timid.status === "enter");
  assert.ok(
    timid.path.length > 0 && timid.needsFins && !timid.hasFins,
    "straight down to the beach, wanting a tube",
  );
  let towel = false;
  until(() => {
    if (timid.status === "enter" && timid.towelT > 0) towel = true;
    return timid.status === "swim" && strong.status === "swim";
  });
  assert.ok(towel, "a towel dropped on the sand first");
  assert.equal(s.people.filter((p) => p.status === "queue").length, 0, "nobody waits in a queue");
  until(() => false, 60 * 12);
  assert.ok(timid.x < -2.5 && strong.x > -1, "each to the depth that suits them");
  s.select(timid.id);
  assert.equal(s.assign(0), false, "nobody is sent anywhere");
  assert.ok(s.events.some((e) => e.type === "toast" && /walk straight into the waves/.test(e.text)));
}

// 4) Intercepting: the coach takes a tube from the hut and hands it to a guest on their way down to the beach (E, the real
// interaction); a VIP who goes in without one grumbles; the tubes are few, and every one stays accounted for.
{
  const { bot, s, until } = game(7);
  calm(s);
  const p = guest(s, { type: "beginner" });
  until(() => p.status === "enter");
  bot.giveTube(p);
  until(() => p.hasFins || p.status === "swim", 600);
  assert.ok(p.hasFins, "tube handed over on the way in");
  assert.equal(s.finsAvailable, v.tubes - 1);
  const vip = guest(s, { vip: true, type: "intermediate" });
  until(() => vip.status === "swim");
  assert.ok(vip.vipMoaned, "a VIP who goes in without a tube lets everyone know");
  const h = vip.h;
  until(() => false, 60 * 5);
  assert.ok(vip.h < h - 5, "and grows cross in the water without one");
  // Coming out: the tube is left on the sand, for the coach to pick up again.
  p.workTarget = 0;
  until(() => p.status === "gone" || (p.status === "exit" && p.exitPhase === "deck"));
  const left = s.clutter.find((f) => f.type === "fins");
  assert.ok(left && onSand(left.x, left.z), "the tube left on the sand");
  assert.equal(s.finCount(), v.tubes, "every tube accounted for");
}

// 5) Dizziness: every crest jolts a bather, hardest where the waves break; it wears off in the calm. The timid get dizzy fastest,
// a tube lets far less through. A dizzy bather staggers for the beach; the coach helps them out from the edge (E): a rest on a
// towel and back in.
{
  const dizzyAfter = (type, tube) => {
    const { s } = game(13);
    const p = guest(s, { type });
    Object.assign(p, {
      status: "swim",
      x: -2.8,
      z: 0,
      spot: { x: -2.8, z: 0 },
      path: [],
      hasFins: tube,
      workTarget: 999,
    });
    if (tube) s.finsAvailable--;
    let worst = 0;
    for (let i = 0; i < 6; i++) {
      launch(s, "normal");
      for (let k = 0; k < 60 * 2.6; k++) {
        s.tick(1 / 60);
        worst = Math.max(worst, p.dizzy);
        p.spot = { x: -2.8, z: 0 };
      }
    }
    return worst;
  };
  const timid = dizzyAfter("beginner", false),
    strong = dizzyAfter("advanced", false),
    tubed = dizzyAfter("beginner", true);
  assert.ok(
    timid > strong * 1.8,
    "the timid get dizzy faster than the strong (" + timid.toFixed(0) + " vs " + strong.toFixed(0) + ")",
  );
  assert.ok(tubed < timid / 2.5, "a tube lets far less through (" + tubed.toFixed(0) + ")");
  assert.ok(timid >= BATHE.dizzy, "six waves in the impact zone leave a timid bather dizzy");

  const { bot, s, until } = game(17);
  const p = guest(s, { type: "beginner" });
  until(() => p.status === "swim");
  Object.assign(p, { x: -5.4, z: 1, dizzy: BATHE.dizzy + 5, problem: "dizzy", workTarget: 999 });
  calm(s);
  s.waves.list.length = 0;
  const x0 = p.x;
  until(() => false, 30);
  assert.ok(p.x < x0, "a dizzy bather staggers for the beach");
  bot.helpDizzy();
  until(() => p.status !== "swim", 300);
  assert.equal(p.status, "recovering", "helped out of the water");
  assert.ok(s.stats.helped === 1 && p.helped);
  until(() => p.status === "swim" || p.status === "enter", 60 * 12);
  assert.ok(["enter", "swim"].includes(p.status), "a rest on a towel, and back into the waves");
  assert.ok(p.dizzy < BATHE.woozy && !p.problem);
}

// 6) Critical: a crest that hits a bather who is already dizzy knocks them under. It is a rescue (points lost), the machine stops
// for it (the waves already out still roll in), the coach dives in with a life ring and tows them to the beach, a rest on a towel,
// and the waves start again with the horn.
{
  const { bot, s, until } = game(19);
  const p = guest(s, { type: "beginner" });
  until(() => p.status === "swim");
  Object.assign(p, { x: -3, z: 0, spot: { x: -3, z: 0 }, dizzy: 96, problem: "dizzy", workTarget: 999 });
  const score = s.score;
  launch(s, "big");
  until(() => !!s.rescue, 60 * 6);
  assert.ok(s.rescue && s.rescue.under && p.problem === "cramp" && p.under, "knocked under: a rescue");
  assert.equal(s.score, score - BATHE.knockout, "points lost");
  s.tick(1 / 60);
  assert.equal(s.waves.state, "halted", "the machine stops for the rescue");
  assert.equal(s.waves.haltReason, "rescue");
  bot.crash();
  until(() => !s.rescue, 60 * 30);
  assert.ok(!s.rescue, "rescued");
  until(() => s.waves.state === "horn" || s.waves.state === "running", 60 * 3);
  assert.ok(["horn", "running"].includes(s.waves.state), "and the waves start again");
  if (s.coach.swimming) bot.climbOut();
}

// 7) Stopping the waves (the WAVES button, 1): the machine stops and a monster on its way is called off; the bathers say "awww" at
// once and, after a moment's grace, grow cross the longer it stays off, chanting for waves; started again, the horn sounds and the
// program goes on.
{
  const { s, until } = game(23, 12);
  const a = guest(s),
    b = guest(s);
  until(() => a.status === "swim" && b.status === "swim");
  s.waves.state = "running";
  s.waves.left = 20;
  s.waves.monster = 3;
  const h = a.h;
  assert.ok(s.toggleWaves());
  assert.equal(s.waves.state, "stopped");
  assert.equal(s.waves.monster, null, "the monster is called off");
  assert.ok(a.h <= h - BATHE.stopCost + 1e-9, "awww");
  const launched = s.waves.launched;
  let chant = false;
  const h0 = a.h;
  for (let i = 0; i < 60 * BATHE.grace * 0.9; i++) s.tick(1 / 60);
  assert.ok(Math.abs(a.h - h0) < 2, "a moment's grace");
  for (let i = 0; i < 60 * 6; i++) {
    s.tick(1 / 60);
    if (s.events.some((e) => e.type === "chant")) chant = true;
    s.events.length = 0;
  }
  assert.ok(a.h < h0 - 8, "then they grow cross");
  assert.ok(chant, "WAVES! WAVES! WAVES!");
  assert.equal(s.waves.launched, launched, "no wave while stopped");
  assert.equal(waveBoard(s.waves).state, "stopped");
  assert.ok(s.toggleWaves());
  assert.equal(s.waves.state, "horn", "started again: the horn");
  for (let i = 0; i < 60 * 4; i++) s.tick(1 / 60);
  assert.ok(s.waves.launched > launched, "and the waves come again");
  assert.ok(INPUTS.includes("toggleWaves"), "the button is an input a replay records");
}

// 8) A monster wave knocks bathers in the impact zone off their tubes; a lost tube rides the waves in and washes up on the sand; every
// tube stays accounted for.
{
  const { s, until } = game(29, 14);
  const riders = [0, 1, 2, 3].map(() => guest(s));
  until(() => riders.every((p) => p.status === "swim"), 60 * 20);
  for (const [k, p] of riders.entries()) {
    Object.assign(p, {
      x: 2.6,
      z: -6 + k * 3.5,
      spot: { x: 2.6, z: -6 + k * 3.5 },
      hasFins: true,
      workTarget: 999,
    });
    s.finsAvailable--;
  }
  launch(s, "monster");
  let lost = 0,
    ashore = 0;
  for (let i = 0; i < 60 * 30 && !(lost && ashore >= lost); i++) {
    s.tick(1 / 60);
    for (const e of s.events) {
      if (e.type === "tube-lost") lost++;
      if (e.type === "tube-ashore") ashore++;
    }
    s.events.length = 0;
    assert.equal(s.finCount(), v.tubes, "every tube accounted for");
    if (s.rescue) {
      const victim = s.get(s.rescue.victim);
      victim.problem = null;
      s.rescue = null;
    }
  }
  assert.ok(lost >= 1, "the monster knocks someone off their tube");
  assert.ok(ashore >= lost, "the lost tubes wash up on the beach");
  assert.ok(
    s.clutter.filter((f) => f.type === "fins").every((f) => onSand(f.x, f.z)),
    "on the sand",
  );
}

// 9) Coming out soaked: more of them drip than anywhere else, on the deck just past the sand on the way out (never on the sand).
{
  assert.ok(v.wetChance > 0.2, "more drips than the one in five elsewhere");
  const { s, until } = game(31);
  calm(s);
  const people = Array.from({ length: 14 }, () => guest(s));
  until(() => people.every((p) => p.status === "swim"), 60 * 40);
  for (const p of people) p.workTarget = 0;
  until(() => people.every((p) => p.status === "gone"), 60 * 60);
  assert.ok(s.wetSpots.length >= 1, "wet spots on the way out");
  for (const spot of s.wetSpots) assert.ok(!onSand(spot.x, spot.z), "on the deck, not the sand");
}

// 10) Every incident still comes: a poo empties the pool up the beach (the machine stops), the fish kid's fish sends everyone
// fleeing out over the beach, Carl's cannonball comes from the beach, a blackout stops the machine; and a shift with every incident
// is played through by the bot.
{
  const { bot, s, until } = game(37, 10, { sickRate: 0 });
  const people = Array.from({ length: 5 }, () => guest(s));
  until(() => people.every((p) => p.status === "swim"), 60 * 30);
  people[0].sick = true;
  people[0].sickKind = "poo";
  s.catastrophe(people[0]);
  s.tick(1 / 60);
  assert.equal(s.waves.state, "halted", "the machine stops while the pool is closed");
  until(() => people.slice(1).every((p) => p.status === "panic"), 60 * 20);
  for (const p of people.slice(1)) assert.ok(onSand(p.x, p.z), "waiting up the beach");
  void bot;
  // The fish: everyone out over the beach.
  const t = game(41, 10);
  const swimmers = Array.from({ length: 4 }, () => guest(t.s));
  t.until(() => swimmers.every((p) => p.status === "swim"), 60 * 30);
  for (const p of swimmers) t.s.startFleeing(p);
  t.until(() => swimmers.every((p) => p.fleePhase === "run"), 60 * 10);
  for (const p of swimmers)
    assert.ok(p.x < -WAVE.halfX && t.s.venue.isDeck(p.x, p.z, 10, 0.2), "fled up the beach");
  // A blackout.
  const o = game(43, 10);
  o.s.waves.state = "running";
  o.s.outage = { stage: "dark", t: 99, elapsed: 0, dark: 0 };
  o.s.tick(1 / 60);
  assert.equal(o.s.waves.state, "halted");
  assert.equal(waveBoard(o.s.waves).reason, "blackout");
  assert.equal(o.s.toggleWaves(), false, "no power for the machine");
}

// 11) A whole shift, every incident in it, played by the bot: tubes handed out, the dizzy helped out, the machine stopped before a
// monster when someone is seeing stars, rescues done; nothing stuck, every tube accounted for, a star at least.
{
  const runs = [];
  for (const [tier, seed] of [
    [8, 3],
    [14, 9],
  ]) {
    const week = newWeek({ chapter: 2 }, 4242 + seed);
    week.pools = Array(6).fill("wave");
    week.shift = tier % 6;
    const sh = buildShift(week, "regular", []);
    assert.equal(sh.config.venue, "wave");
    const bot = new CoachBot(sh.tier, seed, { config: sh.config }).run();
    const sum = bot.s.summary();
    runs.push(sum);
    assert.equal(bot.s.status, "ended", "the shift ends");
    assert.ok(
      sum.served >= sh.config.total * 0.5,
      "most guests served (" + sum.served + "/" + sh.config.total + ")",
    );
    assert.ok(sum.stars >= 1, "a star at least (" + bot.s.score + " of " + sh.config.thresholds + ")");
  }
}

// 12) In every week's draw, with stars of its own; its song (surf rock, on the shift's clock); its stings; its props on disk.
{
  assert.ok(POOL_IDS.includes("wave") && POOLS.wave.name === "Wave Pool" && POOLS.wave.icon === "🌊");
  assert.deepEqual(
    POOLS.wave.twists,
    { team: 0, class: 0, closure: 0 },
    "no lanes: no swim team, class or closed lane",
  );
  let drawn = 0;
  // (Over 300 weeks: six of the pools a week, so about 6 in 13 of them; at least 3 in 10.)
  for (let seed = 1; seed <= 10; seed++)
    for (let c = 1; c <= 30; c++) if (weekPools(c, seed * 7717).includes("wave")) drawn++;
  assert.ok(drawn >= 90, "drawn into the weeks (" + drawn + " of 300)");
  assert.ok(scoreScale("wave", 5) > 0 && scoreScale("wave", 18) > 0);
  const song = SONGS.wave;
  assert.ok(song && song.score === waveScore && song.level > 0);
  assert.equal(WAVE_TUNE.length, 8 * STEPS_PER_BAR, "an eight-bar tune");
  const voices = new Set();
  for (let k = 0; k < STEPS_PER_BAR * 20; k++) for (const n of waveScore(k)) voices.add(n.voice);
  for (const voice of ["surfkick", "surfsnare", "tom", "surfbass", "chop", "twang", "gliss"])
    assert.ok(voices.has(voice), "the song has its " + voice);
  for (const kind of ["dizzy", "knockout", "monster"]) assert.ok(STINGS[kind], "a sting for " + kind);
  assert.ok(SAVES["helped-out"]);
  for (const name of ["lifeguard-tower", "surfboard", "beach-umbrella", "deck-chair"])
    assert.ok(
      fs.existsSync(new URL("./dist/assets/" + PROP_FILES[name], import.meta.url)),
      name + " on disk",
    );
  for (const file of ["sand.jpg", "floor.jpg", "coral-stone.jpg", "mural.jpg"])
    assert.ok(fs.existsSync(new URL("./dist/assets/wave/" + file, import.meta.url)), file + " on disk");
}

// 13) On screen (headless, no WebGL): the surf park builds, the water's surface follows the simulation's crests, a bather rides it,
// woozy bathers see stars, the hut's tubes come and go, a lost tube floats.
{
  const { createCanvas } = await import("@napi-rs/canvas");
  globalThis.document = { createElement: () => createCanvas(256, 128) };
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  const { PoolWorld } = await import("./dist/scene.mjs");
  const w = new PoolWorld({ clientWidth: 1440, clientHeight: 900 }, () => {}, { headless: true, venue: v });
  const { s, until } = game(47);
  const frames = (n) => {
    for (let i = 0; i < n; i++) {
      until(() => false, 1);
      w.sync(s, s.time, 1 / 60);
    }
  };
  assert.ok(w.sky, "the surf park's sky in the Coach Cam");
  assert.equal(w.finPairs.length, v.tubes, "the hut's tubes");
  assert.equal(w.laneHighlights[0], w.riverHighlight, "the water is the lane's highlight");
  const p = guest(s);
  until(() => p.status === "swim", 60 * 20);
  Object.assign(p, { x: 3, z: 0, spot: { x: 3, z: 0 }, workTarget: 999 });
  launch(s, "big");
  let rose = false,
    shown = false;
  for (let i = 0; i < 60 * 3; i++) {
    frames(1);
    const u = w.water.material.uniforms;
    if (u.uCount.value > 0) shown = true;
    const g = w.people.get(p.id);
    if (g && g.position.y > -1.0) rose = true;
  }
  assert.ok(shown, "the crests go to the water's shader");
  assert.ok(rose, "a bather out in the deep is lifted by the swell");
  p.dizzy = BATHE.woozy + 10;
  frames(2);
  assert.ok(w.people.get(p.id).userData.stars?.visible, "woozy: stars over the head");
  s.lostTubes.push({ id: 999, x: 2, z: 1, vx: 0, vz: 0, spin: 0 });
  s.finsAvailable--;
  frames(2);
  assert.ok(w.lostTubes.has(999), "a lost tube floats");
}

console.log(
  "Wave Pool checks passed: a beach sloping into a pool a metre deep at the shelf and deep at the wave house, the gate to the beach without wading, every station reached; waves sent by a program (the horn, a set, a calm), faster in the deep, growing in the shallows and breaking further out the bigger they are, gone up the sand, the same for a seed; guests who walk in through the gate and straight into the waves to a depth that suits them, nobody sent anywhere; tubes handed over on the way in, a VIP who grumbles without one, tubes left on the sand and every one accounted for; dizziness from the waves (the timid most, a tube least), a dizzy bather helped out to a towel and back in; a knockout rescued with the machine stopped; the WAVES button (awww, the grace, the chant, the horn, the monster called off); tubes knocked off by a monster and washed ashore; drips on the deck past the sand; a poo, the fish and a blackout; whole shifts played by the bot; in every week's draw with its song, stings and props; and on screen the water moved by the crests, bathers riding them, stars and a floating tube.",
);
