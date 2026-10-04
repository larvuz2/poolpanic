// The fish as a model (scene/fish-model.mjs, assets/fish.glb): the file stands as the module expects, a fish made before the model
// came is dressed when it does and one made after is dressed at once, each fish has its own wave, a model that does not load leaves
// the classic koi, and the fish of the Fish Kid incident is seen only once the kid has tipped it out of the bucket, in the pool.
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";
import * as THREE from "./dist/assets/three.module.js";
import {
  FISH_LENGTH,
  dressFish,
  fishModelReady,
  loadFishModel,
  swimModel,
  useFishTemplate,
} from "./dist/scene/fish-model.mjs";
import { PoolSimulation } from "./dist/sim.mjs";

// ---- the file ---------------------------------------------------------------------------------------------------------
{
  const file = "dist/assets/fish.glb";
  assert.ok(existsSync(file), "the fish is in the game's assets");
  assert.ok(statSync(file).size < 500_000, "and it is light: " + statSync(file).size + " bytes");
  const data = readFileSync(file);
  assert.equal(data.toString("latin1", 0, 4), "glTF", "a GLB");
  const jsonLength = data.readUInt32LE(12);
  const json = JSON.parse(data.toString("utf8", 20, 20 + jsonLength));
  const bin = data.subarray(20 + jsonLength + 8);
  assert.equal(json.meshes.length, 1, "one mesh");
  assert.equal(json.meshes[0].primitives.length, 1, "in one piece");
  assert.ok(!json.skins && !json.animations, "with no skeleton and no clips: it swims in the vertex shader");
  assert.equal(json.nodes.length, 1, "one node");
  for (const key of ["matrix", "translation", "rotation", "scale"])
    assert.ok(!(key in json.nodes[0]), `with no ${key}: the wave works on the mesh's own coordinates`);
  const [material] = json.materials;
  assert.equal(material.pbrMetallicRoughness.metallicFactor, 0, "a matte material, not Meshy's mirror");
  assert.ok(!material.emissiveFactor || material.emissiveFactor.every((v) => v === 0), "that does not glow");
  assert.ok(material.pbrMetallicRoughness.baseColorTexture, "painted by one texture");
  assert.equal(json.images.length, 1);
  assert.equal(json.images[0].mimeType, "image/jpeg", "a JPEG");

  const primitive = json.meshes[0].primitives[0];
  const triangles = json.accessors[primitive.indices].count / 3;
  assert.ok(
    triangles > 2000 && triangles < 12000,
    `a fish of ${triangles} triangles, light enough for a few in a scene`,
  );
  const position = json.accessors[primitive.attributes.POSITION];
  const view = json.bufferViews[position.bufferView];
  const stride = view.byteStride || 12;
  const at = (i, c) =>
    bin.readFloatLE((view.byteOffset || 0) + (position.byteOffset || 0) + i * stride + c * 4);
  const [lo, hi] = [position.min, position.max];
  const length = hi[2] - lo[2];
  assert.ok(
    length > hi[0] - lo[0] && length > hi[1] - lo[1],
    "its length runs along z, the way the fish swims",
  );

  // The file's convention is the nose to +z and the back to +y. Its head is wide (the eyes stand out at the sides) and its tail
  // a thin fin, and the dorsal fin stands up further than the fins under the belly hang.
  const wide = (from, to) => {
    let a = Infinity,
      b = -Infinity;
    for (let i = 0; i < position.count; i++) {
      const z = at(i, 2);
      if (z < from || z > to) continue;
      a = Math.min(a, at(i, 0));
      b = Math.max(b, at(i, 0));
    }
    return b - a;
  };
  const front = wide(hi[2] - 0.15 * length, hi[2]),
    rear = wide(lo[2], lo[2] + 0.15 * length);
  assert.ok(
    front > 2 * rear,
    `the nose is at +z: the head is ${front.toFixed(2)} wide, the tail ${rear.toFixed(2)}`,
  );
  const ys = Array.from({ length: position.count }, (_, i) => at(i, 1)).sort((a, b) => a - b);
  const middle = ys[ys.length >> 1];
  assert.ok(
    hi[1] - middle > 1.3 * (middle - lo[1]),
    "and the back is at +y: the dorsal fin stands up, the belly's fins hang less",
  );
}

// ---- the module, with a stand-in for the model ------------------------------------------------------------------------
const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const { createCanvas } = runtime
  ? await import(pathToFileURL(runtime + "/@napi-rs/canvas/index.js"))
  : await import("@napi-rs/canvas");
globalThis.document = { createElement: () => createCanvas(256, 128) };
globalThis.window = { matchMedia: () => ({ matches: false }) };
const { PoolWorld } = await import("./dist/scene.mjs");
const { fishNetObject, fishObject } = await import("./dist/scene/props.mjs");

const world = new PoolWorld({ clientWidth: 1200, clientHeight: 800 }, () => {}, { headless: true });
const classic = (g) => g.getObjectByName("fish-body");
const fishGroups = () => {
  const found = [];
  world.scene.traverse((o) => o.children.some((c) => c.name === "fish-body") && found.push(o)); // (what fishObject builds)
  return found;
};

// The model's scene as the loader gives it: a file's own size and origin, not the game's.
const standIn = () => {
  const scene = new THREE.Group();
  const geometry = new THREE.BoxGeometry(0.5, 0.6, 1.9);
  geometry.translate(0.1, 0.7, 2.2); // (z from 1.25 to 3.15: the nose at 3.15, 1.9 long)
  scene.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x889944 })));
  return scene;
};

{
  assert.ok(!fishModelReady(), "no model before it is asked for");
  const pool = world.incidentView.fish;
  assert.ok(classic(pool) && !pool.userData.fishModel, "the fish of the pool is the classic koi");
  assert.equal(dressFish(fishObject(world, 1)), false, "a fish made before the model is not dressed yet");

  // A model that does not load leaves the classic koi (and can be asked for again).
  const warn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args);
  assert.equal(await loadFishModel("file:///nowhere/"), null, "a model that does not load is left out");
  assert.equal(await loadFishModel("file:///nowhere/"), null, "and asking again is no trouble");
  console.warn = warn;
  assert.ok(warnings.length === 2 && !fishModelReady(), "it said so, and the classic fish stays");
  assert.ok(!pool.userData.fishModel && classic(pool).visible, "(the koi is still the fish)");

  // The model comes: the fish that were made without it are dressed.
  const template = useFishTemplate(standIn());
  assert.ok(fishModelReady() && template, "the model is in");
  const groups = fishGroups();
  assert.ok(groups.length >= 1, "there are fish in the scene");
  for (const g of groups) {
    assert.ok(
      g.userData.fishModel && g.getObjectByName("fish-model") === g.userData.fishModel,
      "each is dressed with the model",
    );
    assert.equal(classic(g).visible, false, "and the koi under it is hidden");
  }
  assert.ok(pool.userData.fishModel && pool.userData.fishSwim, "the pool's fish is one of them");
  assert.equal(await loadFishModel("file:///nowhere/"), template, "and the model is not fetched again");

  // One made now is dressed at once, and every fish is the same size.
  const a = fishObject(world, 1),
    b = fishObject(world, 1);
  assert.ok(
    a.userData.fishModel && b.userData.fishModel,
    "a fish made after the model is dressed as it is made",
  );
  assert.equal(dressFish(a), true, "dressing twice changes nothing");
  assert.equal(a.children.filter((c) => c.name === "fish-model").length, 1, "and adds no second model");
  world.scene.add(a, b);
  a.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(a.userData.fishModel);
  const size = box.getSize(new THREE.Vector3()),
    middle = box.getCenter(new THREE.Vector3());
  assert.ok(
    Math.abs(size.z - FISH_LENGTH) < 1e-6,
    `it is ${FISH_LENGTH} m long at a scale of 1, whatever the file's size (${size.z})`,
  );
  assert.ok(
    Math.abs(middle.x) < 1e-6 && Math.abs(middle.z) < 1e-6,
    "with its middle on the group's origin, nose to +z",
  );
  assert.ok(box.max.z > 0 && box.min.z < 0 && Math.abs(box.max.z + box.min.z) < 1e-6, "along the length");
  const big = fishObject(world, 1.45);
  big.updateMatrixWorld(true);
  assert.ok(
    Math.abs(
      new THREE.Box3().setFromObject(big.userData.fishModel).getSize(new THREE.Vector3()).z -
        FISH_LENGTH * 1.45,
    ) < 1e-6,
    "and the group's scale is the size of the fish",
  );

  // Each fish bends in its own time, from one shared mesh and texture.
  const meshOf = (g) => {
    let mesh;
    g.userData.fishModel.traverse((o) => o.isMesh && (mesh = o));
    return mesh;
  };
  const [ma, mb] = [meshOf(a), meshOf(b)];
  assert.equal(ma.geometry, mb.geometry, "the fish share one geometry");
  assert.notEqual(ma.material, mb.material, "and have a material each, for a wave each");
  assert.equal(ma.material.map, mb.material.map, "(with one texture)");
  assert.equal(
    ma.frustumCulled,
    false,
    "the wave moves the vertices out of the mesh's bounds, so it is not culled",
  );
  assert.ok(ma.castShadow, "it casts a shadow");
  assert.ok(
    ma.material.color.r > new THREE.Color(0x889944).r,
    "a little brighter than its texture, which comes out dark under the water's light",
  );
  swimModel(a, 1.5, 0.1);
  assert.deepEqual(
    [a.userData.fishSwim.time.value, a.userData.fishSwim.amp.value],
    [1.5, 0.1],
    "the wave is set on the fish",
  );
  assert.deepEqual(
    [b.userData.fishSwim.time.value, b.userData.fishSwim.amp.value],
    [0, 0],
    "and only on that fish",
  );
  swimModel(new THREE.Group(), 1, 1); // (a fish without the model has no wave to set: nothing to do, and no trouble)

  // The shader the material compiles: the wave from the nose (still) to the tail, on the fish's own uniforms.
  const compile = (material) => {
    const shader = {
      uniforms: {},
      vertexShader: "#include <common>\nvoid main() {\n#include <begin_vertex>\n#include <project_vertex>\n}",
    };
    material.onBeforeCompile(shader, null);
    return shader;
  };
  const [sa, sb] = [compile(ma.material), compile(mb.material)];
  assert.equal(sa.uniforms.uSwimTime, a.userData.fishSwim.time, "its time is the fish's own");
  assert.equal(sa.uniforms.uSwimAmp, a.userData.fishSwim.amp, "so is its size");
  assert.notEqual(sa.uniforms.uSwimTime, sb.uniforms.uSwimTime, "the other fish has its own");
  assert.equal(sa.vertexShader, sb.vertexShader, "from the same code");
  assert.match(
    sa.vertexShader,
    /uniform float uSwimTime;[\s\S]*#include <begin_vertex>[\s\S]*transformed\.x \+= /,
    "bending sideways",
  );
  assert.match(
    sa.vertexShader,
    /clamp\(\(3\.1500 - position\.z\) \/ 1\.9000, 0\.0, 1\.0\)/,
    "from the file's nose, over the file's length",
  );
  assert.ok(
    sa.vertexShader.indexOf("#include <begin_vertex>") < sa.vertexShader.indexOf("transformed.x"),
    "after the vertex is set up",
  );
  assert.equal(
    ma.material.customProgramCacheKey(),
    mb.material.customProgramCacheKey(),
    "one program for every fish",
  );
}

// ---- the fish of the incident -----------------------------------------------------------------------------------------
{
  const sim = new PoolSimulation(8, 5);
  sim.start({ countdown: false });
  for (let i = 0; i < 60 * 5; i++) sim.tick(1 / 60);
  world.resetActors();
  let clock = 900;
  const sync = (n = 1) => {
    for (let i = 0; i < n; i++) world.sync(sim, (clock += 1 / 60), 1 / 60);
  };
  const pool = world.incidentView.fish;
  sync(2);
  assert.equal(pool.visible, false, "no fish in the pool before the incident");
  sim.triggerChaos("fish");
  sync(2);
  const kid = sim.visitors.find((v) => v.kind === "kid");
  for (const status of ["entering", "walking", "waiting", "dumping"]) {
    kid.status = status;
    sync(2);
    assert.equal(
      pool.visible,
      false,
      `no fish seen while he is ${status}: it is in the bucket, and the bucket's fish is not drawn`,
    );
  }
  assert.ok(sim.fish.stage !== "loose", "(the simulation has not let it go)");
  // He tips it out: the simulation lets it go, and it is there, in the pool, swimming.
  sim.fish.stage = "loose";
  Object.assign(sim.fish, { x: 1, z: 0.5, vx: 3, vz: 0, heading: 1.3, leap: 0 });
  sync(2);
  assert.equal(pool.visible, true, "once it is out it is seen in the pool");
  assert.ok(
    Math.abs(pool.position.x - 1) < 1e-9 && Math.abs(pool.position.z - 0.5) < 1e-9,
    "where the simulation has it",
  );
  assert.ok(pool.userData.fishModel.visible && classic(pool).visible === false, "the model, not the koi");
  const was = pool.userData.fishSwim.time.value;
  sync(10);
  assert.ok(pool.userData.fishSwim.time.value !== was, "its tail beats");
  assert.ok(
    pool.userData.fishSwim.amp.value > 0.09,
    "the faster it goes, the further it swings: " + pool.userData.fishSwim.amp.value,
  );
  const slow = pool.userData.fishSwim.amp.value;
  Object.assign(sim.fish, { vx: 7, vz: 0 });
  sync(2);
  assert.ok(pool.userData.fishSwim.amp.value > slow, "darting swings further than cruising");
  sim.fish.stage = "netted";
  sync(2);
  assert.equal(pool.visible, false, "caught, it leaves the pool");

  // The fish in the net (the rack's, and the one the coach carries) are the model too.
  const net = fishNetObject(world);
  assert.ok(net.getObjectByName("net-fish").userData.fishModel, "the fish in the net is the model");
}

// ---- the game asks for it -----------------------------------------------------------------------------------------------
{
  const app = readFileSync("dist/app.mjs", "utf8");
  assert.match(
    app,
    /function loadFishKid\(s\) \{[^}]*"models"[^}]*\n\s*loadFigure\("kid"\);\n\s*loadFishModel\(\);/,
    "a shift that can have the fish incident fetches the fish with the kid, and ?swimmers=classic neither",
  );
}

console.log(
  "Fish model checks passed: the file's shape (one mesh, matte, nose to +z, back to +y), fish dressed when the model comes or when they are made, a wave of its own for each, a model that does not load leaves the koi, and the fish seen only after the kid has tipped it out.",
);
