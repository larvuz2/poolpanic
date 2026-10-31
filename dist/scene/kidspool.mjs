// The Kids Pool dressed for real (31 October 2026, the creator: "Now do the same treatment for the next venue!"): a sunny seaside
// playground round a paddling pool. Soft poured-rubber deck in sunny cream with inlaid shapes (a sun, stepping-stone circles, a wave,
// hopscotch) and a pink band round the pool; an aqua mosaic basin with a whale, starfish and fish laid in its floor; a white picket
// fence with candy caps and a flowering hedge; the gate's rainbow leaves under the KIDS POOL arch; a row of pastel beach huts outside
// the back fence either side of a boardwalk; a slide turret, a lifeguard chair, a toy chest, an ice-cream cart, shade sails and
// bunting; trees round it and a painted seaside town on the horizon (a harbour, a lighthouse, a Ferris wheel on the pier).
//
// Every asset is made by tools/venues/kids/ with the shared venue kit (tools/venues/common/); scene/dressed.mjs puts the model in the
// world. What the game moves stays its own: the water, the floating toys and the gate's balloons (scene/kids.mjs), the life rings,
// the fins (the model's Fins_1..3), the gate's leaves (the model's Door_A/Door_B, swung by the game's door sync), the dog treats on
// the ice-cream cart, the fish net, the torch, the fuse box, the mop, and every hit box and label.
//
// It loads behind the menu after Splash Park (`loadKidsPool`, app.mjs); until it has, and with ?nomodels, the Kids Pool is the
// classic one (scene/kids.mjs). The Kids Pool is always played in the day (its style, week.mjs); `KIDS_LOOKS` gives it its own
// morning light (scene.mjs `withDome`).
import { buildPool } from "./pool.mjs";
import {
  station,
  finRack,
  rescueStations,
  sanitationCorner,
  fishNetHook,
  flashlightHolder,
  fuseBox,
} from "./props.mjs";
import { kioskTreats } from "./resort.mjs";
import { balloons, toys } from "./kids.mjs";
import { dressedVenue, dressModel, ringsFromModel } from "./dressed.mjs";

// A bright seaside morning: a warm high sun with crisp shadows, a clear blue bounce, a slow drift of cloud shade, the water clear.
export const KIDS_LOOKS = {
  day: {
    exposure: 1.0,
    hemi: [0xd6efff, 0xc9a77e, 0.78],
    sun: [0xfff3dc, 3.2, [-19, 29, 11]],
    fill: [0xb5e1f2, 0.34, [14, 14, -16]],
    env: 0.58,
    envColors: ["#c4e9fb", "#f3f1e6", "#d8b48a"],
    water: {
      shallow: [0.36, 0.88, 0.9],
      deep: [0.08, 0.6, 0.76],
      sky: [0.76, 0.93, 0.99],
      glint: [1, 0.97, 0.88],
      clarity: 0.55,
    },
    lamps: 0,
    clouds: 0.22,
    horizon: 0xf4f6f6,
  },
};

const KIDS = dressedVenue({
  dir: "kids",
  file: "kids",
  label: "The Kids Pool",
  horizon: { radius: 60, copies: 4, aspect: 619 / 4096, base: -0.6, turn: -0.4 },
});
export const kidsReady = KIDS.ready;
export const kidsModel = KIDS.model;
export const primeKidsPool = KIDS.prime;
export const kidsPictures = KIDS.pictures;
// Fetch the model and its pictures once (about 6 MB); resolves to null when they cannot be had (the classic Kids Pool stays).
export const loadKidsPool = (base) => KIDS.load(base);

// The Kids Pool, the model and what the game needs round it. `w` is the PoolWorld being built.
export function buildKidsPool(w, venue) {
  const S = kidsModel(),
    info = S.info,
    look = KIDS_LOOKS.day;
  // the water and the pool's pick volumes; no lane lines, ropes, pennants or blocks; the basin and ladders are the model's
  buildPool(w, venue, w.look.water, {
    basin: false,
    blocks: false,
    ladderAt: [],
    line: null,
    ropes: null,
    pennants: null,
  });
  w.water.material.uniforms.uSun.value.set(...(w.look.sun?.[2] || [-16, 30, 6])).normalize();
  const root = dressModel(w, S, { look, name: "kidspool", deckSet: "rubber" });
  liveParts(w, venue, root, info);
  // (the game's own: the toys floating in the pool, the balloons on the gate's posts)
  toys({ w, venue });
  for (const s of [-1, 1])
    balloons(w, s * (venue.arrival.doorX * 2 + 0.02 + 0.12), venue.room.minZ + 0.25, s);
}

// What the game moves or asks for: the stations' hit boxes and labels, the rings, the fins, the gate's leaves, the treats on the
// ice-cream cart's ledge.
function liveParts(w, venue, root, info) {
  const S = venue.stations,
    F = venue.fixtures;
  const fins = [1, 2, 3].map((i) => root.getObjectByName("Fins_" + i)).filter(Boolean);
  finRack(w, S.fins, { rack: fins.length !== 3 });
  if (fins.length === 3) w.finPairs = fins;
  station(w, "chlorine", S.chlorine, 0, "", -Math.PI / 2, { body: false });
  station(w, "relief", S.relief, 0, "", -Math.PI / 2, { body: false });
  rescueStations(w, venue, { mounts: false });
  w.ringAt = ringsFromModel(venue, info);
  sanitationCorner(w, venue, { board: false, bin: false });
  fishNetHook(w, F.fishNet, { board: false });
  const torch = info.anchors?.Flashlight?.[0];
  flashlightHolder(w, F.flashlight, { post: false, at: torch && { x: torch[0], y: torch[1], z: torch[2] } });
  fuseBox(w, F.fuseBox);
  kioskTreats(w, F.treats);
  for (const [name, side] of [
    ["Door_A", -1],
    ["Door_B", 1],
  ]) {
    const hinge = root.getObjectByName(name);
    if (hinge) w.lockerDoors.push({ side, hinge });
  }
}
