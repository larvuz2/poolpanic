// The Jumping Pool's plan for the Blender scripts, from the game's own modules (so every prop sits where the walks, the hit boxes
// and the labels are): the deep pool and its ladders, the six boards (three heights at each end: the springboard's stand, the
// platforms, their stairs and their lines), the stations' blocks, the hot tub and its steps, the massage beds, the gates, the deck
// and the room, the queue, the evacuation spots, the furniture, stations and fixtures, the rings' mounts. Run from the repo:
//
//     node tools/venues/dive/plan.mjs > /tmp/dive-work/plan.json   (build_all.sh does it)
import { VENUES } from "../../../dist/spatial.mjs";
import {
  DIVE,
  HEIGHTS,
  BOARDS,
  STATIONS,
  LADDERS,
  TUB,
  MASSAGE_BEDS,
  tubSteps,
  diveBlocks,
} from "../../../dist/dive-plan.mjs";

const v = VENUES.dive;
const round = (o) =>
  JSON.parse(JSON.stringify(o, (k, x) => (typeof x === "number" ? Math.round(x * 10000) / 10000 : x)));
const queue = [];
for (const side of [-1, 1]) for (let slot = 0; slot < 12; slot++) queue.push(v.queuePosition(side, slot));
const plan = {
  dive: DIVE,
  heights: HEIGHTS,
  boards: BOARDS,
  stations: STATIONS,
  ladders: LADDERS,
  tub: { ...TUB, top: 0.62, water: 0.48, steps: tubSteps() },
  massageBeds: MASSAGE_BEDS,
  blocks: diveBlocks(v.furniture),
  // (the pool's lines: scene/pool.mjs)
  lines: { water: -0.25, ground: -0.62 },
  deck: v.deck,
  room: v.room,
  doors: v.doors,
  arrival: v.arrival,
  queue,
  evacSpots: v.evacSpots,
  coachStart: v.coachStart,
  furniture: v.furniture,
  obstacles: v.obstacles,
  venueStations: v.stations,
  sanitation: v.sanitation,
  ringMounts: v.ringMounts,
  rescue: v.rescue,
  fixtures: v.fixtures,
};
console.log(JSON.stringify(round(plan)));
