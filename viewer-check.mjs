// Checks what the internal animation viewer (tools/viewer) is fed: every character in characters.json is a real GLB
// with a skin and uniquely named clips that loop without a jump and never snap a bone in a single frame, the page
// follows the artifact host's rules, and the viewer builds into one flat folder that carries the game's own three.js.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const dir = "tools/viewer";
const FPS = 24;
const POP_DEG = 40; // the same limits the viewer flags in the page
const MAX_GLB_BYTES = 15 * 1024 * 1024; // the artifact host's limit for a binary file

function readGlb(file) {
  const data = readFileSync(file);
  assert.equal(data.toString("latin1", 0, 4), "glTF", `${file} is not a GLB`);
  assert.equal(data.readUInt32LE(4), 2, `${file} is not glTF 2`);
  const jsonLength = data.readUInt32LE(12);
  const json = JSON.parse(data.toString("utf8", 20, 20 + jsonLength));
  return { json, bin: data.subarray(20 + jsonLength + 8) }; // the binary chunk follows the JSON chunk's 8-byte header
}

function accessor(glb, index) {
  const a = glb.json.accessors[index];
  const view = glb.json.bufferViews[a.bufferView];
  const size = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type];
  assert.ok(size && a.componentType === 5126, "animation data is float scalars or vectors");
  const start = (view.byteOffset || 0) + (a.byteOffset || 0);
  const stride = view.byteStride || size * 4;
  return Array.from({ length: a.count }, (_, i) =>
    Array.from({ length: size }, (_, c) => glb.bin.readFloatLE(start + i * stride + c * 4)),
  );
}

// Is the last key the first key again, and what is the most any bone turns between two keys, in degrees per frame?
function inspectClip(glb, animation) {
  let closed = true;
  let maxDeg = 0;
  for (const channel of animation.channels) {
    const sampler = animation.samplers[channel.sampler];
    if (sampler.interpolation && sampler.interpolation !== "LINEAR") continue;
    const times = accessor(glb, sampler.input).map((r) => r[0]);
    const values = accessor(glb, sampler.output);
    if (values.length < 2) continue;
    const first = values[0];
    const last = values.at(-1);
    if (channel.target.path === "rotation") {
      const turn = (p, q) => {
        const dot = p.reduce((sum, v, i) => sum + v * q[i], 0);
        return (2 * Math.acos(Math.min(1, Math.abs(dot))) * 180) / Math.PI;
      };
      if (turn(first, last) > 0.25) closed = false;
      for (let i = 0; i < values.length - 1; i++)
        maxDeg = Math.max(
          maxDeg,
          turn(values[i], values[i + 1]) / Math.max((times[i + 1] - times[i]) * FPS, 1e-6),
        );
    } else if (first.some((v, i) => Math.abs(v - last[i]) > 1e-3)) closed = false;
  }
  return { closed, maxDeg };
}

const manifest = JSON.parse(readFileSync(`${dir}/characters.json`, "utf8"));
assert.ok(
  Array.isArray(manifest.characters) && manifest.characters.length,
  "characters.json lists characters",
);
const ids = new Set();
let clipCount = 0;
for (const character of manifest.characters) {
  assert.ok(character.id && character.name && character.file, "a character has an id, a name and a file");
  assert.ok(!ids.has(character.id), `duplicate character id ${character.id}`);
  ids.add(character.id);
  for (const file of [character.file, ...(character.clipFiles || [])]) {
    const path = resolve(dir, file); // a character's file is found from the viewer's folder (Coach Panic's is the game's own)
    assert.ok(existsSync(path), `${path} is missing`);
    assert.ok(statSync(path).size < MAX_GLB_BYTES, `${path} is over the artifact host's 15 MB file limit`);
    const glb = readGlb(path);
    if (file === character.file && !character.static) assert.ok(glb.json.skins?.length, `${file} has no skin`);
    const names = new Set();
    for (const animation of glb.json.animations || []) {
      const name = animation.name;
      assert.ok(name && !names.has(name), `${file}: clip names must be present and unique (${name})`);
      names.add(name);
      clipCount++;
      const allowed = character.clips?.[name] || {};
      const { closed, maxDeg } = inspectClip(glb, animation);
      assert.ok(
        closed || allowed.open,
        `${character.name} / ${name}: the last pose is not the first, so the loop jumps (set clips.${name}.open to allow)`,
      );
      assert.ok(
        maxDeg <= POP_DEG || allowed.pop,
        `${character.name} / ${name}: a bone turns ${maxDeg.toFixed(0)}° in one frame (set clips.${name}.pop to allow)`,
      );
    }
  }
}

// The page is published inside the host's own document skeleton and loads its script from next to it.
const page = readFileSync(`${dir}/index.html`, "utf8");
assert.ok(/<title>[^<]+<\/title>/.test(page.slice(0, 8192)), "index.html starts with a <title>");
assert.ok(
  !/<!doctype|<html[\s>]|<head[\s>]|<body[\s>]/i.test(page),
  "index.html is a page fragment: the host adds the document, head and body",
);
assert.ok(page.includes('src="viewer.js"'), "index.html loads viewer.js");
const syntax = spawnSync(process.execPath, ["--check", `${dir}/viewer.js`], { encoding: "utf8" });
assert.equal(syntax.status, 0, `viewer.js does not parse:\n${syntax.stderr}`);

// The build is one flat folder, with the game's own three.js.
const build = spawnSync("bash", [`${dir}/build.sh`], { encoding: "utf8" });
assert.equal(build.status, 0, `build.sh failed:\n${build.stderr}`);
for (const file of [
  "index.html",
  "viewer.js",
  "characters.json",
  "three.module.js",
  "GLTFLoader.js",
  "OrbitControls.js",
  "BufferGeometryUtils.js",
])
  assert.ok(existsSync(`${dir}/.build/${file}`), `the build lacks ${file}`);
// The host serves no .glb, so the build carries each model as base64 text that decodes to the same bytes.
const built = JSON.parse(readFileSync(`${dir}/.build/characters.json`, "utf8"));
for (const [i, character] of manifest.characters.entries()) {
  const file = `${dir}/.build/${built.characters[i].file}`;
  assert.equal(
    built.characters[i].file,
    `models/${basename(character.file)}.b64.txt`,
    "the built manifest points at the base64 models",
  );
  assert.ok(existsSync(file), `the build lacks ${built.characters[i].file}`);
  assert.ok(
    Buffer.from(readFileSync(file, "utf8"), "base64").equals(readFileSync(resolve(dir, character.file))),
    `${file} differs from its GLB`,
  );
}
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
assert.equal(
  sha(`${dir}/.build/three.module.js`),
  sha("dist/assets/three.module.js"),
  "the viewer runs the game's three.js",
);
for (const add of ["GLTFLoader", "OrbitControls", "BufferGeometryUtils"]) {
  const code = readFileSync(`${dir}/.build/${add}.js`, "utf8");
  assert.ok(!/from 'three'|\.\.\/utils\//.test(code), `${add}.js still imports by bare name`);
}

console.log(
  `Viewer checks passed: ${manifest.characters.length} character(s), ${clipCount} clip(s) that loop clean and never snap, a fragment page, a flat build on the game's three.js.`,
);
