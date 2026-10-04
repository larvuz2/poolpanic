// Coach Panic in the game: the Meshy character (assets/coach-panic.glb) standing in for the coach that actors.mjs
// builds from balls and boxes. The classic coach is still built, and still posed, but hidden, so one switch brings it
// back (?coach=classic, or the button in How to play). The clips: IdleScan and IdleScratch (standing still), Walk (the
// few steps into the start of a shift), Run (every other movement on foot) and Swim (the freestyle crawl, made standing
// and played on his front in the water). Rules, in short:
//   - a shift's countdown: Walk, from a few steps behind the spawn point to exactly the spawn point as it reaches zero;
//   - moving: Run, played faster or slower with the coach's speed so the feet keep up with the floor;
//   - swimming: Swim (Run, if the file has no Swim);
//   - standing: IdleScan, with an IdleScratch now and then.
import { THREE } from "./kit.mjs";

export const COACH_KEY = "pool-panic.coach.v1";
export const CLIPS = { idle: "IdleScan", scratch: "IdleScratch", walk: "Walk", run: "Run", swim: "Swim" };
const REQUIRED = ["idle", "scratch", "walk", "run"];
// The speed each clip covers without the feet sliding (Anim Bench's ground estimate), in world units per second.
export const RUN_SPEED = 3.85;
export const WALK_SPEED = 1.21;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// "panic" (the default) or "classic". ?coach=classic or ?coach=panic chooses and is remembered on this device.
export function coachChoice(search = globalThis.location?.search || "", storage = globalThis.localStorage) {
  const asked = new URLSearchParams(search).get("coach");
  const chosen = asked === "classic" || asked === "panic" ? asked : null;
  try {
    if (chosen) {
      if (chosen === "classic") storage?.setItem(COACH_KEY, "classic");
      else storage?.removeItem(COACH_KEY);
      return chosen;
    }
    return storage?.getItem(COACH_KEY) === "classic" ? "classic" : "panic";
  } catch {
    return chosen || "panic";
  }
}
export function saveCoachChoice(choice, storage = globalThis.localStorage) {
  try {
    if (choice === "classic") storage?.setItem(COACH_KEY, "classic");
    else storage?.removeItem(COACH_KEY);
  } catch {}
}

// The choice for this page: the address and the saved one are read once, then the How to play button changes it.
let chosen = null;
export const activeChoice = () => (chosen ??= coachChoice());
export function chooseCoach(choice, remember = true) {
  chosen = choice;
  if (remember) saveCoachChoice(choice);
}

// ---- loading ------------------------------------------------------------------------------------------------------

let template = null;
export const coachModelReady = () => !!template;
// For checks: a stand-in {scene, clips: {name: AnimationClip}, clone(scene)}.
export function useCoachTemplate(t) {
  template = t;
}
// Fetch and parse the model once; the loader is imported here so the classic coach never pays for it. Resolves to
// nothing (and the game carries on with the classic coach) if anything goes wrong.
export async function loadCoachModel(url = new URL("../assets/coach-panic.glb", import.meta.url).href) {
  if (template) return template;
  try {
    const [{ GLTFLoader }, { clone }] = await Promise.all([
      import("../assets/GLTFLoader.js"),
      import("../assets/SkeletonUtils.js"),
    ]);
    const gltf = await new GLTFLoader().loadAsync(url);
    const clips = {};
    for (const clip of gltf.animations) clips[clip.name] = clip;
    const missing = REQUIRED.map((key) => CLIPS[key]).filter((name) => !clips[name]);
    if (missing.length) throw new Error("the model lacks the clips " + missing.join(", "));
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.frustumCulled = false; // a skinned mesh's bounds are those of its bind pose
    });
    template = { scene: gltf.scene, clips, clone };
  } catch (error) {
    console.warn("Coach Panic did not load; the classic coach stays.", error);
    template = null;
  }
  return template;
}

// ---- the clips ----------------------------------------------------------------------------------------------------

// Chooses the clip from what the coach is doing. `mixer` and `actions` are three's AnimationMixer and the four
// AnimationActions (kept apart so a check can drive the rules with stand-ins).
export class CoachRig {
  constructor(mixer, actions) {
    this.mixer = mixer;
    this.actions = actions;
    this.current = null;
    this.moving = false;
    this.rate = 1;
    this.idleFor = 0;
    this.scratchAfter = CoachRig.scratchDelay();
    this.to("idle", 0);
  }
  static scratchDelay() {
    return 7 + Math.random() * 6; // seconds of standing before the coach scratches his head
  }
  to(name, fade = 0.2) {
    if (this.current === name) return;
    const next = this.actions[name];
    const previous = this.actions[this.current];
    next.reset();
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.setEffectiveTimeScale(name === "run" || name === "walk" || name === "swim" ? this.rate : 1);
    next.play();
    if (previous && fade > 0) next.crossFadeFrom(previous, fade, false);
    else if (previous) previous.stop();
    this.current = name;
  }
  // dt: seconds of world time (zero in a hit-stop). speed: the coach's speed. intro: {rate} while the shift's countdown
  // walks him in. prone: swimming (the clip is played on his front, in the water). busy: a timed job in hand.
  update(dt, { speed = 0, intro = null, prone = false, busy = false } = {}) {
    let want;
    let rate = 1;
    if (intro) {
      want = "walk";
      rate = intro.rate;
      this.moving = false;
    } else {
      this.moving = speed > (this.moving ? 0.35 : 0.9);
      if (this.moving) {
        want = "run";
        rate = clamp(speed / RUN_SPEED, 0.6, 2.1);
      } else if (prone) {
        want = this.actions.swim ? "swim" : "run";
        rate = this.actions.swim ? 1.1 : 1.2;
      } else want = "idle";
    }
    if (want === "idle") {
      const scratch = this.actions.scratch;
      if (this.current === "scratch") {
        // Stay with the scratch until it is nearly over, then settle back into the scan.
        if (scratch.time < scratch.getClip().duration - 0.35) want = "scratch";
      } else {
        this.idleFor += dt;
        if (this.idleFor > this.scratchAfter && !busy) want = "scratch";
      }
    }
    if (want !== "idle" && want !== "scratch") this.idleFor = 0;
    if (want === "scratch" && this.current !== "scratch") {
      this.idleFor = 0;
      this.scratchAfter = CoachRig.scratchDelay();
    }
    this.to(want, want === "run" || want === "swim" ? 0.12 : 0.22);
    // The playing rate follows the coach's speed smoothly; the other clips play as they are.
    this.rate += (rate - this.rate) * Math.min(1, dt * 14);
    if (this.current === "run" || this.current === "walk" || this.current === "swim")
      this.actions[this.current].setEffectiveTimeScale(this.rate);
    this.mixer.update(dt);
  }
}

// ---- walking in at the start of a shift ---------------------------------------------------------------------------

// Where the coach starts his walk so that he arrives at the spawn point as the countdown reaches zero: a few steps
// back along the way he faces if that ground is clear, else from the nearest clear side. The walk's own speed sets the
// length (countdown seconds times WALK_SPEED); a shorter clear run is walked slower instead.
export function planIntro(sim, seconds = sim.countdown || 3) {
  const c = sim.coach;
  const venue = sim.venue;
  const facing = c.angle ?? Math.PI / 2;
  const clear = (dir, length) => {
    for (let d = 0; d <= length + 1e-6; d += 0.2)
      if (!venue.isDeck(c.x - Math.sin(dir) * d, c.z - Math.cos(dir) * d, sim.level)) return false;
    return true;
  };
  const reach = WALK_SPEED * seconds;
  const turns = [
    0,
    Math.PI / 4,
    -Math.PI / 4,
    Math.PI / 2,
    -Math.PI / 2,
    (3 * Math.PI) / 4,
    (-3 * Math.PI) / 4,
    Math.PI,
  ];
  for (const share of [1, 0.85, 0.7, 0.55, 0.4])
    for (const turn of turns) {
      const dir = facing + turn;
      if (clear(dir, reach * share))
        return {
          x: c.x,
          z: c.z,
          dir,
          length: reach * share,
          rate: (reach * share) / seconds / WALK_SPEED,
          seconds,
        };
    }
  return { x: c.x, z: c.z, dir: facing, length: 0, rate: 1, seconds };
}
// Where he is when `countdown` seconds remain: the spawn point at zero.
export function introAt(plan, countdown) {
  const left = clamp(countdown / plan.seconds, 0, 1) * plan.length;
  return { x: plan.x - Math.sin(plan.dir) * left, z: plan.z - Math.cos(plan.dir) * left, angle: plan.dir };
}

// ---- putting the model on the coach -------------------------------------------------------------------------------

// Swaps the look of a character() group built as the coach: the classic parts stay (hidden, still posed by the rest of
// the game), the model goes in beside them. Returns the rig, or null when the classic coach is wanted or the model is
// not loaded.
export function attachCoachModel(group, choice = activeChoice()) {
  if (choice !== "panic" || !template) return null;
  const u = group.userData;
  const model = template.clone(template.scene);
  const kept = new Set([u.carry, u.f]);
  u.classic = u.root.children.filter((child) => !kept.has(child));
  for (const part of u.classic) part.visible = false;
  u.root.add(model);
  u.model = model;
  // Where an item sits in his hands: in front of the chest, to his right.
  u.carryHome = [0.3, 1.0, 0.34];
  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const [key, name] of Object.entries(CLIPS)) {
    if (!template.clips[name]) continue; // (a file without Swim crawls with the Run clip)
    const action = mixer.clipAction(template.clips[name]);
    if (key === "scratch") {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    }
    actions[key] = action;
  }
  u.rig = new CoachRig(mixer, actions);
  return u.rig;
}
// Back to the classic coach after the rig has failed: show the hidden parts again.
export function dropCoachModel(group) {
  const u = group.userData;
  if (!u.rig) return;
  u.root.remove(u.model);
  for (const part of u.classic || []) part.visible = true;
  u.rig = u.model = u.carryHome = null;
}
