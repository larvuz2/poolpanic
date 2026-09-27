// Coach Cam (first-person view): the coach faces where the player looks, E prefers what is in front,
// movement follows the view, the camera sits at eye height (water level when swimming) with the coach's body
// hidden, the hands trail fast turns and settle, head bob stays subtle (off with reduced motion), landings
// dip the view, carried items appear in the hands, and the field of view stays sane on any screen.
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import * as THREE from "./dist/assets/three.module.js";
import { PoolSimulation } from "./dist/sim.mjs";
import { screenMovement } from "./dist/spatial.mjs";

const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const { createCanvas } = runtime
  ? await import(pathToFileURL(runtime + "/@napi-rs/canvas/index.js"))
  : await import("@napi-rs/canvas");
globalThis.document = { createElement: () => createCanvas(256, 128) };
let reducedMotion = false;
globalThis.window = {
  matchMedia: () => ({
    get matches() {
      return reducedMotion;
    },
  }),
};
const { PoolWorld } = await import("./dist/scene.mjs");
const { COACH_CAM } = await import("./dist/scene/coach-cam.mjs");

const tick = (s, n = 1) => {
  for (let i = 0; i < n; i++) s.tick(1 / 60);
};
function shift(level = 3) {
  const s = new PoolSimulation(level, 5);
  s.schedule = [];
  s.chaosPlan = [];
  s.start();
  return s;
}

// 1) The simulation: facing follows the look, and E prefers what the coach is facing.
{
  const s = shift();
  const c = s.coach;
  c.lookAngle = 0.4;
  s.setMovement(0, 1); // along the deck, clear of the pool
  tick(s, 30);
  assert.equal(c.angle, 0.4, "Walking sideways, the coach still faces where the player looks");
  c.lookAngle = null;
  tick(s, 20);
  assert.ok(Math.abs(c.angle) < 0.01, "Without the Coach Cam the coach faces its movement");
  s.clearInput();
  // Two waiting swimmers at equal distance, one in front of the coach and one behind.
  const [front, back] = [1, -1].map((side) => {
    const p = s.spawn({ type: "beginner", sick: false });
    Object.assign(p, { status: "queue", x: c.x + side * 1.2, z: c.z, path: [] });
    return p;
  });
  c.lookAngle = Math.PI / 2; // looking along +X, toward `front`
  assert.equal(s.nearestInteraction()?.label.includes(front.name), true, "E picks the swimmer in view");
  c.lookAngle = -Math.PI / 2;
  assert.equal(s.nearestInteraction()?.label.includes(back.name), true, "…and the other one after turning");
}

// 2) Movement follows the view; at the overview's heading it matches the overview mapping exactly.
const world = new PoolWorld({ clientWidth: 1600, clientHeight: 900 }, () => {}, { headless: true });
const cam = world.coachCam;
{
  cam.yaw = Math.PI / 2;
  for (const [x, z] of [
    [0, -1],
    [1, 0],
    [0.6, 0.8],
  ]) {
    const a = cam.movement(x, z),
      b = screenMovement(x, z);
    assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.z - b.z) < 1e-9, "Same mapping when looking along +X");
  }
  cam.yaw = 0;
  const forward = cam.movement(0, -1);
  assert.ok(Math.abs(forward.x) < 1e-9 && Math.abs(forward.z - 1) < 1e-9, "W walks where the camera looks");
  const right = cam.movement(1, 0);
  assert.ok(Math.abs(right.x + 1) < 1e-9 && Math.abs(right.z) < 1e-9, "D steps to the right of the view");
}

// 3) Camera placement, hidden body, projection and field of view.
{
  const s = shift();
  world.setViewMode("coach", s);
  assert.equal(world.viewMode, "coach");
  const c = s.coach;
  for (let i = 0; i < 30; i++) world.sync(s, i / 60, 1 / 60);
  assert.ok(Math.abs(world.camera.position.y - COACH_CAM.eye) < 0.03, "Eyes at the coach's eye height");
  assert.ok(Math.hypot(world.camera.position.x - c.x, world.camera.position.z - c.z) < 0.2);
  assert.equal(world.coach.visible, false, "The coach's own body is hidden in first person");
  // Facing the pool from the start position; the pool centre is on screen, the lockers behind are not.
  assert.equal(world.project(0, 0, 0).visible, true);
  assert.equal(world.project(c.x - 6, 1, c.z).visible, false);
  const wide = world.coachCam.verticalFov(16 / 9);
  assert.ok(wide > 55 && wide < 65, "About 90° across on a 16:9 screen (" + wide.toFixed(1) + "° tall)");
  assert.equal(world.coachCam.verticalFov(390 / 844), COACH_CAM.vfov[1], "Phones are capped, not fish-eyed");
  // Swimming puts the eyes just above the water.
  Object.assign(c, { swimming: true, y: -0.39 });
  for (let i = 0; i < 20; i++) world.sync(s, 1 + i / 60, 1 / 60);
  assert.ok(world.camera.position.y > -0.2 && world.camera.position.y < 0.2, "Eyes at water level");
  c.swimming = false;
  c.y = 0;
  world.setViewMode("overview");
  world.sync(s, 2, 1 / 60);
  assert.equal(world.coach.visible, true, "Back in the overview the coach is visible again");
}

// 4) Hands trail a fast turn, then settle; head bob is subtle; landings dip the view.
{
  const s = shift();
  world.setViewMode("coach", s);
  let t = 0;
  const frame = (n = 1) => {
    for (let i = 0; i < n; i++) {
      tick(s);
      world.sync(s, (t += 1 / 60), 1 / 60);
    }
  };
  frame(60);
  const rest = world.coachCam.hands[1].p.clone();
  world.coachCam.look(-350, 0); // a fast flick to the right
  frame(4);
  const lag = world.coachCam.hands[1].p.distanceTo(rest);
  assert.ok(lag > 0.02, "The hands trail behind a quick turn (" + lag.toFixed(3) + ")");
  frame(45);
  assert.ok(world.coachCam.hands[1].p.distanceTo(rest) < 0.01, "…and settle within a moment");
  // Walking: a few centimetres of bob.
  s.coach.lookAngle = world.coachCam.yaw;
  const walk = () => {
    const ys = [];
    for (let i = 0; i < 120; i++) {
      const m = world.coachCam.movement(0, -1);
      s.setMovement(m.x * 0.6, m.z * 0.6);
      frame();
      ys.push(world.camera.position.y);
    }
    s.clearInput();
    return Math.max(...ys.slice(40)) - Math.min(...ys.slice(40));
  };
  const bob = walk();
  assert.ok(bob > 0.004 && bob < 0.04, "Head bob is noticeable but small (" + bob.toFixed(3) + ")");
  reducedMotion = true;
  frame(60);
  const still = walk();
  assert.ok(still < 0.001, "Reduced motion removes the bob (" + still.toFixed(4) + ")");
  reducedMotion = false;
  frame(60);
  // Jump and land: the eyes dip below standing height, then come back.
  s.jump();
  let low = Infinity,
    landed = false;
  for (let i = 0; i < 90; i++) {
    frame();
    if (s.coach.landing > 0) landed = true;
    if (landed) low = Math.min(low, world.camera.position.y);
  }
  assert.ok(landed);
  const dip = COACH_CAM.eye - low;
  assert.ok(dip > 0.015 && dip < 0.09, "Landing dips the view by a few centimetres (" + dip.toFixed(3) + ")");
  frame(60);
  assert.ok(Math.abs(world.camera.position.y - COACH_CAM.eye) < 0.01, "…and recovers");
}

// 5) Whatever the coach carries is in the hands.
{
  const s = shift(5);
  world.setViewMode("coach", s);
  for (const kind of ["lifering", "chlorine", "fishnet", "skimmer", "fins", "relief", "goggles"]) {
    s.coach.carry = kind;
    world.sync(s, 3, 1 / 60);
    assert.equal(world.coachCam.item.visible, true, kind + " is shown in the hands");
    assert.ok(world.coachCam.item.children.length > 0);
  }
  s.coach.carry = "fishnet";
  s.coach.netLoaded = true;
  world.sync(s, 3.1, 1 / 60);
  assert.equal(
    world.coachCam.item.getObjectByName("net-fish").visible,
    true,
    "A netted fish rides in the net",
  );
  s.coach.carry = null;
  world.sync(s, 3.2, 1 / 60);
  assert.equal(world.coachCam.item.visible, false, "Empty hands hold nothing");
  assert.equal(new THREE.Vector3(0, 0, 0).length(), 0);
}
console.log(
  "Coach Cam checks passed: facing follows the look, E prefers what is in view, view-relative movement, eye-height and water-level camera with the body hidden, hands trail and settle, subtle bob (off with reduced motion), landing dip, carried items in hand, sane field of view.",
);
