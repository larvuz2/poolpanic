// The Wave Pool's plan for the Blender scripts, from the game's own modules (so every prop sits where the walks, the hit boxes and the
// labels are): the basin and its floor's profile (waves.mjs), the five wave chambers (scene/wave.mjs), the deck and the room, the
// gate, the waiting rows inside it, the towels the bathers rest on, the evacuation spots on the sand, and the venue's furniture,
// stations and fixtures (spatial.mjs WAVE). Run from the repo:
//
//     node tools/venues/wave/plan.mjs > /tmp/wave-work/plan.json   (build_all.sh does it)
import { WAVE, floorAt } from "../../../dist/waves.mjs";
import { CHAMBERS } from "../../../dist/scene/wave.mjs";
import { VENUES } from "../../../dist/spatial.mjs";

const v = VENUES.wave;
const round = (o) =>
  JSON.parse(JSON.stringify(o, (k, x) => (typeof x === "number" ? Math.round(x * 10000) / 10000 : x)));
// the floor's profile along x, from the deck on the near side down the beach and across the pool to the wave house
const profile = [];
for (let x = -10.6; x <= WAVE.halfX + 1e-6; x += 0.1) profile.push([x, floorAt(x)]);
const queue = [];
for (const side of [-1, 1]) for (let slot = 0; slot < 12; slot++) queue.push(v.queuePosition(side, slot));
const plan = {
  wave: WAVE,
  chambers: CHAMBERS,
  chamberWidth: 2.5,
  sandEdge: -10.6, // (scene/wave.mjs SAND_EDGE: where the sand meets the deck on the near side)
  profile,
  deck: v.deck,
  room: v.room,
  doors: v.doors,
  queue,
  // (wave-pool.mjs: the towels a bather rests on, and where a helped-out bather lies; the classic's towels at these z)
  towels: [-6.8, -4.4, 2.6, 4.8, 7.0].map((z) => ({ x: -9.75, z })),
  evacSpots: v.evacSpots,
  coachStart: v.coachStart,
  furniture: v.furniture,
  stations: v.stations,
  sanitation: v.sanitation,
  ringMounts: v.ringMounts,
  rescue: v.rescue,
  fixtures: v.fixtures,
  tubes: v.tubes,
};
console.log(JSON.stringify(round(plan)));
