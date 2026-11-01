// The Rooftop Pool's plan for the Blender scripts, from the game's own modules (so every prop sits where the walks, the hit boxes
// and the labels are): the basin, the knife edge and the gutter, the glass rail, the rows of sunbeds and the cabanas (their beds:
// roof-plan.mjs), the lounge, the bar, the DJ, the lifts, the walkers' blocks, the roof's lines (the slab's outline and the tower
// under it: scene/rooftop.mjs), the queue, the evacuation spots, the furniture, stations and fixtures, the rings' mounts. Run from
// the repo:
//
//     node tools/venues/roof/plan.mjs > /tmp/roof-work/plan.json   (build_all.sh does it)
import { VENUES } from "../../../dist/spatial.mjs";
import { ROOF, ROOF_BEDS, ROOF_BLOCKS } from "../../../dist/roof-plan.mjs";

const v = VENUES.roof;
const round = (o) =>
  JSON.parse(JSON.stringify(o, (k, x) => (typeof x === "number" ? Math.round(x * 10000) / 10000 : x)));
const queue = [];
for (const side of [-1, 1]) for (let slot = 0; slot < 12; slot++) queue.push(v.queuePosition(side, slot));
const plan = {
  roof: ROOF,
  beds: ROOF_BEDS,
  blocks: ROOF_BLOCKS,
  // (the roof's lines: scene/rooftop.mjs)
  lines: {
    water: -0.08,
    floor: -1.24,
    bench: -0.62,
    gutterWater: -0.62,
    gutterFloor: -0.82,
    slab: -1.7,
    edge: { x0: -15.1, x1: 4.95, z: 16.55 },
    tower: { x0: -14.2, x1: -1.0, z: 15.6 },
  },
  deck: v.deck,
  room: v.room,
  doors: v.doors,
  arrival: v.arrival,
  queue,
  evacSpots: v.evacSpots,
  coachStart: v.coachStart,
  furniture: v.furniture,
  obstacles: v.obstacles,
  stations: v.stations,
  sanitation: v.sanitation,
  ringMounts: v.ringMounts,
  rescue: v.rescue,
  fixtures: v.fixtures,
};
console.log(JSON.stringify(round(plan)));
