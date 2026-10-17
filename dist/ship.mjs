// The cruise ship rolls (18 October 2026, the creator: "the ship is moving left and right, not in a rhythmic way, but spontaneously.
// Sometimes it stays without movement, but then it swings to one side. All of the furniture on top, and even the people on deck
// running or waiting, start to go to the left if the ship leans to the left, and to the right if the ship leans to the right").
//
// The roll (`sim.ship.angle`, radians; positive: the right side, starboard, +z, goes down) comes from a stream of its own and is
// never a rhythm: the ship lies still for a while (a faint sway), then a swell leans it over to one side, holds it there, and lets
// it back, or throws it over to the other side first. The big swells are announced a few seconds ahead (the bridge sees them
// coming: the ship's bell, a banner); the small ones just happen. What it does:
//
// - **Everything loose slides downhill**: the people on the deck (walking, waiting in the queue, a little less: they brace), the
//   coach himself (harder to walk uphill, quicker down), and the sun loungers, each along its row with a little friction (they
//   stay put in a gentle lean, then go, bump into each other and pile up at the row's low end). A lounger out of its place is no
//   good to anyone (`adrift`): nobody takes it, a guest lying on one rides along and minds; the coach straightens the row (E).
// - **Into the pool**: someone slid off the deck into the water in a big lean (`fell-in`): soaked, cross, points lost; the coach
//   helps them out at the edge (E) before they climb out by themselves, furious.
// - **The water sloshes**: it rides up the low end of the pool and, in a big lean, over it: wet spots on the deck there.
// - **In the water**: lap swimmers go faster downhill and slower uphill (so they bunch up); the guests chilling in the free half
//   drift to its low end.
//
// Pure simulation (seeded): the scene reads `sim.ship` to tip the deck, the sea and the water.
import { CRUISE, LOUNGERS, loungerSpot } from "./cruise-plan.mjs";
import { addWetSpot } from "./incidents/wet.mjs";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const DEG = Math.PI / 180;
const smooth = (t) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};

export const SHIP = {
  firstSwell: [6, 9], // s before the first swell
  calm: [[9, 15], [5, 9]], // s of calm between swells, at level 1 and at level 20
  small: [3.5, 6.5], // degrees: a swell nobody announces
  big: [
    [7.5, 9.5],
    [11, 14.5],
  ], // degrees of a big swell, level 1 and level 20
  bigChance: [0.35, 0.72],
  ramp: [1.6, 2.6], // s leaning over (a big swell: ×1.2)
  hold: [1.4, 4.0], // s held over
  back: [1.8, 3.0], // s back to level
  over: 0.32, // chance a big swell throws the ship over to the other side before it settles
  warn: 2.6, // s of warning before a big swell
  sway: 0.6, // degrees of the faint sway in a calm
  // What slides: nothing below `slideFrom` degrees, everything at full speed from `slideFull`.
  slideFrom: 3.5,
  slideFull: 13,
  walk: 2.2, // m/s a person on deck drifts at full slide
  brace: 0.45, // someone standing (the queue) braces: this share of it
  coach: 1.9, // m/s the coach drifts at full slide
  water: 0.55, // m/s a guest chilling in the water drifts at full slide
  swim: 0.55, // lap swimmers: up to this much faster downhill, slower uphill
  // A sun lounger on its row: it starts to slide past `stick` degrees, and slides with `rub` friction; `gap` between two.
  stick: 5.5,
  rub: 0.07,
  gravity: 9.8,
  gap: 0.78,
  adrift: 0.45, // m out of its place: adrift
  ride: 0.5, // mood a second lost by a guest lying on an adrift lounger
  straighten: 1.2, // s to straighten a row
  straightenPoints: 6, // a lounger put back
  // Into the pool: only in a big lean, at most this many a swell.
  fallFrom: 7.5,
  fallsPerSwell: 2,
  fallCost: 40,
  fallMood: 15,
  helped: 40,
  climbOut: 10, // s before they climb out by themselves, furious
  climbOutMood: 30,
  reach: 1.9, // how close the coach must be to the edge by them
  // The slosh: the water rides up the low end (m at the end of the pool), a spring that lags the roll; over `spill` it spills.
  sloshK: 7,
  sloshDamp: 2.2,
  sloshScale: 0.32,
  spill: 0.36,
  spillsPerSwell: 2,
};
const T = SHIP;

// The ship's own random stream (a replay rolls the same; nothing else in the shift moves).
export function shipRandom(sim) {
  sim.shipSeed = (Math.imul(sim.shipSeed || 9, 1664525) + 1013904223) >>> 0;
  return sim.shipSeed / 4294967296;
}
const between = (sim, [a, b]) => a + shipRandom(sim) * (b - a);
const byLevel = (sim, [a, b]) => {
  const k = clamp((sim.level - 1) / 19, 0, 1);
  return Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * k) : a + (b - a) * k;
};

export function createShip(sim) {
  sim.shipSeed = (sim.seed ^ 0x5eaf00d) >>> 0 || 13;
  return {
    angle: 0, // radians, + is starboard (+z) down
    phase: "calm", // calm · warn · lean · hold · back
    t: 0,
    dur: between(sim, T.firstSwell),
    from: 0,
    to: 0,
    side: 0,
    amp: 0, // degrees of the swell under way
    big: false,
    overDone: false,
    swells: 0,
    falls: 0, // into the pool this swell
    spills: 0, // spills this swell
    slosh: 0, // m the water stands up at the +z end (negative: the -z end)
    sloshV: 0,
    loungers: LOUNGERS.map((l) => ({ z: l.home, vz: 0 })),
    sliding: false,
  };
}

// How hard things slide now: -1..1 (the sign is the way down, along z).
export function slide(sim) {
  const deg = (sim.ship?.angle || 0) / DEG,
    k = clamp((Math.abs(deg) - T.slideFrom) / (T.slideFull - T.slideFrom), 0, 1);
  return Math.sign(deg) * k;
}

// ---- the roll ----------------------------------------------------------------------------------------------------------

function nextSwell(sim) {
  const S = sim.ship,
    big = shipRandom(sim) < byLevel(sim, T.bigChance),
    side = shipRandom(sim) < 0.5 ? -1 : 1,
    amp = big ? between(sim, byLevel(sim, T.big)) : between(sim, T.small);
  S.side = side;
  S.amp = amp;
  S.big = big;
  S.overDone = false;
  S.falls = 0;
  S.spills = 0;
  S.swells++;
  if (big) {
    S.phase = "warn";
    S.t = 0;
    S.dur = T.warn;
    sim.emit("swell-warning", { side, amp, at: sim.time + T.warn });
    if (S.swells <= 2 || !S.warnTold) {
      S.warnTold = true;
      sim.emit("toast", {
        text:
          "🔔 Big swell coming! The ship will roll to " +
          (side < 0 ? "port (left)" : "starboard (right)") +
          ": everything loose will slide that way. Get people away from the pool's ends!",
        warning: true,
      });
    }
  } else lean(sim, side * amp, between(sim, T.ramp));
}
function lean(sim, to, dur) {
  const S = sim.ship;
  S.phase = "lean";
  S.t = 0;
  S.from = S.angle;
  S.to = to * DEG;
  S.dur = dur;
  sim.emit("roll", { side: Math.sign(to), amp: Math.abs(to), big: S.big });
}
function stepRoll(sim, dt) {
  const S = sim.ship;
  S.t += dt;
  const sway = (Math.sin(sim.time * 0.7) * 0.7 + Math.sin(sim.time * 1.9 + 1.3) * 0.3) * T.sway * DEG;
  if (S.phase === "calm" || S.phase === "warn") {
    S.angle = sway;
    if (S.t < S.dur) return;
    if (S.phase === "warn") return lean(sim, S.side * S.amp, between(sim, T.ramp) * 1.2);
    return nextSwell(sim);
  }
  if (S.phase === "lean" || S.phase === "back") {
    const k = smooth(S.t / S.dur);
    S.angle = S.from + (S.to - S.from) * k + (S.phase === "back" ? sway * k : 0);
    if (S.t < S.dur) return;
    if (S.phase === "back") {
      S.phase = "calm";
      S.t = 0;
      S.dur = between(sim, byLevel(sim, T.calm));
      sim.emit("settled", {});
      return;
    }
    S.phase = "hold";
    S.t = 0;
    S.dur = between(sim, T.hold);
    return;
  }
  // Held over, with a little wobble; then back to level, or (a big swell, now and then) over to the other side first.
  S.angle = S.to + Math.sin(S.t * 2.3) * 0.5 * DEG;
  if (S.t < S.dur) return;
  if (S.big && !S.overDone && shipRandom(sim) < T.over) {
    S.overDone = true;
    S.side = -S.side;
    S.amp *= 0.8 + shipRandom(sim) * 0.25;
    S.falls = 0;
    S.spills = 0;
    return lean(sim, S.side * S.amp, between(sim, T.ramp) * 1.3);
  }
  S.phase = "back";
  S.t = 0;
  S.from = S.angle;
  S.to = 0;
  S.dur = between(sim, T.back);
}

// ---- every frame -------------------------------------------------------------------------------------------------------

// The roll, the loungers, the slosh and the people who fell in (before anyone moves).
export function updateShip(sim, dt) {
  const S = sim.ship;
  if (!S || sim.status !== "playing") return;
  stepRoll(sim, dt);
  slideLoungers(sim, dt);
  slosh(sim, dt);
  for (const p of sim.people) if (p.status === "fell-in") tickFallen(sim, p, dt);
}

// After everyone has moved: what is loose on the deck drifts downhill (the coach drifts in coach.mjs).
const ON_DECK = new Set(["arriving", "queue", "enter", "exit", "fleeing", "evacuating", "recovering", "panic"]);
export function driftDeck(sim, dt) {
  const S = sim.ship;
  if (!S) return;
  const k = slide(sim);
  for (const p of sim.people) {
    p.sliding = false;
    if (p.status === "swim" && p.chill) {
      if (k) driftInWater(sim, p, k, dt);
      continue;
    }
    if (!ON_DECK.has(p.status) || !onDeck(sim, p)) continue;
    if (!k) {
      if (p.status === "queue" && !p.path?.length) backInLine(sim, p, dt);
      continue;
    }
    const standing = p.status === "queue" || p.status === "panic" || (p.actualSpeed || 0) < 0.2;
    const dz = k * T.walk * (standing ? T.brace : 1) * dt,
      z = p.z + dz;
    if (sim.venue.isDeck(p.x, z, sim.level, 0.2)) {
      p.z = z;
      p.sliding = true;
      continue;
    }
    // Off the deck: into the pool in a big lean (at most a couple a swell), else they catch themselves at the edge.
    if (inPool(p.x, z) && Math.abs(S.angle / DEG) >= T.fallFrom && S.falls < T.fallsPerSwell && canFall(sim, p))
      fallIn(sim, p, dz);
  }
}
// On the deck proper: not in a doorway, not climbing out, not stepping into the water or onto a lounger.
function onDeck(sim, p) {
  if (p.arrivalHold > 0 || p.stepT > 0 || p.evacWater || p.recoveryStage === "resting") return false;
  if (["water", "climb"].includes(p.exitPhase)) return false;
  if (p.status === "fleeing" && p.fleePhase !== "run") return false;
  return sim.venue.isDeck(p.x, p.z, sim.level, 0);
}
const inPool = (x, z) =>
  Math.abs(z) < CRUISE.halfZ + 0.2 && x > -CRUISE.halfX - 0.2 && x < CRUISE.free.x1 + 0.2;
const canFall = (sim, p) => !p.vip || sim.level >= 6;
// A guest who stood in the queue and was shoved out of it steps back to their place when the deck is level again.
function backInLine(sim, p, dt) {
  const spot = sim.venue.queuePosition(p.side, p.queueSlot),
    d = distance(p, spot);
  if (d < 0.04) return;
  const step = Math.min(d, 1.3 * dt);
  p.x += ((spot.x - p.x) / d) * step;
  p.z += ((spot.z - p.z) / d) * step;
}
function driftInWater(sim, p, k, dt) {
  const W = sim.venue.chill.water;
  p.z = clamp(p.z + k * T.water * dt, W.z0 + 0.45, W.z1 - 0.45);
}
// The coach's drift (m/s along z), for coach.mjs: not in the water, not mid-jump.
export function coachDrift(sim) {
  const c = sim.coach;
  if (!sim.ship || c.swimming || c.wading || c.waterTransition || c.y > 0.05 || c.busy) return 0;
  return slide(sim) * T.coach;
}
// Lap swimmers: faster downhill (the lanes run along z), slower uphill. `pp` is the swimmer's place on the lane's circuit.
export function swimLean(sim, pp) {
  const k = slide(sim);
  if (!k) return 1;
  const dir = pp < 14.4 ? 1 : pp >= 15.6 && pp < 30 ? -1 : 0;
  return clamp(1 + k * dir * T.swim, 0.45, 1.6);
}

// ---- the loungers ------------------------------------------------------------------------------------------------------

function slideLoungers(sim, dt) {
  const S = sim.ship,
    g = T.gravity,
    sin = Math.sin(S.angle),
    cos = Math.cos(S.angle),
    stuck = Math.abs(S.angle) < T.stick * DEG;
  let moving = 0;
  CRUISE.rows.forEach((row, r) => {
    const ids = LOUNGERS.filter((l) => l.row === r).map((l) => l.id);
    for (const id of ids) {
      const L = S.loungers[id],
        loaded = sim.roof?.beds[id]?.guest && sim.get(sim.roof.beds[id].guest)?.status === "lounge";
      if (stuck && Math.abs(L.vz) < 0.05) {
        L.vz = 0;
        continue;
      }
      // Downhill pull against the friction (a lounger with someone on it is a little stickier).
      const rub = T.rub * (loaded ? 1.4 : 1) * g * cos,
        pull = g * sin * 0.55,
        dir = L.vz ? Math.sign(L.vz) : Math.sign(pull);
      let a = pull - dir * rub;
      if (!L.vz && Math.abs(pull) <= rub) a = 0;
      L.vz += a * dt;
      if (L.vz && Math.sign(L.vz) !== dir && Math.abs(pull) <= rub) L.vz = 0;
      L.vz = clamp(L.vz, -3, 3);
      L.z += L.vz * dt;
      if (Math.abs(L.vz) > 0.2) moving++;
    }
    // Bump into each other and stop at the row's ends.
    const order = ids.slice().sort((a, b) => S.loungers[a].z - S.loungers[b].z),
      half = CRUISE.lounger.hz;
    for (let pass = 0; pass < 2; pass++) {
      const lo = row.z0 + half,
        hi = row.z1 - half;
      for (let i = 0; i < order.length; i++) {
        const L = S.loungers[order[i]];
        const min = i === 0 ? lo : S.loungers[order[i - 1]].z + T.gap;
        if (L.z < min) {
          L.z = min;
          if (L.vz < 0) L.vz = i === 0 ? 0 : S.loungers[order[i - 1]].vz;
        }
      }
      for (let i = order.length - 1; i >= 0; i--) {
        const L = S.loungers[order[i]];
        const max = i === order.length - 1 ? hi : S.loungers[order[i + 1]].z - T.gap;
        if (L.z > max) {
          L.z = max;
          if (L.vz > 0) L.vz = i === order.length - 1 ? 0 : S.loungers[order[i + 1]].vz;
        }
      }
    }
  });
  if (moving && !S.sliding) sim.emit("loungers-slide", { count: moving, side: Math.sign(S.angle) });
  S.sliding = moving > 0;
  // Who is lying on one rides along; a lounger out of its place is adrift.
  if (!sim.roof) return;
  for (const bed of sim.roof.beds) {
    const L = S.loungers[bed.id],
      was = bed.adrift;
    bed.adrift = Math.abs(L.z - LOUNGERS[bed.id].home) > T.adrift;
    if (bed.adrift && !was && !S.adriftTold) {
      S.adriftTold = true;
      sim.emit("toast", {
        text: "🛏️ The loungers are sliding about! Nobody wants one out of its place: straighten the row (E by it).",
        warning: true,
      });
    }
    const p = bed.guest && sim.get(bed.guest);
    if (!p) continue;
    if (p.status === "lounge") {
      p.z = L.z;
      if (bed.adrift) p.h = Math.max(0, p.h - T.ride * dt * (p.vip ? 1.5 : 1));
    } else if (p.status === "enter" && p.goal === "bed" && !p.stepT) {
      // On the way to a lounger that has moved: to where it is now.
      const foot = loungerSpot(sim, bed.id).foot,
        end = p.path[p.path.length - 1];
      if (!end || distance(end, foot) > 0.5) p.path = sim.venue.chill.route(p, foot);
    }
  }
}
// The coach puts a row of loungers back in its place (E by an adrift one).
export function straightenRow(sim, row) {
  const c = sim.coach,
    S = sim.ship,
    ids = LOUNGERS.filter((l) => l.row === row).map((l) => l.id),
    out = ids.filter((id) => sim.roof.beds[id].adrift);
  if (!out.length) return false;
  const near = loungerSpot(sim, out[0]).foot;
  if (!sim.canInteract() || c.carry) return false;
  return sim.startBusy(
    "straighten",
    T.straighten,
    "Straightening the loungers",
    () => {
      let moved = 0;
      for (const id of ids) {
        const L = S.loungers[id];
        if (Math.abs(L.z - LOUNGERS[id].home) > 0.05) moved++;
        L.z = LOUNGERS[id].home;
        L.vz = 0;
        const bed = sim.roof.beds[id];
        bed.adrift = false;
        const p = bed.guest && sim.get(bed.guest);
        if (p?.status === "lounge") {
          p.z = L.z;
          p.h = Math.min(100, p.h + 4);
        }
      }
      const points = Math.min(30, moved * T.straightenPoints);
      sim.score += points;
      sim.stats.straightened = (sim.stats.straightened || 0) + moved;
      sim.emit("points", { x: near.x, z: near.z, value: points });
      sim.emit("straightened", { row, moved, x: near.x, z: near.z });
    },
    near,
  );
}
// The adrift loungers within the coach's reach, by row (for E and the bot).
export function adriftRowNear(sim, at = sim.coach, reach = 1.6) {
  if (!sim.roof || !sim.ship) return null;
  for (const bed of sim.roof.beds) {
    if (!bed.adrift) continue;
    const spot = loungerSpot(sim, bed.id);
    if (distance(at, spot.foot) <= reach || distance(at, { x: spot.foot.x, z: LOUNGERS[bed.id].home }) <= reach)
      return LOUNGERS[bed.id].row;
  }
  return null;
}

// ---- the slosh ---------------------------------------------------------------------------------------------------------

function slosh(sim, dt) {
  const S = sim.ship,
    target = Math.tan(S.angle) * CRUISE.halfZ * T.sloshScale;
  S.sloshV += (T.sloshK * (target - S.slosh) - T.sloshDamp * S.sloshV) * dt;
  S.slosh += S.sloshV * dt;
  if (Math.abs(S.slosh) < T.spill || S.spills >= T.spillsPerSwell || sim.cleanup || sim.closed) return;
  // Over the low end: a wet spot on the deck there (once each time it rides over).
  if (S.spillCool > 0) {
    S.spillCool -= dt;
    return;
  }
  S.spillCool = 1.2;
  const s = Math.sign(S.slosh),
    x = -CRUISE.halfX + 0.6 + shipRandom(sim) * (CRUISE.free.x1 - 1.2 + CRUISE.halfX),
    spot = addWetSpot(sim, x, s * (CRUISE.halfZ + 0.95));
  S.spills++;
  sim.emit("spill", { side: s, x, z: s * (CRUISE.halfZ + 0.6) });
  if (spot && !S.spillTold) {
    S.spillTold = true;
    sim.emit("toast", { text: "🌊 The pool sloshed over the end! A wet spot on the deck: mop it (Q).", warning: true });
  }
}

// ---- into the pool -----------------------------------------------------------------------------------------------------

function fallIn(sim, p, dz) {
  const S = sim.ship,
    s = Math.sign(dz) || 1,
    // Where they went over (on the deck at the pool's end), and where they are now (in the water just past it).
    edge = { x: clamp(p.x, -CRUISE.halfX + 0.4, CRUISE.free.x1 - 0.4), z: -s * (CRUISE.halfZ + 0.75) },
    water = { x: edge.x, z: -s * (CRUISE.halfZ - 0.7) };
  S.falls++;
  p.fallen = {
    status: p.status,
    path: p.path ? p.path.map((q) => ({ ...q })) : [],
    goal: p.goal ?? null,
    edge,
    t: 0,
  };
  p.status = "fell-in";
  p.problem = "fell-in";
  p.x = water.x;
  p.z = water.z;
  p.path = [];
  p.actualSpeed = 0;
  p.h = Math.max(0, p.h - T.fallMood);
  sim.score -= T.fallCost;
  sim.streak = 0;
  sim.stats.fellIn = (sim.stats.fellIn || 0) + 1;
  if (sim.selected === p.id) sim.selected = null;
  sim.emit("splash", { x: p.x, z: p.z });
  sim.emit("fell-in", { id: p.id, x: p.x, z: p.z });
  sim.emit("points", { x: p.x, z: p.z, value: -T.fallCost });
  sim.incident("fell-in", p, { id: p.id, name: p.name });
  sim.emit("toast", {
    text: "SPLASH! " + p.name + " slid right into the pool! −" + T.fallCost + " · Help them out (E at the edge)!",
    warning: true,
  });
}
function tickFallen(sim, p, dt) {
  const f = p.fallen;
  f.t += dt;
  if (f.t < T.climbOut) return;
  // Nobody came: out by themselves, dripping and furious.
  p.h = Math.max(0, p.h - T.climbOutMood);
  addWetSpot(sim, f.edge.x, f.edge.z);
  backOnDeck(sim, p);
  if (p.h <= 0) sim.lose(p);
  else sim.emit("toast", { text: p.name + " climbed out on their own, soaked and furious.", warning: true });
}
function backOnDeck(sim, p) {
  const f = p.fallen;
  p.fallen = null;
  p.problem = null;
  p.x = f.edge.x;
  p.z = f.edge.z;
  p.status = f.status;
  p.goal = f.goal;
  p.stunned = Math.max(p.stunned || 0, 1);
  // Back to what they were doing: the queue (they step back into line), or the way they were going (round the pool).
  if (p.status === "queue" || !f.path.length) p.path = [];
  else p.path = [...sim.venue.route(p, f.path[0]), ...f.path.slice(1)];
  if (p.status === "fleeing") p.fleePhase = "run";
}
// The coach helps them out, from the deck at the edge by them.
export function helpOut(sim, p) {
  if (!p || p.status !== "fell-in") return false;
  const c = sim.coach,
    at = p.fallen.edge;
  if (distance(c, at) > T.reach) return sim.guideTo(at, "Get to the pool's edge by " + p.name + " and press E.");
  if (!sim.canInteract()) return false;
  return sim.startBusy(
    "help-out",
    0.9,
    "Helping " + p.name + " out",
    () => {
      if (p.status !== "fell-in") return;
      p.h = Math.min(100, p.h + 6);
      backOnDeck(sim, p);
      sim.score += T.helped;
      sim.emit("points", { x: p.x, z: p.z, value: T.helped });
      sim.save("helped-out", p, T.helped, { id: p.id, name: p.name });
      sim.emit("toast", { text: "Up you come! " + p.name + " is back on deck. +" + T.helped });
    },
    at,
  );
}

// ---- the ship as a system (chaos.mjs SYSTEMS): alerts, the coach's options, hints, the banner, the diary ------------------

export const ShipDeck = {
  key: "ship",
  // Not an incident: the venue's own life (it never counts towards the incidents a shift may run at once).
  isActive: () => false,
  describe(sim) {
    const S = sim.ship;
    if (!S) return "";
    const adrift = sim.roof?.beds.filter((b) => b.adrift).length || 0,
      fallen = sim.people.filter((p) => p.status === "fell-in").length;
    return (
      (S.angle / DEG).toFixed(1) + "° " + S.phase + (adrift ? " · " + adrift + " adrift" : "") + (fallen ? " · " + fallen + " in" : "")
    );
  },
  detail(sim) {
    const S = sim.ship;
    if (!S) return null;
    return {
      angle: +(S.angle / DEG).toFixed(1),
      phase: S.phase,
      adrift: sim.roof?.beds.filter((b) => b.adrift).length || 0,
      fellIn: sim.people.filter((p) => p.status === "fell-in").length,
    };
  },
  alert(sim, alerts) {
    if (!sim.ship) return;
    for (const p of sim.people)
      if (p.status === "fell-in")
        alerts.push({ kind: "fell-in", icon: "🆘", label: p.name, x: p.x, z: p.z, y: 1.2, urgency: 90, id: p.id });
    const rows = new Set(sim.roof?.beds.filter((b) => b.adrift).map((b) => LOUNGERS[b.id].row));
    for (const r of rows) {
      const row = CRUISE.rows[r];
      alerts.push({
        kind: "adrift",
        icon: "🛏️",
        label: "Loungers adrift",
        x: row.x + row.facing * 1.4,
        z: (row.z0 + row.z1) / 2,
        y: 1.1,
        urgency: 24,
      });
    }
  },
  interactions(sim, options) {
    if (!sim.ship) return;
    const c = sim.coach;
    for (const p of sim.people)
      if (p.status === "fell-in" && distance(c, p.fallen.edge) <= T.reach)
        options.push({
          kind: "assist",
          id: p.id,
          label: "Help " + p.name + " out of the pool",
          x: p.fallen.edge.x,
          z: p.fallen.edge.z,
          rank: -72 + distance(c, p.fallen.edge),
          run: () => helpOut(sim, p),
        });
    const row = c.carry ? null : adriftRowNear(sim);
    if (row != null)
      options.push({
        kind: "tidy",
        label: "Straighten the loungers",
        x: c.x,
        z: c.z,
        rank: 0.8,
        run: () => straightenRow(sim, row),
      });
  },
  hint(sim) {
    if (!sim.ship) return "";
    const fallen = sim.people.find((p) => p.status === "fell-in");
    if (fallen) return "🆘 " + fallen.name + " slid into the pool! Get to the edge by them and help them out · E";
    const adrift = sim.roof?.beds.filter((b) => b.adrift).length || 0;
    if (adrift && sim.ship.phase === "calm")
      return "🛏️ " + adrift + " lounger" + (adrift > 1 ? "s" : "") + " out of place · straighten the row (E by it)";
    return "";
  },
  panel(sim) {
    const S = sim.ship;
    if (!S || S.phase !== "warn") return null;
    return {
      icon: "🔔",
      title: "BIG SWELL IN " + Math.max(1, Math.ceil(S.dur - S.t)) + "!",
      task: "The ship will roll to " + (S.side < 0 ? "port (left)" : "starboard (right)") + " · get people off the pool's ends",
    };
  },
};
