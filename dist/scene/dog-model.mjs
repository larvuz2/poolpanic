// The loose dog's model (4 November 2026, the creator: "the dog: we need to build on the dog… add Coach Waters so it's in the
// same world as the dog, and we rig it and animate it"). Designed with GPT Image 2.5 from a picture of Coach Waters, so it is drawn
// like him; made into a mesh by Meshy; given a dog's own skeleton and its clips by tools/blender/dog_rig.py (README "The dog and
// the macaws"). It goes on the classic dog of balls (actors.mjs dogObject), which stays for while it loads and for ?nomodels:
// the classic parts are hidden, what he carries in his mouth moves with his head, and his clips follow what he is doing
// (incident-view.mjs poseDog).
import { THREE } from "./kit.mjs";

export const DOG_FILE = "models/dog.glb";
export const DOG_CLIPS = ["Idle", "Walk", "Run", "Sniff", "Swim", "Shake", "Leap"];
const DOG_SCALE = 1.05;
// The clips' own pace (metres a second at rate 1), for matching the legs to how fast he goes.
const WALK_PACE = 1.15;
const RUN_PACE = 3.1;

let template = null,
  loading = null;
export function loadDog(base = new URL("../assets/", import.meta.url).href) {
  if (template || loading) return loading || Promise.resolve(template);
  if (typeof Image !== "function" || globalThis.__poolTuning?.has?.("nomodels")) return Promise.resolve(null);
  loading = (async () => {
    const [{ GLTFLoader }, { clone }] = await Promise.all([
      import("../assets/GLTFLoader.js"),
      import("../assets/SkeletonUtils.js"),
    ]);
    const gltf = await new GLTFLoader().loadAsync(base + DOG_FILE);
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.frustumCulled = false; // (a skinned body moves outside its rest bounds)
    });
    const clips = {};
    for (const c of gltf.animations) clips[c.name] = c;
    template = { scene: gltf.scene, clips, clone };
    return template;
  })().catch((error) => {
    console.warn("The dog's model did not load; the classic dog plays.", error);
    loading = null;
    return null;
  });
  return loading;
}
export const dogReady = () => template;
// Used by a check: a template from a scene and its clips, without fetching.
export function useDogTemplate(scene, clips, clone) {
  template = { scene, clips, clone };
}

// The model on a classic dog: its own parts hidden (the shadow and the click target are the group's, not the root's), the
// mouth moved onto the head bone at the nose. False when there is no model yet.
export function attachDogModel(g) {
  const u = g.userData;
  if (!template || u.dogModel) return false;
  const model = template.clone(template.scene);
  model.scale.setScalar(DOG_SCALE);
  u.classicParts = u.root.children.filter((c) => c !== u.mouth);
  for (const part of u.classicParts) part.visible = false;
  u.root.add(model);
  const mixer = new THREE.AnimationMixer(model),
    actions = {};
  for (const [name, clip] of Object.entries(template.clips)) actions[name] = mixer.clipAction(clip);
  if (actions.Leap) {
    actions.Leap.setLoop(THREE.LoopOnce);
    actions.Leap.clampWhenFinished = true;
  }
  // (a mount that is the root's own frame at rest, on the head bone: the mouth keeps its place in front of the nose and turns
  // with the head through every clip)
  g.updateMatrixWorld(true);
  const head = model.getObjectByName("Head");
  if (head) {
    const mount = new THREE.Object3D();
    mount.matrixAutoUpdate = false;
    mount.matrix.copy(head.matrixWorld).invert().multiply(u.root.matrixWorld);
    head.add(mount);
    mount.add(u.mouth);
    u.mouth.position.set(0, 0.7, 0.66);
  }
  u.dogModel = { model, mixer, actions, current: null };
  return true;
}
// Let go of the model's skeleton (its bone texture) when the dog leaves the deck.
export function dropDogModel(g) {
  const m = g.userData?.dogModel;
  if (!m) return;
  m.mixer.stopAllAction();
  m.model.traverse((o) => o.skeleton?.dispose?.());
  g.userData.dogModel = null;
}

// Which clip, how fast, for what he is doing (the simulation's status) and how fast he is going (metres a second).
export function dogClip(status, speed, inWater, moving) {
  if (inWater) return ["Swim", 1];
  if (status === "leap" || status === "climb") return ["Leap", 1];
  if (status === "shake") return ["Shake", 1.2];
  if (status === "sniff") return ["Sniff", 1];
  if (moving && speed > 0.25) {
    if (speed < 1.7) return ["Walk", Math.min(1.7, Math.max(0.6, speed / WALK_PACE))];
    return ["Run", Math.min(1.9, Math.max(0.7, speed / RUN_PACE))];
  }
  // (waiting by the coach to be led out: wagging away)
  return ["Idle", status === "following" ? 1.6 : 1];
}

// Plays `clip` (crossfading from the last), at `rate`, `dt` on.
export function playDog(u, clip, rate, dt) {
  const m = u.dogModel,
    next = m.actions[clip];
  if (!next) return;
  if (m.current !== clip) {
    next.reset().play();
    const prev = m.current && m.actions[m.current];
    if (prev) prev.crossFadeTo(next, 0.18, false);
    m.current = clip;
  }
  next.setEffectiveTimeScale(rate);
  m.mixer.update(dt);
}
