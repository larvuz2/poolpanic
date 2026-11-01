// The Jumping Pool dressed for real (1 November 2026, the creator: "Now do the same for next venue !!! Same detailed environment
// enhancement"): the diving pool of the Splashworth Country Club (est. 1927) on a bright summer's day.
//
// Its materials are photographic, painted once on fal and made seamless (tools/venues/dive/dive_textures.py): a cobalt glass
// mosaic with a band of hand-painted majolica at its waterline, white Calacatta coping, an ivory travertine deck, board-formed
// concrete for the diving stations, teak, the lawns with their mowing stripes, the clipped box hedges, the clubhouse's lime-washed
// render and terracotta roof, green-and-cream striped awnings. The diving stations (the springboards' stands, the MID and HIGH
// platforms in their heights' colours, their stairs and signs), the hot tub's teak cabinet, the massage corner's shelf, the
// stations, the hedges and gates with their rose arches, flower beds, trees, the clubhouse (SPLASHWORTH COUNTRY CLUB, a colonnade,
// a clock, a terrace of tea tables, a croquet lawn), the club's walrus emblem on the pool's floor. And the club's nonsense: the
// CHICKEN-OUT ZONE's hen house of rubber chickens beside each HIGH tower, the judges' table (9.5, 10, 2), the SPLASH-O-METER (the
// needle at CARL), the poncho stand, peacocks on the hedges, a duck in swim goggles as the lifeguard and another up the HIGH tower,
// ducklings at the gate; and the pictures with our characters in them (GPT Image 2.5, the coaches as the references): the HALL OF
// FAME · GREATEST BELLY FLOPS, the club's poster (DIVE INTO SUMMER) and Sir Reginald Splashworth's portrait.
//
// What moves stays the game's (scene/dive.mjs): the pool's water, the springboards' planks (they bend), the hot tub's water and
// glow, the gates' picket leaves (they swing), the club's flag, the boards' and the tub's pick volumes, highlights and rims, the
// landing rings, the steam and the divers (scene/dive-view.mjs), the massage beds (scene/massage-view.mjs). It loads behind the
// menu after the Rooftop Pool (`loadDiveClub`, app.mjs); until it has, and with ?nomodels, the pool is the classic one.
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
import { buildDiveCast } from "./dive-view.mjs";
import { diveContext, diveWater, stations, hotTub, clubhouse, gates, pickVolumes } from "./dive.mjs";
import { DIVE } from "../dive-plan.mjs";

// Its light (over LIGHTING.dive, scene.mjs `withDome`): the classic's bright summer day, a little cloud shade drifting over.
export const DIVE_LOOKS = {
  dive: {
    lamps: 0,
    clouds: 0.18,
  },
};

const DIVE_CLUB = dressedVenue({ dir: "dive-club", file: "dive", label: "The Jumping Pool" });
export const diveClubReady = DIVE_CLUB.ready;
export const diveClubModel = DIVE_CLUB.model;
export const primeDiveClub = DIVE_CLUB.prime;
export const diveClubPictures = DIVE_CLUB.pictures;
// Fetch the model and its pictures once (a few MB); resolves to null when they cannot be had (the classic pool stays).
export const loadDiveClub = (base) => DIVE_CLUB.load(base);

// The pool's box, for the caustics (the deep basin's walls and floor).
const POOL_BOX = [-DIVE.halfX - 0.05, DIVE.halfX + 0.05, -DIVE.halfZ - 0.05, DIVE.halfZ + 0.05];

// The Jumping Pool, the model and what the game moves round it. `w` is the PoolWorld being built.
export function buildDiveClub(w, venue) {
  const ctx = diveContext(w, venue);
  const O = diveClubModel(),
    info = O.info;
  dressModel(w, O, { look: w.look, name: "diveclub", deckSet: "travertine", caustics: POOL_BOX });
  diveWater(ctx);
  stations(ctx, { built: false });
  hotTub(ctx, { cabinet: false });
  clubhouse(ctx, { building: false });
  gates(ctx, { posts: false });
  liveParts(w, venue, info);
  pickVolumes(ctx);
  buildDiveCast(w, ctx);
}

// What the game moves or asks for: the stations' hit boxes and labels, the rings on their boards, the skimmer on its pegs, the
// net, the torch on its pedestal, the fuse box and its lever, the dog treats' label.
function liveParts(w, venue, info) {
  const S = venue.stations,
    F = venue.fixtures;
  // (each faces the pool from its own side's hedge, as the classic's)
  const facing = (at) => (at.x < 0 ? Math.PI / 2 : -Math.PI / 2);
  station(w, "chlorine", S.chlorine, 0, "", facing(S.chlorine), { body: false });
  station(w, "relief", S.relief, 0, "", facing(S.relief), { body: false });
  sanitationCorner(w, venue, { board: false, bin: false });
  rescueStations(w, venue, { mounts: false });
  w.ringAt = ringsFromModel(venue, info);
  fishNetHook(w, F.fishNet, { board: false });
  const torch = info.anchors?.Flashlight?.[0];
  flashlightHolder(w, F.flashlight, { post: false, at: torch && { x: torch[0], y: torch[1], z: torch[2] } });
  fuseBox(w, F.fuseBox);
  treatsTable(w, F.treats, { table: false });
}
