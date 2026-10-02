// Incident moments. Every problem announces itself (an `incident` event with a position, which the game turns into
// a sting) and every save pays off (a `save` event: stamp, hit-stop, cheer), all driven through the real game code
// paths. The loud alert always points at the next place to go: the life ring before the victim, the treats before
// the dog, the flashlight before the breakers. The presentation rules hold too: first sightings teach and are
// remembered, stings queue rather than stack, slow motion and hit-stops always hand full speed back, incident
// banners drain a fuse for timed threats, and the off-screen arrow points the right way (including "behind you" in
// the Coach Cam). The overview camera briefly makes room for a new incident; the Coach Cam never turns your head.
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { PoolSimulation } from "./dist/sim.mjs";
import { MomentDirector, edgeArrow, STINGS, SAVES, MOMENT_TIMING as T } from "./dist/moments.mjs";
import { tick, go, pursue } from "./check-helpers.mjs";

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const drain = (s) => s.events.splice(0);
function reported(s, type, kind, extra = {}) {
  const e = s.events.find((x) => x.type === type && x.kind === kind);
  assert.ok(e, `The ${type} "${kind}" is reported`);
  assert.ok(Number.isFinite(e.x) && Number.isFinite(e.z), `"${kind}" says where it happened`);
  for (const [key, value] of Object.entries(extra)) assert.equal(e[key], value, `"${kind}" ${key}`);
  assert.ok(type === "incident" ? STINGS[kind] : SAVES[kind], `"${kind}" has a sting or stamp`);
  return e;
}
function shift(level, seed = 3) {
  const s = new PoolSimulation(level, seed);
  s.schedule = [];
  s.chaosPlan = [];
  s.start();
  return s;
}
function swimmer(s, lane, extra = {}) {
  const p = s.spawn({ type: "intermediate", sick: false });
  Object.assign(p, {
    status: "swim",
    lane,
    p: 6 + lane * 5,
    workTime: 5,
    traveled: 9,
    workTarget: 999,
    needsFins: false,
    crampAt: Infinity,
    h: 95,
    ...extra,
  });
  return p;
}
const standAt = (point, reach = 0.85) => ({
  x: point.x + Math.sin(point.angle) * reach,
  z: point.z + Math.cos(point.angle) * reach,
});
// Swim at a moving target until `done()`.
function swimTo(s, target, done, limit = 60 * 30) {
  for (let f = 0; f < limit && !done(); f++) {
    const t = target(),
      dx = t.x - s.coach.x,
      dz = t.z - s.coach.z,
      n = Math.hypot(dx, dz) || 1;
    s.setMovement(dx / n, dz / n);
    tick(s);
  }
  s.clearInput();
  return done();
}
// Walk to the +X pool edge level with `z` and keep walking until the coach dives in.
function diveAt(s, z) {
  go(s, s.venue.pool.solidX + 0.7, z);
  s.setMovement(-1, 0);
  for (let f = 0; f < 180 && !s.coach.swimming; f++) tick(s);
  s.clearInput();
  assert.ok(s.coach.swimming, "The coach dives in");
}

// 1) Cramp: the ring first, then the victim; handing the ring over is the save.
{
  const s = shift(5);
  const p = swimmer(s, 1);
  tick(s, 2);
  assert.equal(s.loudestAlert(), null, "A calm pool has no loud alert");
  drain(s);
  assert.ok(s.startCramp(p));
  reported(s, "incident", "cramp", { name: p.name });
  let a = s.loudestAlert();
  assert.equal(a.kind, "cramp");
  assert.equal(a.label, "Life ring", "Before the victim: the nearest life ring");
  assert.equal(a.urgency, 100);
  const ring = s.lifeRings
    .filter((r) => r.state === "wall")
    .sort((q, r) => distance(q, s.coach) - distance(r, s.coach))[0];
  assert.deepEqual([a.x, a.z], [ring.x, ring.z]);
  go(s, ...Object.values(standAt(ring.mount, 1.1)));
  assert.ok(s.interact());
  assert.equal(s.coach.carry, "lifering");
  a = s.loudestAlert();
  assert.equal(a.id, p.id, "With the ring in hand: the victim");
  drain(s);
  diveAt(s, p.z);
  assert.ok(
    swimTo(
      s,
      () => p,
      () => s.rescue?.stage !== "stranded",
    ),
  );
  reported(s, "save", "rescue", { name: p.name, value: 0 });
}

// 2) Stomach trouble: the sick swimmer is the alert; sending them home in time is the save.
{
  const s = shift(5);
  const p = s.spawn({ type: "intermediate", sick: true });
  Object.assign(p, { status: "swim", lane: 0, p: 6, workTarget: 999, crampAt: Infinity, stomachDelay: 0.3 });
  drain(s);
  for (let f = 0; f < 120 && !p.stomachWarning; f++) tick(s);
  assert.ok(p.stomachWarning);
  reported(s, "incident", "stomach", { name: p.name });
  const a = s.loudestAlert();
  assert.equal(a.kind, "stomach");
  assert.equal(a.id, p.id);
  assert.equal(a.urgency, 85);
  drain(s);
  s.select(p.id);
  s.home();
  reported(s, "save", "sent-home", { value: 100 });
}

// 3) Accident in the pool: the alert walks through skimmer → scoop → bin → hang → chlorine → pour; the clean,
// reopened pool is the save.
{
  const s = shift(5);
  const others = [swimmer(s, 1), swimmer(s, 2)];
  const p = s.spawn({ type: "intermediate", sick: true });
  Object.assign(p, { status: "swim", lane: 0, p: 6, workTarget: 999, crampAt: Infinity, stomachDelay: 99 });
  tick(s, 2);
  drain(s);
  s.catastrophe(p);
  reported(s, "incident", "spill");
  const label = () => s.loudestAlert()?.label,
    c = s.coach;
  assert.equal(label(), "Skimmer");
  c.carry = "skimmer";
  assert.equal(label(), "Scoop it");
  s.cleanup.stage = "caught";
  assert.equal(label(), "Waste bin");
  s.cleanup.stage = "return";
  assert.equal(label(), "Hang it up");
  c.carry = null;
  s.cleanup.stage = "treat";
  assert.equal(label(), "Chlorine");
  c.carry = "chlorine";
  assert.equal(label(), "Pour it in");
  c.carry = null;
  for (let f = 0; f < 60 * 60 && s.people.some((q) => q.status === "evacuating"); f++) tick(s);
  Object.assign(s, { contamination: 0, chlorine: 50 });
  drain(s);
  for (let f = 0; f < 60 * 6 && s.cleanup; f++) tick(s);
  assert.equal(s.cleanup, null, "The pool reopens");
  reported(s, "save", "cleanup");
  assert.ok(others.length);
}

// 4) Fish kid: the kid is the alert (with a draining fuse on the banner); stopping them on the deck is the save.
{
  const s = shift(11, 5);
  drain(s);
  assert.ok(s.triggerChaos("fish"));
  const kid = s.visitors.find((v) => v.kind === "kid");
  reported(s, "incident", "fish", { name: kid.name });
  let a = s.loudestAlert();
  assert.equal(a.kind, "fish");
  assert.equal(a.id, kid.id);
  for (let i = 0; i < 120 && Math.abs(kid.x) > 7.3; i++) tick(s);
  const fuse = s.incidentPanel().timer;
  assert.ok(fuse > 0 && fuse <= 1, "The banner's fuse shows how far the kid still has to go");
  assert.ok(
    pursue(
      s,
      () => kid,
      () => s.nearestInteraction()?.kind === "stop-kid",
    ),
  );
  drain(s);
  assert.ok(s.interact());
  reported(s, "save", "fish-stopped", { value: 100 });
}

// 5) Fish in the pool: the net, then the fish, then the kid; catching it and handing it back are saves.
{
  const s = shift(5, 23);
  const swimmers = [0, 1, 2].map((lane) => swimmer(s, lane));
  tick(s, 2);
  s.triggerChaos("fish");
  const kid = s.visitors.find((v) => v.kind === "kid");
  drain(s);
  for (let f = 0; f < 60 * 40 && s.fish.stage !== "loose"; f++) tick(s);
  assert.equal(s.fish.stage, "loose");
  reported(s, "incident", "fish-loose");
  let a = s.loudestAlert();
  assert.equal(a.label, "Fish net");
  const hook = s.venue.fixtures.fishNet;
  go(s, ...Object.values(standAt(hook, 0.9)));
  assert.ok(s.interact());
  assert.equal(s.loudestAlert().label, "Fish", "Net in hand: the fish");
  drain(s);
  diveAt(s, -3.5);
  assert.ok(
    swimTo(
      s,
      () => s.fish,
      () => s.fish.stage !== "loose",
      60 * 45,
    ),
  );
  reported(s, "save", "fish-caught", { value: 75 });
  a = s.loudestAlert();
  assert.equal(a.kind, "fish-return");
  assert.equal(a.id, kid.id, "Then hand the fish back");
  s.setMovement(1, 0);
  for (let f = 0; f < 400 && (s.coach.swimming || s.coach.waterTransition); f++) tick(s);
  s.clearInput();
  go(s, kid.x + (kid.x > 0 ? 0.9 : -0.9), kid.z);
  drain(s);
  assert.equal(s.nearestInteraction()?.kind, "return-fish");
  assert.ok(s.interact());
  reported(s, "save", "fish-returned", { value: 50 });
  assert.ok(swimmers.length);
}

// 6) Loose dog: treats → dog → locker door; leading it out is the save.
{
  const s = shift(7, 4);
  drain(s);
  assert.ok(s.triggerChaos("dog"));
  const dog = s.visitors.find((v) => v.kind === "dog");
  reported(s, "incident", "dog", { name: dog.name });
  assert.equal(s.loudestAlert().label, "Treats");
  const jar = s.venue.fixtures.treats;
  go(s, jar.x + 1.2, jar.z);
  assert.ok(s.interact());
  assert.equal(s.loudestAlert().id, dog.id, "Treats in hand: the dog");
  assert.ok(
    pursue(
      s,
      () => dog,
      () => s.dog.stage === "following",
      900,
    ),
  );
  const exit = s.loudestAlert();
  assert.equal(exit.label, "Locker door", "It follows: the nearest locker door");
  drain(s);
  go(s, exit.x, exit.z + 0.6);
  for (let f = 0; f < 240 && s.dog?.stage === "following"; f++) tick(s);
  reported(s, "save", "dog-out", { value: 150 });
}

// 7) Cannonball Carl: Carl is the alert (with a fuse until his first jump); the red card is the save.
{
  const s = shift(11);
  drain(s);
  s.triggerChaos("carl");
  const carl = s.visitors[0];
  reported(s, "incident", "carl");
  const a = s.loudestAlert();
  assert.equal(a.id, carl.id);
  assert.equal(a.urgency, 88);
  for (let f = 0; f < 90 && carl.status === "entering"; f++) tick(s);
  const fuse = s.incidentPanel().timer;
  assert.ok(fuse > 0 && fuse <= 1);
  assert.ok(
    pursue(
      s,
      () => carl,
      () => s.nearestInteraction()?.kind === "red-card",
      900,
    ),
  );
  drain(s);
  assert.ok(s.interact());
  reported(s, "save", "red-card", { value: 100 });
}

// 8) Power outage: the fuse box while the lights flicker (a 7-second fuse); a reset in time is a save. Miss it and
// the blackout needs the flashlight first; restoring the lights is a save too.
{
  const s = shift(7, 3);
  drain(s);
  s.triggerChaos("outage");
  const fx = s.venue.fixtures;
  reported(s, "incident", "flicker", { x: fx.fuseBox.x, z: fx.fuseBox.z });
  const a = s.loudestAlert();
  assert.equal(a.label, "Fuse box");
  assert.equal(a.urgency, 92);
  const full = s.incidentPanel().timer;
  tick(s, 120);
  assert.ok(full > 0.95 && s.incidentPanel().timer < full - 0.2, "The fuse drains as the seconds pass");
  Object.assign(s.coach, standAt(fx.fuseBox));
  assert.equal(s.nearestInteraction()?.kind, "reset-breaker");
  drain(s);
  s.interact();
  tick(s, 60);
  reported(s, "save", "breaker", { value: 100 });
}
{
  const s = shift(8, 7);
  s.triggerChaos("outage");
  drain(s);
  for (let f = 0; f < 60 * 8 && s.outage.stage !== "dark"; f++) tick(s);
  reported(s, "incident", "blackout");
  const fx = s.venue.fixtures;
  assert.equal(s.loudestAlert().label, "Flashlight", "In the dark: the flashlight first");
  go(s, fx.flashlight.x - 0.9, fx.flashlight.z);
  assert.ok(s.interact());
  assert.equal(s.loudestAlert().label, "Fuse box");
  go(s, ...Object.values(standAt(fx.fuseBox)));
  drain(s);
  s.interact();
  tick(s, 100);
  reported(s, "save", "lights", { value: 100 });
}

// 9) Trampoline: a busy splash lane when a daredevil reaches the tower, the jump anyway, and the crash; the alert
// points at the swimmer to move, then at a life ring. A clean landing and first aid are saves.
{
  const s = shift(12, 5);
  const tr = s.venue.trampoline;
  const inLane = swimmer(s, tr.lane);
  tick(s, 2);
  const d = s.spawn({ type: "daredevil", sick: false });
  s.select(d.id);
  assert.ok(s.assignTrampoline());
  drain(s);
  for (let f = 0; f < 60 * 20 && d.jumpStage !== "waiting"; f++) tick(s);
  const tower = reported(s, "incident", "tower", { name: d.name, lane: tr.lane + 1 });
  assert.equal(STINGS.tower.title.replace("{lane}", tower.lane), `CLEAR LANE ${tr.lane + 1}!`);
  const a = s.loudestAlert();
  assert.equal(a.kind, "tower");
  assert.equal(a.id, inLane.id, "The swimmer to move out of the splash lane");
  assert.ok(s.incidentPanel().timer > 0.9, "The banner's fuse is the daredevil's patience");
  drain(s);
  for (let f = 0; f < 60 * 20 && d.jumpStage === "waiting"; f++) tick(s);
  reported(s, "incident", "tower-go", { name: d.name });
  drain(s);
  for (let f = 0; f < 60 * 20 && !s.rescue; f++) tick(s);
  reported(s, "incident", "crash");
  assert.equal(s.loudestAlert().kind, "crash");
  assert.equal(s.loudestAlert().label, "Life ring");
}
{
  const s = shift(12, 5);
  const d = s.spawn({ type: "daredevil", sick: false });
  s.select(d.id);
  assert.ok(s.assignTrampoline());
  drain(s);
  for (let f = 0; f < 60 * 30 && d.status === "trampoline"; f++) tick(s);
  reported(s, "save", "landing", { name: d.name });
  assert.ok(!s.events.some((e) => e.type === "incident"), "An empty splash lane is not an incident");
}
{
  const s = shift(11, 9);
  const tr = s.venue.trampoline;
  const p = s.spawn({ type: "beginner", sick: false });
  Object.assign(p, {
    status: "injured",
    problem: "injured",
    resumeLane: tr.lane,
    exitPhase: "deck",
    exitEnd: 1,
    path: [],
    x: 7.55,
    z: 10.8,
    h: 60,
  });
  assert.equal(s.loudestAlert().label, "Med kit", "First aid: the medical kit first");
  Object.assign(s.coach, { carry: "medkit", x: 6.7, z: 10.3 });
  s.medkit.state = "coach";
  assert.equal(s.loudestAlert().id, p.id, "…then the swimmer");
  drain(s);
  assert.ok(s.tendInjured(p.id));
  tick(s, 80);
  reported(s, "save", "healed", { name: p.name });
}

// 10) The loudest alert wins: someone in danger outranks a dog, whatever is nearer.
{
  const s = shift(7, 4);
  const p = swimmer(s, 1);
  tick(s, 2);
  s.triggerChaos("dog");
  assert.equal(s.loudestAlert().kind, "dog");
  assert.ok(s.startCramp(p));
  assert.equal(s.loudestAlert().kind, "cramp");
  s.status = "paused";
  assert.equal(s.loudestAlert(), null, "No alerts outside play");
}

// 11) The director: first sightings teach and are remembered, stings queue, time always comes back.
{
  let remembered = null;
  const d = new MomentDirector({ seen: ["dog"], remember: (list) => (remembered = list) });
  const carl = d.incident({ kind: "carl", x: 1, z: 2 }, 10);
  assert.ok(carl.first && carl.how, "A first sighting carries its one-line lesson");
  assert.equal(carl.title, "CANNONBALL CARL!", "Carl is the default cannonball man");
  assert.equal(
    new MomentDirector().incident({ kind: "carl", x: 0, z: 0, name: "Leopard Man" }, 10).title,
    "CANNONBALL LEOPARD MAN!",
    "and the sting names whoever it is",
  );
  assert.equal(carl.duration, T.firstSting);
  assert.deepEqual([...remembered].sort(), ["carl", "dog"], "…and is remembered for next time");
  assert.equal(d.incident({ kind: "dog", x: 0, z: 0, name: "Biscuit" }, 10.2), null, "A second sting waits");
  assert.equal(d.next(10.5), null);
  const dog = d.next(10 + T.firstSting + 0.01);
  assert.equal(dog.kind, "dog", "…its turn comes when the first one is done");
  assert.equal(dog.first, false);
  assert.equal(dog.how, "", "Repeat sightings are short");
  assert.equal(dog.verb, "Grab the treats · lead Biscuit out");
  assert.equal(d.incident({ kind: "nonsense", x: 0, z: 0 }, 20), null, "Unknown kinds are ignored");
  // Slow motion: dips, holds, then always returns to full speed.
  const e = new MomentDirector({ seen: Object.keys(STINGS) });
  e.incident({ kind: "crash", x: 0, z: 0 }, 100);
  const samples = [];
  for (let t = 100; t < 102; t += 0.01) samples.push(e.timeScale(t));
  assert.equal(Math.min(...samples).toFixed(2), T.slow.scale.toFixed(2), "A repeat sting slows the game");
  assert.equal(e.timeScale(100 + T.rampIn + T.slow.hold + T.rampOut + 0.01), 1, "…and hands full speed back");
  assert.ok(samples.every((v) => v > 0 && v <= 1));
  const f = new MomentDirector();
  f.incident({ kind: "tower", x: 0, z: 0, name: "Zed", lane: 3 }, 0);
  assert.equal(f.active.title, "CLEAR LANE 3!");
  assert.equal(f.timeScale(T.rampIn + 0.5), T.firstSlow.scale, "A first sighting almost stops the game");
  // Hit-stop: a save freezes the game for a beat.
  const pay = f.save({ kind: "red-card", x: 0, z: 0, value: 150 }, 50);
  assert.deepEqual([pay.stamp, pay.value, pay.tier], ["RED CARD!", 150, 2]);
  assert.equal(f.timeScale(50.05), 0);
  assert.equal(f.timeScale(50 + T.freeze[2] + 0.001), 1);
  const small = f.save({ kind: "landing", x: 0, z: 0, value: 40, name: "Zed" }, 60);
  assert.equal(small.tier, 1);
  assert.equal(f.timeScale(60 + T.freeze[1] + 0.001), 1, "Small saves freeze for less");
  // Every sting and stamp is defined for every incident and save the game reports.
  for (const kind of Object.keys(STINGS))
    assert.ok(STINGS[kind].title && STINGS[kind].verb && STINGS[kind].how);
  f.reset();
  assert.equal(f.active, null);
  assert.ok(f.seen.has("tower"), "A new shift keeps what the player has seen");
}

// 12) The off-screen arrow.
{
  const rect = { left: 100, right: 900, top: 100, bottom: 500 };
  assert.equal(edgeArrow({ x: 400, y: 300 }, rect), null, "In the safe area: a marker, not an arrow");
  const right = edgeArrow({ x: 1500, y: 300 }, rect);
  assert.deepEqual([right.x, right.y, +right.angle.toFixed(3)], [900, 300, 0]);
  const up = edgeArrow({ x: 500, y: -900 }, rect);
  assert.deepEqual([up.x, up.y], [500, 100]);
  assert.ok(Math.abs(up.angle + Math.PI / 2) < 1e-9);
  const corner = edgeArrow({ x: 1300, y: 900 }, rect);
  assert.ok(corner.x === 900 || corner.y === 500, "On the edge of the safe area");
  assert.ok(Math.cos(corner.angle) > 0 && Math.sin(corner.angle) > 0);
  // Behind the Coach Cam: point the way to turn; straight behind points down.
  const behindRight = edgeArrow({ x: 0, y: 0, behind: true, lean: 1 }, rect);
  assert.equal(behindRight.x, 900);
  assert.ok(Math.cos(behindRight.angle) > 0.95);
  const behindLeft = edgeArrow({ x: 0, y: 0, behind: true, lean: -0.9 }, rect);
  assert.equal(behindLeft.x, 100);
  const straight = edgeArrow({ x: 0, y: 0, behind: true, lean: 0 }, rect);
  assert.equal(straight.y, 500);
  assert.ok(Math.sin(straight.angle) > 0.9, "Straight behind: at the bottom, pointing down");
}

// 13) The camera: the overview makes room for a new incident for a moment; the Coach Cam and reduced motion never
// move the view; the Coach Cam knows which side a target behind the player is on.
{
  const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  const { createCanvas } = runtime
    ? await import(pathToFileURL(runtime + "/@napi-rs/canvas/index.js"))
    : await import("@napi-rs/canvas");
  globalThis.document = { createElement: () => createCanvas(256, 128) };
  let reduced = false;
  globalThis.window = {
    matchMedia: () => ({
      get matches() {
        return reduced;
      },
    }),
  };
  const { PoolWorld } = await import("./dist/scene.mjs");
  const world = new PoolWorld({ clientWidth: 1600, clientHeight: 900 }, () => {}, { headless: true });
  const s = shift(7);
  world.viewDirection ??= true;
  for (let i = 0; i < 30; i++) world.sync(s, i / 60, 1 / 60);
  const before = world.target.clone();
  world.focusMoment(-9, -10, 2);
  assert.equal(world.attention(s)[0]?.moment, true, "A new incident joins the camera's attention");
  for (let i = 0; i < 60; i++) world.sync(s, 1 + i / 60, 0, 1 / 60);
  assert.ok(
    world.target.distanceTo(before) > 0.3,
    "The overview glides toward it, even while the game is frozen",
  );
  for (let i = 0; i < 180; i++) world.sync(s, 3 + i / 60, 1 / 60);
  assert.equal(world.attention(s).length, 0, "…and lets go afterwards");
  reduced = true;
  world.focusMoment(-9, -10, 2);
  assert.equal(world.attention(s).length, 0, "Reduced motion keeps the camera still");
  reduced = false;
  world.setViewMode("coach", s);
  world.focusMoment(-9, -10, 2);
  assert.equal(world.attention(s).length, 0, "The Coach Cam never turns the player's head");
  for (let i = 0; i < 10; i++) world.sync(s, 6 + i / 60, 1 / 60);
  const c = s.coach,
    yaw = world.coachCam.yaw,
    ahead = world.screenPoint(c.x + Math.sin(yaw) * 5, 1.5, c.z + Math.cos(yaw) * 5),
    behind = world.screenPoint(c.x - Math.sin(yaw) * 5, 1.5, c.z - Math.cos(yaw) * 5),
    right = { x: -Math.cos(yaw), z: Math.sin(yaw) },
    behindRight = world.screenPoint(
      c.x - Math.sin(yaw) * 5 + right.x * 4,
      1.5,
      c.z - Math.cos(yaw) * 5 + right.z * 4,
    );
  assert.equal(ahead.behind, false);
  assert.equal(behind.behind, true, "A target at the player's back is behind");
  assert.ok(Math.abs(behind.lean) < 0.05);
  assert.ok(behindRight.lean > 0.5, "…and one over the right shoulder leans right");
}
console.log(
  "Moment checks passed: stings and saves for cramps, stomach trouble, spills, the fish kid, loose fish, dogs, Carl, flickers, blackouts, the tower, crashes, landings and first aid; loud alerts point at the next step; first sightings teach once; stings queue; slow motion and hit-stops return; fuse timers drain; edge arrows (and behind-you) point right; the camera nudge stays out of the Coach Cam.",
);
