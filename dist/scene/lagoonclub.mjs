// The Sunset Lagoon dressed for real (31 October 2026, the creator: "Now do the same treatment for the next venue! AAA indie...
// lots of details and prioritizing performance"): a Polynesian beach club on a raised hardwood boardwalk over the sand. A long
// beach house along the back (woven bamboo walls between round timber posts, a deep thatched roof, a tall gable over the carved
// entrance with the SUNSET LAGOON board, paper lanterns along the eave, tiki posts and masks, surfboards), the changing rooms'
// doors in its wall (no lockers: dist/spatial.mjs WALL_DOORS); rope railings on timber posts with tiki torches; the stations in
// bamboo under little thatched roofs, a tiki bar at the kiosk, a palapa over the loungers; wide steps down to the beach, where
// palms and sea-almond trees stand on the dunes, a bonfire, a volleyball net, boats, the surf school's shack and kayaks wait.
//
// Every asset is made by tools/venues/lagoon/ with the shared venue kit (tools/venues/common/); scene/dressed.mjs puts the model
// in. What the game moves stays its own (the water, the lane ropes and pennants, the trampoline's bed, the rings, the fins, the
// doors, the medical kit, the treats, the fish net, the torch, the fuse box, the mop, the massage table, every hit box and label).
//
// Its light is the game's own (dist/scene/daylight.mjs): a shift here slides from golden hour into dusk and a storm can roll in,
// so the model follows the hour every frame (dressModel's `hour`): the lamps, the torches and the bonfire come on as the glow of
// dusk rises, and the painted horizon takes the hour's light. The sea, the lighthouse and the boats are the game's sky
// (scene/sky.mjs `lagoon`), so the horizon goes round the land sides only. It loads behind the menu after the Kids Pool
// (`loadLagoonClub`, app.mjs); until it has, and with ?nomodels, the Sunset Lagoon is the classic one (scene/lagoon.mjs).
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

// The model (dist/assets/lagoon/) and its horizon: a painted tropical coast (palm groves on the dunes, jungle hills with
// bungalows on stilts, volcanic peaks in the haze; tools/venues/lagoon/horizon.sh) on an arc 60 m out round the land sides, its
// ends at the shore (the sea side, x < -38, is the game's sea).
const LAGOON = dressedVenue({
  dir: "lagoon",
  file: "lagoon",
  label: "The Sunset Lagoon",
  horizon: { radius: 60, copies: 3, aspect: 667 / 4096, base: -2.5, arc: [5.68, 4.36] },
});
export const lagoonClubReady = LAGOON.ready;
export const lagoonClubModel = LAGOON.model;
export const primeLagoonClub = LAGOON.prime;
export const lagoonClubPictures = LAGOON.pictures;
// Fetch the model and its pictures once (a few MB); resolves to null when they cannot be had (the classic lagoon stays).
export const loadLagoonClub = (base) => LAGOON.load(base);

// The Sunset Lagoon, the model and what the game needs round it. `w` is the PoolWorld being built.
export function buildLagoonClub(w, venue) {
  const L = lagoonClubModel(),
    info = L.info;
  // the water, the lane ropes and pennants and the lanes' pick volumes; the basin, blocks, ladders and posts are the model's
  buildPool(
    w,
    venue,
    { ...w.look.water, glow: Math.max(w.look.water.glow || 0, 0.001) },
    {
      basin: false,
      blocks: false,
      ladderAt: [],
      posts: false,
      pennants: [0xee6a4a, 0xfff1d6, 0x2aa7a0],
      ropes: [0xfff1d6, 0x2aa7a0, 0xee6a4a],
    },
  );
  const root = dressModel(w, L, { look: w.look, name: "lagoonclub", deckSet: "boardwalk", hour: true });
  liveParts(w, venue, root, info);
}

// What the game moves or asks for (as Splash Park's: the same floor plan): the stations' hit boxes and labels, the rings, the
// fins, the doors, the trampoline's bed, the medical kit, the treats on the tiki bar's counter.
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
