import assert from "node:assert/strict";
import { PoolSimulation } from "./dist/sim.mjs";
import { prepareDeck, resolveDeck, bumpLean, BUMP_DURATION } from "./dist/deck-physics.mjs";
import { isDeckPosition } from "./dist/spatial.mjs";
const fresh = () => {
  const s = new PoolSimulation(3, 91);
  s.schedule = [];
  s.start();
  return s;
};
const frames = (s, n) => {
  for (let i = 0; i < n; i++) s.tick(1 / 60);
};

// Opposing and crossing walkers actually separate, then finish their original routes.
for (const crossing of [false, true]) {
  const s = fresh(),
    a = s.spawn(),
    b = s.spawn();
  Object.assign(a, { status: "enter", x: -3, z: -10, path: [{ x: 3, z: -10 }] });
  Object.assign(
    b,
    crossing
      ? { status: "enter", x: 0, z: -13, path: [{ x: 0, z: -9 }] }
      : { status: "enter", x: 3, z: -10, path: [{ x: -3, z: -10 }] },
  );
  const targets = [{ ...a.path[0] }, { ...b.path[0] }];
  let bumped = false;
  for (let f = 0; f < 600; f++) {
    prepareDeck(s, 1 / 60);
    for (const p of [a, b]) s.moveAlong(p, 1 / 60, 3.3);
    resolveDeck(s);
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 0.715, "Bodies remain separated at the crossing");
    bumped ||= a.bumpTime > 0 && b.bumpTime > 0;
  }
  assert.ok(bumped);
  for (const [i, p] of [a, b].entries()) {
    assert.equal(p.path.length, 0);
    assert.ok(Math.hypot(p.x - targets[i].x, p.z - targets[i].z) < 0.01);
    assert.equal(p.slipTime, 0);
    assert.equal(p.bumpTime, 0);
  }
  assert.equal(s.score, 0);
  assert.equal(s.stats.collisions, 0, "Friendly bumps do not invoke pool collision penalties");
}

// A walker can get past a waiting swimmer; the waiting swimmer returns to their spot.
{
  const s = fresh(),
    a = s.spawn(),
    b = s.spawn();
  Object.assign(a, { status: "enter", x: -3, z: -11.1, path: [{ x: 3, z: -11.1 }] });
  Object.assign(b, { x: 0, z: -11.1 });
  for (let f = 0; f < 600; f++) {
    prepareDeck(s, 1 / 60);
    s.moveAlong(a, 1 / 60, 3.3);
    resolveDeck(s);
  }
  assert.equal(a.path.length, 0);
  assert.ok(Math.hypot(b.x, b.z + 11.1) < 0.02);
}

// Dense simultaneous assignments must not deadlock on shared turning points or entries.
for (const count of [8, 16, 27]) {
  const s = fresh(),
    people = Array.from({ length: count }, () => s.spawn({ type: "beginner", sick: false }));
  for (const p of people) {
    s.select(p.id);
    s.assign(p.id % 3);
    p.needsFins = false;
  }
  const entered = new Set();
  for (let f = 0; f < 1500; f++) {
    s.tick(1 / 60);
    for (const p of people) {
      if (p.status === "swim") entered.add(p.id);
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z));
    }
  }
  assert.equal(entered.size, count, "Every swimmer reaches the water");
}

// Coach contacts yield without falling; airborne coach skips deck contacts.
for (const airborne of [false, true]) {
  const s = fresh(),
    p = s.spawn();
  Object.assign(p, { x: -6.6, z: 0.4 });
  s.coach.y = airborne ? 1 : 0;
  resolveDeck(s);
  assert.equal(p.bumpTime > 0, !airborne);
  assert.equal(p.slipTime, 0);
  assert.ok(isDeckPosition(s.coach.x, s.coach.z));
  if (!airborne) {
    assert.ok(Math.hypot(p.x - s.coach.x, p.z - s.coach.z) >= 0.715);
    const before = p.bumpTime;
    s.status = "paused";
    frames(s, 30);
    assert.equal(p.bumpTime, before);
  }
}

// Lean is subtle, directional, finite, and disabled by reduced motion.
{
  const p = { angle: 0, bumpX: 0.9, bumpZ: 0, slipTime: 0 };
  let peak = 0;
  for (let t = 0; t <= 1; t += 0.01) {
    p.bumpTime = BUMP_DURATION * (1 - t);
    const lean = bumpLean(p);
    peak = Math.max(peak, Math.abs(lean.z));
    assert.deepEqual(bumpLean(p, true), { x: 0, z: 0 });
    assert.ok(Math.abs(lean.x) < 0.13 && Math.abs(lean.z) < 0.13);
  }
  assert.ok(peak > 0.06);
  p.bumpTime = 0;
  assert.deepEqual(bumpLean(p), { x: 0, z: 0 });
}
console.log(
  "Deck checks passed: solid opposing/crossing contacts, gentle recoil, queue bypass and recovery, 27-swimmer arrival completion, grounded/airborne coach, pause, no falls/penalties, and reduced-motion wobble.",
);
