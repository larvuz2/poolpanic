// The Wave Pool on screen (17 October 2026): the bathers in the waves, and what floats. A bather rides the surface the simulation's
// crests make (waves.mjs `surfaceAt`, the same profile the water's shader draws): standing in the shallows with their feet on the
// sloping sand or tiles (`floorAt`), treading water with their head up out in the deep, or sitting in a tube (TubeFloat) that rises
// over each crest and tips with the slope. A crest that hits them throws them back a little; a woozy bather sees stars circling
// over their head and sways; one knocked under is down to the head and a waving hand, in a stream of bubbles. Lost tubes bob in on
// the waves. Only the picture moves here.
import { THREE } from "./kit.mjs";
import { WAVE, surfaceAt, depthAt, floorAt } from "../waves.mjs";
import { BATHE } from "../wave-pool.mjs";
import { tubeObject } from "./river-view.mjs";
import { waitingInWater } from "../rescue.mjs";

const W = WAVE.water;
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const colorOf = (p) => Math.abs((p.id ?? 0) * 7 + (p.skin ?? 0)) % 6;

// The water's height at x (over its rest level) and its slope there.
function swell(sim, x) {
  const list = sim.waves?.list || [];
  const h = surfaceAt(list, x),
    slope = (surfaceAt(list, x + 0.15) - surfaceAt(list, x - 0.15)) / 0.3;
  return { h, slope };
}
// A body's height (to the top of the head) and where its eyes are.
const bodyHeight = (u) => (u.fit || 1) * 1.75;

function tubeOf(w, p, g) {
  const u = g.userData;
  if (!u.tube) {
    u.tube = tubeObject(w, colorOf(p));
    g.add(u.tube);
  }
  return u.tube;
}

// The stars over a woozy bather's head: three little gold stars on a ring, made once per body.
function starsOf(w, g) {
  const u = g.userData;
  if (!u.stars) {
    const ring = new THREE.Group();
    const geo = w.geo("wave-star", () => {
      const s = new THREE.Shape();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2,
          r = i % 2 ? 0.045 : 0.11;
        if (i) s.lineTo(Math.sin(a) * r, Math.cos(a) * r);
        else s.moveTo(Math.sin(a) * r, Math.cos(a) * r);
      }
      return new THREE.ShapeGeometry(s);
    });
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23f, side: THREE.DoubleSide });
    for (let k = 0; k < 3; k++) {
      const star = new THREE.Mesh(geo, mat);
      const a = (k / 3) * Math.PI * 2;
      star.position.set(Math.cos(a) * 0.32, 0, Math.sin(a) * 0.32);
      ring.add(star);
    }
    g.add(ring);
    u.stars = ring;
  }
  return u.stars;
}

// The Wave Pool's part of a person's frame. Returns true when it has posed them (the rest of the world sync is skipped).
export function wavePose(w, sim, p, g, time, dt) {
  const u = g.userData;
  const inWater =
    p.status === "swim" ||
    (p.status === "exit" && ["water", "climb"].includes(p.exitPhase)) ||
    (p.status === "evacuating" && p.evacWater && p.x > -WAVE.halfX - 0.3) ||
    (p.status === "fleeing" && ["swim", "leap"].includes(p.fleePhase));
  const tube = u.tube || (p.hasFins ? tubeOf(w, p, g) : null);
  if (tube) tube.visible = !!p.hasFins;
  if (u.stars) u.stars.visible = false;
  // On foot with a tube: under the arm (the scene's own pose for the rest).
  if (!inWater) {
    if (tube && p.hasFins) {
      tube.position.set(0.42, (0.95 * (u.hipsY ?? 0.82)) / 0.82, 0);
      tube.rotation.set(0, 0, Math.PI / 2 - 0.15);
      tube.scale.setScalar(0.85);
    }
    // Resting on a towel on the sand: sitting, legs out towards the water.
    if (p.status === "recovering" && p.recoveryStage === "resting") {
      g.position.set(p.x, 0.1 - (u.hipsY ?? 0.45) * 0.55, p.z);
      g.rotation.set(0, p.angle || 0, 0);
      u.root.position.set(0, 0, 0);
      u.root.rotation.set(0, 0, 0);
      u.root.scale.setScalar(u.baseScale || 1);
      u.legs.forEach((l) => (l.rotation.x = -Math.PI / 2));
      u.arms.forEach((a, i) => a.rotation.set(0.5, 0, i ? -0.4 : 0.4));
      u.puppet.arms = u.puppet.legs = true;
      u.shadow.visible = true;
      try {
        u.rig?.update(dt, { speed: 0, puppet: u.puppet, classic: u });
      } catch (error) {
        console.error(error);
      }
      return true;
    }
    return false;
  }
  const motion = w.reducedMotion?.matches ? 0 : 1;
  const { h, slope } = swell(sim, p.x);
  const surface = W + h,
    floor = floorAt(p.x),
    depth = surface - floor,
    height = bodyHeight(u),
    held = waitingInWater(sim, p) || !!sim.crowdPanic?.();
  const under = p.problem === "cramp" && sim.rescue?.victim === p.id;
  const dizzy = Math.min(
    1,
    Math.max(0, ((p.dizzy || 0) - BATHE.woozy * 0.8) / (BATHE.dizzy - BATHE.woozy * 0.8)),
  );
  u.root.position.set(0, 0, 0);
  u.root.rotation.set(0, 0, 0);
  u.root.scale.setScalar(u.baseScale || 1);
  u.shadow.visible = false;
  u.soreEyes.visible = p.problem === "eyes";
  u.f.visible = false;
  u.legs.forEach((l) => (l.rotation.x = 0));
  u.puppet.arms = u.puppet.legs = false;
  const facing = p.angle ?? Math.PI / 2;
  let rig = { speed: 0, puppet: u.puppet, classic: u };
  if (p.hasFins && p.status === "swim" && !under) {
    // In a tube: sitting in it on the surface, over the crests, tipped with the slope.
    const hips = u.hipsY ?? 0.82,
      k = Math.max(0.8, Math.min(1.3, hips / 0.82)),
      seatY = 0.366 * hips - 0.03 * k;
    tube.position.set(0, seatY, -0.146 * hips);
    tube.rotation.set(0, 0, 0);
    tube.scale.setScalar(k);
    g.position.set(p.x, surface + 0.02 - seatY + Math.sin(time * 1.8 + (u.phase || 0)) * 0.02 * motion, p.z);
    g.rotation.set(0, facing + Math.sin(time * 0.3 + (u.phase || 0)) * 0.4 * motion, 0);
    g.rotateOnWorldAxis(Z_AXIS, Math.atan(slope) * 0.9 * motion);
    u.hit.position.y = seatY + 0.2;
    rig = { tube: { float: true }, puppet: u.puppet, classic: u };
  } else if (under) {
    // Knocked under: only the head and a hand above the water, sinking and bobbing, bubbles.
    g.position.set(p.x, surface - height * 0.86 + Math.sin(time * 5 + (u.phase || 0)) * 0.08 * motion, p.z);
    g.rotation.set(0.15 * Math.sin(time * 3), facing, 0.12 * Math.sin(time * 4));
    u.arms.forEach((a, i) =>
      a.rotation.set(
        0.2 + Math.sin(time * 9 + i) * 0.4 * motion,
        0,
        (i ? -1 : 1) * (2.6 + Math.sin(time * 7 + i * 2) * 0.3),
      ),
    );
    u.puppet.arms = true;
    u.hit.position.y = height * 0.8;
    if (motion && Math.random() < dt * 6)
      w.splash(p.x + (Math.random() - 0.5) * 0.4, surface + 0.02, p.z, 1, true, 0xe8ffff);
  } else if (depth < height * 0.62 || p.status === "exit") {
    // Standing or wading in the shallows: feet on the floor, the water round the legs or the waist.
    const lean = Math.atan(slope) * 0.35 * motion;
    g.position.set(p.x, floor, p.z);
    g.rotation.set(0, facing, 0);
    g.rotateOnWorldAxis(Z_AXIS, lean);
    u.hit.position.y = 0.9;
    // A bather standing still in the surf holds the arms out a little, for balance.
    if ((p.actualSpeed || 0) < 0.2 && p.status === "swim") {
      u.arms.forEach((a, i) => a.rotation.set(Math.sin(time * 1.5 + i) * 0.15, 0, (i ? -1 : 1) * 0.55));
      u.puppet.arms = true;
    }
    if (p.status === "exit" && p.exitPhase === "climb") g.position.y = Math.max(floor, -0.05);
    rig = {
      speed: held ? 0 : Math.max(0, p.status === "exit" ? 1.1 : p.actualSpeed || 0),
      puppet: u.puppet,
      classic: u,
    };
  } else {
    // Out of their depth: treading water, the head up out of it, the arms sculling, bobbing with the swell.
    const eyes = height - 0.13;
    g.position.set(p.x, surface - eyes + 0.2 + Math.sin(time * 2.2 + (u.phase || 0)) * 0.03 * motion, p.z);
    g.rotation.set(0, facing, 0);
    g.rotateOnWorldAxis(Z_AXIS, Math.atan(slope) * 0.5 * motion);
    u.arms.forEach((a, i) =>
      a.rotation.set(
        Math.sin(time * 3.2 + i * Math.PI + (u.phase || 0)) * 0.45 * motion,
        0,
        (i ? -1 : 1) * 1.25,
      ),
    );
    u.legs.forEach((l, i) => (l.rotation.x = Math.sin(time * 4 + i * Math.PI) * 0.4 * motion));
    u.puppet.arms = u.puppet.legs = true;
    u.hit.position.y = height - 0.4;
  }
  // Woozy: the stars, a sway; dizzy and staggering for the beach: an arm up for help.
  if (dizzy > 0 && !under) {
    const stars = starsOf(w, g);
    stars.visible = true;
    stars.position.set(0, height * (p.hasFins ? 0.85 : 1) + 0.12, 0);
    stars.rotation.y = time * 4;
    stars.scale.setScalar(0.7 + dizzy * 0.5);
    g.rotateOnWorldAxis(Z_AXIS, Math.sin(time * 3.4 + (u.phase || 0)) * 0.12 * dizzy * motion);
    if (p.problem === "dizzy") {
      u.arms[0].rotation.set(0, 0, 2.5 + Math.sin(time * 6) * 0.3);
      u.puppet.arms = true;
    }
  }
  try {
    u.rig?.update(dt, rig);
  } catch (error) {
    console.error(error);
  }
  return true;
}

// The tubes knocked off in the water (sim.lostTubes): bobbing on the swell, spinning, riding in to the beach.
export function syncLostTubes(w, sim, time) {
  const list = sim?.lostTubes || [];
  w.lostTubes ||= new Map();
  const seen = new Set();
  for (const t of list) {
    seen.add(t.id);
    let m = w.lostTubes.get(t.id);
    if (!m) {
      m = tubeObject(w, t.id, 0.95);
      w.scene.add(m);
      w.lostTubes.set(t.id, m);
    }
    const { h, slope } = swell(sim, t.x);
    m.position.set(t.x, W + h + 0.06, t.z);
    m.rotation.set(0, t.spin, 0);
    m.rotateOnWorldAxis(Z_AXIS, Math.atan(slope));
  }
  for (const [id, m] of w.lostTubes)
    if (!seen.has(id)) {
      w.scene.remove(m);
      w.lostTubes.delete(id);
    }
  void time;
}
void depthAt;
