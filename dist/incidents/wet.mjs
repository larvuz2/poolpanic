// 💧 Wet spots and the mop (16 October 2026, the creator: "a new mechanic that I want as a whole", in every pool). One in five
// swimmers who climb out of the pool leave a wet spot on the deck where they got out (`WET_TUNING.chance`, from a random stream of
// its own so nothing else in the shift moves). A spot never dries: it stays until the coach mops it. Anyone who walks or runs over
// one slips, gets cross and costs points (a failed little incident), and the coach who steps in one goes down for a moment too
// (coach.mjs, `coachSlip`), so the coach grabs the mop from its bucket (the mop fixture),
// walks over and mops (E). It is a chore, not an incident: it never counts towards the incidents a shift may run at once, and it
// never holds the clock.
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export const WET_TUNING = {
  chance: 0.2, // of each swimmer climbing out
  radius: 0.62, // of a spot, metres
  reach: 1.35, // how close the coach must be to mop it, or to the bucket
  mop: 0.8, // seconds of mopping
  penalty: 25, // points lost when someone slips in one
  mood: 12, // happiness lost by whoever slips (more than a puddle's 6)
  bonus: 10, // points for a spot mopped
  spacing: 1.1, // a new spot this close to an old one just makes the old one wetter
  max: 10, // spots on the deck at once
  coachSlip: 1.3, // seconds the coach is down when he steps in one (jump over it, or go round)
};
const T = WET_TUNING;

export const WetSpots = {
  key: "wet",
  init(sim) {
    sim.wetSpots = [];
    sim.wetSeed = 0;
    sim.mopState = { state: "bucket" };
  },
  // A chore, not an incident (never counted, never planned, never started by hand).
  isActive: () => false,
  describe(sim) {
    const n = sim.wetSpots.length;
    return n || sim.mopState.state === "coach" ? n + " wet · mop " + sim.mopState.state : "";
  },
  detail(sim) {
    return sim.wetSpots.length ? { spots: sim.wetSpots.length } : null;
  },
  alert(sim, alerts) {
    if (!sim.wetSpots.length) return;
    const c = sim.coach;
    if (c.carry === "mop") {
      const spot = nearest(sim, c);
      alerts.push({ kind: "wet", icon: "💧", label: "Wet spot", x: spot.x, z: spot.z, y: 0.9, urgency: 34 });
    } else
      alerts.push({ kind: "wet", icon: "🧽", label: "Mop", ...sim.venue.fixtures.mop, y: 1.7, urgency: 30 });
  },
  interactions(sim, options) {
    const c = sim.coach,
      bucket = sim.venue.fixtures.mop;
    if (!c.carry && sim.mopState.state === "bucket" && distance(c, bucket) < T.reach)
      options.push({
        kind: "mop",
        label: "Grab the mop",
        ...bucket,
        rank: (sim.wetSpots.length ? 0.5 : 3) + distance(c, bucket),
        run: () => grabMop(sim),
      });
    if (c.carry !== "mop") return;
    const spot = nearest(sim, c);
    if (spot && distance(c, spot) < T.reach)
      options.push({
        kind: "mop-spot",
        label: "Mop up the wet spot",
        x: spot.x,
        z: spot.z,
        rank: -40 + distance(c, spot),
        run: () => mopSpot(sim, spot),
      });
    if (distance(c, bucket) < T.reach)
      options.push({
        kind: "return-mop",
        label: "Put the mop back",
        ...bucket,
        rank: 30 + distance(c, bucket),
        run: () => returnMop(sim),
      });
  },
  returnItem(sim) {
    if (sim.coach.carry !== "mop") return undefined;
    return returnMop(sim);
  },
  hint(sim) {
    const n = sim.wetSpots.length;
    if (sim.coach.carry === "mop")
      return n ? "💧 Mop the wet spot" + (n > 1 ? "s" : "") + " · E" : "Put the mop back in its bucket · E";
    return n ? "💧 Wet spot on the deck! Grab the mop (Q)" : "";
  },
  // A swimmer has just climbed out onto the deck at `where`: one in five drips a wet spot there.
  climbedOut(sim, p, where) {
    if (wetRandom(sim) >= (sim.venue.wetChance ?? T.chance) || sim.status !== "playing") return null;
    return addWetSpot(sim, where.x, where.z);
  },
};

// The spots' own random stream, seeded from the shift's seed (so a replay drips the same spots).
function wetRandom(sim) {
  if (!sim.wetSeed) sim.wetSeed = (sim.seed ^ 0x5bd1e995) >>> 0 || 7;
  sim.wetSeed = (Math.imul(sim.wetSeed, 1664525) + 1013904223) >>> 0;
  return sim.wetSeed / 4294967296;
}

export function addWetSpot(sim, x, z) {
  if (!sim.venue.isDeck(x, z, sim.level, 0)) return null;
  const near = sim.wetSpots.find((s) => distance(s, { x, z }) < T.spacing);
  if (near) {
    near.r = Math.min(0.95, near.r + 0.08);
    return near;
  }
  if (sim.wetSpots.length >= T.max) return null;
  const spot = { id: ++sim.uid, x, z, r: T.radius, born: sim.time };
  sim.wetSpots.push(spot);
  sim.emit("wet-spot", { id: spot.id, x, z });
  if (!sim.wetTold) {
    sim.wetTold = true;
    sim.incident("wet", spot, { id: spot.id });
    sim.emit("toast", {
      text: "💧 A swimmer dripped a wet spot on the deck. Someone will slip! Grab the mop (Q).",
      warning: true,
    });
  }
  return spot;
}
export const wetSpotAt = (sim, x, z, reach = 0) =>
  sim.wetSpots?.find((s) => Math.hypot(x - s.x, z - s.z) < s.r + reach) || null;

// Someone slipped in `spot` (sim.tickDeckTrip has made them slip): they are cross, and it costs points.
export function slippedInWet(sim, p, spot) {
  p.h = Math.max(0, p.h - (T.mood - 6));
  p.deckPenalty = (p.deckPenalty || 0) + (T.mood - 6);
  p.wetSlips = (p.wetSlips || 0) + 1;
  sim.score -= T.penalty;
  sim.stats.wetSlips = (sim.stats.wetSlips || 0) + 1;
  sim.streak = 0;
  sim.emit("points", { x: p.x, z: p.z, value: -T.penalty });
  sim.emit("wet-slip", { id: p.id, spot: spot.id, x: spot.x, z: spot.z });
  if ((sim.stats.wetSlips || 0) <= 2 || sim.time - (sim.wetSlipToast ?? -99) > 15) {
    sim.wetSlipToast = sim.time;
    sim.emit("toast", {
      text: p.name + " slipped on a wet spot! −" + T.penalty + " · Mop it up (Q)",
      warning: true,
    });
  }
}

function nearest(sim, from) {
  return [...sim.wetSpots].sort((a, b) => distance(a, from) - distance(b, from))[0] || null;
}
function grabMop(sim) {
  const c = sim.coach,
    bucket = sim.venue.fixtures.mop;
  if (!sim.canInteract() || c.carry || sim.mopState.state !== "bucket") return false;
  if (distance(c, bucket) > T.reach)
    return sim.guideTo(bucket, "The mop is in its yellow bucket. Walk over and press E.");
  c.carry = "mop";
  sim.mopState.state = "coach";
  sim.feedback("pickup");
  return true;
}
function mopSpot(sim, spot) {
  const c = sim.coach;
  if (!sim.canInteract() || c.carry !== "mop") return false;
  if (distance(c, spot) > T.reach) return sim.guideTo(spot, "Walk onto the wet spot and press E to mop it.");
  return sim.startBusy(
    "mop",
    T.mop,
    "Mopping…",
    () => {
      if (!sim.wetSpots.includes(spot)) return;
      sim.wetSpots = sim.wetSpots.filter((s) => s !== spot);
      sim.score += T.bonus;
      sim.stats.mopped = (sim.stats.mopped || 0) + 1;
      sim.emit("points", { x: spot.x, z: spot.z, value: T.bonus });
      sim.save("mopped", spot, T.bonus);
      sim.emit("mopped", { id: spot.id, x: spot.x, z: spot.z });
    },
    spot,
  );
}
function returnMop(sim) {
  const c = sim.coach,
    bucket = sim.venue.fixtures.mop;
  if (c.carry !== "mop" || !sim.canInteract()) return false;
  if (distance(c, bucket) > T.reach) return sim.guideTo(bucket, "Put the mop back in its bucket.");
  c.carry = null;
  sim.mopState.state = "bucket";
  sim.feedback("pickup");
  return true;
}
// The mop button (Q): grab it, or walk to the nearest wet spot with it, or put it back when the deck is dry.
export function useMop(sim) {
  const c = sim.coach,
    bucket = sim.venue.fixtures.mop;
  if (sim.status !== "playing") return false;
  if (c.carry === "mop") {
    const spot = nearest(sim, c);
    if (spot)
      return distance(c, spot) < T.reach
        ? mopSpot(sim, spot)
        : sim.guideTo(spot, "Walk onto the wet spot and press E to mop it.");
    return returnMop(sim);
  }
  if (c.carry) {
    sim.emit("toast", { text: "Hands full. Put that down before you grab the mop." });
    return false;
  }
  return grabMop(sim);
}
