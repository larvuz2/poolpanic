// Senior Aqua Fit's plan for the Blender scripts, from the game's own modules (so every prop sits where the walks, the hit boxes
// and the labels are): the pool and its lanes (spatial.mjs's pool lines: the coping, the deck's walks round it), the deck and the
// room, the glass doors, the lounge's waiting places, the evacuation rows, the furniture, stations and fixtures (the massage table
// among them: the game draws it, scene/massage-view.mjs), and the conservatory's lines from the classic (scene/senior.mjs WALL,
// ROOF). Run from the repo:
//
//     node tools/venues/senior/plan.mjs > /tmp/senior-work/plan.json   (build_all.sh does it)
import { VENUES } from "../../../dist/spatial.mjs";

const v = VENUES.senior;
const round = (o) =>
  JSON.parse(JSON.stringify(o, (k, x) => (typeof x === "number" ? Math.round(x * 10000) / 10000 : x)));
const queue = [];
for (const side of [-1, 1]) for (let slot = 0; slot < 12; slot++) queue.push(v.queuePosition(side, slot));
// (sanitation.mjs: where the swimmers wait while the pool is closed, in columns along both long sides)
const evac = [];
for (const side of [-1, 1])
  for (let slot = 0; slot < 24; slot++)
    evac.push({ x: side * (v.pool.evacX + Math.floor(slot / 8) * 0.75), z: -2.7 + (slot % 8) * 1.35 });
const plan = {
  pool: v.pool,
  lanes: v.lanes,
  deck: v.deck,
  room: v.room,
  doors: v.doors,
  queue,
  evacSpots: evac,
  coachStart: v.coachStart,
  furniture: v.furniture,
  stations: v.stations,
  sanitation: v.sanitation,
  ringMounts: v.ringMounts,
  rescue: v.rescue,
  fixtures: v.fixtures,
  // (scene/senior.mjs: the conservatory's walls just outside the deck, the roof's eave and ridge)
  wall: { near: -15.1, far: 15.1, back: -16.0, end: 13.4 },
  roof: { eave: 5.2, ridge: 9.4 },
};
console.log(JSON.stringify(round(plan)));
