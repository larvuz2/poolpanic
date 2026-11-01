// The Wave Pool dressed for real (1 November 2026, the creator: "Impress me with props and placements… extra focus on environment
// design… when I'm inside this venue, I can see, 'Wow, this guy's really putting in the work. Look at these details here, those
// details there. Everything looks aesthetic and good'… and of course lighting"): a 1960s surf park in the late-afternoon sun.
//
// The wave house is its landmark: a streamline-moderne surf temple of cream stucco, the five wave chambers in arches of Malibu tile
// (coral keystones with their numbers, steel grilles, dark tunnels, porthole lamps, DANGER: WAVE CHAMBER), the terrace over them
// with chrome speed lines and its rail (the judges' booth: three score cards, 10, 9.5 and 2; a lifeguard's high chair under a red
// umbrella; spotlights; potted palms), the upper storey with rounded corners and speed stripes round them, the mural painted on
// fal (a smiling sun, a surfer and an octopus in sunglasses riding the wave), two lighthouse turrets, the WAVE POOL sign on its
// truss with a neon wave over it, flags; the wave machine's door, its pipes and valves in the service yard. Round the pool: a deck
// of coquina pavers with Malibu borders and two sun medallions, the beach on the game's own profile (wet sand at the water, the
// wrack line), a giant octopus in tile on the deep floor, breeze-block screens, the surf gate; the lifeguard tower, the tube hut
// (the tubes on a ring-toss peg), the Surf Shack (shave ice, a chalk menu), the stations; and the stories in the corners: towels
// with their owners' things, a sandcastle of the wave house with a crab in sunglasses, the surf report (today: waves; tomorrow:
// also waves), YOU MUST BE THIS TALL TO SURF on a shark, SPF 9000, the Hall of Wipeouts, a lost & found of single flip-flops,
// showers, a surf rack, a bench with a radio; outside, palms, a camper van with boards on its roof, beach cruisers, a ticket
// kiosk, a hammock and a volleyball court, and a painted surf coast under green volcanic peaks.
//
// Every asset is made by tools/venues/wave/ with the shared venue kit (tools/venues/common/), every place taken from the game's own
// plan (tools/venues/wave/plan.mjs); scene/dressed.mjs puts the model in. What moves stays the game's (scene/wave.mjs), placed at
// the model's anchors (`Anchor_<Name>`, the exporter's info.anchors): the water and its waves, the water surging in the chambers,
// the LED board's words, the beacons, the roof sign's chasing bulbs, the flags, the pennants from the tower, the tubes on their
// peg, the lost tubes riding in, the spray where a wave breaks; the gate's leaves are the model's (`Door_A`/`Door_B`), swung by the
// game. It loads behind the menu after the Mountain Hot Springs (`loadWaveClub`, app.mjs); until it has, and with ?nomodels, the
// Wave Pool is the classic one.
import {
  station,
  rescueStations,
  sanitationCorner,
  fishNetHook,
  flashlightHolder,
  fuseBox,
} from "./props.mjs";
import { kioskTreats } from "./resort.mjs";
import { dressedVenue, dressModel, ringsFromModel } from "./dressed.mjs";
import {
  waveContext,
  water,
  surges,
  ledBoard,
  beacon,
  signBulbs,
  flags,
  pennants,
  tubeStack,
  pickVolume,
  waveLife,
} from "./wave.mjs";

// Its light (over LIGHTING.wave, scene.mjs `withDome`): the late afternoon, a low warm sun from behind the beach raking across the
// deck and lighting the wave house's face gold, long shadows toward it, a cool sky in the shade, slow clouds drifting over.
export const WAVE_LOOKS = {
  wave: {
    exposure: 0.93,
    hemi: [0xd6ecff, 0xc9a27a, 0.7],
    sun: [0xffd6a0, 3.05, [-26, 16.5, -11]],
    fill: [0x9fd0ee, 0.42, [16, 13, 12]],
    env: 0.6,
    envColors: ["#bfe4f6", "#f6ead2", "#d2a676"],
    water: {
      shallow: [0.36, 0.9, 0.84],
      deep: [0.03, 0.44, 0.68],
      sky: [0.8, 0.9, 0.96],
      glint: [1, 0.9, 0.72],
      glow: 0,
      clarity: 0.42,
    },
    lamps: 0,
    clouds: 0.22,
    horizon: 0xfff1dc,
  },
};

// The model (dist/assets/wave-club/) and its horizon: a painted surf coast (palm groves on the dunes, a little town of pastel
// bungalows, a chapel and a water tower, green volcanic peaks with a waterfall; tools/venues/wave/horizon.sh) on an arc 60 m out
// round three sides: the near side is the game's own sea, lighthouse and boats (scene/sky.mjs `surf`).
const WAVE_CLUB = dressedVenue({
  dir: "wave-club",
  file: "wave",
  label: "The Wave Pool",
  horizon: { radius: 60, copies: 3, aspect: 872 / 4096, base: -2.5, arc: [5.68, 4.36] },
});
export const waveClubReady = WAVE_CLUB.ready;
export const waveClubModel = WAVE_CLUB.model;
export const primeWaveClub = WAVE_CLUB.prime;
export const waveClubPictures = WAVE_CLUB.pictures;
// Fetch the model and its pictures once (a few MB); resolves to null when they cannot be had (the classic Wave Pool stays).
export const loadWaveClub = (base) => WAVE_CLUB.load(base);

// The Wave Pool, the model and what the game moves round it. `w` is the PoolWorld being built.
export function buildWaveClub(w, venue) {
  const ctx = waveContext(w, venue),
    O = waveClubModel(),
    info = O.info,
    A = info.anchors || {};
  const root = dressModel(w, O, { look: w.look, name: "waveclub", deckSet: ["pavers", "sand"] });
  water(ctx);
  if (A.Surge) surges(ctx, A.Surge);
  if (A.LED)
    ledBoard(ctx, { x: A.LED[0][0], y: A.LED[0][1], z: A.LED[0][2], width: 3.4, height: 0.64, frame: false });
  for (const [x, y, z] of A.Beacon || []) beacon(ctx, x, y, z);
  if (A.BulbLow && A.BulbHigh) signBulbs(ctx, A.BulbLow[0], A.BulbHigh[0], 52);
  if (A.Flag) flags(ctx, A.Flag);
  pennants(ctx, 4.1);
  liveParts(w, venue, root, info);
  pickVolume(ctx);
  waveLife(w);
}

// What the game moves or asks for: the stations' hit boxes and labels, the rings on their boards, the skimmer on its hooks, the
// net, the torch on its bollard, the fuse box and its lever, the dog treats on the Surf Shack's counter, the tubes on their peg,
// the gate's leaves.
function liveParts(w, venue, root, info) {
  const S = venue.stations,
    F = venue.fixtures;
  station(w, "chlorine", S.chlorine, 0, "", -Math.PI / 2, { body: false });
  station(w, "relief", S.relief, 0, "", Math.PI, { body: false });
  sanitationCorner(w, venue, { board: false, bin: false });
  rescueStations(w, venue, { mounts: false });
  w.ringAt = ringsFromModel(venue, info);
  fishNetHook(w, F.fishNet, { board: false });
  const torch = info.anchors?.Flashlight?.[0];
  flashlightHolder(w, F.flashlight, { post: false, at: torch && { x: torch[0], y: torch[1], z: torch[2] } });
  fuseBox(w, F.fuseBox);
  kioskTreats(w, F.treats);
  const foot = info.anchors?.Tubes?.[0];
  tubeStack(
    w,
    venue,
    foot ? { x: foot[0], y: foot[1], z: foot[2] } : { x: S.fins.x + 0.15, y: 0.2, z: S.fins.z },
  );
  for (const [name, side] of [
    ["Door_A", -1],
    ["Door_B", 1],
  ]) {
    const hinge = root.getObjectByName(name);
    if (hinge) w.lockerDoors.push({ side, hinge });
  }
}
