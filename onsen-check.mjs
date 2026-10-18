// The Mountain Hot Springs (18 October 2026, the creator: "a snowy kind of natural hot springs in the mountains… several hot springs
// that the coach waters can assign guests to… the longer they wait outside of the natural hot springs, the colder they start to
// get… a self-hugging pose… the snow monkeys… they enter from random places. Of course, Coach Waters has to stop them before
// entering… if they enter, people get nervous and they panic… minus points if a monkey manages to enter… it's icy on the deck, so
// the coach slides… the same incidents").
import assert from "node:assert/strict";
import fs from "node:fs";
import { PoolSimulation, SHIFTS } from "./dist/sim.mjs";
import { VENUES } from "./dist/spatial.mjs";
import {
  SPRINGS,
  ONSEN,
  BOULDERS,
  springSteps,
  springSeats,
  springLocal,
  springAt,
  onsenWalkable,
  onsenRoute,
  onsenEdgeSpots,
  ONSEN_WATER,
} from "./dist/onsen-plan.mjs";
import { SOAK, MONKEY, springGuests, springFull, monkeyIn, shooMonkey, SnowMonkeys } from "./dist/onsen.mjs";
import { POOLS, POOL_IDS, buildShift, newWeek, weekPools, scoreScale } from "./dist/week.mjs";
import { SONGS } from "./dist/music.mjs";
import { STINGS, SAVES } from "./dist/moments.mjs";
import { PROP_FILES } from "./dist/scene/prop-models.mjs";
import { CoachBot } from "./check-bot.mjs";
import { go } from "./check-helpers.mjs";

const v = VENUES.onsen;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// A quiet test shift: no schedule, no incidents, no sickness, no monkeys unless asked.
const game = (seed = 5, level = 8, extra = {}) => {
  const bot = new CoachBot(level, seed, {
    config: {
      ...SHIFTS[level - 1],
      venue: "onsen",
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
  s.onsen.nextMonkey = Infinity;
  bot.cap = 1e9;
  const until = (done, n = 6000) => {
    for (let i = 0; i < n && !done(); i++) {
      s.tick(1 / 60);
      s.events.length = 0;
    }
    return done();
  };
  return { bot, s, until };
};
// A guest out of the bathhouse and waiting in the snow.
const waiting = (s, until, extra = {}) => {
  const p = s.spawn({ entrance: true, type: "intermediate", sick: false, ...extra });
  assert.ok(
    until(() => p.status === "queue", 60 * 20),
    "out of the bathhouse and waiting",
  );
  return p;
};
const send = (s, p, k) => {
  s.select(p.id);
  return s.assign(k);
};
// The next monkey, now (its stream picks where it comes from and which spring it wants).
const monkey = (s, until) => {
  s.onsen.nextMonkey = 0;
  until(() => s.onsen.monkeys.some((m) => m.stage === "approach"), 5);
  s.onsen.nextMonkey = Infinity;
  return s.onsen.monkeys[s.onsen.monkeys.length - 1];
};

// 1) The terrace: four springs of different sizes, each with its steps on the walkable rim and as many seats as it holds, in the
// water and apart; boulders round them; a walk from the bathhouse door to every spring's steps and every station.
{
  assert.equal(v.name, "Mountain Hot Springs");
  assert.equal(SPRINGS.length, 4);
  assert.equal(v.lanes.length, 4, "SPRING 1 to 4");
  assert.deepEqual(
    SPRINGS.map((s) => s.cap),
    [5, 4, 5, 3],
  );
  for (const s of SPRINGS) {
    const steps = springSteps(s);
    assert.ok(onsenWalkable(steps.deck.x, steps.deck.z, 0.3), "spring " + (s.id + 1) + "'s steps on the rim");
    assert.ok(springAt(steps.water.x, steps.water.z, 0.3) === s, "its first step in the water");
    const seats = springSeats(s);
    assert.equal(seats.length, s.cap);
    for (const seat of seats) {
      assert.ok(springLocal(s, seat.x, seat.z).inside > 0.4, "a seat in the water");
      for (const other of seats) if (other !== seat) assert.ok(distance(seat, other) > 1.2, "seats apart");
    }
    const door = v.arrival.at(-1, "inside"),
      path = onsenRoute(door, steps.deck);
    let at = door;
    for (const q of path) {
      const n = Math.ceil(distance(at, q) / 0.2);
      for (let i = 1; i <= n; i++) {
        const x = at.x + ((q.x - at.x) * i) / n,
          z = at.z + ((q.z - at.z) * i) / n;
        assert.ok(
          springAt(x, z, -0.2) === null || distance({ x, z }, steps.deck) < 0.4,
          "the walk keeps out of the water",
        );
      }
      at = q;
    }
  }
  for (let i = 0; i < SPRINGS.length; i++)
    for (let j = i + 1; j < SPRINGS.length; j++)
      assert.ok(
        distance(SPRINGS[i], SPRINGS[j]) > SPRINGS[i].r + SPRINGS[j].r + 2.5,
        "springs apart, a walk between",
      );
  assert.ok(BOULDERS.length >= 20, "lots of rocks");
  for (const name of ["fins", "chlorine", "relief"])
    assert.ok(v.isDeck(v.stations[name].x + 0.9, v.stations[name].z, 8, 0.3), name + " station on the deck");
  assert.ok(onsenEdgeSpots().length >= 25, "places at the edges for the incidents");
  assert.equal(ONSEN.forest.length, 3, "forest round three sides for the monkeys");
  assert.ok(v.ice && v.ice.grip < 20 && v.ice.glide < 10, "an icy deck");
}

// 2) The cold: a guest waiting in the snow grows colder by the second; past the bite their mood falls faster than a guest in a
// warm queue's; in the hot water they warm up again.
{
  const { s, until } = game(3);
  const p = waiting(s, until);
  assert.ok((p.cold || 0) < 0.05, "warm out of the bathhouse");
  const h0 = p.h;
  until(() => false, 60 * 6);
  assert.ok(p.cold > 0.2 && p.cold < 0.3, "colder by the second (" + p.cold.toFixed(2) + ")");
  const early = h0 - p.h;
  until(() => p.cold > 0.8, 60 * 30);
  const h1 = p.h;
  until(() => false, 60 * 3);
  assert.ok((h1 - p.h) / 3 > early / 6 + 0.8, "the cold bites: their mood falls faster");
  assert.ok(p.coldPenalty > 0, "the penalty is kept");
  // Into a spring.
  assert.ok(send(s, p, 0));
  until(() => p.status === "swim", 60 * 30);
  const c0 = p.cold;
  until(() => false, 60 * 4);
  assert.ok(
    p.cold < c0 - 0.3,
    "warming up in the hot water (" + c0.toFixed(2) + " → " + p.cold.toFixed(2) + ")",
  );
}

// 3) SPRING k: the guest walks to that spring, steps down into it by its steps, wades to a free seat and sits in it, faces the
// middle, soaks, then climbs out by the steps and goes home (served). A full spring refuses another guest; a settled guest stays
// put.
{
  const { s, until } = game(7);
  const k = 3,
    S = SPRINGS[k],
    guests = [];
  for (let i = 0; i < S.cap; i++) {
    const p = waiting(s, until);
    assert.ok(send(s, p, k), "a seat in spring " + (k + 1));
    guests.push(p);
  }
  assert.ok(springFull(s, k), "full");
  const extra = waiting(s, until);
  assert.equal(send(s, extra, k), false, "a full spring refuses another");
  assert.equal(extra.status, "queue");
  assert.ok(send(s, extra, 0), "another spring takes them");
  const p = guests[0];
  const stages = new Set();
  until(() => {
    if (p.onsenStage) stages.add(p.onsenStage);
    return guests.every((q) => q.status === "swim");
  }, 60 * 60);
  assert.deepEqual([...stages], ["walk", "step", "wade"], "walk, step down, wade");
  assert.equal(new Set(guests.map((q) => q.seat)).size, S.cap, "a seat each");
  for (const q of guests) {
    const seat = springSeats(S)[q.seat];
    assert.ok(distance(q, seat) < 0.05, "sitting in the seat");
    assert.ok(springLocal(S, q.x, q.z).inside > 0.4, "in the water");
    assert.ok(Math.abs(q.angle - seat.angle) < 0.01, "facing the middle");
  }
  s.select(p.id);
  assert.equal(s.assign(0), false, "settled: they stay put");
  const served = s.stats.served;
  assert.ok(
    until(() => p.status === "gone", 60 * 80),
    "home after the soak",
  );
  assert.ok(s.stats.served > served, "served");
  assert.ok(p.workTime >= SOAK.soak[0] - 0.1, "a proper soak (" + p.workTime.toFixed(1) + " s)");
  // Late in a shift a soak is cut to fit.
  const late = game(9, 8, { duration: 60 });
  const q = waiting(late.s, late.until);
  late.until(() => late.s.time > 30, 60 * 40);
  send(late.s, q, 1);
  late.until(() => late.s.status === "ended" || q.status === "gone", 60 * 60);
  assert.equal(q.status, "gone", "out and home before closing");
}

// 4) The snow monkeys: one comes out of the forest at the terrace's edge and makes for a spring on all fours, stopping now and
// then. The coach running into it shoos it back into the woods (+40, a save); one he does not meet hops in (−50) and sits in the
// water, and everyone in that spring panics (their mood falls fast) until he shoos it out from the rim (E, +25) or wading up to
// it; the same seed sends the same monkeys.
{
  // Shooed on the deck by running into it.
  {
    const { s, until } = game(11);
    const m = monkey(s, until);
    assert.ok(
      ONSEN.forest.some((e) =>
        Math.abs(e.from.x - e.to.x) < 0.01 ? Math.abs(m.x - e.from.x) < 0.5 : Math.abs(m.z - e.from.z) < 0.5,
      ),
      "out of the forest (" + m.x.toFixed(1) + ", " + m.z.toFixed(1) + ")",
    );
    assert.ok(m.spring >= 0 && m.spring < 4, "it wants a spring");
    const d0 = distance(m, m.rim);
    until(() => false, 60 * 3);
    assert.ok(distance(m, m.rim) < d0 - 1.2, "on its way there");
    const score = s.score;
    s.coach.x = m.x + 0.4;
    s.coach.z = m.z;
    until(() => m.stage === "flee", 3);
    assert.equal(m.stage, "flee", "shooed");
    assert.equal(s.score, score + MONKEY.shooed, "+" + MONKEY.shooed);
    assert.ok(
      until(() => m.stage === "gone", 60 * 20),
      "back into the woods",
    );
  }
  // In the water: −50, panic, shooed out from the rim.
  {
    const { s, until } = game(13);
    const k = 0;
    const p = waiting(s, until);
    send(s, p, k);
    until(() => p.status === "swim", 60 * 30);
    let m = monkey(s, until);
    for (let tries = 0; m.spring !== k && tries < 20; tries++) {
      m.stage = "gone";
      m = monkey(s, until);
    }
    assert.equal(m.spring, k, "a monkey for spring 1");
    s.coach.x = 12;
    s.coach.z = -13;
    const score = s.score;
    assert.ok(
      until(() => m.stage === "soak", 60 * 60),
      "it gets there and hops in",
    );
    assert.equal(monkeyIn(s, k), m);
    assert.ok(s.score <= score - MONKEY.inCost, "−" + MONKEY.inCost);
    assert.ok(springLocal(SPRINGS[k], m.x, m.z).inside > 0.4, "sitting in the water");
    const h = p.h;
    until(() => false, 60 * 2);
    assert.ok(p.monkeyScare, "the guests panic");
    assert.ok(h - p.h > SOAK.fear * 1.5, "their mood falls fast");
    const alerts = [];
    SnowMonkeys.alert(s, alerts);
    assert.ok(
      alerts.some((a) => a.kind === "monkey-in"),
      "the alert says so",
    );
    assert.ok(SnowMonkeys.panel(s)?.title.includes("SPRING 1"), "the banner too");
    // The coach at the rim beside it: E.
    s.coach.x = m.rim.x;
    s.coach.z = m.rim.z;
    s.coach.vx = s.coach.vz = 0;
    const option = s.nearestInteraction();
    assert.equal(option?.kind, "assist", "E: shoo it out");
    const before = s.score;
    option.run();
    until(() => m.stage !== "soak", 60 * 2);
    assert.equal(m.stage, "flee", "out of the water and away");
    assert.equal(s.score, before + MONKEY.outPoints, "+" + MONKEY.outPoints);
    until(() => false, 30);
    assert.ok(!p.monkeyScare, "calm again");
  }
  // Wading up to one shoos it too.
  {
    const { s, until } = game(17);
    const m = monkey(s, until);
    Object.assign(m, { stage: "soak", inSpring: m.spring, x: m.water.x, z: m.water.z, moving: false });
    const S = SPRINGS[m.spring],
      steps = springSteps(S);
    s.coach.x = steps.water.x;
    s.coach.z = steps.water.z;
    until(() => false, 2);
    assert.ok(s.coach.wading, "wading in the spring");
    go(s, m.x, m.z, 600);
    assert.equal(m.stage === "flee" || m.stage === "gone", true, "shooed by wading up to it");
  }
  // More of them later in a run, never two for one spring, the same seed the same monkeys.
  const run = (level, seed) => {
    const { s, until } = game(seed, level, { duration: 240 });
    s.onsen.nextMonkey = 2;
    const seen = new Set();
    let most = 0;
    for (let f = 0; f < 60 * 200; f++) {
      until(() => false, 1);
      // (Every monkey met at once, so the next can come.)
      for (const m of s.onsen.monkeys) if (m.stage === "approach" && m.t > 3) shooMonkey(s, m);
      const live = s.onsen.monkeys.filter((m) => m.stage !== "gone" && m.stage !== "flee");
      const springs = live.map((m) => m.spring);
      assert.equal(new Set(springs).size, springs.length, "never two for one spring");
      most = Math.max(most, live.length);
      s.onsen.monkeys.forEach((m) => seen.add(m.id + ":" + m.spring + ":" + m.x.toFixed(2)));
    }
    return { count: s.stats.monkeys || 0, seen: [...seen].join() };
  };
  const easy = run(2, 5),
    hard = run(19, 5);
  assert.ok(hard.count > easy.count, "more monkeys later (" + easy.count + " → " + hard.count + ")");
  assert.equal(run(2, 5).seen, easy.seen, "the same seed, the same monkeys");
}

// 5) The ice: on the terrace the coach picks up speed slowly, turns wide and slides on when he lets go (sliding, for the IceSlide
// clip); a pair of shoes on a normal deck stops at once. In a spring he wades, slower, and the ice has no say.
{
  const { s, until } = game(19);
  const c = s.coach;
  Object.assign(c, { x: -12, z: 3, vx: 0, vz: 0 });
  s.setMovement(1, 0);
  until(() => false, 20);
  assert.ok(c.vx > 2.5 && c.vx < 5, "picks up speed slowly (" + c.vx.toFixed(2) + " m/s after 1/3 s)");
  until(() => false, 40);
  assert.ok(c.onIce && !c.sliding, "skating while he pushes on");
  s.setMovement(0, 0);
  const x0 = c.x;
  until(() => false, 8);
  assert.ok(c.sliding, "sliding when he lets go");
  until(() => Math.hypot(c.vx, c.vz) < 0.05, 300);
  const slide = c.x - x0;
  assert.ok(slide > 3, "slides on (" + slide.toFixed(2) + " m)");
  // The same at the club: a step at most.
  const club = new PoolSimulation(8, 19, { config: { ...SHIFTS[7], venue: "club", chaos: [], twist: [] } });
  club.start();
  const k = club.coach;
  Object.assign(k, { x: -6, z: -4, vx: 0, vz: 0 });
  club.setMovement(0, 1);
  for (let i = 0; i < 60; i++) club.tick(1 / 60);
  club.setMovement(0, 0);
  const z0 = k.z;
  for (let i = 0; i < 60; i++) club.tick(1 / 60);
  assert.ok(k.z - z0 < 0.6, "the club's deck is not ice (" + (k.z - z0).toFixed(2) + " m)");
  // A turn on the ice skids.
  Object.assign(c, { x: -12, z: 0, vx: 7, vz: 0 });
  s.setMovement(0, 1);
  until(() => false, 3);
  assert.ok(c.sliding, "skidding round a turn");
  // Wading: in a spring, at half speed, not on the ice.
  const steps = springSteps(SPRINGS[0]);
  Object.assign(c, { x: steps.water.x, z: steps.water.z, vx: 0, vz: 0 });
  s.setMovement(0, 1);
  until(() => false, 30);
  assert.ok(c.wading && !c.onIce, "wading");
  assert.ok(Math.hypot(c.vx, c.vz) < 4.2, "slower in the water");
  s.clearInput();
}

// 6) The incidents at the springs, each in a shift of its own, met by the bot: the fish in a spring caught with the net, the
// cannonball man stopped, the dog led out, Karen calmed, the lights back; a tummy ache sent home (or a floater: the springs
// evacuated, skimmed, reopened); nothing left stuck at closing.
{
  for (const kind of ["fish", "carl", "dog", "karen", "outage"]) {
    const bot = new CoachBot(12, 5, {
      config: { ...SHIFTS[11], venue: "onsen", chaos: [{ kinds: [kind], window: [15, 25] }], twist: [] },
    });
    const s = bot.s;
    const seen = new Set();
    const emit = s.emit.bind(s);
    s.emit = (name, data) => {
      seen.add(name);
      return emit(name, data);
    };
    bot.run();
    assert.equal(s.status, "ended", kind + ": the shift ends");
    assert.ok(seen.has("chaos"), kind + " came");
    assert.ok(
      !s.fish && !s.carl && !s.dog && !s.karen && !(s.outage && s.outage.stage),
      kind + ": dealt with",
    );
    assert.ok(!s.cleanup && !s.closed, kind + ": the springs open");
    assert.ok(
      s.summary().stars >= 1,
      kind + ": a star (" + Math.round(s.score) + " of " + s.config.thresholds + ")",
    );
  }
  // The fish loose in a spring, the reactive coach: in with the net and out again.
  {
    const bot = new CoachBot(12, 3, {
      proactive: false,
      config: { ...SHIFTS[11], venue: "onsen", chaos: [{ kinds: ["fish"], window: [15, 25] }], twist: [] },
    });
    const s = bot.s;
    let inSpring = false,
      caught = false;
    const emit = s.emit.bind(s);
    s.emit = (name, data) => {
      if (name === "fish-dumped") inSpring = !!springAt(s.fish.x, s.fish.z, 0.2);
      if (name === "fish-caught") caught = true;
      return emit(name, data);
    };
    bot.run();
    assert.ok(inSpring, "the fish is tipped into a spring");
    assert.ok(caught, "and caught in it");
    assert.ok(!s.coach.swimming, "the coach out again");
  }
  // A floater: everyone out of the springs, skimmed, reopened, and back in.
  {
    const { s, until, bot } = game(23);
    const p = waiting(s, until);
    send(s, p, 2);
    until(() => p.status === "swim", 60 * 30);
    p.sickKind = "poo";
    s.catastrophe(p);
    assert.ok(s.cleanup, "an accident in a spring");
    assert.ok(springAt(s.cleanup.x, s.cleanup.z, 0) !== null, "the floater in the spring's water");
    until(() => s.people.every((q) => q.status !== "swim"), 60 * 10);
    assert.ok(
      s.people.every((q) => q.status !== "swim"),
      "everyone out",
    );
    // The skimmer from its rack, the floater scooped from the rim of its spring, the bin, the rack, then the water care.
    const San = v.sanitation;
    go(s, San.rack.x + 0.8, San.rack.z);
    assert.ok(s.fetch("skimmer") || s.interact(), "the skimmer");
    assert.equal(s.coach.carry, "skimmer");
    for (let tries = 0; tries < 6 && s.cleanup.stage === "floating"; tries++) {
      const rim = ONSEN_WATER.bank(s.cleanup.x, s.cleanup.z, { outside: 0.55 }).deck;
      go(s, rim.x, rim.z);
      until(() => s.canInteract(), 60);
      s.scoop();
      until(() => false, 40);
    }
    assert.equal(s.cleanup.stage, "caught", "scooped from the rim");
    go(s, San.bin.x + 0.9, San.bin.z);
    assert.ok(s.disposeWaste(), "into the bin");
    go(s, San.rack.x + 0.8, San.rack.z);
    assert.ok(s.returnItem(), "the skimmer hung up");
    for (let doses = 0; doses < 4 && s.cleanup; doses++) {
      go(s, v.stations.chlorine.x + 0.9, v.stations.chlorine.z);
      assert.ok(s.fetch("chlorine"), "the water care");
      const rim = ONSEN_WATER.bank(SPRINGS[2].x, SPRINGS[2].z - 1, { outside: 0.55 }).deck;
      go(s, rim.x, rim.z);
      until(() => s.canInteract(), 60);
      assert.ok(s.deliverWater(2), "a dose into the spring");
      until(() => false, 30);
    }
    until(() => !s.cleanup && !s.closed, 60 * 10);
    assert.ok(!s.cleanup && !s.closed, "skimmed and reopened");
    assert.ok(
      until(() => p.status === "swim" || p.status === "gone", 60 * 40),
      "back in (or home)",
    );
  }
}

// 7) Whole shifts from the week, every incident in them, played by the bot: guests sent to springs, monkeys met, nobody left in
// the cold, a star at least; the same seed, the same shift.
{
  for (const [tier, seed] of [
    [6, 3],
    [14, 9],
  ]) {
    const week = newWeek({ chapter: 2 }, 6161 + seed);
    week.pools = Array(6).fill("onsen");
    week.shift = tier % 6;
    const sh = buildShift(week, "regular", ["fish", "carl", "dog", "karen", "outage"]);
    assert.equal(sh.config.venue, "onsen");
    const bot = new CoachBot(sh.tier, seed, { config: sh.config }).run();
    const s = bot.s,
      sum = s.summary();
    assert.equal(s.status, "ended", "the shift ends");
    assert.ok(
      sum.served >= sh.config.total * 0.6,
      "guests served (" + sum.served + "/" + sh.config.total + ")",
    );
    assert.ok((s.stats.monkeys || 0) >= 2, "monkeys met (" + s.stats.monkeys + ")");
    assert.ok((s.stats.monkeysIn || 0) <= 1, "hardly any in the water (" + (s.stats.monkeysIn || 0) + ")");
    assert.ok(
      sum.stars >= 1,
      "a star at least (" + Math.round(s.score) + " of " + sh.config.thresholds + ")",
    );
  }
  const play = () => new CoachBot(9, 41, { config: { ...SHIFTS[8], venue: "onsen" } }).run().s;
  const a = play(),
    b = play();
  assert.equal(a.score, b.score, "the same score");
  assert.deepEqual(a.stats, b.stats, "the same shift");
}

// 8) In the week's draw like every pool; Marco comes for a soak; its song, stings and saves; its props and pictures on disk.
{
  assert.ok(
    POOL_IDS.includes("onsen") && POOLS.onsen.name === "Mountain Hot Springs" && POOLS.onsen.icon === "♨️",
  );
  assert.ok(!POOLS.onsen.style.noStar, "Marco comes here too");
  let drawn = 0;
  // (Over 300 weeks: six of the pools a week, so about 6 in 13 of them; at least 3 in 10.)
  for (let seed = 1; seed <= 10; seed++)
    for (let c = 1; c <= 30; c++) if (weekPools(c, seed * 7717).includes("onsen")) drawn++;
  assert.ok(drawn >= 90, "drawn into the weeks (" + drawn + " of 300)");
  assert.ok(scoreScale("onsen", 5) > 1 && scoreScale("onsen", 18) > 0);
  assert.ok(SONGS.onsen && SONGS.onsen.level > 0, "a song of its own");
  assert.ok(STINGS["monkey-in"], "a sting for a monkey in the water");
  assert.ok(SAVES["monkey-shooed"] && SAVES["monkey-out"], "saves for shooing them");
  for (const name of v.props.filter((n) => PROP_FILES[n]))
    assert.ok(
      fs.existsSync(new URL("./dist/assets/" + PROP_FILES[name], import.meta.url)),
      name + " on disk",
    );
  for (const file of [
    "snow.jpg",
    "rock.jpg",
    "stone-path.jpg",
    "wood.jpg",
    "pool-floor.jpg",
    "mountains.jpg",
    "noren.jpg",
  ])
    assert.ok(fs.existsSync(new URL("./dist/assets/onsen/" + file, import.meta.url)), file + " on disk");
}

// 9) On screen (headless, no WebGL): the terrace builds with its four springs (their own highlights to click and glow), the water
// takes the game's uniforms, a guest soaking sits in it to the shoulders, a cold one in the queue hugs themselves, and a monkey in a
// spring is drawn up to its chin and gone once it has fled.
{
  const { createCanvas } = await import("@napi-rs/canvas");
  globalThis.document = { createElement: () => createCanvas(256, 128) };
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  const { PoolWorld } = await import("./dist/scene.mjs");
  const w = new PoolWorld({ clientWidth: 1440, clientHeight: 900 }, () => {}, { headless: true, venue: v });
  assert.equal(w.laneHighlights.length, 4, "a highlight for each spring");
  assert.equal(w.laneRims.length, 4);
  assert.ok(
    w.water.material.uniforms.uDirty && w.water.material.uniforms.uLight,
    "the water takes the game's uniforms",
  );
  assert.equal(
    w.clickables.filter((c) => c.userData.kind === "lane").length,
    4,
    "click a spring to send a guest there",
  );
  const { s, until } = game(31);
  const frames = (n) => {
    for (let i = 0; i < n; i++) {
      until(() => false, 1);
      w.sync(s, s.time, 1 / 60);
    }
  };
  const p = waiting(s, until),
    cold = waiting(s, until);
  send(s, p, 0);
  until(() => p.status === "swim", 60 * 30);
  cold.cold = 0.9;
  frames(90);
  const gp = w.people.get(p.id);
  assert.ok(gp.position.y < -1.2, "sitting in the water to the shoulders (" + gp.position.y.toFixed(2) + ")");
  assert.ok(w.people.get(cold.id).userData.coldHug, "the cold guest hugs themselves");
  const m = monkey(s, until);
  Object.assign(m, { stage: "soak", inSpring: m.spring, x: m.water.x, z: m.water.z, moving: false });
  frames(3);
  const drawn = [...w.scene.children].find((o) => o.userData?.stand && Math.abs(o.position.x - m.x) < 1e-6);
  assert.ok(drawn, "the monkey is drawn");
  assert.ok(
    drawn.position.y < -0.3 && drawn.position.y > -0.6,
    "in the water to its chin (" + drawn.position.y.toFixed(2) + ")",
  );
  m.stage = "gone";
  frames(2);
  assert.ok(!drawn.parent, "gone when it has gone");
}

console.log(
  "Mountain Hot Springs checks passed: four springs of their own sizes (5, 4, 5 and 3 seats) with steps on the rim, seats in the water and walks between round the boulders; guests grow cold waiting in the snow, and the cold bites; SPRING 1–4 sends them to walk, step down, wade to a seat and soak, a full spring refuses, a settled guest stays put, a late soak is cut to fit; snow monkeys out of the forest making for a spring, shooed by running into them (+40), in the water (−50) panicking the guests until shooed out from the rim (+25) or by wading, more of them later, never two for a spring, seeded; the coach skates and slides on the ice and wades in the springs; every incident met in a spring; whole shifts played by the bot; in the week with its song, stings, saves, props and pictures; on screen the springs, the water, guests to the shoulders, the cold hug and a monkey to its chin.",
);
