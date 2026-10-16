// Senior Aqua Fit on screen (16 October 2026): the seniors' wheelchairs and what a senior in one is doing. A senior who came in a
// wheelchair (`p.wheelchair`, sim.mjs) sits in it at the door, rolling it with both hands, and while waiting; given a lane they get
// up out of it (the StandUp clip at the simulation's time) and it stays parked where they were (`p.chair`) until they come back,
// sit down (StandUp played backwards) and roll out. The chair is a Tripo model (props/wheelchair.glb) with a stand-in until it
// loads; it is the scene's alone: the simulation never sees it, only the place it was left.
import { THREE } from "./kit.mjs";
import { propModel } from "./prop-models.mjs";
import { SENIOR } from "../sim.mjs";

// The chair's file faces +x; a seated senior faces +z. `back` is how far behind the person's feet the chair's middle sits (the
// Sit clip has the hips 17 cm back of where they stand, and the seat reaches forward of the hips).
export const CHAIR = { height: 0.94, turn: -Math.PI / 2, back: 0.16 };

// What the rig plays for a senior: {seat: "sit" | "push" | null, stand: seconds into StandUp | null}, from the simulation alone.
// Sitting down is StandUp backwards, so its time counts down.
export function seatState(p, speed = 0) {
  if (p.type !== "senior" || !p.wheelchair) return { seat: null, stand: null };
  if (p.standUp > 0) return { seat: null, stand: SENIOR.stand - p.standUp };
  if (p.sitDown > 0) return { seat: null, stand: p.sitDown };
  if (p.chairParked) return { seat: null, stand: null };
  if (!["arriving", "queue", "exit"].includes(p.status)) return { seat: null, stand: null };
  return { seat: speed > 0.25 ? "push" : "sit", stand: null };
}
export const seated = (p) => seatState(p).seat !== null;

function standIn(g) {
  // Two big wheels, two small ones, a seat and a back, in the model's colours: until the model is there.
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2f33, roughness: 0.6 });
  const teal = new THREE.MeshStandardMaterial({ color: 0x2f9e8f, roughness: 0.5 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xc8ced3, metalness: 0.8, roughness: 0.3 });
  for (const x of [-0.31, 0.31]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 8, 24), dark);
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(x, 0.3, -0.08);
    g.add(wheel);
    const caster = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12), dark);
    caster.rotation.z = Math.PI / 2;
    caster.position.set(x * 0.8, 0.06, 0.32);
    g.add(caster);
  }
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.46), teal);
  seat.position.set(0, 0.49, 0.02);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.05), teal);
  back.position.set(0, 0.74, -0.22);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.03, 0.62), steel);
  bar.position.set(0, 0.42, 0.04);
  g.add(seat, back, bar);
}

function makeChair(w) {
  const outer = new THREE.Group();
  const model = propModel("wheelchair", { height: CHAIR.height }, (g) => {
    g.rotation.y = -CHAIR.turn; // (the stand-in is built facing +z already; undo the turn the model needs)
    standIn(g);
  });
  model.rotation.y = CHAIR.turn;
  outer.add(model);
  outer.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  w.scene.add(outer);
  return outer;
}

// Every frame: a chair for each senior who has one, under them or where they left it; gone with them.
export function syncWheelchairs(w, sim) {
  const chairs = (w.wheelchairs ||= new Map());
  const live = new Set();
  for (const p of sim.people) {
    if (p.type !== "senior" || !p.wheelchair || p.status === "gone") continue;
    live.add(p.id);
    let chair = chairs.get(p.id);
    if (!chair) chairs.set(p.id, (chair = makeChair(w)));
    const at = p.chairParked ? p.chair : p,
      angle = (p.chairParked ? p.chair.angle : p.angle) || 0;
    chair.position.set(at.x - Math.sin(angle) * CHAIR.back, 0, at.z - Math.cos(angle) * CHAIR.back);
    chair.rotation.y = angle;
    // In the water there is no chair to see: it waits on the deck (parked). A senior being rescued or evacuated has left it.
    chair.visible = p.chairParked || seated(p) || p.sitDown > 0;
  }
  for (const [id, chair] of chairs)
    if (!live.has(id)) {
      chair.removeFromParent();
      chairs.delete(id);
    }
}
export function clearWheelchairs(w) {
  for (const chair of w.wheelchairs?.values() || []) chair.removeFromParent();
  w.wheelchairs?.clear();
}
