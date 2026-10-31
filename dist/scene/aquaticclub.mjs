// The Aquatic Centre dressed for real (31 October 2026, the creator: "Now same treatment for the next venue!!! Remember AAA indie
// quality stuff and details … the textures, the details, the props, the decoration in the corners, on the walls, benches, and towels,
// the uniqueness of the level … this game is goofy and a little bit weird"): a municipal competition hall on club championship day.
// White anti-slip tiles with a blue row every metre and a navy fascia, the pool in blue glass mosaic with its touch pads, blocks and
// backstroke flags; the timing wall in acoustic panels (the changing rooms' doors in it, lit CHANGING boxes over them, the board's
// frame, the pace clocks' housings, QUIET PLEASE · SERIOUS SWIMMING IN PROGRESS); blue-grey sports flooring, tall windows full of
// daylight, the three clubs' banners (the Otters, the Seals, the Soggy Biscuits); concrete grandstands with moulded seats where the
// crowd sits, the press box. And the meet's furniture with the game's sense of humour: the podium, the officials' table with its
// 6.0 / 5.9 / 3.2 scorecards, the team bench (towels, kit bags, swim caps, a rubber chicken nobody claims), Splashy the giant rubber
// duck in his cap and goggles, the Hall of Fame (ish) with a golden flipper and a fish-skeleton cup, the pool records board (Carl's
// slowest lap), DAYS WITHOUT A CANNONBALL: 0, the ISO-SPLASH machine, the lane-rope reel, the leaning tower of kickboards, the POOL
// PANIC TV camera, cardboard Marco. For the Coach Cam: the arched roof, its trusses and lamps, skylights, hanging banners, the near
// stand.
//
// Every asset is made by tools/venues/aquatic/ with the shared venue kit (tools/venues/common/); scene/dressed.mjs puts the model in.
// What moves stays the game's (scene/aquatic.mjs): the timing board whose lane times run with the shift, the pace clocks' hands, the
// club flags, the crowd and its cheering, the ribbons scrolling along the stands. It loads behind the menu after the Aqua Disco
// (`loadAquaticClub`, app.mjs); until it has, and with ?nomodels, the Aquatic Centre is the classic one (scene/aquatic.mjs).
import { THREE } from "./kit.mjs";
import { buildPool } from "./pool.mjs";
import {
  finRack,
  station,
  rescueStations,
  sanitationCorner,
  fishNetHook,
  flashlightHolder,
  fuseBox,
  medkitCabinet,
} from "./props.mjs";
import { kioskTreats } from "./resort.mjs";
import { dressedVenue, dressModel, ringsFromModel } from "./dressed.mjs";
import { timingWall, stands, crowdLife } from "./aquatic.mjs";
import { rngOf } from "./geom.mjs";
import { seatOfficials } from "./officials.mjs";

const DESK = 0.76; // the officials' table's top (tools/venues/aquatic/kit.py OFFICIALS_DESK): they sit at it
const NAVY = 0x10284a;
const BLUE = 0x1f5fd1;
const RED = 0xe03a3a;

// Its light (over LIGHTING.aquatic, scene.mjs `withDome`): the game's cool daylight; the model's lamps lit all the time (the windows'
// daylight, the spots over the board, the CHANGING boxes), their light cool white.
export const AQUATIC_LOOKS = {
  aquatic: {
    lamps: 1,
    clouds: 0,
    lampColor: 0xe8f4ff,
  },
};

const AQUATIC = dressedVenue({ dir: "aquatic", file: "aquatic", label: "The Aquatic Centre" });
export const aquaticClubReady = AQUATIC.ready;
export const aquaticClubModel = AQUATIC.model;
export const primeAquaticClub = AQUATIC.prime;
export const aquaticClubPictures = AQUATIC.pictures;
// Fetch the model and its pictures once (a few MB); resolves to null when they cannot be had (the classic hall stays).
export const loadAquaticClub = (base) => AQUATIC.load(base);

// The Aquatic Centre, the model and what the game moves round it. `w` is the PoolWorld being built.
export function buildAquaticClub(w, venue) {
  const A = aquaticClubModel(),
    info = A.info,
    look = w.look;
  // the water, the lane ropes and the pennants (the game's); the basin, the blocks and the backstroke posts are the model's
  buildPool(w, venue, look.water, {
    basin: false,
    blocks: false,
    ladderAt: [],
    posts: false,
    line: 0x0c2240,
    ropes: [0xffffff, BLUE, RED],
    pennants: [RED, 0xffffff, BLUE],
  });
  const root = dressModel(w, A, { look, name: "aquaticclub", deckSet: "deck" });
  liveParts(w, venue, root, info);
  // the near stand (the Coach Cam's) and its crowd live in a group of their own, shown with the ceiling
  const near = new THREE.Group();
  near.name = "aquatic-near";
  w.scene.add(near);
  w.liveProps.push(near);
  const hall = { coach: false, live: near, ctx: { g: near } };
  const ctx = { w, venue, hall, rand: rngOf(53), crowds: [], ribbons: [] };
  timingWall(ctx, { wall: false });
  stands(ctx, { tiers: false, models: true });
  crowdLife(ctx);
  // the Chief Judge and the Starter at the officials' table, glaring (scene/officials.mjs), once they are in
  seatOfficials(w);
  w.hall = coachView(root, hall);
}

// What the game moves or asks for: the stations' hit boxes and labels, the rings, the fins, the doors, the treats on the officials'
// table, the first-aid cabinet.
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
  kioskTreats(w, F.treats, { top: DESK });
  for (const [name, side] of [
    ["Door_A", -1],
    ["Door_B", 1],
  ]) {
    const hinge = root.getObjectByName(name);
    if (hinge) w.lockerDoors.push({ side, hinge });
  }
}

// The Coach Cam sees the hall from inside: the arched roof, its trusses, lamps, skylights and banners, the near stand (the model's C_
// meshes: tools/venues/aquatic/kit.py COACH_PARTS) and the near stand's crowd and ribbon. None of it casts a shadow (the game's
// light comes from above, through where the roof would be).
function coachView(root, hall) {
  const coach = [];
  root.traverse((o) => {
    // (the packed model keeps the class's name on the node over each mesh)
    if (o.isMesh && (/^C_/.test(o.name) || /^C_/.test(o.parent?.name || ""))) {
      o.castShadow = false;
      coach.push(o);
    }
  });
  coach.push(hall.live);
  const set = (on) => {
    hall.coach = on;
    for (const m of coach) m.visible = on;
  };
  set(false);
  return { setCoach: set, update() {} };
}
