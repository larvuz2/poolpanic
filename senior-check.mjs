// Senior Aqua Fit (16 October 2026, the creator: "senior aqua fit… new venue… no lockers… a stooped walk, or hunched-over walk…
// a wheelchair that has a senior swimmer sitting down, randomly… several… when we click and assign a lane it stands up and enters
// the pool"): a pool of its own in the week, laid out for it (a glass conservatory: glass doors in the back wall and no locker
// rooms, a lounge to wait in, the kit on the far side), where every guest is a senior (Marco aside) in one of four looks, walking
// slowly; one in three comes in a wheelchair, waits in it, gets up out of it when given a lane (a moment, the StandUp clip), leaves
// it parked where they were, and on the way out goes back to it, sits down and rolls out.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PoolSimulation, SHIFTS, SENIOR, SENIOR_LOOKS } from "./dist/sim.mjs";
import { VENUES } from "./dist/spatial.mjs";
import { POOLS, buildShift, newWeek, INCIDENT_ORDER, scoreScale } from "./dist/week.mjs";
import { SONGS, seniorScore, SENIOR_STEP } from "./dist/music.mjs";
import { PROP_FILES } from "./dist/scene/prop-models.mjs";
import { FIGURES } from "./dist/scene/swimmer-models.mjs";
import { CoachBot } from "./check-bot.mjs";
import { tick } from "./check-helpers.mjs";

const quiet = (level = 6, seed = 5) => {
  const s = new PoolSimulation(level, seed, { config: { ...SHIFTS[level - 1], venue: "senior" } });
  s.schedule = [];
  s.chaosPlan = [];
  s.start();
  return s;
};
const calm = (p) => Object.assign(p, { crampAt: Infinity, sick: false, sickKind: null, waitLimit: 999 });
const senior = (s, extra = {}) => calm(Object.assign(s.spawn({ entrance: true }), extra));
// The names of a GLB's animations, read from its JSON chunk.
const clipsOf = (file) => {
  const buffer = fs.readFileSync(file),
    length = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(20, 20 + length).toString("utf8")).animations.map((a) => a.name);
};

// 1) The floor plan: an indoor pool of four lanes with no starting blocks, glass doors in the back wall and no locker rooms, a
// lounge of four to a row with room between the guests (every spot on the deck, sixteen a side), every station and fixture
// reachable, and its props, pictures and song shipped with the game.
{
  const v = VENUES.senior;
  assert.equal(v.name, "Senior Aqua Fit");
  assert.ok(v.indoor && v.seniors && !v.kids && !v.class);
  assert.equal(v.lanes.length, 4);
  assert.equal(v.blocks, false);
  assert.deepEqual(v.lockers, []);
  assert.equal(v.doorWord, "the glass doors");
  assert.notEqual(v.arrival.insideZ, v.arrival.doorZ, "a door in the back wall, crossed along z");
  assert.ok(v.isDeck(v.arrival.insideX, v.arrival.doorZ + 1, 3, 0.3), "the doors open onto the deck");
  assert.ok(
    v.queue.stepX > VENUES.resort.queue.stepX,
    "more room between the waiting guests (a wheelchair fits)",
  );
  for (const side of [-1, 1])
    for (let slot = 0; slot < 16; slot++) {
      const at = v.queuePosition(side, slot);
      assert.ok(v.isDeck(at.x, at.z, 6, 0.3), "lounge spot " + side + "/" + slot + " is on the deck");
    }
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
  for (const prop of ["wheelchair", "hoist", "armchair", "monstera", "trolley", "gramophone", "lounger"]) {
    assert.ok(v.props.includes(prop), prop + " is loaded at Senior Aqua Fit");
    const file = new URL("./dist/assets/" + PROP_FILES[prop], import.meta.url);
    assert.ok(fs.statSync(file).size < 1_100_000, prop + " is shipped, and small");
  }
  for (const picture of ["travertine.jpg", "mosaic.jpg", "garden.jpg", "rug.jpg", "sign.jpg"])
    assert.ok(fs.statSync("dist/assets/senior/" + picture).size < 500_000, picture + " is shipped");
  // A tea dance of its own: swung eighths, a walking bass on every beat, the vibes' tune.
  assert.equal(SONGS.senior.score, seniorScore);
  const bar = Array.from({ length: 16 }, (_, s) => seniorScore(2 * 16 + s));
  assert.equal(bar.flat().filter((n) => n.voice === "walk").length, 4);
  assert.ok(
    bar[2].every((n) => Math.abs(n.delay - SENIOR_STEP / 3) < 1e-9),
    "the off-beat is swung",
  );
  assert.ok(bar.flat().some((n) => n.voice === "vibe"));
}

// 2) Only seniors (Marco aside: the week's star swims here too), each in one of four looks, a third of them in wheelchairs, all
// from numbers already drawn: the same shift gives the same guests, and the shift's own stream is where it would be anyway.
{
  const looks = new Set(),
    chairs = [];
  for (let seed = 1; seed <= 12; seed++) {
    const s = quiet(9, seed);
    for (let i = 0; i < 20; i++) {
      const p = s.spawn({});
      assert.equal(p.type, "senior");
      assert.ok(SENIOR_LOOKS.includes(p.figure));
      looks.add(p.figure);
      chairs.push(!!p.wheelchair);
    }
    const marco = s.spawn({ star: true });
    assert.equal(marco.type, "advanced", "Marco is no senior");
    assert.ok(!marco.wheelchair);
  }
  assert.equal(looks.size, 4, "all four looks");
  const share = chairs.filter(Boolean).length / chairs.length;
  assert.ok(share > 0.22 && share < 0.46, "about a third in wheelchairs (" + share.toFixed(2) + ")");
  const a = quiet(9, 7),
    b = quiet(9, 7),
    pick = (p) => [p.figure, p.wheelchair, p.desiredSpeed, p.crampAt];
  for (let i = 0; i < 10; i++) assert.deepEqual(pick(a.spawn({})), pick(b.spawn({})));
  const club = new PoolSimulation(9, 5, { config: { ...SHIFTS[8], venue: "club" } });
  club.start();
  assert.equal(quiet(9, 5).random(), club.random(), "the shift's own numbers do not move");
}

// 3) They walk slowly, stooped: in from the doors at SENIOR.arrive, and a crowd of them coming in together gets through the
// doorway (no one jostled off the door's point for ever) to their places in the lounge.
{
  const s = quiet();
  const crowd = Array.from({ length: 6 }, () => senior(s));
  const p = crowd[0],
    from = { x: p.x, z: p.z };
  tick(s, 60);
  const moved = Math.hypot(p.x - from.x, p.z - from.z);
  assert.ok(moved <= SENIOR.arrive * 1.05 + 0.05, "a slow walk in (" + moved.toFixed(2) + " m in a second)");
  assert.ok(moved > 0.5, "but walking");
  tick(s, 60 * 14);
  assert.ok(
    crowd.every((q) => q.status === "queue"),
    "all six in the lounge (" + crowd.map((q) => q.status) + ")",
  );
}

// 4) The wheelchair: waiting in it, a lane given, up out of it (a moment, standing still), the chair parked where they were (its
// spot kept for it), the walk to the water; out of the pool, back to the chair, down into it, and out through the doors in it.
{
  const s = quiet();
  let p = null;
  for (let i = 0; i < 12 && !p; i++) {
    const q = senior(s);
    if (q.wheelchair) p = q;
  }
  assert.ok(p, "a senior in a wheelchair");
  tick(s, 60 * 16);
  assert.equal(p.status, "queue");
  const spot = { x: p.x, z: p.z };
  s.select(p.id);
  assert.ok(s.assign(1));
  assert.ok(p.chairParked && p.standUp === SENIOR.stand, "getting up");
  assert.ok(s.events.some((e) => e.type === "stand-up" && e.id === p.id));
  assert.deepEqual([p.chair.x, p.chair.z], [spot.x, spot.z], "the chair stays where they waited");
  tick(s, Math.floor(60 * SENIOR.stand) - 2);
  assert.deepEqual([p.x, p.z], [spot.x, spot.z], "standing up takes a moment, on the spot");
  tick(s, 60 * 2);
  assert.ok(Math.hypot(p.x - spot.x, p.z - spot.z) > 0.3, "then off to the water");
  // Their lounge spot is kept for the chair: the next guest on that side does not take it.
  const next = Array.from({ length: 3 }, () => senior(s)).find((q) => q.side === p.side);
  assert.notEqual(next.queueSlot, p.queueSlot, "the chair's spot is kept");
  // A short swim, then out.
  p.workTarget = 1;
  let sat = null;
  for (let f = 0; f < 60 * 120 && p.status !== "gone"; f++) {
    tick(s);
    calm(p);
    if (!sat && s.events.some((e) => e.type === "sit-down" && e.id === p.id))
      sat = { x: p.x, z: p.z, t: s.time };
  }
  assert.ok(sat, "back to the chair to sit down");
  assert.deepEqual([sat.x, sat.z], [p.chair.x, p.chair.z], "where it was left");
  assert.ok(!p.chairParked, "and it goes with them");
  assert.equal(p.status, "gone", "rolled out through the doors");
  assert.equal(s.stats.served, 1);
}

// 5) The week's Senior Aqua Fit: Marco allowed, no swim team or aqua class, star targets of its own (lower: the seniors are slow),
// and a played shift the bot gets through.
{
  const pool = POOLS.senior;
  assert.equal(pool.style.venue, "senior");
  assert.ok(!pool.style.noStar);
  assert.equal(pool.twists.team, 0);
  assert.equal(pool.twists.class, 0);
  assert.ok(scoreScale("senior", 5) < scoreScale("resort", 5));
  const w = { ...newWeek({ chapter: 2 }, 4321), shift: 2, pools: Array(6).fill("senior") };
  const sh = buildShift(w, null, INCIDENT_ORDER);
  const bot = new CoachBot(sh.tier, 17, { config: sh.config }).run();
  const s = bot.s,
    sum = s.summary();
  assert.ok(sum.served >= 8, "the bot served seniors (" + sum.served + ")");
  assert.ok(sum.stars >= 1, "and passed the shift (" + sum.score + ")");
  assert.ok(
    s.people.every((p) => p.chaos || !p.type || p.type === "senior" || p.star),
    "only seniors, and Marco",
  );
  assert.ok(
    s.people.some((p) => p.wheelchair),
    "some in wheelchairs",
  );
}

// 6) The four seniors: each a model with every clip the game asks of it (the stooped walk and idle, the wheelchair's sitting and
// pushing, standing up, swimming and panicking), the stooped walk standing in for the walk and the run.
{
  const seniors = FIGURES.filter((f) => f.senior);
  assert.deepEqual(
    seniors.map((f) => f.id),
    SENIOR_LOOKS,
  );
  for (const f of seniors) {
    const clips = clipsOf("dist/assets/" + f.file);
    for (const clip of ["StoopedWalk", "StoopedIdle", "Sit", "WheelPush", "StandUp", "Swim", "Panic"])
      assert.ok(clips.includes(clip), f.id + " has " + clip);
    assert.equal(f.alias.walk, "StoopedWalk");
    assert.equal(f.alias.run, "StoopedWalk");
    assert.equal(f.alias.idle, "StoopedIdle");
  }
}

// 7) On screen (headless, no WebGL): the conservatory builds, its glass roof only in the Coach Cam, the glass doors swing, and
// a chair for every senior who came in one: under them, then parked and empty, then gone with them.
{
  const { createCanvas } = await import("@napi-rs/canvas");
  globalThis.document = { createElement: () => createCanvas(256, 128) };
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  const { PoolWorld } = await import("./dist/scene.mjs");
  const { seatState } = await import("./dist/scene/senior-view.mjs");
  const w = new PoolWorld({ clientWidth: 1440, clientHeight: 900 }, () => {}, {
    headless: true,
    venue: VENUES.senior,
  });
  const s = quiet();
  const frames = (n) => {
    for (let i = 0; i < n; i++) {
      s.tick(1 / 60);
      w.sync(s, s.time, 1 / 60);
    }
  };
  assert.ok(w.hall && !w.hall.upper.visible, "no roof in the overview");
  w.setViewMode("coach", s);
  frames(2);
  assert.ok(w.hall.upper.visible, "the glass roof in the Coach Cam");
  w.setViewMode("overview", s);
  assert.equal(w.lockerDoors.length, 2);
  s.doors[1] = 1;
  frames(1);
  assert.ok(w.lockerDoors.find((d) => d.side === 1).hinge.rotation.y > 0.5, "a glass door swings open");
  let p = null;
  for (let i = 0; i < 12 && !p; i++) {
    const q = senior(s);
    if (q.wheelchair) p = q;
  }
  frames(60 * 16);
  const chair = w.wheelchairs.get(p.id);
  assert.ok(chair?.visible, "a chair under them");
  assert.ok(Math.hypot(chair.position.x - p.x, chair.position.z - p.z) < 0.3);
  assert.equal(seatState(p).seat, "sit", "sitting in it in the lounge");
  s.select(p.id);
  s.assign(2);
  frames(30);
  assert.ok(seatState(p).stand > 0, "standing up: the StandUp clip");
  frames(60 * 3);
  assert.equal(seatState(p).seat, null);
  assert.ok(chair.visible, "the chair stays, parked");
  assert.ok(Math.hypot(chair.position.x - p.chair.x, chair.position.z - p.chair.z) < 0.3);
  assert.ok(Math.hypot(p.x - p.chair.x, p.z - p.chair.z) > 0.5, "and empty");
  p.status = "gone";
  frames(1);
  assert.ok(!w.wheelchairs.has(p.id), "gone with them");
}
console.log(
  "Senior checks passed: a glass conservatory with four lanes, glass doors and no lockers, a roomy lounge on the deck and every station in reach, its models, pictures and tea-dance song shipped; only seniors (and Marco) in four looks, a third in wheelchairs, from numbers already drawn; a slow walk in, a crowd through the doorway; up out of the wheelchair when given a lane, the chair parked and its spot kept, back to it, down and out in it; star targets of its own and the bot through a shift; every clip on every senior; and on screen the roof in the Coach Cam only, the doors swinging and the chairs with their seniors.",
);
