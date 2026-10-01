// Checks the characters rigged on another character's skeleton (tools/blender/rig_from_template.py). Every character
// in tools/viewer/characters.json that names a "skeleton" has that template's bones (same names, same parents, same
// rest rotations, so the template's clips play on it by bone name), a bind pose that matches its bones, bones that sit
// inside the body, and a skin whose weights add up to one with the same bones left unweighted as in the template. The
// clips such a character lists as "retargeted" (tools/blender/retarget_clips.py) really are the template's: the same
// rotation of every bone at every frame, the hips' travel the template's times one factor and a lift straight up, the
// bones' own offsets. And every clip, the template's too, stands on the floor (tools/blender/ground_clips.py): played
// on the skinned mesh, its lowest point is at floor level, not under it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dir = "tools/viewer";
const REST_DEG = 0.01; // rest rotations are copied, a clip's rotation keys only fit the new rig if they match
const BIND_ERROR = 1e-3; // inverse bind matrix times the bone's rest matrix is the identity
const MARGIN = 0.03; // metres a bone may stick out of the mesh's box (a fingertip, a toe)
const HEIGHT_SHIFT = 0.25; // a bone sits within a quarter of the body height of where the template has it
const FPS = 24;
const CLIP_DEG = 0.01; // a retargeted clip turns every bone as the template's does, to within a rounding error
const CLIP_CM = 0.01; // translations are in centimetres: a tenth of a millimetre
const TRAVEL_RANGE = [0.25, 4]; // the hips travel this many times the template's (a child, a giant)
const LIFT_MAX_CM = 12; // a clip's hips sit at most this much higher than the template's travel says
const GROUND_CM = 0.5; // the lowest point of a clip is within half a centimetre of the floor

function readGlb(file) {
  const data = readFileSync(file);
  assert.equal(data.toString("latin1", 0, 4), "glTF", `${file} is not a GLB`);
  const jsonLength = data.readUInt32LE(12);
  return {
    json: JSON.parse(data.toString("utf8", 20, 20 + jsonLength)),
    bin: data.subarray(20 + jsonLength + 8), // the binary chunk follows the JSON chunk's 8-byte header
  };
}

const COMPONENT = {
  5121: ["readUInt8", 1],
  5123: ["readUInt16LE", 2],
  5125: ["readUInt32LE", 4],
  5126: ["readFloatLE", 4],
};
const WIDTH = { SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16 };

// An accessor as a flat array of numbers (normalized integers come back as 0..1).
function accessor(glb, index) {
  const a = glb.json.accessors[index];
  const view = glb.json.bufferViews[a.bufferView];
  const [read, size] = COMPONENT[a.componentType];
  const width = WIDTH[a.type];
  const stride = view.byteStride || width * size;
  const start = (view.byteOffset || 0) + (a.byteOffset || 0);
  const scale = a.normalized ? 1 / (2 ** (8 * size) - 1) : 1;
  const out = new Float64Array(a.count * width);
  for (let i = 0; i < a.count; i++)
    for (let c = 0; c < width; c++) out[i * width + c] = glb.bin[read](start + i * stride + c * size) * scale;
  return { values: out, count: a.count, min: a.min, max: a.max };
}

// Column-major 4x4 matrices, as glTF stores them.
function multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let col = 0; col < 4; col++)
    for (let row = 0; row < 4; row++)
      for (let k = 0; k < 4; k++) out[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k];
  return out;
}

function compose(t = [0, 0, 0], q = [0, 0, 0, 1], s = [1, 1, 1]) {
  const [x, y, z, w] = q;
  const m = [
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
    t[0], t[1], t[2], 1,
  ]; // prettier-ignore
  for (let col = 0; col < 3; col++) for (let row = 0; row < 3; row++) m[col * 4 + row] *= s[col];
  return m;
}

// The angle between two rotations. Normalised first: a quaternion stored as floats is not quite unit length, and acos
// near 1 turns that rounding into a few hundredths of a degree between two copies of the same rotation.
const degrees = (p, q) => {
  const dot = p.reduce((sum, v, i) => sum + v * q[i], 0) / (Math.hypot(...p) * Math.hypot(...q));
  return (2 * Math.acos(Math.min(1, Math.abs(dot))) * 180) / Math.PI;
};

// Every clip as {track name: keys}, a track named "Bone.path" (rotation, translation or scale).
function readClips(glb) {
  const clips = {};
  for (const animation of glb.json.animations || []) {
    const tracks = {};
    for (const channel of animation.channels) {
      const sampler = animation.samplers[channel.sampler];
      assert.notEqual(
        sampler.interpolation,
        "CUBICSPLINE",
        `${animation.name}: cubic splines are not compared`,
      );
      const times = accessor(glb, sampler.input).values;
      const values = accessor(glb, sampler.output).values;
      tracks[`${glb.json.nodes[channel.target.node].name}.${channel.target.path}`] = {
        times,
        values,
        width: values.length / times.length,
        step: sampler.interpolation === "STEP",
      };
    }
    clips[animation.name] = tracks;
  }
  return clips;
}

const clipLength = (clip) => Math.max(...Object.values(clip).map((track) => track.times.at(-1)));

// The value of a track at a time: held (STEP) or blended between the two keys around it, rotations the short way round.
function sample(track, time) {
  const { times, values, width, step } = track;
  let i = times.length - 1;
  while (i > 0 && times[i] > time) i--;
  const a = Array.from(values.subarray(i * width, (i + 1) * width));
  if (step || i === times.length - 1) return a;
  const b = Array.from(values.subarray((i + 1) * width, (i + 2) * width));
  const f = (time - times[i]) / (times[i + 1] - times[i]);
  const flip = width === 4 && a.reduce((sum, v, k) => sum + v * b[k], 0) < 0 ? -1 : 1;
  const mix = a.map((v, k) => v * (1 - f) + flip * b[k] * f);
  const length = width === 4 ? Math.hypot(...mix) : 1;
  return mix.map((v) => v / length);
}

// How high the lowest point of the posed mesh is, in metres above the floor, at every frame of a clip (about 48 of them in
// a long one). The bones are posed from the clip's keys, and from their rest values where it has none; each vertex is
// skinned by its weights. Only the height is worked out, which is one row of each bone's matrix.
function lowestPoints(rig, clip) {
  const { nodes, parent, order, jointNodes, inverseBind, positions, joints, weights } = rig.skin;
  const frames = Math.round(clipLength(clip) * FPS);
  const step = Math.max(1, Math.ceil(frames / 48));
  const lows = [];
  for (let f = 0; f <= frames; f += step) {
    const world = new Map();
    for (const i of order) {
      const node = nodes[i];
      const keyed = (path) =>
        clip[`${node.name}.${path}`] ? sample(clip[`${node.name}.${path}`], f / FPS) : node[path];
      const local = node.matrix || compose(keyed("translation"), keyed("rotation"), keyed("scale"));
      world.set(i, parent.has(i) ? multiply(world.get(parent.get(i)), local) : local);
    }
    const rows = jointNodes.map((node, k) =>
      multiply(world.get(node), inverseBind.subarray(k * 16, k * 16 + 16)),
    );
    let low = Infinity;
    for (let v = 0; v < positions.length / 3; v++) {
      let y = 0;
      for (let c = 0; c < 4; c++) {
        const w = weights[v * 4 + c];
        if (w === 0) continue;
        const m = rows[joints[v * 4 + c]];
        y +=
          w * (m[1] * positions[v * 3] + m[5] * positions[v * 3 + 1] + m[9] * positions[v * 3 + 2] + m[13]);
      }
      low = Math.min(low, y);
    }
    lows.push(low);
  }
  return lows;
}

// Every clip stands on the floor: its lowest point is at floor level, not under it (a hover or a sink fails).
function standsOnTheFloor(rig, label) {
  for (const [name, clip] of Object.entries(rig.clips)) {
    const low = Math.min(...lowestPoints(rig, clip));
    assert.ok(
      Math.abs(low) < GROUND_CM / 100,
      `${label} / ${name}: the lowest point is ${Math.abs(low * 100).toFixed(1)} cm ${low < 0 ? "under" : "above"} the floor (tools/blender/ground_clips.py lifts the hips)`,
    );
  }
}

// The skin's bones by name: parent, rest rotation, rest matrix in the scene and inverse bind matrix.
function readRig(file) {
  const glb = readGlb(file);
  const nodes = glb.json.nodes;
  const parent = new Map();
  nodes.forEach((node, i) => (node.children || []).forEach((child) => parent.set(child, i)));
  const local = (node) => node.matrix || compose(node.translation, node.rotation, node.scale);
  const world = (i) => {
    let m = local(nodes[i]);
    for (let p = parent.get(i); p !== undefined; p = parent.get(p)) m = multiply(local(nodes[p]), m);
    return m;
  };
  assert.ok(glb.json.skins?.length, `${file} has no skin`);
  const skin = glb.json.skins[0];
  const inverseBind = accessor(glb, skin.inverseBindMatrices).values;
  const bones = {};
  skin.joints.forEach((node, k) => {
    const name = nodes[node].name;
    assert.ok(!(name in bones), `${file}: two bones are called ${name}`);
    bones[name] = {
      index: k,
      parent: parent.has(node) ? nodes[parent.get(node)].name : null,
      rotation: nodes[node].rotation || [0, 0, 0, 1],
      translation: nodes[node].translation || [0, 0, 0],
      world: world(node),
      inverseBind: Array.from(inverseBind.subarray(k * 16, k * 16 + 16)),
    };
  });
  const meshNode = nodes.find((n) => n.skin !== undefined && n.mesh !== undefined);
  assert.ok(meshNode, `${file} has no skinned mesh`);
  let rootNode = skin.joints[0];
  while (parent.has(rootNode)) rootNode = parent.get(rootNode);
  const root = nodes[rootNode];
  const primitive = glb.json.meshes[meshNode.mesh].primitives[0];
  const position = accessor(glb, primitive.attributes.POSITION);
  const joints = accessor(glb, primitive.attributes.JOINTS_0).values;
  const weights = accessor(glb, primitive.attributes.WEIGHTS_0).values;
  // How much of the mesh each bone carries, and how far every vertex's weights are from adding up to one.
  const carried = Object.fromEntries(Object.keys(bones).map((name) => [name, 0]));
  const names = skin.joints.map((node) => nodes[node].name);
  let worstSum = 0;
  for (let v = 0; v < position.count; v++) {
    let sum = 0;
    for (let c = 0; c < 4; c++) {
      carried[names[joints[v * 4 + c]]] += weights[v * 4 + c];
      sum += weights[v * 4 + c];
    }
    worstSum = Math.max(worstSum, Math.abs(sum - 1));
  }
  // What lowestPoints needs: the nodes the bones hang from, from the roots down, and the skin's matrices and vertices.
  const needed = new Set();
  for (const joint of skin.joints) for (let n = joint; n !== undefined; n = parent.get(n)) needed.add(n);
  const depth = (n) => {
    let d = 0;
    for (let p = parent.get(n); p !== undefined; p = parent.get(p)) d++;
    return d;
  };
  return {
    bones,
    root: {
      scale: root.scale || [1, 1, 1],
      rotation: root.rotation || [0, 0, 0, 1],
      translation: root.translation || [0, 0, 0],
    },
    box: { min: position.min, max: position.max },
    clips: readClips(glb),
    skin: {
      nodes,
      parent,
      order: [...needed].sort((a, b) => depth(a) - depth(b)),
      jointNodes: skin.joints,
      inverseBind,
      positions: position.values,
      joints,
      weights,
    },
    carried,
    worstSum,
    vertices: position.count,
  };
}

const manifest = JSON.parse(readFileSync(`${dir}/characters.json`, "utf8"));
const byId = new Map(manifest.characters.map((c) => [c.id, c]));
const templates = new Map();
let rigged = 0;
let retargeted = 0;
for (const character of manifest.characters) {
  if (!character.skeleton) continue;
  const source = byId.get(character.skeleton);
  assert.ok(
    source,
    `${character.name}: the skeleton "${character.skeleton}" is not a character in characters.json`,
  );
  if (!templates.has(source.id)) {
    templates.set(source.id, readRig(resolve(dir, source.file)));
    standsOnTheFloor(templates.get(source.id), source.name);
  }
  const template = templates.get(source.id);
  const rig = readRig(resolve(dir, character.file));
  const label = `${character.name} (on ${source.name}'s skeleton)`;
  standsOnTheFloor(rig, label);

  // The bones: the same names, in the same hierarchy, at the same rest rotations, under a root with the same scale.
  assert.deepEqual(
    Object.keys(rig.bones).sort(),
    Object.keys(template.bones).sort(),
    `${label}: different bones`,
  );
  assert.deepEqual(rig.root.scale, template.root.scale, `${label}: the armature's scale differs`);
  assert.ok(
    degrees(rig.root.rotation, template.root.rotation) < REST_DEG,
    `${label}: the armature is turned differently`,
  );
  const height = rig.box.max[1] - rig.box.min[1];
  const templateHeight = template.box.max[1] - template.box.min[1];
  for (const [name, bone] of Object.entries(rig.bones)) {
    const base = template.bones[name];
    assert.equal(bone.parent, base.parent, `${label}: ${name} hangs from ${bone.parent}, not ${base.parent}`);
    const turn = degrees(bone.rotation, base.rotation);
    assert.ok(
      turn < REST_DEG,
      `${label}: ${name} rests ${turn.toFixed(2)}° away from the template, so its clips would twist it`,
    );

    // The bind pose agrees with the bones, and the bones are inside the body, on the right side, at believable heights.
    const bind = multiply(bone.inverseBind, bone.world);
    for (let i = 0; i < 16; i++)
      assert.ok(
        Math.abs(bind[i] - (i % 5 === 0 ? 1 : 0)) < BIND_ERROR,
        `${label}: ${name}'s bind matrix does not match its rest pose`,
      );
    const at = [bone.world[12], bone.world[13], bone.world[14]];
    for (let axis = 0; axis < 3; axis++)
      assert.ok(
        at[axis] > rig.box.min[axis] - MARGIN && at[axis] < rig.box.max[axis] + MARGIN,
        `${label}: ${name} is outside the mesh (axis ${"xyz"[axis]}: ${at[axis].toFixed(3)})`,
      );
    const shift = Math.abs(at[1] / height - base.world[13] / templateHeight);
    assert.ok(
      shift < HEIGHT_SHIFT,
      `${label}: ${name} is ${(shift * 100).toFixed(0)}% of the height from where the template has it`,
    );
    if (name.startsWith("Left")) assert.ok(at[0] > 0, `${label}: ${name} is not on the left (+X) side`);
    if (name.startsWith("Right")) assert.ok(at[0] < 0, `${label}: ${name} is not on the right (-X) side`);
  }

  // The skin: every vertex's four weights add up to one, and the same bones as in the template carry nothing.
  assert.ok(rig.worstSum < 1e-2, `${label}: a vertex's weights add up to ${(1 + rig.worstSum).toFixed(3)}`);
  for (const [name, total] of Object.entries(rig.carried)) {
    const expected = template.carried[name] > 1e-6;
    assert.equal(
      total > 1e-6,
      expected,
      `${label}: ${name} ${expected ? "carries no weight" : "should carry no weight"}`,
    );
    if (expected)
      assert.ok(
        total > 1,
        `${label}: ${name} barely moves the mesh (${total.toFixed(2)} of ${rig.vertices} vertices)`,
      );
  }

  // The clips it got from the template: the same length, every bone's rotation the template's at every frame, the root's
  // travel the template's times one factor plus a lift straight up (each body stands on the floor in its own way), every
  // other bone at its own rest offset (not the template's), no scaling.
  const rootName = Object.keys(template.bones).find(
    (name) => !(template.bones[name].parent in template.bones),
  );
  for (const name of character.retargeted || []) {
    const clip = rig.clips[name];
    const base = template.clips[name];
    assert.ok(base, `${label}: ${source.name} has no clip ${name} to retarget`);
    assert.ok(clip, `${label}: the clip ${name} is missing`);
    assert.ok(Math.abs(clipLength(clip) - clipLength(base)) < 1e-3, `${label} / ${name}: a different length`);
    const frames = Array.from({ length: Math.round(clipLength(base) * FPS) + 1 }, (_, f) => f / FPS);
    const pairs = []; // the template's root travel from its rest position, and the character's from its own, per frame
    for (const [track, keys] of Object.entries(base)) {
      const [bone, path] = [track.slice(0, track.lastIndexOf(".")), track.slice(track.lastIndexOf(".") + 1)];
      const mine = clip[track];
      assert.ok(mine, `${label} / ${name}: no ${path} track for ${bone}`);
      if (path === "rotation") {
        const worst = Math.max(...frames.map((t) => degrees(sample(keys, t), sample(mine, t))));
        assert.ok(
          worst < CLIP_DEG,
          `${label} / ${name}: ${bone} turns ${worst.toFixed(2)}° differently from the template's`,
        );
      } else if (path === "scale") {
        assert.ok(
          mine.values.every((v) => Math.abs(v - 1) < 1e-3),
          `${label} / ${name}: ${bone} is scaled`,
        );
      } else if (bone === rootName) {
        const from = template.bones[bone].translation;
        const to = rig.bones[bone].translation;
        for (const t of frames)
          pairs.push([sample(keys, t).map((v, k) => v - from[k]), sample(mine, t).map((v, k) => v - to[k])]);
      } else {
        const rest = rig.bones[bone].translation;
        assert.ok(
          Array.from(mine.values).every((v, k) => Math.abs(v - rest[k % 3]) < CLIP_CM),
          `${label} / ${name}: ${bone} is not at its own rest offset`,
        );
      }
    }
    // Where the template's root moves, this one's moves the same way, scaled; where it stays, this one stays. Fitted
    // as factor * template + lift, so a constant lift (and only that) is allowed, and it must point straight up.
    const mean = (k, side) => pairs.reduce((sum, pair) => sum + pair[side][k], 0) / pairs.length;
    const centre = [0, 1, 2].map((k) => [mean(k, 0), mean(k, 1)]);
    let cross = 0;
    let spread = 0;
    for (const [a, b] of pairs)
      for (let k = 0; k < 3; k++) {
        cross += (a[k] - centre[k][0]) * (b[k] - centre[k][1]);
        spread += (a[k] - centre[k][0]) ** 2;
      }
    const factor = spread > 1 ? cross / spread : 0;
    const lift = centre.map(([a, b]) => b - factor * a);
    if (spread > 1)
      assert.ok(
        factor > TRAVEL_RANGE[0] && factor < TRAVEL_RANGE[1],
        `${label} / ${name}: ${rootName} travels ${factor.toFixed(2)} times as far as the template's`,
      );
    for (const [a, b] of pairs)
      for (let k = 0; k < 3; k++)
        assert.ok(
          Math.abs(b[k] - factor * a[k] - lift[k]) < CLIP_CM,
          `${label} / ${name}: ${rootName} does not move like the template's times ${factor.toFixed(2)}`,
        );
    if (pairs.length)
      assert.ok(
        Math.abs(lift[0]) < CLIP_CM && Math.abs(lift[2]) < CLIP_CM && Math.abs(lift[1]) < LIFT_MAX_CM,
        `${label} / ${name}: ${rootName} is shifted by (${lift.map((v) => v.toFixed(2)).join(", ")}) cm, more than a lift straight up`,
      );
    retargeted++;
  }
  // Clips the character has of its own, made for its body (tools/blender/character_clips.py): present and, like every clip,
  // standing on the floor (checked above).
  for (const name of character.own || [])
    assert.ok(rig.clips[name], `${label}: its own clip ${name} is missing`);
  rigged++;
}
assert.ok(rigged > 0, "characters.json lists at least one character on another character's skeleton");
assert.ok(retargeted > 0, "characters.json lists at least one retargeted clip");

console.log(
  `Rig checks passed: ${rigged} character(s) share the template's ${templates.size ? Object.keys([...templates.values()][0].bones).length : 0} bones (names, hierarchy, rest rotations), with a consistent bind pose and skin weights that add up to one, and ${retargeted} retargeted clip(s) that move every bone as the template's do. Every clip, the template's too, stands on the floor.`,
);
