// The Kids Pool (16 October 2026, the creator: "only kids… they run all over the floor… it's hard to pick a kid and send them to
// the pool… there are no lanes… swimming without control, a chaos kind of thing… after some time they go out"): a pool of its own
// in the week where every guest is a child in the fish kid's model in clothes of their own; a child does not stand in line but runs
// about the deck until the coach catches one; the pool has no lanes (one POOL button sends a caught kid to its emptiest part);
// in the water they paddle anywhere, bumping into each other, and climb out when their time is up; more than KIDS_ROOM at once
// and the pool is packed. Every incident still comes, a wee and a poo more often, and there is no Marco.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PoolSimulation, SHIFTS, KIDS_ROOM, KID_RUN } from "./dist/sim.mjs";
import { VENUES } from "./dist/spatial.mjs";
import { POOLS, buildShift, newWeek, INCIDENT_ORDER, scoreScale } from "./dist/week.mjs";
import { SONGS } from "./dist/music.mjs";
import { PROP_FILES } from "./dist/scene/prop-models.mjs";
import { childLook } from "./dist/scene/swimmer-models.mjs";
import { CoachBot } from "./check-bot.mjs";
import { tick } from "./check-helpers.mjs";

const quiet = (level = 6, seed = 5) => {
  const s = new PoolSimulation(level, seed, { config: { ...SHIFTS[level - 1], venue: "kids" } });
  s.schedule = [];
  s.chaosPlan = [];
  s.start();
  return s;
};
const kid = (s, extra = {}) =>
  Object.assign(s.spawn({}), { crampAt: Infinity, sick: false, sickKind: null, ...extra });

// 1) The floor plan: an outdoor pool with three zones and no lane ropes, a gate in the fence and no locker bays, every station and
// fixture on the deck, the mop and the floating toys among its props (each a file the game ships).
{
  const v = VENUES.kids;
  assert.equal(v.name, "Kids Pool");
  assert.ok(v.kids && !v.indoor && !v.class);
  assert.equal(v.lanes.length, 3);
  assert.deepEqual(v.lockers, []);
  assert.equal(v.doorWord, "the gate", "the guidance names the gate");
  assert.ok(v.isDeck(v.arrival.insideX, v.arrival.insideZ + 1.5, 3, 0.3), "the gate opens onto the deck");
  for (const [name, at] of [...Object.entries(v.stations), ...Object.entries(v.fixtures)])
    assert.ok(
      [
        [0.9, 0],
        [-0.9, 0],
        [0, 1.2],
        [0, -1.2],
      ].some(([dx, dz]) => v.isDeck(at.x + dx, at.z + dz, 3, 0.3)),
      name + " can be reached",
    );
  for (const prop of ["mop", "mop-bucket", "duck", "swim-ring"]) {
    assert.ok(v.props.includes(prop), prop + " is loaded at the Kids Pool");
    const file = new URL("./dist/assets/" + PROP_FILES[prop], import.meta.url);
    assert.ok(fs.statSync(file).size < 400_000, prop + " is shipped, and small");
  }
  assert.ok(SONGS.kids, "a song of its own");
}

// 2) Only kids: whatever the level's mix says, every guest is a child in the kid's model, no fins, each in a look of their own
// that a replay gives back the same.
{
  const s = quiet(9);
  const kids = Array.from({ length: 12 }, () => kid(s));
  assert.ok(kids.every((p) => p.type === "child" && p.figure === "kid" && !p.needsFins));
  assert.equal(new Set(kids.map((p) => p.tint)).size, kids.length, "a look each");
  assert.deepEqual(childLook(kids[3].tint), childLook(kids[3].tint));
  assert.notDeepEqual(childLook(0), childLook(1));
  const other = quiet(9);
  assert.equal(
    new PoolSimulation(9, 5, { config: { ...SHIFTS[8], venue: "club" } }).random(),
    other.random(),
  );
}

// 3) They run about: a waiting child is never in a line, they run from place to place over the whole deck (faster than a walk),
// always on the deck, and the runs come from a stream of their own (the shift's own numbers do not move).
{
  const s = quiet();
  const kids = Array.from({ length: 6 }, () => kid(s, { waitLimit: 999 }));
  const start = kids.map((p) => ({ x: p.x, z: p.z })),
    far = kids.map(() => 0),
    spots = new Set();
  const seed = s.seed;
  for (let f = 0; f < 60 * 30; f++) {
    tick(s);
    kids.forEach((p, i) => {
      assert.equal(p.status, "queue", "still loose");
      assert.ok(s.venue.isDeck(p.x, p.z, s.level, 0), "on open deck, never in the water or a bench");
      far[i] = Math.max(far[i], Math.hypot(p.x - start[i].x, p.z - start[i].z));
      spots.add(Math.round(p.x / 3) + "," + Math.round(p.z / 3));
    });
  }
  assert.ok(
    far.every((d) => d > 4),
    "every kid ran off (" + far.map((d) => d.toFixed(1)) + ")",
  );
  assert.ok(spots.size >= 12, "all over the deck (" + spots.size + " places)");
  assert.equal(s.seed, seed, "the kids' runs draw nothing from the shift's stream");
  assert.ok(kids.some((p) => p.roam.speed >= KID_RUN[0]));
}

// 4) Catching one: select a running kid (a click, or E beside them) and the one POOL button sends them to the emptiest part of the
// pool, the middle first; in the water they paddle anywhere, never past the walls, and climb out when their time is up.
{
  const s = quiet();
  assert.equal(s.poolLane(), 1, "the middle first");
  const a = kid(s);
  tick(s, 120);
  s.select(a.id);
  assert.ok(s.assign(s.poolLane()));
  assert.equal(a.lane, 1);
  const b = kid(s);
  s.select(b.id);
  s.assign(s.poolLane());
  assert.notEqual(b.lane, 1, "the next to an emptier part");
  const P = s.venue.pool,
    xs = new Set();
  let out = null;
  for (let f = 0; f < 60 * 50 && !out; f++) {
    tick(s);
    if (a.status === "swim") {
      assert.ok(Math.abs(a.x) <= P.swimX && Math.abs(a.z) <= P.swimZ, "inside the pool");
      xs.add(Math.round(a.x));
    }
    if (a.status !== "swim" && a.workTime > 0) out = a.status;
  }
  assert.ok(xs.size >= 3, "paddling across the pool, not down a lane (" + [...xs] + ")");
  assert.ok(a.workTarget >= 20 && a.workTarget <= 28);
  assert.ok(out && out !== "queue", "out when their time is up (" + out + ")");
}

// 5) Packed: more than KIDS_ROOM kids at once bump into each other and get cross (a warning, once in a while).
{
  const s = quiet();
  const kids = Array.from({ length: KIDS_ROOM + 3 }, () => kid(s));
  for (const p of kids) {
    s.select(p.id);
    s.assign(s.poolLane());
  }
  const before = Object.fromEntries(kids.map((p) => [p.id, p.h]));
  tick(s, 60 * 12);
  assert.ok(kids.filter((p) => p.status === "swim").length > KIDS_ROOM);
  assert.ok(
    s.events.some((e) => e.type === "toast" && /packed/.test(e.text)),
    "a warning",
  );
  const fewer = quiet(),
    few = Array.from({ length: 4 }, () => kid(fewer)),
    fewBefore = Object.fromEntries(few.map((p) => [p.id, p.h]));
  for (const p of few) {
    fewer.select(p.id);
    fewer.assign(fewer.poolLane());
  }
  tick(fewer, 60 * 12);
  const loss = (list, b) => list.reduce((a, p) => a + (b[p.id] - p.h), 0) / list.length;
  assert.ok(
    loss(kids, before) > loss(few, fewBefore) + 3,
    "a packed pool costs more mood (" +
      loss(kids, before).toFixed(1) +
      " vs " +
      loss(few, fewBefore).toFixed(1) +
      ")",
  );
  assert.ok(!fewer.events.some((e) => e.type === "toast" && /packed/.test(e.text)), "room for four");
}

// 6) The week's Kids Pool: no Marco, more upset tummies and half of them a wee, star targets of its own, and a played shift the bot
// gets through (catching kids, mopping the drips).
{
  const pool = POOLS.kids;
  assert.equal(pool.style.venue, "kids");
  assert.ok(pool.style.noStar && pool.style.sickRate > 0.2 && pool.style.peeShare === 0.5);
  assert.ok(scoreScale("kids", 5) > scoreScale("resort", 5));
  const w = { ...newWeek({ chapter: 2 }, 4321), shift: 2, pools: Array(6).fill("kids") };
  const sh = buildShift(w, null, INCIDENT_ORDER);
  const bot = new CoachBot(sh.tier, 17, { config: sh.config }).run();
  const s = bot.s,
    sum = s.summary();
  assert.ok(sum.served >= 10, "the bot caught and served kids (" + sum.served + ")");
  assert.ok(sum.stars >= 1, "and passed the shift (" + sum.score + ")");
  assert.ok(
    s.people.every((p) => p.chaos || !p.type || p.type === "child"),
    "only kids",
  );
}
console.log(
  "Kids checks passed: an outdoor pool with three open zones, a gate and no lockers, its toys and its song; only kids, each in a look of their own; kids running all over the deck on a stream of their own; one POOL button sending a caught kid to the emptiest part, chaotic paddling inside the walls and out when their time is up; a packed pool past " +
    KIDS_ROOM +
    " kids; no Marco, more wees, star targets of its own, and the bot through a shift.",
);
