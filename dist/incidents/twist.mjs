// Mid-shift twists. Halfway through a shift the room changes the rules, the way an Overcooked kitchen changes its
// layout: a crowd arrives at once, a lane closes, a swim team or an aqua class takes over the arrivals, a storm rolls
// in and wets the deck. A twist is
// not an incident (nothing to fix, nothing to save): it is a new condition for the rest of the shift, announced
// with a sting. Twists ride in the chaos plan (so a check that empties `chaosPlan` empties them too) and use only
// the systems that already exist. They wait out a rescue, a cleanup or a closed pool, and never start in the last
// seconds of a shift.

export const TWIST_TUNING = {
  rushMin: 3, // extra swimmers in a rush, at least...
  rushShare: 0.28, // ...or this share of the shift's swimmers
  rushSpread: 0.85, // seconds between the extra arrivals
  lane: 1, // the lane a closure takes (never the splash lane)
  teamMix: [0.05, 0.2, 0.98], // arrivals after a swim team turns up: beginner / intermediate / pro / aqua cut-offs
  classMix: [0.1, 0.2, 0.3], // ...and after an aqua class
  stormRamp: 6, // seconds for the sky to darken and the rain to arrive
};
const T = TWIST_TUNING;

export const TWISTS = {
  rush: { icon: "🚌" },
  closure: { icon: "🚧" },
  team: { icon: "🏅" },
  class: { icon: "💦" },
  storm: { icon: "⛈️" },
};

// `config.twist` is one entry or a list: { kind, at (fraction of the shift), lane?, count? }.
export function planTwists(config) {
  return []
    .concat(config.twist || [])
    .filter((t) => TWISTS[t.kind])
    .map((t) => ({ kind: "twist", twist: t, at: t.at * config.duration, done: false }));
}

// Called by the chaos layer when a twist's time comes. Returns true when it started.
export function startTwist(sim, entry) {
  const t = entry.twist,
    door = sim.venue.arrival,
    doorSpot = { x: -door.doorX, z: door.doorZ };
  if (t.kind === "rush") {
    const n = t.count ?? Math.max(T.rushMin, Math.round(sim.config.total * T.rushShare)),
      extras = Array.from({ length: n }, (_, i) => ({
        at: sim.arrivalTime + 1 + i * T.rushSpread,
        type: null,
        sick: false,
      }));
    // Weave the crowd into the arrivals still to come, keeping the list in time order.
    const rest = sim.schedule.splice(sim.nextArrival);
    sim.schedule.push(...[...rest, ...extras].sort((a, b) => a.at - b.at));
    sim.incident("rush", doorSpot, { count: n });
  } else if (t.kind === "closure") {
    const tr = sim.venue.trampoline;
    let lane = Math.min(t.lane ?? T.lane, sim.lanes.length - 1);
    if (tr && lane === tr.lane) lane = Math.max(0, lane - 1);
    sim.laneClosure = lane;
    sim.incident("closure", { x: sim.lanes[lane], z: 0 }, { lane: lane + 1 });
  } else if (t.kind === "team") {
    sim.mixOverride = T.teamMix;
    sim.incident("team", doorSpot);
  } else if (t.kind === "class") {
    sim.mixOverride = T.classMix;
    sim.incident("class", doorSpot);
  } else if (t.kind === "storm") {
    // The weather itself lives in the chaos layer (stormLevel, rain puddles); the scene reads stormLevel().
    sim.storm = { start: sim.time, ramp: T.stormRamp, next: 1.5 };
    sim.incident("storm", sim.coach);
  }
  return true;
}
