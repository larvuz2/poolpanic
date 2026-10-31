// The Aquatic Centre's two officials (31 October 2026, the creator: "two officials, very grumpy and tough, in the same style as all
// of our characters … rig and then sit down and make simple animations of them looking around. They have to have their eyebrows
// always almost in a mad position … sitting on the table"). The Chief Judge (tall, grey bun, half-moon glasses, a stopwatch) and the
// Starter (short and square, a grey walrus moustache, a cap; he sits on two cushions and his feet do not reach the floor): GPT
// Image 2.5 designs with Coach Waters and Coach Marsh as the style, Meshy 7 meshes, rigged on Waters' skeleton, each with one clip of
// their own (tools/blender/character_clips.py --character judge / starter: JudgeWatch, StarterGlare). Their scowls are their own,
// painted in; nothing in the game moves them but the clip. They are scenery: no simulation, no hit box, the same in every shift.
// They load behind the menu (`loadOfficials`, app.mjs); until they have, and with ?nomodels, the officials' table is empty.
import { THREE } from "./kit.mjs";
import { clone } from "../assets/SkeletonUtils.js";

const BASE = new URL("../assets/models/", import.meta.url).href;
// Where they sit (the dressed Aquatic Centre's table, tools/venues/aquatic/kit.py KIOSK, OFFICIAL_SEATS): x, z, the height of the
// feet (the Starter's dangle), the clip; both face the pool (-x).
export const OFFICIALS = [
  { id: "judge", file: "official-judge.glb", clip: "JudgeWatch", x: 14.43, z: 10.6, y: 0 },
  { id: "starter", file: "official-starter.glb", clip: "StarterGlare", x: 14.43, z: 11.8, y: 0.267 },
];

let ready = null,
  loading = null;
export const officialsReady = () => !!ready;
// (for the checks: { judge: gltf, starter: gltf })
export function primeOfficials(models) {
  ready = models;
}
export function loadOfficials(base = BASE) {
  if (ready) return Promise.resolve(ready);
  loading ||= (async () => {
    const { GLTFLoader } = await import("../assets/GLTFLoader.js");
    const loader = new GLTFLoader();
    const files = await Promise.all(OFFICIALS.map((o) => loader.loadAsync(base + o.file)));
    ready = Object.fromEntries(OFFICIALS.map((o, i) => [o.id, files[i]]));
    return ready;
  })().catch((error) => {
    console.warn("The officials did not load; their table stays empty.", error);
    loading = null;
    return null;
  });
  return loading;
}

// Seat both at the table in the world `w` and play their clips (each starts somewhere else in it, so they never move together).
export function seatOfficials(w) {
  if (!ready) return [];
  return OFFICIALS.map((o, i) => {
    const gltf = ready[o.id];
    const body = clone(gltf.scene);
    body.position.set(o.x, o.y, o.z);
    body.rotation.y = -Math.PI / 2;
    body.name = "official-" + o.id;
    body.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false;
      }
    });
    w.scene.add(body);
    (w.liveProps ||= []).push(body);
    const mixer = new THREE.AnimationMixer(body);
    const clip = gltf.animations.find((a) => a.name === o.clip) || gltf.animations[0];
    if (clip) {
      const action = mixer.clipAction(clip);
      action.play();
      mixer.setTime(clip.duration * (0.37 * (i + 1)));
    }
    w.updaters.push((time, dt) => mixer.update(Math.min(dt || 0, 0.1)));
    return { id: o.id, body, mixer };
  });
}
