// Karen on screen. Her model is the rigged GLB (dist/assets/models/karen.glb, made from the character art by
// tools/blender/karen_rig.py) with five clips: Idle, Walk, Complain, Point and Defeated. Until it has loaded (or
// where it cannot load, as in the headless checks) a stand-in built like the other characters takes its place, so
// the incident never depends on a download. Also here: the red scribbles that spit out of her head, and the poses
// the rest of the cast strikes when she is near (annoyed) and the coach strikes while calming her.
import { THREE } from "./kit.mjs";
import { character } from "./actors.mjs";
import { GLTFLoader } from "../assets/GLTFLoader.js";
import { clone as cloneSkinned } from "../assets/SkeletonUtils.js";
import { KAREN_TUNING } from "../incidents/karen.mjs";

export const KAREN_MODEL_URL = new URL("../assets/models/karen.glb", import.meta.url).href;
export const KAREN_CLIPS = ["Idle", "Walk", "Complain", "Point", "Defeated"];
const MODEL_SCALE = 0.97; // her sunglasses and hair put her just over the coach's head

let loading = null;
// One download for the whole session; null when it fails (the stand-in then stays).
export function loadKaren() {
  loading ||= new GLTFLoader().loadAsync(KAREN_MODEL_URL).catch((err) => {
    console.warn("Karen's model did not load; keeping the stand-in.", err?.message || err);
    return null;
  });
  return loading;
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const approach = (v, target, amount) =>
  v < target ? Math.min(target, v + amount) : Math.max(target, v - amount);

// ---------------------------------------------------------------------------------------------------------
// The character: a stand-in now, the model as soon as it arrives.
export function karenObject(w, v) {
  const g = character(w, { ...v, type: "karen", skin: 0 });
  const u = g.userData;
  u.karen = { model: null, mixer: null, actions: {}, current: null, face: v.angle || 0, scribble: 0 };
  if (!w.headless && !globalThis.__poolTuning?.has("nomodels"))
    loadKaren().then((gltf) => {
      if (!gltf || !g.parent || u.karen.model) return;
      const model = cloneSkinned(gltf.scene);
      model.scale.setScalar(MODEL_SCALE);
      model.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.frustumCulled = false; // a skinned body moves far outside its rest bounds
        }
      });
      const mixer = new THREE.AnimationMixer(model);
      for (const clip of gltf.animations) u.karen.actions[clip.name] = mixer.clipAction(clip);
      u.karen.model = model;
      u.karen.mixer = mixer;
      u.root.visible = false;
      g.add(model);
    });
  return g;
}

function play(k, name, speed = 1, once = false) {
  const next = k.actions[name];
  if (!next) return;
  if (k.current === name) {
    next.timeScale = speed;
    return;
  }
  const prev = k.actions[k.current];
  next.reset();
  next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
  next.clampWhenFinished = once;
  next.timeScale = speed;
  if (prev) next.crossFadeFrom(prev, 0.22, false);
  next.play();
  k.current = name;
}

// The clip she should be playing, and how fast.
export function karenClip(v, calming) {
  switch (v.status) {
    case "entering":
      return v.hold > 0 ? ["Idle", 1] : ["Walk", 1.1];
    case "marching":
      return ["Walk", 1.15];
    case "leaving":
      return ["Walk", 0.95];
    case "calmed":
      return ["Defeated", 1];
    default:
      return v.gesture === "point" ? ["Point", 1] : ["Complain", calming ? 1.45 : 1];
  }
}

export function poseKaren(sim, v, g, time, dt, reduced) {
  const u = g.userData,
    k = u.karen,
    calming = !!sim.karen?.calming;
  g.position.set(v.x, 0, v.z);
  // Face the way she walks, or whoever (or whatever) she is shouting at; turn quickly, but not instantly.
  const want = ["ranting", "calmed"].includes(v.status) ? (v.face ?? v.angle ?? 0) : (v.angle ?? 0);
  k.face += wrap(want - k.face) * Math.min(1, dt * 9);
  g.rotation.set(0, k.face, 0);
  const [clip, speed] = karenClip(v, calming);
  if (k.model) {
    play(k, clip, speed, clip === "Defeated");
    k.mixer.update(dt);
    u.shadow.visible = true;
    return;
  }
  poseStandIn(u, v, clip, time, reduced);
}

// The stand-in's arms and legs, in the same spirit as the clips.
function poseStandIn(u, v, clip, time, reduced) {
  const { arms, legs, root } = u;
  const t = time * 9;
  root.rotation.set(0, 0, 0);
  root.position.set(0, 0, 0);
  if (clip === "Walk") {
    legs.forEach((l, i) => l.rotation.set(Math.sin(t + i * Math.PI) * 0.6, 0, 0));
    arms.forEach((a, i) => a.rotation.set(Math.sin(t + (i + 1) * Math.PI) * 0.7, 0, 0));
    root.rotation.x = 0.12;
    root.position.y = Math.abs(Math.sin(t)) * 0.04;
    return;
  }
  legs.forEach((l) => l.rotation.set(0, 0, 0));
  if (clip === "Idle") arms.forEach((a, i) => a.rotation.set(0, 0, i ? -0.2 : 0.2));
  else if (clip === "Defeated") {
    root.rotation.x = 0.25;
    arms.forEach((a) => a.rotation.set(0.1, 0, 0));
  } else if (clip === "Point") {
    const jab = reduced ? 0 : Math.max(0, Math.sin(time * 9)) * 0.25;
    arms[1].rotation.set(-1.45 - jab, 0, -0.1);
    arms[0].rotation.set(0.2, 0, 0.6);
    root.rotation.x = 0.1;
  } else {
    // Complain: one arm up and shaking, then the other.
    const left = Math.sin(time * 1.9) > 0;
    const wag = reduced ? 0 : Math.sin(time * 14) * 0.25;
    arms[left ? 0 : 1].rotation.set(0.3, 0, (left ? 1 : -1) * (2.7 + wag));
    arms[left ? 1 : 0].rotation.set(0.2, 0, left ? -0.6 : 0.6);
    root.rotation.set(0.1, reduced ? 0 : Math.sin(time * 5) * 0.2, 0);
  }
}

// ---------------------------------------------------------------------------------------------------------
// The cast's reaction: hands over the ears, back hunched forward, head shaking in disgust, feet planted. `u.annoy`
// eases in and out so everybody goes back to what they were doing when Karen has gone. Call it after the actor's
// own pose is set; it blends from whatever that was.
export function annoyPose(u, annoyed, time, reduced) {
  const last = u.annoyAt ?? time,
    dt = Math.min(0.1, Math.max(0, time - last));
  u.annoyAt = time;
  u.annoy = approach(u.annoy || 0, annoyed ? 1 : 0, dt * 5);
  const k = u.annoy;
  if (k <= 0.001) return 0;
  const shake = reduced ? 0 : Math.sin(time * 9 + u.phase);
  u.arms.forEach((a, i) => {
    // Straight up from the shoulder, tipped forward and a little in: the hands land on the ears.
    const side = i ? -1 : 1;
    a.rotation.set(
      a.rotation.x + (0.5 - a.rotation.x) * k,
      a.rotation.y * (1 - k),
      a.rotation.z + (side * 3 - a.rotation.z) * k,
    );
  });
  u.legs.forEach((l) => (l.rotation.x *= 1 - k));
  u.root.rotation.x += 0.34 * k;
  u.root.rotation.y += shake * 0.2 * k;
  u.root.position.y = u.root.position.y * (1 - k) - 0.04 * k;
  return k;
}

// The coach calming someone down: both arms out in front, patting the air up and down, over and over.
export function calmPose(cu, time) {
  const pat = Math.sin(time * 5.5);
  cu.arms.forEach((a, i) => a.rotation.set(-1.4 + pat * 0.5, 0, i ? -0.14 : 0.14));
  cu.root.rotation.x += 0.06;
  cu.carry.visible = false;
}

// ---------------------------------------------------------------------------------------------------------
// The red scribbles: a few angry words and symbols rising from her head, each drawn a little wrong.
const WORDS = ["@#$%!", "BLAH!", "GRR!", "#@*&!", "!!!", "UGH!", "WAAH!", "$%&*!", "?!?!", "HMPH!"];
const textures = new Map();
function wordTexture(word) {
  if (textures.has(word)) return textures.get(word);
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.font = "900 62px Impact, 'Arial Black', sans-serif";
  const letters = [...word],
    step = Math.min(50, 220 / letters.length);
  // Each letter has its own tilt, size and height, so the word looks shouted and distorted.
  let seed = word.length * 31 + word.charCodeAt(0);
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  letters.forEach((ch, i) => {
    ctx.save();
    ctx.translate(128 + (i - (letters.length - 1) / 2) * step, 64 + (rnd() - 0.5) * 22);
    ctx.rotate((rnd() - 0.5) * 0.7);
    ctx.scale(0.9 + rnd() * 0.5, 0.9 + rnd() * 0.45);
    ctx.lineWidth = 14;
    ctx.strokeStyle = "#3b0606";
    ctx.strokeText(ch, 0, 0);
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#ff8a6a";
    ctx.strokeText(ch, 0, 0);
    ctx.fillStyle = "#e5160f";
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  textures.set(word, t);
  return t;
}

export class Scribbles {
  constructor(scene) {
    this.scene = scene;
    this.live = [];
    this.timer = 0;
  }
  // Each scribble fades and spins on its own, so each gets its own material (the texture is shared).
  material(word) {
    return new THREE.SpriteMaterial({
      map: wordTexture(word),
      transparent: true,
      depthWrite: false,
      fog: false,
    });
  }
  // `active`: Karen is shouting right now, from the point (x, y, z). Rising, wobbling, fading words, six at most.
  update(dt, active, x, y, z, reduced) {
    this.timer -= dt;
    if (active && this.timer <= 0 && this.live.length < 7) {
      this.timer = 0.2 + Math.random() * 0.25;
      const sprite = new THREE.Sprite(this.material(WORDS[Math.floor(Math.random() * WORDS.length)]));
      const a = Math.random() * Math.PI * 2;
      sprite.position.set(x + Math.cos(a) * 0.35, y, z + Math.sin(a) * 0.35);
      sprite.renderOrder = 20;
      this.scene.add(sprite);
      this.live.push({
        sprite,
        age: 0,
        life: 1.15,
        vx: Math.cos(a) * 0.7,
        vz: Math.sin(a) * 0.7,
        spin: (Math.random() - 0.5) * 0.9,
        size: 0.7 + Math.random() * 0.4,
      });
    }
    for (let i = this.live.length - 1; i >= 0; i--) {
      const s = this.live[i];
      s.age += dt;
      const t = s.age / s.life;
      if (t >= 1) {
        s.sprite.removeFromParent();
        s.sprite.material.dispose();
        this.live.splice(i, 1);
        continue;
      }
      s.sprite.position.x += s.vx * dt;
      s.sprite.position.z += s.vz * dt;
      s.sprite.position.y += (reduced ? 0.4 : 1.1) * dt;
      const pop = Math.min(1, t * 6) * (1 + 0.12 * Math.sin(t * 30));
      s.sprite.scale.set(s.size * 1.6 * pop, s.size * 0.8 * pop, 1);
      s.sprite.material.rotation = reduced ? 0 : s.spin * Math.sin(t * 9);
      s.sprite.material.opacity = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
    }
  }
  clear() {
    for (const s of this.live) {
      s.sprite.removeFromParent();
      s.sprite.material.dispose();
    }
    this.live = [];
  }
}

// How wide her annoying circle is drawn on the floor (the simulation's range).
export const KAREN_RADIUS = KAREN_TUNING.radius;
