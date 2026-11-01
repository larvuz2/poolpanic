// The Lazy River dressed for real (1 November 2026, the creator: "Do the same for next venue!! Amazing AAA indie game environmental
// details!!! And textures and materials!!"): the Lost Temple of the Lazy River, an ancient temple courtyard the jungle has taken
// back, the river wandering through it out of a cave behind a waterfall and into the temple of the Lazy Idol.
//
// Its materials are photographic, painted once on fal and made seamless (tools/venues/river/river_textures.py): the courtyard's
// sandstone flagstones with moss in their joints, carved grey-green temple blocks, wet mossy river boulders, the river's bed of sand
// and pebbles, old hardwood planks, lashed golden bamboo, the jungle's leaf litter (no lawn). The deck is cut exactly round the
// river (its own geometry, dist/river.mjs) with a coping of carved stone along both banks; the channel walls are the boulders.
// The cave: a sculpted arch of boulders with stalactites, moss, bromeliads and lianas, the game's waterfall falling across its
// mouth. The temple: carved pillars with torches, TEMPLE RAPIDS cut into the lintel, and over it the Lazy Idol, a giant stone face
// yawning on its slab, stepped ruins either side. Across the water the rope bridge (planks, carved posts, lanterns, sagging rope
// rails), the two stepping stones, the docks under their bamboo arches (ALL ABOARD!, EXIT), the tube return and the tube rack. The
// walls: a lashed bamboo palisade with the jungle gate (carved pillars with the idol's face, LAZY RIVER on its board under a
// thatched hood, bamboo leaves the game swings), a ruined temple wall on the far side with two collapsed bays. And the stories at
// the edges: the stations (a stone cistern with a brass pump, a stone basin with an idol's face for a spout), the Coconut Shack
// (Temple Fries on its chalk menu), a split-log bench, two tiki totems, palms in stone rings, boulders and a sunken idol's head,
// the notice wall (the explorer's map, the travel poster, MISSING: ONE TUBE), the expedition's crates with a pith helmet, the
// signpost (WAY OUT?), the crocodile (he is a log), a dugout canoe, SHHH! IDOL SLEEPING on the ruin, and through its gaps the
// expedition's camp; outside, the jungle (palms, giants hung with lianas, bamboo, banana plants, monstera, heliconia) under a
// painted horizon of a lost pyramid, a waterfall and misty karst peaks.
//
// Every asset is made by tools/venues/river/ with the shared venue kit (tools/venues/common/), every place taken from the game's
// own plan (tools/venues/river/plan.mjs). What moves stays the game's (scene/river.mjs): the river's water and its flow, the
// waterfall and its mist, the flames (at the model's `Anchor_Flame` places), the parrots, the tubes on the rack, the click strip
// and the guidance's highlight. It loads behind the menu after Senior Aqua Fit (`loadRiverClub`, app.mjs); until it has, and with
// ?nomodels, the Lazy River is the classic one.
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
import { riverContext, water, waterfall, flameSprites, parrots, pickVolume, tubeRack } from "./river.mjs";

// Its light (over LIGHTING.river, scene.mjs `withDome`): the game's late-morning jungle light; the lanterns lit softly; slow clouds.
export const RIVER_LOOKS = {
  river: {
    lamps: 0.3,
    lampColor: 0xffc27a,
    clouds: 0.22,
    horizon: 0xf4f6ee,
  },
};

// The model (dist/assets/river-club/) and its horizon: a painted jungle (an overgrown stepped pyramid, a tall misty waterfall off a
// green cliff, karst peaks and a volcano in the mist; tools/venues/river/README.md) all round, 60 m out.
const RIVER_CLUB = dressedVenue({
  dir: "river-club",
  file: "river",
  label: "The Lazy River",
  horizon: { radius: 60, copies: 4, aspect: 908 / 4096, base: -1.5 },
});
export const riverClubReady = RIVER_CLUB.ready;
export const riverClubModel = RIVER_CLUB.model;
export const primeRiverClub = RIVER_CLUB.prime;
export const riverClubPictures = RIVER_CLUB.pictures;
// Fetch the model and its pictures once (a few MB); resolves to null when they cannot be had (the classic jungle stays).
export const loadRiverClub = (base) => RIVER_CLUB.load(base);

// How big each flame burns, by where its anchor is: the totems' and the camp fire's bigger than the torches'.
const flameSize = (y) => (y < 1 ? 1.2 : y > 2.7 ? 1.1 : 0.85);

// The Lazy River, the model and what the game moves round it. `w` is the PoolWorld being built.
export function buildRiverClub(w, venue) {
  const ctx = riverContext(w, venue),
    O = riverClubModel(),
    info = O.info,
    A = info.anchors || {};
  const root = dressModel(w, O, { look: w.look, name: "riverclub", deckSet: "sandstone" });
  water(ctx);
  waterfall(ctx);
  ctx.flames = (A.Flame || []).map(([x, y, z]) => ({ x, y, z, size: flameSize(y) }));
  flameSprites(ctx);
  liveParts(w, venue, root, info, ctx);
  parrots(ctx);
  pickVolume(ctx);
}

// What the game moves or asks for: the stations' hit boxes and labels, the tubes on the model's rack, the rings on their boards,
// the skimmer on its hooks, the net, the torch on its pedestal, the fuse box and its lever, the dog treats on their crates, the
// tube return's label, the gate's leaves.
function liveParts(w, venue, root, info, ctx) {
  const S = venue.stations,
    F = venue.fixtures,
    r = venue.river;
  station(w, "chlorine", S.chlorine, 0, "", -Math.PI / 2, { body: false });
  station(w, "relief", S.relief, 0, "", -Math.PI / 2, { body: false });
  tubeRack(ctx, { rack: false });
  sanitationCorner(w, venue, { board: false, bin: false });
  rescueStations(w, venue, { mounts: false });
  w.ringAt = ringsFromModel(venue, info);
  fishNetHook(w, F.fishNet, { board: false });
  const torch = info.anchors?.Flashlight?.[0];
  flashlightHolder(w, F.flashlight, { post: false, at: torch && { x: torch[0], y: torch[1], z: torch[2] } });
  fuseBox(w, F.fuseBox);
  kioskTreats(w, F.treats);
  const t = r.docks.tubeReturn;
  w.labels.push({ text: "TUBE RETURN", x: t.x, y: 2.1, z: t.z });
  for (const [name, side] of [
    ["Door_A", -1],
    ["Door_B", 1],
  ]) {
    const hinge = root.getObjectByName(name);
    if (hinge) w.lockerDoors.push({ side, hinge });
  }
}
