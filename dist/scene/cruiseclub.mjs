// The Cruise Ship dressed for real (1 November 2026, the creator: "Do the same for the next venue!! … AAA indie scene and lighting
// this one!!!"): the Lido Deck of the Panic of the Seas at golden hour, a 1930s ocean liner's glamour on a modern cruise ship.
//
// Its materials are photographic, painted once on fal and made seamless (tools/venues/cruise/cruise_textures.py): honey teak with
// black caulking running fore and aft, white riveted steel, blue-grey non-skid, iridescent glass mosaic, the hull's balconies,
// the superstructure's window bands holding the sunset, navy-and-cream striped canvas, deco mahogany. The pool's kraken in a
// captain's hat on its floor (fal), the Lido Bar (portholes, an ice swan, a seagull stealing a fry), the hot tub, the stations,
// the boards and the stories at the edge of play (Captain Barnacle's portrait and CAPTAIN FOR A DAY, made with our characters as
// references; TODAY ON BOARD, the belly flop judges, the engine telegraph rung to PANIC), the superstructure with its café, the
// cinema screen's frame, the bridge, the funnel with the line's crest, the lifeboats, festoons along the rails, seagulls.
//
// THE WHOLE SHIP ROLLS (scene/cruise.mjs turns the scene about x while the sea and the sky are turned back level): the model is in
// the scene and rolls with it, and its shader works in the ship's own frame (dressModel's `frame`), so the floor's paint, the
// lamps' pools and the pool's caustics stay where they belong as the deck tips. What moves stays the game's (scene/cruise.mjs):
// the sea and the sky (here the golden hour's own painted panorama), the pool's water and its slosh, the rope floats, the movie
// on the screen, the radar and the signal flags, the funnel's smoke, the lobbies' sliding doors, the loungers (they slide), the
// hot tub's water and bubbles, the ship's bell, the steamer chairs and balls that slide about, the bartender and the cast. It
// loads behind the menu after the Lazy River (`loadCruiseClub`, app.mjs); until it has, and with ?nomodels, the ship is the
// classic one.
import { THREE } from "./kit.mjs";
import {
  station,
  finRack,
  rescueStations,
  sanitationCorner,
  fishNetHook,
  flashlightHolder,
  fuseBox,
  treatsTable,
  medkitCabinet,
} from "./props.mjs";
import { dressedVenue, dressModel, ringsFromModel } from "./dressed.mjs";
import { buildCast } from "./roof-view.mjs";
import {
  cruiseContext,
  basicMaterials,
  ocean,
  water,
  ropes,
  screen,
  mastLive,
  smoke,
  lobbies,
  loungers,
  hotTub,
  shipBell,
  loose,
  syncCruise,
} from "./cruise.mjs";
import { CRUISE } from "../cruise-plan.mjs";

// Its light (over LIGHTING.cruise, scene.mjs `withDome`): golden hour at sea. A low warm sun from ahead and to starboard (where the
// painted sun sets), long shadows across the teak, a cool lilac fill from the open sky, the festoons and sconces just glowing.
export const CRUISE_LOOKS = {
  cruise: {
    background: 0xc6a0b6,
    exposure: 1.02,
    hemi: [0xffe6cf, 0x8a6a58, 1.0],
    sun: [0xffc58a, 2.7, [20, 9.5, 17]],
    fill: [0xb6a6e0, 0.8, [-14, 14, -12]],
    env: 0.8,
    envColors: ["#f0c9b8", "#f3e2d0", "#8f7656"],
    fog: [0xead2bd, 420, 2600],
    water: {
      shallow: [0.24, 0.82, 0.86],
      deep: [0.04, 0.46, 0.66],
      sky: [0.98, 0.84, 0.74],
      glint: [1, 0.82, 0.55],
      glow: 0.12,
      clarity: 0.6,
    },
    cruiseSea: { deep: 0x123a66, shallow: 0x2f7f9e, sky: 0xe7b9a3, haze: 0xead2bd },
    glow: 0.18,
    sky: [
      [0, "#837bb6"],
      [0.35, "#a490ba"],
      [0.7, "#daaca2"],
      [1, "#ead2bd"],
    ],
    lamps: 0.35,
    lampColor: 0xffc27a,
    clouds: 0.12,
  },
};

const CRUISE_CLUB = dressedVenue({ dir: "cruise-club", file: "cruise", label: "The Cruise Ship" });
export const cruiseClubReady = CRUISE_CLUB.ready;
export const cruiseClubModel = CRUISE_CLUB.model;
export const primeCruiseClub = CRUISE_CLUB.prime;
export const cruiseClubPictures = CRUISE_CLUB.pictures;
// Fetch the model and its pictures once (a few MB); resolves to null when they cannot be had (the classic ship stays).
export const loadCruiseClub = (base) => CRUISE_CLUB.load(base);

// The painted golden hour all round (dist/assets/cruise-club/sky.jpg: its horizon half way down, the sun 62% across): once round,
// as tall as it is wide over the circle's length, turned so its sun sets where the game's sun shines from.
const SKY = { file: "sky.jpg", dir: "cruise-club", horizon: 0.496, copies: 1, height: 2827, cap: 0x837bb6 };
// (where the sun lies on the ring: the cylinder's angle at the picture's 62%, turned to the sun's own azimuth)
SKY.turn = Math.atan2(20, 17) - 2 * Math.PI * 0.62;

// The pool's box, for the caustics (the lower deck aft and the hull's sides lie below the water's level).
const POOL_BOX = [-CRUISE.halfX - 0.05, CRUISE.free.x1 + 0.05, -CRUISE.halfZ - 0.05, CRUISE.halfZ + 0.05];

// The Cruise Ship, the model and what the game moves round it. `w` is the PoolWorld being built.
export function buildCruiseClub(w, venue) {
  const ctx = cruiseContext(w, venue);
  basicMaterials(ctx);
  const O = cruiseClubModel(),
    info = O.info;
  ocean(ctx, SKY);
  const root = dressModel(w, O, {
    look: w.look,
    name: "cruiseclub",
    deckSet: "teak",
    caustics: POOL_BOX,
    frame: w.scene,
  });
  water(ctx);
  ropes(ctx, { hooks: false });
  screen(ctx, { frame: false });
  mastLive(ctx);
  // (the dressed funnel is raked aft: its top 1 m behind the classic's)
  smoke(ctx, new THREE.Vector3(32.6 - 1.05, 25.0, 0));
  lobbies(ctx, { house: false });
  loungers(ctx, { umbrellas: false });
  hotTub(ctx, { shell: false });
  shipBell(ctx);
  loose(ctx);
  liveParts(w, venue, root, info);
  ctx.barSpot = { x: CRUISE.bar.x - 0.3, z: CRUISE.bar.z };
  ctx.barAngle = -Math.PI / 2;
  buildCast(w, ctx);
  w.updaters.push((time, dt, world, sim) => {
    syncCruise(w, sim, time, dt, ctx);
    // (the coach-only sky dome sits inside the painted horizon: the dressed ship keeps the painting)
    if (w.sky?.group) w.sky.group.visible = false;
  });
}

// What the game moves or asks for: the stations' hit boxes and labels, the fins on the model's rack, the rings on their boards,
// the skimmer on its hooks, the net, the torch on its binnacle, the fuse box and its lever, the first aid kit on its shelf, the
// dog treats' label.
function liveParts(w, venue, root, info) {
  const S = venue.stations,
    F = venue.fixtures;
  const fins = [1, 2, 3].map((i) => root.getObjectByName("Fins_" + i)).filter(Boolean);
  finRack(w, S.fins, { rack: fins.length !== 3 });
  if (fins.length === 3) w.finPairs = fins;
  station(w, "chlorine", S.chlorine, 0, "", Math.PI / 2, { body: false });
  station(w, "relief", S.relief, 0, "", Math.PI, { body: false });
  medkitCabinet(w, F.medkit, { cabinet: false });
  sanitationCorner(w, venue, { board: false, bin: false });
  rescueStations(w, venue, { mounts: false });
  w.ringAt = ringsFromModel(venue, info);
  fishNetHook(w, F.fishNet, { board: false });
  const torch = info.anchors?.Flashlight?.[0];
  flashlightHolder(w, F.flashlight, { post: false, at: torch && { x: torch[0], y: torch[1], z: torch[2] } });
  fuseBox(w, F.fuseBox);
  treatsTable(w, F.treats, { table: false });
}
