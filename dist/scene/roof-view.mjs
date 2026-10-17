// The Rooftop Pool on screen (17 October 2026): the guests, the sunbeds' towels, the DJ and the bartender. A guest in the water
// stands in it chest-deep (the bench step along the near wall first, then the floor), facing their group while they chat (a bubble
// now and then over whoever is talking), the city when alone; on the drop the whole pool dances (DanceBoth, on the beat). A guest on
// a sunbed lies back on it (TubeFloat: the reclined body the river's riders have). A margarita served is in the guest's hand while
// they sip it. A selfie: the phone held up, wading to the edge, then up on the knife edge facing the pool and leaning back out over
// the drop, more and more the longer it lasts. Overboard: the head and two waving arms in the gutter past the edge, splashing.
// Behind the counter the bartender shakes; behind the booth the DJ plays (the DJ clip, on the beat), throwing the hands up on the
// drop. Only the picture moves here.
import { THREE } from "./kit.mjs";
import { ROOF, ROOF_BEDS } from "../roof-plan.mjs";
import { CHILL } from "../rooftop.mjs";
import { danceAt } from "../dance.mjs";
import { propModel } from "./prop-models.mjs";
import { character } from "./actors.mjs";
import { loadFigure, attachSwimmerModel } from "./swimmer-models.mjs";
import { waitingInWater } from "../rescue.mjs";

const WATER = -0.08,
  FLOOR = -1.24,
  BENCH = -0.62,
  GUTTER = -0.62,
  GUTTER_FLOOR = -0.82;
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// The floor under a guest at x: the bench step along the near wall, then the pool's floor.
export const roofFloorAt = (x) => {
  const t = clamp((x - (-ROOF.halfX + 0.42)) / 0.3, 0, 1);
  return BENCH + (FLOOR - BENCH) * t;
};

// Something held in the right hand (a margarita, a phone): made once, hung on the hand bone of the model (or the classic arm).
function held(w, g, key, make) {
  const u = g.userData;
  u.held ||= {};
  // (Made on the classic arm before the model came: hung again on the model's hand.)
  if (u.held[key]?.parent && u.held[key].userData.onModel === !!u.model) return u.held[key];
  u.held[key]?.removeFromParent();
  const hand = u.model?.getObjectByName("RightHand");
  const item = make();
  item.visible = false;
  if (hand) {
    hand.updateMatrixWorld(true);
    const s = new THREE.Vector3();
    hand.getWorldScale(s);
    item.scale.multiplyScalar(1 / (s.x || 1));
    hand.add(item);
  } else if (u.arms?.[0]) {
    item.position.set(0, -0.62, 0.08);
    u.arms[0].add(item);
  } else return null;
  item.userData.onModel = !!hand;
  u.held[key] = item;
  return item;
}
// A steel cocktail shaker: a tin, its cap, a cut of light along it.
function shakerObject() {
  const g = new THREE.Group(),
    steel = new THREE.MeshStandardMaterial({ color: 0xd8dde2, metalness: 0.9, roughness: 0.22 });
  const tin = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.036, 0.15, 12), steel);
  tin.position.y = 0.02;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.044, 0.06, 12), steel);
  cap.position.y = 0.125;
  g.add(tin, cap);
  return g;
}
function glassObject() {
  const g = propModel("margarita", { height: 0.16 }, (s) => {
    const cup = new THREE.Mesh(
      new THREE.ConeGeometry(0.07, 0.07, 10, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xe9f5b0, side: THREE.DoubleSide }),
    );
    cup.rotation.x = Math.PI;
    cup.position.y = 0.12;
    s.add(cup);
  });
  const wrap = new THREE.Group();
  g.position.set(0, -0.02, 0.06);
  wrap.add(g);
  return wrap;
}
function phoneObject() {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, 0.15, 0.012),
    new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: 0.3, metalness: 0.5 }),
  );
  m.position.set(0, -0.05, 0.08);
  const g = new THREE.Group();
  g.add(m);
  return g;
}
// A speech bubble (three dots) over a chatting guest's head.
let bubbleTexture = null;
function bubble(w, g) {
  const u = g.userData;
  if (u.bubble) return u.bubble;
  if (!bubbleTexture && typeof document !== "undefined") {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 96;
    const x = c.getContext("2d");
    x.fillStyle = "rgba(255,255,255,0.95)";
    x.beginPath();
    x.roundRect(8, 8, 112, 60, 26);
    x.fill();
    x.beginPath();
    x.moveTo(40, 64);
    x.lineTo(30, 90);
    x.lineTo(62, 64);
    x.fill();
    x.fillStyle = "#3a3a46";
    for (const cx of [38, 64, 90]) {
      x.beginPath();
      x.arc(cx, 38, 8, 0, Math.PI * 2);
      x.fill();
    }
    bubbleTexture = new THREE.CanvasTexture(c);
    bubbleTexture.colorSpace = THREE.SRGBColorSpace;
  }
  if (!bubbleTexture) return null;
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: bubbleTexture, depthWrite: false, transparent: true }),
  );
  s.scale.set(0.42, 0.32, 1);
  s.visible = false;
  g.add(s);
  u.bubble = s;
  return s;
}

// The Rooftop Pool's part of a guest's frame. True when it has posed them (the rest of the world sync is skipped).
export function roofPose(w, sim, p, g, time, dt) {
  const u = g.userData,
    motion = w.reducedMotion?.matches ? 0 : 1;
  const glass = held(w, g, "glass", glassObject),
    phone = held(w, g, "phone", phoneObject);
  if (glass) glass.visible = (p.sipping || 0) > 0;
  if (phone) phone.visible = p.problem === "selfie";
  if (u.bubble) u.bubble.visible = false;
  const inWater =
    p.status === "swim" ||
    (p.status === "exit" && ["water", "climb"].includes(p.exitPhase)) ||
    (p.status === "evacuating" && p.evacWater && p.x > -ROOF.halfX - 0.3) ||
    (p.status === "fleeing" && ["swim", "leap"].includes(p.fleePhase)) ||
    (p.status === "enter" && p.goal === "pool" && p.stepT > 0);
  const lying = p.status === "lounge" || (p.status === "enter" && p.goal === "bed" && p.stepT > 0);
  if (!inWater && !lying && p.status !== "overboard") return false;
  u.root.position.set(0, 0, 0);
  u.root.rotation.set(0, 0, 0);
  u.root.scale.setScalar(u.baseScale || 1);
  u.legs.forEach((l) => (l.rotation.x = 0));
  u.puppet.arms = u.puppet.legs = false;
  u.soreEyes.visible = p.problem === "eyes";
  u.f.visible = false;
  u.shadow.visible = false;
  let rig = { speed: 0, puppet: u.puppet, classic: u };
  const height = (u.fit || 1) * 1.75;
  if (p.status === "overboard") {
    // In the gutter past the edge: standing waist-deep in the running water, soaked, facing the pool and waving for help.
    g.position.set(p.x, GUTTER_FLOOR + Math.sin(time * 6 + (u.phase || 0)) * 0.03 * motion, p.z);
    g.rotation.set(0, -Math.PI / 2, 0);
    u.hit.position.y = height * 0.8;
    rig = { speed: 0, panic: true, puppet: u.puppet, classic: u };
    if (motion && Math.random() < dt * 5) w.splash(p.x, GUTTER + 0.05, p.z, 2, true, 0xe8ffff);
  } else if (lying) {
    // On a sunbed: lying back on it, the feet to the pool, the head on the raised back.
    const b = ROOF_BEDS[p.bed] || { x: p.x, z: p.z };
    const hips = u.hipsY ?? 0.82,
      k = p.status === "lounge" ? 1 : clamp(1 - p.stepT / CHILL.lieDown, 0, 1),
      seat = 0.366 * hips;
    const x = b.x + 0.25,
      z = b.z;
    g.position.set(p.x + (x - p.x) * k, (0.5 - seat) * k + 0 * (1 - k), p.z + (z - p.z) * k);
    g.rotation.set(0, Math.PI / 2, 0);
    u.hit.position.y = 0.5;
    rig = k > 0.35 ? { tube: { float: true }, puppet: u.puppet, classic: u } : rig;
  } else {
    // Standing in the water, chest-deep: on the bench step by the near wall, on the floor further out.
    let y = roofFloorAt(p.x);
    if (p.status === "enter")
      y = (1 - clamp(1 - p.stepT / CHILL.step, 0, 1)) * 0 + clamp(1 - p.stepT / CHILL.step, 0, 1) * BENCH;
    if (p.status === "exit" && p.exitPhase === "climb") y = BENCH + (0 - BENCH) * (p.exitProgress || 0);
    let facing = p.angle ?? Math.PI / 2;
    const s = p.problem === "selfie" ? p.selfie : null;
    g.position.set(p.x, y, p.z);
    u.hit.position.y = 1.0;
    const moving = (p.actualSpeed || 0) > 0.15 && !waitingInWater(sim, p);
    rig = { speed: moving ? Math.max(0.9, p.actualSpeed * 1.6) : 0, puppet: u.puppet, classic: u };
    if (s && (s.stage === "climbing" || s.stage === "posing")) {
      // Up on the knife edge, facing the pool, phone up, leaning back over the drop.
      const climb = s.stage === "climbing" ? clamp(s.t / CHILL.climbUp, 0, 1) : 1,
        dread = s.stage === "posing" ? clamp(s.t / s.limit, 0, 1) : 0;
      g.position.y = roofFloorAt(p.x) + (WATER + 0.02 - roofFloorAt(p.x)) * climb;
      facing = -Math.PI / 2;
      g.rotation.set(0, facing, 0);
      const lean = (0.08 + 0.3 * dread + Math.sin(time * (2.5 + dread * 4)) * (0.04 + 0.1 * dread)) * motion;
      g.rotateOnWorldAxis(Z_AXIS, -lean);
      u.arms[0].rotation.set(0, 0, 2.6);
      u.arms[1].rotation.set(0, 0, -0.5 - Math.sin(time * 7) * 0.4 * dread);
      u.puppet.arms = true;
      rig = { speed: 0, puppet: u.puppet, classic: u };
    } else {
      g.rotation.set(0, facing, 0);
      if (s) {
        // Wading to the edge with the phone already up.
        u.arms[0].rotation.set(0, 0, 2.6);
        u.puppet.arms = true;
      }
      // Tipsy: a sway.
      if (p.tipsy && motion) g.rotateOnWorldAxis(Z_AXIS, Math.sin(time * 1.9 + (u.phase || 0)) * 0.07);
      // On the drop the whole pool dances.
      if ((sim.roof?.hype || 0) > 0 && p.status === "swim" && !p.problem) {
        const d = danceAt(sim.time || 0);
        rig = { speed: 0, dance: { clip: "danceBoth", time: d.time }, puppet: u.puppet, classic: u };
        g.position.y += Math.max(0, Math.sin(d.phase * Math.PI)) * 0.12 * motion;
      } else if (p.problem === "drink" && !moving) {
        // Waiting for a margarita: a hand up to catch the coach's eye.
        u.arms[0].rotation.set(0, 0, 2.2 + Math.sin(time * 5) * 0.25);
        u.puppet.arms = true;
      }
      // Chatting: a bubble over whoever is talking (they take turns).
      if (p.chatting && motion) {
        const turn = Math.floor(time / 2.6 + (p.group || 0) * 0.37) % 4,
          me = (p.id + (p.group || 0)) % 4;
        if (turn === me) {
          const b = bubble(w, g);
          if (b) {
            b.visible = true;
            b.position.set(0.25, height + 0.28 + Math.sin(time * 3) * 0.02, 0);
          }
        }
      }
    }
  }
  try {
    u.rig?.update(dt, rig);
  } catch (error) {
    console.error(error);
  }
  return true;
}

// ---- the beds, the ripples, the DJ and the bartender ----------------------------------------------------------------------

// A rolled towel at the foot of every free bed; a towel spread under a guest; a crumpled towel and an empty glass on a messy one.
function towels(w, ctx) {
  const roll = new THREE.MeshStandardMaterial({ color: 0xf8f6f0, roughness: 0.95 }),
    stripe = new THREE.MeshStandardMaterial({ color: 0x2c6f73, roughness: 0.95 });
  ctx.towels = ROOF_BEDS.map((b) => {
    const g = new THREE.Group();
    g.position.set(b.x, 0, b.z);
    w.scene.add(g);
    const rolled = new THREE.Group();
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.5, 12), roll);
    r.rotation.x = Math.PI / 2;
    rolled.add(r);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.112, 0.112, 0.06, 12), stripe);
    band.rotation.x = Math.PI / 2;
    rolled.add(band);
    rolled.position.set(b.cabana ? 0.6 : 0.7, b.cabana ? 0.62 : 0.5, 0);
    rolled.rotation.y = Math.PI / 2;
    g.add(rolled);
    const spread = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.02, 0.62), roll);
    spread.position.set(0.1, b.cabana ? 0.58 : 0.47, 0);
    g.add(spread);
    const crumpled = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const lump = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), roll);
      lump.scale.set(1.3, 0.35, 0.9);
      lump.position.set(-0.4 + i * 0.28, 0.5 + (i % 2) * 0.04, (i % 3) * 0.08 - 0.08);
      lump.rotation.y = i;
      crumpled.add(lump);
    }
    const empty = propModel("margarita", { height: 0.16 });
    empty.position.set(0.55, 0.02, b.cabana ? 1.0 : 0.6);
    empty.rotation.z = 1.4;
    crumpled.add(empty);
    g.add(crumpled);
    return { rolled, spread, crumpled };
  });
}

export function buildRoofCast(w, venue, ctx) {
  towels(w, ctx);
  ctx.cast = [];
  for (const who of [
    { id: "dj", name: "DJ", at: ctx.djSpot, y: 0.25, angle: Math.PI, type: "advanced" },
    { id: "bartender", name: "Bartender", at: ctx.barSpot, y: 0, angle: 0, type: "intermediate" },
  ]) {
    if (!who.at) continue;
    const person = {
      id: "roof-" + who.id,
      type: who.type,
      figure: who.id,
      skin: who.id === "dj" ? 3 : 1,
      shape: 0.5,
      name: who.name,
    };
    const g = character(w, person);
    g.position.set(who.at.x, who.y, who.at.z);
    g.rotation.y = who.angle;
    w.scene.add(g);
    w.liveProps.push(g);
    w.clickables = w.clickables.filter((m) => m !== g.userData.hit);
    const member = { who: who.id, g, rig: null };
    ctx.cast.push(member);
    loadFigure(who.id).then((t) => {
      if (!t || !g.parent) return;
      try {
        member.rig = attachSwimmerModel(g, person);
        // The bartender's shaker, in his right hand (his clip Shake moves it).
        if (who.id === "bartender") {
          const shaker = held(w, g, "shaker", shakerObject);
          if (shaker) shaker.visible = true;
        }
      } catch (error) {
        console.warn("The " + who.name + " stays classic.", error);
      }
    });
  }
}

export function syncRoof(w, sim, time, dt, ctx) {
  const R = sim?.roof;
  // The towels.
  if (R && ctx.towels)
    R.beds.forEach((bed, i) => {
      const t = ctx.towels[i];
      t.rolled.visible = !bed.guest && !bed.messy;
      t.spread.visible = !!bed.guest && sim.get(bed.guest)?.status === "lounge";
      t.crumpled.visible = bed.messy;
    });
  // The ripples round everyone standing in the water (the most stirred first), and the slosh of the drop.
  const ripples = ctx.ripples;
  if (ripples) {
    const stirring = (sim?.people || [])
      .filter((p) => p.status === "swim" || (p.status === "exit" && p.exitPhase === "water"))
      .map((p) => ({ p, k: 0.3 + Math.min(1, (p.actualSpeed || 0) * 1.5) + (R?.hype > 0 ? 0.8 : 0) }))
      .sort((a, b) => b.k - a.k);
    for (let i = 0; i < ripples.length; i++) {
      const s = stirring[i];
      if (s) ripples[i].set(s.p.x, s.p.z, s.k, (s.p.id || 0) * 1.7);
      else ripples[i].set(0, 0, 0, 0);
    }
    w.water.material.uniforms.uSplash.value = R?.hype > 0 ? Math.min(1, R.hype / 2) : 0;
  }
  // The DJ and the bartender.
  const d = danceAt(sim?.time || 0),
    dark = sim?.outage?.stage === "dark";
  for (const c of ctx.cast || []) {
    const u = c.g.userData;
    if (!c.rig) {
      // The classic figure: the DJ's arms working the decks, the bartender's shaking.
      const beat = Math.sin(d.phase * Math.PI * 2);
      u.arms?.forEach((a, i) => a.rotation.set(-0.9 + (i ? beat : -beat) * 0.25, 0, 0));
      u.root.position.y = Math.max(0, Math.sin(d.phase * Math.PI)) * 0.04;
      continue;
    }
    let state = { speed: 0, puppet: u.puppet, classic: u };
    if (c.who === "dj")
      state =
        R?.hype > 0 || dark
          ? { speed: 0, dance: { clip: "danceBoth", time: d.time }, puppet: u.puppet, classic: u }
          : { speed: 0, dance: { clip: "dj", time: d.time }, puppet: u.puppet, classic: u };
    else state = { speed: 0, dance: { clip: "shake", time: time % 2 }, puppet: u.puppet, classic: u };
    try {
      c.rig.update(dt, state);
    } catch (error) {
      console.error(error);
    }
  }
}
