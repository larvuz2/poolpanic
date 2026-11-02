// The dressed venues' positions are exact (2 November 2026, the creator: the Kids Pool's floor "glitches everywhere… fighting for the
// same pixels… make sure that we don't replicate this on other levels"). gltfpack quantized every mesh of a venue on one shared grid
// as wide as its widest mesh (the ground running out to the horizon: 17 mm a step at 14 bits), so a band, an inlay or a picture a
// few mm over its surface fell onto it and the two fought for the pixels. Every dressed venue's model now keeps its positions as
// floats (tools/venues/common/pack.sh, godot/tools/three-club-pack.sh: -vpf), and the overview camera's near plane is at 1 m (it never
// comes nearer than about 14 m), not 0.1, for ten times the depth buffer's precision on any graphics card.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

const ASSETS = "dist/assets/";
const models = [];
for (const dir of readdirSync(ASSETS)) {
  for (const f of existsSync(ASSETS + dir) && !dir.includes(".") ? readdirSync(ASSETS + dir) : []) {
    // (a dressed venue's model: a GLB beside its JSON of tiles, atlases and anchors)
    if (!f.endsWith(".glb") || !existsSync(ASSETS + dir + "/" + f.replace(/\.glb$/, ".json"))) continue;
    const info = JSON.parse(readFileSync(ASSETS + dir + "/" + f.replace(/\.glb$/, ".json"), "utf8"));
    if (!info.tiles && !info.atlases) continue;
    models.push(ASSETS + dir + "/" + f);
  }
}
assert.ok(
  models.length >= 14,
  models.length + " dressed venues' models (the Community Pool and the thirteen others)",
);
for (const file of models) {
  const bytes = readFileSync(file),
    json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString("utf8"));
  let meshes = 0;
  for (const mesh of json.meshes)
    for (const p of mesh.primitives) {
      const a = json.accessors[p.attributes.POSITION];
      assert.equal(a.componentType, 5126, file + ": positions as floats, never quantized (pack.sh -vpf)");
      meshes++;
    }
  assert.ok(meshes > 5, file + ": its meshes");
}

// The overview camera's near plane: 1 m; the Coach Cam's, close to the eye.
const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const { createCanvas } = runtime
  ? await import(pathToFileURL(runtime + "/@napi-rs/canvas/index.js"))
  : await import("@napi-rs/canvas");
globalThis.document = { createElement: () => createCanvas(256, 128) };
globalThis.window = { matchMedia: () => ({ matches: false }) };
const quiet = console.warn;
console.warn = () => {};
const { PoolWorld } = await import("./dist/scene.mjs");
const { VENUES } = await import("./dist/spatial.mjs");
const world = new PoolWorld({ clientWidth: 1440, clientHeight: 900 }, () => {}, {
  headless: true,
  venue: VENUES.kids,
});
world.resize();
assert.equal(world.viewMode, "overview");
assert.equal(world.camera.near, 1, "the overview's near plane at 1 m");
assert.ok(world.cameraDistance / 1.4 > 10, "the overview camera stays well beyond it");
console.warn = quiet;

console.log(
  `Venue precision checks passed: ${models.length} dressed venues' models keep their positions as floats (nothing a few mm over a surface falls onto it), and the overview camera's near plane is at 1 m.`,
);
