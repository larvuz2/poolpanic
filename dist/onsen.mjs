// The Mountain Hot Springs (18 October 2026, the creator: "guests enter, and the longer they wait outside of the natural hot springs,
// the colder they start to get… arms crossed tightly over the chest, hugging oneself for warmth… that is, of course, bad for the
// level, so we have to assign them… three or four spots as hot natural hot springs… the snow monkeys… they enter from random
// places. Of course, Coach Waters has to stop them before entering the natural hot springs because if they enter, people get
// nervous and they panic… we get minus points if a monkey manages to enter the hot springs… once they're in, the monkey needs to
// be submerged, and only the face of the monkey is above the water. Very chill"). The plan of the terrace is onsen-plan.mjs.
//
// A guest comes out of the bathhouse and waits in the snow (the queue) until the coach sends them to a spring (SPRING 1 to 4, a
// spring holds `cap` guests): they walk there, step down into the water by its steps, wade to a seat and sit in it to the shoulders,
// warming up, until they have had their soak; then out by the steps and home. Waiting, they grow cold (`p.cold`, 0 to 1), and
// past `coldFrom` the cold bites: their mood falls faster (`p.coldPenalty`) and they hug themselves (the ColdHug clip). In the hot
// water they warm up again. Nobody swims laps: no cramps, no fins.
//
// The snow monkeys come out of the forest at random places round the terrace and make for a spring (on all fours, stopping now and
// then to look about). The coach meets one before it gets there (runs into it, or E beside it): it scampers back into the woods
// (+40). One that gets to the water hops in (−50) and sits in it up to its chin, and everyone in that spring panics: their mood
// falls fast until the coach shoos it out (E at the rim beside it, or wading up to it: +25). Their numbers come from a stream of
// their own (`onsenRandom`), so the rest of the shift draws what it would anywhere.
import {
  SPRINGS,
  ONSEN,
  ONSEN_WATER,
  springSteps,
  springSeats,
  springPoint,
  springLocal,
  springAt,
  nearestSpring,
  onsenWalkable,
} from "./onsen-plan.mjs";
import { WetSpots } from "./incidents/wet.mjs";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export const SOAK = {
  coldFull: 24, // s waiting in the snow until frozen through (cold 1)
  coldFrom: 0.3, // cold starts to bite (and the ColdHug shows) past this
  bite: 1.5, // extra mood lost a second at full cold, waiting
  warm: 0.09, // cold lost a second in the hot water
  stillCold: 0.012, // cold gained a second walking to a spring (still in the snow)
  soak: [22, 32], // s of soaking (a VIP likes it 1.2 times longer)
  step: 0.9, // s stepping down into the water (and climbing out)
  wade: 0.8, // m/s wading to a seat in the water
  relax: 0.7, // mood a second soaking (warming up)
  fear: 4.2, // mood a second with a monkey in the spring (a VIP 1.5 times)
  closing: 9, // s a guest needs to get out and away before closing
  shortest: 6, // s the shortest soak
};

export const MONKEY = {
  first: [14, 22], // s before the first monkey
  every: [
    [30, 44],
    [12, 20],
  ], // s between monkeys, level 1 and level 20
  most: [1, 3], // at once, level 1 and level 20
  walk: 1.0, // m/s on all fours
  run: 2.9, // m/s scampering off
  pause: [0.8, 1.7], // s stopping to look about
  pauseChance: 0.35, // a chance each few metres
  touch: 1.1, // the coach this close shoos a monkey on the deck
  reach: 1.9, // E this close shoos it (and shoos one out of the water from the rim)
  hop: 0.6, // s hopping in
  shooed: 40, // points for one shooed off the deck
  inCost: 50, // points lost for one in the water
  outPoints: 25, // points for shooing one out of the water
  shoo: 0.6, // s shooing one out (busy)
};

// The hot springs' own random stream.
export function onsenRandom(sim) {
  sim.onsenSeed = (Math.imul(sim.onsenSeed || (sim.seed ^ 0x0e5e7) >>> 0 || 11, 1664525) + 1013904223) >>> 0;
  return sim.onsenSeed / 4294967296;
}
const between = (sim, [a, b]) => a + onsenRandom(sim) * (b - a);
const byLevel = (sim, [a, b]) => {
  const k = clamp((sim.level - 1) / 19, 0, 1);
  return Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * k) : a + (b - a) * k;
};

export function createOnsen(sim) {
  return { monkeys: [], nextMonkey: between(sim, MONKEY.first), uid: 0, told: {} };
}

// A new guest at the springs: no fins, no cramps (nobody swims laps), warm from the bathhouse.
export function onsenSpawn(sim, p) {
  // (No trampoline up here: a daredevil a level writes in comes for a soak like anyone.)
  if (p.type === "daredevil") p.type = "intermediate";
  Object.assign(p, {
    needsFins: false,
    midFins: false,
    finsFirst: false,
    hasFins: false,
    problem: null,
    crampAt: Infinity,
    cold: 0,
    coldPenalty: 0,
    seat: null,
  });
}

// ---- the springs ---------------------------------------------------------------------------------------------------------

// The guests a spring has (on the way, getting in, soaking, getting out).
export function springGuests(sim, k) {
  return sim.people.filter(
    (p) =>
      p.lane === k &&
      (p.status === "enter" ||
        p.status === "swim" ||
        (p.status === "exit" && ["water", "climb"].includes(p.exitPhase))),
  );
}
export const springFull = (sim, k) => springGuests(sim, k).length >= SPRINGS[k].cap;
function freeSeat(sim, k) {
  const taken = new Set(springGuests(sim, k).map((p) => p.seat));
  const seats = springSeats(SPRINGS[k]);
  return seats.find((s) => !taken.has(s.i)) ?? null;
}

// SPRING k: send the selected guest there (sim.assign calls this at the springs). False when it cannot be done.
export function sendToSpring(sim, p, k) {
  if (!SPRINGS[k]) return false;
  if (springFull(sim, k)) {
    sim.emit("toast", {
      text: "Spring " + (k + 1) + " is full! Send them to another spring.",
      warning: true,
    });
    sim.emit("lane-refused", { lane: k });
    return false;
  }
  const seat = freeSeat(sim, k);
  p.lane = k;
  p.seat = seat.i;
  p.assignedAt = sim.time;
  sim.stats.totalWait += p.wait;
  walkToSpring(sim, p, "enter");
  return true;
}
// On the way to a spring (its steps), then in.
export function walkToSpring(sim, p, mode = "enter") {
  const steps = springSteps(SPRINGS[p.lane]);
  // (Back after the springs were closed: their own seat if it is still free, else another.)
  const others = springGuests(sim, p.lane).filter((q) => q !== p);
  if (p.seat == null || others.some((q) => q.seat === p.seat))
    p.seat = springSeats(SPRINGS[p.lane]).find((s) => !others.some((q) => q.seat === s.i))?.i ?? 0;
  p.status = mode;
  p.onsenStage = "walk";
  p.stepT = 0;
  p.path = sim.venue.route(p, steps.deck);
}
// A guest on the way to a spring and getting in. True while it has them (the caller skips the rest).
export function tickOnsenEnter(sim, p, dt) {
  if (p.status !== "enter" || !p.onsenStage) return false;
  const s = SPRINGS[p.lane],
    steps = springSteps(s);
  p.cold = Math.min(1, (p.cold || 0) + SOAK.stillCold * dt);
  if (p.onsenStage === "walk") {
    if (sim.moveAlong(p, dt, sim.pace(p, 3.1))) {
      p.onsenStage = "step";
      p.stepT = 0;
      p.stepFrom = { x: p.x, z: p.z };
      sim.emit("step-in", { id: p.id, x: steps.water.x, z: steps.water.z, spring: s.id });
    }
    return true;
  }
  if (p.onsenStage === "step") {
    p.stepT = Math.min(1, p.stepT + dt / SOAK.step);
    const e = p.stepT * p.stepT * (3 - 2 * p.stepT);
    p.x = p.stepFrom.x + (steps.water.x - p.stepFrom.x) * e;
    p.z = p.stepFrom.z + (steps.water.z - p.stepFrom.z) * e;
    p.angle = steps.angle;
    if (p.stepT === 1) {
      p.onsenStage = "wade";
      const seat = springSeats(s)[p.seat] || springSeats(s)[0];
      p.path = [{ x: seat.x, z: seat.z }];
      sim.emit("splash", { x: p.x, z: p.z, small: true });
    }
    return true;
  }
  // Wading to the seat, then sitting down in the water.
  if (sim.moveAlong(p, dt, SOAK.wade)) {
    const seat = springSeats(s)[p.seat] || springSeats(s)[0];
    p.angle = seat.angle;
    p.status = "swim";
    p.onsenStage = null;
    if (!p.resumingWorkout) {
      p.workTime = 0;
      // (Late in the shift a soak is cut to fit the time left, getting out included: nobody is still in the water at closing.)
      const left = sim.config.duration - sim.time - SOAK.closing;
      p.workTarget = Math.max(SOAK.shortest, Math.min(between(sim, SOAK.soak) * (p.vip ? 1.2 : 1), left));
    }
    p.resumingWorkout = false;
    p.actualSpeed = 0;
    sim.emit("sit-in", { id: p.id, spring: s.id });
  }
  return true;
}

// Out of a spring: wade to its steps, climb out, home (beginWaterExit and tickWaterExit at the springs).
export function beginOnsenExit(sim, p) {
  const k = p.lane ?? nearestSpringIndex(p),
    steps = springSteps(SPRINGS[k]);
  p.exitSpring = k;
  p.exitPhase = "water";
  p.exitProgress = 0;
  p.path = [{ x: steps.water.x, z: steps.water.z }];
  p.bumpTime = 0;
  p.slipTime = 0;
}
export function tickOnsenExit(sim, p, dt) {
  if (p.status !== "exit" || !["water", "climb"].includes(p.exitPhase)) return false;
  const steps = springSteps(SPRINGS[p.exitSpring ?? 0]);
  if (p.exitPhase === "water") {
    if (sim.moveAlong(p, dt, SOAK.wade * 1.3)) {
      p.exitPhase = "climb";
      p.exitProgress = 0;
      p.climbFrom = { x: p.x, z: p.z };
    }
    return true;
  }
  p.exitProgress = Math.min(1, p.exitProgress + dt / SOAK.step);
  const e = p.exitProgress * p.exitProgress * (3 - 2 * p.exitProgress);
  p.x = p.climbFrom.x + (steps.deck.x - p.climbFrom.x) * e;
  p.z = p.climbFrom.z + (steps.deck.z - p.climbFrom.z) * e;
  p.angle = steps.angle + Math.PI;
  if (p.exitProgress === 1) {
    p.exitPhase = "deck";
    p.actualSpeed = 0;
    if (p.rescueRecover) {
      sim.rescueOnDeck(p);
      return true;
    }
    p.stunned = Math.max(p.stunned || 0, 0.6);
    // One in five drips a wet spot on the rim where they got out (it freezes into a slick patch: incidents/wet.mjs).
    WetSpots.climbedOut(sim, p, steps.deck);
    p.path = [...sim.venue.route(p, sim.venue.arrival.at(p.side, "outside")), ...sim.returnRoute(p.side)];
    sim.emit("splash", { x: p.x, z: p.z, small: true });
  }
  return true;
}
export function nearestSpringIndex(p) {
  let best = 0,
    d = Infinity;
  SPRINGS.forEach((s, i) => {
    const e = -springLocal(s, p.x, p.z).inside;
    if (e < d) {
      d = e;
      best = i;
    }
  });
  return best;
}

// Waiting in the snow: colder by the second, and past `coldFrom` it bites (sim.mjs adds `coldPenalty` to the queue's mood).
export function tickCold(sim, p, dt) {
  p.cold = Math.min(1, (p.cold || 0) + dt / SOAK.coldFull);
  if (p.cold > SOAK.coldFrom) {
    p.coldPenalty =
      (p.coldPenalty || 0) +
      dt * SOAK.bite * ((p.cold - SOAK.coldFrom) / (1 - SOAK.coldFrom)) * (p.vip ? 1.3 : 1);
    if (!sim.onsen.told.cold) {
      sim.onsen.told.cold = true;
      sim.emit("toast", {
        text: "🥶 " + p.name + " is getting cold out in the snow! Send them to a hot spring (SPRING 1–4).",
        warning: true,
      });
    }
  }
}

// Everyone soaking, each frame: warming up, the mood, a monkey in the water, sore eyes, a tummy, home when done.
export function updateOnsen(sim, dt) {
  updateMonkeys(sim, dt);
  if (sim.rescue || sim.crowdPanic()) return;
  for (const p of sim.people) {
    if (p.status !== "swim" || p.lane == null) continue;
    p.workTime += dt;
    sim.tickStomach(p, dt);
    if (sim.cleanup || sim.closed) return;
    p.cold = Math.max(0, (p.cold || 0) - SOAK.warm * dt);
    const monkey = monkeyIn(sim, p.lane);
    p.monkeyScare = !!monkey;
    if (sim.chlorine > p.chlorineTolerance && p.eyeCooldown === 0) {
      p.irritation += dt * (sim.chlorine - p.chlorineTolerance) * 0.14;
      if (p.irritation > 10 && !p.problem) {
        p.problem = "eyes";
        sim.emit("toast", {
          text: p.name + " has sore eyes from the water. Fetch eye relief.",
          warning: true,
        });
      }
    } else p.irritation = Math.max(0, p.irritation - dt * 0.8);
    p.h +=
      dt *
      (monkey
        ? -SOAK.fear * (p.vip ? 1.5 : 1)
        : SOAK.relax * (1 - (p.cold || 0)) -
          Math.max(0, sim.contamination - 35) * 0.025 * (p.vip ? 1.4 : 1) -
          (p.problem ? 1.6 : 0));
    p.h = clamp(p.h, 0, 100);
    if (p.h <= 0) {
      sim.lose(p);
      continue;
    }
    if (
      !p.problem &&
      !p.stomachWarning &&
      !monkey &&
      p.workTime >= (sim.config.workoutSeconds || p.workTarget || 20)
    )
      sim.depart(p, true);
  }
}

// ---- the springs and the coach (coach.mjs, sanitation.mjs ask) -----------------------------------------------------------

// Where the coach serves a guest sitting in a spring: the rim beside them (or the steps, if a boulder is there).
export function onsenServicePoint(sim, p) {
  const b = ONSEN_WATER.bank(p.x, p.z, { inside: 0.4, outside: 0.55 });
  if (onsenWalkable(b.deck.x, b.deck.z, 0.3)) return b.deck;
  return springSteps(SPRINGS[b.spring]).deck;
}
// The water nearest the coach (where he pours the water care in, or skims from): where he stands if he is in a spring.
export function onsenWaterPoint(sim) {
  const c = sim.coach;
  if (springAt(c.x, c.z, 0.05)) return { x: c.x, z: c.z };
  return ONSEN_WATER.bank(c.x, c.z, { inside: 0.3 }).water;
}
// Where the coach lands diving into a spring (with the fish net, the life ring): a little in from the rim nearest him, or where
// he stands if he is wading. He keeps to that spring while he swims (`coach.spring`, rescue.mjs).
export function onsenDive(sim) {
  const c = sim.coach,
    s = nearestSpring(c);
  c.spring = s.id;
  const l = springLocal(s, c.x, c.z);
  return l.inside > 0.7 ? { x: c.x, z: c.z } : springPoint(s, l.th, clamp(1 - 0.9 / s.r, 0.1, 0.9));
}
// Out of a spring for good (a floater, a fish): to the rim beside them, or out by the steps if a boulder is in the way.
export function onsenOutPath(sim, p) {
  const b = ONSEN_WATER.bank(p.x, p.z, { inside: 0.35, outside: 0.8 });
  if (onsenWalkable(b.deck.x, b.deck.z, 0.3)) return [b.water, b.deck];
  const steps = springSteps(SPRINGS[b.spring]);
  return [steps.water, steps.deck];
}
// Where something lost in a spring starts (a floater, a cloud): where the guest was, a little in from the edge.
export function onsenWaterSpot(p) {
  const s = nearestSpring(p),
    q = springLocal(s, p.x, p.z);
  const at = q.inside > 0.6 ? { x: p.x, z: p.z } : springPoint(s, q.th, clamp(1 - 0.7 / s.r, 0.2, 0.9));
  return { ...at, spring: s.id };
}
// A floater drifting in its spring: off the edge, it turns back into the water.
export function keepInSpring(q) {
  const s = SPRINGS[q.spring ?? nearestSpring(q).id],
    l = springLocal(s, q.x, q.z);
  if (l.inside >= 0.55) return;
  const back = springPoint(s, l.th, clamp(1 - 0.6 / s.r, 0.1, 0.9));
  q.vx = (s.x - q.x) * 0.25 - q.vx * 0.4;
  q.vz = (s.z - q.z) * 0.25 - q.vz * 0.4;
  q.x = back.x;
  q.z = back.z;
}

// ---- the snow monkeys ----------------------------------------------------------------------------------------------------

export function monkeyIn(sim, k) {
  return sim.onsen?.monkeys.find((m) => m.stage === "soak" && m.spring === k) || null;
}
const ON_DECK = new Set(["approach", "pause"]);

export function spawnMonkey(sim) {
  const O = sim.onsen,
    edges = ONSEN.forest,
    e = edges[Math.floor(onsenRandom(sim) * edges.length)],
    t = onsenRandom(sim),
    from = { x: e.from.x + (e.to.x - e.from.x) * t, z: e.from.z + (e.to.z - e.from.z) * t };
  // Which spring: any, a busy one a little likelier (the warmth and the company), never one that already has a monkey.
  const options = SPRINGS.filter((s) => !O.monkeys.some((m) => m.spring === s.id && m.stage !== "gone"));
  if (!options.length) return null;
  const weights = options.map(
      (s) => 1 + springGuests(sim, s.id).filter((p) => p.status === "swim").length * 0.6,
    ),
    total = weights.reduce((a, b) => a + b, 0);
  let r = onsenRandom(sim) * total,
    s = options[0];
  for (let i = 0; i < options.length; i++)
    if ((r -= weights[i]) <= 0) {
      s = options[i];
      break;
    }
  // The rim on the side it comes from (round a boulder if one is there: the route finds the way).
  const th = Math.atan2((from.z - s.z) / s.rz, (from.x - s.x) / s.rx),
    rim = springPoint(s, th, 1 + 0.4 / s.r),
    water = springPoint(s, th, 1 - 0.85 / s.r);
  const m = {
    id: ++O.uid,
    x: from.x,
    z: from.z,
    angle: Math.atan2(rim.x - from.x, rim.z - from.z),
    stage: "approach",
    spring: s.id,
    rim,
    water,
    path: sim.venue.route(from, rim),
    t: 0,
    pauseIn: 2 + onsenRandom(sim) * 3,
    moving: true,
    speed: MONKEY.walk,
  };
  O.monkeys.push(m);
  sim.emit("monkey", { id: m.id, x: m.x, z: m.z, spring: s.id });
  sim.incident("monkey", m, { id: m.id, spring: s.id + 1 });
  if (!O.told.monkey) {
    O.told.monkey = true;
    sim.emit("toast", {
      text:
        "🐒 A snow monkey is sneaking toward Spring " +
        (s.id + 1) +
        "! Get to it first and shoo it away (run into it, or E).",
      warning: true,
    });
  }
  return m;
}
function walk(m, dt, speed) {
  while (m.path.length && distance(m, m.path[0]) < 0.05) m.path.shift();
  if (!m.path.length) return true;
  const p = m.path[0],
    d = distance(m, p),
    step = speed * dt;
  m.angle = Math.atan2(p.x - m.x, p.z - m.z);
  if (d <= step) {
    m.x = p.x;
    m.z = p.z;
    m.path.shift();
  } else {
    m.x += ((p.x - m.x) / d) * step;
    m.z += ((p.z - m.z) / d) * step;
  }
  return !m.path.length;
}
// Back into the woods: the nearest edge of the forest, off the terrace.
function fleeTo(sim, m) {
  let best = null,
    d = Infinity;
  for (const e of ONSEN.forest)
    for (let t = 0; t <= 1; t += 0.1) {
      const q = { x: e.from.x + (e.to.x - e.from.x) * t, z: e.from.z + (e.to.z - e.from.z) * t },
        dd = distance(m, q);
      if (dd < d) {
        d = dd;
        best = q;
      }
    }
  m.path = sim.venue.route(m, best);
  const last = m.path[m.path.length - 1];
  // (A step past the forest's edge, out of sight.)
  m.path.push({
    x: last.x + Math.sign(last.x) * (Math.abs(last.x) > 15 ? 2 : 0),
    z: last.z + (last.z > 13 ? 2 : 0),
  });
}
function scare(sim, m, points, kind) {
  m.stage = "flee";
  m.speed = MONKEY.run;
  m.moving = true;
  if (m.inSpring != null) {
    const k = m.inSpring,
      rim = springPoint(
        SPRINGS[k],
        Math.atan2((m.z - SPRINGS[k].z) / SPRINGS[k].rz, (m.x - SPRINGS[k].x) / SPRINGS[k].rx),
        1 + 0.45 / SPRINGS[k].r,
      );
    m.inSpring = null;
    m.x = rim.x;
    m.z = rim.z;
    sim.emit("splash", { x: rim.x, z: rim.z, small: true });
    // Dripping out of the water: a wet spot on the rim (it freezes).
    WetSpots.climbedOut(sim, { id: -m.id }, rim);
  }
  fleeTo(sim, m);
  sim.score += points;
  sim.stats.monkeys = (sim.stats.monkeys || 0) + 1;
  sim.emit("points", { x: m.x, z: m.z, value: points });
  sim.save(kind, m, points, { id: m.id });
  sim.emit("monkey-shooed", { id: m.id, x: m.x, z: m.z, out: kind === "monkey-out" });
}
// The coach shoos a monkey: on the deck (he ran into it, or E beside it), or out of the water (E at the rim beside it).
export function shooMonkey(sim, m) {
  if (!m || m.stage === "flee" || m.stage === "gone") return false;
  if (ON_DECK.has(m.stage)) {
    scare(sim, m, MONKEY.shooed, "monkey-shooed");
    return true;
  }
  if (m.stage === "soak" || m.stage === "hop") {
    if (!sim.canInteract()) return false;
    return sim.startBusy(
      "shoo",
      MONKEY.shoo,
      "Shooing the monkey out",
      () => {
        if (m.stage === "soak" || m.stage === "hop") scare(sim, m, MONKEY.outPoints, "monkey-out");
      },
      m,
    );
  }
  return false;
}
function updateMonkeys(sim, dt) {
  const O = sim.onsen;
  if (!O || sim.status !== "playing") return;
  // The next one, when it is time (and not too many at once).
  O.nextMonkey -= dt;
  const live = O.monkeys.filter((m) => m.stage !== "gone").length;
  if (O.nextMonkey <= 0 && sim.time < sim.config.duration - 15) {
    if (live < Math.round(byLevel(sim, MONKEY.most))) spawnMonkey(sim);
    O.nextMonkey = between(sim, byLevel(sim, MONKEY.every));
  }
  for (const m of O.monkeys) {
    if (m.stage === "gone") continue;
    m.t += dt;
    // Any coach on foot running into one shoos it.
    if (
      ON_DECK.has(m.stage) &&
      sim.coaches.some((c) => c.y < 0.4 && distance(c, m) < MONKEY.touch && !c.busy)
    ) {
      scare(sim, m, MONKEY.shooed, "monkey-shooed");
      continue;
    }
    if (m.stage === "pause") {
      m.moving = false;
      m.pauseT -= dt;
      if (m.pauseT <= 0) {
        m.stage = "approach";
        m.pauseIn = 2 + onsenRandom(sim) * 4;
      }
      continue;
    }
    if (m.stage === "approach") {
      m.moving = true;
      m.pauseIn -= dt;
      if (m.pauseIn <= 0 && distance(m, m.rim) > 2.2) {
        if (onsenRandom(sim) < MONKEY.pauseChance) {
          m.stage = "pause";
          m.pauseT = between(sim, MONKEY.pause);
          continue;
        }
        m.pauseIn = 1.5 + onsenRandom(sim) * 2;
      }
      if (walk(m, dt, m.speed)) {
        m.stage = "hop";
        m.hopT = 0;
        m.hopFrom = { x: m.x, z: m.z };
      }
      continue;
    }
    if (m.stage === "hop") {
      m.hopT = Math.min(1, m.hopT + dt / MONKEY.hop);
      m.x = m.hopFrom.x + (m.water.x - m.hopFrom.x) * m.hopT;
      m.z = m.hopFrom.z + (m.water.z - m.hopFrom.z) * m.hopT;
      if (m.hopT === 1) {
        m.stage = "soak";
        m.inSpring = m.spring;
        m.moving = false;
        const s = SPRINGS[m.spring];
        m.angle = Math.atan2(s.x - m.x, s.z - m.z);
        sim.score -= MONKEY.inCost;
        sim.breakStreak("monkey");
        sim.stats.monkeysIn = (sim.stats.monkeysIn || 0) + 1;
        sim.emit("splash", { x: m.x, z: m.z });
        sim.emit("monkey-in", { id: m.id, x: m.x, z: m.z, spring: m.spring });
        sim.emit("points", { x: m.x, z: m.z, value: -MONKEY.inCost });
        sim.incident("monkey-in", m, { id: m.id, spring: m.spring + 1 });
        sim.emit("toast", {
          text:
            "🐒 A monkey got into Spring " +
            (m.spring + 1) +
            "! −" +
            MONKEY.inCost +
            " · Everyone's panicking: shoo it out (E at the rim beside it)!",
          warning: true,
        });
      }
      continue;
    }
    if (m.stage === "soak") {
      // Wading up to it shoos it out too.
      if (sim.coaches.some((c) => c.wading && distance(c, m) < MONKEY.touch && !c.busy))
        scare(sim, m, MONKEY.outPoints, "monkey-out");
      continue;
    }
    if (m.stage === "flee" && walk(m, dt, m.speed)) m.stage = "gone";
  }
  // (Forget the long gone.)
  if (O.monkeys.length > 12) O.monkeys = O.monkeys.filter((m) => m.stage !== "gone");
}

// The snow monkeys as a system (chaos.mjs SYSTEMS): alerts, the coach's options, hints, the banner, the diary.
export const SnowMonkeys = {
  key: "monkeys",
  // Not an incident: the venue's own life (it never counts towards the incidents a shift may run at once).
  isActive: () => false,
  describe(sim) {
    const O = sim.onsen;
    if (!O) return "";
    const live = O.monkeys.filter((m) => m.stage !== "gone");
    return live.map((m) => "🐒" + m.stage + "@" + (m.spring + 1)).join(" ");
  },
  detail(sim) {
    const O = sim.onsen;
    if (!O) return null;
    return {
      monkeys: O.monkeys
        .filter((m) => m.stage !== "gone")
        .map((m) => ({ stage: m.stage, spring: m.spring + 1 })),
      cold: sim.people.filter((p) => p.status === "queue" && (p.cold || 0) > SOAK.coldFrom).length,
    };
  },
  alert(sim, alerts) {
    for (const m of sim.onsen?.monkeys || [])
      if (m.stage === "approach" || m.stage === "pause" || m.stage === "hop")
        alerts.push({
          kind: "monkey",
          icon: "🐒",
          label: "Monkey!",
          x: m.x,
          z: m.z,
          y: 1.0,
          urgency: 80,
          id: "m" + m.id,
        });
      else if (m.stage === "soak")
        alerts.push({
          kind: "monkey-in",
          icon: "🐒",
          label: "Monkey in Spring " + (m.spring + 1),
          x: m.x,
          z: m.z,
          y: 0.8,
          urgency: 92,
          id: "m" + m.id,
        });
  },
  interactions(sim, options) {
    const c = sim.coach;
    for (const m of sim.onsen?.monkeys || []) {
      if (m.stage === "flee" || m.stage === "gone") continue;
      const d = distance(c, m);
      if (d > MONKEY.reach) continue;
      options.push({
        kind: "assist",
        label: m.stage === "soak" ? "Shoo the monkey out of the water" : "Shoo the monkey away",
        x: m.x,
        z: m.z,
        rank: -80 + d,
        run: () => shooMonkey(sim, m),
      });
    }
  },
  hint(sim) {
    const live = (sim.onsen?.monkeys || []).filter((m) => m.stage !== "gone" && m.stage !== "flee");
    const inWater = live.find((m) => m.stage === "soak");
    if (inWater)
      return "🐒 A monkey is in Spring " + (inWater.spring + 1) + "! Shoo it out · E at the rim beside it";
    if (live.length)
      return "🐒 Monkey heading for Spring " + (live[0].spring + 1) + " · run into it to shoo it away";
    const cold = sim.people.filter((p) => p.status === "queue" && (p.cold || 0) > SOAK.coldFrom);
    if (cold.length) return "🥶 " + cold.length + " getting cold in the snow · send them to a spring (1–4)";
    return "";
  },
  panel(sim) {
    const m = (sim.onsen?.monkeys || []).find((m) => m.stage === "soak");
    if (!m) return null;
    return {
      icon: "🐒",
      title: "MONKEY IN SPRING " + (m.spring + 1) + "!",
      task: "Everyone's panicking · shoo it out (E at the rim beside it)",
    };
  },
};
