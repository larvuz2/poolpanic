// The five generic swimmers in the game: Meshy characters (assets/swimmer-*.glb) standing in for the swimmers that
// actors.mjs builds from balls and boxes. Like Coach Panic (coach-model.mjs) they have Coach Panic's own skeleton and his
// clips, so this file is mostly the rules that pick a clip. The classic swimmer is still built and still posed,
// but hidden; the model goes in beside its parts. Rules, in short:
//   - moving on foot: Walk up to a brisk pace, Run beyond it, played at the speed that keeps the feet on the floor;
//   - swimming (the body lies on its front, as the world sync poses it): the Swim clip, a freestyle crawl made standing like
//     the others, at a stroke rate that follows the swimmer's speed (the Run clip for a model that has no Swim);
//   - standing: IdleScan, with an IdleScratch now and then;
//   - panicking on the deck (the pool is closed, a mess in the queue): the Panic clip, a hop on the spot with the hands up;
//   - the poses the game sets on the classic arms and legs for what is going on (running away with the hands up, climbing
//     out, treading water, resting, the trampoline, a slip, an injury) are copied onto the model's bones while they last
//     (`puppet`).
// Which of the five a swimmer is comes from the swimmer's `skin` number, so it stays the same for the whole shift.
// The cannonball man of the Cannonball incident (incidents/carl.mjs) is one of two more models, Carl or the leopard man (the
// `figure` on the visitor and on the customer Carl turns into when he is red-carded): the same skeleton, the same clips and a
// one-shot Cannonball, which the world sync plays frame by frame as the incident goes (figure-pose.mjs). Only the one the level
// has is loaded, when the level starts.
import { THREE } from "./kit.mjs";
import { TYPES, swimmerLook } from "../sim.mjs";

export const SWIMMER_KEY = "pool-panic.swimmers.v1";
export const CLIPS = {
  idle: "IdleScan",
  scratch: "IdleScratch",
  walk: "Walk",
  run: "Run",
  panic: "Panic",
  swim: "Swim",
  cannonball: "Cannonball", // only the two cannonball men have it
  // only the fish kid has these four: the bucket held to the chest (standing, walking, running) and tipped out
  carry: "CarryIdle",
  carryWalk: "CarryWalk",
  carryRun: "CarryRun",
  dump: "BucketDump",
};
// A model must have these; one without Panic hops with the classic swimmer's poses instead, one without Swim swims with
// the Run clip, and one without Cannonball is the classic Carl.
const REQUIRED = ["idle", "scratch", "walk", "run"];
// The five: the file, the ground speed at which each clip's planted foot stops sliding (m/s, from Anim Bench), the eye
// line [height, forward] of the goggles and how far the chest reaches front and back (metres, in the T-pose).
export const SWIMMERS = [
  {
    id: "boy",
    file: "swimmer-boy.glb",
    walk: 1.089,
    run: 3.462,
    eyes: [1.309, 0.198],
    front: 0.09,
    back: 0.092,
  },
  {
    id: "tall-man",
    file: "swimmer-tall-man.glb",
    walk: 1.284,
    run: 4.123,
    eyes: [1.563, 0.186],
    front: 0.158,
    back: 0.166,
  },
  {
    id: "woman",
    file: "swimmer-woman.glb",
    walk: 1.285,
    run: 4.095,
    eyes: [1.466, 0.184],
    front: 0.11,
    back: 0.098,
  },
  {
    id: "heavy-man",
    file: "swimmer-heavy-man.glb",
    walk: 0.906,
    run: 2.83,
    eyes: [1.31, 0.174],
    front: 0.191,
    back: 0.155,
  },
  {
    id: "tall-woman",
    file: "swimmer-tall-woman.glb",
    walk: 1.406,
    run: 4.525,
    eyes: [1.59, 0.19],
    front: 0.15,
    back: 0.17,
  },
];
// The two cannonball men, 1.68 m of very round man each (three belly bones, see tools/blender/README.md): the same fields as a
// swimmer, measured the same way, and `depth`, how far the belly or the back reaches from the middle of the body when he lies
// down (his chest alone would let him sink into the deck in a slip).
export const FIGURES = [
  {
    id: "carl",
    file: "carl.glb",
    walk: 0.813,
    run: 2.462,
    eyes: [1.42, 0.2],
    front: 0.24,
    back: 0.28,
    depth: 0.4,
  },
  {
    id: "leopard",
    file: "leopard-man.glb",
    walk: 0.793,
    run: 2.489,
    eyes: [1.47, 0.2],
    front: 0.21,
    back: 0.33,
    depth: 0.4,
  },
  // The fish kid: a small boy (1.2 m) on the same skeleton with the four carrying clips and a bucket of his own, which is in
  // his file (tools/blender/carry_clips.py --bucket: the node `Bucket` under `BucketMount`, which the clips move, so the bucket
  // goes where his hands go; `height` is its fallback height). He walks only up to `toRun` m/s (a child's stride is short), and
  // `dumpEnd` is the second of BucketDump the bucket is tipped out at (frame 19).
  {
    id: "kid",
    file: "fish-kid.glb",
    walk: 0.588,
    run: 1.576,
    toRun: 1.0,
    eyes: [0.93, 0.14],
    front: 0.1,
    back: 0.1,
    depth: 0.12,
    needs: ["carry", "carryWalk", "carryRun", "dump"],
    bucket: { height: 0.28 },
    dumpEnd: 19 / 24,
  },
];
// The classic swimmer's head is a ball of this radius, 1.42 up; its crown, star and sore eyes are drawn for that head.
const CLASSIC_HEAD = { y: 1.42, r: 0.34 };
const WALK_TO_RUN = 2.4; // m/s: faster than this is a run (and slower than 2.0 a walk again)
const RUN_TO_WALK = 2.0;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- which swimmers ------------------------------------------------------------------------------------------------

// "models" (the default) or "classic". ?swimmers=classic or ?swimmers=models chooses and is remembered on this device.
export function swimmerChoice(search = globalThis.location?.search || "", storage = globalThis.localStorage) {
  const asked = new URLSearchParams(search).get("swimmers");
  const chosen = asked === "classic" || asked === "models" ? asked : null;
  try {
    if (chosen) {
      if (chosen === "classic") storage?.setItem(SWIMMER_KEY, "classic");
      else storage?.removeItem(SWIMMER_KEY);
      return chosen;
    }
    return storage?.getItem(SWIMMER_KEY) === "classic" ? "classic" : "models";
  } catch {
    return chosen || "models";
  }
}
export function saveSwimmerChoice(choice, storage = globalThis.localStorage) {
  try {
    if (choice === "classic") storage?.setItem(SWIMMER_KEY, "classic");
    else storage?.removeItem(SWIMMER_KEY);
  } catch {}
}
let chosen = null;
export const activeSwimmerChoice = () => (chosen ??= swimmerChoice());
export function chooseSwimmers(choice) {
  chosen = choice;
  saveSwimmerChoice(choice);
}

// ---- loading -------------------------------------------------------------------------------------------------------

const templates = new Map(); // swimmer id -> {scene, clips, clone, look, rest…}
const figures = new Map(); // the same for the cannonball men, loaded one at a time: "carl" or "leopard"
export const swimmerModelsReady = () => templates.size > 0;
export const swimmerTemplateIds = () => [...templates.keys()];
export const figureReady = (id) => figures.has(id);
const templateFor = (id) => templates.get(id) || figures.get(id);

// Limbs, in the order the classic swimmer's `arms` and `legs` come: the one at -x (the character's right) first.
const SIDES = [
  {
    arm: "RightArm",
    fore: "RightForeArm",
    hand: "RightHand",
    up: "RightUpLeg",
    leg: "RightLeg",
    foot: "RightFoot",
    toe: "RightToeBase",
  },
  {
    arm: "LeftArm",
    fore: "LeftForeArm",
    hand: "LeftHand",
    up: "LeftUpLeg",
    leg: "LeftLeg",
    foot: "LeftFoot",
    toe: "LeftToeBase",
  },
];
const DOWN = new THREE.Vector3(0, -1, 0);
const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();
const va = new THREE.Vector3();

// The orientation of `node` in the frame of `top`, from the local rotations on the way down (the bones are posed by the
// mixer, so this is where they are now).
function relative(node, top, out) {
  out.identity();
  const chain = [];
  for (let n = node; n && n !== top; n = n.parent) chain.push(n);
  for (let i = chain.length - 1; i >= 0; i--) out.multiply(chain[i].quaternion);
  return out;
}

// What a template knows about its rest pose, once: where its hips and head are, and for each arm and leg the rotation that
// hangs it straight down (the pose the classic limbs start from), so a classic limb's rotation can be put on top of it.
function measure(scene) {
  scene.updateMatrixWorld(true);
  const at = (name) => scene.getObjectByName(name).getWorldPosition(new THREE.Vector3());
  const head = at("Head"),
    top = at("head_end");
  const hang = { arms: [], legs: [] };
  const rest = {};
  for (const side of SIDES) {
    for (const [key, name, child] of [
      ["arms", side.arm, side.fore],
      ["legs", side.up, side.leg],
    ]) {
      const bone = scene.getObjectByName(name);
      const axis = scene.getObjectByName(child).position.clone().normalize();
      const restRel = relative(bone, scene, new THREE.Quaternion());
      const direction = axis.clone().applyQuaternion(restRel);
      hang[key].push(new THREE.Quaternion().setFromUnitVectors(direction, DOWN).multiply(restRel));
    }
    for (const name of [side.fore, side.hand, side.leg, side.foot, side.toe])
      rest[name] = scene.getObjectByName(name).quaternion.clone();
  }
  return {
    chest: scene.getObjectByName("Spine") ? at("Spine") : null,
    hipsY: at("Hips").y,
    headY: (head.y + top.y) / 2,
    headR: (top.y - head.y) / 2,
    neckY: at("neck").y,
    topY: top.y,
    hang,
    rest,
  };
}

// For checks: stand-ins {id: {scene, clips, clone}} (a scene with the bones named as the real ones).
export function useSwimmerTemplates(list) {
  templates.clear();
  for (const look of SWIMMERS) {
    const t = list?.[look.id];
    if (t) templates.set(look.id, { ...t, look, ...measure(t.scene) });
  }
}
export function useFigureTemplates(list) {
  figures.clear();
  for (const look of FIGURES) {
    const t = list?.[look.id];
    if (t) figures.set(look.id, { ...t, look, ...measure(t.scene) });
  }
}
// One model, fetched and parsed: the loader is imported here so the classic swimmers never pay for it.
async function fetchTemplate(look, base, required) {
  const [{ GLTFLoader }, { clone }] = await Promise.all([
    import("../assets/GLTFLoader.js"),
    import("../assets/SkeletonUtils.js"),
  ]);
  const gltf = await new GLTFLoader().loadAsync(base + look.file);
  const clips = {};
  for (const clip of gltf.animations) clips[clip.name] = clip;
  const missing = required.map((key) => CLIPS[key]).filter((name) => !clips[name]);
  if (missing.length) throw new Error("the model lacks the clips " + missing.join(", "));
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.frustumCulled = false; // a skinned mesh's bounds are those of its bind pose
  });
  return { scene: gltf.scene, clips, clone, look, ...measure(gltf.scene) };
}
// Fetch and parse the five models once. A model that does not load is left out (and with none, the classic swimmers play).
export async function loadSwimmerModels(base = new URL("../assets/", import.meta.url).href) {
  if (templates.size === SWIMMERS.length) return templates;
  await Promise.all(
    SWIMMERS.map(async (look) => {
      if (templates.has(look.id)) return;
      try {
        templates.set(look.id, await fetchTemplate(look, base, REQUIRED));
      } catch (error) {
        console.warn("The swimmer " + look.id + " did not load.", error);
      }
    }),
  );
  return templates;
}
// The cannonball man of a level (about 1 MB), once; asked for when the level starts, so he is there when the incident does.
// Without him (a model that does not load, or no Cannonball clip) the classic Carl plays.
const loading = new Map();
export function loadFigure(id, base = new URL("../assets/", import.meta.url).href) {
  const look = FIGURES.find((f) => f.id === id);
  if (!look) return Promise.resolve(null);
  if (figures.has(id)) return Promise.resolve(figures.get(id));
  if (!loading.has(id))
    loading.set(
      id,
      fetchTemplate(look, base, [...REQUIRED, ...(look.needs || ["cannonball"])])
        .then((t) => {
          figures.set(id, t);
          return t;
        })
        .catch((error) => {
          console.warn("The figure " + id + " did not load; the classic one stays.", error);
          return null;
        })
        .finally(() => loading.delete(id)),
    );
  return loading.get(id);
}

// The model a swimmer is: the same one every time for the same `skin` number (the simulation hands them out evenly), or the
// cannonball man he is (`figure`), when that model is loaded.
export function lookFor(p) {
  if (p.figure) return FIGURES.find((look) => look.id === p.figure && figures.has(look.id)) || null;
  const have = SWIMMERS.filter((look) => templates.has(look.id));
  if (!have.length) return null;
  return have[Math.abs(Math.floor(p.skin ?? p.id ?? 0)) % have.length];
}
// The swimmers of the simulation, and the cannonball man in whichever form (the visitor, the customer he becomes); not the fish
// kid and the other visitors, nor a Carl with no model to be (the classic Carl).
export const wantsModel = (p) => !!p.figure || (!!TYPES[p.type] && !p.carl && !p.visitor);

// ---- the clips -----------------------------------------------------------------------------------------------------

const RATED = new Set(["run", "walk", "swim", "carryRun", "carryWalk"]); // the clips played at a rate that follows the speed

// Chooses the clip from what the swimmer is doing, and lays the classic poses over the clips where the game asks for one.
// `mixer` and `actions` are three's AnimationMixer and the four AnimationActions (kept apart so a check can drive the
// rules with stand-ins); `body` is what the pose layer needs: {top, bones, template}, or null when there is none.
export class SwimmerRig {
  constructor(mixer, actions, speeds, body = null) {
    this.mixer = mixer;
    this.actions = actions;
    this.walkSpeed = speeds.walk;
    this.runSpeed = speeds.run;
    this.toRun = speeds.toRun ?? WALK_TO_RUN; // faster than this on foot is a run, and slower than 0.83 of it a walk again
    this.toWalk = speeds.toRun ? speeds.toRun * 0.83 : RUN_TO_WALK;
    this.body = body;
    this.current = null;
    this.moving = false;
    this.running = false;
    this.speed = 0;
    this.rate = 1;
    this.idleFor = Math.random() * 5; // so a queue does not scan and scratch in step
    this.scratchAfter = SwimmerRig.scratchDelay();
    this.weights = { arms: 0, legs: 0 };
    this.to("idle", 0);
    const idle = actions.idle.getClip?.();
    if (idle) actions.idle.time = Math.random() * idle.duration;
  }
  static scratchDelay() {
    return 7 + Math.random() * 9; // seconds of standing before a head scratch
  }
  to(name, fade = 0.2) {
    if (this.current === name) return;
    const next = this.actions[name];
    const previous = this.actions[this.current];
    next.reset();
    next.enabled = true;
    next.setEffectiveWeight(1);
    // (The Cannonball does not run by itself: update() sets its time from the incident, frame by frame.)
    next.setEffectiveTimeScale(
      name === "cannonball" || name === "dump" ? 0 : RATED.has(name) ? this.rate : 1,
    );
    next.play();
    // A crowd that panics does not hop in step.
    if (name === "panic") next.time = Math.random() * (next.getClip?.().duration || 0);
    if (previous && fade > 0) next.crossFadeFrom(previous, fade, false);
    else if (previous) previous.stop();
    this.current = name;
  }
  // dt: seconds of world time (zero in a hit-stop). speed: how fast the swimmer is covering ground on foot. swim: the body
  // is on its front in the water, `stroke` the clip's rate there. panic: hopping on the spot with the hands up (the clip does
  // all of it, so the poses are not asked for). jump: a cannonball man's Cannonball clip at this many seconds (null when he is
  // not jumping). puppet: {arms, legs} (the swimmer's userData) and `classic` the classic {arms, legs} groups whose rotations
  // are the poses to copy.
  update(
    dt,
    {
      speed = 0,
      swim = false,
      stroke = 1,
      puppet = null,
      classic = null,
      panic = false,
      jump = null,
      carry = false,
      dump = null,
    } = {},
  ) {
    let want;
    let rate = 1;
    if (swim) {
      want = this.actions.swim ? "swim" : "run";
      rate = stroke;
      this.moving = true;
      this.running = true;
    } else {
      this.speed += (speed - this.speed) * Math.min(1, dt * 12);
      this.moving = this.speed > (this.moving ? 0.35 : 0.9);
      if (this.moving) {
        this.running = this.speed > (this.running ? this.toWalk : this.toRun);
        want = this.running ? "run" : "walk";
        rate = this.running
          ? clamp(this.speed / this.runSpeed, 0.6, 2.1)
          : clamp(this.speed / this.walkSpeed, 0.6, 1.9);
      } else {
        this.running = false;
        want = "idle";
      }
    }
    if (panic && !swim && this.actions.panic) want = "panic";
    const jumping = jump !== null && !!this.actions.cannonball;
    if (jumping) want = "cannonball";
    // Carrying the bucket (the fish kid): its own idle, walk and run, and no scratching of the head with both hands full.
    const carrying = carry && !swim && !!this.actions.carry;
    if (want === "idle" && !carrying) {
      const scratch = this.actions.scratch;
      if (this.current === "scratch") {
        // Stay with the scratch until it is nearly over, then settle back into the scan.
        if (scratch.time < scratch.getClip().duration - 0.35) want = "scratch";
      } else {
        this.idleFor += dt;
        if (this.idleFor > this.scratchAfter) want = "scratch";
      }
    }
    if (want !== "idle" && want !== "scratch") this.idleFor = 0;
    if (want === "scratch" && this.current !== "scratch") {
      this.idleFor = 0;
      this.scratchAfter = SwimmerRig.scratchDelay();
    }
    if (carrying) want = { idle: "carry", walk: "carryWalk", run: "carryRun" }[want] || want;
    const dumping = dump !== null && !!this.actions.dump;
    if (dumping) want = "dump";
    // (The first stroke after the splash takes a moment to take over from the tuck.)
    this.to(
      want,
      want === "panic" || want === "cannonball" || want === "dump"
        ? 0.12
        : want === "swim" && this.current === "cannonball"
          ? 0.3
          : RATED.has(want)
            ? 0.15
            : 0.22,
    );
    if (jumping) this.actions.cannonball.time = jump;
    if (dumping) this.actions.dump.time = dump;
    // The rate follows smoothly; the idles play as they are.
    this.rate += (rate - this.rate) * Math.min(1, dt * 12);
    if (RATED.has(this.current)) this.actions[this.current].setEffectiveTimeScale(this.rate);
    this.mixer.update(dt);
    if (this.body && puppet && classic) this.pose(dt, puppet, classic);
  }
  // The classic limbs' poses, on the model's bones, for the limbs the game is posing this frame; eased in and out so a
  // pose does not snap on.
  pose(dt, puppet, classic) {
    const { top, bones, template } = this.body;
    for (const key of ["arms", "legs"]) {
      const w = (this.weights[key] += ((puppet[key] ? 1 : 0) - this.weights[key]) * Math.min(1, dt * 14));
      if (w < 0.01) continue;
      for (let i = 0; i < 2; i++) {
        const limb = bones[i];
        const first = key === "arms" ? limb.arm : limb.up;
        const parent = relative(first.parent, top, qa).invert();
        qb.setFromEuler(classic[key][i].rotation).multiply(template.hang[key][i]);
        first.quaternion.slerp(parent.multiply(qb), w);
        for (const bone of key === "arms" ? [limb.fore, limb.hand] : [limb.leg, limb.foot, limb.toe])
          bone.quaternion.slerp(template.rest[bone.name], w);
      }
    }
  }
}

// ---- putting a model on a swimmer ---------------------------------------------------------------------------------

// Swaps the look of a character() group built as a swimmer: the classic parts stay (hidden, still posed by the rest of
// the game), the model goes in beside them, and the little things that sit on a body (the sore eyes, the bandage, a VIP's
// crown and sash, a daredevil's star and cape) are moved onto it. Returns the rig, or null when the classic swimmer is
// wanted or the models are not loaded.
export function attachSwimmerModel(group, p, choice = activeSwimmerChoice()) {
  if (choice !== "models" || !wantsModel(p)) return null;
  const look = lookFor(p);
  if (!look) return null;
  const t = templateFor(look.id);
  const u = group.userData;
  const model = t.clone(t.scene);
  const trimmings = new Set([u.carry, u.f, u.crown, u.sash, u.star, u.cape, u.kidBucket]);
  u.classic = u.root.children.filter((child) => !trimmings.has(child));
  for (const part of u.classic) part.visible = false;
  u.root.add(model);
  u.model = model;
  u.look = look;
  // What rides on the body follows a bone through the clips (a hop takes the head 25 cm up). A mount is a child of the bone
  // that stands for the swimmer's root as it is at rest, so what goes into it is placed as in the root and moves with the bone.
  group.updateMatrixWorld(true);
  const mount = (name) => {
    const bone = model.getObjectByName(name);
    const m = new THREE.Object3D();
    m.matrixAutoUpdate = false;
    m.matrix.copy(bone.matrixWorld).invert().multiply(u.root.matrixWorld);
    bone.add(m);
    return m;
  };
  u.mounts = { head: mount("Head"), chest: mount("Spine") };
  // Things that ask where the head is (the dizzy stars) find it on the model.
  u.head.position.set(0, t.headY, 0);
  u.hipsY = t.hipsY;
  // The classic swimmer's suit and cap say which type it is (green beginner, blue intermediate, red pro, purple aqua,
  // orange daredevil, gold VIP). A model's suit is its own, so the disc on the floor under its feet takes that colour.
  const disc = u.shadow?.material;
  if (disc && TYPES[p.type]) {
    u.discWas = { color: disc.color.getHex(), opacity: disc.opacity };
    disc.color.set(swimmerLook(p).color);
    disc.opacity = 0.5;
  }
  // The face: the sore eyes sit on the goggles, the bandage round the head.
  const face = new THREE.Group();
  face.position.set(0, t.headY, 0);
  u.mounts.head.add(face);
  face.add(u.soreEyes, u.bandage);
  const eyes = 0.6;
  u.soreEyes.scale.setScalar(eyes);
  u.soreEyes.position.set(0, look.eyes[0] - t.headY - 0.05 * eyes, look.eyes[1] + 0.035 - 0.39 * eyes);
  u.bandage.scale.setScalar(t.headR / CLASSIC_HEAD.r);
  // The VIP's crown and a daredevil's star ride on the head, the sash and the cape on the chest and back.
  const head = t.headR / CLASSIC_HEAD.r;
  for (const part of [u.crown, u.star]) {
    if (!part) continue;
    part.scale.setScalar(head);
    part.position.set(0, t.headY - CLASSIC_HEAD.y * head + 0.02, 0);
    u.mounts.head.add(part);
  }
  const chest = (t.neckY + t.hipsY) / 2;
  const body = (t.neckY - t.hipsY) / 0.7; // the classic body: shoulders 0.7 above the hips
  if (u.sash) {
    u.mounts.chest.add(u.sash);
    u.sash.scale.setScalar(body);
    u.sash.position.set(-0.05 * body, chest - 0.82 * body + 0.02, look.front + 0.03 - 0.31 * body);
  }
  if (u.cape) {
    u.mounts.chest.add(u.cape);
    u.cape.scale.setScalar(body);
    u.cape.position.set(0, t.neckY - 0.3 * body - 0.92 * body + 0.3, -(look.back + 0.04) + 0.33 * body);
  }
  // How a body lies and how long it is, for the world sync's poses: the half depth a swimmer on its back or front is
  // lowered by, and the height as a share of the classic swimmer's 1.75 (the lengths of a swim, a climb and a slip).
  u.depth = look.depth ?? Math.min(look.back, 0.17) + 0.02;
  u.fit = t.topY / 1.75;
  // The classic Carl is drawn bigger than a swimmer (a visitor 1.14 times, a customer 1.08); the model is as tall as it is.
  u.classicScale = { root: u.root.scale.x, base: u.baseScale };
  u.root.scale.setScalar(1);
  u.baseScale = 1;
  const names = {};
  for (const side of SIDES) for (const key of Object.values(side)) names[key] = model.getObjectByName(key);
  const bones = SIDES.map((side) => ({
    arm: names[side.arm],
    fore: names[side.fore],
    hand: names[side.hand],
    up: names[side.up],
    leg: names[side.leg],
    foot: names[side.foot],
    toe: names[side.toe],
  }));
  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const [key, name] of Object.entries(CLIPS)) {
    if (!t.clips[name]) continue;
    const action = mixer.clipAction(t.clips[name]);
    if (key === "scratch" || key === "cannonball" || key === "dump") {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    }
    actions[key] = action;
  }
  u.rig = new SwimmerRig(mixer, actions, look, { top: model, bones, template: t });
  if (look.bucket && u.kidBucket) attachBucket(u, model, look);
  u.lastAt = null;
  return u.rig;
}
// The fish kid's bucket is in his file, a mesh (`Bucket`) under `BucketMount`, a node of his skeleton, a child of the chest bone,
// that the carrying clips move, so it goes where his hands go (and shows the same in Anim Bench). The classic bucket is hidden
// and the fish moves into the model's. `u.bucketModel` is the bucket (its origin is on its base) and `u.bucketHeight` how tall
// it is. A file with no bucket in it leaves the classic one.
// How far up the bucket's middle the fish's middle sits: its nose and shoulders stand out of the mouth.
export const FISH_IN = 0.05;
function attachBucket(u, model, look) {
  const bucket = model.getObjectByName("Bucket");
  if (!bucket) return;
  bucket.traverse((o) => o.isMesh && (o.castShadow = true));
  u.bucketModel = bucket;
  u.bucketHeight = bucket.userData.height || look.bucket.height;
  u.kidBucket.visible = false;
  u.fish = u.kidBucket.getObjectByName("bucket-fish");
  if (u.fish) {
    u.fishWas = u.fish.parent;
    u.fishScale = u.fish.scale.x;
    u.fishY = u.bucketHeight / 2 + FISH_IN;
    bucket.add(u.fish);
    u.fish.position.set(0, u.fishY, 0);
    u.fish.rotation.set(-Math.PI / 2 + 0.3, 0, 0);
    u.fish.scale.setScalar(0.4);
  }
}
// A queasy swimmer's skin goes green in the classic look; on a model the whole body takes a green tint instead (a tinted
// copy of each material, made once per model).
const SICK = new THREE.Color(0.74, 0.95, 0.52);
export function setQueasy(group, on) {
  const u = group.userData;
  if (!u.model || !!u.sick === on) return;
  u.sick = on;
  const t = templateFor(u.look.id);
  t.sick ||= new Map();
  u.model.traverse((o) => {
    if (!o.isMesh) return;
    o.userData.normalMaterial ||= o.material;
    if (!on) {
      o.material = o.userData.normalMaterial;
      return;
    }
    let tinted = t.sick.get(o.userData.normalMaterial);
    if (!tinted) {
      tinted = o.userData.normalMaterial.clone();
      tinted.color.multiply(SICK);
      t.sick.set(o.userData.normalMaterial, tinted);
    }
    o.material = tinted;
  });
}
// Back to the classic swimmer, after the rig has failed (or the player asked for it): show the hidden parts again and
// put the things that ride on a body back where they were.
export function dropSwimmerModel(group) {
  const u = group.userData;
  if (!u.model) return; // (also after a model that failed halfway through being put on)
  u.rig?.mixer.stopAllAction();
  if (u.bucketModel) {
    u.bucketHolder?.removeFromParent(); // (the bucket on the deck, after the dump)
    u.bucketHolder = null;
    if (u.fish && u.fishWas) {
      u.fishWas.add(u.fish);
      u.fish.position.set(0, 0.5, 0.02);
      u.fish.rotation.set(-Math.PI / 2 + 0.3, 0, 0);
      u.fish.scale.setScalar(u.fishScale);
    }
    u.bucketModel = u.fish = u.fishWas = null;
  }
  u.model.traverse((o) => o.isSkinnedMesh && o.skeleton.dispose());
  u.root.remove(u.model);
  for (const part of u.classic || []) part.visible = true;
  u.head.position.set(0, 1.42, 0);
  u.head.add(u.soreEyes, u.bandage);
  u.soreEyes.scale.setScalar(1);
  u.soreEyes.position.set(0, 0, 0);
  u.bandage.scale.setScalar(1);
  for (const part of [u.crown, u.star, u.sash, u.cape]) {
    if (!part) continue;
    u.root.add(part);
    part.scale.setScalar(1);
    part.position.set(0, 0, 0);
  }
  u.mounts = null;
  if (u.discWas) {
    u.shadow.material.color.setHex(u.discWas.color);
    u.shadow.material.opacity = u.discWas.opacity;
    u.discWas = null;
  }
  if (u.classicScale) {
    u.root.scale.setScalar(u.classicScale.root);
    u.baseScale = u.classicScale.base;
  }
  u.rig = u.model = u.look = u.depth = u.hipsY = u.fit = u.classicScale = null;
  u.sick = false;
}
