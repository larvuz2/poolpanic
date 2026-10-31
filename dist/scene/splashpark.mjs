// Splash Park dressed for real (30 October 2026: the creator asked for "the same Harbourside treatment for the next venue! same
// details, amazing lighting, new props!… always considering performance and triangle count", Splash Park only: the Sunset Lagoon
// and the Grand Gala Arena share its floor plan and keep their own looks).
//
// Every asset is made by scripts in tools/venues/splash/ (Blender 4.5: the hotel, the pool's basin, the trees, the props; their
// textures with numpy, their signs with Pillow); the shared tools/venues/common/export_three.py merges them into a few meshes and
// common/pack.sh packs them into dist/assets/splash/: one quantized GLB (one mesh per material class: the colours in the vertex
// colours, the baked ambient occlusion in their alpha), the tile sets, the sign and cut-out atlases (palm fronds and flowers,
// alpha-tested, their shadows dappled), the deck's paint and the deck's occlusion. The loading, the shader and the painted
// horizon are shared with the Kids Pool (scene/dressed.mjs).
//
// What the game moves stays its own: the water, the lane ropes and pennants (pool.mjs), the trampoline's bed, the life rings, the
// fins (the model's Fins_1..3), the changing rooms' doors in the hotel's wall (the model's Door_A/Door_B, swung by the game's door sync), the medical kit,
// the dog treats, the fish net, the torch, the fuse box, the mop, and every hit box and label (props.mjs, with their bodies left
// out where the model has its own).
//
// It loads behind the menu after the Harbourside (`loadSplashPark`, app.mjs); until it has, and with ?nomodels, Splash Park is the
// classic one (scene/resort.mjs). Its hours are the game's (day, sunset, night: the shift's lighting); `SPLASH_LOOKS` gives each its
// own light here (scene.mjs `withDome`). The lamps are no lights to pay for: the lanterns, the festoons and the windows glow, and
// their light falls on the deck and the walls in the venue's own shader (`uLamps`); by day slow cloud shadows drift over the park.
import { buildPool } from "./pool.mjs";
import {
  station,
  finRack,
  rescueStations,
  sanitationCorner,
  fishNetHook,
  flashlightHolder,
  fuseBox,
  medkitCabinet,
  trampolineTower,
} from "./props.mjs";
import { kioskTreats } from "./resort.mjs";
import { dressedVenue, dressModel, ringsFromModel } from "./dressed.mjs";

// Each hour's light at Splash Park, over the game's own (scene.mjs LIGHTING.day/sunset/night): a strong warm sun by day and soft
// blue shade; a long low gold at sunset with the lamps coming on; a cool moon at night with every lamp lit. `lamps` lights the
// lanterns (0 by day), `clouds` the drifting shade.
export const SPLASH_LOOKS = {
  day: {
    exposure: 0.98,
    hemi: [0xd2ecff, 0xb8936a, 0.72],
    sun: [0xfff0d6, 3.25, [-21, 27, 13]],
    fill: [0xa9d8ea, 0.32, [14, 14, -16]],
    env: 0.55,
    envColors: ["#bfe3f5", "#eef1e6", "#c9a57d"],
    water: {
      shallow: [0.3, 0.84, 0.86],
      deep: [0.04, 0.5, 0.66],
      sky: [0.74, 0.92, 0.98],
      glint: [1, 0.96, 0.86],
      clarity: 0.45,
    },
    lamps: 0,
    clouds: 0.26,
    horizon: 0xf2f5f7,
  },
  sunset: {
    exposure: 1.0,
    hemi: [0xffcfae, 0x6e5560, 0.7],
    sun: [0xffa860, 3.4, [-27, 10.5, 15]],
    fill: [0x8f86d8, 0.42, [14, 12, -18]],
    env: 0.55,
    envColors: ["#f7b995", "#f3d7b8", "#8f6a58"],
    water: {
      shallow: [0.28, 0.76, 0.8],
      deep: [0.05, 0.42, 0.6],
      sky: [1, 0.72, 0.55],
      glint: [1, 0.78, 0.5],
      glow: 0.3,
      clarity: 0.35,
    },
    lamps: 0.55,
    clouds: 0,
    horizon: 0xffbf98,
  },
  night: {
    exposure: 1.06,
    hemi: [0x5f70b2, 0x2c283a, 0.62],
    sun: [0xa9bcff, 0.95, [-12, 24, 16]],
    fill: [0x4d6fc0, 0.3, [14, 14, -16]],
    env: 0.32,
    envColors: ["#27335a", "#3b4a73", "#2b2531"],
    water: {
      shallow: [0.16, 0.7, 0.86],
      deep: [0.03, 0.36, 0.62],
      sky: [0.24, 0.32, 0.56],
      glint: [0.8, 0.88, 1],
      glow: 1,
      clarity: 0.3,
    },
    lamps: 1,
    clouds: 0,
    horizon: 0x26314e,
  },
};

// The model (dist/assets/splash/) and its horizon (31 October 2026, the creator: "behind the trees, there's nothing… it looks like
// we're on a platform in the middle of the sky"): a painted Mediterranean panorama (olive terraces, cypresses and umbrella pines, a
// white hill village with terracotta roofs, blue mountains in the haze; tools/venues/splash/horizon.sh) four times round a ring
// 62 m out (inside the fog's reach, so the ground before it never fades to a band of haze), every other copy mirrored.
const SPLASH = dressedVenue({
  dir: "splash",
  file: "splash",
  label: "Splash Park",
  horizon: { radius: 62, copies: 4, aspect: 615 / 4096, base: -2.6, turn: 0.6 },
});
export const splashReady = SPLASH.ready;
export const splashModel = SPLASH.model;
export const primeSplashPark = SPLASH.prime;
export const splashPictures = SPLASH.pictures;
// Fetch the model and its pictures once (about 8 MB); resolves to null when they cannot be had (the classic Splash Park stays).
export const loadSplashPark = (base) => SPLASH.load(base);

// Splash Park, the model and what the game needs round it. `w` is the PoolWorld being built.
export function buildSplashPark(w, venue, lighting) {
  const S = splashModel(),
    info = S.info,
    look = { ...SPLASH_LOOKS.day, ...(SPLASH_LOOKS[lighting] || {}) };
  // the water, the lane ropes and pennants and the lanes' pick volumes; the basin, blocks, ladders and posts are the model's
  buildPool(w, venue, w.look.water, {
    basin: false,
    blocks: false,
    ladderAt: [],
    posts: false,
    pennants: [0xe0513f, 0xfff4dc, 0x2f9aa0],
    ropes: [0xfff4dc, 0x2f7fc4, 0xe0513f],
  });
  w.water.material.uniforms.uSun.value.set(...(w.look.sun?.[2] || [-16, 30, 6])).normalize();
  const root = dressModel(w, S, { look, name: "splashpark", deckSet: "travertine" });
  liveParts(w, venue, root, info);
  // (no lawn: the model's ground under the trees runs out to the fog)
}

// What the game moves or asks for: the stations' hit boxes and labels, the rings, the fins, the doors, the trampoline's bed, the
// medical kit, the treats on the snack bar's counter.
function liveParts(w, venue, root, info) {
  const S = venue.stations,
    F = venue.fixtures;
  const fins = [1, 2, 3].map((i) => root.getObjectByName("Fins_" + i)).filter(Boolean);
  // (the model's rack and pairs; a model without them has the classic rack)
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
  medkitCabinet(w, F.medkit, { cabinet: false });
  kioskTreats(w, F.treats);
  if (venue.trampoline) trampolineTower(w, venue.trampoline, { structure: false });
  for (const [name, side] of [
    ["Door_A", -1],
    ["Door_B", 1],
  ]) {
    const hinge = root.getObjectByName(name);
    if (hinge) w.lockerDoors.push({ side, hinge });
  }
}
