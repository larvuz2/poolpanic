// The Mountain Hot Springs dressed for real (1 November 2026, the creator: "do the same for the next venue!!! be careful of the
// placement of things!! nice good details please!!! good props from blender!!"): a snowy terrace of icy flagstones in the mountains
// at the blue hour. The four springs cut exactly on the game's outlines into rock basins with pebbled floors, a double ring of river
// stones round each (some under snow) and its two step stones; the boulders where the walks go round them, capped with snow; the
// snowfield and its drifts; the snow on the terrace itself, thick at the edges and round the rocks, thin along the paths trodden
// from the bathhouse door to every spring. The bathhouse: charred cedar and white plaster between dark posts, latticed windows
// glowing, a kawara roof under a quilt of snow with icicles, red paper lanterns, the 温泉 plaque, a pyramid of yellow buckets, geta,
// umbrellas, a woodpile with an axe in the block, and round the corner a drinks machine (hot corn soup, banana milk). Stone lanterns
// with snow on their roofs, the bamboo spout on its crossed legs, snowy cedars, a dark ring of firs; wooden stations (MINERALS with
// its bath-salt sacks, EYE CARE's washstand), boards for the rings, the net, the skimmer, the rules (the monkeys are not guests),
// CAUTION: MONKEYS, SLIPPERY! VERY.; out in the snow a snowman wearing a towel and a little shrine whose offering is a rubber duck.
//
// Every asset is made by tools/venues/onsen/ with the shared venue kit (tools/venues/common/), every place taken from the game's
// own plan (tools/venues/onsen/plan.mjs); scene/dressed.mjs puts the model in. What moves stays the game's (scene/onsen.mjs): the
// springs' water and its shader, the steam, the falling snow, the spout's thread of water, the curtain in the door, the lanterns'
// flames, the painted mountains, and the cast (the guests and the snow monkeys, scene/onsen-view.mjs). It loads behind the menu
// after the Aquatic Centre (`loadOnsenClub`, app.mjs); until it has, and with ?nomodels, the springs are the classic ones.
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
import {
  onsenContext,
  water,
  mountains,
  noren,
  lanternFlame,
  spoutStream,
  steam,
  snowfall,
  pickVolumes,
} from "./onsen.mjs";
import { buildOnsenCast } from "./onsen-view.mjs";

// Its light (over LIGHTING.onsen, scene.mjs `withDome`): the game's blue hour; every lamp in the model lit (the lanterns' paper, the
// red chōchin, the bathhouse's windows and doorway), their light warm on the snow.
export const ONSEN_LOOKS = {
  onsen: {
    lamps: 1,
    clouds: 0,
    lampColor: 0xffb070,
  },
};

const ONSEN_CLUB = dressedVenue({ dir: "onsen-club", file: "onsen", label: "The Mountain Hot Springs" });
export const onsenClubReady = ONSEN_CLUB.ready;
export const onsenClubModel = ONSEN_CLUB.model;
export const primeOnsenClub = ONSEN_CLUB.prime;
export const onsenClubPictures = ONSEN_CLUB.pictures;
// Fetch the model and its pictures once (a few MB); resolves to null when they cannot be had (the classic springs stay).
export const loadOnsenClub = (base) => ONSEN_CLUB.load(base);

// The Mountain Hot Springs, the model and what the game moves round it. `w` is the PoolWorld being built.
export function buildOnsenClub(w, venue) {
  const ctx = onsenContext(w, venue),
    O = onsenClubModel(),
    info = O.info;
  dressModel(w, O, { look: w.look, name: "onsenclub", deckSet: "flagstone" });
  water(ctx);
  mountains(ctx);
  noren(ctx);
  for (const f of venue.furniture.filter((q) => q.kind === "lantern")) lanternFlame(ctx, f.x, f.z);
  spoutStream(ctx);
  liveParts(w, venue, info);
  steam(ctx);
  snowfall(ctx);
  pickVolumes(ctx);
  buildOnsenCast(w, ctx);
}

// What the game moves or asks for: the stations' hit boxes and labels, the rings on their boards, the skimmer on its hooks, the
// net, the torch on its post, the fuse box and its lever, the treats.
function liveParts(w, venue, info) {
  const S = venue.stations,
    F = venue.fixtures;
  station(w, "chlorine", S.chlorine, 0, "", Math.PI / 2, { body: false });
  station(w, "relief", S.relief, 0, "", Math.PI / 2, { body: false });
  sanitationCorner(w, venue, { board: false, bin: false });
  rescueStations(w, venue, { mounts: false });
  w.ringAt = ringsFromModel(venue, info);
  fishNetHook(w, F.fishNet, { board: false });
  const torch = info.anchors?.Flashlight?.[0];
  flashlightHolder(w, F.flashlight, { post: false, at: torch && { x: torch[0], y: torch[1], z: torch[2] } });
  fuseBox(w, F.fuseBox);
  treatsTable(w, F.treats, { table: false });
}
