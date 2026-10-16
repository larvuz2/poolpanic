// The Lazy River's ride (17 October 2026): what a guest does there, from the door to the door. Every guest is a tube rider (`rider`):
// they wait in the lounge until the coach hands them a tube (the fins' plumbing: `finsFirst`, the rack holds the venue's `tubes`),
// are sent to the river (the one RIVER button), walk to the boarding dock, sit into their tube (`boarding`: the TubeBoard clip at the
// simulation's time) and float off with the current. The river carries them out of sight through the tunnel (`away`, for the
// venue's `hidden` seconds: the rest of the loop, in the jungle) and back in at the cave, and on that second pass they drift to the
// exit dock, climb out (TubeBoard backwards), leave their tube at the tube return and go home. The coach carries the tubes back to
// the rack, or straight to the next guest who wants one.
//
// In the water a rider drifts across the river a little (a lane of their own every few seconds, steering round the stepping stones),
// bumps into other tubes now and then, and with a problem (sore eyes) paddles to the near bank and holds on there until the coach
// comes. A rescue, a closed river or a panicking crowd stops the pumps: everyone holds where they are. The rider's own random
// numbers come from a stream of their own (`riverRandom`), so the rest of the shift draws what it would anywhere.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export const RIDE = {
  board: 1.1, // s, sitting into the tube (the TubeBoard clip)
  climb: 1.0, // s, climbing out of it onto the exit dock (the same clip, backwards)
  tubeRadius: 0.55,
  bumpGap: 1.12, // centres closer than this and two tubes bump
  bankHold: 0.8, // how far in from the bank a rider in trouble holds on
  starPaddle: 1.3, // Marco paddles his tube faster than the current
  crowd: 9, // more riders than this in sight and the river feels packed
};

export function riverRandom(sim) {
  sim.riverSeed =
    (Math.imul(sim.riverSeed || (sim.seed ^ 0x51ed27c3) >>> 0 || 7, 1664525) + 1013904223) >>> 0;
  return sim.riverSeed / 4294967296;
}

// A new guest at the river: a tube rider who will not go in without a tube.
export function riderSpawn(sim, p) {
  Object.assign(p, {
    needsFins: true,
    midFins: false,
    finsFirst: true,
    hasFins: false,
    problem: "fins",
    lap: 0,
  });
  p.waitLimit *= 1.35; // (they have asked for a tube: they wait a little longer for it)
}

// Sent to the river: walk to the boarding dock (whatever lane a caller had in mind; the river has one).
export function walkToRiver(sim, p, mode = "enter") {
  const dock = sim.venue.river.docks.board;
  p.status = mode;
  p.lane = 0;
  p.boarding = 0;
  p.path = sim.venue.route(p, dock.stand);
}

// The boarding dock is clear when no tube is floating in the way of a new one.
function dockClear(sim, p, dock) {
  return !sim.people.some(
    (q) =>
      q !== p &&
      ((q.status === "swim" && !q.away && distance(q, dock.water) < 1.5) ||
        (q.status === "enter" && q.boarding > 0)),
  );
}

// A rider walking to the boarding dock and sitting into their tube. True while it has them (the caller skips the rest).
export function tickRiverEnter(sim, p, dt) {
  if (p.status !== "enter") return false;
  const river = sim.venue.river,
    dock = river.docks.board;
  if (p.boarding > 0) {
    p.boarding = Math.max(0, p.boarding - dt);
    const t = 1 - p.boarding / RIDE.board,
      e = t * t * (3 - 2 * t),
      from = p.boardFrom || dock.stand;
    p.x = from.x + (dock.water.x - from.x) * e;
    p.z = from.z + (dock.water.z - from.z) * e;
    p.angle = river.at(dock.s).angle;
    if (p.boarding === 0) startRide(sim, p, dock);
    return true;
  }
  // (On the dock is close enough: two guests do not jostle each other off the one spot for ever.)
  if (p.path.length && distance(p, dock.stand) < 0.75) p.path = [];
  if (p.path.length) {
    sim.moveAlong(p, dt, sim.pace(p, 3.3));
    return true;
  }
  // On the dock: in when the water is clear, else a moment's wait.
  p.angle = dock.angle;
  if (dockClear(sim, p, dock)) {
    p.boarding = RIDE.board;
    p.boardFrom = { x: p.x, z: p.z };
    sim.emit("board", { id: p.id, x: dock.stand.x, z: dock.stand.z });
  }
  return true;
}

function startRide(sim, p, dock) {
  const river = sim.venue.river;
  p.status = "swim";
  p.s = dock.s;
  p.d = -(river.w - 0.8);
  p.dTarget = p.d;
  p.retarget = 1.5;
  p.away = false;
  if (!p.resumingWorkout) {
    p.workTime = 0;
    p.lap = 0;
  }
  p.resumingWorkout = false;
  p.spin = (riverRandom(sim) - 0.5) * 0.6;
  sim.emit("splash", { x: p.x, z: p.z });
}

// Every rider in the river, each frame (the pumps stop for a rescue, a closed river or a panicking crowd).
export function updateRiver(sim, dt) {
  if (sim.rescue || sim.crowdPanic()) return;
  const river = sim.venue.river,
    riders = sim.people.filter((p) => p.status === "swim"),
    seen = riders.filter((p) => !p.away),
    exit = river.docks.exit;
  for (const p of riders) {
    p.workTime += dt;
    if (p.away) {
      p.awayT -= dt;
      if (p.awayT <= 0) {
        // Round the loop: back in at the cave.
        p.away = false;
        p.lap = (p.lap || 0) + 1;
        p.s = river.start - 0.4;
        p.d = (riverRandom(sim) - 0.5) * 2.4;
        p.dTarget = p.d;
      } else continue;
    }
    sim.tickStomach(p, dt);
    if (sim.cleanup || sim.closed) return;
    p.collisionTime = Math.max(0, (p.collisionTime || 0) - dt);
    p.bumpCooldown = Math.max(0, (p.bumpCooldown || 0) - dt);
    // Steering: a new line across the river now and then; round the stepping stones; to the near bank when in trouble.
    p.retarget = (p.retarget ?? 0) - dt;
    if (p.retarget <= 0) {
      p.dTarget = (riverRandom(sim) - 0.5) * 2 * (river.w - 1.1);
      p.retarget = 2.5 + riverRandom(sim) * 3;
    }
    let target = p.dTarget;
    for (const st of river.stones)
      if (Math.abs(p.s - st.s) < 2.2) {
        // The gaps: between the stones, or between a stone and the bank.
        const gaps = [-1, 0, 1].map((k) => k * 2.45);
        target = gaps.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
      }
    const holding = !!p.problem;
    if (holding) target = -(river.w - RIDE.bankHold);
    p.d += clamp(target - p.d, -dt * 0.8, dt * 0.8);
    // Downstream with the current (a rider holding the bank stays put once there).
    const atBank = holding && Math.abs(p.d - target) < 0.15;
    const speed = atBank ? 0 : river.flow * (p.star ? RIDE.starPaddle : 1) * (p.collisionTime > 0 ? 0.35 : 1);
    p.actualSpeed = speed;
    p.s += speed * dt;
    p.traveled += speed * dt;
    // Out through the tunnel: away round the loop.
    if (p.s > river.end + 0.4) {
      p.away = true;
      p.awayT = river.hidden;
      const out = river.point(river.end + 2, 0);
      p.x = out.x;
      p.z = out.z;
      continue;
    }
    const at = river.point(p.s, p.d);
    p.x = at.x;
    p.z = at.z;
    p.angle = river.at(p.s).angle;
    // Eyes sting in strong chlorine, as in any pool.
    if (sim.chlorine > p.chlorineTolerance && p.eyeCooldown === 0) {
      p.irritation += dt * (sim.chlorine - p.chlorineTolerance) * 0.14;
      if (p.irritation > 10 && !p.problem) {
        p.problem = "eyes";
        sim.emit("toast", {
          text: p.name + " has sore eyes and is holding on to the bank. Bring eye relief.",
          warning: true,
        });
      }
    } else p.irritation = Math.max(0, p.irritation - dt * 0.8);
    // Mood: a packed river, dirty water, waiting at the bank for help.
    const crowd = Math.max(0, seen.length - RIDE.crowd);
    p.h -=
      dt *
      (crowd * 0.4 + Math.max(0, sim.contamination - 35) * 0.025 + (p.problem ? 1.6 : 0)) *
      (p.vip ? 1.4 : 1);
    p.h = clamp(p.h, 0, 100);
    if (p.h <= 0) {
      sim.lose(p);
      continue;
    }
    // Round once and at the exit dock: off they get.
    if ((p.lap || 0) >= 1 && !p.problem && !p.stomachWarning && p.s >= exit.s - 0.9 && p.s <= exit.s + 1.6)
      sim.depart(p, true);
  }
  bumpTubes(sim, seen);
}

// Two tubes that drift into each other bump: they push apart across the river, slow a moment and spin.
function bumpTubes(sim, seen) {
  const river = sim.venue.river;
  for (let i = 0; i < seen.length; i++)
    for (let j = i + 1; j < seen.length; j++) {
      const a = seen[i],
        b = seen[j];
      if (a.status !== "swim" || b.status !== "swim" || a.away || b.away) continue;
      const gap = distance(a, b);
      if (gap >= RIDE.bumpGap) continue;
      const push = (RIDE.bumpGap - gap) * 0.5,
        dir = a.d >= b.d ? 1 : -1;
      a.d = clamp(a.d + dir * push, -(river.w - 0.6), river.w - 0.6);
      b.d = clamp(b.d - dir * push, -(river.w - 0.6), river.w - 0.6);
      if (a.bumpCooldown > 0 || b.bumpCooldown > 0) continue;
      a.bumpCooldown = b.bumpCooldown = 2.5;
      a.collisionTime = b.collisionTime = 0.6;
      a.h = Math.max(0, a.h - 3);
      b.h = Math.max(0, b.h - 3);
      a.spin = -(a.spin || 0) + (riverRandom(sim) - 0.5) * 1.6;
      b.spin = -(b.spin || 0) + (riverRandom(sim) - 0.5) * 1.6;
      sim.emit("tube-bump", { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, a: a.id, b: b.id });
    }
}

// Out of the river: to the exit dock if they rode round (or the nearest bank, for anyone else: a rescued rider, an evacuation).
export function beginRiverExit(sim, p) {
  const river = sim.venue.river,
    exit = river.docks.exit,
    toDock = p.served && Math.abs((p.s ?? 0) - exit.s) < 3;
  const bank = toDock
    ? { water: exit.water, deck: exit.stand }
    : river.bank(p.x, p.z, { side: riverSide(sim, p) });
  p.exitPhase = "water";
  p.exitProgress = 0;
  p.exitBank = bank;
  p.exitDock = toDock;
  p.path = [{ ...bank.water }];
  p.bumpTime = 0;
  p.slipTime = 0;
}
// The bank a rider leaves by: the nearer one, or the near bank when both are as near (the far one is a long way round).
function riverSide(sim, p) {
  const river = sim.venue.river,
    q = river.locate(p.x, p.z),
    near = river.bank(p.x, p.z, { side: -1 }).deck,
    far = river.bank(p.x, p.z, { side: 1 }).deck;
  const ok = (pt) => sim.venue.isDeck(pt.x, pt.z, sim.level, 0.3);
  if (!ok(far)) return -1;
  if (!ok(near)) return 1;
  return q.d > 0.8 ? 1 : -1;
}

// Swimming to the bank, climbing out (and leaving the tube at the tube return), then the walk home. True while it has them.
export function tickRiverExit(sim, p, dt) {
  if (p.status !== "exit" || !["water", "climb", "return"].includes(p.exitPhase)) return false;
  const river = sim.venue.river;
  if (p.exitPhase === "water") {
    if (sim.moveAlong(p, dt, 1.6)) {
      p.exitPhase = "climb";
      p.exitProgress = 0;
      p.climbFrom = { x: p.x, z: p.z };
      sim.emit("climb-out", { id: p.id, x: p.x, z: p.z });
    }
  } else if (p.exitPhase === "climb") {
    p.exitProgress = Math.min(1, p.exitProgress + dt / RIDE.climb);
    const t = p.exitProgress * p.exitProgress * (3 - 2 * p.exitProgress),
      to = p.exitBank.deck;
    p.x = p.climbFrom.x + (to.x - p.climbFrom.x) * t;
    p.z = p.climbFrom.z + (to.z - p.climbFrom.z) * t;
    p.angle = Math.atan2(to.x - p.climbFrom.x, to.z - p.climbFrom.z);
    if (p.exitProgress === 1) {
      p.actualSpeed = 0;
      p.stunned = Math.max(p.stunned || 0, 1);
      // One in five drips a wet spot where they got out (incidents/wet.mjs).
      sim.dripOnBank?.(p, to);
      if (p.rescueRecover) {
        p.exitPhase = "deck";
        sim.rescueOnDeck(p);
        return true;
      }
      if (p.hasFins) {
        // To the tube return with it, then home.
        p.exitPhase = "return";
        p.path = sim.venue.route(p, river.docks.tubeReturn);
      } else homeFromRiver(sim, p);
    }
  } else if (sim.moveAlong(p, dt, sim.pace(p, 3.6))) {
    p.hasFins = false;
    const n = sim.clutter.filter(
      (f) => f.type === "fins" && distance(f, river.docks.tubeReturn) < 1.2,
    ).length;
    sim.clutter.push({
      id: ++sim.uid,
      type: "fins",
      x: river.docks.tubeReturn.x + ((n % 3) - 1) * 0.35,
      z: river.docks.tubeReturn.z + Math.floor(n / 3) * 0.35,
      returned: true,
    });
    sim.emit("tube-returned", { id: p.id, x: p.x, z: p.z });
    homeFromRiver(sim, p);
  }
  return true;
}
function homeFromRiver(sim, p) {
  p.exitPhase = "deck";
  const door = sim.venue.arrival;
  p.path = [...sim.venue.route(p, { x: p.side * door.outsideX, z: door.doorZ }), ...sim.returnRoute(p.side)];
}

// Where the coach serves a rider from: the bank beside them (the nearer one).
export function riverServicePoint(sim, p) {
  const river = sim.venue.river,
    q = river.locate(p.x, p.z),
    side = q.d > 0.8 ? 1 : -1,
    point = river.point(clamp(q.s, river.start + 0.8, river.end - 0.8), side * (river.w + 0.45));
  return sim.venue.isDeck(point.x, point.z, sim.level, 0.2)
    ? point
    : river.point(clamp(q.s, river.start + 0.8, river.end - 0.8), -side * (river.w + 0.45));
}
// The water's edge nearest the coach (a hair out from the bank), where buckets are poured and dives begin.
export function riverWaterPoint(sim) {
  const river = sim.venue.river,
    c = sim.coach,
    q = river.locate(c.x, c.z),
    s = clamp(q.s, river.start + 0.8, river.end - 0.8),
    d = (Math.sign(q.d) || -1) * Math.min(Math.abs(q.d), river.w + 0.2);
  return river.point(s, d);
}
