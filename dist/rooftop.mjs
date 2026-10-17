// The Rooftop Pool's guests (17 October 2026): what a guest does up on the roof, from the lift to the lift, and the coach's part
// in it. The plan of the roof is roof-plan.mjs.
//
// Nobody swims and nobody is sent anywhere. A guest comes up in one of the two lifts with a plan of their own (`p.plan`): the water,
// a sunbed, or one and then the other. In the water they stand chest-deep in little groups and chat (a group of two or more is
// happy; alone, a guest drifts to the infinity edge to look at the city). On a sunbed they lie back. The VIPs want a white
// cabana. Two things want the coach all the time:
//
// - **Margaritas.** Every now and then a guest orders one (🍹, `problem: "drink"`): one in the water wades over to the near edge to
//   be served, one on a sunbed waits there. The coach takes a tray of three from the bar (E at the bar) and hands them out (E
//   beside the guest). Each one served is a tip and a happier guest; one kept waiting grows cross. Two make a guest tipsy (🥴),
//   and a tipsy guest is the one who gets ideas.
// - **The sunbeds.** A guest getting off a sunbed leaves it messy (a crumpled towel): nobody takes a messy bed, so the coach tidies
//   them (E at the bed). A guest who finds no bed free waits for one, and minds.
//
// And one danger of its own: **the selfie at the edge.** Now and then a guest in the water (a tipsy one above all) wades to the
// infinity edge, climbs up on it and leans out with a phone (📸). The coach has a few seconds to get there (the pool is shallow:
// he can wade in, slowly) and talk them down (E). Too late, and over they go: SPLOOSH into the catch gutter past the edge, points
// lost, and the coach must haul them back over (E) before they storm out by the service stairs.
//
// The DJ plays all shift, and every so often the set builds to **the drop** (the music's own bar line: 120 BPM, a bar is 2 s). On
// the drop everyone in the water jumps and cheers, and the water slops over the near edge and the ends onto the deck: wet spots
// to mop. Anyone up on the edge for a selfie when the drop hits goes straight over.
import { ROOF } from "./roof-plan.mjs";
import { WetSpots, addWetSpot } from "./incidents/wet.mjs";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export const CHILL = {
  start: 84, // a guest's mood coming out of the lift
  wade: 0.62, // m/s in the water
  step: 0.7, // s stepping down into the water
  climb: 0.8, // s climbing out
  lieDown: 0.6, // s getting onto a sunbed (and off again)
  pool: [17, 26], // s in the water (each part of a plan of two: ×0.75)
  bed: [15, 23], // s on a sunbed
  both: 0.75,
  closing: 10, // s a guest keeps in hand to walk out before the shift ends
  closingNext: 12, // s the next part of a plan needs at least (walking there included)
  chat: 0.55, // mood a second, chatting in a group of two or more
  alone: 0.15,
  view: 0.35, // alone at the infinity edge, looking at the city
  lounge: 0.4, // on a sunbed
  groupMax: 4,
  ring: 0.62, // how far round a group's middle its people stand
  room: 0.78, // elbow room in the water
  // the margaritas
  tray: 3,
  firstOrder: [4, 9], // s after settling (a VIP: `vipFirst`)
  vipFirst: 1.5,
  orderEvery: { beginner: [16, 26], intermediate: [12, 20], advanced: [8, 14] },
  grace: 3, // s an order waits before the guest minds
  thirst: 1.3, // mood a second waiting for a margarita, after the grace
  vipThirst: 2.2,
  sip: 8, // s drinking one
  tip: 30, // points a margarita served earns (a VIP's: `vipTip`)
  vipTip: 60,
  cheers: 14, // mood a margarita gives
  tipsy: 2, // margaritas
  // the sunbeds
  tidy: 0.9, // s tidying a messy bed
  tidyPoints: 10,
  bedWait: 1.4, // mood a second, waiting for a free sunbed
  bedGiveUp: 9, // s waiting before going into the water instead (or home)
  noCabana: 10, // mood a VIP loses taking a plain sunbed
  // the selfie at the edge
  selfieFrom: 2, // the first level with selfies
  climbUp: 0.8, // s climbing up onto the edge
  stopped: 60, // points for talking one down off the edge
  intercepted: 35, // for stopping one on the way there
  overboard: 150, // points lost when one goes over
  hauled: 40, // for hauling one back over the edge
  stranded: 18, // s before one left in the gutter storms off by the service stairs
  reach: 1.7, // how close the coach must be to talk one down or haul one back
  // the DJ's drop (the bar: music.mjs plays 120 BPM)
  bar: 2,
  firstDrop: [11, 15], // bars
  dropEvery: [14, 20],
  dropWarning: 4, // bars of build-up, announced
  dropFun: 4, // mood the drop gives everyone in the water
  hype: 4, // s everyone in the water dances after the drop
  splash: 0.5, // chance a guest by an edge slops a wet spot onto the deck
  splashMax: 4,
};

// The rooftop's own random stream, seeded from the shift's (so a replay plays the same roof, and nothing else in the shift moves).
export function roofRandom(sim) {
  sim.roofSeed = (Math.imul(sim.roofSeed || 7, 1664525) + 1013904223) >>> 0;
  return sim.roofSeed / 4294967296;
}
const between = (sim, [a, b]) => a + roofRandom(sim) * (b - a);
// The venue's chill plan (roof-plan.mjs `ROOF_CHILL`, cruise-plan.mjs): where the water is, the edge the guests use, the beds.
const planOf = (sim) => sim.venue.chill;
const bedOf = (sim, id) => sim.venue.chill.bed(sim, id);
// Into the water box, `m` in from its sides.
const inWater = (sim, x, z, m = 0.45) => {
  const W = sim.venue.chill.water;
  return { x: clamp(x, W.x0 + m, W.x1 - m), z: clamp(z, W.z0 + m, W.z1 - m) };
};

// The roof's state for a shift: the beds, the chat groups, the DJ's drops (all of them, from the start: the music plays toward
// them), the next selfie.
export function createRoof(sim) {
  sim.roofSeed = (sim.seed ^ 0x2c1b3c6d) >>> 0 || 11;
  const drops = [];
  if (planOf(sim).dj)
    for (let bar = Math.round(between(sim, CHILL.firstDrop)); bar * CHILL.bar < sim.config.duration - 6;) {
      drops.push(bar);
      bar += Math.round(between(sim, CHILL.dropEvery));
    }
  return {
    beds: planOf(sim).beds.map((b) => ({ id: b.id, guest: null, messy: false })),
    groups: [],
    drops,
    nextDrop: 0,
    warned: false,
    hype: 0,
    selfieIn: selfieInterval(sim) * 0.8,
  };
}
const selfieInterval = (sim) => Math.max(14, 34 - sim.level * 1.2) * (0.75 + roofRandom(sim) * 0.5);
const selfieLimit = (sim, p) => Math.max(5, 10 - sim.level * 0.2 - (p.tipsy ? 1.5 : 0));

// ---- arriving ----------------------------------------------------------------------------------------------------------

// The guest types up here (no lap swimmers): the sunbather (a sunbed first), the socialite (the water, to chat) and the party
// animal (the water, and margaritas, often).
export function guestType(sim, spec, r) {
  if (["beginner", "intermediate", "advanced"].includes(spec.type)) return spec.type;
  return r < 0.34 ? "beginner" : r < 0.72 ? "intermediate" : "advanced";
}
export const GUEST_KIND = { beginner: "Sunbather", intermediate: "Socialite", advanced: "Party animal" };

// Where only some guests chill (the cruise ship: the other half of its pool has lanes), whether this one does: `chill.share` of them,
// never Marco (he swims), drawn from the chill stream so the rest of the shift is the same.
export function chillGuest(sim, p) {
  if (p.star || p.type === "aqua") return false;
  return roofRandom(sim) < (sim.venue.chill.share ?? 1);
}

export function roofSpawn(sim, p) {
  Object.assign(p, {
    needsFins: false,
    midFins: false,
    finsFirst: false,
    hasFins: false,
    problem: null,
    crampAt: Infinity, // (nobody swims up here)
    lane: sim.venue.roof ? 0 : null, // (a chilling guest has no lane: the cruise ship's lanes are the swimmers')
    chill: true,
    h: CHILL.start,
    drinks: 0,
    sipping: 0,
    tipsy: false,
  });
  const r = roofRandom(sim),
    two = roofRandom(sim) < 0.5;
  p.plan =
    p.type === "beginner" || (p.vip && r < 0.5)
      ? two
        ? ["bed", "pool"]
        : ["bed"]
      : two
        ? ["pool", "bed"]
        : ["pool"];
  p.planStep = 0;
  p.orderIn = p.vip ? CHILL.vipFirst : between(sim, CHILL.firstOrder);
}

// Off to the next thing on their plan: down to the water's edge, or to a sunbed (or to wait for one).
export function walkToActivity(sim, p) {
  const what = p.plan[p.planStep] || "pool";
  p.status = "enter";
  p.lane = sim.venue.roof ? 0 : null;
  p.stepT = 0;
  const P = planOf(sim);
  if (what === "bed") {
    const bed = pickBed(sim, p);
    if (bed) {
      p.bed = bed.id;
      bed.guest = p.id;
      p.goal = "bed";
      p.path = P.route(p, bedOf(sim, bed.id).foot);
      return;
    }
    p.goal = "waitbed";
    p.bedWaitT = 0;
    p.path = P.route(p, waitSpot(sim, p));
    if (!sim.roof.bedsTold) {
      sim.roof.bedsTold = true;
      sim.emit("toast", {
        text: "No free sunbed for " + p.name + "! Tidy the messy ones (E at a bed).",
        warning: true,
      });
    }
    return;
  }
  p.goal = "pool";
  p.group ??= joinGroup(sim, p);
  const g = group(sim, p.group),
    z = inWater(sim, 0, (g?.z ?? p.z) + (roofRandom(sim) - 0.5) * 1.6, 0.8).z;
  p.path = P.route(p, { x: P.edge.stand, z });
}

// A free, tidy sunbed (a cabana for a VIP, if there is one; nobody else takes a cabana), the nearest.
function pickBed(sim, p) {
  const free = sim.roof.beds.filter((b) => !b.guest && !b.messy && !b.adrift),
    near = (list) =>
      list.sort((a, b) => distance(bedOf(sim, a.id), p) - distance(bedOf(sim, b.id), p) || a.id - b.id)[0];
  if (p.vip) {
    const cabana = near(free.filter((b) => bedOf(sim, b.id).cabana));
    if (cabana) return cabana;
  }
  const bed = near(free.filter((b) => !bedOf(sim, b.id).cabana));
  if (bed && p.vip && !p.noCabanaTold && planOf(sim).cabanas !== false) {
    p.noCabanaTold = true;
    p.h = Math.max(0, p.h - CHILL.noCabana);
    sim.emit("toast", {
      text: p.name + ", the VIP, wanted a cabana! 👑 A sunbed will have to do.",
      warning: true,
    });
  }
  return bed || null;
}
// Where a guest stands waiting for a sunbed: at the mouth of the aisle nearest them, on the walk.
function waitSpot(sim, p) {
  const taken = sim.people.filter((q) => q !== p && q.goal === "waitbed" && q.status === "enter").length;
  return planOf(sim).waitSpot(sim, p, taken);
}

// Walking to the water's edge, to a sunbed, or waiting for one; then a moment stepping in or lying down. True while it has them.
export function tickRoofEnter(sim, p, dt) {
  if (p.status !== "enter") return false;
  if (p.stepT > 0) {
    p.stepT = Math.max(0, p.stepT - dt);
    const t = 1 - p.stepT / (p.goal === "bed" ? CHILL.lieDown : CHILL.step),
      E = planOf(sim).edge;
    if (p.goal === "pool") p.x = E.stand + E.dir * t * 1.3;
    else if (p.goal === "bed") {
      const b = bedOf(sim, p.bed);
      p.x = b.foot.x + (b.x - b.foot.x) * t;
      p.z = b.z;
    }
    if (p.stepT === 0) (p.goal === "bed" ? lieDown : startChilling)(sim, p);
    return true;
  }
  if (p.goal === "waitbed") {
    p.bedWaitT += dt;
    p.h = Math.max(0, p.h - dt * CHILL.bedWait * (p.vip ? 1.4 : 1) * (planOf(sim).patience ?? 1));
    if (p.h <= 0) {
      sim.lose(p);
      return true;
    }
    p.bedCheck = (p.bedCheck || 0) - dt;
    const bed = p.bedCheck <= 0 ? pickBed(sim, p) : null;
    if (p.bedCheck <= 0) p.bedCheck = 0.5;
    if (bed) {
      p.bed = bed.id;
      bed.guest = p.id;
      p.goal = "bed";
      p.path = planOf(sim).route(p, bedOf(sim, bed.id).foot);
    } else if (p.bedWaitT > CHILL.bedGiveUp) {
      // Fed up waiting: into the water if that is still to come, else home.
      const pool = p.plan.indexOf("pool", p.planStep);
      if (pool >= 0) {
        p.plan.splice(p.planStep, 1);
        return (walkToActivity(sim, p), true);
      }
      sim.depart(p, true);
      return true;
    }
  }
  if (sim.moveAlong(p, dt, sim.pace(p, 3.2))) {
    const E = planOf(sim).edge;
    if (p.goal === "pool") {
      p.stepT = CHILL.step;
      p.angle = (E.dir * Math.PI) / 2;
    } else if (p.goal === "bed") {
      p.stepT = CHILL.lieDown;
      const b = bedOf(sim, p.bed);
      p.angle = Math.atan2(b.x - p.x, b.z - p.z);
    } else p.angle = planOf(sim).lookAngle;
  }
  return true;
}
function startChilling(sim, p) {
  p.status = "swim";
  p.goal = null;
  p.x = planOf(sim).edge.inside;
  begin(sim, p, "pool");
  sim.emit("wade-in", { id: p.id, x: p.x, z: p.z });
}
function lieDown(sim, p) {
  p.status = "lounge";
  p.goal = null;
  const b = bedOf(sim, p.bed);
  p.x = b.x;
  p.z = b.z;
  p.angle = b.angle ?? planOf(sim).bedAngle;
  begin(sim, p, "bed");
  sim.emit("lie-down", { id: p.id, bed: p.bed, x: p.x, z: p.z });
}
// Settling in for this part of their plan, for as long as it takes. Closing time comes for everyone: a guest leaves themselves
// time to walk out before the shift ends (`closing`), and drops the rest of their plan if there is no time for it.
function begin(sim, p, what) {
  if (!p.resumingWorkout) {
    p.workTime = 0;
    const want = between(sim, CHILL[what]) * (p.plan.length > 1 ? CHILL.both : 1),
      left = sim.config.duration - sim.time - CHILL.closing,
      later = p.plan.length - 1 - p.planStep;
    if (later > 0 && left - want < CHILL.closingNext) p.plan.length = p.planStep + 1;
    p.workTarget = Math.max(4, Math.min(want, left - (p.plan.length - 1 - p.planStep) * CHILL.closingNext));
  }
  p.resumingWorkout = false;
  p.respot = 12 + roofRandom(sim) * 10;
}

// ---- the chat groups in the water --------------------------------------------------------------------------------------

const group = (sim, id) => sim.roof.groups.find((g) => g.id === id) || null;
const members = (sim, id) => sim.people.filter((q) => q.group === id && q.status === "swim");
// Join a group with room (most do, the nearest), or start one somewhere with space round it.
function joinGroup(sim, p) {
  const open = sim.roof.groups
    .map((g) => ({
      g,
      n: sim.people.filter((q) => q.group === g.id && q !== p && q.status !== "gone").length,
    }))
    .filter(({ n }) => n > 0 && n < CHILL.groupMax);
  if (open.length && roofRandom(sim) < 0.75)
    return open.sort((a, b) => distance(a.g, p) - distance(b.g, p))[0].g.id;
  let best = null,
    bestGap = -1;
  for (let k = 0; k < 8; k++) {
    const W = planOf(sim).water,
      rx = roofRandom(sim),
      rz = roofRandom(sim),
      spot = { x: W.x0 + 1.1 + rx * (W.x1 - W.x0 - 2.2), z: W.z0 + 1.2 + rz * (W.z1 - W.z0 - 2.4) };
    const gap = Math.min(9, ...sim.roof.groups.map((g) => distance(g, spot)));
    if (gap > bestGap) {
      best = spot;
      bestGap = gap;
    }
  }
  const g = { id: ++sim.uid, x: best.x, z: best.z };
  sim.roof.groups.push(g);
  return g.id;
}

// ---- every frame -------------------------------------------------------------------------------------------------------

// Everyone up on the roof (in the water, on a sunbed, overboard), the DJ and the selfies. In a rescue or while the crowd panics
// the guests in the water hold where they are, as everywhere.
export function updateRooftop(sim, dt) {
  const R = sim.roof,
    held = !!sim.rescue || sim.crowdPanic();
  if (planOf(sim).dj) updateDJ(sim, dt);
  R.groups = R.groups.filter((g) => sim.people.some((q) => q.group === g.id && q.status !== "gone"));
  const bathers = sim.people.filter((p) => p.status === "swim" && p.chill);
  for (const p of bathers) {
    if (held) continue;
    if (chill(sim, p, dt, bathers) === "stop") return;
  }
  for (const p of sim.people) {
    if (p.status === "lounge") lounge(sim, p, dt);
    else if (p.status === "overboard") tickOverboard(sim, p, dt);
  }
  if (!held && planOf(sim).selfie) updateSelfies(sim, dt);
}

function chill(sim, p, dt, bathers) {
  p.workTime += dt;
  sim.tickStomach(p, dt);
  if (sim.cleanup || sim.closed) return "stop";
  p.eyeCooldown = Math.max(0, (p.eyeCooldown || 0) - dt);
  p.sipping = Math.max(0, (p.sipping || 0) - dt);
  // Eyes sting in strong chlorine, as in any pool.
  if (sim.chlorine > p.chlorineTolerance && p.eyeCooldown === 0) {
    p.irritation += dt * (sim.chlorine - p.chlorineTolerance) * 0.14;
    if (p.irritation > 10 && !p.problem) {
      p.problem = "eyes";
      sim.emit("toast", { text: p.name + " has sore eyes. Bring eye relief to the edge.", warning: true });
    }
  } else p.irritation = Math.max(0, p.irritation - dt * 0.8);
  if (tickSelfie(sim, p, dt)) return;
  order(sim, p, dt);
  // Now and then a guest drifts off to another group.
  p.respot = (p.respot ?? 12) - dt;
  if (p.respot <= 0 && !p.problem) {
    if (roofRandom(sim) < 0.35) p.group = joinGroup(sim, p);
    p.respot = 12 + roofRandom(sim) * 10;
  }
  p.group ??= joinGroup(sim, p);
  // Where to: the near edge to be served (or soothed), else their group.
  const g = group(sim, p.group),
    company = g ? members(sim, g.id).length : 1;
  let target;
  if (p.problem === "drink" || p.problem === "eyes") target = { x: planOf(sim).edge.inside, z: p.z };
  else if (g && company > 1) {
    const dx = p.x - g.x,
      dz = p.z - g.z,
      d = Math.hypot(dx, dz) || 1,
      a = d > 0.01 ? null : (p.id * 2.4) % (Math.PI * 2);
    target =
      a === null
        ? { x: g.x + (dx / d) * CHILL.ring, z: g.z + (dz / d) * CHILL.ring }
        : { x: g.x + Math.cos(a) * CHILL.ring, z: g.z + Math.sin(a) * CHILL.ring };
  } else target = g ? { x: g.x, z: g.z } : { x: p.x, z: p.z };
  const speed = CHILL.wade * (p.tipsy ? 0.85 : 1) * (p.problem === "drink" ? 1.25 : 1);
  wadeTo(sim, p, target, speed, dt, bathers);
  // Facing: their group's middle while chatting, else the city.
  if (p.actualSpeed < 0.15) {
    if (g && company > 1) p.angle = Math.atan2(g.x - p.x, g.z - p.z);
    else if (!p.problem) p.angle = planOf(sim).lookAngle;
  }
  p.chatting = !!g && company > 1 && !p.problem;
  // Mood: company (or the view), a margarita kept waiting, dirty water, sore eyes.
  const alone = !p.chatting && !p.problem,
    gain = p.chatting ? CHILL.chat : alone && planOf(sim).view(p) ? CHILL.view : CHILL.alone;
  // (Waiting for a margarita, nobody is enjoying anything.)
  if (p.problem !== "drink") p.h += dt * gain * (p.tipsy ? 1.2 : 1);
  p.h -= dt * (thirst(sim, p) + Math.max(0, sim.contamination - 35) * 0.025 * (p.vip ? 1.4 : 1));
  if (p.problem === "eyes") p.h -= dt * 1.6;
  p.h = clamp(p.h, 0, 100);
  if (p.h <= 0) {
    sim.lose(p);
    return;
  }
  if (p.workTime >= p.workTarget && !p.problem && !p.stomachWarning && !p.sipping) nextOrHome(sim, p);
}
// Wade toward `target` with elbow room; stays inside the basin.
function wadeTo(sim, p, target, speed, dt, bathers) {
  const dx = target.x - p.x,
    dz = target.z - p.z,
    dist = Math.hypot(dx, dz),
    go = dist > 0.05 ? Math.min(speed, dist * 2) / dist : 0;
  let vx = dx * go,
    vz = dz * go;
  for (const o of bathers) {
    if (o === p || o.onEdge) continue;
    const ox = p.x - o.x,
      oz = p.z - o.z,
      od = Math.hypot(ox, oz);
    if (od > 0.001 && od < CHILL.room) {
      vx += (ox / od) * (CHILL.room - od) * 1.1;
      vz += (oz / od) * (CHILL.room - od) * 1.1;
    }
  }
  const W = planOf(sim).water;
  p.x = clamp(p.x + vx * dt, W.x0 + 0.4, W.x1 - 0.4);
  p.z = clamp(p.z + vz * dt, W.z0 + 0.45, W.z1 - 0.45);
  p.actualSpeed = Math.hypot(vx, vz);
  p.traveled += p.actualSpeed * dt;
  if (p.actualSpeed > 0.15) p.angle = Math.atan2(vx, vz);
}
function lounge(sim, p, dt) {
  p.workTime += dt;
  p.sipping = Math.max(0, (p.sipping || 0) - dt);
  order(sim, p, dt);
  if (p.problem !== "drink") p.h += dt * CHILL.lounge;
  p.h -= dt * thirst(sim, p);
  p.h = clamp(p.h, 0, 100);
  if (p.h <= 0) {
    sim.lose(p);
    return;
  }
  if (p.workTime >= p.workTarget && !p.problem && !p.sipping) nextOrHome(sim, p);
}
// Mood a second lost waiting for a margarita (after the grace).
function thirst(sim, p) {
  if (p.problem !== "drink") return 0;
  return p.orderT > CHILL.grace ? (p.vip ? CHILL.vipThirst : CHILL.thirst) * (planOf(sim).patience ?? 1) : 0;
}

// Done with this part of their plan: on to the next, or home.
function nextOrHome(sim, p) {
  if (p.planStep < p.plan.length - 1) {
    p.planStep++;
    if (p.status === "swim") {
      p.transfer = true;
      p.status = "exit";
      beginRoofExit(sim, p);
    } else {
      getUp(sim, p);
      walkToActivity(sim, p);
    }
    return;
  }
  sim.depart(p, true);
}
// Off a sunbed: it is left messy for the coach.
export function getUp(sim, p) {
  if (p.bed == null) return;
  const bed = sim.roof.beds[p.bed];
  if (bed.guest === p.id) {
    bed.guest = null;
    if (p.status === "lounge") {
      bed.messy = true;
      sim.emit("bed-messy", { bed: bed.id, ...bedOf(sim, bed.id) });
    }
  }
  const b = bedOf(sim, p.bed);
  if (p.status === "lounge") {
    p.x = b.foot.x;
    p.z = b.foot.z;
  }
  p.bed = null;
}
// Whoever leaves (served, lost, at the end): off their sunbed and out of their group.
export function roofLeaving(sim, p) {
  if (p.bed != null) getUp(sim, p);
  p.group = null;
  p.onEdge = false;
  if (p.problem === "selfie") p.problem = null;
}

// ---- the margaritas ----------------------------------------------------------------------------------------------------

function order(sim, p, dt) {
  if (p.problem === "drink") {
    p.orderT = (p.orderT || 0) + dt;
    return;
  }
  if (p.problem || p.sipping > 0) return;
  p.orderIn = (p.orderIn ?? 6) - dt;
  if (p.orderIn > 0) return;
  const every = CHILL.orderEvery[p.type] || CHILL.orderEvery.intermediate;
  p.orderIn = between(sim, every) * (p.vip ? 0.8 : 1);
  const chance = p.vip ? 1 : Math.min(0.9, 0.5 + sim.level * 0.03 + (p.type === "advanced" ? 0.15 : 0));
  if (roofRandom(sim) >= chance) return;
  p.problem = "drink";
  p.orderT = 0;
  sim.stats.orders = (sim.stats.orders || 0) + 1;
  sim.emit("order", { id: p.id, x: p.x, z: p.z });
  if (!sim.roof.orderTold) {
    sim.roof.orderTold = true;
    sim.emit("toast", {
      text: "🍹 " + p.name + " wants a margarita! Grab a tray at the bar (E) and serve it.",
      warning: true,
    });
  }
}
export function takeTray(sim) {
  const c = sim.coach,
    bar = sim.venue.stations.bar;
  if (distance(c, bar) > 1.8)
    return sim.guideTo(bar, "Walk to the bar and press E for a tray of margaritas.");
  if (!sim.canInteract()) return false;
  if (c.carry && c.carry !== "tray") {
    sim.emit("toast", { text: "Hands full. Put that down first." });
    return false;
  }
  const filled = c.carry === "tray";
  c.carry = "tray";
  c.carryOwner = null;
  c.tray = CHILL.tray;
  sim.feedback("tray", { filled });
  return true;
}
export function returnTray(sim) {
  const c = sim.coach;
  if (c.carry !== "tray" || !sim.canInteract()) return false;
  c.carry = null;
  c.tray = 0;
  sim.feedback("pickup");
  return true;
}
export function serveDrink(sim, p) {
  const c = sim.coach;
  if (!p || p.problem !== "drink" || c.carry !== "tray" || !(c.tray > 0)) return false;
  if (distance(c, p) > ROOF_REACH)
    return sim.guideTo(roofServicePoint(sim, p), "Get next to " + p.name + " and press E.");
  if (!sim.canInteract()) return false;
  const waited = p.orderT || 0;
  p.problem = null;
  p.orderT = 0;
  p.sipping = CHILL.sip;
  p.drinks = (p.drinks || 0) + 1;
  p.h = Math.min(100, p.h + CHILL.cheers);
  const tip = p.vip ? CHILL.vipTip : CHILL.tip;
  sim.score += tip;
  sim.stats.drinks = (sim.stats.drinks || 0) + 1;
  c.tray--;
  sim.emit("points", { x: p.x, z: p.z, value: tip });
  sim.feedback("serve", { id: p.id, to: { x: p.x, z: p.z }, left: c.tray });
  // (A VIP served before they minded is a little moment; every margarita would be too many.)
  if (waited < CHILL.grace && p.vip) sim.save("margarita", p, tip, { id: p.id, name: p.name });
  if (c.tray === 0) {
    c.carry = null;
    sim.emit("toast", { text: "Tray empty! Back to the bar for more." });
  }
  if (!p.tipsy && p.drinks >= CHILL.tipsy) {
    p.tipsy = true;
    sim.emit("tipsy", { id: p.id, x: p.x, z: p.z });
    if (!sim.roof.tipsyTold) {
      sim.roof.tipsyTold = true;
      sim.emit("toast", {
        text: "🥴 " + p.name + " is tipsy. Keep an eye on them near the edge!",
        warning: true,
      });
    }
  }
  return true;
}

// ---- the sunbeds -------------------------------------------------------------------------------------------------------

export function tidyBed(sim, bed) {
  const b = bedOf(sim, bed.id);
  if (!bed.messy) return false;
  if (distance(sim.coach, b.foot) > 1.4) return sim.guideTo(b.foot, "Walk to the messy sunbed and press E.");
  if (!sim.canInteract() || sim.coach.carry) return false;
  return sim.startBusy(
    "tidy",
    CHILL.tidy,
    "Tidying the sunbed",
    () => {
      bed.messy = false;
      sim.score += CHILL.tidyPoints;
      sim.stats.tidied = (sim.stats.tidied || 0) + 1;
      sim.emit("points", { x: b.x, z: b.z, value: CHILL.tidyPoints });
      sim.emit("tidy", { bed: bed.id, x: b.x, z: b.z });
    },
    b,
  );
}

// ---- the selfie at the edge --------------------------------------------------------------------------------------------

function updateSelfies(sim, dt) {
  const R = sim.roof;
  if (sim.level < CHILL.selfieFrom || sim.status !== "playing") return;
  if (sim.people.some((p) => p.problem === "selfie" || p.status === "overboard")) return;
  R.selfieIn -= dt;
  if (R.selfieIn > 0) return;
  const candidates = sim.people.filter(
    (p) => p.status === "swim" && !p.problem && !p.stomachWarning && p.workTime > 4,
  );
  if (!candidates.length) {
    R.selfieIn = 4;
    return;
  }
  const weight = (p) => (p.tipsy ? 3 : 1) * (p.vip ? 2 : 1) * (p.type === "advanced" ? 1.5 : 1),
    total = candidates.reduce((a, p) => a + weight(p), 0);
  let roll = roofRandom(sim) * total,
    p = candidates[0];
  for (const q of candidates) {
    roll -= weight(q);
    if (roll <= 0) {
      p = q;
      break;
    }
  }
  R.selfieIn = selfieInterval(sim);
  p.problem = "selfie";
  p.selfie = {
    stage: "wading",
    z: clamp(p.z, -ROOF.halfZ + 0.8, ROOF.halfZ - 0.8),
    t: 0,
    limit: selfieLimit(sim, p),
  };
  sim.stats.selfies = (sim.stats.selfies || 0) + 1;
  sim.emit("selfie-start", { id: p.id, x: p.x, z: p.z });
  sim.emit("toast", {
    text:
      "📸 " +
      p.name +
      (p.tipsy ? " (tipsy!)" : "") +
      " is heading for the infinity edge with a phone. Stop them!",
    warning: true,
  });
}
// The selfie, step by step. True while it has the guest (they do nothing else).
function tickSelfie(sim, p, dt) {
  const s = p.problem === "selfie" && p.selfie;
  if (!s) return false;
  if (s.stage === "wading") {
    wadeTo(sim, p, { x: ROOF.halfX - 0.5, z: s.z }, CHILL.wade * 1.1, dt, []);
    if (p.x >= ROOF.halfX - 0.55) {
      s.stage = "climbing";
      s.t = 0;
      p.angle = Math.PI / 2;
      sim.incident("selfie", p, { id: p.id, name: p.name });
    }
    return true;
  }
  if (s.stage === "climbing") {
    s.t += dt;
    p.onEdge = true;
    p.x = ROOF.halfX - 0.5 + Math.min(1, s.t / CHILL.climbUp) * 0.45;
    if (s.t >= CHILL.climbUp) {
      s.stage = "posing";
      s.t = 0;
    }
    return true;
  }
  // Posing on the edge, leaning out over the city: the coach's few seconds.
  s.t += dt;
  p.angle = Math.PI / 2;
  p.actualSpeed = 0;
  if (s.t >= s.limit) goOverboard(sim, p, "slip");
  return true;
}
// The coach talks a guest out of it (on the way, or down off the edge).
export function stopSelfie(sim, p) {
  if (!p || p.problem !== "selfie") return false;
  if (distance(sim.coach, p) > CHILL.reach)
    return sim.guideTo(p, "Get to " + p.name + " (wade in!) and press E.");
  if (!sim.canInteract()) return false;
  const onEdge = p.selfie.stage !== "wading",
    points = onEdge ? CHILL.stopped : CHILL.intercepted;
  p.problem = null;
  p.selfie = null;
  p.onEdge = false;
  p.x = Math.min(p.x, ROOF.halfX - 0.6);
  p.h = Math.max(0, p.h - 4);
  sim.score += points;
  sim.stats.selfiesStopped = (sim.stats.selfiesStopped || 0) + 1;
  sim.emit("points", { x: p.x, z: p.z, value: points });
  sim.feedback("helped", { id: p.id });
  sim.save("selfie-stopped", p, points, { id: p.id, name: p.name });
  sim.emit("toast", {
    text: (onEdge ? "Down you come! " : "Not so fast! ") + p.name + " puts the phone away. +" + points,
  });
  return true;
}
function goOverboard(sim, p, why) {
  p.status = "overboard";
  p.problem = "overboard";
  p.selfie = null;
  p.onEdge = false;
  p.group = null;
  p.x = (ROOF.gutter.x0 + ROOF.gutter.x1) / 2;
  p.overT = 0;
  p.actualSpeed = 0;
  p.h = Math.max(0, p.h - 30);
  sim.score -= CHILL.overboard;
  sim.streak = 0;
  sim.stats.overboard = (sim.stats.overboard || 0) + 1;
  sim.emit("overboard", { id: p.id, x: p.x, z: p.z, why });
  sim.emit("points", { x: p.x, z: p.z, value: -CHILL.overboard });
  sim.incident("overboard", p, { id: p.id, name: p.name });
  sim.emit("toast", {
    text:
      "SPLOOSH! " +
      p.name +
      (why === "drop" ? " lost their footing on the drop" : " leaned too far") +
      " and went over the edge into the gutter! −" +
      CHILL.overboard +
      " · Haul them back (E at the edge)!",
    warning: true,
  });
}
function tickOverboard(sim, p, dt) {
  p.overT += dt;
  if (p.overT < CHILL.stranded) return;
  // Left in the gutter: out by the service stairs at the end, dripping and furious.
  p.problem = null;
  const end = { x: (ROOF.gutter.x0 + ROOF.gutter.x1) / 2, z: Math.sign(p.z || 1) * (ROOF.halfZ + 0.9) };
  sim.lose(p);
  p.path = [
    end,
    ...planOf(sim).route(end, sim.venue.arrival.at(p.side, "outside")),
    ...sim.returnRoute(p.side),
  ];
}
export function haulBack(sim, p) {
  if (!p || p.status !== "overboard") return false;
  const c = sim.coach,
    at = { x: ROOF.halfX - 0.3, z: p.z };
  if (distance(c, at) > CHILL.reach)
    return sim.guideTo(at, "Wade to the infinity edge beside " + p.name + " and press E.");
  if (!sim.canInteract()) return false;
  return sim.startBusy(
    "haul",
    1.1,
    "Hauling " + p.name + " back",
    () => {
      if (p.status !== "overboard") return;
      p.status = "swim";
      p.problem = null;
      p.x = ROOF.halfX - 0.7;
      p.h = Math.max(0, p.h - 10);
      p.workTarget = Math.min(p.workTarget, p.workTime + 4); // (they have had enough of the edge: off soon)
      sim.score += CHILL.hauled;
      sim.emit("points", { x: p.x, z: p.z, value: CHILL.hauled });
      sim.save("hauled", p, CHILL.hauled, { id: p.id, name: p.name });
      sim.emit("toast", { text: "Back over you come! " + p.name + " is soaked but safe. +" + CHILL.hauled });
    },
    at,
  );
}

// ---- the DJ ------------------------------------------------------------------------------------------------------------

// Where the DJ's set is: the next drop (in seconds of the shift), and whether the build-up has begun.
export function nextDrop(sim) {
  const R = sim.roof,
    bar = R?.drops[R.nextDrop];
  return bar == null ? null : bar * CHILL.bar;
}
function updateDJ(sim, dt) {
  const R = sim.roof;
  R.hype = Math.max(0, R.hype - dt);
  const at = nextDrop(sim);
  if (at == null) return;
  if (!R.warned && sim.time >= at - CHILL.dropWarning * CHILL.bar) {
    R.warned = true;
    sim.emit("drop-warning", { at });
    if (!R.dropTold) {
      R.dropTold = true;
      sim.emit("toast", {
        text: "🎧 The DJ is building up to THE DROP! Everyone in the water will jump: get them off the edge, and get the mop ready.",
      });
    }
  }
  if (sim.time < at) return;
  R.nextDrop++;
  R.warned = false;
  drop(sim);
}
function drop(sim) {
  const R = sim.roof;
  R.hype = CHILL.hype;
  sim.stats.drops = (sim.stats.drops || 0) + 1;
  sim.emit("drop", {});
  let spots = 0;
  for (const p of sim.people) {
    if (p.status !== "swim") continue;
    // Anyone up on the edge goes straight over.
    if (p.onEdge) {
      goOverboard(sim, p, "drop");
      continue;
    }
    if (!p.problem) p.h = Math.min(100, p.h + CHILL.dropFun);
    // The water slops over the near edge and the ends onto the deck.
    if (spots >= CHILL.splashMax || sim.cleanup || sim.closed) continue;
    const near = p.x < -ROOF.halfX + 1.2,
      end = Math.abs(p.z) > ROOF.halfZ - 1.2;
    if ((near || end) && roofRandom(sim) < CHILL.splash) {
      const at = end
        ? { x: clamp(p.x, -ROOF.halfX, ROOF.halfX - 0.5), z: Math.sign(p.z) * (ROOF.halfZ + 0.95) }
        : { x: -ROOF.halfX - 0.85, z: p.z };
      if (addWetSpot(sim, at.x, at.z)) spots++;
    }
  }
  if (spots) sim.emit("drop-splash", { spots });
}

// ---- out of the water --------------------------------------------------------------------------------------------------

// Out by the near edge: wade to it, climb out onto the walk (dripping), then on to a sunbed or home.
export function beginRoofExit(sim, p) {
  p.exitPhase = "water";
  p.exitProgress = 0;
  p.onEdge = false;
  p.path = [{ x: planOf(sim).edge.inside, z: inWater(sim, 0, p.z, 0.6).z }];
  p.bumpTime = 0;
  p.slipTime = 0;
}
export function tickRoofExit(sim, p, dt) {
  if (p.status !== "exit" || !["water", "climb"].includes(p.exitPhase)) return false;
  if (p.exitPhase === "water") {
    if (sim.moveAlong(p, dt, p.rescueRecover ? 1.6 : CHILL.wade * 1.3)) {
      p.exitPhase = "climb";
      p.exitProgress = 0;
      p.climbFrom = { x: p.x, z: p.z };
      sim.emit("climb-out", { id: p.id, x: p.x, z: p.z });
    }
    return true;
  }
  p.exitProgress = Math.min(1, p.exitProgress + dt / CHILL.climb);
  const t = p.exitProgress * p.exitProgress * (3 - 2 * p.exitProgress);
  const E = planOf(sim).edge;
  p.x = p.climbFrom.x + (E.out - p.climbFrom.x) * t;
  p.angle = (-E.dir * Math.PI) / 2;
  if (p.exitProgress < 1) return true;
  p.actualSpeed = 0;
  p.exitPhase = "deck";
  p.group = null;
  if (p.rescueRecover) {
    sim.rescueOnDeck(p);
    return true;
  }
  WetSpots.climbedOut(sim, p, { x: p.x, z: p.z });
  if (p.transfer) {
    p.transfer = false;
    p.exitPhase = null;
    walkToActivity(sim, p);
    return true;
  }
  p.stunned = Math.max(p.stunned || 0, 1);
  p.path = [...planOf(sim).route(p, sim.venue.arrival.at(p.side, "outside")), ...sim.returnRoute(p.side)];
  return true;
}

// ---- the coach and the guests ------------------------------------------------------------------------------------------

// How close the coach must be to hand a guest something: beside them in the water (from the edge, or wading), or at their sunbed.
export const ROOF_REACH = 1.9;
// Where the coach stands to serve a guest: on the walk at the near edge beside one in the water (or in the water by them, if
// they are out of reach of the edge), at the foot of a sunbed.
export function roofServicePoint(sim, p) {
  if (p.status === "lounge" && p.bed != null) return bedOf(sim, p.bed).foot;
  if (p.status === "overboard") return { x: ROOF.halfX - 0.3, z: p.z };
  if (p.status === "swim") {
    const E = planOf(sim).edge,
      edge = { x: E.stand, z: p.z };
    return distance(edge, p) <= ROOF_REACH ? edge : { x: p.x - 0.6 * E.dir, z: p.z };
  }
  return { x: p.x, z: p.z };
}

// ---- the party as a system (chaos.mjs SYSTEMS): alerts, the coach's options, hints, the banner, the diary -------------

export const RooftopParty = {
  key: "roof",
  // Not an incident: the venue's own life (it never counts towards the incidents a shift may run at once).
  isActive: () => false,
  describe(sim) {
    const R = sim.roof;
    if (!R) return "";
    const orders = sim.people.filter((p) => p.problem === "drink").length,
      messy = R.beds.filter((b) => b.messy).length,
      edge = sim.people.find((p) => p.problem === "selfie" || p.status === "overboard");
    return (
      orders +
      " orders · " +
      messy +
      " messy" +
      (edge ? " · " + (edge.status === "overboard" ? "overboard" : "selfie " + edge.selfie?.stage) : "")
    );
  },
  detail(sim) {
    const R = sim.roof;
    if (!R) return null;
    return {
      orders: sim.people.filter((p) => p.problem === "drink").length,
      messy: R.beds.filter((b) => b.messy).length,
      tray: sim.coach.carry === "tray" ? sim.coach.tray : 0,
      drop: nextDrop(sim),
    };
  },
  alert(sim, alerts) {
    const R = sim.roof;
    if (!R) return;
    const c = sim.coach;
    for (const p of sim.people) {
      if (p.status === "overboard")
        alerts.push({
          kind: "overboard",
          icon: "🆘",
          label: p.name,
          x: p.x,
          z: p.z,
          y: 1.2,
          urgency: 95,
          id: p.id,
        });
      else if (p.problem === "selfie")
        alerts.push({
          kind: "selfie",
          icon: "📸",
          label: p.name,
          x: p.x,
          z: p.z,
          y: 2.4,
          urgency: p.selfie?.stage === "posing" ? 92 : 80,
          id: p.id,
        });
      else if (p.problem === "drink")
        alerts.push({
          kind: "drink",
          icon: "🍹",
          label: p.name,
          x: p.x,
          z: p.z,
          y: 1.9,
          urgency: c.carry === "tray" ? 46 : 32,
          id: p.id,
        });
    }
    if (!c.carry && sim.people.some((p) => p.problem === "drink"))
      alerts.push({ kind: "bar", icon: "🍹", label: "Bar", ...sim.venue.stations.bar, y: 1.8, urgency: 31 });
    for (const b of R.beds)
      if (b.messy)
        alerts.push({
          kind: "messy",
          icon: "🧺",
          label: "Messy sunbed",
          ...bedOf(sim, b.id),
          y: 1.1,
          urgency: 22,
        });
  },
  interactions(sim, options) {
    const R = sim.roof;
    if (!R) return;
    const c = sim.coach,
      bar = sim.venue.stations.bar;
    for (const p of sim.people) {
      if (p.problem === "selfie" && distance(c, p) <= CHILL.reach)
        options.push({
          kind: "assist",
          id: p.id,
          label:
            (p.selfie?.stage === "wading" ? "Stop " : "Get ") +
            p.name +
            (p.selfie?.stage === "wading" ? "’s selfie" : " off the edge"),
          x: p.x,
          z: p.z,
          rank: -70 + distance(c, p),
          run: () => stopSelfie(sim, p),
        });
      if (p.status === "overboard" && distance(c, { x: ROOF.halfX - 0.3, z: p.z }) <= CHILL.reach)
        options.push({
          kind: "assist",
          id: p.id,
          label: "Haul " + p.name + " back over the edge",
          x: ROOF.halfX - 0.3,
          z: p.z,
          rank: -75 + distance(c, p),
          run: () => haulBack(sim, p),
        });
      if (c.carry === "tray" && p.problem === "drink" && distance(c, p) <= ROOF_REACH)
        options.push({
          kind: "deliver",
          id: p.id,
          label: "Serve " + p.name + " a margarita",
          x: p.x,
          z: p.z,
          rank: distance(c, p) - (p.vip ? 0.5 : 0),
          run: () => serveDrink(sim, p),
        });
    }
    if (distance(c, bar) <= 1.8 && (!c.carry || c.carry === "tray")) {
      if (!c.carry || c.tray < CHILL.tray)
        options.push({
          kind: "fetch",
          item: "tray",
          label: c.carry ? "Fill the tray up" : "Pick up a tray of margaritas",
          ...bar,
          rank: distance(c, bar) + (sim.people.some((p) => p.problem === "drink") ? 0 : 2),
          run: () => takeTray(sim),
        });
      else
        options.push({
          kind: "return",
          label: "Put the tray back",
          ...bar,
          rank: distance(c, bar) + 3,
          run: () => returnTray(sim),
        });
    }
    if (!c.carry)
      for (const b of R.beds) {
        if (!b.messy) continue;
        const foot = bedOf(sim, b.id).foot;
        if (distance(c, foot) <= 1.4)
          options.push({
            kind: "tidy",
            label: "Tidy the " + (bedOf(sim, b.id).cabana ? "cabana" : "sunbed"),
            ...foot,
            rank: distance(c, foot) + 0.5,
            run: () => tidyBed(sim, b),
          });
      }
  },
  // R (put it back): the tray goes back to the bar.
  returnItem(sim) {
    if (sim.coach.carry !== "tray") return undefined;
    const bar = sim.venue.stations.bar;
    if (distance(sim.coach, bar) > 1.8) return sim.guideTo(bar, "Take the tray back to the bar and press E.");
    return returnTray(sim);
  },
  hint(sim) {
    const R = sim.roof;
    if (!R) return "";
    const c = sim.coach,
      over = sim.people.find((p) => p.status === "overboard"),
      selfie = sim.people.find((p) => p.problem === "selfie"),
      thirsty = sim.people.filter((p) => p.problem === "drink").length,
      messy = R.beds.filter((b) => b.messy).length;
    if (over)
      return "🆘 " + over.name + " went over the edge! Wade to the infinity edge and haul them back · E";
    if (selfie)
      return "📸 " + selfie.name + " is going for a selfie on the edge! Wade over and stop them · E";
    if (c.carry === "tray")
      return thirsty
        ? "🍹 Serve the margaritas · " + c.tray + " on the tray"
        : "🍹 " +
            c.tray +
            " margarita" +
            (c.tray > 1 ? "s" : "") +
            " on the tray · put it back at the bar or wait for orders";
    if (thirsty)
      return "🍹 " + thirsty + " margarita" + (thirsty > 1 ? "s" : "") + " ordered · grab a tray at the bar";
    if (messy)
      return "🧺 " + messy + " messy sunbed" + (messy > 1 ? "s" : "") + " · tidy them (E at the bed)";
    return "";
  },
  panel(sim) {
    const R = sim.roof;
    if (!R) return null;
    const at = nextDrop(sim);
    if (at == null || !R.warned) return null;
    return {
      icon: "🎧",
      title: "THE DROP IN " + Math.max(1, Math.ceil(at - sim.time)) + "!",
      task: "Get everyone off the edge · the water will slop over",
    };
  },
};
