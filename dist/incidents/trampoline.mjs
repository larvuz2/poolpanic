// 🤸 Trampoline (resort). Daredevils queue like everyone else, but they only want the tower. Assign one (T
// or click the tower) and they walk to the stairs and wait for the splash lane to empty. The moment it is
// clear they climb, bounce and flip into the lane. If their patience runs out they go anyway, and anyone in
// the splash lane gets flattened: every swimmer freezes, each victim needs a life ring swum out to them,
// they climb out and lie on the deck, and the coach carries the medical kit to patch each one up.
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const TRAMPOLINE_TUNING = {
  walk: 3.3,
  patience: 15,
  climb: 2.1,
  board: 0.55,
  bounce: 2.2,
  flight: 1.1,
  success: 250,
  crash: 300,
  heal: 1.2,
  healBonus: 50,
  hurtDrain: 0.9,
  limp: 1.3,
  reach: 1.8,
};
const T = TRAMPOLINE_TUNING;
const ACTIVE = ["waiting", "climbing", "boarding", "bouncing", "flying"];

export const Trampoline = {
  key: "trampoline",
  init(sim) {
    sim.jumper = null;
    sim.medkit = { state: "cabinet" };
  },
  // Not a scheduled chaos event: jumps come from daredevil customers.
  isActive: () => false,
  holdsClock: (sim) => sim.rescue?.kind === "crash",
  panic: (sim) => sim.rescue?.kind === "crash" || sim.people.some((p) => p.status === "injured"),
  update(sim, dt) {
    for (const p of sim.people) {
      if (p.status !== "injured") continue;
      // Limp clear of the edge (and of other victims), then lie down.
      if (p.path.length && sim.moveAlong(p, dt, T.limp)) {
        p.path = [];
        p.angle = p.exitEnd > 0 ? Math.PI : 0;
      }
      hurt(sim, p, dt);
    }
    const c = sim.coach;
    if (c.carry === "medkit" && sim.medkit.state !== "coach") sim.medkit.state = "coach";
  },
  interactions(sim, options) {
    const c = sim.coach,
      cab = sim.venue.fixtures.medkit;
    if (!cab) return;
    const injured = sim.people.filter((p) => p.status === "injured" && !p.healing);
    if (distance(c, cab) < T.reach) {
      if (!c.carry && injured.length)
        options.push({
          kind: "medkit",
          label: "Grab the medical kit",
          x: cab.x,
          z: cab.z,
          rank: -270 + distance(c, cab),
          run: () => {
            c.carry = "medkit";
            sim.medkit.state = "coach";
            sim.feedback("pickup");
            return true;
          },
        });
      if (c.carry === "medkit")
        options.push({
          kind: "return-medkit",
          label: "Put the medical kit back",
          x: cab.x,
          z: cab.z,
          rank: injured.length ? 60 : -60 + distance(c, cab),
          run: () => returnMedkit(sim),
        });
    }
    if (c.carry === "medkit")
      for (const p of injured) {
        if (distance(c, p) > T.reach) continue;
        options.push({
          kind: "heal",
          id: p.id,
          label: "Patch up " + p.name,
          x: p.x,
          z: p.z,
          rank: -275 + distance(c, p),
          run: () => {
            p.healing = true;
            return sim.startBusy("heal", T.heal, "Bandaging " + p.name + "…", () => heal(sim, p), p);
          },
        });
      }
  },
  returnItem(sim) {
    if (sim.coach.carry !== "medkit") return undefined;
    return returnMedkit(sim);
  },
  hint(sim) {
    if (sim.rescue?.kind === "crash") return "";
    const injured = sim.people.filter((p) => p.status === "injured").length;
    if (injured)
      return sim.coach.carry === "medkit"
        ? "Kneel beside the injured · E to patch up"
        : "🩹 Grab the medical kit · E";
    if (sim.coach.carry === "medkit") return "Put the medical kit back · E";
    const j = sim.get(sim.jumper);
    if (j?.jumpStage === "waiting") return `🤸 Clear lane ${sim.venue.trampoline.lane + 1} for ${j.name}`;
    return "";
  },
  panel(sim) {
    const injured = sim.people.filter((p) => p.status === "injured");
    if (injured.length)
      return {
        icon: "🩹",
        title:
          injured.length > 1
            ? `PATCH UP ${injured.length} SWIMMERS`
            : "PATCH UP " + injured[0].name.toUpperCase(),
        task: Trampoline.hint(sim),
        steps: ["MED KIT", "BANDAGE", "PUT BACK"].map((label, i) => {
          const step = sim.coach.carry === "medkit" ? 1 : 0;
          return { label: i + 1 + " · " + label, active: i === step, done: i < step };
        }),
      };
    const j = sim.get(sim.jumper);
    if (j?.jumpStage === "waiting")
      return {
        icon: "🤸",
        title: `CLEAR LANE ${sim.venue.trampoline.lane + 1}!`,
        task: `${j.name} jumps in ${Math.ceil(j.jumpPatience)}s — empty the splash zone`,
      };
    if (j && ["climbing", "boarding", "bouncing", "flying"].includes(j.jumpStage))
      return { icon: "🤸", title: "HERE COMES THE FLIP!", task: "Keep the splash lane empty" };
    return null;
  },
};

// Lane locked while a daredevil waits or jumps.
export function blockedLane(sim) {
  const j = sim.get(sim.jumper);
  return j && ACTIVE.includes(j.jumpStage) ? sim.venue.trampoline.lane : -1;
}
// Is anyone in (or on the way into) the splash lane?
export function splashLaneBusy(sim) {
  const lane = sim.venue.trampoline.lane;
  return sim.people.some((p) => p.lane === lane && ["swim", "enter", "switch"].includes(p.status));
}

export function assignTrampoline(sim) {
  const tr = sim.venue.trampoline,
    p = sim.get(sim.selected);
  if (!tr || sim.status !== "playing") return false;
  if (!p || p.status !== "queue" || p.type !== "daredevil") {
    sim.emit("toast", { text: "Only daredevils 🤸 use the trampoline. Pick one from the queue." });
    return false;
  }
  if (sim.rescue || sim.closed) {
    sim.emit("toast", { text: "Not now! Sort out the pool first.", warning: true });
    return false;
  }
  if (sim.jumper) {
    sim.emit("toast", { text: "One daredevil at a time on the tower." });
    return false;
  }
  sim.jumper = p.id;
  p.status = "trampoline";
  p.jumpStage = "toStairs";
  p.assignedAt = sim.time;
  sim.stats.totalWait += p.wait;
  const cx = sim.venue.pool.corridorX;
  p.path = [
    ...sim.venue.route(p, { x: cx, z: tr.z - 2.6 }),
    { x: tr.stairBottomX, z: tr.z - 2.6 },
    { x: tr.stairBottomX, z: tr.z },
  ];
  sim.selected = null;
  sim.emit("assigned", { id: p.id, lane: "trampoline" });
  return true;
}

// Advance a daredevil through walk → wait → climb → board → bounce → flip → splash.
export function tickJumper(sim, p, dt) {
  if (p.status !== "trampoline") return false;
  const tr = sim.venue.trampoline,
    H = tr.bedY - 0.22;
  switch (p.jumpStage) {
    case "toStairs":
      if (sim.moveAlong(p, dt, T.walk)) {
        p.jumpStage = "waiting";
        p.jumpPatience = sim.config.jumpPatience ?? T.patience;
        p.angle = -Math.PI / 2;
        sim.emit("toast", {
          text: splashLaneBusy(sim)
            ? `${p.name} is waiting on the tower. Clear lane ${tr.lane + 1} before they get impatient!`
            : `${p.name} is climbing the tower!`,
          warning: splashLaneBusy(sim),
        });
      }
      break;
    case "waiting":
      p.angle = -Math.PI / 2;
      if (!splashLaneBusy(sim) && !sim.rescue && !sim.closed) startClimb(sim, p);
      else if (!sim.rescue && !sim.closed) {
        p.jumpPatience = Math.max(0, p.jumpPatience - dt);
        if (p.jumpPatience === 0) {
          startClimb(sim, p);
          sim.emit("toast", {
            text: `${p.name} can't wait any longer! CLEAR LANE ${tr.lane + 1} NOW!`,
            warning: true,
          });
          sim.emit("chaos", { kind: "jump" });
        }
      }
      break;
    case "climbing": {
      p.jumpT = Math.min(1, p.jumpT + dt / T.climb);
      p.x = tr.stairBottomX + (tr.x + 0.95 - tr.stairBottomX) * p.jumpT;
      p.z = tr.z;
      p.y = H * p.jumpT;
      if (p.jumpT === 1) next(p, "boarding");
      break;
    }
    case "boarding":
      p.jumpT = Math.min(1, p.jumpT + dt / T.board);
      p.x = tr.x + 0.95 + (tr.bedX - (tr.x + 0.95)) * p.jumpT;
      p.y = H + (tr.bedY - H) * p.jumpT;
      if (p.jumpT === 1) {
        next(p, "bouncing");
        p.bounce = 0;
        sim.emit("trampoline-bounce", { x: p.x, z: p.z, height: 0 });
      }
      break;
    case "bouncing": {
      // Three bounces, each higher than the last, then the launch.
      p.jumpT = Math.min(1, p.jumpT + dt / T.bounce);
      const phase = p.jumpT * 3,
        k = Math.floor(Math.min(2.999, phase)),
        height = [0.6, 1.05, 1.55][k];
      p.y = tr.bedY + Math.sin((phase - k) * Math.PI) * height;
      if (k !== p.bounce) {
        p.bounce = k;
        sim.emit("trampoline-bounce", { x: p.x, z: p.z, height: k });
      }
      if (p.jumpT === 1) {
        next(p, "flying");
        p.launch = { x: p.x, y: tr.bedY };
        sim.emit("trampoline-launch", { x: p.x, z: p.z });
      }
      break;
    }
    case "flying": {
      p.jumpT = Math.min(1, p.jumpT + dt / T.flight);
      const t = p.jumpT,
        landX = sim.lanes[tr.lane];
      p.x = p.launch.x + (landX - p.launch.x) * t;
      p.y = p.launch.y + (-0.35 - p.launch.y) * t + Math.sin(t * Math.PI) * 3.7;
      if (t === 1) land(sim, p);
      break;
    }
  }
  return true;
}

function next(p, stage) {
  p.jumpStage = stage;
  p.jumpT = 0;
}
function startClimb(sim, p) {
  next(p, "climbing");
  p.x = sim.venue.trampoline.stairBottomX;
  sim.emit("trampoline-climb", { id: p.id });
}

function land(sim, p) {
  const tr = sim.venue.trampoline,
    landX = sim.lanes[tr.lane];
  p.x = landX;
  p.z = tr.landZ;
  p.y = 0;
  p.jumpStage = null;
  sim.jumper = null;
  // Anyone still swimming in the splash lane is in the way; the two nearest take the hit.
  const hit = sim.people
    .filter((q) => q.lane === tr.lane && ["swim", "switch"].includes(q.status))
    .sort((a, b) => distance(a, p) - distance(b, p))
    .slice(0, 2);
  if (!hit.length) {
    // Stuck the landing: a served, happy customer who swims out and heads home.
    const points = Math.round((T.success + (p.wait < 8 ? 20 : 0)) * sim.multiplier());
    sim.score += points;
    sim.stats.served++;
    sim.stats.happy++;
    sim.stats.flips = (sim.stats.flips || 0) + 1;
    sim.stats.totalHappiness += Math.max(0, p.h);
    sim.streak++;
    sim.bestStreak = Math.max(sim.bestStreak, sim.streak);
    sim.emit("trampoline-splash", { x: p.x, z: p.z });
    sim.emit("points", { x: p.x, z: p.z, value: points });
    sim.emit("served", { happy: true, id: p.id });
    sim.emit("toast", { text: `${p.name} sticks the landing! 🤸 +${points}` });
    p.lane = tr.lane;
    p.status = "exit";
    sim.beginWaterExit(p);
    p.lane = null;
    return;
  }
  // Crash: everyone stops; each victim needs a ring, then first aid on deck.
  const victims = [p, ...hit];
  for (const v of victims) {
    v.resumeLane = v.lane ?? null;
    v.problem = "injured";
    v.status = "swim";
    v.actualSpeed = 0;
    v.injuredAt = sim.time;
    v.h = Math.max(0, v.h - 20);
  }
  p.lane = null;
  for (const v of hit) {
    // The collision pulls them together at the landing point.
    v.x = clamp(
      p.x + (v.x - p.x) * 0.3 + (v === hit[0] ? 0.55 : -0.55),
      -sim.venue.pool.floatX,
      sim.venue.pool.floatX,
    );
    v.z = p.z + (v.z - p.z) * 0.3;
  }
  sim.rescue = { kind: "crash", victim: p.id, victims: victims.map((v) => v.id), stage: "stranded" };
  sim.selected = null;
  sim.score -= T.crash;
  sim.streak = 0;
  sim.stats.crashes = (sim.stats.crashes || 0) + 1;
  sim.emit("crash", { x: p.x, z: p.z });
  sim.emit("points", { x: p.x, z: p.z, value: -T.crash });
  sim.emit("toast", {
    text: `💥 CRASH! ${victims.map((v) => v.name).join(" & ")} are hurt. Swim a life ring out to each one!`,
    warning: true,
  });
}

// A ringed victim reached the deck: lie down where they climbed out and wait for the medical kit.
export function injuredOnDeck(sim, p) {
  p.status = "injured";
  p.healing = false;
  p.hurtTime = 0;
  const ring = sim.lifeRings[p.rescueRingId];
  if (ring) Object.assign(ring, { state: "deck", owner: null, x: p.x + 0.9, z: p.z });
  p.rescueRecover = false;
  p.path = [restSpot(sim, p)];
}
// A patch of deck a step back from the edge, clear of other victims, to lie down on.
function restSpot(sim, p) {
  const P = sim.venue.pool,
    end = p.exitEnd || Math.sign(p.z) || 1,
    z = end * (P.endWalkZ + 0.85),
    taken = sim.people
      .filter((q) => q !== p && q.status === "injured")
      .map((q) => q.path[q.path.length - 1] || q);
  for (const k of [0, 1, -1, 2, -2, 3, -3]) {
    const spot = { x: p.x + k * 1.45, z };
    if (sim.venue.isDeck(spot.x, spot.z, sim.level, 0.55) && !taken.some((q) => distance(q, spot) < 1.35))
      return spot;
  }
  return { x: p.x, z: p.z };
}

function hurt(sim, p, dt) {
  if (p.healing) return;
  p.hurtTime += dt;
  p.h = Math.max(0, p.h - dt * T.hurtDrain);
  if (p.h === 0) {
    // Gives up and limps home: a lost customer.
    p.problem = null;
    p.status = "queue";
    sim.lose(p);
  }
}

function heal(sim, p) {
  p.healing = false;
  if (p.status !== "injured") return;
  p.problem = null;
  p.bandaged = true;
  p.h = Math.min(100, p.h + 15);
  sim.score += T.healBonus;
  sim.stats.healed = (sim.stats.healed || 0) + 1;
  sim.emit("points", { x: p.x, z: p.z, value: T.healBonus });
  sim.feedback("healed", { id: p.id, item: "medkit", to: { x: p.x, z: p.z } });
  if (p.type === "daredevil") {
    sim.emit("toast", { text: `${p.name} gives a wobbly thumbs up: "Totally worth it!" +${T.healBonus}` });
    p.status = "queue";
    sim.depart(p, true);
    const door = sim.venue.arrival;
    p.path = [
      ...sim.venue.route(p, { x: p.side * door.outsideX, z: door.doorZ }),
      ...sim.returnRoute(p.side),
    ];
  } else {
    sim.emit("toast", {
      text: `${p.name} is patched up and heads back to lane ${(p.resumeLane ?? 0) + 1}. +${T.healBonus}`,
    });
    const lane = p.resumeLane ?? sim.nearestLane(p.x);
    p.status = "queue";
    p.lane = lane;
    p.resumingWorkout = true;
    sim.walk(p, { x: sim.lanes[lane] + 0.6, z: -8.7 });
  }
  if (!sim.people.some((q) => q.status === "injured"))
    sim.emit("toast", { text: "Everyone is patched up! Put the medical kit and the life rings back." });
}

function returnMedkit(sim) {
  const c = sim.coach,
    cab = sim.venue.fixtures.medkit;
  if (c.carry !== "medkit" || !sim.canInteract()) return false;
  if (distance(c, cab) > T.reach) return sim.guideTo(cab, "Put the medical kit back in its cabinet.");
  c.carry = null;
  sim.medkit.state = "cabinet";
  sim.feedback("pickup");
  return true;
}
