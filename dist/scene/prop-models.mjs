// Small props as models (16 October 2026): Tripo meshes made from a line of text on fal (tripo3d/p2/text-to-3d) and shrunk for the
// game (tools/glb_shrink.py): the mop and its yellow bucket (the wet spots, incidents/wet.mjs) and the Kids Pool's floating toys.
// `propModel(name, fit)` gives a group at once with a simple stand-in in it, built from boxes and balls, and the model takes its place
// when it has loaded (once, shared by every copy: the game asks for the files with `loadProp`, as each shift begins). A prop that
// does not load keeps its stand-in, so the game never waits on one.
//
// `fit` sizes the model from its own bounding box: `height` (metres, to the top) or `size` (the longest side), standing on the group's
// floor (y = 0) and centred over its origin. The files keep the orientation Tripo gives (+y up, the front to +z).
import { THREE } from "./kit.mjs";

export const PROP_FILES = {
  mop: "props/mop.glb",
  "mop-bucket": "props/mop-bucket.glb",
  duck: "props/duck.glb",
  "swim-ring": "props/swim-ring.glb",
};
const templates = new Map(),
  loading = new Map(),
  waiting = new Map();

export const propReady = (name) => templates.has(name);
export function loadProp(name, base = new URL("../assets/", import.meta.url).href) {
  if (templates.has(name)) return Promise.resolve(templates.get(name));
  if (!PROP_FILES[name]) return Promise.resolve(null);
  if (!loading.has(name))
    loading.set(
      name,
      (async () => {
        const { GLTFLoader } = await import("../assets/GLTFLoader.js");
        const gltf = await new GLTFLoader().loadAsync(base + PROP_FILES[name]);
        return useProp(name, gltf.scene);
      })().catch((error) => {
        console.warn("The " + name + " did not load; its stand-in stays.", error);
        loading.delete(name);
        return null;
      }),
    );
  return loading.get(name);
}
// The model's scene (the file's, or a stand-in in a check); every group waiting for it is dressed.
export function useProp(name, scene) {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
  });
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  templates.set(name, { scene, box });
  for (const group of waiting.get(name) || []) dress(group);
  waiting.delete(name);
  return templates.get(name);
}

// A group holding the prop: the stand-in `fallback` (a function that builds it into the group) now, the model once it is here.
export function propModel(name, fit = {}, fallback = null) {
  const group = new THREE.Group();
  group.userData.prop = { name, fit };
  if (fallback) {
    const stand = new THREE.Group();
    stand.name = "stand-in";
    fallback(stand);
    group.add(stand);
  }
  if (templates.has(name)) dress(group);
  else {
    if (!waiting.has(name)) waiting.set(name, new Set());
    waiting.get(name).add(group);
  }
  return group;
}
function dress(group) {
  const { name, fit } = group.userData.prop,
    t = templates.get(name);
  if (!t || group.getObjectByName("prop-model")) return;
  const size = t.box.getSize(new THREE.Vector3()),
    centre = t.box.getCenter(new THREE.Vector3()),
    k = fit.height ? fit.height / size.y : fit.size ? fit.size / Math.max(size.x, size.y, size.z) : 1;
  const model = t.scene.clone(true);
  model.position.set(-centre.x, -t.box.min.y, -centre.z);
  const holder = new THREE.Group();
  holder.name = "prop-model";
  holder.scale.setScalar(k);
  holder.add(model);
  group.add(holder);
  const stand = group.getObjectByName("stand-in");
  if (stand) stand.visible = false;
}
