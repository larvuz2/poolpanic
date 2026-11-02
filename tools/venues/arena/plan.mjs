// The Grand Gala Arena's plan for the Blender scripts, from the game's own modules (so every prop sits where the walks, the hit
// boxes and the labels are): the deck and the room, the doors, the queue, the furniture, stations and fixtures, the rings' mounts, the trampoline, the massage table. Run from the repo:
//
//     node tools/venues/arena/plan.mjs > /tmp/arena-work/plan.json   (build_all.sh does it)
import { VENUES } from "../../../dist/spatial.mjs";

const v = VENUES.arena;
const round = (o) =>
  JSON.parse(JSON.stringify(o, (k, x) => (typeof x === "number" ? Math.round(x * 10000) / 10000 : x)));
const queue = [];
for (const side of [-1, 1]) for (let slot = 0; slot < 12; slot++) queue.push(v.queuePosition(side, slot));
console.log(
  JSON.stringify(
    round({
      pool: v.pool,
      deck: v.deck,
      room: v.room,
      doors: v.doors,
      arrival: v.arrival,
      queue,
      coachStart: v.coachStart,
      furniture: v.furniture,
      obstacles: v.obstacles,
      venueStations: v.stations,
      sanitation: v.sanitation,
      ringMounts: v.ringMounts,
      rescue: v.rescue,
      fixtures: v.fixtures,
      trampoline: v.trampoline,
    }),
  ),
);
