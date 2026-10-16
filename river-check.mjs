// The Lazy River (17 October 2026, the creator: "the new venue, the Lazy River… the river must have curves, plants, and rocks…
// we only see a section… where the people get on and get off. They come in, and you have to hand them a tube… the animation for
// laying down and getting on top of the tubes… a jungle kind of thing… a door to enter and exit. Same kind of incidents… no
// swimmers in this venue… they go, they disappear, and then we see the input and output of the river. Add some rocks in the
// middle so the coach can jump into, and cut corners… this venue gets thrown in the randomness roulette of every week").
import assert from "node:assert/strict";
import fs from "node:fs";
import { PoolSimulation, SHIFTS } from "./dist/sim.mjs";
import { VENUES } from "./dist/spatial.mjs";
import { RIDE } from "./dist/river-ride.mjs";
import { POOLS, POOL_IDS, buildShift, newWeek, weekPools, scoreScale } from "./dist/week.mjs";
import { SONGS, riverScore, RIVER_TUNE, STEPS_PER_BAR } from "./dist/music.mjs";
import { SWIMMERS, FIGURES } from "./dist/scene/swimmer-models.mjs";
import { CoachBot } from "./check-bot.mjs";

const v = VENUES.river,
  r = v.river;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const game = (seed = 5) => {
  const bot = new CoachBot(6, seed, { config: { ...SHIFTS[5], venue: "river" } });
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
const guest = (s) =>
  Object.assign(s.spawn({ entrance: true }), { crampAt: Infinity, sick: false, waitLimit: 999 });
// A guest given a tube and sent down the river (the coach walks to the rack and hands it over).
function rider(t) {
  const { bot, s, until } = t,
    p = guest(s);
  until(() => p.status === "queue");
  bot.giveFins();
  s.select(p.id);
  s.assign(0);
  s.selected = null;
  return p;
}

// 1) The river: a curve through the room whose two mouths are in the walls (only a stretch is seen), water wherever |d| < w,
// a place's (s, d) read back from its (x, z), the bridge and the stepping stones walkable and everything else in it water.
{
  assert.equal(v.name, "Lazy River");
  assert.equal(v.doorWord, "the jungle gate");
  assert.ok(!v.indoor && v.scenery === "jungle");
  assert.deepEqual(v.lanes, [0], "one 'lane': the river");
  assert.equal(v.tubes, 10);
  const room = v.room,
    a = r.at(r.start),
    b = r.at(r.end);
  assert.ok(
    Math.abs(a.z - room.minZ) < 0.15 && Math.abs(b.z - room.maxZ) < 0.15,
    "the mouths are in the walls",
  );
  assert.ok(r.end - r.start > 30, "a long curving stretch is seen");
  let turn = 0;
  for (let s = r.start; s < r.end - 1; s += 1) turn += Math.abs(r.at(s + 1).angle - r.at(s).angle);
  assert.ok(turn > 2.5, "it curves (an S), " + turn.toFixed(2) + " radians of bends");
  for (let s = r.start + 1; s < r.end - 1; s += 1.7)
    for (const d of [-2.4, -1, 0, 1.3, 2.6]) {
      const p = r.point(s, d),
        q = r.locate(p.x, p.z);
      assert.ok(Math.abs(q.s - s) < 0.12 && Math.abs(q.d - d) < 0.05, "a place read back from where it is");
      assert.ok(r.inWater(p.x, p.z), "in the water");
    }
  for (const st of r.stones) {
    assert.ok(r.walkable(st.x, st.z, 0.3), "a stepping stone is stood on");
    assert.ok(
      r.inWater(st.x + st.r + 0.5, st.z) || r.inWater(st.x - st.r - 0.5, st.z),
      "in the middle of the water",
    );
    assert.ok(Math.abs(st.d) < r.w - 1, "away from the banks");
  }
  const mid = r.point(r.bridge.s, 0);
  assert.ok(r.walkable(mid.x, mid.z, 0.3), "the bridge is walked on");
  assert.ok(
    !r.walkable(r.point(r.bridge.s + 3, 0).x, r.point(r.bridge.s + 3, 0).z, 0.3),
    "the water beside it is not",
  );
  for (const end of r.bridge.ends)
    assert.ok(v.isDeck(end.x, end.z, 6, 0.3), "the bridge's ends are on the deck");
  for (const key of ["board", "exit"]) {
    const d = r.docks[key];
    assert.ok(v.isDeck(d.stand.x, d.stand.z, 6, 0.3), key + " dock: stood on");
    assert.ok(r.inWater(d.water.x, d.water.z), key + " dock: into the water");
  }
  assert.ok(
    r.docks.exit.s < r.docks.board.s,
    "the exit dock is upstream of the boarding dock: a rider goes round once",
  );
  assert.ok(v.isDeck(r.docks.tubeReturn.x, r.docks.tubeReturn.z, 6, 0.3), "the tube return is on the deck");
}

// 2) The floor plan: the two banks joined by the bridge, every station, fixture and lounge spot on the deck and reachable on
// foot without wading through the river (routes keep out of the water).
{
  const near = r.point(20, -(r.w + 1.5)),
    far = r.point(20, r.w + 1.5);
  const path = v.route(near, far);
  assert.ok(path.length > 1, "across the river there is a way round");
  let at = near;
  for (const p of path) {
    assert.ok(!r.wet(at, p), "the way round never wades: " + JSON.stringify(p));
    at = p;
  }
  assert.ok(
    path.some((p) => r.onBridge(p.x, p.z) || Math.abs(r.locate(p.x, p.z).s - r.bridge.s) < 1.5),
    "it crosses by the bridge",
  );
  for (const [name, at] of [
    ...Object.entries(v.stations),
    ...Object.entries(v.fixtures),
    ["rack", v.sanitation.rack],
    ["bin", v.sanitation.bin],
    ["bench", v.rescue.approach],
  ]) {
    const route = v.route(v.coachStart, at);
    let from = v.coachStart;
    for (const p of route) {
      assert.ok(!r.wet(from, p), name + " is reached without wading");
      from = p;
    }
  }
  for (let slot = 0; slot < 15; slot++)
    for (const side of [-1, 1]) {
      const q = v.queuePosition(side, slot);
      assert.ok(v.isDeck(q.x, q.z, 6, 0.3), "lounge spot " + side + "/" + slot + " on the deck");
    }
  for (const e of v.evacSpots) assert.ok(v.isDeck(e.x, e.z, 6, 0.3), "an evacuation spot on the deck");
  for (const m of v.ringMounts)
    assert.ok(!r.inWater(m.x, m.z, -1), "a life ring on a wall, away from the water");
}

// 3) The ride: no tube, no river; given one, the guest walks to the boarding dock, sits into the tube, floats downstream with
// the current, goes round the loop out of sight for `hidden` seconds, comes back in at the cave and gets off at the exit
// dock, climbs out, drops the tube at the tube return and goes home served. The tubes are always all accounted for.
{
  const t = game();
  const { s, until } = t;
  const p = guest(s);
  until(() => p.status === "queue");
  assert.equal(p.problem, "fins", "every guest wants a tube");
  s.select(p.id);
  assert.equal(s.assign(0), false, "no tube, no river");
  s.selected = null;
  t.bot.giveFins();
  assert.ok(p.hasFins);
  assert.equal(s.finsAvailable, 9);
  s.select(p.id);
  assert.ok(s.assign(0));
  s.selected = null;
  assert.ok(
    until(() => p.status === "enter" && p.boarding > 0, 60 * 20),
    "sits into the tube at the dock",
  );
  assert.ok(distance(p, r.docks.board.stand) < 1.5);
  assert.ok(
    until(() => p.status === "swim", 120),
    "and floats off",
  );
  const s0 = p.s;
  until(() => false, 60 * 3);
  assert.ok(p.s - s0 > r.flow * 2.6, "downstream with the current");
  assert.ok(Math.abs(p.d) < r.w, "in the channel");
  assert.ok(
    until(() => p.away, 60 * 30),
    "out of sight round the loop",
  );
  const awayAt = s.time;
  assert.ok(until(() => !p.away, 60 * 10));
  assert.ok(Math.abs(s.time - awayAt - r.hidden) < 0.1, "for the hidden stretch");
  assert.equal(p.lap, 1);
  assert.ok(p.s < r.start + 0.5, "back in at the cave");
  assert.ok(
    until(() => p.status === "exit", 60 * 20),
    "off at the exit dock",
  );
  assert.ok(Math.abs(p.s - r.docks.exit.s) < 2, "where the exit dock is");
  assert.equal(s.stats.served, 1);
  assert.ok(
    until(() => p.exitPhase === "deck" && !p.hasFins, 60 * 15),
    "the tube left at the tube return",
  );
  const returned = s.clutter.filter((c) => c.type === "fins" && distance(c, r.docks.tubeReturn) < 1.3);
  assert.equal(returned.length, 1);
  assert.equal(s.finCount(), 10, "every tube accounted for");
  assert.ok(
    until(() => p.status === "gone", 60 * 30),
    "and home",
  );
  // The coach carries the used tube back to the rack.
  t.bot.rackTube();
  assert.equal(s.finsAvailable, 10);
  assert.equal(s.finCount(), 10);
}

// 4) The coach and the river: running at the bank he jumps onto a stepping stone and stands on it (a short cut across); a hop
// off it that falls short is a splash, a swim with the current and a climb out onto the bank.
{
  const t = game();
  const { s, bot, until } = t,
    c = s.coach,
    st = r.stones[0],
    across = r.at(st.s);
  bot.walkTo(r.point(st.s, -(r.w + 2.6)), { reach: 0.15 });
  let jumped = false;
  for (let f = 0; f < 120 && !jumped; f++) {
    s.setMovement(across.nx, across.nz);
    // (Jump as the next step would leave the bank.)
    if (c.y === 0 && !s.isDeck(c.x + c.vx * 0.06, c.z + c.vz * 0.06)) {
      s.jump();
      jumped = true;
    }
    bot.frame();
  }
  assert.ok(jumped, "a run-up to the edge");
  for (let f = 0; f < 60 && c.y > 0; f++) {
    s.setMovement(across.nx, across.nz);
    bot.frame();
  }
  s.clearInput();
  until(() => false, 20);
  assert.ok(!c.swimming, "he lands on the stone, dry");
  assert.ok(
    r.stones.some((x) => distance(c, x) < x.r + 0.3),
    "on a stone (a full run-up carries him to the second one)",
  );
  // A hop off the stone downstream, from a standstill: short of anywhere dry.
  let fell = 0;
  const tick = s.tick.bind(s);
  s.tick = (dt) => {
    tick(dt);
    fell += s.events.filter((e) => e.type === "coach-fell").length;
  };
  for (let f = 0; f < 90 && !c.swimming; f++) {
    s.setMovement(across.tx, across.tz);
    if (f === 4) s.jump();
    bot.frame();
  }
  s.clearInput();
  assert.ok(c.swimming && fell === 1, "in the river");
  assert.equal(s.stats.fellIn, 1);
  const q0 = r.locate(c.x, c.z);
  until(() => false, 60 * 2);
  assert.ok(r.locate(c.x, c.z).s > q0.s + 0.8, "carried by the current");
  bot.climbOut();
  assert.ok(!c.swimming && v.isDeck(c.x, c.z, 6), "and out onto the bank");
}

// 5) A guest flips off their tube (a cramp, the river's wipeout): the pumps stop, the coach takes a ring, dives in from the bank,
// the guest is ringed and brought out; after a rest on the bench they get back on the river and ride on.
{
  const t = game();
  const { s, bot, until } = t,
    p = rider(t);
  until(() => p.status === "swim" && p.s > 24 && !p.away, 9000);
  assert.ok(s.startCramp(p));
  const s0 = p.s;
  until(() => false, 60);
  assert.equal(p.s, s0, "the pumps stop: the river holds");
  const ring = s.lifeRings
    .filter((x) => x.state === "wall")
    .sort((a, b) => distance(a, s.coach) - distance(b, s.coach))[0];
  bot.approach(bot.wallPoint(ring.mount), 0.8);
  assert.ok(bot.use("lifering"));
  assert.ok(bot.diveNear(p), "a dive from the bank");
  for (let f = 0; f < 60 * 20 && s.rescue?.stage === "stranded" && s.coach.swimming; f++) {
    bot.steer(p);
    bot.frame();
  }
  s.clearInput();
  assert.notEqual(s.rescue?.stage, "stranded", "the ring reaches them");
  bot.climbOut();
  assert.ok(
    until(() => !s.rescue, 60 * 6),
    "safely out",
  );
  assert.equal(p.status, "recovering");
  assert.ok(
    until(() => p.status === "swim", 60 * 40),
    "back on the river after a rest",
  );
  assert.ok(p.hasFins);
  assert.ok(
    until(() => p.status === "gone", 60 * 90),
    "and round to the exit and home",
  );
  assert.equal(s.finCount(), 10);
}

// 6) A poo and a wee in the river: everybody out onto the banks, the floater skimmed from the bank and binned, the chlorine
// poured from the bank, the river reopened and the riders back on it.
for (const kind of ["poo", "pee"]) {
  const t = game();
  const { s, bot, until } = t,
    riders = [rider(t), rider(t)];
  until(() => riders.every((p) => p.status === "swim" && !p.away) && riders[0].s > 24, 4000);
  riders[0].sickKind = kind;
  s.catastrophe(riders[0]);
  assert.ok(s.cleanup && s.closed, kind + ": the river closes");
  until(() => riders.every((p) => p.status !== "evacuating"), 60 * 20);
  for (const p of riders) assert.ok(v.isDeck(p.x, p.z, 6, 0.2), kind + ": out on the bank");
  const q = s.cleanup;
  if (kind === "poo") {
    bot.approach(v.sanitation.rack, 1.0);
    assert.ok(s.fetch("skimmer"));
    for (let k = 0; k < 8 && q.stage === "floating"; k++) {
      bot.walkTo(r.bank(q.x, q.z, { side: -1, outside: 0.6 }).deck, { reach: 0.4 });
      s.scoop();
      until(() => q.stage !== "floating" || !s.coach.scoopTimer, 60);
    }
    assert.equal(q.stage, "caught", "skimmed from the bank");
    bot.approach(v.sanitation.bin, 1.0);
    assert.ok(s.disposeWaste());
    bot.approach(v.sanitation.rack, 1.0);
    assert.ok(s.returnItem());
  }
  for (let d = 0; d < 3 && s.cleanup; d++) {
    bot.approach(v.stations.chlorine, 1.0);
    assert.ok(s.fetch("chlorine"));
    bot.walkTo(r.bank(s.coach.x, s.coach.z, { side: 1, outside: 0.5 }).deck, { reach: 0.4 });
    assert.ok(s.deliverWater(0), kind + ": chlorine poured from the bank");
    until(() => !s.cleanup, 60 * 4);
  }
  assert.ok(!s.cleanup && !s.closed, kind + ": the river reopens");
  assert.ok(
    until(() => riders.filter((p) => p.status !== "gone").every((p) => p.status === "swim"), 60 * 40),
    kind + ": everyone back on the river",
  );
  assert.equal(s.finCount(), 10);
}

// 7) The fish kid's fish in the river: netted, and the coach climbs out with it even by the temple, where the near bank is jungle
// (out onto the far bank instead).
{
  const t = game();
  const { s, bot, until } = t,
    c = s.coach;
  Object.assign(c, { x: r.point(37, 0).x, z: r.point(37, 0).z, swimming: true, y: -0.39, carry: "fishnet" });
  s.fish = { stage: "netted", x: c.x, z: c.z };
  c.netLoaded = true;
  bot.climbOut();
  assert.ok(!c.swimming, "out of the water by the temple");
  assert.ok(v.isDeck(c.x, c.z, 6), "onto a bank that is deck");
  void until;
}

// 8) A whole shift: the coach bot hands out tubes, carries the used ones back and keeps the river going; the stars ask a fair
// share of what it scores (week.mjs SCORE_SCALE).
{
  const week = newWeek({ chapter: 1 }, 9001);
  week.pools = Array(6).fill("river");
  week.shift = 4;
  const sh = buildShift(week, "regular", []);
  assert.equal(sh.config.venue, "river");
  assert.ok(sh.config.duration >= 120);
  const bot = new CoachBot(sh.tier, 31, { config: sh.config }).run();
  const sum = bot.s.summary();
  assert.ok(sum.served >= 10, "the bot serves a shift's worth of riders (" + sum.served + ")");
  assert.ok(bot.s.score >= sh.config.thresholds[0], "and earns a star");
  assert.equal(bot.s.finCount(), 10);
}

// 9) In the week: a pool of its own in every week's draw, no twist that needs lanes, its own star scale.
{
  assert.ok(POOL_IDS.includes("river"));
  assert.equal(POOLS.river.name, "Lazy River");
  assert.equal(POOLS.river.style.venue, "river");
  assert.deepEqual(POOLS.river.twists, { closure: 0, team: 0, class: 0 });
  let seen = 0;
  for (let seed = 1; seed <= 60; seed++) if (weekPools(2, seed * 7919).includes("river")) seen++;
  assert.ok(seen > 20 && seen < 60, "drawn into some weeks and not others (" + seen + " of 60)");
  for (let tier = 1; tier <= 20; tier++)
    assert.ok(scoreScale("river", tier) >= 0.7 && scoreScale("river", tier) <= 1);
}

// 10) Its song: a calypso of its own at 100 BPM, on the shift's clock like the others.
{
  assert.ok(SONGS.river && SONGS.river.score === riverScore);
  assert.equal(RIVER_TUNE.length, 8 * STEPS_PER_BAR);
  const voices = new Set();
  for (let step = 0; step < STEPS_PER_BAR * 20; step++) for (const n of riverScore(step)) voices.add(n.voice);
  for (const voice of ["steel", "marimba", "logbass", "conga", "slap", "shaker", "bird"])
    assert.ok(voices.has(voice), "the song has its " + voice);
  assert.ok(
    riverScore(0).every((n) => n.voice !== "steel"),
    "it starts with the congas",
  );
}

// 11) The tube clips: every body that rides (the five swimmers, Marco, Carl and the leopard man) lies back in a tube
// (TubeFloat) and sits into it (TubeBoard).
{
  const clipsOf = (file) => {
    const buffer = fs.readFileSync(file),
      length = buffer.readUInt32LE(12);
    return JSON.parse(buffer.subarray(20, 20 + length).toString("utf8")).animations.map((a) => a.name);
  };
  const riders = [...SWIMMERS, ...FIGURES.filter((f) => ["marco", "carl", "leopard"].includes(f.id))];
  assert.equal(riders.length, 8);
  for (const f of riders) {
    const clips = clipsOf("dist/assets/" + f.file);
    assert.ok(clips.includes("TubeFloat") && clips.includes("TubeBoard"), f.id + " rides a tube");
  }
}

// 12) On screen (headless, no WebGL): the river's world builds with its flowing water and its "lane" in the river's shape, the
// rack's tubes come and go with the rack, a rider floats on the water in a tube (TubeBoard at the dock, then TubeFloat) and is
// gone from the picture round the loop, and a used tube on the deck is a tube.
{
  const { createCanvas } = await import("@napi-rs/canvas");
  globalThis.document = { createElement: () => createCanvas(256, 128) };
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  const { PoolWorld } = await import("./dist/scene.mjs");
  const { tubeState } = await import("./dist/scene/river-view.mjs");
  const w = new PoolWorld({ clientWidth: 1440, clientHeight: 900 }, () => {}, { headless: true, venue: v });
  const t = game();
  const { s, bot } = t;
  const frames = (n) => {
    for (let i = 0; i < n; i++) {
      bot.frame();
      w.sync(s, s.time, 1 / 60);
    }
  };
  assert.ok(w.water.geometry.attributes.aRiver, "the water knows where it is along the river");
  assert.ok(w.sky, "the jungle sky in the Coach Cam");
  assert.equal(w.laneHighlights.length, 1);
  assert.equal(w.laneHighlights[0], w.riverHighlight, "the river is the lane's highlight");
  assert.ok(
    w.clickables.some((m) => m.userData.kind === "lane" && m.userData.lane === 0),
    "clicking the river sends a guest",
  );
  assert.equal(w.finPairs.length, 10, "ten tubes on the rack");
  const p = rider(t);
  frames(1);
  assert.equal(w.finPairs.filter((g) => g.visible).length, 9, "one off the rack");
  let boarded = false,
    floated = false;
  for (let i = 0; i < 60 * 40 && !(floated && p.away); i++) {
    frames(1);
    const state = tubeState(p);
    if (state?.board !== undefined) boarded = true;
    if (state?.float && p.status === "swim") {
      floated = true;
      const g = w.people.get(p.id);
      assert.ok(g.visible && g.userData.tube.visible, "in sight, in a tube");
      assert.ok(
        Math.abs(g.position.y + g.userData.tube.position.y - (-0.25 + 0.02)) < 0.08,
        "the tube on the water",
      );
    }
  }
  assert.ok(boarded && floated, "sits into the tube, then floats");
  assert.ok(p.away);
  frames(1);
  assert.equal(w.people.get(p.id).visible, false, "gone round the loop: out of the picture");
  for (let i = 0; i < 60 * 40 && p.status !== "gone"; i++) frames(1);
  const drop = [...w.drops.values()][0];
  assert.ok(drop, "the used tube on the deck");
  assert.ok(Math.abs(RIDE.board - 1.1) < 1e-9 && Math.abs(RIDE.climb - 1.0) < 1e-9);
}

console.log(
  "River checks passed: a curving river with its mouths in the walls (only a stretch seen), places read back from where they are, a bridge and two stepping stones walkable and the rest water; both banks joined by the bridge and every station reached without wading; a guest who wants a tube, sits into it at the dock, floats with the current, goes round the loop out of sight, gets off at the exit dock and leaves the tube at the return, every tube accounted for; the coach landing on a stone, falling short into the river, carried by the current and climbing out; a wipeout rescued with the pumps stopped; a poo and a wee cleaned from the banks; out of the water by the temple; a shift played by the bot; in every week's draw with its own stars; its calypso; the tube clips on every rider; and on screen the flowing water, the river as the lane, the rack's tubes, a rider boarding, floating and gone round the loop.",
);
