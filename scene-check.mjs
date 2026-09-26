// CPU-side scene and projection checks. This does not exercise WebGL rasterization.
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import * as THREE from "./dist/assets/three.module.js";
import { PoolWorld } from "./dist/scene.mjs";
import { PoolSimulation, LANES } from "./dist/sim.mjs";
import { STATIONS, SANITATION, isDeckPosition, createCoach, queuePosition } from "./dist/spatial.mjs";
// Canvas textures need @napi-rs/canvas: `npm install` provides it locally, or point
// CODEX_PRIMARY_RUNTIME_NODE_MODULES at another node_modules folder that contains it.
const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const { createCanvas } = runtime
  ? await import(pathToFileURL(runtime + "/@napi-rs/canvas/index.js"))
  : await import("@napi-rs/canvas").catch(() => {
      throw new Error(
        "Run `npm install` (or set CODEX_PRIMARY_RUNTIME_NODE_MODULES) for the canvas dependency.",
      );
    });
globalThis.document = {
  createElement(tag) {
    assert.equal(tag, "canvas");
    return createCanvas(256, 128);
  },
};
globalThis.window = { matchMedia: () => ({ matches: false }) };
// Headless construction builds the real venue, batching, characters and guidance without WebGL.
const world = new PoolWorld({ clientWidth: 1440, clientHeight: 900 }, () => {}, { headless: true });
world.scene.updateMatrixWorld(true);
for (const flag of world.flags) {
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(flag.getWorldQuaternion(new THREE.Quaternion()));
  const view = world.camera.position.clone().sub(flag.getWorldPosition(new THREE.Vector3())).normalize();
  assert.ok(Math.abs(normal.dot(view)) > 0.35, "Pennants must remain visible from the new camera");
}
const sim = new PoolSimulation(1, 70);
sim.schedule = [];
sim.start();
const p = sim.spawn({ type: "beginner" });
world.sync(sim, 0);
assert.equal(world.guideAura.visible, true);
assert.equal(world.guideAura.position.x, p.x);
assert.ok(world.laneHighlights.every((m) => m.material.opacity === 0));
const initial = world.guideAura.userData.shell.material.opacity;
world.sync(sim, 0.3375);
assert.ok(world.guideAura.userData.shell.material.opacity > initial, "Character aura pulses");
sim.doors[-1] = 1;
world.sync(sim, 0.35);
assert.equal(world.lockerDoors[0].hinge.rotation.y, -1.35);
assert.ok(
  world.lockerDoors[0].hinge.children.some((o) => o.isMesh),
  "Animated door geometry survives static batching",
);
assert.equal(world.lockerDoors[1].hinge.rotation.y, 0);
sim.doors[-1] = 0;
sim.select(p.id);
world.sync(sim, 0.3375);
assert.ok(world.laneHighlights.every((m) => m.material.opacity > 0.3));
assert.ok(world.laneRims.every((m) => m.visible));
assert.equal(
  new Set(world.laneHighlights.map((m) => m.material.opacity)).size,
  1,
  "All three lanes glow together",
);
world.scene.updateMatrixWorld(true);
const ray = new THREE.Raycaster();
for (let i = 0; i < 3; i++) {
  const xy = world.project(LANES[i], -0.12, 0);
  ray.setFromCamera(new THREE.Vector2((xy.x / 1440) * 2 - 1, 1 - (xy.y / 900) * 2), world.camera);
  const hit = ray.intersectObjects(world.clickables, false)[0];
  assert.equal(hit.object.userData.kind, "lane");
  assert.equal(hit.object.userData.lane, i);
}
const xy = world.project(p.x, 0.9, p.z);
ray.setFromCamera(new THREE.Vector2((xy.x / 1440) * 2 - 1, 1 - (xy.y / 900) * 2), world.camera);
assert.equal(
  ray.intersectObjects(world.clickables, false)[0].object.userData.id,
  p.id,
  "Aura does not obstruct character picking",
);
sim.assign(0);
world.sync(sim, 0.6);
assert.equal(world.guideAura.visible, false);
assert.ok(world.laneRims.every((m) => !m.visible));
sim.setMovement(1, 0);
sim.dash();
sim.tick(1 / 60);
world.sync(sim, 1);
assert.equal(world.dashTrail.visible, true);
assert.ok(world.coach.userData.root.rotation.x > 0);
sim.clearInput();
world.sync(sim, 1.1);
assert.equal(world.dashTrail.visible, false);
world.reducedMotion.matches = true;
const q = sim.spawn({ type: "advanced" });
sim.select(q.id);
world.sync(sim, 2);
const glow = world.guideAura.userData.shell.material.opacity;
world.sync(sim, 3);
assert.equal(world.guideAura.userData.shell.material.opacity, glow, "Reduced motion keeps a steady guide");
sim.coach.carry = "fins";
world.sync(sim, 4);
assert.equal(world.coach.userData.carry.visible, true);
world.handoff(sim.coach, { x: 7, z: 3 }, "fins");
world.sync(sim, 4.2, 0.2);
assert.equal(world.handoffs.length, 1);
world.sync(sim, 4.4, 0.2);
assert.equal(world.handoffs.length, 0);
console.log("Desktop camera distance:", world.cameraDistance);
const projections = [];
for (const [w, h] of [
  [1440, 900],
  [1366, 768],
  [390, 844],
  [375, 667],
  [844, 390],
]) {
  world.container.clientWidth = w;
  world.container.clientHeight = h;
  world.resize();
  const c = createCoach(),
    q = queuePosition(-1, 0),
    front = world.project(c.x, 1, c.z),
    first = world.project(q.x, 1, q.z);
  assert.ok(world.camera.position.x < 0);
  assert.ok(Math.abs(world.camera.position.z - world.target.z) < 0.001);
  const left = world.project(0, 0, -7.2),
    right = world.project(0, 0, 7.2);
  assert.ok(Math.abs(right.y - left.y) < 0.01, "Pool length must run horizontally");
  assert.ok(right.x > left.x);
  assert.ok(front.x > 0 && front.x < w && front.y > 0 && front.y < world.container.clientHeight);
  assert.ok(first.x > 0 && first.x < w && first.y > 0);
  projections.push({
    viewport: w + "x" + h,
    coachY: Math.round(front.y),
    firstSwimmerX: Math.round(first.x),
    firstSwimmerY: Math.round(first.y),
  });
}
// Close framing must retain the coach at every reachable deck location and nearby equipment.
let framingCases = 0;
for (const [w, h] of [
  [1920, 1080],
  [1440, 900],
  [1366, 768],
  [390, 844],
  [375, 667],
  [844, 390],
])
  for (const zoom of [1, 1.3]) {
    world.container.clientWidth = w;
    world.container.clientHeight = h;
    world.zoom = zoom;
    world.resize();
    for (let x = -14; x <= 14; x += 2)
      for (let z = -15; z <= 12; z += 2) {
        if (!isDeckPosition(x, z)) continue;
        const c = { x, z, y: 0 };
        world.followCoach(c, 1 / 60);
        const b = world.cameraBounds();
        const points = [
          [x, 0.1, z - 0.5],
          [x, 2.15, z + 0.5],
        ];
        for (const p of [...Object.values(STATIONS), SANITATION.rack, SANITATION.bin])
          if (Math.hypot(x - p.x, z - p.z) < 3.3) points.push([p.x, 0.1, p.z - 0.65], [p.x, 2.7, p.z + 0.65]);
        for (const point of points) {
          const p = world.project(...point);
          assert.ok(
            p.x >= b.left - 1 && p.x <= b.right + 1 && p.y >= b.top - 1 && p.y <= b.bottom + 1,
            `Camera containment ${w}x${h} zoom ${zoom} coach ${x},${z}: ${JSON.stringify(p)} vs ${JSON.stringify(b)}`,
          );
        }
        framingCases++;
      }
  }

// Incident meshes remain live and follow the simulation, including rescue and recovery poses.
{
  const s = new PoolSimulation(3, 91);
  s.schedule = [];
  s.start();
  const p = s.spawn({ type: "beginner", sick: true }),
    other = s.spawn({ type: "intermediate", sick: false });
  for (const [a, lane] of [
    [p, 0],
    [other, 1],
  ])
    Object.assign(a, { status: "swim", lane, x: LANES[lane], z: 0, needsFins: false });
  s.catastrophe(p);
  world.sync(s, 5);
  assert.equal(world.incident.visible, true);
  assert.equal(world.water.material.uniforms.uBrown.value, s.waterBrown);
  assert.equal(world.sanitationGroup.visible, true);
  const x = world.incident.position.x;
  s.cleanup.x += 0.4;
  other.status = "panic";
  world.reducedMotion.matches = false;
  world.sync(s, 5.2);
  assert.notEqual(world.incident.position.x, x);
  const pose = world.people.get(other.id).userData;
  assert.ok(pose.arms.every((a) => Math.abs(a.rotation.z) > 2));
  assert.ok(pose.root.position.y > 0);
  s.coach.carry = "skimmer";
  s.coach.skimmerLoaded = true;
  s.cleanup.stage = "caught";
  world.sync(s, 5.4);
  assert.equal(world.skimmerRack.visible, false);
  assert.equal(world.incident.visible, false);
  assert.equal(world.coach.userData.carry.getObjectByName("caught-waste").visible, true);
  other.status = "swim";
  other.lane = 1;
  other.problem = "eyes";
  world.sync(s, 5.5);
  assert.equal(pose.soreEyes.visible, true);
  other.problem = null;
  world.sync(s, 5.6);
  assert.equal(pose.soreEyes.visible, false);
  s.coach.scoopTimer = 0.2;
  s.coach.scoopTarget = { x: 0, z: 0 };
  world.sync(s, 5.7);
  assert.equal(world.scoopCast.visible, true);
  assert.ok(Number.isFinite(world.scoopShaft.scale.y));
}

world.scene.traverse((o) => {
  for (const n of [...o.position, ...o.scale]) assert.ok(Number.isFinite(n), "Scene transforms stay finite");
});
console.log("Reachable deck framing cases:", framingCases);
console.log(
  "Scene checks passed: authored world construction, shared glow, lane/character ray picking, dash trails, reduced motion, handoffs, finite transforms, and horizontal projections.",
);
console.table(projections);

// Deck recoil is applied to the visible body; positions and picking stay on the real agent.
{
  const s = new PoolSimulation(1, 2);
  s.schedule = [];
  s.start();
  const p = s.spawn({ type: "beginner" });
  Object.assign(p, { bumpTime: 0.36, bumpX: 0.9, bumpZ: 0, angle: 0, queasy: false });
  world.reducedMotion.matches = false;
  world.sync(s, 7);
  const g = world.people.get(p.id);
  assert.ok(Math.abs(g.userData.root.rotation.z) > 0.05 && Math.abs(g.userData.root.rotation.z) < 0.13);
  assert.equal(g.position.x, p.x);
  assert.equal(g.position.z, p.z);
  world.reducedMotion.matches = true;
  world.sync(s, 7);
  assert.equal(g.userData.root.rotation.z, 0);
  world.reducedMotion.matches = false;
}
console.log(
  "Deck scene checks passed: subtle body lean, aligned physical/visual positions, and reduced-motion suppression.",
);

// Exiting swimmers stay prone in water, rise through the climb, then walk on deck.
{
  const s = new PoolSimulation(3, 5);
  s.schedule = [];
  s.start();
  const p = s.spawn({ type: "beginner", sick: false });
  Object.assign(p, { status: "swim", lane: 1, x: 0, z: 4 });
  s.depart(p, true);
  world.sync(s, 10);
  const g = world.people.get(p.id);
  assert.equal(g.userData.root.rotation.x, Math.PI / 2);
  assert.equal(g.position.y, -0.39);
  p.exitPhase = "climb";
  p.exitProgress = 0.5;
  p.z = 9.1;
  world.sync(s, 10.1);
  assert.equal(g.userData.root.rotation.x, Math.PI / 4);
  assert.equal(g.position.y, -0.195);
  p.exitPhase = "deck";
  p.z = 9.95;
  world.sync(s, 10.2);
  assert.equal(g.userData.root.rotation.x, 0);
  assert.equal(g.position.y, 0);
}
console.log("Exit scene checks passed: swimming pose, rising climb, and upright deck walk.");

// Rescue poses and the single life ring remain dynamic after static scene batching.
{
  const s = new PoolSimulation(3, 20);
  s.schedule = [];
  s.start();
  const p = s.spawn({ type: "intermediate", sick: false }),
    a = s.spawn({ type: "beginner", sick: false });
  Object.assign(p, { status: "swim", lane: 1, x: 0, z: 0, needsFins: false });
  Object.assign(a, { status: "swim", lane: 0, x: -3.2, z: 2, needsFins: false });
  assert.ok(s.startCramp(p));
  world.sync(s, 20);
  assert.equal(world.lifeRingModel.children.length, 5, "Ring geometry stays out of the static batch");
  assert.equal(world.lifeRingModel.visible, true);
  for (const q of [p, a]) {
    const g = world.people.get(q.id),
      u = g.userData;
    assert.equal(g.position.y, -0.82);
    assert.ok(Math.abs(u.root.rotation.x) <= 0.1);
    assert.ok(u.arms.every((a) => Math.abs(a.rotation.z) >= 2.39));
    assert.ok(u.legs.every((l) => !l.visible));
  }
  s.coach.x = -4;
  s.coach.z = -14.5;
  assert.ok(s.fetch("lifering"));
  Object.assign(s.coach, { swimming: true, y: -0.39, x: -3, z: 0, angle: Math.PI / 2 });
  world.sync(s, 20.2);
  world.scene.updateMatrixWorld(true);
  const carry = world.coach.userData.carry,
    pos = carry.getWorldPosition(new THREE.Vector3()),
    forward = new THREE.Vector3(0, 0, 1).applyQuaternion(world.coach.quaternion);
  assert.equal(world.lifeRingModel.visible, false);
  assert.equal(carry.visible, true);
  assert.ok(world.coach.userData.arms.every((a) => a.rotation.x === Math.PI));
  assert.ok(pos.clone().sub(world.coach.position).dot(forward) > 1, "Ring sits ahead of the swimming coach");
  assert.ok(Math.abs(pos.y + 0.19) < 0.15, "Ring floats at the water surface");
  s.coach.x = -0.6;
  s.coach.z = 0;
  s.updateCoach(1 / 60);
  world.sync(s, 20.4);
  assert.equal(s.lifeRing.state, "victim");
  assert.equal(world.lifeRingModel.visible, true);
  assert.equal(world.coach.userData.carry.visible, false);
  assert.equal(world.lifeRingModel.position.x, p.x);
  s.rescue = null;
  Object.assign(p, { status: "recovering", recoveryStage: "resting", exitPhase: "deck", x: -10.2, z: -0.25 });
  Object.assign(s.lifeRing, { state: "deck", x: -8.9, z: -0.25, owner: null });
  world.sync(s, 20.6);
  const u = world.people.get(p.id).userData;
  assert.ok(u.legs.every((l) => l.visible && l.rotation.x === -Math.PI / 2));
  assert.equal(world.lifeRingHit.layers.mask, 1);
  p.status = "swim";
  p.rescueRecover = false;
  p.exitPhase = null;
  world.sync(s, 20.8);
  assert.ok(u.legs.every((l) => l.visible));
}
console.log(
  "Rescue scene checks passed: live ring geometry, half-submerged raised-hand poses, extended coach arms, floating ring ahead, single visible ring through handoff, and seated recovery.",
);

// All three rescue stations retain dynamic geometry and light the floor during a rescue.
{
  const s = new PoolSimulation(3, 45);
  s.schedule = [];
  s.start();
  const p = s.spawn({ type: "intermediate", sick: false });
  Object.assign(p, { status: "swim", lane: 1, x: 0, z: 0, problem: null, crampAt: Infinity });
  s.startCramp(p);
  world.sync(s, 0.35);
  assert.equal(world.ringModels.length, 3);
  assert.ok(world.ringModels.every((g) => g.children.length === 5));
  assert.ok(world.ringGlows.every((g) => g.visible));
  assert.ok(world.ringLights.every((l) => l.intensity > 0));
  for (let i = 0; i < 3; i++) {
    assert.equal(world.ringHits[i].userData.ringId, i);
    assert.equal(world.ringHits[i].layers.mask, 1);
    assert.ok(world.ringGlows[i].position.y > 0);
  }
  s.rescue = null;
  world.sync(s, 0.4);
  assert.ok(world.ringGlows.every((g) => !g.visible));
  assert.ok(world.ringLights.every((l) => l.intensity === 0));
  for (const door of world.lockerDoors) {
    door.hinge.updateWorldMatrix(true, false);
    const pos = door.hinge.getWorldPosition(new THREE.Vector3());
    assert.ok(pos.z < -15, "Locker door is embedded at the left wall");
  }
}
console.log(
  "Three-ring scene checks passed: pickup identities, surviving dynamic geometry, rescue-only floor glows/lights, and embedded locker doors.",
);

// Incident animation: a back landing, recovery, and a distinct cramp struggle.
{
  const s = new PoolSimulation(3, 71);
  s.schedule = [];
  s.start();
  const p = s.spawn({ type: "beginner", sick: false });
  p.queasy = false;
  p.slipTime = 0.4;
  s.coach.slipTime = 0.43;
  world.sync(s, 31);
  for (const u of [world.people.get(p.id).userData, world.coach.userData]) {
    assert.equal(u.root.rotation.x, -Math.PI / 2);
    assert.equal(u.root.rotation.z, 0);
    const faceNormal = new THREE.Vector3(0, 0, 1).applyEuler(u.root.rotation);
    assert.ok(faceNormal.y > 0.99, "Back lands on deck, face looks upward");
    assert.ok(u.root.position.y >= 0.34);
  }
  p.slipTime = 0.04;
  s.coach.slipTime = 0.04;
  world.sync(s, 31.1);
  assert.ok(Math.abs(world.people.get(p.id).userData.root.rotation.x) < 0.2);
  p.slipTime = 0;
  s.coach.slipTime = 0;
  world.sync(s, 31.2);
  assert.equal(world.people.get(p.id).userData.root.rotation.x, 0);
  assert.equal(world.coach.userData.root.rotation.x, 0);
  const a = s.spawn({ type: "intermediate", sick: false });
  Object.assign(p, { status: "swim", lane: 0, x: -3.2, z: 1, problem: null });
  Object.assign(a, { status: "swim", lane: 1, x: 0, z: 3, problem: null });
  s.startCramp(p);
  const heights = [[], []],
    arms = [],
    positions = [p.x, p.z, a.x, a.z];
  for (let i = 0; i < 180; i++) {
    world.sync(s, 32 + i / 60);
    heights[0].push(world.people.get(p.id).userData.root.position.y);
    heights[1].push(world.people.get(a.id).userData.root.position.y);
    arms.push(world.people.get(p.id).userData.arms[0].rotation.x);
  }
  const span = (v) => Math.max(...v) - Math.min(...v);
  assert.ok(span(heights[0]) > 0.27);
  assert.ok(span(heights[1]) > 0.08);
  assert.ok(span(heights[0]) > span(heights[1]) * 2);
  assert.ok(span(arms) > 0.8);
  assert.deepEqual([p.x, p.z, a.x, a.z], positions);
  world.reducedMotion.matches = true;
  world.sync(s, 33);
  for (const q of [p, a]) assert.ok(world.people.get(q.id).userData.root.position.y === 0);
  world.reducedMotion.matches = false;
}
console.log(
  "Incident animation checks passed: back landing, smooth recovery, stronger victim bob/arms, gentle group bob, unchanged positions, and reduced motion.",
);
