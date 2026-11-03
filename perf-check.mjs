// The performance pass of 3 November 2026 (README "Performance"), kept from coming back:
// - taking a venue down frees every texture a material holds (its slots and its uniforms) and every skeleton's bones;
// - a dressed venue's pictures and the crowd's go in the world's `textures`, freed with the venue;
// - the dressed venues load when played (`loadVenue`), never all at launch;
// - nothing per frame reads the page's layout (`viewSize`);
// - the crowd draws only the pose each spectator is in.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

console.log(
  "Performance checks passed: a venue's every texture, uniform picture and skeleton freed with it, the dressed venues' and the crowd's shader pictures too; venues loaded when played; no layout read per frame; the crowd drawing only the pose each spectator is in.",
);
