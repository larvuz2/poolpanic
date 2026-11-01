// The Mountain Hot Springs' plan for the Blender scripts, from the game's own modules (so every rock, step and prop sits where the
// walks, the hit boxes and the labels are): the springs and their outlines, steps and seats, the boulders, the deck, the bathhouse,
// the venue's furniture, stations and fixtures, where the spout's water falls. Run from the repo:
//
//     node tools/venues/onsen/plan.mjs > /tmp/onsen-work/plan.json   (build_all.sh does it)
import {
  SPRINGS,
  ONSEN,
  BOULDERS,
  springPoint,
  springSteps,
  springSeats,
} from "../../../dist/onsen-plan.mjs";
import { VENUES } from "../../../dist/spatial.mjs";

const v = VENUES.onsen;
const TAU = Math.PI * 2;
const outline = (s, r, n = 96) => Array.from({ length: n }, (_, i) => springPoint(s, (i / n) * TAU, r));
const round = (o) =>
  JSON.parse(JSON.stringify(o, (k, x) => (typeof x === "number" ? Math.round(x * 10000) / 10000 : x)));
const plan = {
  deck: ONSEN.deck,
  room: v.room,
  depth: ONSEN.depth,
  rim: ONSEN.rim,
  bathhouse: ONSEN.bathhouse,
  forest: ONSEN.forest,
  springs: SPRINGS.map((s) => ({
    ...s,
    edge: outline(s, 1),
    // (rings for the basin's walls and floor, going in from the edge, and out over the rim)
    rings: Object.fromEntries([0.98, 0.9, 0.8, 0.6].map((r) => [r, outline(s, r)])),
    steps: springSteps(s),
    seats: springSeats(s),
    rimOut: outline(s, 1 + (ONSEN.rim + 0.1) / s.r),
  })),
  boulders: BOULDERS,
  // (scene/onsen.mjs SPOUT: where the bamboo spout's water falls in, spring 3)
  spout: springPoint(SPRINGS[2], 0.15, 0.82),
  furniture: v.furniture,
  stations: v.stations,
  sanitation: v.sanitation,
  ringMounts: v.ringMounts,
  rescue: v.rescue,
  fixtures: v.fixtures,
  doors: v.doors,
  queue: v.queue,
  evacSpots: v.evacSpots,
  coachStart: v.coachStart,
};
console.log(JSON.stringify(round(plan)));
