// Loose props (5 November 2026): every venue has loose things the coach and the guests knock about, on screen only. A ball rolls
// away from a kick and bounces off a wall; a pot rocks at a nudge and falls over at a run; a jump clears them; a new shift puts
// them back; the cruise's chairs and balls slide with the roll; none of it touches the simulation.
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { PoolWorld } from "./dist/scene.mjs";
import { PoolSimulation, SHIFTS } from "./dist/sim.mjs";
import { LooseProps, VENUE_KITS, homeSpots } from "./dist/scene/loose.mjs";
import { VENUES } from "./dist/spatial.mjs";
import { POOL_IDS } from "./dist/week.mjs";

const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const { createCanvas } = runtime
  ? await import(pathToFileURL(runtime + "/@napi-rs/canvas/index.js"))
  : await import("@napi-rs/canvas");
globalThis.document = { createElement: () => createCanvas(256, 128) };
globalThis.window = { matchMedia: () => ({ matches: false }) };
const quiet = console.warn;
console.warn = () => {};

// 1) Every venue has its kit, on free deck, apart from each other and from every station, door and line.
for (const id of POOL_IDS) {
  const sim = new PoolSimulation(3, 1, { config: { ...SHIFTS[2], venue: id } }),
    venue = sim.venue,
    kit = VENUE_KITS[venue.id];
  assert.ok(kit?.length >= 6, id + " has a kit");
  const spots = homeSpots(venue, kit.length);
  assert.ok(
    spots.length >= Math.min(kit.length, 5),
    id + ": room for its props (" + spots.length + "/" + kit.length + ")",
  );
  for (const s of spots) {
    assert.ok(venue.isDeck(s.x, s.z, 3, 0.45), id + ": on free deck");
    for (const t of Object.values(venue.stations || {}))
      assert.ok(Math.hypot(t.x - s.x, t.z - s.z) >= 2.2, id + ": clear of a station");
  }
  for (let i = 0; i < spots.length; i++)
    for (let j = i + 1; j < spots.length; j++)
      assert.ok(Math.hypot(spots[i].x - spots[j].x, spots[i].z - spots[j].z) >= 2.4, id + ": apart");
  assert.deepEqual(homeSpots(venue, kit.length), spots, id + ": the same places every time");
}

// 2) The physics, on a world built for the Community Pool.
const world = new PoolWorld({ clientWidth: 1440, clientHeight: 900 }, () => {}, { headless: true });
const sim = new PoolSimulation(3, 1, { config: { ...SHIFTS[2], venue: "club" } });
world.setVenue(sim.venue);
const loose = world.loose;
assert.ok(loose instanceof LooseProps && loose.items.length >= 8, "the club's props are in the world");
assert.ok(loose.group.parent === world.scene);
const of = (kind) => loose.items.find((it) => it.kind === kind);
// a fake coach that walks or runs straight through a prop
const coachAt = (x, z, y = 0) => ({ x, z, y });
function charge(item, speed, { y = 0, frames = 40 } = {}) {
  const dt = 1 / 60,
    dir = { x: 0, z: 1 },
    start = { x: item.x - dir.x * 1.2, z: item.z - dir.z * 1.2 },
    fake = { coaches: [coachAt(start.x, start.z, y)], people: [], level: 3 };
  for (let f = 0; f < frames; f++) {
    const c = fake.coaches[0];
    c.x += dir.x * speed * dt;
    c.z += dir.z * speed * dt;
    world.clock = (world.clock || 0) + dt;
    loose.update(fake, dt);
  }
  // and then let it all settle a few seconds
  const still = { coaches: [coachAt(-50, -50)], people: [], level: 3 };
  for (let f = 0; f < 300; f++) {
    world.clock += dt;
    loose.update(still, dt);
  }
}
const scoreBefore = sim.score;
{
  const ball = of("ball"),
    from = { x: ball.x, z: ball.z };
  charge(ball, 7.6);
  const moved = Math.hypot(ball.x - from.x, ball.z - from.z);
  assert.ok(moved > 1.5, "a ball kicked at a run rolls well away (" + moved.toFixed(1) + " m)");
  assert.ok(
    ball.water || sim.venue.isDeck(ball.x, ball.z, 3, ball.r * 0.6),
    "and stays on free deck or in the pool",
  );
  assert.ok(!ball.object.quaternion.equals(ball.home.q), "it rolled");
}
{
  loose.reset();
  const pot = of("pot");
  charge(pot, 1.4);
  assert.equal(pot.tipped, 0, "a pot nudged at a walk only rocks");
  charge(pot, 7.6);
  assert.equal(pot.tipped, 1, "a pot run into falls over");
  assert.ok(pot.object.position.y > 0.05, "and lies on its side, not through the floor");
}
{
  loose.reset();
  const kick = of("kick"),
    from = { x: kick.x, z: kick.z };
  charge(kick, 7.6, { y: 0.8 });
  assert.equal(Math.hypot(kick.x - from.x, kick.z - from.z), 0, "jumped over: untouched");
  charge(kick, 7.6);
  assert.ok(Math.hypot(kick.x - from.x, kick.z - from.z) > 0.3, "run into: shoved away");
}
// a guest walking by pushes things gently (a ball rolling into a standing prop hard can topple it, though)
{
  loose.reset();
  const cone = of("cone"),
    dt = 1 / 60,
    guest = { id: 1, status: "enter", x: cone.x, z: cone.z - 1, y: 0 },
    fake = { coaches: [coachAt(-50, -50)], people: [guest], level: 3 };
  for (let f = 0; f < 80; f++) {
    guest.z += 2 * dt;
    world.clock += dt;
    loose.update(fake, dt);
  }
  assert.equal(cone.tipped, 0, "a guest strolling into a cone does not knock it over");
}
// a new shift: everything back where it stood
world.resetActors();
for (const it of loose.items) {
  assert.equal(it.x, it.home.x);
  assert.equal(it.tipped, 0);
  assert.ok(it.object.quaternion.equals(it.home.q));
}
assert.equal(sim.score, scoreBefore, "the simulation never sees them");
assert.ok(!JSON.stringify(Object.keys(sim)).includes("loose"));

// 3) The Cruise Ship: its steamer chairs and balls are loose props too, and slide with the roll.
{
  const cruise = new PoolSimulation(3, 1, { config: { ...SHIFTS[2], venue: "cruise" } });
  world.setVenue(cruise.venue);
  const steamers = world.loose.items.filter((it) => it.kind === "steamer"),
    balls = world.loose.items.filter((it) => it.kind === "ball");
  assert.ok(steamers.length >= 4 && balls.length >= 2, "the cruise's chairs and balls joined");
  const ball = balls[0],
    from = ball.z,
    still = { coaches: [coachAt(-50, -50)], people: [], level: 3 };
  world.loose.tilt.z = 9.8 * Math.sin(0.18);
  for (let f = 0; f < 120; f++) {
    world.clock += 1 / 60;
    world.loose.update(still, 1 / 60);
  }
  assert.ok(ball.z > from + 0.3, "a ball rolls downhill as the ship leans");
}
void quiet; // (warnings stay quiet: the cruise asks for its models after the checks are done)
console.log(
  "Loose props checks passed: a kit of loose things in every venue, on free deck by the walls, the same places each time; a ball kicked at a run rolls away; a pot rocks at a walk and falls over at a run; a jump clears them; a guest strolling past does not knock anything over; a new shift puts them back; the cruise's chairs and balls slide with the roll; the simulation never sees them.",
);
