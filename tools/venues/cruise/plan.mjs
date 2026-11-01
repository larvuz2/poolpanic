// The Cruise Ship's plan for the Blender scripts, from the game's own modules (so every prop sits where the walks, the hit boxes and
// the labels are): the pool (its lane half and its free half, the lanes, the starting blocks), the rows of sun loungers and their
// homes, the Lido Bar, the hot tub, the two stairway lobbies and their doors, the deck and the room, the ship's lines (the rails,
// the stern, the bow where the superstructure rises, the sea far below: scene/cruise.mjs), the queue's places, the evacuation spots,
// the furniture, stations and fixtures, the rings' mounts, the walkers' blocks. Run from the repo:
//
//     node tools/venues/cruise/plan.mjs > /tmp/cruise-work/plan.json   (build_all.sh does it)
import { VENUES } from "../../../dist/spatial.mjs";
import { CRUISE, LOUNGERS, CRUISE_BLOCKS } from "../../../dist/cruise-plan.mjs";

const v = VENUES.cruise;
const round = (o) =>
  JSON.parse(JSON.stringify(o, (k, x) => (typeof x === "number" ? Math.round(x * 10000) / 10000 : x)));
const queue = [];
for (const side of [-1, 1]) for (let slot = 0; slot < 12; slot++) queue.push(v.queuePosition(side, slot));
const plan = {
  cruise: CRUISE,
  loungers: LOUNGERS,
  blocks: CRUISE_BLOCKS,
  // (the ship's lines: scene/cruise.mjs)
  ship: {
    water: -0.15,
    laneFloor: -1.75,
    freeFloor: -1.24,
    bench: -0.62,
    sea: -26,
    hull: 16.45,
    stern: -15.6,
    bow: 17.6,
  },
  pool: v.pool,
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
