// The Mountain Hot Springs' cast on screen (18 October 2026): the guests in the springs and the snow monkeys.
//
// A guest getting in steps down into the water by the spring's steps and wades to a seat; seated, only the head and shoulders are
// out of the milky water; one a monkey has frightened stands up out of it and panics (the Panic clip), splashing. Anyone else in a
// spring (getting out, cleared out of it) wades, the water as deep as they are far in from the edge.
//
// A snow monkey (snow-monkey.glb: MonkeyWalk on all fours, MonkeyRun, MonkeyIdle sitting and looking about, MonkeySoak, MonkeyHop)
// comes out of the forest, stops to look about, hops in and sits in the water with only its face above it, very chill, until it is
// shooed out and scampers off. Until the model is here (or if it does not load) a simple monkey of balls stands in. Only the picture
// moves here.
import { THREE } from "./kit.mjs";
import { SPRINGS, springLocal } from "../onsen-plan.mjs";
import { MONKEY } from "../onsen.mjs";

const WATER = -0.15,
  WADE = -0.85, // standing on the basin's floor, waist-deep
  SHOULDERS = 1.38, // how far the shoulders are above the feet, for a guest 1.75 m tall
  MONKEY_SCALE = 1.15,
  CHIN = 0.269; // the monkey's chin above its floor in MonkeySoak (unscaled)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MONKEY_FILE = "models/snow-monkey.glb";
// The model's ground speed at rate 1 (from the clips), to keep the feet from sliding.
const MONKEY_WALK = 0.86,
  MONKEY_RUN = 2.27;

// ---- the guests ------------------------------------------------------------------------------------------------------------

// How deep a guest is in a spring at (x, z): 0 on the rim, wading depth a step in. Null on the terrace.
function depthAt(x, z) {
  for (const s of SPRINGS) {
    const inside = springLocal(s, x, z).inside;
    if (inside > -0.05) return clamp(inside / 0.55, 0, 1);
  }
  return null;
}
// The hot springs' part of a guest's frame. True when it has posed them (the rest of the world sync is skipped).
export function onsenPose(w, sim, p, g, time, dt) {
  if (["gone", "queue", "arriving", "injured", "lounge"].includes(p.status)) return false;
  const k = depthAt(p.x, p.z);
  if (k === null) return false;
  const u = g.userData,
    motion = w.reducedMotion?.matches ? 0 : 1;
  u.root.position.set(0, 0, 0);
  u.root.rotation.set(0, 0, 0);
  u.root.scale.setScalar(u.baseScale || 1);
  u.legs.forEach((l) => (l.rotation.x = 0));
  u.puppet.arms = u.puppet.legs = false;
  u.soreEyes.visible = p.problem === "eyes";
  u.f.visible = false;
  u.shadow.visible = false;
  const fit = u.fit || 1;
  // How fast they are moving (for the walk), from where they were last frame.
  const at = u.onsenAt;
  u.onsenAt = { x: p.x, z: p.z };
  const speed = at && dt > 0 ? Math.hypot(p.x - at.x, p.z - at.z) / dt : 0;
  const seated = p.status === "swim" && !p.monkeyScare && speed < 0.2 && !(sim.crowdPanic?.() || sim.rescue);
  let y = WADE * k,
    rig = { speed: Math.min(speed, 1.6), puppet: u.puppet, classic: u };
  if (seated) {
    // Sitting in the water to the shoulders, settling down into it as they arrive at the seat.
    u.sink = Math.min(1, (u.sink || 0) + dt * 1.6);
    y = WADE + (WATER - SHOULDERS * fit - WADE) * u.sink;
    y += Math.sin(time * 1.1 + (u.phase || 0)) * 0.015 * motion;
    rig = { speed: 0, puppet: u.puppet, classic: u };
  } else {
    u.sink = Math.max(0, (u.sink || 0) - dt * 2.5);
    y = WADE * k + (WATER - SHOULDERS * fit - WADE) * u.sink * k;
  }
  if ((p.monkeyScare && p.status === "swim") || (p.status === "panic" && k > 0.5)) {
    // A monkey in the spring: up out of the water, hands up, hopping, splashing.
    y = WADE + Math.abs(Math.sin(time * 7 + (u.phase || 0))) * 0.14 * motion;
    rig = { speed: 0, panic: true, puppet: u.puppet, classic: u };
    if (motion && Math.random() < dt * 4) w.splash(p.x, WATER, p.z, 3, true, 0xe8ffff);
  }
  g.position.set(p.x, y, p.z);
  g.rotation.set(0, p.angle ?? 0, 0);
  u.hit.position.y = Math.max(0.5, -y + 0.6);
  // Ripples round anyone wading.
  if (!seated && speed > 0.3 && motion && Math.random() < dt * 3)
    w.splash(p.x, WATER, p.z, 1, true, 0xe8ffff);
  try {
    u.rig?.update(dt, rig);
  } catch (error) {
    console.error(error);
  }
  return true;
}

// ---- the snow monkeys ------------------------------------------------------------------------------------------------------

let template = null,
  loading = null;
// Fetch the monkey once (the scene asks as the hot springs are built). A monkey that does not load keeps its stand-in.
export function loadMonkey(base = new URL("../assets/", import.meta.url).href) {
  if (template || loading) return loading || Promise.resolve(template);
  if (typeof Image !== "function") return Promise.resolve(null); // (no browser: the stand-in)
  loading = (async () => {
    const [{ GLTFLoader }, { clone }] = await Promise.all([
      import("../assets/GLTFLoader.js"),
      import("../assets/SkeletonUtils.js"),
    ]);
    const gltf = await new GLTFLoader().loadAsync(base + MONKEY_FILE);
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.frustumCulled = false;
    });
    const clips = {};
    for (const c of gltf.animations) clips[c.name] = c;
    template = { scene: gltf.scene, clips, clone };
    return template;
  })().catch((error) => {
    console.warn("The snow monkey did not load; the stand-in plays.", error);
    loading = null;
    return null;
  });
  return loading;
}
// Used by a check: a template from a scene and its clips, without fetching.
export function useMonkeyTemplate(scene, clips, clone) {
  template = { scene, clips, clone };
}

// A monkey made of balls: grey-brown fur, a red face and hands, for while the model is not here.
function standInMonkey() {
  const g = new THREE.Group(),
    fur = new THREE.MeshStandardMaterial({ color: 0x8a7d70, roughness: 0.95 }),
    face = new THREE.MeshStandardMaterial({ color: 0xe0605a, roughness: 0.6 }),
    eye = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), fur);
  body.scale.set(1, 0.9, 1.25);
  body.position.y = 0.3;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), fur);
  head.position.set(0, 0.5, 0.2);
  const mask = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), face);
  mask.scale.set(1, 1, 0.5);
  mask.position.set(0, 0.5, 0.31);
  g.add(body, head, mask);
  for (const x of [-0.04, 0.04]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 6), eye);
    e.position.set(x, 0.52, 0.355);
    g.add(e);
  }
  for (const [x, z] of [
    [-0.12, 0.18],
    [0.12, 0.18],
    [-0.12, -0.18],
    [0.12, -0.18],
  ]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.24, 8), fur);
    leg.position.set(x, 0.12, z);
    g.add(leg);
  }
  g.userData.parts = { head, body };
  return g;
}
function makeMonkey(w) {
  const g = new THREE.Group();
  g.scale.setScalar(MONKEY_SCALE);
  const stand = standInMonkey();
  g.add(stand);
  g.userData = { stand, model: null, mixer: null, actions: null, current: null };
  w.scene.add(g);
  return g;
}
// Put the model on a monkey once it is here.
function dressMonkey(g) {
  const u = g.userData;
  if (u.model || !template) return;
  const model = template.clone(template.scene);
  g.add(model);
  u.model = model;
  u.stand.visible = false;
  u.mixer = new THREE.AnimationMixer(model);
  u.actions = {};
  for (const [key, name] of Object.entries({
    walk: "MonkeyWalk",
    run: "MonkeyRun",
    idle: "MonkeyIdle",
    soak: "MonkeySoak",
    hop: "MonkeyHop",
  })) {
    const clip = template.clips[name];
    if (!clip) continue;
    const a = u.mixer.clipAction(clip);
    if (key === "hop") {
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
    }
    u.actions[key] = a;
  }
}
function play(u, name, rate = 1) {
  const a = u.actions?.[name] || u.actions?.idle;
  if (!a) return null;
  if (u.current !== name) {
    a.reset();
    a.play();
    const prev = u.actions[u.current];
    if (prev) a.crossFadeFrom(prev, 0.2, false);
    u.current = name;
  }
  a.setEffectiveTimeScale(name === "hop" ? 0 : rate);
  return a;
}

export function buildOnsenCast(w, ctx) {
  loadMonkey()?.then?.(() => {
    for (const g of ctx.monkeys.values()) dressMonkey(g);
  });
  ctx.monkeys = new Map();
  w.updaters.push((time, dt, world, sim) => syncMonkeys(w, sim, time, dt, ctx));
}
function syncMonkeys(w, sim, time, dt, ctx) {
  const list = sim?.onsen?.monkeys || [],
    seen = new Set(),
    motion = w.reducedMotion?.matches ? 0 : 1;
  for (const m of list) {
    if (m.stage === "gone") continue;
    seen.add(m.id);
    let g = ctx.monkeys.get(m.id);
    if (!g) {
      g = makeMonkey(w);
      ctx.monkeys.set(m.id, g);
    }
    dressMonkey(g);
    const u = g.userData;
    let y = 0,
      clip = "idle",
      rate = 1;
    if (m.stage === "approach") {
      clip = "walk";
      rate = MONKEY.walk / MONKEY_WALK;
    } else if (m.stage === "flee") {
      clip = "run";
      rate = MONKEY.run / MONKEY_RUN;
    } else if (m.stage === "hop") {
      clip = "hop";
      y = -Math.sin(Math.min(1, m.hopT) * Math.PI * 0.5) * 0.4;
    } else if (m.stage === "soak") {
      clip = "soak";
      // Up to its chin in the hot water, bobbing a little.
      y = WATER - 0.01 - CHIN * MONKEY_SCALE + Math.sin(time * 1.3 + m.id) * 0.012 * motion;
    }
    g.position.set(m.x, y, m.z);
    g.rotation.y = m.angle || 0;
    const a = play(u, clip, rate);
    if (a && clip === "hop") a.time = Math.min(1, m.hopT || 0) * a.getClip().duration;
    u.mixer?.update(dt);
    // The stand-in: a trot on all fours, sitting down low in the water.
    if (!u.model) {
      const s = u.stand;
      s.position.y =
        m.stage === "soak" ? -0.22 : Math.abs(Math.sin(time * (clip === "run" ? 16 : 8))) * 0.04 * motion;
      s.rotation.x = m.stage === "soak" ? -0.6 : 0;
    }
    // A wake of steam and ripples round one in the water.
    if (m.stage === "soak" && motion && Math.random() < dt * 0.8)
      w.splash(m.x, WATER, m.z, 1, true, 0xe8ffff);
  }
  for (const [id, g] of ctx.monkeys)
    if (!seen.has(id)) {
      g.userData.mixer?.stopAllAction();
      g.removeFromParent();
      ctx.monkeys.delete(id);
    }
}
