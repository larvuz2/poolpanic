// The shift's diary for the crash log (dist/trace.mjs) and the scene's footprint (dist/scene/footprint.mjs). The diary is driven by the
// real simulation through a whole cramp rescue and must read like the story it is, stay quiet through an ordinary shift, and change
// nothing it looks at; the footprint is counted on a plain-object scene.
import assert from "node:assert/strict";
import { PoolSimulation } from "./dist/sim.mjs";
import { Tracer, describeEvent, isNoisy, crowdSummary } from "./dist/trace.mjs";
import { footprint, surfaceMB } from "./dist/scene/footprint.mjs";

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

// 8b) The drawing surface, which no walk of the scene can see: 2322×1516 (an iPad Pro's page at 1.7 pixels) multisampled four times is
// about 148 MB (four samples of four bytes of colour and four of depth, and three presented buffers), without multisampling about 54, a
// third of the pixels about a third of the memory, and nothing sized is nothing.
{
  const mb = (samples, width = 2322, height = 1516) => surfaceMB({ width, height, samples });
  assert.equal(mb(4), 148);
  assert.equal(mb(0), 54);
  assert.equal(mb(1), mb(0), "one sample is not multisampled");
  assert.ok(mb(8) > mb(4) && mb(4) > mb(2) && mb(2) > mb(0), "more samples, more memory");
  assert.equal(surfaceMB({ width: 1366, height: 892, samples: 4 }), Math.round((1366 * 892 * 44) / 1048576));
  assert.equal(surfaceMB(), 0);
  assert.equal(surfaceMB({ width: -5, height: 100, samples: 4 }), 0, "a size that makes no sense is nothing");
}

// 9) Where each incident stands: a line each time its stage changes (every step of it when the diary is verbose), the visitor's part of
// it included, so a stuck incident can be read as a story. An incident left to itself runs its course in the lines.
{
  const run = (kind, verbose, level = 12, seed = 4242, seconds = 40) => {
    const lines = [],
      tracer = new Tracer((k, t) => lines.push({ kind: k, text: t }), { verbose }),
      s = new PoolSimulation(level, seed);
    s.schedule = [];
    s.chaosPlan = [];
    s.start();
    for (let f = 0; f < 60 * seconds && s.status === "playing"; f++) {
      if (f === 120) assert.ok(s.triggerChaos(kind), kind + " starts");
      s.tick(1 / 60);
      tracer.look(s);
      s.events.length = 0;
    }
    return { lines, s, tracer };
  };
  const stages = (lines, key) =>
    lines
      .filter((l) => l.kind === "incident" && l.text.includes(" " + key + ": "))
      .map((l) => l.text.split(key + ": ")[1]);
  const fish = run("fish", false);
  assert.deepEqual(
    stages(fish.lines, "fish"),
    ["stage approach · kid entering · net wall", "stage loose · kid crying · net wall · pool closed"],
    "an idle coach: the kid arrives, the fish is loose and the pool closes",
  );
  assert.ok(fish.lines.some((l) => l.kind === "incident" && /^t\d+s pool closed$/.test(l.text)));
  const fishVerbose = run("fish", true);
  assert.deepEqual(
    stages(fishVerbose.lines, "fish").map((x) => x.replace(/ · net.*/, "")),
    [
      "stage approach · kid entering",
      "stage approach · kid walking",
      "stage approach · kid dumping",
      "stage loose · kid crying",
    ],
    "every step of the kid's walk when the diary is verbose",
  );
  for (const [kind, parts] of [
    [
      "dog",
      [
        /^stage loose · dog entering$/,
        /^stage loose · dog sniff$/,
        /^stage loose · dog steal$/,
        /^stage loose · dog carry · carrying \w+$/,
      ],
    ],
    ["karen", [/^stage approach · entering$/, /^stage approach · marching$/, /^stage ranting · ranting$/]],
    ["outage", [/^stage flicker · flashlight rack$/, /^stage dark · flashlight rack$/]],
    [
      "carl",
      [
        /^stage approach · entering · cannonballs 0$/,
        /^stage approach · walking · cannonballs 0$/,
        /^stage approach · windup · cannonballs 0$/,
      ],
    ],
  ]) {
    const got = stages(run(kind, true, 12, 4242, 60).lines, kind);
    let at = -1;
    for (const part of parts) {
      const next = got.findIndex((x, i) => i > at && part.test(x));
      assert.ok(next > at, `${kind}: ${part} in order in ${JSON.stringify(got)}`);
      at = next;
    }
    assert.ok(
      !got.some((x) => /\[object|undefined|NaN/.test(x)),
      kind + " says nothing odd: " + got.join(" | "),
    );
  }
  const quietCarl = stages(run("carl", false, 12, 4242, 60).lines, "carl");
  assert.ok(
    quietCarl.length >= 2 && quietCarl.length < stages(run("carl", true, 12, 4242, 60).lines, "carl").length,
    "the short report keeps only the stages",
  );
  // An incident whose describe throws costs the diary that line only, never a throw.
  {
    const lines = [],
      tracer = new Tracer((k, t) => lines.push(k + " " + t)),
      s = new PoolSimulation(12, 1);
    s.schedule = [];
    s.chaosPlan = [];
    s.start();
    s.triggerChaos("dog");
    const dog = s.system("dog"),
      describe = dog.describe;
    dog.describe = () => {
      throw new Error("describe broke");
    };
    try {
      for (let f = 0; f < 60; f++) {
        s.tick(1 / 60);
        assert.doesNotThrow(() => tracer.look(s));
      }
    } finally {
      dog.describe = describe;
    }
    assert.ok(
      lines.some((l) => /incident t\d+s running: dog/.test(l)),
      "the running line is still written",
    );
  }
}

// 10) A stage that goes on and on is said to be waiting, at 25 s and again each time that doubles, in the shift's own time (a pause is
// not counted); a change of stage starts the count over; what an incident or a rescue already explains is not said a second time.
{
  const lines = [],
    tracer = new Tracer((k, t) => lines.push(k + " " + t)),
    s = new PoolSimulation(12, 4242);
  s.schedule = [];
  s.chaosPlan = [];
  s.start();
  s.triggerChaos("fish");
  const waits = () => lines.filter((l) => l.startsWith("waiting "));
  let first = null;
  for (let f = 0; f < 60 * 100; f++) {
    s.tick(1 / 60);
    tracer.look(s);
    s.events.length = 0;
    if (!first && waits().length) first = s.arrivalTime;
  }
  const said = waits().filter((l) => /fish: /.test(l));
  assert.equal(said.length, 2, "twice in what is left of 100 s: " + waits().join(" | "));
  assert.match(
    said[0],
    /^waiting t\d+s fish: stage loose · kid crying · net wall · pool closed has been like this for 25 s \(coach deck @-?[\d.]+,-?[\d.]+\)$/,
  );
  assert.match(said[1], /for 50 s/);
  assert.ok(
    !waits().some((l) => /the pool is closed/.test(l)),
    "the closed pool is the fish's doing: said once",
  );
  // The pause: no time passes, so nothing is waited through.
  const paused = new Tracer((k, t) => lines.push(k + " " + t));
  const before = lines.length;
  const sp = new PoolSimulation(12, 4242);
  sp.schedule = [];
  sp.chaosPlan = [];
  sp.start();
  sp.triggerChaos("fish");
  for (let f = 0; f < 60 * 22; f++) {
    sp.tick(1 / 60);
    paused.look(sp);
  }
  sp.status = "paused";
  for (let f = 0; f < 60 * 60; f++) {
    sp.tick(1 / 60);
    paused.look(sp);
  }
  assert.equal(
    lines.slice(before).filter((l) => l.startsWith("waiting ")).length,
    0,
    "a minute of pause is not waiting",
  );
  // A change starts the count over: the fish netted, "returning" waits its own 25 s.
  const sc = new PoolSimulation(12, 4242);
  sc.schedule = [];
  sc.chaosPlan = [];
  sc.start();
  const own = [],
    tracer2 = new Tracer((k, t) => own.push(k + " " + t));
  sc.triggerChaos("fish");
  for (let f = 0; f < 60 * 40; f++) {
    sc.tick(1 / 60);
    tracer2.look(sc);
  }
  assert.ok(
    own.some((l) => l.startsWith("waiting ")),
    "it has been waiting",
  );
  sc.fish.stage = "returning"; // (as when the fish is netted)
  const marker = own.length;
  for (let f = 0; f < 60 * 20; f++) {
    sc.tick(1 / 60);
    tracer2.look(sc);
  }
  assert.equal(
    own.slice(marker).filter((l) => l.startsWith("waiting ")).length,
    0,
    "a new stage has not waited yet",
  );
  assert.ok(
    own.slice(marker).some((l) => /fish: stage returning/.test(l)),
    "and says what it is in now",
  );
}

// 11) The pool closing and reopening, the lane out of service, the storm, and the gear that moves (the net on its hook or in somebody's hands).
{
  const lines = [],
    tracer = new Tracer((k, t) => lines.push(k + " " + t)),
    s = new PoolSimulation(12, 4242);
  s.schedule = [];
  s.chaosPlan = [];
  s.start();
  const look = () => {
    s.tick(1 / 60);
    tracer.look(s);
  };
  look();
  s.laneClosure = 2;
  look();
  s.storm = { start: 0, ramp: 10, next: 1 };
  look();
  s.laneClosure = -1;
  s.storm = null;
  look();
  s.fishNet.state = "coach";
  look();
  s.fishNet.state = "wall";
  look();
  s.closed = 1;
  look();
  s.closed = 0;
  look();
  const text = lines.join("\n");
  assert.match(text, /incident t0s twist: lane 3 out of service\n/);
  assert.match(text, /twist: lane 3 out of service, storm\n/);
  assert.match(text, /twist over\n/);
  assert.match(text, /gear t0s fishNet: wall → coach\n/);
  assert.match(text, /gear t0s fishNet: coach → wall\n/);
  assert.match(text, /incident t0s pool closed\n/);
  assert.match(text, /incident t0s pool reopened$/);
}

// 12) The plan and the pulse: what the shift has in store, and where everything is, in one line each.
{
  const tracer = new Tracer(() => {}),
    s = new PoolSimulation(10, 777);
  s.start();
  assert.match(tracer.plan(s), /^plan: (\w+@\d+s)(, \w+@\d+s)*$/);
  assert.ok(tracer.plan(s).includes("twist@"), "twists are in the plan");
  const plain = new PoolSimulation(1, 5);
  plain.start();
  assert.equal(tracer.plan(plain), "plan: no incidents");
  s.schedule = [];
  s.chaosPlan = [];
  for (let f = 0; f < 60 * 5; f++) s.tick(1 / 60);
  assert.match(tracer.pulse(s), /^t[45]s score -?\d+ · coach deck @-?[\d.]+,-?[\d.]+/);
  s.triggerChaos("fish");
  s.triggerChaos("outage");
  for (let f = 0; f < 60 * 2; f++) s.tick(1 / 60);
  const pulse = tracer.pulse(s);
  assert.match(pulse, /fish stamina 8 fish @-?[\d.]+,-?[\d.]+ kid @-?[\d.]+,-?[\d.]+/);
  assert.ok(pulse.length <= 240, "short enough for a line of the log: " + pulse.length);
  assert.ok(!/NaN|undefined|\[object/.test(pulse), pulse);
  s.coach.carry = "fishnet";
  assert.match(tracer.pulse(s), /coach deck carrying fishnet @/);
  // Looking and pulsing change nothing.
  const same = snapshot(s);
  tracer.look(s);
  tracer.pulse(s);
  tracer.plan(s);
  assert.equal(snapshot(s), same);
}

console.log(
  "Trace checks passed: a cramp rescue reads as a story in the log (cramp, ring, dive, swim, handoff, climb, bench), an ordinary shift stays quiet, looking changes nothing, events say what they carry, a running incident reads as a story (a line per stage, every step when verbose, never a throw), a stage that goes on is said to be waiting at 25 s and 50 s (a pause is not waiting), the pool, the lane, the storm and the gear that move, the shift's plan and the pulse, and the scene's footprint counts shared geometry once.",
);
