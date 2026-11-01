// The Lazy River's plan for the Blender scripts, from the game's own modules (so every prop sits where the walks, the hit boxes and
// the labels are): the river itself (dist/river.mjs through spatial.mjs's riverPlace: its centreline sampled every 0.25 m with the
// flow and the left normal, its half-width, the seen stretch, the bridge, the stepping stones, the docks and the tube return), the
// deck and the room, the jungle gate, the queue's places, the evacuation spots, the furniture, stations and fixtures, the rings'
// mounts. Run from the repo:
//
//     node tools/venues/river/plan.mjs > /tmp/river-work/plan.json   (build_all.sh does it)
import { VENUES } from "../../../dist/spatial.mjs";

const v = VENUES.river,
  r = v.river;
const round = (o) =>
  JSON.parse(JSON.stringify(o, (k, x) => (typeof x === "number" ? Math.round(x * 10000) / 10000 : x)));
const queue = [];
for (const side of [-1, 1]) for (let slot = 0; slot < 12; slot++) queue.push(v.queuePosition(side, slot));
const samples = [];
for (let s = 0; s <= r.length + 1e-6; s += 0.25) {
  const c = r.at(Math.min(s, r.length));
  samples.push({ s: c.s, x: c.x, z: c.z, tx: c.tx, tz: c.tz, nx: c.nx, nz: c.nz });
}
const plan = {
  river: {
    w: r.w,
    length: r.length,
    start: r.start,
    end: r.end,
    flow: r.flow,
    samples,
    bridge: r.bridge,
    stones: r.stones,
    docks: r.docks,
  },
  deck: v.deck,
  room: v.room,
  doors: v.doors,
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
  tubes: v.tubes,
};
console.log(JSON.stringify(round(plan)));
