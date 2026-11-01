// The Rooftop Pool dressed for real (1 November 2026, the creator: "Do the same for next venue!!! Quirky! Use same character as
// references if you are adding posters or stuff"): the Sky Pool of Hotel Vertigo, level 57, 185 m above the city at golden hour.
//
// Its materials are photographic, painted once on fal and made seamless (tools/venues/roof/roof_textures.py): honey teak boards,
// ivory travertine, an emerald glass mosaic with gold flecks, a black granite knife edge and gutter, Calacatta marble, dark bronze
// fins on the lift cores, cream linen, rattan, white concrete, teal zellige. The sunbeds and the VIP cabanas (velvet ropes, VIP
// ONLY), the furled parasols and the festoons, the lounge round its fire table, the Sky Bar (a zellige counter, a back bar of lit
// bottles), the DJ's riser, booth and speakers under a truss of par cans, palms in concrete planters, the stations. And the
// nonsense at the edges: the window cleaner's cradle hung off the far edge (BACK IN 5 MINUTES, since Tuesday), the net that
// catches what falls (a phone, a toupee, a duck in sunglasses: DAYS WITHOUT A PHONE GOING OVER THE EDGE: 0), coin binoculars,
// a champagne tower, the bellhop's cart, the pigeons everywhere, the hotel's emblem on the pool's floor (a pigeon in gold aviators
// on a flamingo float) and on the lift cores the pictures with our characters in them (GPT Image 2.5, the coaches as the
// references): HOTEL VERTIGO · DON'T LOOK DOWN, the Wall of Shame, DJ SPLASH, the Employee of the Month.
//
// What moves stays the game's (scene/rooftop.mjs): the water and its ripples, the two sheets of water over the knife edge and
// along the gutter, the lifts' sliding doors, the fire's flames and light, SKY BAR's neon and the margaritas, the LED wall, its
// light and beams and the riser's lit edge, the tower's glass walls below and the city (scene/city.mjs), the towels, the DJ and
// the bartender (scene/roof-view.mjs). It loads behind the menu after the Cruise Ship (`loadRoofClub`, app.mjs); until it has,
// and with ?nomodels, the roof is the classic one.
import {
  station,
  rescueStations,
  sanitationCorner,
  fishNetHook,
  flashlightHolder,
  fuseBox,
  treatsTable,
} from "./props.mjs";
import { dressedVenue, dressModel, ringsFromModel } from "./dressed.mjs";
import { buildCity } from "./city.mjs";
import { buildRoofCast } from "./roof-view.mjs";
import {
  roofContext,
  syncRooftop,
  slabAndTower,
  water,
  infinityEdge,
  lifts,
  lounge,
  bar,
  djStage,
} from "./rooftop.mjs";
import { ROOF } from "../roof-plan.mjs";

// Its light (over LIGHTING.roof, scene.mjs `withDome`): the classic's golden hour going to dusk, the festoons, lanterns and the
// back bar's shelves just glowing, a little cloud shade.
export const ROOF_LOOKS = {
  roof: {
    lamps: 0.42,
    lampColor: 0xffc27a,
    clouds: 0.06,
  },
};

const ROOF_CLUB = dressedVenue({ dir: "roof-club", file: "roof", label: "The Rooftop Pool" });
export const roofClubReady = ROOF_CLUB.ready;
export const roofClubModel = ROOF_CLUB.model;
export const primeRoofClub = ROOF_CLUB.prime;
export const roofClubPictures = ROOF_CLUB.pictures;
// Fetch the model and its pictures once (a few MB); resolves to null when they cannot be had (the classic roof stays).
export const loadRoofClub = (base) => ROOF_CLUB.load(base);

// The pool's box, for the caustics (the gutter's floor and the slab's underside lie below the water's level).
const POOL_BOX = [-ROOF.halfX - 0.05, ROOF.halfX + 0.05, -ROOF.halfZ - 0.05, ROOF.halfZ + 0.05];

// The Rooftop Pool, the model and what the game moves round it. `w` is the PoolWorld being built.
export function buildRoofClub(w, venue) {
  const ctx = roofContext(w, venue);
  const O = roofClubModel(),
    info = O.info;
  dressModel(w, O, { look: w.look, name: "roofclub", deckSet: "teak", caustics: POOL_BOX });
  slabAndTower(ctx, { slab: false });
  water(ctx);
  infinityEdge(ctx, { stone: false });
  lifts(ctx, { core: false });
  lounge(ctx, { sofas: false });
  bar(ctx, { counter: false });
  djStage(ctx, { stage: false });
  liveParts(w, venue, info);
  const city = buildCity(w);
  buildRoofCast(w, venue, ctx);
  syncRooftop(w, ctx, city);
}

// What the game moves or asks for: the stations' hit boxes and labels, the rings on their boards, the skimmer on its pegs, the
// net, the torch on its pedestal, the fuse box and its lever, the dog treats' label.
function liveParts(w, venue, info) {
  const S = venue.stations,
    F = venue.fixtures;
  station(w, "chlorine", S.chlorine, 0, "", -Math.PI / 2, { body: false });
  station(w, "relief", S.relief, 0, "", -Math.PI / 2, { body: false });
  sanitationCorner(w, venue, { board: false, bin: false });
  rescueStations(w, venue, { mounts: false });
  w.ringAt = ringsFromModel(venue, info);
  fishNetHook(w, F.fishNet, { board: false });
  const torch = info.anchors?.Flashlight?.[0];
  flashlightHolder(w, F.flashlight, { post: false, at: torch && { x: torch[0], y: torch[1], z: torch[2] } });
  fuseBox(w, F.fuseBox);
  treatsTable(w, F.treats, { table: false });
}
