// The fish of the Fish Kid incident as a model (assets/fish.glb: a Meshy 7 mesh of the user's picture, one mesh, one texture) in
// place of the koi that props.mjs builds from balls. Everything that draws a fish (the one loose in the pool, the one in the net on
// the rack and in the coach's hands, the Coach Cam's) builds the classic koi with `fishObject` and calls `dressFish` on it: the model
// goes in beside the koi's parts, which stay (hidden), and a fish made before the model arrived is dressed when it does, so the
// classic fish plays if the file never comes (a model that does not load, or ?swimmers=classic, which never asks for it).
//
// The model is one rigid mesh with no skeleton, so it swims in the vertex shader: from the nose back, the body bends sideways in a
// wave that runs to the tail and grows towards it (`swimModel` sets the wave's phase and size, from the speed the fish is going at).
// Every fish has its own copy of the material, for its own wave. The file has one convention, the nose to +z with the back to +y (as
// Meshy makes a fish, and `game_export.py` leaves it); its size and where its origin is do not matter: the model is stood in a group
// FISH_LENGTH long with its middle at the origin, so a group's scale is the size of the fish, as it is for the classic koi. The wave
// works on the mesh's own coordinates, so the file's nodes carry no transform (`game_export.py` bakes them into the vertices).
import { THREE } from "./kit.mjs";

export const FISH_LENGTH = 1.2; // metres, nose to tail, at a scale of 1 (the classic koi is 1.4 m with its tail, but much slimmer)
const BRIGHTNESS = 1.4; // Meshy's colours come out darker than the picture they were made from, and the pool's water dims a fish in it

let template = null; // {scene, nose, length}: the model in its group, and where its nose is along z in the file, and how long it is there
let loading = null;
const waiting = new Set(); // classic fish made before the model was here (a few: the pool's, the net's)
const WAITING_MAX = 32;

export const fishModelReady = () => !!template;

// Fetch and parse the model once; the loader is imported here so the classic fish never pay for it. Fish that were waiting for it
// are dressed. A model that does not load is left out (the classic koi plays).
export function loadFishModel(base = new URL("../assets/", import.meta.url).href) {
  if (template) return Promise.resolve(template);
  loading ||= (async () => {
    const { GLTFLoader } = await import("../assets/GLTFLoader.js");
    const gltf = await new GLTFLoader().loadAsync(base + "fish.glb");
    return useFishTemplate(gltf.scene);
  })().catch((error) => {
    console.warn("The fish did not load; the classic fish stays.", error);
    loading = null;
    return null;
  });
  return loading;
}

// The model's scene (the file's, or a stand-in in a check), and the fish that waited for it dressed.
export function useFishTemplate(scene) {
  if (!scene) {
    template = null;
    return null;
  }
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.frustumCulled = false; // (the wave moves the vertices out of their bounds)
  });
  scene.position.sub(box.getCenter(new THREE.Vector3()));
  const model = new THREE.Group();
  model.scale.setScalar(FISH_LENGTH / size.z);
  model.add(scene);
  template = { scene: model, nose: box.max.z, length: size.z };
  for (const group of waiting) dressFish(group);
  waiting.clear();
  return template;
}

// A copy of the model's material that bends the fish: x moves by a wave that runs from the nose (k = 0, still) to the tail (k = 1).
function swimmingMaterial(material, swim) {
  const nose = template.nose.toFixed(4);
  const length = template.length.toFixed(4);
  const material2 = material.clone();
  material2.color.multiplyScalar(BRIGHTNESS);
  material2.onBeforeCompile = (shader) => {
    shader.uniforms.uSwimTime = swim.time;
    shader.uniforms.uSwimAmp = swim.amp;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uSwimTime;\nuniform float uSwimAmp;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        float swimK = clamp((${nose} - position.z) / ${length}, 0.0, 1.0);
        transformed.x += sin(uSwimTime - swimK * 4.5) * uSwimAmp * swimK * swimK * ${length};`,
      );
  };
  material2.customProgramCacheKey = () => `fish-swim-${nose}-${length}`;
  return material2;
}

// Put the model in a fish group built by fishObject (props.mjs): the koi's own parts are hidden, the model hangs beside them in
// `fish-model`, and `userData.fishSwim` holds its wave. Returns whether the fish has the model now; without it (not loaded yet) the
// group is remembered, and dressed when the model comes.
export function dressFish(group) {
  if (group.userData.fishModel) return true;
  if (!template) {
    if (waiting.size >= WAITING_MAX) waiting.delete(waiting.values().next().value);
    waiting.add(group);
    return false;
  }
  const koi = group.getObjectByName("fish-body");
  if (koi) koi.visible = false;
  const model = template.scene.clone(true);
  model.name = "fish-model";
  const swim = { time: { value: 0 }, amp: { value: 0 } };
  model.traverse((o) => {
    if (o.isMesh) o.material = swimmingMaterial(o.material, swim);
  });
  group.add(model);
  group.userData.fishModel = model;
  group.userData.fishSwim = swim;
  return true;
}

// The wave of a fish with the model: `phase` runs the wave along the body, `size` is how far the tail swings, as a share of its
// length. A classic fish has no wave (its tail is turned by the caller).
export function swimModel(group, phase, size) {
  const swim = group.userData.fishSwim;
  if (!swim) return;
  swim.time.value = phase;
  swim.amp.value = size;
}
