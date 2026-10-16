// The Lazy River on screen (17 October 2026): the guests and their tubes. A guest given a tube carries it under one arm, sits
// into it at the boarding dock (the TubeBoard clip at the simulation's time), lies back in it down the river (TubeFloat), turning
// slowly as it drifts and bobbing on the water, is gone from sight round the loop (`away`), and on the second pass climbs out at
// the exit dock (TubeBoard backwards) and carries it to the tube return. A guest who flipped off (a "cramp") treads water with the
// tube floating beside them. Tubes on the rack, on the deck and in the coach's hands are the same rubber rings, in six colours.
// Only the picture moves here: spin and bob never touch the simulation.
import { THREE } from "./kit.mjs";
import { RIDE } from "../river-ride.mjs";
import { CLIPS } from "./swimmer-models.mjs";

export const TUBE_COLORS = [
  [0xff7a2f, 0xffd23f],
  [0x2fa8ff, 0xffffff],
  [0xff4f8b, 0xffe0ef],
  [0x3fcf6a, 0xfff2a8],
  [0xffd23f, 0x2f6bff],
  [0xa66bff, 0xffffff],
];
const WATER = -0.25;
const BOARD_SECONDS = 26 / 24; // TubeBoard's length (tools/blender/character_clips.py)

// A tube: a fat rubber ring in two colours, striped round, lying flat (its hole up), `size` 1 for a grown-up's.
export function tubeObject(w, color = 0, size = 1) {
  const [a, b] = TUBE_COLORS[((color % TUBE_COLORS.length) + TUBE_COLORS.length) % TUBE_COLORS.length];
  const key = "tube:" + a + ":" + b;
  const geo = w.geo(key, () => {
    const g = new THREE.TorusGeometry(0.4, 0.17, 12, 28);
    const pos = g.attributes.position,
      colors = new Float32Array(pos.count * 3),
      ca = new THREE.Color(a),
      cb = new THREE.Color(b);
    for (let i = 0; i < pos.count; i++) {
      const angle = Math.atan2(pos.getY(i), pos.getX(i)),
        c = Math.floor(((angle + Math.PI) / (Math.PI * 2)) * 8) % 2 ? cb : ca;
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.rotateX(Math.PI / 2);
    return g;
  });
  const material =
    w.materials.get("tube-rubber") || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32 });
  w.materials.set("tube-rubber", material);
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  m.receiveShadow = true;
  const g = new THREE.Group();
  g.add(m);
  g.scale.setScalar(size);
  return g;
}

// Which tube a guest has: the same colour every time for the same guest.
const colorOf = (p) => Math.abs((p.id ?? 0) * 7 + (p.skin ?? 0)) % TUBE_COLORS.length;

// What the rig plays for a guest at the river: {float: true} lying back in the tube, {board: seconds} sitting into it (or climbing
// out: the same clip backwards), or null (walking, standing: the usual clips).
export function tubeState(p) {
  if (p.status === "enter" && p.boarding > 0) return { board: (1 - p.boarding / RIDE.board) * BOARD_SECONDS };
  if (p.status === "exit" && p.exitPhase === "climb" && p.hasFins && !p.rescueRecover)
    return { board: (1 - (p.exitProgress || 0)) * BOARD_SECONDS };
  if (inTube(p)) return { float: true };
  return null;
}
// Floating in a tube (on the river, paddling to a dock or a bank in it).
function inTube(p) {
  if (!p.hasFins || p.rescueRecover || p.problem === "cramp") return false;
  if (p.status === "swim") return !p.away;
  if (p.status === "exit") return p.exitPhase === "water";
  if (p.status === "evacuating") return !!p.evacWater;
  return false;
}

// Where a body's tube sits, in the body's own frame (it faces +z): round the hips as TubeFloat has them (52 cm down and 12 back on
// the Coach, scaled by the hips' height), and how big it is for that body.
function seat(u) {
  const hips = u.hipsY ?? 0.82,
    k = Math.max(0.8, Math.min(1.3, hips / 0.82));
  return { y: 0.366 * hips - 0.03 * k, z: -0.146 * hips, size: k, float: 0.366 * hips };
}

// The guest's tube object (made once, kept on the body's group), placed and shown for what the guest is doing.
function tubeOf(w, p, g) {
  const u = g.userData;
  if (!u.tube) {
    u.tube = tubeObject(w, colorOf(p));
    g.add(u.tube);
  }
  return u.tube;
}

// The river's part of a guest's frame. Returns true when it has posed the guest (the rest of the world sync is skipped).
export function riverPose(w, sim, p, g, time, dt) {
  const u = g.userData,
    tube = tubeOf(w, p, g),
    calm = w.reducedMotion?.matches;
  u.f.visible = false; // (no fins on the feet here: a tube)
  g.visible = !(p.status === "swim" && p.away);
  if (!g.visible) return true;
  const state = tubeState(p),
    s = seat(u);
  tube.visible = !!p.hasFins;
  if (!state) {
    // On foot with a tube: under the arm, on edge, at the hip; treading water beside it after a wipeout.
    if (p.hasFins && (p.problem === "cramp" || p.rescueRecover) && ["swim", "exit"].includes(p.status)) {
      tube.position.set(0.85, WATER - g.position.y + 0.05, 0.3);
      tube.rotation.set(0, time * 0.4, 0);
    } else {
      tube.position.set(0.42 * s.size, (0.95 * (u.hipsY ?? 0.82)) / 0.82, 0);
      tube.rotation.set(0, 0, Math.PI / 2 - 0.15);
      tube.scale.setScalar(0.85 * s.size);
    }
    return false;
  }
  // In the tube: the body seated in it, the tube on the water, turning with the guest's spin and bobbing.
  u.spinAngle = (u.spinAngle || 0) + (state.float && p.status === "swim" ? (p.spin || 0) * dt : 0);
  const bob = calm ? 0 : Math.sin(time * 1.8 + (u.phase || 0)) * 0.03;
  const roll = calm ? 0 : Math.sin(time * 1.3 + (u.phase || 0) * 2) * 0.05;
  tube.position.set(0, s.y, s.z);
  tube.rotation.set(0, 0, 0);
  tube.scale.setScalar(s.size);
  let floorY = WATER + 0.02 - s.y + bob;
  if (state.board !== undefined) {
    // Sitting in (or climbing out): from the dock's planks down into the water as the clip goes.
    const t = Math.min(1, state.board / BOARD_SECONDS),
      e = t * t * (3 - 2 * t);
    floorY = 0.04 * (1 - e) + floorY * e;
  }
  g.position.set(p.x, floorY, p.z);
  g.rotation.set(roll * 0.5, (p.angle || 0) + u.spinAngle, roll);
  u.root.rotation.set(0, 0, 0);
  u.root.position.set(0, 0, 0);
  u.root.scale.setScalar(u.baseScale || 1);
  u.shadow.visible = false;
  u.hit.position.y = s.float + 0.2;
  u.soreEyes.visible = p.problem === "eyes";
  if (!u.rig) {
    // The classic swimmer: leaning back, legs out over the front, arms over the sides.
    u.root.rotation.x = -0.45;
    u.root.position.y = -0.1;
    u.legs.forEach((l) => (l.rotation.x = -1.35));
    u.arms.forEach((a, i) => a.rotation.set(-0.3, 0, (i ? -1 : 1) * 1.1));
    u.puppet.arms = u.puppet.legs = true;
    return true;
  }
  u.puppet.arms = u.puppet.legs = false;
  // A guest in trouble in the tube (sore eyes, a tummy ache) waves an arm for the coach; the clip has the rest.
  if (p.problem === "eyes" || p.stomachWarning) {
    u.arms[0].rotation.set(0, 0, 2.6 + Math.sin(time * 6) * 0.3);
    u.puppet.arms = true;
  }
  try {
    u.rig.update(dt, { tube: state, puppet: u.puppet, classic: u });
  } catch (error) {
    console.error(error);
  }
  return true;
}

// The clips a body needs for the river (swimmer-models.mjs CLIPS keys).
export const TUBE_CLIPS = [CLIPS.tubeFloat, CLIPS.tubeBoard];
