// The performance pass of 3 November 2026 (README "Performance"), kept from coming back:
// - taking a venue down frees every texture a material holds (its slots and its uniforms) and every skeleton's bones;
// - a dressed venue's pictures and the crowd's go in the world's `textures`, freed with the venue;
// - the dressed venues load when played (`loadVenue`), never all at launch;
// - nothing per frame reads the page's layout (`viewSize`);
// - the crowd draws only the pose each spectator is in.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import * as THREE from "./dist/assets/three.module.js";
import { disposeScene } from "./dist/scene/kit.mjs";

// 1) disposeScene frees what a venue put on the graphics card.
{
  const freed = new Set();
  const watch = (t, name) => (t.addEventListener("dispose", () => freed.add(name)), t);
  const tex = (name) => watch(new THREE.Texture(), name);
  const scene = new THREE.Scene();
  const lit = new THREE.MeshStandardMaterial({
    map: tex("map"),
    normalMap: tex("normalMap"),
    aoMap: tex("aoMap"),
    metalnessMap: tex("metalnessMap"),
  });
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), lit));
  const shaded = new THREE.ShaderMaterial({ uniforms: { uPaint: { value: tex("uniform") } } });
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), shaded));
  const bone = new THREE.Bone();
  const skeleton = new THREE.Skeleton([bone]);
  skeleton.computeBoneTexture();
  watch(skeleton.boneTexture, "bones");
  const body = new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  body.add(bone);
  body.bind(skeleton);
  scene.add(body);
  disposeScene(scene);
  for (const name of ["map", "normalMap", "aoMap", "metalnessMap", "uniform", "bones"])
    assert.ok(freed.has(name), "taking the venue down frees its " + name);
}

const read = (f) => readFileSync(f, "utf8");
const app = read("dist/app.mjs"),
  scene = read("dist/scene.mjs"),
  dressed = read("dist/scene/dressed.mjs"),
  crowd = read("dist/scene/crowd-models.mjs");

// 2) The pictures only a shader reads are freed with the venue.
assert.match(dressed, /w\.textures\?\.push\(\.\.\.Object\.values\(model\.textures \|\| \{\}\)\)/);
assert.match(crowd, /w\.textures\?\.push\(M\.texture, M\.mask\)/);

// 3) Venues load when played: no chain of every venue at launch; START waits for its venue behind the doors.
assert.match(app, /const VENUE_LOADS = \{/);
for (const id of [
  "resort",
  "kids",
  "lagoon",
  "disco",
  "aquatic",
  "onsen",
  "wave",
  "senior",
  "river",
  "cruise",
  "roof",
  "dive",
  "arena",
])
  assert.match(app, new RegExp("\\n  " + id + ": \\["), "the " + id + " venue is loaded on demand");
assert.ok(!/loadSplashPark\(\)\s*\.then/.test(app), "the venues no longer load one after another at launch");
assert.match(app, /const venue = loadVenue\(week\?\.config\?\.venue/);
assert.match(app, /whenVenue\(venue, \(\) => \{/);

// 4) No layout read per frame.
assert.ok(
  !/this\.container\.client(Width|Height)/.test(scene.replace(/viewSize\(\) \{[\s\S]*?\n  \}/, "")),
  "only viewSize reads the container",
);
assert.match(app, /tagTop = scoreboardBottom\(\) \+ 12/);

// 5) The crowd: no hidden pose drawn.
assert.ok(!/HIDDEN/.test(crowd), "the other pose is not drawn shrunk to nothing");
assert.match(crowd, /b\.sit\.count = b\.n\.sit;/);

// ---- The second pass (13 November 2026, README "Performance: the second pass") ---------------------------------------------
// What made a frame late when an incident began, and what the game threw away sixty times a second, kept from coming back.
// (the world is built without a browser, as the scene's own checks build it)
{
  const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  const { createCanvas } = runtime
    ? await import(pathToFileURL(runtime + "/@napi-rs/canvas/index.js"))
    : await import("@napi-rs/canvas");
  globalThis.document = { createElement: () => createCanvas(256, 128) };
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  console.warn = () => {};
}
const { PoolWorld } = await import("./dist/scene.mjs");
const bodyOf = (text, head) => {
  const a = text.indexOf(head);
  assert.ok(a >= 0, "there is a " + head);
  return text.slice(a, text.indexOf("\n}\n", a));
};

// 6) The pulse of the cues is set where something pulses, never on the page's root (every element's style worked out again,
// every frame).
assert.ok(!/documentElement\.style\.setProperty\("--cue"/.test(app), "--cue is not set on the root");
assert.match(app, /if \(!covered\) cueFrame\(t\);/);
assert.match(bodyOf(app, "function cueFrame(t)"), /host\.el\.querySelector\(host\.pulsing\) \? value : ""/);

// 7) A picture already on the graphics card is made sharper there, not sent again; and every picture of a shift's cast is
// sharpened before the shift's first frame is drawn, not two seconds after a visitor walks in.
{
  const world = new PoolWorld({ clientWidth: 1440, clientHeight: 900 }, () => {}, { headless: true });
  const calls = [];
  const held = {},
    props = new Map(),
    gl = { TEXTURE_2D: 3553, texParameterf: (...a) => calls.push(["texParameterf", ...a]) },
    ext = { TEXTURE_MAX_ANISOTROPY_EXT: 34046 };
  world.renderer = {
    properties: { get: (t) => props.get(t) || (props.set(t, {}), props.get(t)) },
    extensions: { has: (n) => n === "EXT_texture_filter_anisotropic", get: () => ext },
    state: { bindTexture: (...a) => calls.push(["bind", ...a]) },
    capabilities: { getMaxAnisotropy: () => 16 },
    getContext: () => gl,
  };
  const live = new THREE.Texture();
  props.set(live, { __webglTexture: held });
  const version = live.version;
  world.setSharpness(live, 8);
  assert.equal(live.anisotropy, 8);
  assert.equal(live.version, version, "a picture on the card is not sent again to be made sharper");
  assert.deepEqual(calls, [
    ["bind", 3553, held],
    ["texParameterf", 3553, 34046, 8],
  ]);
  assert.equal(
    props.get(live).__currentAnisotropy,
    8,
    "…and three.js is told, so it does not send it again either",
  );
  // (one not sent yet just takes the number: its first upload carries it)
  calls.length = 0;
  const fresh = new THREE.Texture();
  world.setSharpness(fresh, 8);
  assert.equal(fresh.anisotropy, 8);
  assert.equal(calls.length, 0);
  assert.equal(fresh.version, 0);
  // (a cube map goes the old way: nothing of the game's own is one)
  const cube = new THREE.CubeTexture();
  props.set(cube, { __webglTexture: {} });
  world.setSharpness(cube, 8);
  assert.equal(cube.version, 1);
  // the walk over the scene: every material's pictures, and no list or function made for it
  world.sharpLevel = 8;
  const mat = new THREE.MeshStandardMaterial({ map: new THREE.Texture(), normalMap: new THREE.Texture() });
  world.scene.add(new THREE.Mesh(new THREE.BoxGeometry(), [mat, mat]));
  world.tendScene();
  assert.equal(mat.map.anisotropy, 8);
  assert.equal(mat.normalMap.anisotropy, 8);
  const warm = bodyOf(scene, "  warmShaders() {");
  assert.ok(
    warm.indexOf("this.sharpenTextures(true)") > 0 &&
      warm.indexOf("this.sharpenTextures(true)") < warm.indexOf("this.renderer.render("),
    "the cast's pictures are sharpened before the warm-up frame is drawn",
  );

  // 8) A flat see-through thing drawn on both sides (a ring on the floor, a puddle) is drawn in one go: drawn in two, three.js
  // works its shader out again twice a frame.
  const flat = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide }),
    round = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide }),
    lit = new THREE.MeshStandardMaterial({ transparent: true, side: THREE.DoubleSide }),
    oneSide = new THREE.MeshBasicMaterial({ transparent: true });
  world.tendMaterial(flat, { geometry: new THREE.RingGeometry(0.4, 0.5, 24) });
  world.tendMaterial(round, { geometry: new THREE.SphereGeometry(0.5) });
  world.tendMaterial(lit, { geometry: new THREE.RingGeometry(0.4, 0.5, 24) });
  world.tendMaterial(oneSide, { geometry: new THREE.CircleGeometry(0.5, 24) });
  assert.equal(flat.forceSinglePass, true, "a flat ring is drawn in one pass");
  assert.equal(round.forceSinglePass, false, "a ball keeps its two (its far side first)");
  assert.equal(lit.forceSinglePass, false, "a lit material is left alone");
  assert.equal(oneSide.forceSinglePass, false);
  assert.equal(flat.version, 0, "…and nothing is rebuilt for it");

  // 8b) The shadows of the characters (on skeletons) and of the crowd (one mesh drawn many times) have a depth material each, so
  // three.js's own, which draws every other shadow, is not worked out again each time the kind of thing changes.
  const cast = (o) => ((o.castShadow = true), world.scene.add(o), o);
  const bone = new THREE.Bone(),
    body = cast(new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial())),
    other = cast(new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial())),
    crowdMesh = cast(new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial(), 4)),
    bench = cast(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial())),
    leaves = cast(
      new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ alphaTest: 0.5 })),
    ),
    ghost = new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  for (const m of [body, other, leaves, ghost]) (m.add(new THREE.Bone()), m.bind(new THREE.Skeleton([bone])));
  world.scene.add(ghost); // (casts no shadow)
  world.tendScene();
  assert.equal(body.customDepthMaterial?.name, "shadow:skinned");
  assert.equal(other.customDepthMaterial, body.customDepthMaterial, "one for all the characters");
  assert.equal(crowdMesh.customDepthMaterial?.name, "shadow:instanced");
  assert.notEqual(crowdMesh.customDepthMaterial, body.customDepthMaterial);
  assert.equal(bench.customDepthMaterial, undefined, "everything else keeps three.js's own");
  assert.equal(
    leaves.customDepthMaterial,
    undefined,
    "a cut-out material keeps the depth material three.js makes for it",
  );
  assert.equal(ghost.customDepthMaterial, undefined);
  assert.equal(
    body.customDepthMaterial.depthPacking,
    THREE.RGBADepthPacking,
    "the same shader as three.js's own",
  );
}

// 9) The tags over the guests, the alert and the coach's prompt: nothing about them is read from the page in a frame, and
// nothing is written that has not changed.
{
  const tags = bodyOf(app, "function updateBubbles() {"),
    place = bodyOf(app, "function placeTags(tagTop) {"),
    alert = bodyOf(app, "function updateAlert() {"),
    prompt = bodyOf(app, "function updateContext() {");
  for (const [name, body] of [
    ["updateBubbles", tags],
    ["updateAlert", alert],
    ["updateContext", prompt],
  ]) {
    assert.ok(
      !/getBoundingClientRect|innerWidth|innerHeight|clientWidth|\.textContent\b(?! =)/.test(body),
      name + " reads nothing of the page's layout or text",
    );
    // (the tags' own writes go through tagText and its kin, each behind what was last written: no bare text is written there)
    assert.ok(
      !(name === "updateBubbles" ? /\.textContent = / : /\.(textContent|innerHTML|hidden|disabled) = /).test(
        body,
      ),
      name + " writes only what changed",
    );
  }
  assert.ok(!/querySelector/.test(tags), "a tag's parts are found once (tagParts), not every frame");
  assert.ok(!/offsetWidth|offsetHeight/.test(tags), "the tags are measured in placeTags only");
  assert.match(
    place,
    /if \(parts\.resize \|\| !b\._w\) \{\n\s+parts\.resize = false;\n\s+b\._w = b\.offsetWidth;/,
  );
  assert.equal(alert.match(/offsetWidth/g).length, 1, "the alert's marker is measured when its words change");
  assert.match(alert, /if \(!markerHalf\) markerHalf = marker\.offsetWidth \/ 2 \+ 6;/);
  assert.match(
    tags,
    /tagHidden\(b, parts, hidden\);\n\s+\/\/[^\n]*\n\s+if \(hidden\) continue;/,
    "a hidden tag gets nothing but its hidden",
  );
  // the HUD, eight times a second: every write through put / putHTML / putFlag / putStyle
  for (const head of [
    "function updateUI() {",
    "function updateQueue() {",
    "function updateDiveButton(b, i, p) {",
    "function updateWavesButton(b) {",
    "function updateShipGauge(b) {",
    "function updateTrampolineButton(p) {",
    "function renderIncidentPanel(panel) {",
  ]) {
    const body = bodyOf(app, head);
    assert.ok(
      !/\.(textContent|innerHTML|hidden|disabled) = |\.style\.\w+ = /.test(body),
      head + " writes to the page only what changed",
    );
    assert.ok(!/document\.querySelector/.test(body), head + " does not search the whole page");
  }
  assert.match(app, /const putHTML = \(el, html\) => \{\n  if \(el\._html === html\) return;/);
}

// 10) The log's housekeeping is done between frames: its count of the scene, a playtest's copy, its saves.
assert.match(app, /whenIdle\(sampleLog\);/);
assert.match(app, /if \(live\.due\(\)\) whenIdle\(\(\) => live\?\.poll\(\)\);/);
{
  const { installCrashLog } = await import("./dist/crashlog-hooks.mjs");
  const timers = [],
    idles = [],
    store = new Map(),
    writes = [];
  const storage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => (store.set(k, v), writes.push(k)),
    removeItem: (k) => store.delete(k),
  };
  const win = {
    addEventListener() {},
    setTimeout: (fn, ms) => timers.push([fn, ms]),
    requestIdleCallback: (fn, options) => idles.push([fn, options]),
  };
  const log = installCrashLog({ win, doc: { addEventListener() {} }, con: {}, nav: {}, storage });
  const before = writes.length;
  log.crumb("x", "something happened");
  assert.equal(writes.length, before, "a line of the log is not saved in the frame that wrote it");
  assert.equal(timers.length, 1);
  timers.pop()[0]();
  assert.equal(writes.length, before, "…nor when its time comes, but when the page is next idle");
  assert.equal(idles.length, 1);
  assert.equal(idles[0][1].timeout, 250, "…a quarter of a second later at most");
  idles.pop()[0]();
  assert.equal(writes.length, before + 1);
  // (a new error is saved at once, as ever: the page may be about to die)
  log.error("test", new Error("boom"));
  assert.equal(writes.length, before + 2);
  // (no idle callback, as in Safari: saved when due)
  const plain = installCrashLog({
    win: { addEventListener() {}, setTimeout: (fn) => fn() },
    doc: { addEventListener() {} },
    con: {},
    nav: {},
    storage,
  });
  const n = writes.length;
  plain.crumb("x", "y");
  assert.equal(writes.length, n + 1);
}

// 11) A frame far longer than the ones around it leaves a line in the log, with the stage that took the time.
{
  const watch = bodyOf(app, "function hitchWatch(gap, work) {");
  assert.match(watch, /crashlog\.crumb\(\n?\s*"hitch",/);
  assert.match(
    watch,
    /usualWork \* HITCH\.times/,
    "against the shift's own frames, not a fixed number alone",
  );
  assert.match(watch, /hitch\.lines >= HITCH\.most/, "never more than a few a shift");
  assert.match(app, /hitchWatch\(gap, performance\.now\(\) - began\);\n\}/);
  assert.match(bodyOf(app, "function stage(name, fn) {"), /stageMs\[name\] = performance\.now\(\) - began;/);
}

// 12) The deck's contacts and the loose props make nothing new as they go (they run for everybody, every tick and every frame).
{
  const deck = read("dist/deck-physics.mjs");
  for (const head of [
    "export function prepareDeck(sim, dt) {",
    "export function resolveDeck(sim) {",
    "function displace(p, x, z, sim) {",
    "export function onDeck(p, venue = CLUB) {",
  ]) {
    const body = bodyOf(deck, head);
    assert.ok(
      !/\.filter\(|\.map\(|\[\.\.\.|=>|\]\.includes\(/.test(body),
      head + " makes no list and no function",
    );
  }
  const { LooseProps } = await import("./dist/scene/loose.mjs");
  const { PoolSimulation } = await import("./dist/sim.mjs");
  const world = new PoolWorld({ clientWidth: 1440, clientHeight: 900 }, () => {}, { headless: true });
  const sim = new PoolSimulation(6, 7);
  sim.start({ countdown: false });
  for (let i = 0; i < 600; i++) sim.tick(1 / 60);
  world.sync(sim, 0, 1 / 60);
  const loose = world.loose;
  assert.ok(loose instanceof LooseProps);
  const a = loose.pushers(sim, 1 / 60),
    first = a[0],
    n = a.length;
  assert.ok(n > 0, "somebody is on foot");
  const x = first.x;
  sim.coach.x += 0.05;
  const b = loose.pushers(sim, 1 / 60);
  assert.equal(b, a, "the same list, filled again");
  assert.equal(b[0], first, "…of the same records");
  assert.equal(b.length, n);
  assert.ok(Math.abs(first.vx - 3) < 1e-6 && first.x === x + 0.05, "a pusher's speed is from its last place");
  // (somebody who left is forgotten)
  const gone = sim.people.find((q) => loose.prev.has(q.id));
  if (gone) {
    gone.status = "gone";
    loose.pushers(sim, 1 / 60);
    assert.ok(!loose.prev.has(gone.id));
  }
}

console.log(
  "Performance checks passed: a venue's every texture, uniform picture and skeleton freed with it, the dressed venues' and the crowd's shader pictures too; venues loaded when played; no layout read per frame; the crowd drawing only the pose each spectator is in. The second pass: the cues' pulse set where something pulses; a picture on the card sharpened there, the cast's before the first frame; flat see-through things drawn in one pass; the characters' and the crowd's shadows with a depth material each; the tags, the alert, the prompt and the HUD reading nothing from the page and writing only what changed; the log's housekeeping between frames; a hitch's line in the log; the deck's contacts and the loose props making nothing new.",
);
