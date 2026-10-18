// The Rooftop Pool (17 October 2026, the creator: "the rooftop pool… it has to be epic… Marina Bay Sands… infinity pool… umbrellas
// and chairs… you get guests from opposite sides… they go into the pool and they chill… they talk to each other inside the pool…
// margaritas… a DJ set on the far right with the DJ and nice electronic music… the buildings down below… the cannonball, the kid
// with fish, the pee and poo… lots of VIPs… the Karens… we don't get swimmers in this one… some go and lay down… the water spilling
// on the floor, you have to mop… make it very, very fun").
import assert from "node:assert/strict";
import fs from "node:fs";
import { PoolSimulation, SHIFTS } from "./dist/sim.mjs";
import { VENUES } from "./dist/spatial.mjs";
import { ROOF, ROOF_BEDS, ROOF_BLOCKS, roofRoute } from "./dist/roof-plan.mjs";
import { CHILL, GUEST_KIND, nextDrop, roofServicePoint } from "./dist/rooftop.mjs";
import { POOLS, POOL_IDS, buildShift, newWeek, weekPools, scoreScale } from "./dist/week.mjs";
import { SONGS, roofScore, roofSection, STEPS_PER_BAR } from "./dist/music.mjs";
import { STINGS, SAVES } from "./dist/moments.mjs";
import { PROP_FILES } from "./dist/scene/prop-models.mjs";
import { CoachBot } from "./check-bot.mjs";

const v = VENUES.roof;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// A quiet test shift: no schedule, no incidents, no sickness, nothing on the edge unless asked.
const game = (seed = 5, level = 8, extra = {}) => {
  const bot = new CoachBot(level, seed, {
    config: {
      ...SHIFTS[level - 1],
      venue: "roof",
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
  s.roof.selfieIn = 1e9;
  s.roof.drops = [];
  s.start();
  bot.cap = 1e9;
  const until = (done, n = 6000) => {
    for (let i = 0; i < n && !done(); i++) bot.frame();
    return done();
  };
  return { bot, s, until };
};
// A guest out of a lift with a plan of our choosing, who never orders unless asked.
const guest = (s, plan = ["pool"], spec = {}) => {
  const p = s.spawn({ entrance: true, ...spec });
  Object.assign(p, { sick: false, sickKind: null, plan, planStep: 0, orderIn: 1e9 });
  return p;
};

// 1) The floor plan: the lifts face each other from the two ends; the basin's far side is the infinity edge, its gutter and the
// rail (no deck there); fourteen beds (two of them cabanas) whose foot is on the deck; a guest's walk goes round the furniture;
// every station within the coach's reach; and he can wade into the shallow water (but not into the gutter).
{
  assert.equal(v.id, "roof");
  const a = v.arrival;
  assert.ok(a.alongZ, "the lifts are in the end walls");
  for (const side of [-1, 1]) {
    for (const where of ["inside", "door", "outside"]) {
      const at = a.at(side, where);
      assert.equal(
        Math.sign(at.z),
        side,
        "side " + side + " is the " + (side < 0 ? "left" : "right") + " end",
      );
      assert.equal(at.x, ROOF.lift.x);
    }
    assert.ok(
      Math.abs(a.at(side, "inside").z) > Math.abs(a.at(side, "outside").z),
      "inside the lift is further out",
    );
    assert.ok(a.isInside(a.at(side, "inside")) && !a.isInside(a.at(side, "outside")));
    assert.equal(a.sideOf(a.at(side, "outside")), side);
    assert.ok(a.isDoorPoint(a.at(side, "door")));
  }
  // Every other venue's doors are exactly where they always were (mirrored across x).
  for (const venue of Object.values(VENUES).filter((x) => x !== v)) {
    const d = venue.arrival;
    for (const side of [-1, 1]) {
      assert.deepEqual(d.at(side, "inside"), { x: side * d.insideX, z: d.insideZ }, venue.id);
      assert.deepEqual(d.at(side, "door"), { x: side * d.doorX, z: d.doorZ }, venue.id);
      assert.deepEqual(d.at(side, "outside"), { x: side * d.outsideX, z: d.doorZ }, venue.id);
    }
  }
  assert.equal(ROOF_BEDS.length, 14);
  assert.equal(ROOF_BEDS.filter((b) => b.cabana).length, 2, "two VIP cabanas");
  for (const b of ROOF_BEDS)
    assert.ok(v.isDeck(b.foot.x, b.foot.z, 8, 0.25), "bed " + b.id + "'s foot on the deck");
  // Nothing walks or stands past the infinity edge.
  for (const x of [3.9, 4.2, 4.5]) assert.ok(!v.isDeck(x, 0, 8), "no deck beside the gutter at x=" + x);
  for (const sp of v.edgeSpots()) assert.ok(sp.x < ROOF.halfX, "no edge spot on the infinity side");
  // A walk from either lift to every bed goes round the beds, the cabanas and the pool.
  const inBlock = (p) =>
    ROOF_BLOCKS.some(
      ([x0, x1, z0, z1]) => p.x > x0 + 0.02 && p.x < x1 - 0.02 && p.z > z0 + 0.02 && p.z < z1 - 0.02,
    );
  for (const side of [-1, 1])
    for (const b of ROOF_BEDS) {
      const from = a.at(side, "outside"),
        path = [from, ...roofRoute(from, b.foot)];
      for (let i = 1; i < path.length; i++)
        for (let k = 1; k < 20; k++) {
          const t = k / 20,
            p = {
              x: path[i - 1].x + (path[i].x - path[i - 1].x) * t,
              z: path[i - 1].z + (path[i].z - path[i - 1].z) * t,
            };
          assert.ok(!inBlock(p), "the walk to bed " + b.id + " goes round the furniture");
        }
    }
  const { bot, s } = game(3);
  for (const [name, point] of Object.entries(v.stations)) {
    assert.ok(bot.walkTo(point, { reach: 1.5 }), "the coach reaches the " + name);
  }
  // Wading: into the water from the walk, slower than on the deck, and never into the gutter.
  bot.walkTo({ x: -4.4, z: 0 }, { reach: 0.3 });
  s.setMovement(1, 0);
  for (let i = 0; i < 60 * 3; i++) bot.frame();
  assert.ok(s.coach.wading, "he wades in");
  assert.ok(s.coach.x < ROOF.halfX - 0.2 && s.coach.x > 2.5, "as far as the infinity edge and no further");
  s.clearInput();
  const x0 = s.coach.x;
  s.setMovement(-1, 0);
  for (let i = 0; i < 30; i++) bot.frame();
  const water = x0 - s.coach.x;
  assert.ok(
    water > 0 && water < 7.6 * 0.6 * 0.5 + 0.3,
    "slowly in the water (" + water.toFixed(2) + " m in half a second)",
  );
  s.jump();
  bot.frame();
  assert.equal(s.coach.vy, 0, "no jumping in the water");
  for (let i = 0; i < 60 * 2; i++) bot.frame();
  s.clearInput();
  assert.ok(!s.coach.wading, "out again");
}

// 2) Nobody queues and nobody is sent: guests come up in both lifts and go to what their plan says (the water, or a sunbed), the
// ones in the water gather in little groups and chat, a VIP takes a cabana; a lane button sends nobody anywhere.
{
  const { s, until } = game(11);
  const swimmers = [0, 1, 2, 3].map(() => guest(s, ["pool"]));
  const lounger = guest(s, ["bed"]);
  const vip = guest(s, ["bed"], { vip: true });
  assert.deepEqual(new Set(s.people.map((p) => p.side)), new Set([-1, 1]), "from both lifts");
  until(
    () =>
      swimmers.every((p) => p.status === "swim") && lounger.status === "lounge" && vip.status === "lounge",
    60 * 40,
  );
  assert.ok(
    swimmers.every((p) => p.status === "swim"),
    "in the water",
  );
  assert.equal(lounger.status, "lounge", "on a sunbed");
  assert.ok(!ROOF_BEDS[lounger.bed].cabana, "a sunbed, not a cabana");
  assert.ok(ROOF_BEDS[vip.bed].cabana, "the VIP in a cabana");
  until(() => false, 60 * 6);
  const groups = new Map();
  for (const p of swimmers) groups.set(p.group, (groups.get(p.group) || 0) + 1);
  assert.ok(
    [...groups.values()].some((n) => n >= 2),
    "some of them together in a group",
  );
  assert.ok(
    swimmers.some((p) => p.chatting),
    "chatting",
  );
  for (const p of swimmers) {
    assert.ok(Math.abs(p.x) < ROOF.halfX && Math.abs(p.z) < ROOF.halfZ, "inside the basin");
    assert.ok(p.h > 80, "happy chilling");
  }
  s.select(swimmers[0].id);
  assert.equal(s.assign(0), false, "nobody is sent anywhere");
  assert.equal(GUEST_KIND.beginner, "Sunbather");
}

// 3) Margaritas: a guest orders one (in the water they wade to the near edge); the coach takes a tray of three at the bar (E) and
// serves it (E beside them): a tip, a happier guest, two on the tray left; two make a guest tipsy; an empty tray goes.
{
  const { bot, s, until } = game(13);
  const p = guest(s, ["pool"]),
    q = guest(s, ["bed"]);
  until(() => p.status === "swim" && q.status === "lounge", 60 * 40);
  p.orderIn = 0;
  p.vip = true; // (a VIP always orders)
  until(() => p.problem === "drink", 60 * 2);
  assert.equal(p.problem, "drink", "an order");
  until(() => p.x < -ROOF.halfX + 0.8, 60 * 10);
  assert.ok(p.x < -ROOF.halfX + 0.8, "over to the near edge to be served");
  bot.walkTo(v.stations.bar, { reach: 0.9 });
  assert.ok(bot.use("fetch"), "a tray at the bar");
  assert.equal(s.coach.carry, "tray");
  assert.equal(s.coach.tray, CHILL.tray);
  const before = s.score,
    mood = p.h;
  bot.walkTo(roofServicePoint(s, p), { reach: 0.4 });
  assert.ok(bot.use("deliver"), "served (E)");
  assert.equal(p.problem, null);
  assert.equal(s.score - before, CHILL.vipTip, "a VIP's tip");
  assert.ok(p.h > mood, "happier");
  assert.equal(s.coach.tray, CHILL.tray - 1);
  assert.ok(p.sipping > 0, "sipping it");
  // On a sunbed: served from its foot. Then a second margarita makes the first guest tipsy.
  q.problem = "drink";
  q.orderT = 0;
  bot.walkTo(roofServicePoint(s, q), { reach: 0.4 });
  assert.ok(bot.use("deliver"), "served on the sunbed");
  p.sipping = 0;
  p.problem = "drink";
  p.orderT = 0;
  bot.walkTo(roofServicePoint(s, p), { reach: 0.4 });
  assert.ok(bot.use("deliver"));
  assert.ok(p.tipsy, "two margaritas: tipsy");
  assert.equal(s.coach.carry, null, "the empty tray goes");
  // Kept waiting, a guest grows cross.
  const r = guest(s, ["bed"]);
  until(() => r.status === "lounge", 60 * 30);
  r.problem = "drink";
  r.orderT = 0;
  const h0 = r.h;
  until(() => false, 60 * 8);
  assert.ok(r.h < h0 - 5, "a margarita kept waiting costs mood");
}

// 4) The sunbeds: a guest getting off one leaves it messy, and nobody takes a messy bed; with none free a guest waits (and minds);
// the coach tidies one (E at its foot) and the waiting guest takes it.
{
  const { bot, s, until } = game(17);
  for (const b of s.roof.beds) if (!ROOF_BEDS[b.id].cabana) b.messy = true;
  const p = guest(s, ["bed"]);
  until(() => p.goal === "waitbed", 60 * 10);
  assert.equal(p.goal, "waitbed", "waiting for a free sunbed");
  const h0 = p.h;
  until(() => false, 60 * 3);
  assert.ok(p.h < h0, "and minding");
  const bed = s.roof.beds.find((b) => b.id === 2);
  bot.walkTo(ROOF_BEDS[bed.id].foot, { reach: 0.4 });
  const before = s.score;
  assert.ok(bot.use("tidy"), "tidy the sunbed (E)");
  assert.equal(bed.messy, false);
  assert.equal(s.score - before, CHILL.tidyPoints);
  until(() => p.status === "lounge", 60 * 20);
  assert.equal(p.status, "lounge", "the waiting guest takes it");
  // Getting off leaves it messy.
  p.workTarget = 0;
  until(() => p.status === "exit", 60 * 5);
  assert.ok(s.roof.beds[p.bed ?? bed.id].messy || bed.messy, "left messy");
}

// 5) The selfie at the edge: a guest wades to the infinity edge, climbs up on it and poses; the coach wades over and talks them
// down (E, points). Too late, and over they go into the gutter (points lost); hauled back (E) they are safe, left there they storm
// off by the service stairs.
{
  const { bot, s, until } = game(19, 8);
  const p = guest(s, ["pool"]);
  until(() => p.status === "swim", 60 * 20);
  p.workTime = 10;
  p.workTarget = 999;
  s.roof.selfieIn = 0;
  until(() => p.problem === "selfie", 60);
  assert.equal(p.problem, "selfie");
  until(() => p.selfie?.stage === "posing", 60 * 20);
  assert.ok(p.onEdge && p.x > ROOF.halfX - 0.2, "up on the knife edge");
  const before = s.score;
  bot.walkTo({ x: p.x - 0.9, z: p.z }, { reach: 0.4 });
  assert.ok(bot.use("assist"), "talked down (E)");
  assert.equal(p.problem, null);
  assert.equal(s.score - before, CHILL.stopped);
  // Overboard.
  s.roof.selfieIn = 0;
  p.workTime = 10;
  until(() => p.problem === "selfie", 60);
  until(() => p.status === "overboard", 60 * 40);
  assert.equal(p.status, "overboard", "over the edge");
  assert.ok(p.x > ROOF.halfX + 0.2 && p.x < ROOF.gutter.x1, "in the gutter");
  assert.ok(s.stats.overboard === 1);
  const at = s.score;
  bot.walkTo({ x: ROOF.halfX - 0.6, z: p.z }, { reach: 0.4 });
  assert.ok(bot.use("assist"), "hauled back (E)");
  assert.equal(p.status, "swim");
  assert.equal(s.score - at, CHILL.hauled);
  // Left in the gutter: off by the stairs, a guest lost.
  const q = guest(s, ["pool"]);
  until(() => q.status === "swim", 60 * 20);
  q.workTime = 10;
  q.workTarget = 999;
  p.workTime = 0;
  s.roof.selfieIn = 0;
  until(() => s.people.some((x) => x.status === "overboard"), 60 * 60);
  const gone = s.people.find((x) => x.status === "overboard"),
    lost = s.stats.lost;
  until(() => gone.status !== "overboard", 60 * (CHILL.stranded + 2));
  assert.equal(s.stats.lost, lost + 1, "stranded: storms off");
}

// 6) The DJ's drop: on the music's bar lines (2 s each), announced four bars ahead; on the drop everyone in the water dances and
// the water slops over the edges onto the deck; anyone up on the edge goes straight over.
{
  const s0 = new PoolSimulation(8, 23, { config: { ...SHIFTS[7], venue: "roof" } });
  assert.ok(s0.roof.drops.length >= 2, "drops all through the shift");
  for (let i = 1; i < s0.roof.drops.length; i++)
    assert.ok(s0.roof.drops[i] - s0.roof.drops[i - 1] >= CHILL.dropEvery[0], "spaced out");
  assert.ok(s0.roof.drops.every((b) => Number.isInteger(b) && b * CHILL.bar < s0.config.duration));
  const { s, until } = game(23);
  const people = [0, 1, 2, 3, 4].map(() => guest(s, ["pool"]));
  until(() => people.every((p) => p.status === "swim"), 60 * 30);
  // Gather them by the near edge, one up on the far edge posing.
  // (Waiting for a margarita keeps them by the near edge.)
  for (const p of people.slice(0, 4))
    Object.assign(p, { x: -ROOF.halfX + 0.6, workTarget: 999, problem: "drink", orderT: 0 });
  const poser = people[4];
  Object.assign(poser, {
    problem: "selfie",
    selfie: { stage: "posing", z: poser.z, t: 0, limit: 99 },
    onEdge: true,
    x: ROOF.halfX - 0.05,
    workTarget: 999,
  });
  const bar = Math.ceil((s.time + 9) / CHILL.bar);
  s.roof.drops = [bar];
  s.roof.nextDrop = 0;
  const events = [];
  const push = s.events.push;
  s.events.push = function (e) {
    events.push(e.type);
    return push.call(this, e);
  };
  until(() => s.roof.warned, 60 * 6);
  assert.ok(
    s.roof.warned && bar * CHILL.bar - s.time <= CHILL.dropWarning * CHILL.bar + 0.05,
    "announced four bars ahead",
  );
  assert.ok(s.system("roof").panel(s).title.startsWith("THE DROP IN"), "the banner counts down");
  const spots = s.wetSpots.length;
  until(() => s.roof.hype > 0, 60 * 10);
  assert.ok(events.includes("drop"), "the drop");
  assert.ok(Math.abs(s.time - bar * CHILL.bar) < 0.05, "on the bar line");
  assert.equal(poser.status, "overboard", "the one on the edge goes over");
  assert.ok(s.wetSpots.length > spots, "the water slops onto the deck");
  assert.ok(nextDrop(s) === null, "that was the last");
  s.events.push = push;
}

// 7) Closing time: a guest keeps time in hand to leave before the shift ends, and drops the rest of a plan there is no time for.
{
  const s = new PoolSimulation(8, 29, { config: { ...SHIFTS[7], venue: "roof", chaos: [], sickRate: 0 } });
  s.schedule = [];
  s.start();
  s.time = s.config.duration - 30;
  const p = s.spawn({ entrance: true });
  Object.assign(p, { plan: ["pool", "bed"], planStep: 0 });
  for (let i = 0; i < 60 * 40 && s.status === "playing"; i++) s.tick(1 / 60);
  assert.ok(p.status === "gone" || (p.status === "exit" && p.served), "gone (or on the way) by the end");
  assert.equal(p.plan.length, 1, "no time for the sunbed: straight home after the water");
}

// 8) Every incident still comes: a poo empties the water onto the walk (not into the gutter), the fish sends everyone out over
// the near edge or the ends, Carl jumps from the near side or the ends; and the same seed plays the same shift.
{
  const { s, until } = game(31, 10);
  const people = [0, 1, 2, 3, 4].map(() => guest(s, ["pool"]));
  until(() => people.every((p) => p.status === "swim"), 60 * 30);
  people[0].sick = true;
  people[0].sickKind = "poo";
  s.catastrophe(people[0]);
  until(() => people.slice(1).every((p) => p.status === "panic"), 60 * 20);
  for (const p of people.slice(1))
    assert.ok(
      p.x < -ROOF.halfX - 0.5 && v.isDeck(p.x, p.z, 10, 0),
      "waiting on the walk (" + p.x.toFixed(1) + ")",
    );
  const t = game(37, 10);
  const swimmers = [0, 1, 2, 3].map(() => guest(t.s, ["pool"]));
  t.until(() => swimmers.every((p) => p.status === "swim"), 60 * 30);
  swimmers[0].x = 2.8;
  swimmers[1].z = 9.6;
  for (const p of swimmers) t.s.startFleeing(p);
  t.until(() => swimmers.every((p) => p.fleePhase === "run"), 60 * 10);
  for (const p of swimmers) assert.ok(v.isDeck(p.x, p.z, 10, 0.1) && p.x < ROOF.halfX, "fled onto the deck");
  for (const spot of v.edgeSpots()) assert.ok(spot.x < 3, "Carl's spots: the near side and the ends");
  // The same seed, the same shift (the bot through a whole one, twice).
  const play = () => new CoachBot(9, 41, { config: { ...SHIFTS[8], venue: "roof" } }).run().s;
  const a = play(),
    b = play();
  assert.equal(a.score, b.score, "the same score");
  assert.deepEqual(a.stats, b.stats, "the same shift");
}

// 9) Whole shifts from the week, every incident in them, played by the bot: margaritas served, selfies stopped, beds tidied, the
// mop; nothing stuck, a star at least.
{
  for (const [tier, seed] of [
    [8, 3],
    [14, 9],
  ]) {
    const week = newWeek({ chapter: 2 }, 4242 + seed);
    week.pools = Array(6).fill("roof");
    week.shift = tier % 6;
    const sh = buildShift(week, "regular", []);
    assert.equal(sh.config.venue, "roof");
    assert.ok(!sh.config.star, "no Marco up here (nobody swims)");
    const bot = new CoachBot(sh.tier, seed, { config: sh.config }).run();
    const s = bot.s,
      sum = s.summary();
    assert.equal(s.status, "ended", "the shift ends");
    assert.ok(
      sum.served >= sh.config.total * 0.5,
      "most guests served (" + sum.served + "/" + sh.config.total + ")",
    );
    assert.ok(s.stats.drinks > 5, "margaritas served (" + s.stats.drinks + ")");
    assert.ok(sum.stars >= 1, "a star at least (" + s.score + " of " + sh.config.thresholds + ")");
  }
}

// 10) In every week's draw, more VIPs than elsewhere, no Marco, stars of its own; its house set (built round the drops); its stings
// and saves; its props and pictures on disk.
{
  assert.ok(POOL_IDS.includes("roof") && POOLS.roof.name === "Rooftop Pool" && POOLS.roof.icon === "🌇");
  assert.equal(POOLS.roof.vipBonus, 2, "lots of VIPs");
  assert.ok(POOLS.roof.style.noStar, "no Marco");
  assert.deepEqual(POOLS.roof.twists, { team: 0, class: 0, closure: 0 });
  let drawn = 0;
  // (Over 300 weeks: six of the pools a week, so about 6 in 13 of them; at least 3 in 10.)
  for (let seed = 1; seed <= 10; seed++)
    for (let c = 1; c <= 30; c++) if (weekPools(c, seed * 7717).includes("roof")) drawn++;
  assert.ok(drawn >= 90, "drawn into the weeks (" + drawn + " of 300)");
  assert.ok(scoreScale("roof", 5) > 0 && scoreScale("roof", 18) > 0);
  const song = SONGS.roof;
  assert.ok(song && song.score === roofScore && song.level > 0);
  const drops = [12, 28];
  assert.equal(roofSection(8, drops).part, "build");
  assert.equal(roofSection(12, drops).part, "drop");
  assert.equal(roofSection(20, drops).part, "groove");
  const voices = new Set();
  for (let k = 0; k < STEPS_PER_BAR * 32; k++)
    for (const n of roofScore(k, false, { drops })) voices.add(n.voice);
  for (const voice of [
    "kick",
    "clap",
    "open",
    "hat",
    "bass",
    "pad",
    "stab",
    "lead",
    "arp",
    "sweep",
    "impact",
    "crash",
  ])
    assert.ok(voices.has(voice), "the set has its " + voice);
  assert.equal(
    roofScore(11 * STEPS_PER_BAR + 12, false, { drops }).length,
    0,
    "silence just before the drop",
  );
  for (const kind of ["selfie", "overboard"]) assert.ok(STINGS[kind], "a sting for " + kind);
  for (const kind of ["selfie-stopped", "hauled", "margarita"]) assert.ok(SAVES[kind], "a save for " + kind);
  for (const name of v.props.filter((n) => PROP_FILES[n]))
    assert.ok(
      fs.existsSync(new URL("./dist/assets/" + PROP_FILES[name], import.meta.url)),
      name + " on disk",
    );
  for (const file of [
    "teak.jpg",
    "pool-tile.jpg",
    "stone.jpg",
    "marble.jpg",
    "skyline.jpg",
    "facade-a.jpg",
    "facade-b.jpg",
    "facade-c.jpg",
  ])
    assert.ok(fs.existsSync(new URL("./dist/assets/rooftop/" + file, import.meta.url)), file + " on disk");
}

// 11) On screen (headless, no WebGL): the roof builds with the city 185 m down (the camera sees 3 km here, and only here); a guest
// in the water stands chest-deep, one on a sunbed lies on it, the towels follow the beds, the coach wading is in the water.
{
  const { createCanvas } = await import("@napi-rs/canvas");
  globalThis.document = { createElement: () => createCanvas(256, 128) };
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  const { PoolWorld } = await import("./dist/scene.mjs");
  const w = new PoolWorld({ clientWidth: 1440, clientHeight: 900 }, () => {}, { headless: true, venue: v });
  assert.ok(w.camera.far > 2000, "the city in sight");
  assert.ok(w.sky, "the sky in the Coach Cam");
  const { s, until } = game(47);
  const frames = (n) => {
    for (let i = 0; i < n; i++) {
      until(() => false, 1);
      w.sync(s, s.time, 1 / 60);
    }
  };
  const p = guest(s, ["pool"]),
    q = guest(s, ["bed"]);
  until(() => p.status === "swim" && q.status === "lounge", 60 * 40);
  frames(3);
  const gp = w.people.get(p.id),
    gq = w.people.get(q.id);
  assert.ok(gp.position.y < -0.5, "chest-deep in the water (" + gp.position.y.toFixed(2) + ")");
  assert.ok(gq.position.y > 0, "up on the sunbed");
  const bed = s.roof.beds[q.bed];
  bed.messy = true;
  frames(1);
  assert.ok(
    w.water.material.uniforms.uRipples.value.some((r) => r.z > 0),
    "ripples round the guest in the water",
  );
  const other = new PoolWorld({ clientWidth: 1440, clientHeight: 900 }, () => {}, {
    headless: true,
    venue: VENUES.club,
  });
  assert.equal(other.camera.far, 180, "anywhere else the room is all there is");
}

console.log(
  "Rooftop Pool checks passed: two lifts facing each other from the ends (every other pool's doors where they were), an infinity edge with its gutter and nothing past it, fourteen beds with two cabanas, walks round the furniture, the coach wading in the shallow water (slowly, no jumps, never into the gutter); guests from both lifts to the water or a sunbed, chatting in groups, a VIP in a cabana, nobody sent anywhere; margaritas ordered, a tray from the bar, served by the edge or at a sunbed, tips, tipsy after two; messy sunbeds, a guest waiting for one, tidied; the selfie on the edge talked down, overboard into the gutter, hauled back or storming off; the DJ's drops on the bar lines, announced, slopping water onto the deck and tipping anyone on the edge over; closing time; a poo, the fish and Carl; the same seed the same shift; whole shifts played by the bot; in the week with more VIPs and no Marco; the house set built round the drops; stings, saves, props and pictures; and on screen the city far below, guests chest-deep and on sunbeds, ripples.",
);
