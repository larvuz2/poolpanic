// The Lazy River's macaws (4 November 2026, the creator: "in the lazy river, we see some macaws flying, but they're blocky.
// Let's make the 3D model, rig them, and animate them. Simple flying animation, not low poly… the same as the other models").
// A scarlet macaw and a blue-and-gold one, designed with GPT Image 2.5 from a picture of Coach Waters (so they are drawn like
// him), made into meshes by Meshy, laid level and rigged for flight by tools/blender/bird_rig.py: a wingbeat (Fly) and a glide
// (Glide). They load with the river (app.mjs VENUE_LOADS); the classic birds of balls and boxes fly while they are not in, and
// for ?nomodels.
import { THREE } from "./kit.mjs";

export const MACAW_FILES = { scarlet: "models/macaw-scarlet.glb", bluegold: "models/macaw-bluegold.glb" };

let templates = null,
  loading = null;
export function loadMacaws(base = new URL("../assets/", import.meta.url).href) {
  if (templates || loading) return loading || Promise.resolve(templates);
  if (typeof Image !== "function" || globalThis.__poolTuning?.has?.("nomodels")) return Promise.resolve(null);
  loading = (async () => {
    const [{ GLTFLoader }, { clone }] = await Promise.all([
      import("../assets/GLTFLoader.js"),
      import("../assets/SkeletonUtils.js"),
    ]);
    const loader = new GLTFLoader(),
      out = {};
    await Promise.all(
      Object.entries(MACAW_FILES).map(async ([kind, file]) => {
        const gltf = await loader.loadAsync(base + file);
        gltf.scene.traverse((o) => {
          if (!o.isMesh) return;
          o.castShadow = true;
          o.frustumCulled = false;
        });
        const clips = {};
        for (const c of gltf.animations) clips[c.name] = c;
        out[kind] = { scene: gltf.scene, clips, clone };
      }),
    );
    templates = out;
    return templates;
  })().catch((error) => {
    console.warn("The macaws did not load; the classic birds fly.", error);
    loading = null;
    return null;
  });
  return loading;
}
export const macawsReady = () => templates;
// Used by a check: templates without fetching.
export function useMacawTemplates(t) {
  templates = t;
}

// A macaw model for one of the river's birds: `kind` scarlet or bluegold. Its Fly and Glide actions, both playing, weighed by
// `flyMacaw`.
export function macawModel(kind) {
  const t = templates?.[kind];
  if (!t) return null;
  const model = t.clone(t.scene),
    mixer = new THREE.AnimationMixer(model),
    fly = t.clips.Fly && mixer.clipAction(t.clips.Fly),
    glide = t.clips.Glide && mixer.clipAction(t.clips.Glide);
  for (const a of [fly, glide]) a?.play();
  return { model, mixer, fly, glide, gliding: 0 };
}

// Flapping or gliding: `glide` 0 to 1 eases between the two; a beat a little quicker or slower for each bird (`pace`).
export function flyMacaw(m, dt, glide, pace = 1) {
  m.gliding += (glide - m.gliding) * Math.min(1, dt * 2.5);
  m.fly?.setEffectiveWeight(1 - m.gliding);
  m.glide?.setEffectiveWeight(m.gliding);
  m.fly?.setEffectiveTimeScale(pace);
  m.mixer.update(dt);
}
