// Karen: she walks in, marches at the coach, annoys the deck on the way, and is calmed by holding E.
import assert from "node:assert/strict";
import { PoolSimulation, SHIFTS } from "./dist/sim.mjs";
import { KAREN_TUNING as T, KAREN_GESTURES } from "./dist/incidents/karen.mjs";
import { STINGS, SAVES } from "./dist/moments.mjs";
import { tick, go, pursue, assignAll } from "./check-helpers.mjs";

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function shift(seed, level = 4, seconds = 14) {
  const s = new PoolSimulation(level, seed);
  s.chaosPlan = [];
  s.start();
  for (let f = 0; f < 60 * seconds; f++) {
    assignAll(s);
    tick(s);
  }
  return s;
}
const karenOf = (s) => s.visitors.find((v) => v.kind === "karen");
const events = (s, type) => s.events.filter((e) => e.type === type);

// ---------------------------------------------------------------------------------------------------------
// She is on the season: a seeded entry on level 4, and every moment (sting, stamp) is written.
{
  const entry = SHIFTS[3].chaos.find((c) => c.kinds.includes("karen"));
  assert.ok(entry, "Level 4 schedules Karen");
  const s = new PoolSimulation(4, 5);
  assert.ok(
    s.chaosPlan.some((p) => p.kind === "karen"),
    "The plan holds a Karen",
  );
  assert.ok(STINGS.karen?.how && STINGS.karen.verb.includes("E"), "Her sting teaches the hold");
  assert.equal(SAVES.karen.stamp, "CALMED DOWN!");
  assert.ok(
    KAREN_GESTURES.some((g) => g.kind === "point" && g.at === "pool"),
    "She points at the pool",
  );
  assert.ok(
    KAREN_GESTURES.some((g) => g.kind === "point" && g.at === "random"),
    "...and at random",
  );
}

// ---------------------------------------------------------------------------------------------------------
// She comes through a locker door, walks to the coach and never goes near the water.
{
  const s = shift(7);
  assert.ok(s.triggerChaos("karen"));
  assert.ok(s.karen && s.isDeck(s.coach.x, s.coach.z));
  assert.equal(s.triggerChaos("karen"), false, "Only one Karen at a time");
  const v = karenOf(s);
  assert.equal(v.status, "entering");
  assert.ok(
    events(s, "incident").some((e) => e.kind === "karen"),
    "The sting fires",
  );
  assert.equal(s.visitorTag(v).icon, "😡");
  const door = s.venue.arrival;
  const seen = new Set();
  let nearest = Infinity;
  for (let f = 0; f < 60 * 25 && v.status !== "ranting"; f++) {
    assignAll(s);
    tick(s);
    seen.add(v.status);
    nearest = Math.min(nearest, dist(v, s.coach));
    if (v.status !== "entering") assert.ok(Math.abs(v.x) < door.insideX + 0.01);
    if (["marching", "ranting"].includes(v.status) && Math.abs(v.x) <= door.outsideX + 0.1)
      assert.ok(s.venue.isDeck(v.x, v.z, s.level, 0.1), "Once outside she stays on the deck");
  }
  assert.ok(seen.has("marching") && v.status === "ranting", "She marches, then rants at the coach");
  assert.ok(dist(v, s.coach) <= T.stop + 0.3, "She stops right in front of the coach");
  assert.ok(events(s, "karen-arrive").length, "Arrival is announced");
  // The coach moves off: she follows.
  const before = { x: v.x, z: v.z };
  go(s, s.coach.x, s.coach.z > 0 ? s.coach.z - 7 : s.coach.z + 7);
  for (let f = 0; f < 60 * 4; f++) tick(s);
  assert.ok(dist(v, before) > 3, "She follows the coach around the deck");
  assert.equal(s.alerts?.length ?? 0, 0);
  assert.equal(s.loudestAlert()?.kind, "karen", "She is the loud alert");
  assert.ok(s.incidentHint().includes("Karen") || s.hint?.includes?.("Karen"));
  assert.ok(s.incidentPanel()?.title.includes("KAREN"));
}

// ---------------------------------------------------------------------------------------------------------
// Her radius: people on the deck stop, are marked annoyed once each (score, happiness) and carry on afterwards.
{
  const s = new PoolSimulation(4, 11);
  s.chaosPlan = [];
  s.start();
  for (let f = 0; f < 60 * 14; f++) tick(s); // nobody is assigned: the deck fills up
  const queued = s.people.filter((p) => p.status === "queue");
  assert.ok(queued.length >= 2, "There are people waiting in the queue");
  s.triggerChaos("karen");
  const v = karenOf(s);
  // Put Karen in the middle of the queue.
  v.status = "ranting";
  v.path = [];
  v.hold = 0;
  const q = queued[0];
  v.x = q.x + 0.8;
  v.z = q.z;
  const walker = s.spawn({ type: "beginner", sick: false });
  walker.status = "enter";
  walker.x = v.x + 1.2;
  walker.z = v.z;
  walker.path = [{ x: v.x + 6, z: v.z }];
  const score = s.score,
    walkerAt = { x: walker.x, z: walker.z };
  s.coach.x = v.x + 1.5; // she stays put: the coach is right there, out of everyone's way
  s.coach.z = v.z + 1.5;
  const near = s.people.filter((p) => ["queue", "enter"].includes(p.status) && dist(p, v) <= T.radius);
  assert.ok(near.length >= 2);
  const waits = near.map((p) => p.h);
  for (let f = 0; f < 30; f++) tick(s);
  for (const p of near) assert.ok(p.karenAnnoyed > 0, p.name + " is annoyed");
  assert.equal(s.score, score - T.penalty * s.karen.annoyed.size, "Each person costs a fixed amount, once");
  assert.equal(s.stats.annoyed, s.karen.annoyed.size);
  assert.ok(
    Math.hypot(walker.x - walkerAt.x, walker.z - walkerAt.z) < 0.01,
    "A walker stops where they stand",
  );
  for (let f = 0; f < 60 * 3; f++) tick(s);
  assert.equal(s.score <= score - T.penalty * near.length, true);
  const annoyed = s.karen.annoyed.size;
  for (let f = 0; f < 60 * 2; f++) tick(s);
  assert.equal(s.karen.annoyed.size, annoyed, "Staying near her does not charge twice");
  assert.equal(near[0].h <= waits[0], true);
  // Someone far from her is not annoyed.
  const far = s.people.filter((p) => annoyable(p) && dist(p, v) > T.radius + 1);
  for (const p of far) assert.ok(!(p.karenAnnoyed > 0));
  function annoyable(p) {
    return ["queue", "enter", "arriving"].includes(p.status);
  }
}

// ---------------------------------------------------------------------------------------------------------
// Calming: hold E until the ring fills; let go and it drains; she leaves and the influence ends.
{
  const s = shift(13);
  s.triggerChaos("karen");
  const v = karenOf(s);
  assert.ok(
    pursue(
      s,
      () => v,
      () => s.nearestInteraction()?.kind === "calm",
      60 * 30,
    ),
    "The coach can reach Karen and be offered the calming action",
  );
  assert.equal(s.nearestInteraction().rank < -300, true, "Calming outranks routine service");
  s.clearInput();
  // Press E with the key held: progress fills while held.
  s.setHold(true);
  assert.ok(s.interact());
  assert.ok(s.karen.calming && s.coach.calming);
  const at = { x: s.coach.x, z: s.coach.z };
  s.setMovement(1, 0); // the arrow keys do nothing while calming
  for (let f = 0; f < 60 * 1; f++) tick(s);
  assert.ok(s.karen.progress > 0.25 && s.karen.progress < 0.45, "About a third of the ring after a second");
  assert.ok(dist(s.coach, at) < 0.01, "The coach is planted while calming");
  const facing = Math.atan2(v.x - s.coach.x, v.z - s.coach.z);
  assert.ok(Math.abs(Math.atan2(Math.sin(s.coach.angle - facing), Math.cos(s.coach.angle - facing))) < 0.05);
  assert.equal(s.visitorTag(v).ring, s.karen.progress, "The ring is on her tag");
  // Let go: the ring drains and Karen stays.
  s.setMovement(0, 0);
  s.setHold(false);
  tick(s);
  assert.equal(s.karen.calming, false);
  const held = s.karen.progress;
  for (let f = 0; f < 60 * 0.5; f++) tick(s);
  assert.ok(s.karen.progress < held, "The ring drains once E is released");
  // Hold again, all the way.
  s.setMovement(0, 0);
  s.setHold(true);
  assert.ok(s.interact());
  const score = s.score,
    annoyed = s.karen.annoyed.size;
  for (let f = 0; f < 60 * 5 && v.status !== "calmed"; f++) tick(s);
  assert.equal(v.status, "calmed", "She calms down");
  assert.equal(s.coach.calming, false);
  assert.equal(s.score, score + T.reward + (annoyed ? 0 : T.cleanBonus));
  assert.ok(
    events(s, "save").some((e) => e.kind === "karen"),
    "The save stamps",
  );
  assert.equal(s.stats.calmed, 1);
  assert.equal(s.nearestInteraction()?.kind === "calm", false, "No more calming once she is calm");
  assert.equal(s.visitorTag(v).icon, "😌");
  s.setHold(false);
  for (let f = 0; f < 60 * 25 && s.karen; f++) tick(s);
  assert.equal(s.karen, null, "She has left");
  assert.equal(s.visitors.length, 0, "...through a locker door");
  assert.equal(s.activeSystems().length, 0);
  // Nobody stays annoyed.
  for (let f = 0; f < 60; f++) tick(s);
  assert.ok(s.people.every((p) => !(p.karenAnnoyed > 0)));
}

// ---------------------------------------------------------------------------------------------------------
// A click or a tap (no key down) starts a latched calm: it carries on until the coach moves.
{
  const s = shift(17);
  s.triggerChaos("karen");
  const v = karenOf(s);
  assert.ok(
    pursue(
      s,
      () => v,
      () => s.nearestInteraction()?.kind === "calm",
      60 * 30,
    ),
  );
  s.clearInput();
  assert.ok(s.interact());
  assert.ok(s.karen.latched);
  for (let f = 0; f < 60; f++) tick(s);
  assert.ok(s.karen.calming && s.karen.progress > 0.25, "It carries on by itself");
  s.setMovement(0, 1);
  tick(s);
  assert.equal(s.karen.calming, false, "Moving cancels it");
  s.setMovement(0, 0);
  s.coach.x += 0; // stepping out of reach cancels it too
  assert.ok(s.interact());
  s.coach.x = v.x + (v.x > 0 ? -1 : 1) * (T.reach + 1);
  tick(s);
  assert.equal(s.karen.calming, false, "Walking out of reach cancels it");
}

// ---------------------------------------------------------------------------------------------------------
// Left alone for a whole shift she is a steady drain; swimmers are generated the same with or without her.
{
  const seed = 23;
  const a = new PoolSimulation(4, seed),
    b = new PoolSimulation(4, seed);
  b.chaosPlan = b.chaosPlan.filter((p) => p.kind !== "karen");
  assert.deepEqual(
    a.schedule.map((e) => [e.at, e.type]),
    b.schedule.map((e) => [e.at, e.type]),
    "Karen does not change who arrives",
  );
  a.chaosPlan = a.chaosPlan.filter((p) => p.kind === "karen"); // (an idle bot would leave the dog running)
  a.start();
  for (let f = 0; f < 60 * 100 && !a.karen; f++) {
    assignAll(a);
    tick(a);
  }
  assert.ok(a.karen, "She turns up inside her window");
  assert.ok(a.time >= 73 && a.time <= 96, "...between 74 and 94 seconds in");
}

// ---------------------------------------------------------------------------------------------------------
// On screen (headless, no WebGL): her stand-in walks and rants, the red scribbles and her circle appear, people near
// her cover their ears and ease back when she is calm, and the coach pats the air while calming her.
{
  const { createCanvas } = await import("@napi-rs/canvas");
  globalThis.document = { createElement: () => createCanvas(256, 128) };
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  const { PoolWorld } = await import("./dist/scene.mjs");
  const { karenClip } = await import("./dist/scene/karen-view.mjs");
  const world = new PoolWorld({ clientWidth: 1440, clientHeight: 900 }, () => {}, { headless: true });
  const s = new PoolSimulation(4, 11);
  s.chaosPlan = [];
  s.start();
  for (let f = 0; f < 60 * 14; f++) tick(s);
  s.triggerChaos("karen");
  const v = karenOf(s);
  let t = 0;
  const frames = (n) => {
    for (let f = 0; f < n; f++) {
      s.tick(1 / 60);
      t += 1 / 60;
      world.sync(s, t, 1 / 60);
    }
  };
  frames(2);
  const iv = world.incidentView;
  assert.equal(iv.visitors.size, 1, "Her model is in the scene");
  assert.equal(iv.karenField.visible, false, "Her circle waits until she is out of the locker room");
  // Put her in the middle of the queue, ranting at the coach.
  v.status = "ranting";
  v.hold = 0;
  v.path = [];
  const q = s.people.find((p) => p.status === "queue");
  v.x = q.x + 1;
  v.z = q.z;
  s.coach.x = v.x + 1.4;
  s.coach.z = v.z + 1.4;
  frames(90);
  assert.equal(iv.karenField.visible, true, "Her circle shows while she is loud");
  assert.ok(iv.scribbles.live.length > 0, "Red scribbles fly out of her head");
  assert.ok(iv.scribbles.live.every((x) => x.sprite.position.y > 1.9));
  const u = world.people.get(q.id).userData;
  assert.ok(u.annoy > 0.95, "The person next to her is fully annoyed");
  assert.ok(u.arms[0].rotation.z > 2.5 && u.arms[1].rotation.z < -2.5, "Both hands are over the ears");
  assert.ok(u.root.rotation.x > 0.25, "...hunched forward");
  assert.deepEqual(karenClip({ status: "marching", hold: 0 }), ["Walk", 1.15]);
  assert.equal(karenClip({ status: "ranting", gesture: "point" })[0], "Point");
  assert.equal(karenClip({ status: "ranting", gesture: "complain" })[0], "Complain");
  assert.equal(karenClip({ status: "calmed" })[0], "Defeated");
  // The coach calms her.
  s.setHold(true);
  assert.ok(s.interact());
  frames(30);
  const arms = world.coach.userData.arms;
  assert.ok(
    arms.every((a) => a.rotation.x < -0.8),
    "The coach's arms are out in front",
  );
  assert.equal(world.coach.userData.carry.visible, false);
  const swing = [];
  for (let f = 0; f < 30; f++) {
    frames(1);
    swing.push(arms[0].rotation.x);
  }
  assert.ok(Math.max(...swing) - Math.min(...swing) > 0.5, "...swinging up and down");
  // Calmed: she leaves and the room goes back to normal.
  for (let f = 0; f < 60 * 5 && v.status !== "calmed"; f++) frames(1);
  assert.equal(v.status, "calmed");
  s.setHold(false);
  frames(60 * 3);
  assert.ok(u.annoy < 0.01, "Everyone relaxes after she has left");
  assert.equal(iv.karenField.visible, false);
  assert.ok(world.coach.userData.carry.visible === false || !s.coach.carry);
  for (let f = 0; f < 60 * 25 && s.karen; f++) frames(1);
  assert.equal(iv.visitors.size, 0, "Her model is removed when she has gone");
  assert.equal(iv.scribbles.live.length, 0, "...and the scribbles with her");
}

console.log("karen-check: ok");
