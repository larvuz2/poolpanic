// Senior Aqua Fit dressed for real (1 November 2026, the creator: "The exact same approach to how the artist builds the scene:
// the props, the small clusters, the detail, edge of play, walkways, everything, and even better. More attention to the detail"):
// the Palm House Baths, est. 1926, a Victorian palm house of white cast iron and glass round a four-lane pool for a gentle crowd.
//
// The conservatory: a travertine deck, a frieze of emerald and gold round an art-deco fan mosaic pool with a mosaic swan on its
// floor, marble coping, steps and brass ladders, brass depth plates; the glazing on the far side and the far end (a dwarf wall of
// cream brick, white iron columns with brass necks, fanlights over every bay and iron lace in their spandrels, a gutter); the
// stucco back wall with fluted pilasters, a cornice and an emerald-tiled dado under a brass rail, the glass doors under a pediment
// and the club's sign, a runner with brass stair rods from the doors between the lounge's two rugs and a SALVETE doormat; the low
// brick wall on the near side. The roof, the lantern on its ridge, the cresting and the pendant lamps are the Coach Cam's.
//
// Its edge of play, every piece against the walls and the glass or in the furniture's own boxes, never where the guests walk or
// wait: the back wall hung like a Victorian salon, bay by bay between the pilasters (TODAY'S MOVES on a chalkboard; the slippers'
// corner, a rack of slippers and the flippers that should be on the other rack, a coat stand with a sun hat; the station clock, always
// time for aqua fit; the lost property cabinet, a single flipper, dentures in a glass, a toupee; the founder, Mrs. Edith Plumm, in a
// gilt frame with her plate, a picture light and her flowered cap under a glass dome; the HONEST penny scale; the umbrella stand;
// the conservatory rules under six photographs of the club; ZIMMER PARKING, four walking frames with tennis-ball feet, a basket, a
// bicycle horn, a garland and a learner's L; the bingo console under AQUA BINGO and a shield of crossed flippers; TODAY'S
// PROGRAMME; a brass sconce on every pilaster); the stations (an apothecary's cabinet for the water care, a marble washstand for
// the eyes, a mahogany fin rack, enamel boards); the spa's marble tub with towels and a rubber duck, a bucket of ducks, its board;
// the tea trolley with a knitted cosy and scones; the gramophone and its records; the reading corner's wing chairs, the knitting
// (a swimming costume, half done) and the large-print books; the steamer loungers with tartan blankets, an eye mask and a
// crossword; the canary in its cage, QUIET PLEASE and the CAP OF THE WEEK (Doris, again) on easels by the glass, fern stands, a
// hamper of towels, watering cans; geraniums and orchids on the sills, hanging baskets on every column, troughs along the near
// wall; a fan palm in a blue-and-white jardiniere, a fern and an aspidistra on pedestals. Outside, a Victorian pleasure garden in
// the late sun: a gravel walk with lamp posts and benches, standard roses with a topiary duck and her ducklings and a topiary
// swan, a yew hedge with the fountain seen through its gap, a topiary teapot pouring into its cup, a sundial, the bandstand,
// Irish yews and limes, and a painted English landscape beyond.
//
// Every asset is made by tools/venues/senior/ with the shared venue kit (tools/venues/common/), every place taken from the game's
// own plan (tools/venues/senior/plan.mjs); scene/dressed.mjs puts the model in. What moves stays the game's (scene/senior.mjs),
// placed at the model's anchors (`Anchor_<Name>`): the spa's water, bubbles and steam, the gramophone's notes, the tin of treats
// on the trolley; the late sun's shafts and motes and the window pattern the roof's ribs cast (unseen casters); the doors' leaves
// are the model's (`Door_A`/`Door_B`), swung by the game. It loads behind the menu after the Wave Pool (`loadSeniorClub`,
// app.mjs); until it has, and with ?nomodels, Senior Aqua Fit is the classic conservatory.
import {
  finRack,
  station,
  rescueStations,
  sanitationCorner,
  fishNetHook,
  flashlightHolder,
  fuseBox,
} from "./props.mjs";
import { buildPool } from "./pool.mjs";
import { dressedVenue, dressModel, ringsFromModel } from "./dressed.mjs";
import {
  seniorContext,
  glowDimmer,
  spa,
  teaTrolley,
  gramophone,
  readingLamp,
  roofShadows,
  sunlight,
} from "./senior.mjs";

// Its light (over LIGHTING.senior, scene.mjs `withDome`): the game's golden late afternoon through the glass; the sconces, the
// picture light, the reading lamp and the garden's lanterns lit softly, warm; a few slow clouds over the sun.
export const SENIOR_LOOKS = {
  senior: {
    lamps: 0.45,
    lampColor: 0xffc27a,
    clouds: 0.16,
    horizon: 0xfff2dc,
  },
};

// The model (dist/assets/senior-club/) and its horizon: a painted English pleasure garden and the country past it (rose arches,
// lavender and foxgloves, urns on a balustrade, a lily pond and a gazebo, a walled kitchen garden, oaks and a copper beech, sheep
// on rolling hills, a village with a spire; tools/venues/senior/README.md) all round, 60 m out.
const SENIOR_CLUB = dressedVenue({
  dir: "senior-club",
  file: "senior",
  label: "Senior Aqua Fit",
  horizon: { radius: 60, copies: 4, aspect: 772 / 4096, base: -2.4 },
});
export const seniorClubReady = SENIOR_CLUB.ready;
export const seniorClubModel = SENIOR_CLUB.model;
export const primeSeniorClub = SENIOR_CLUB.prime;
export const seniorClubPictures = SENIOR_CLUB.pictures;
// Fetch the model and its pictures once (a few MB); resolves to null when they cannot be had (the classic conservatory stays).
export const loadSeniorClub = (base) => SENIOR_CLUB.load(base);

// Senior Aqua Fit, the model and what the game moves round it. `w` is the PoolWorld being built.
export function buildSeniorClub(w, venue) {
  const ctx = seniorContext(w, venue),
    O = seniorClubModel(),
    info = O.info,
    A = info.anchors || {},
    look = w.look;
  // the water (the game's); the basin, its mosaic, coping, steps and ladders are the model's, and the pool has no ropes
  buildPool(w, venue, look.water, {
    basin: false,
    blocks: false,
    ladderAt: [],
    posts: false,
    line: null,
    ropes: null,
    pennants: null,
  });
  // (the garden lies 1.95 m down, below the water's level: the pool's caustics stay inside the conservatory)
  const R = venue.room;
  const root = dressModel(w, O, {
    look,
    name: "seniorclub",
    deckSet: "travertine",
    caustics: [R.minX, R.maxX, R.minZ, R.maxZ],
  });
  const at = (f, name) => (A[name]?.[0] ? { ...f, x: A[name][0][0], z: A[name][0][2] } : f);
  for (const f of venue.furniture) {
    if (f.kind === "spa") spa(ctx, at(f, "Spa"), { body: false });
    if (f.kind === "trolley") teaTrolley(ctx, f, { body: false });
    if (f.kind === "gramophone") gramophone(ctx, at(f, "Notes"), { body: false });
  }
  readingLamp(ctx, { body: false });
  liveParts(w, venue, root, info);
  roofShadows(ctx);
  sunlight(ctx);
  glowDimmer(ctx);
  w.hall = coachView(root);
}

// What the game moves or asks for: the stations' hit boxes and labels, the fins on the model's rack, the rings on their boards, the
// skimmer on its hooks, the net, the torch on its pedestal, the fuse box and its lever, the doors' leaves, the glass a storm darkens.
function liveParts(w, venue, root, info) {
  const S = venue.stations,
    F = venue.fixtures;
  const fins = [1, 2, 3].map((i) => root.getObjectByName("Fins_" + i)).filter(Boolean);
  // (the model's rack and pairs; a model without them has the classic rack)
  finRack(w, S.fins, { rack: fins.length !== 3 });
  if (fins.length === 3) w.finPairs = fins;
  station(w, "chlorine", S.chlorine, 0, "", -Math.PI / 2, { body: false });
  station(w, "relief", S.relief, 0, "", -Math.PI / 2, { body: false });
  sanitationCorner(w, venue, { board: false, bin: false });
  rescueStations(w, venue, { mounts: false });
  w.ringAt = ringsFromModel(venue, info);
  fishNetHook(w, F.fishNet, { board: false });
  const torch = info.anchors?.Flashlight?.[0];
  flashlightHolder(w, F.flashlight, { post: false, at: torch && { x: torch[0], y: torch[1], z: torch[2] } });
  fuseBox(w, F.fuseBox);
  for (const [name, side] of [
    ["Door_A", -1],
    ["Door_B", 1],
  ]) {
    const hinge = root.getObjectByName(name);
    if (hinge) w.lockerDoors.push({ side, hinge });
  }
  const glass = [];
  root.traverse((o) => {
    if (o.isMesh && (/^[SC]_glass/.test(o.name) || /^[SC]_glass/.test(o.parent?.name || ""))) glass.push(o);
  });
  w.windowGlass = glass; // (darkened in a storm: incident-view.mjs)
}

// The Coach Cam sees the conservatory from inside: the glass roof, its rafters and purlins, the lantern on the ridge, the cresting,
// the gables and the pendant lamps (the model's C_ meshes: tools/venues/senior/kit.py COACH_PARTS). None of it casts a shadow: the
// window pattern on the deck is the unseen casters' (roofShadows).
function coachView(root) {
  const coach = [];
  root.traverse((o) => {
    // (the packed model keeps the class's name on the node over each mesh)
    if (o.isMesh && (/^C_/.test(o.name) || /^C_/.test(o.parent?.name || ""))) {
      o.castShadow = false;
      coach.push(o);
    }
  });
  const hall = {
    coach: false,
    setCoach(on) {
      this.coach = on;
      for (const m of coach) m.visible = on;
    },
    update() {},
  };
  hall.setCoach(false);
  return hall;
}
