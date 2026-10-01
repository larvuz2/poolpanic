// Checks the characters rigged on another character's skeleton (tools/blender/rig_from_template.py). Every character
// in tools/viewer/characters.json that names a "skeleton" has that template's bones (same names, same parents, same
// rest rotations, so the template's clips play on it by bone name), a bind pose that matches its bones, bones that sit
// inside the body, and a skin whose weights add up to one with the same bones left unweighted as in the template.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dir = "tools/viewer";
const REST_DEG = 0.1; // rest rotations are copied, a clip's rotation keys only fit the new rig if they match
const BIND_ERROR = 1e-3; // inverse bind matrix times the bone's rest matrix is the identity
const MARGIN = 0.03; // metres a bone may stick out of the mesh's box (a fingertip, a toe)
const HEIGHT_SHIFT = 0.25; // a bone sits within a quarter of the body height of where the template has it

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

const degrees = (p, q) =>
  (2 * Math.acos(Math.min(1, Math.abs(p.reduce((sum, v, i) => sum + v * q[i], 0)))) * 180) / Math.PI;

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
  return {
    bones,
    root: {
      scale: root.scale || [1, 1, 1],
      rotation: root.rotation || [0, 0, 0, 1],
      translation: root.translation || [0, 0, 0],
    },
    box: { min: position.min, max: position.max },
    animations: (glb.json.animations || []).length,
    carried,
    worstSum,
    vertices: position.count,
  };
}

const manifest = JSON.parse(readFileSync(`${dir}/characters.json`, "utf8"));
const byId = new Map(manifest.characters.map((c) => [c.id, c]));
const templates = new Map();
let rigged = 0;
for (const character of manifest.characters) {
  if (!character.skeleton) continue;
  const source = byId.get(character.skeleton);
  assert.ok(
    source,
    `${character.name}: the skeleton "${character.skeleton}" is not a character in characters.json`,
  );
  if (!templates.has(source.id)) templates.set(source.id, readRig(resolve(dir, source.file)));
  const template = templates.get(source.id);
  const rig = readRig(resolve(dir, character.file));
  const label = `${character.name} (on ${source.name}'s skeleton)`;

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
  rigged++;
}
assert.ok(rigged > 0, "characters.json lists at least one character on another character's skeleton");

console.log(
  `Rig checks passed: ${rigged} character(s) share the template's ${templates.size ? Object.keys([...templates.values()][0].bones).length : 0} bones (names, hierarchy, rest rotations), with a consistent bind pose and skin weights that add up to one.`,
);
