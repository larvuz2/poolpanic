// The intro cinematic (5 November 2026): three short shots before every shift's countdown, in every venue: the coach close up, a
// low sweep across the venue, the coach jumping and freaking out. The shift waits for it; a key or a click skips it; Settings
// turns it off; never in co-op, the Coach Cam or a replay. Render only. Some venues have a beat of their own (the snow monkey, Valentina,
// the DJ and the bartender), and the Jumping Pool's view of the venue is a crane.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { PoolWorld } from "./dist/scene.mjs";
import { PoolSimulation, SHIFTS } from "./dist/sim.mjs";
import {
  SHOTS,
  CINEMATIC_SECONDS,
  VENUE_SHOTS,
  CRANE,
  shotsFor,
  planCinematic,
  cinematicAt,
} from "./dist/scene/intro-cinematic.mjs";
import { planIntro, introAt } from "./dist/scene/coach-model.mjs";
import { normalizeSettings, SETTING_DEFAULTS } from "./dist/title.mjs";
import { POOL_IDS } from "./dist/week.mjs";

const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const { createCanvas } = runtime
  ? await import(pathToFileURL(runtime + "/@napi-rs/canvas/index.js"))
  : await import("@napi-rs/canvas");
globalThis.document = { createElement: () => createCanvas(256, 128) };
globalThis.window = { matchMedia: () => ({ matches: false }) };
console.warn = () => {}; // (the cruise asks for its models in a headless run)

// 1) The three shots, brief.
assert.deepEqual(
  SHOTS.map((s) => s.kind),
  ["coach", "venue", "nervous"],
);
assert.ok(CINEMATIC_SECONDS >= 4 && CINEMATIC_SECONDS <= 6, "about five seconds (" + CINEMATIC_SECONDS + ")");

// 2) Every venue: the cameras are real numbers, the coach's shots close to him and in front of him, the sweep inside the deck and
// low, the shots in order, nothing after the end.
for (const id of POOL_IDS) {
  const sim = new PoolSimulation(3, 1, { config: { ...SHIFTS[2], venue: id } });
  sim.start({ countdown: true });
  const plan0 = planIntro(sim),
    coach = plan0.length > 0 ? introAt(plan0, sim.countdown) : { x: sim.coach.x, z: sim.coach.z, angle: 0 },
    plan = planCinematic(sim.venue, coach, { x: -0.65, z: 0 }),
    d = sim.venue.deck;
  assert.equal(
    plan.total,
    shotsFor(id).reduce((t, s) => t + s.seconds, 0),
  );
  assert.ok(
    plan.total >= 4 && plan.total <= 6,
    id + ": about five seconds without its subjects (" + plan.total + ")",
  );
  let last = -1,
    craneFrom = null,
    craneTo = null;
  for (let t = 0; t < plan.total; t += 0.1) {
    const at = cinematicAt(plan, t, t);
    assert.ok(at, id + ": a camera at " + t.toFixed(1));
    for (const v of [at.pos, at.look])
      assert.ok([v.x, v.y, v.z].every(Number.isFinite), id + ": real numbers");
    assert.ok(at.index >= last, id + ": the shots in order");
    last = at.index;
    const fromCoach = Math.hypot(at.pos.x - coach.x, at.pos.z - coach.z);
    if (at.kind === "crane") {
      craneFrom ||= at.pos;
      craneTo = at.pos;
      assert.ok(at.pos.y > 0.5 && at.pos.y < 15, id + ": the crane between the deck and the sky");
    } else if (at.kind === "venue") {
      assert.ok(
        at.pos.x > d.minX && at.pos.x < d.maxX && at.pos.z > d.minZ && at.pos.z < d.maxZ,
        id + ": the sweep on the deck",
      );
      assert.ok(at.pos.y > 1 && at.pos.y < 2.5, id + ": low, about head height");
    } else {
      assert.ok(
        fromCoach > 1.2 && fromCoach < 3.6,
        id + ": close to the coach (" + fromCoach.toFixed(1) + " m)",
      );
      const facing =
        (at.pos.x - coach.x) * Math.sin(coach.angle) + (at.pos.z - coach.z) * Math.cos(coach.angle);
      assert.ok(facing > 1, id + ": in front of him, his face to the camera");
      assert.ok(Math.abs(at.look.x - coach.x) < 0.01 && at.look.y > 1.2, id + ": looking at his face");
    }
  }
  assert.equal(last, plan.shots.length - 1);
  assert.equal(cinematicAt(plan, plan.total + 0.01), null);
  if (CRANE[id]) assert.ok(craneFrom.y < 1.2 && craneTo.y > 10, id + ": the crane from low to high");
  else assert.ok(!craneFrom, id + ": a sweep, not a crane");
}
assert.deepEqual(Object.keys(CRANE), ["dive"], "the Jumping Pool's crane");

// 2b) The venues' own beats (the creator, 5 November 2026): each venue's scene puts its subjects on the world, and the plan frames
// each one close, between the sweep and the nervous coach; a venue without them plays the common three.
for (const [id, want, subjects] of [
  ["onsen", ["coach", "venue", "monkey", "nervous"], ["monkey"]],
  ["disco", ["coach", "venue", "valentina", "nervous"], ["valentina"]],
  ["roof", ["coach", "venue", "dj", "bartender", "nervous"], ["dj", "bartender"]],
  ["dive", ["coach", "crane", "nervous"], []],
  ["club", ["coach", "venue", "nervous"], []],
]) {
  const world = new PoolWorld({ clientWidth: 1440, clientHeight: 900 }, () => {}, { headless: true });
  const sim = new PoolSimulation(3, 1, { config: { ...SHIFTS[2], venue: id } });
  world.setVenue(sim.venue);
  world.resize();
  sim.start({ countdown: true });
  for (const k of subjects) assert.ok(world.cineSpots[k], id + ": the scene puts its " + k + " on the world");
  const seen = [];
  world.onCinematic = (i, kind) => seen.push(kind);
  const total = world.startCinematic(sim),
    plan = world.cinematic.plan;
  assert.ok(total <= 7.5, id + ": still brief (" + total.toFixed(1) + " s)");
  for (const shot of plan.shots) {
    const spot = world.cineSpots[shot.kind];
    if (!spot || !subjects.includes(shot.kind)) continue;
    assert.ok(
      shot.seconds >= 1.2 && shot.seconds <= 1.5,
      id + ": a second and a half or less of the " + shot.kind,
    );
    const near = Math.hypot(shot.to.x - spot.x, shot.to.z - spot.z);
    assert.ok(near > 0.8 && near < 3.2, id + ": close on the " + shot.kind + " (" + near.toFixed(1) + " m)");
    assert.ok(
      Math.hypot(shot.lookTo.x - spot.x, shot.lookTo.z - spot.z) < 0.4,
      id + ": looking at the " + shot.kind,
    );
  }
  const coachShown = [];
  for (let f = 0; f < 600 && world.cinematic; f++) {
    world.updateCinematic(1 / 60);
    if (world.cinematic) coachShown.push([world.cinematic.kind, world.coach.visible]);
  }
  assert.deepEqual(seen, [...want, null], id + ": " + want.join(", "));
  for (const [kind, shown] of coachShown)
    assert.equal(
      shown,
      kind === "coach" || kind === "nervous",
      id + ": the coach only in his own shots (" + kind + ")",
    );
}
for (const [id, shots] of Object.entries(VENUE_SHOTS))
  for (const s of shots) assert.ok(s.seconds <= 1.5, id + ": " + s.kind + " brief");

// 3) The world: the camera is the cinematic's while it runs, the coach acts on cue, and the overview's lens comes back after.
{
  const world = new PoolWorld({ clientWidth: 1440, clientHeight: 900 }, () => {}, { headless: true });
  const sim = new PoolSimulation(3, 1, { config: { ...SHIFTS[2], venue: "club" } });
  world.setVenue(sim.venue);
  world.resize();
  sim.start({ countdown: true });
  const fov = world.camera.fov,
    seen = [];
  world.onCinematic = (i, kind) => seen.push(kind);
  const total = world.startCinematic(sim);
  assert.equal(total, CINEMATIC_SECONDS);
  assert.ok(world.cinematic && world.camera.fov === SHOTS[0].fov, "the close-up's lens");
  let urgent = false,
    startled = false;
  for (let f = 0; f < 400 && world.cinematic; f++) {
    world.updateCinematic(1 / 60);
    if (world.cinematic?.kind === "nervous") {
      urgent ||= !!world.cinematic.coach.urgent;
      startled ||= !!world.cinematic.coach.startle;
    }
  }
  assert.equal(world.cinematic, null, "over by itself");
  assert.deepEqual(seen, ["coach", "venue", "nervous", null], "each shot announced, then the end");
  assert.ok(urgent && startled, "the nervous shot: a jolt, then the freak-out");
  assert.equal(world.camera.fov, fov, "the overview's lens back");
  // skipped early: the same end
  world.startCinematic(sim);
  world.endCinematic();
  assert.equal(world.cinematic, null);
  assert.equal(world.camera.fov, fov);
  assert.equal(sim.time, 0, "the simulation never moved");
}

// 4) The game around it: the shift waits, a key or a click skips, Settings has the switch, never in co-op, the Coach Cam or a replay.
{
  const app = readFileSync("dist/app.mjs", "utf8"),
    html = readFileSync("dist/index.html", "utf8"),
    title = readFileSync("dist/title.mjs", "utf8"),
    scene = readFileSync("dist/scene.mjs", "utf8");
  assert.match(app, /accumulator = lookFreeze \|\| world\.cinematic \? 0 :/);
  assert.match(
    app,
    /settings\.cinematics !== false &&\s*!coop &&\s*world\.viewMode !== "coach" &&\s*!replayRun &&\s*!tuning\.has\("nocine"\)/,
  );
  assert.match(app, /document\.addEventListener\("keydown", skipCinematic, \{ capture: true \}\)/);
  assert.match(app, /document\.addEventListener\("pointerdown", skipCinematic, \{ capture: true \}\)/);
  assert.match(app, /\$\("countdown"\)\.hidden = mode !== "countdown" \|\| !!world\.cinematic/);
  for (const id of ["cinematic", "cine-card", "cine-title", "cine-sub", "cine-flash", "set-cinematics"])
    assert.ok(html.includes(`id="${id}"`), id);
  assert.match(title, /\$\("set-cinematics"\)\.onchange/);
  assert.equal(SETTING_DEFAULTS.cinematics, true, "on by default");
  assert.equal(normalizeSettings({ cinematics: false }).cinematics, false, "the player's off is kept");
  assert.equal(normalizeSettings({ cinematics: "yes" }).cinematics, true);
  assert.match(
    scene,
    /cg\.visible = !firstPerson && \(!this\.cinematic\?\.kind \|\| COACH_SHOTS\.has\(this\.cinematic\.kind\)\)/,
    "the venue's shots are its alone",
  );
}

console.log(
  `Intro cinematic checks passed: three shots in ${CINEMATIC_SECONDS} s (the coach close up, a low sweep across the venue, the coach jumping and freaking out) in all ${POOL_IDS.length} venues, with the venues' own beats (the snow monkey by its rock, Valentina on her stage, the DJ and the bartender, the Jumping Pool's crane from low to high), the coach only in his own shots, every camera in front of the coach or low on the deck; the world's camera theirs while it runs and the overview's back after, by itself or skipped; the simulation held; a key or a click skips; Settings' switch kept; never in co-op, the Coach Cam or a replay.`,
);
