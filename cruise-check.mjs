// The Cruise Ship (18 October 2026, the creator: "the cruise venue… this is a physics level because we can actually see the ship.
// The ship is moving left and right, not in a rhythmic way, but spontaneously. Sometimes it stays without movement, but then it
// swings to one side. All of the furniture on top, and even the people on deck running or waiting, start to go to the left if the
// ship leans to the left… a multi-use pool. It has two lanes on one half, and the other half is free. People go there and chat…
// the same mechanics of the infinity pool… the same incidents. But right here, the catch is the physics left and right").
import assert from "node:assert/strict";
import fs from "node:fs";
import { PoolSimulation, SHIFTS } from "./dist/sim.mjs";
import { VENUES } from "./dist/spatial.mjs";
import {
  CRUISE,
  LOUNGERS,
  CRUISE_BLOCKS,
  CRUISE_CHILL,
  cruiseRoute,
  loungerSpot,
} from "./dist/cruise-plan.mjs";
import { SHIP, slide, straightenRow, adriftRowNear, helpOut, ShipDeck } from "./dist/ship.mjs";
import { POOLS, POOL_IDS, buildShift, newWeek, weekPools, scoreScale } from "./dist/week.mjs";
import { SONGS } from "./dist/music.mjs";
import { STINGS, SAVES } from "./dist/moments.mjs";
import { PROP_FILES } from "./dist/scene/prop-models.mjs";
import { CoachBot } from "./check-bot.mjs";

const v = VENUES.cruise;
const DEG = Math.PI / 180;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const inBox = (p, [x0, x1, z0, z1]) => p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1;
// A quiet test shift: no schedule, no incidents, no sickness; the ship still unless asked.
const game = (seed = 5, level = 8, extra = {}) => {
  const bot = new CoachBot(level, seed, {
    config: {
      ...SHIFTS[level - 1],
      venue: "cruise",
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
  bot.cap = 1e9;
  const until = (done, n = 6000) => {
    for (let i = 0; i < n && !done(); i++) bot.frame();
    return done();
  };
  return { bot, s, until };
};
// Hold the ship over at `deg` degrees (+: starboard, +z, down) for as long as the test needs.
const hold = (s, deg) =>
  Object.assign(s.ship, { phase: "hold", to: deg * DEG, angle: deg * DEG, t: 0, dur: 1e9, big: true });
const level = (s) => Object.assign(s.ship, { phase: "calm", angle: 0, t: 0, dur: 1e9 });

// 1) The deck: the pool across it (two lanes in the near half, free water past the rope), three rows of eight loungers whose guests
// step up from the deck, walks round everything, the stairway lobbies at the left end, every station on the deck.
{
  assert.equal(v.id, "cruise");
  assert.equal(v.lanes.length, 2, "two lap lanes");
  assert.ok(v.chill === CRUISE_CHILL, "the free half: the Rooftop Pool's chilling");
  assert.ok(CRUISE.free.x0 >= CRUISE.halfX, "the free water is past the lanes");
  assert.equal(LOUNGERS.length, 24);
  for (const l of LOUNGERS) {
    const spot = loungerSpot(null, l.id);
    assert.equal(spot.z, l.home, "a lounger starts at home");
    assert.ok(
      v.isDeck(spot.foot.x, spot.foot.z, 8, 0.2),
      "lounger " + l.id + "'s guest steps up from the deck",
    );
  }
  const D = CRUISE.deck;
  for (const [name, at] of Object.entries(v.stations))
    assert.ok(
      at.x > D.minX && at.x < D.maxX && Math.abs(at.z) < D.maxZ,
      "the " + name + " station is on the deck",
    );
  for (const side of [-1, 1]) {
    const out = v.arrival.at(side, "outside");
    assert.ok(out.z < -12, "the lobbies are at the left end");
    assert.ok(v.isDeck(out.x, out.z, 8, 0.25), "out of a lobby onto the deck");
  }
  // A walk from the left lobby to the far row of loungers goes round the pool and never through a block.
  const from = v.arrival.at(-1, "outside"),
    to = loungerSpot(null, 20).foot;
  const path = cruiseRoute(from, to);
  let at = from;
  for (const step of path) {
    for (let k = 1; k <= 20; k++) {
      const q = { x: at.x + ((step.x - at.x) * k) / 20, z: at.z + ((step.z - at.z) * k) / 20 };
      for (const box of CRUISE_BLOCKS)
        if (inBox(q, box) && !inBox(from, box) && !inBox(to, box))
          assert.fail("the walk cuts through a block at " + q.x + "," + q.z);
    }
    at = step;
  }
  assert.ok(distance(at, to) < 1e-6, "and arrives");
}

// 2) Its guests: half come to chill (the free water or a lounger, served margaritas from the Lido Bar), half to swim laps; Marco
// always swims.
{
  const { s } = game(11);
  let chill = 0,
    swim = 0;
  for (let i = 0; i < 80; i++) {
    const p = s.spawn({ entrance: true });
    if (p.chill) {
      chill++;
      assert.equal(p.lane, null, "a chilling guest has no lane");
    } else swim++;
  }
  assert.ok(chill > 20 && swim > 20, "a mix (" + chill + " chilling, " + swim + " swimming)");
  const star = s.spawn({ entrance: true, star: true });
  assert.ok(!star.chill, "Marco swims");
}

// 3) The roll: never a rhythm. Calm spells, then swells of different sizes and lengths to either side, the big ones announced; a
// harder level rolls further; the same seed rolls the same way.
{
  const roll = (seed, lvl) => {
    const { s } = game(seed, lvl);
    const out = { angles: [], warnings: 0, rolls: [] };
    for (let i = 0; i < 60 * 240; i++) {
      s.tick(1 / 60);
      for (const e of s.events) {
        if (e.type === "swell-warning") out.warnings++;
        if (e.type === "roll") out.rolls.push({ ...e, t: s.time });
      }
      s.events.length = 0;
      if (i % 6 === 0) out.angles.push(s.ship.angle / DEG);
    }
    return out;
  };
  const a = roll(7, 8),
    b = roll(7, 8),
    c = roll(8, 8),
    hard = roll(7, 18);
  assert.deepEqual(a.angles, b.angles, "the same seed rolls the same");
  assert.notDeepEqual(a.angles, c.angles, "another seed rolls another way");
  const max = (r) => Math.max(...r.angles.map(Math.abs));
  assert.ok(max(a) > 7 && max(a) < 16, "a big lean (" + max(a).toFixed(1) + "°)");
  assert.ok(max(hard) > max(a), "rougher seas later in the run");
  assert.ok(a.angles.some((x) => x > 3) && a.angles.some((x) => x < -3), "to both sides");
  assert.ok(a.warnings > 0, "the big swells are announced");
  // Calm spells: stretches of over five seconds within a degree of level.
  let run = 0,
    calm = 0;
  for (const x of a.angles) {
    run = Math.abs(x) < 1 ? run + 1 : 0;
    if (run === 50) calm++;
  }
  assert.ok(calm >= 2, "it lies still for a while now and then (" + calm + ")");
  // Not a rhythm: the gaps between swells differ.
  const gaps = new Set(a.rolls.slice(1).map((r, i) => Math.round(r.t - a.rolls[i].t)));
  assert.ok(a.rolls.length >= 6, "swell after swell (" + a.rolls.length + ")");
  assert.ok(gaps.size >= 4, "at uneven times (" + [...gaps].join(", ") + " s)");
}

// 4) Everything loose slides downhill: someone walking on the deck, the coach (his own walk fights it), the loungers (they stay
// put in a gentle lean and pile up at the row's low end); the slide grows with the lean.
{
  assert.equal(slide({ ship: { angle: 2 * DEG } }), 0, "nothing slides in a gentle lean");
  assert.ok(
    slide({ ship: { angle: 9 * DEG } }) > 0.4 && slide({ ship: { angle: -9 * DEG } }) < -0.4,
    "both ways",
  );
  assert.equal(slide({ ship: { angle: 20 * DEG } }), 1);
  const { s, until } = game(13);
  level(s);
  const c = s.coach;
  c.x = -6;
  c.z = 0;
  hold(s, 10);
  until(() => false, 60);
  assert.ok(c.z > 0.6, "the coach slides to starboard (" + c.z.toFixed(2) + ")");
  hold(s, -10);
  const z0 = c.z;
  until(() => false, 60);
  assert.ok(c.z < z0 - 0.6, "and back to port");
  // The loungers: still at 4°, sliding at 10°, adrift, bunched at the low end (never through each other or off the row).
  level(s);
  s.ship.loungers.forEach((L, i) => ((L.z = LOUNGERS[i].home), (L.vz = 0)));
  hold(s, 4);
  until(() => false, 120);
  assert.ok(
    s.ship.loungers.every((L, i) => Math.abs(L.z - LOUNGERS[i].home) < 1e-9),
    "they stay put in a gentle lean",
  );
  hold(s, 11);
  until(() => false, 60 * 6);
  const row0 = LOUNGERS.filter((l) => l.row === 0).map((l) => s.ship.loungers[l.id].z);
  const half = CRUISE.lounger.hz;
  assert.ok(Math.max(...row0) <= CRUISE.rows[0].z1 - half + 1e-6, "they stop at the row's end");
  for (let i = 1; i < row0.length; i++)
    assert.ok(row0[i] - row0[i - 1] >= SHIP.gap - 1e-6, "and bump, never overlap");
  assert.ok(s.roof.beds.filter((b) => b.adrift).length >= 12, "adrift");
  // Nobody takes an adrift lounger; the coach straightens a row (E by it) once the deck is level, for points.
  level(s);
  until(() => false, 30);
  const before = s.score;
  c.x = loungerSpot(s, 0).foot.x;
  c.z = loungerSpot(s, 0).z;
  const row = adriftRowNear(s);
  assert.equal(row, 0, "the coach is by row 0");
  assert.ok(straightenRow(s, row));
  until(() => !s.coach.busy, 200);
  assert.ok(
    LOUNGERS.filter((l) => l.row === 0).every((l) => !s.roof.beds[l.id].adrift),
    "row 0 is straight",
  );
  assert.ok(s.score > before, "points for it");
  assert.ok(s.stats.straightened >= 4);
}

// 5) Into the pool: a guest walking along the end of the pool when a big swell leans the ship that way slides in (points lost); the
// coach helps them out at the edge (E) for points, else they climb out by themselves, soaked and furious.
{
  for (const help of [true, false]) {
    const { s, until } = game(17);
    level(s);
    const p = s.spawn({ entrance: true });
    until(() => p.status !== "arriving", 600);
    // Walking along the far end of the pool, towards the near deck.
    p.status = "exit";
    p.x = 1;
    p.z = CRUISE.halfZ + 0.75;
    p.path = [{ x: -6, z: CRUISE.halfZ + 0.75 }];
    s.ship.falls = 0;
    const score = s.score;
    hold(s, -11);
    assert.ok(
      until(() => p.status === "fell-in", 60 * 4),
      "slid into the pool (" + p.status + " at " + p.x.toFixed(1) + "," + p.z.toFixed(1) + ")",
    );
    assert.ok(s.score <= score - SHIP.fallCost, "points lost");
    assert.ok(Math.abs(p.z) < CRUISE.halfZ, "in the water");
    level(s);
    if (help) {
      const edge = p.fallen.edge;
      s.coach.x = edge.x - 0.4;
      s.coach.z = edge.z;
      const opt = [];
      ShipDeck.interactions(s, opt);
      assert.ok(
        opt.some((o) => o.id === p.id),
        "E: help them out",
      );
      const before = s.score;
      assert.ok(helpOut(s, p));
      until(() => p.status !== "fell-in", 120);
      assert.equal(p.status, "exit", "back on their way");
      assert.ok(s.score >= before + SHIP.helped, "points for helping");
      assert.ok(v.isDeck(p.x, p.z, 8, 0), "on the deck");
    } else {
      const h = p.h;
      until(() => p.status !== "fell-in", 60 * (SHIP.climbOut + 1));
      assert.notEqual(p.status, "fell-in", "out by themselves");
      assert.ok(p.h < h, "and cross about it");
      assert.ok(s.wetSpots.length > 0, "dripping on the deck");
    }
  }
}

// 6) The slosh: the water rides up the low end and, in a big lean, over it: a wet spot on the deck there.
{
  const { s, until } = game(19);
  level(s);
  s.wetSpots.length = 0;
  hold(s, 12);
  until(() => false, 60 * 4);
  assert.ok(
    s.ship.slosh > SHIP.spill,
    "the water stands up at the low end (" + s.ship.slosh.toFixed(2) + " m)",
  );
  assert.ok(
    s.wetSpots.some((w) => w.z > CRUISE.halfZ),
    "it spilled onto the deck at the starboard end",
  );
  // Lap swimmers go faster downhill.
  const { s: t } = game(23);
  hold(t, 11);
  t.tick(1 / 60);
  const { swimLean } = await import("./dist/ship.mjs");
  assert.ok(swimLean(t, 5) > 1.2 && swimLean(t, 20) < 0.8, "down the lane quicker, back up slower");
}

// 7) Whole shifts from the week, every incident in them, played by the bot: the lanes and the chillers run, margaritas served,
// loungers straightened, nothing stuck, a star at least.
{
  for (const [tier, seed] of [
    [6, 3],
    [12, 9],
  ]) {
    const week = newWeek({ chapter: 2 }, 5151 + seed);
    week.pools = Array(6).fill("cruise");
    week.shift = tier % 6;
    const sh = buildShift(week, "regular", []);
    assert.equal(sh.config.venue, "cruise");
    const bot = new CoachBot(sh.tier, seed, { config: sh.config }).run();
    const s = bot.s,
      sum = s.summary();
    assert.equal(s.status, "ended", "the shift ends");
    assert.ok(s.ship.swells >= 4, "the ship rolled (" + s.ship.swells + " swells)");
    assert.ok(
      sum.served >= sh.config.total * 0.4,
      "guests served (" + sum.served + "/" + sh.config.total + ")",
    );
    assert.ok(s.stats.drinks > 2, "margaritas served (" + s.stats.drinks + ")");
    assert.ok(
      s.people.every((p) => p.status !== "fell-in"),
      "nobody left in the pool",
    );
    assert.ok(
      sum.stars >= 1,
      "a star at least (" + Math.round(s.score) + " of " + sh.config.thresholds + ")",
    );
  }
  // The same seed, the same shift.
  const play = () => new CoachBot(9, 41, { config: { ...SHIFTS[8], venue: "cruise" } }).run().s;
  const a = play(),
    b = play();
  assert.equal(a.score, b.score, "the same score");
  assert.deepEqual(a.stats, b.stats, "the same shift");
}

// 8) In the week's draw like every pool; Marco swims here; its song, stings and saves; its props and pictures on disk.
{
  assert.ok(POOL_IDS.includes("cruise") && POOLS.cruise.name === "Cruise Ship" && POOLS.cruise.icon === "🛳️");
  assert.ok(!POOLS.cruise.style.noStar, "Marco swims here");
  let drawn = 0;
  // (Over 300 weeks: six of the pools a week, so about 6 in 13 of them; at least 3 in 10.)
  for (let seed = 1; seed <= 10; seed++)
    for (let c = 1; c <= 30; c++) if (weekPools(c, seed * 7717).includes("cruise")) drawn++;
  assert.ok(drawn >= 90, "drawn into the weeks (" + drawn + " of 300)");
  assert.ok(scoreScale("cruise", 5) > 0 && scoreScale("cruise", 18) > 0);
  assert.ok(SONGS.cruise && SONGS.cruise.level > 0, "a song of its own");
  assert.ok(STINGS["fell-in"], "a sting for a guest in the pool");
  assert.ok(SAVES["helped-out"], "a save for helping them out");
  for (const name of v.props.filter((n) => PROP_FILES[n]))
    assert.ok(
      fs.existsSync(new URL("./dist/assets/" + PROP_FILES[name], import.meta.url)),
      name + " on disk",
    );
  for (const file of [
    "teak.jpg",
    "pool-tile.jpg",
    "ship-paint.jpg",
    "nonskid.jpg",
    "ocean-sky.jpg",
    "movie.jpg",
  ])
    assert.ok(fs.existsSync(new URL("./dist/assets/cruise/" + file, import.meta.url)), file + " on disk");
}

// 9) On screen (headless, no WebGL): the ship builds; when she rolls the deck tips and the sea and the sky stay level; the water
// stands up at the low end; a guest on a lounger lies on it where it has slid to.
{
  const { createCanvas } = await import("@napi-rs/canvas");
  globalThis.document = { createElement: () => createCanvas(256, 128) };
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  const { PoolWorld } = await import("./dist/scene.mjs");
  const w = new PoolWorld({ clientWidth: 1440, clientHeight: 900 }, () => {}, { headless: true, venue: v });
  assert.ok(w.camera.far > 1000, "the sea to the horizon");
  const { s, until } = game(29);
  const frames = (n) => {
    for (let i = 0; i < n; i++) {
      until(() => false, 1);
      w.sync(s, s.time, 1 / 60);
    }
  };
  hold(s, 9);
  frames(60);
  assert.ok(Math.abs(w.scene.rotation.x - s.ship.angle) < 1e-9, "the deck tips with the ship");
  const ocean = w.scene.children.find((o) => o.name === "ocean");
  assert.ok(ocean, "the sea");
  assert.ok(Math.abs(ocean.rotation.x + s.ship.angle) < 1e-9, "turned back level");
  assert.ok(w.water.material.uniforms.uSlosh.value > 0.2, "the water stands up at the low end");
  // A screen point follows the roll (the tags over the guests).
  const up = w.project(0, 0, 8);
  level(s);
  frames(2);
  const flat = w.project(0, 0, 8);
  assert.ok(Math.abs(up.y - flat.y) > 2, "the tags tip with the deck (" + up.y + " vs " + flat.y + ")");
}

console.log(
  "Cruise Ship checks passed: a pool across the deck (two lanes and free water past the rope), 24 loungers in three rows, walks round everything, stairway lobbies at the left end; half the guests chill, half swim, Marco swims; a seeded roll that is never a rhythm (calm spells, swells either way, the big ones announced, rougher later); the coach and the loungers slide downhill (stuck in a gentle lean, piling up at the row's end, adrift until straightened for points); a guest at the pool's end slides in and is helped out or climbs out furious; the slosh spills onto the deck; swimmers quicker downhill; whole shifts played by the bot; the same seed the same shift; in the week with its song, stings, saves, props and pictures; on screen the deck tips while the sea stays level and the water stands up at the low end.",
);
