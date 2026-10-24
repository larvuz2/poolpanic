// The massage table on screen (incidents/massage.mjs): the table itself in the venues that have one, the guest on it (walking
// over, climbing on, lying face down, fidgeting as their patience runs out, getting off), and what a coach at the table does when
// they have no model (the classic figure's arms working the back in turn). The coach's model plays its Massage clip
// (coach-model.mjs); a coach too short for the table stands on a little wooden step (crew.mjs `massageStep`), drawn in scene.mjs.
import { THREE } from "./kit.mjs";
import { TABLE, tablesOf, sessionOf } from "../incidents/massage.mjs";

const LEATHER = 0x2f7f7a,
  SEAM = 0x24615d,
  TOWEL = 0xf7f1e4,
  STRIPE = 0xe9b44c,
  WOOD = 0xc99b62,
  RUG = 0xd8c3a0;
const smooth = (t) => t * t * (3 - 2 * t);
// How high the guest's group sits for the back to come to the height of the coaches' hands (about 0.8 m: the clip, made so).
export const LIE_Y = 0.36;

// The table: a padded top in teal leatherette, a white towel with a mustard stripe over the middle, a rolled towel at the foot, a face
// cradle at the head end, four turned wooden legs braced near the floor, on a rug. 2 m long, 0.6 m wide, its top at 0.58 m. The
// group's +z is the head end (the venue's `angle`).
// (Every table the venue has: most have one, the Jumping Pool's massage corner two side by side.)
export function buildMassageTable(w, venue) {
  const tables = tablesOf(venue);
  return tables.length ? tables.map((t, k) => buildTable(w, t, k))[0] : null;
}
function buildTable(w, t, k) {
  const g = w.group(t.x, 0, t.z, w.scene, t.angle || 0),
    top = TABLE.top,
    half = TABLE.half,
    width = TABLE.width * 2;
  w.box(width + 0.9, 0.012, half * 2 + 0.9, RUG, 0, 0.006, 0, 0.004, g);
  // The legs, tapered, and the stretchers between them.
  for (const x of [-0.22, 0.22])
    for (const z of [-0.78, 0.78]) {
      w.cyl(0.035, 0.026, top - 0.08, WOOD, x, (top - 0.08) / 2, z, g, 8);
      w.cyl(0.04, 0.04, 0.04, 0x8a6a42, x, 0.02, z, g, 8);
    }
  for (const x of [-0.22, 0.22]) w.box(0.04, 0.04, 1.56, WOOD, x, 0.16, 0, 0.01, g);
  for (const z of [-0.78, 0.78]) w.box(0.44, 0.035, 0.035, WOOD, 0, 0.16, z, 0.01, g);
  // The frame under the cushion, and the cushion.
  w.box(width - 0.04, 0.05, half * 2 - 0.06, WOOD, 0, top - 0.11, 0, 0.015, g);
  w.box(width, 0.1, half * 2, LEATHER, 0, top - 0.05, 0, 0.045, g);
  w.box(width + 0.004, 0.012, half * 2 + 0.004, SEAM, 0, top - 0.085, 0, 0.004, g);
  // The towel over the middle, hanging over both long sides, with its stripe.
  w.box(width + 0.04, 0.012, 0.9, TOWEL, 0, top + 0.006, -0.1, 0.004, g);
  for (const s of [-1, 1]) {
    w.box(0.012, 0.16, 0.9, TOWEL, s * (width / 2 + 0.02), top - 0.07, -0.1, 0.004, g);
    w.box(0.014, 0.03, 0.9, STRIPE, s * (width / 2 + 0.022), top - 0.12, -0.1, 0.004, g);
  }
  // A rolled towel at the foot, under the ankles.
  const roll = w.cyl(0.07, 0.07, width - 0.08, TOWEL, 0, top + 0.06, -half + 0.22, g, 14);
  roll.rotation.z = Math.PI / 2;
  // The face cradle at the head end: a padded horseshoe on two arms.
  const cradle = w.torus(0.12, 0.045, LEATHER, g, Math.PI * 1.5, 8, 20);
  cradle.rotation.set(-Math.PI / 2, 0, Math.PI * 0.25 + Math.PI / 2);
  cradle.position.set(0, top - 0.03, half + 0.13);
  for (const x of [-0.1, 0.1]) w.box(0.03, 0.03, 0.2, 0x9aa3a6, x, top - 0.09, half + 0.04, 0.01, g);
  // A bottle of oil on the rug by the foot.
  w.cyl(0.035, 0.04, 0.16, 0xd38a2c, width / 2 + 0.22, 0.09, -half + 0.1, g, 10);
  w.cyl(0.015, 0.015, 0.05, 0x3c3c3c, width / 2 + 0.22, 0.195, -half + 0.1, g, 8);
  w.labels.push({
    text: "E · MASSAGE",
    x: t.x,
    y: 1.7,
    z: t.z,
    when: (s) => (s.massages || []).some((m) => m.table === k && m.stage === "lying" && !m.helpers?.length),
  });
  return g;
}

// The guest's pose while the massage is theirs (sim status "massage"), after the usual pose (scene.mjs syncSwimmer).
export function poseMassageGuest(w, sim, p, g, time) {
  const u = g.userData,
    motion = w.reducedMotion?.matches ? 0 : 1,
    fit = u.fit || 1;
  if (p.massage === "walk") return; // (walking over: the walk the deck already has)
  const m = sessionOf(sim, p),
    on = p.massage === "lying" ? 1 : smooth(Math.max(0, Math.min(1, p.climb ?? 0))),
    working = !!m?.helpers?.length,
    edgy = !!p.massageEdgy;
  u.puppet.arms = u.puppet.legs = true;
  g.position.y = LIE_Y * on;
  // Face down along the table, the head at its head end (the group's +z, which the simulation turns to the table's angle).
  let lift = 0;
  if (edgy) lift = 0.16 + 0.06 * Math.sin(time * 3.1 + u.phase) * motion; // head and shoulders up, looking for someone
  u.root.rotation.set((Math.PI / 2 - lift) * on, 0, 0);
  u.root.position.set(0, 0.27 * on, -0.65 * fit * on);
  // Pressed into the table with each press of the hands on the back (four a second, the clip's beat).
  if (working && on === 1) u.root.position.y -= Math.abs(Math.sin(time * Math.PI * 4)) * 0.012 * motion;
  // Arms along the sides; fidgeting: pounding the table ahead of the head. Legs straight; fidgeting: drumming the feet.
  u.arms.forEach((a, i) =>
    edgy
      ? a.rotation.set(
          -2.7 + Math.max(0, Math.sin(time * 11 + i * Math.PI)) * 0.45 * motion,
          0,
          i ? -0.25 : 0.25,
        )
      : a.rotation.set(-0.05, 0, i ? -0.12 : 0.12),
  );
  u.legs.forEach(
    (l, i) =>
      (l.rotation.x = edgy ? 0.2 + Math.max(0, Math.sin(time * 10 + i * Math.PI)) * 0.55 * motion : 0.04),
  );
  u.shadow.visible = on < 0.5;
  u.hit.position.y = 0.9 * (1 - on) + 0.7 * on;
}

// A classic coach (no model) at the table: bent over it, the arms going up and down in turn.
export function classicMassagePose(cu, time) {
  cu.root.rotation.x = 0.32;
  cu.arms.forEach((a, i) => a.rotation.set(-1.25 + Math.sin(time * Math.PI * 4 + i * Math.PI) * 0.35, 0, 0));
}

// The step a short coach stands on at the table (scene.mjs makes it once per coach group).
export function stepObject(w, height) {
  const g = new THREE.Group();
  w.box(0.5, height, 0.34, WOOD, 0, -height / 2, 0, 0.02, g);
  w.box(0.52, 0.012, 0.36, 0x7b5b36, 0, -0.006, 0, 0.004, g);
  return g;
}
