// The shift's diary for the crash log (dist/trace.mjs) and the scene's footprint (dist/scene/footprint.mjs). The diary is driven by the
// real simulation through a whole cramp rescue and must read like the story it is, stay quiet through an ordinary shift, and change
// nothing it looks at; the footprint is counted on a plain-object scene.
import assert from "node:assert/strict";
import { PoolSimulation } from "./dist/sim.mjs";
import { Tracer, describeEvent, isNoisy, crowdSummary } from "./dist/trace.mjs";
import { footprint } from "./dist/scene/footprint.mjs";

// What the simulation holds that a look could disturb: everybody's place and state, the clock, the score.
const snapshot = (s) =>
  JSON.stringify([
    s.time,
    s.score,
    s.status,
    s.coach.x,
    s.coach.z,
    s.coach.carry,
    s.coach.swimming,
    s.people.map((p) => [p.id, p.x, p.z, p.status, p.problem, p.exitPhase, p.recoveryStage]),
    s.lifeRings.map((r) => [r.state, r.owner]),
    s.rescue && [s.rescue.stage, s.rescue.victims],
  ]);

// The cramp rescue of rescue-check.mjs, frame by frame (a look after every tick), as the diary lines it writes and the events the game
// would have logged.
function rescue(withTracer = true) {
  const lines = [],
    events = [],
    tracer = new Tracer((kind, text) => lines.push({ kind, text }));
  const s = new PoolSimulation(3, 20);
  s.schedule = [];
  s.start();
  const tick = (n = 1) => {
    for (let f = 0; f < n; f++) {
      s.tick(1 / 60);
      if (withTracer) tracer.look(s);
      for (const e of s.events.splice(0)) if (!isNoisy(e)) events.push(describeEvent(e));
    }
  };
  const go = (x, z) => {
    for (let f = 0; f < 900 && Math.hypot(s.coach.x - x, s.coach.z - z) > 0.055; f++) {
      const dx = x - s.coach.x,
        dz = z - s.coach.z,
        n = Math.hypot(dx, dz);
      s.setMovement(dx / n, dz / n);
      tick();
    }
    s.clearInput();
  };
  const p = s.spawn({ type: "intermediate", sick: false }),
    a = s.spawn({ type: "beginner", sick: false });
  Object.assign(p, {
    status: "swim",
    lane: 1,
    x: 0,
    z: 0,
    p: 7.2,
    workTime: 6,
    traveled: 12,
    workTarget: 999,
  });
  Object.assign(a, { status: "swim", lane: 0, x: -3.2, z: 2, p: 9.2, workTarget: 999 });
  Object.assign(p, { needsFins: false, crampAt: Infinity });
  Object.assign(a, { needsFins: false, crampAt: Infinity });
  tick(30);
  assert.ok(s.startCramp(p));
  tick(30);
  go(-6.6, -13.7);
  go(-4, -14.5);
  assert.ok(s.interact());
  go(-4, -10.5);
  go(-7.2, -10.5);
  go(-7.2, 0);
  s.setMovement(1, 0);
  for (let f = 0; f < 120 && !s.coach.waterTransition; f++) tick();
  s.clearInput();
  for (let f = 0; f < 200 && !s.coach.swimming; f++) tick();
  for (let f = 0; f < 1200 && s.lifeRing.state !== "victim"; f++) {
    const dx = p.x - s.coach.x,
      dz = p.z - s.coach.z,
      n = Math.hypot(dx, dz) || 1;
    s.setMovement(dx / n, dz / n);
    tick();
  }
  for (let f = 0; f < 900 && (s.coach.swimming || s.coach.waterTransition); f++) {
    s.setMovement(Math.sign(s.coach.x) || -1, 0);
    tick();
  }
  s.clearInput();
  for (let f = 0; f < 60 * 40 && p.recoveryStage !== "resting"; f++) tick();
  tick(60);
  return { s, p, lines, events };
}

// 1) The rescue reads as a story, in order: the cramp, the ring, the dive, the swim, the handoff, the climb, the bench.
{
  const { lines, p } = rescue();
  const story = [
    ["shift", /^t0s status none → playing$/],
    ["rescue", /^t\d+s stranded cramp victims #\d+ \S+ \(intermediate\)$/],
    ["person", /problem cramp/],
    ["coach", /^t\d+s deck carrying lifering @-?[\d.]+,-?[\d.]+$/],
    ["ring", /life ring 0: wall → coach$/],
    ["coach", /^t\d+s dive carrying lifering/],
    ["coach", /^t\d+s swimming carrying lifering/],
    ["coach", /^t\d+s swimming @/],
    ["rescue", /^t\d+s escaping cramp/],
    ["ring", /life ring 0: coach → victim #\d+$/],
    ["person", /swim → exit \(water\)/],
    ["coach", /^t\d+s climb @/],
    ["coach", /^t\d+s deck @/],
    ["person", /exit → exit \(climb\)/],
    ["rescue", /^t\d+s over$/],
    ["person", /exit → recovering \(deck\/to-bench\)/],
    ["ring", /life ring 0: victim #\d+ → deck @-?[\d.]+,-?[\d.]+$/],
    ["person", /recovering → recovering \(deck\/resting\)/],
  ];
  let at = -1;
  for (const [kind, pattern] of story) {
    const next = lines.findIndex((l, i) => i > at && l.kind === kind && pattern.test(l.text));
    assert.ok(
      next > at,
      `the diary says ${kind} ${pattern} after line ${at}:\n${lines.map((l, i) => i + " " + l.kind + " " + l.text).join("\n")}`,
    );
    at = next;
  }
  // The victim is named: the lines say who, by number, name and kind of swimmer.
  assert.ok(lines.some((l) => l.text.includes("#" + p.id + " " + p.name + " (intermediate)")));
  assert.ok(lines.length < 40, `a whole rescue is ${lines.length} lines, not a flood`);
}

// 2) The events a game would log for it: the save and the toasts say the same story in the simulation's own words.
{
  const { events } = rescue();
  for (const want of [
    /^incident kind cramp id \d+ name \S+ @/,
    /^save kind rescue .*name \S+/,
    /^rescue-safe id \d+$/,
    /^toast "/,
  ])
    assert.ok(
      events.some((e) => want.test(e)),
      `the events include ${want}: ${events.join(" | ")}`,
    );
  assert.ok(
    !events.some((e) => /^(splash|points|collision|countdown) /.test(e)),
    "the endless events are left out",
  );
}

// 3) Looking changes nothing: the same rescue, with and without the diary, ends in exactly the same simulation.
{
  assert.equal(snapshot(rescue(true).s), snapshot(rescue(false).s));
}

// 4) An ordinary shift is quiet: swimmers arriving, swimming and leaving write no lines of their own.
{
  for (const level of [3, 10]) {
    const lines = [],
      tracer = new Tracer((kind, text) => lines.push(kind + " " + text)),
      s = new PoolSimulation(level, 777 + level);
    s.start();
    for (let f = 0; f < 60 * 80 && s.status === "playing"; f++) {
      s.tick(1 / 60);
      tracer.look(s);
      s.events.length = 0;
    }
    assert.ok(lines.length < 40, `an idle level ${level} shift writes ${lines.length} lines`);
    assert.ok(lines.length >= 2, "…but it does say it began and where the coach is");
  }
}

// 5) A new shift starts a new diary: reset forgets what it knew, so nothing is carried over as a "change".
{
  const lines = [],
    tracer = new Tracer((kind, text) => lines.push(kind + " " + text)),
    s = new PoolSimulation(3, 5);
  s.start();
  tracer.look(s);
  const first = lines.length;
  tracer.look(s);
  assert.equal(lines.length, first, "a second look at the same moment writes nothing");
  tracer.reset();
  tracer.look(s);
  assert.equal(lines.length, first * 2, "after a reset the same moment is news again");
}

// 6) The events: type first, then the small facts; places and endless events are handled.
{
  assert.equal(
    describeEvent({
      type: "save",
      kind: "rescue",
      value: 150,
      id: 7,
      name: "Rosie",
      x: 1.234,
      z: -5.678,
      junk: { a: 1 },
      nope: NaN,
    }),
    "save kind rescue value 150 id 7 name Rosie @1.2,-5.7",
  );
  assert.equal(
    describeEvent({ type: "healed", to: { x: 2, z: 3.25 }, flag: true, off: false }),
    "healed to @2,3.3 flag",
  );
  assert.equal(describeEvent({ type: "toast", text: "x".repeat(200) }).length, "toast ".length + 82);
  assert.equal(describeEvent({ type: "go" }), "go");
  for (const type of ["points", "splash", "collision", "countdown", "select"])
    assert.equal(isNoisy({ type }), true);
  for (const type of ["incident", "save", "rescue-safe", "toast", "crash", "catastrophe"])
    assert.equal(isNoisy({ type }), false);
}

// 7) The crowd, in one line.
{
  assert.equal(
    crowdSummary({
      people: [{ status: "swim" }, { status: "swim" }, { status: "queue" }, { status: "exit" }],
    }),
    "swim 2, queue 1, exit 1",
  );
  assert.equal(crowdSummary({ people: [] }), "");
  assert.equal(crowdSummary({}), "");
}

// 8) The scene's footprint, on plain objects: shared geometry and textures are counted once, instances and bones and lights are counted,
// a point light's shadow is six faces, a hidden light is not a light.
{
  const attr = (bytes) => ({ array: { byteLength: bytes } });
  const shared = { attributes: { position: attr(1048576), normal: attr(1048576) }, index: attr(524288) };
  const texture = { image: { width: 1024, height: 1024 } };
  const node = (props, children = []) => ({
    ...props,
    traverse(fn) {
      fn(this);
      for (const c of children) c.traverse(fn);
    },
  });
  const scene = node({}, [
    node({ isMesh: true, geometry: shared, material: { map: texture } }),
    node({
      isMesh: true,
      isSkinnedMesh: true,
      geometry: shared,
      material: [{ map: texture, normalMap: { image: { width: 512, height: 512 } } }],
    }),
    node({ isMesh: true, isInstancedMesh: true, count: 30, geometry: { attributes: {} }, material: {} }),
    node({ isBone: true }),
    node({ isBone: true }),
    node({ isLight: true, isPointLight: true, castShadow: true, shadow: { mapSize: { x: 512, y: 512 } } }),
    node({ isLight: true, castShadow: true, shadow: { mapSize: { x: 1024, y: 1024 } } }),
    node({ isLight: true, visible: false, castShadow: true, shadow: { mapSize: { x: 4096, y: 4096 } } }),
  ]);
  const f = footprint(scene, null, node({}));
  assert.equal(f.nodes, 10);
  assert.equal(f.meshes, 3);
  assert.equal(f.skinned, 1);
  assert.equal(f.bones, 2);
  assert.equal(f.instances, 30);
  assert.equal(f.lights, 2, "a hidden light is not counted");
  assert.equal(f.shadows, 2);
  assert.equal(f.geometries, 2, "the shared geometry is counted once");
  assert.equal(f.geoMB, 3, "2 MB + 1 MB of attributes, 0.5 MB of indices, once");
  assert.equal(f.textures, 2);
  assert.equal(f.texMB, Math.round(((1024 * 1024 + 512 * 512) * 4 * 1.34) / 1048576));
  assert.equal(
    f.shadowMB,
    Math.round((512 * 512 * 4 * 6 + 1024 * 1024 * 4) / 1048576),
    "the point light's shadow is a cube",
  );
  // Nothing to look at.
  assert.equal(footprint().nodes, 0);
  assert.equal(footprint({}).nodes, 0);
}

console.log(
  "Trace checks passed: a cramp rescue reads as a story in the log (cramp, ring, dive, swim, handoff, climb, bench), an ordinary shift stays quiet, looking changes nothing, events say what they carry, and the scene's footprint counts shared geometry once.",
);
