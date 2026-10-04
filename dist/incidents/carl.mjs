// 💣 Cannonball Carl. A big guy barrels onto the deck yelling CANNONBALL and heads for the edge. Red-card him
// (E) before his first jump and he sheepishly joins the queue as a normal customer. Miss him and the splash
// sends a wave across the pool: nearby swimmers stall, some lose goggles onto the deck, and the edge floods
// with slippery puddles. He climbs out and runs to another spot to go again, until you catch him on deck.
// The cannonball man is Carl or the leopard man, one of them for a whole level (`cannonballMan`): the levels take turns, Carl
// on the even ones. While he is in the water (from the splash until he is out on the deck again) the crowd panics: the swimmers
// in the pool stop where they are, and the swimmers and everyone waiting on the deck hop with their hands up.
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const CARL_TUNING = {
  walk: 3.4,
  run: 5.4,
  windup: 0.9,
  charge: 0.45,
  flight: 0.8,
  float: 1.4,
  swim: 2.8,
  climb: 0.6,
  waveRadius: 6.2,
  gogglesChance: 0.3,
  reach: 1.9,
  penalty: 60,
};
const T = CARL_TUNING;
// The leopard man's name is a placeholder.
export const CANNONBALL_MEN = {
  carl: { id: "carl", name: "Carl" },
  leopard: { id: "leopard", name: "Leopard Man" },
};
// The level's own `cannonball` ("carl" or "leopard") when its config has one (a drill or a booking can), else by the level: the
// even levels have Carl, who comes first (his level is 6), and the odd ones the leopard man.
export const cannonballMan = (config, level) =>
  CANNONBALL_MEN[config?.cannonball] || (level % 2 === 0 ? CANNONBALL_MEN.carl : CANNONBALL_MEN.leopard);
const CATCHABLE = ["walking", "windup", "charge", "running", "waiting"];

export const CannonballCarl = {
  key: "carl",
  init(sim) {
    sim.carl = null;
  },
  isActive: (sim) => !!sim.carl,
  panic: (sim) => !!sim.carl && sim.carl.cannonballs > 0 && sim.carl.stage !== "done",
  // Whether the whole crowd is panicking: swimmers in the pool stop and everyone idle hops (see ChaosController.crowdPanic).
  crowdPanic: (sim) => !!sim.carl?.inWater,
  // For the shift's diary (trace.mjs): `describe` is where the incident stands, in words that change only when its stage does (a line is
  // written each time it changes, and a stage that lasts too long is said to be waiting); `detail` is what moves, for the periodic pulse.
  describe(sim) {
    const k = sim.carl;
    if (!k) return "";
    return (
      "stage " +
      k.stage +
      " · " +
      (sim.visitor(k.id)?.status ?? "gone") +
      (k.inWater ? " · in the water" : "") +
      " · cannonballs " +
      k.cannonballs
    );
  },
  detail(sim) {
    const k = sim.carl;
    return k && { at: sim.visitor(k.id) };
  },
  start(sim) {
    const man = cannonballMan(sim.config, sim.level);
    const spot = pickLaunchSpot(sim, null);
    const v = sim.spawnVisitor("carl", {
      systemKey: "carl",
      name: man.name,
      figure: man.id,
      spot,
      hold: 0.3,
    });
    v.path.push(...sim.venue.route(v.path[0], spot));
    sim.carl = {
      stage: "approach",
      id: v.id,
      cannonballs: 0,
      figure: man.id,
      name: man.name,
      inWater: false,
    };
    sim.emit("chaos", { kind: "carl" });
    sim.incident("carl", v, { id: v.id, name: man.name });
    sim.emit("toast", {
      text: `💣 ${man.name} is yelling CANNONBALL! Red-card him (E) before he reaches the edge.`,
      warning: true,
    });
  },
  update(sim, dt) {
    const k = sim.carl;
    if (!k) return;
    const v = sim.visitor(k.id);
    if (!v) {
      sim.carl = null;
      return;
    }
    v.timer = Math.max(0, (v.timer || 0) - dt);
    switch (v.status) {
      case "entering":
        if (v.hold <= 0) v.status = "walking";
        sim.walkVisitor(v, dt, T.walk);
        return;
      case "walking":
      case "running":
        if (sim.walkVisitor(v, dt, v.status === "running" ? T.run : T.walk)) beginWindup(sim, v);
        return;
      case "waiting":
        if (!sim.closed && !sim.rescue) beginWindup(sim, v);
        return;
      case "windup": {
        const t = 1 - v.timer / T.windup;
        v.x = v.edge.x + v.back.x * t;
        v.z = v.edge.z + v.back.z * t;
        if (v.timer === 0) {
          v.status = "charge";
          v.timer = T.charge;
          v.from = { x: v.x, z: v.z };
          sim.emit("carl-charge", { x: v.x, z: v.z });
        }
        return;
      }
      case "charge": {
        const t = 1 - v.timer / T.charge;
        v.x = v.from.x + (v.edge.x - v.from.x) * t;
        v.z = v.from.z + (v.edge.z - v.from.z) * t;
        if (v.timer === 0) {
          v.status = "flying";
          v.timer = T.flight;
          v.from = { x: v.x, z: v.z };
          v.impact = intoWater(sim, v.spot, 1.9);
          sim.emit("carl-jump", { x: v.x, z: v.z });
        }
        return;
      }
      case "flying": {
        const t = 1 - v.timer / T.flight;
        v.x = v.from.x + (v.impact.x - v.from.x) * t;
        v.z = v.from.z + (v.impact.z - v.from.z) * t;
        if (v.timer === 0) cannonball(sim, k, v);
        return;
      }
      case "floating":
        if (v.timer === 0) {
          const P = sim.venue.pool,
            s = Math.sign(v.spot.x) || 1;
          v.status = "swimming";
          v.swimTo = { x: s * (P.halfX - 0.35), z: v.z };
          v.deck = { x: s * (P.solidX + 0.6), z: v.z };
        }
        return;
      case "swimming": {
        const step = T.swim * dt,
          d = distance(v, v.swimTo);
        v.angle = Math.atan2(v.swimTo.x - v.x, v.swimTo.z - v.z);
        if (d <= step) {
          v.status = "climbing";
          v.timer = T.climb;
          v.from = { x: v.x, z: v.z };
        } else {
          v.x += ((v.swimTo.x - v.x) / d) * step;
          v.z += ((v.swimTo.z - v.z) / d) * step;
        }
        return;
      }
      case "climbing": {
        const t = 1 - v.timer / T.climb;
        v.x = v.from.x + (v.deck.x - v.from.x) * t;
        v.z = v.from.z + (v.deck.z - v.from.z) * t;
        if (v.timer === 0) {
          k.inWater = false; // out on the deck: the crowd stops panicking
          v.spot = pickLaunchSpot(sim, v);
          v.status = "running";
          v.path = sim.venue.route(v, v.spot);
        }
        return;
      }
      case "carded":
      case "leaving":
        sim.walkVisitor(v, dt, 3);
        return;
      case "joining":
        return;
    }
  },
  interactions(sim, options) {
    const k = sim.carl,
      c = sim.coach;
    if (!k) return;
    const v = sim.visitor(k.id);
    if (!v || !CATCHABLE.includes(v.status) || distance(c, v) > T.reach) return;
    options.push({
      kind: "red-card",
      label: k.cannonballs ? `🟥 Red card! ${k.name} is benched` : "🟥 Red card! No cannonballs",
      x: v.x,
      z: v.z,
      rank: -310 + distance(c, v),
      run: () => redCard(sim, k, v),
    });
  },
  // Loud alert: Carl himself, until he is red-carded (a little calmer once the first cannonball is done).
  alert(sim, alerts) {
    const k = sim.carl,
      v = k && k.stage !== "done" && sim.visitor(k.id);
    if (!v || ["carded", "leaving", "joining"].includes(v.status)) return;
    alerts.push({
      kind: "carl",
      icon: "🟥",
      label: k.name,
      x: v.x,
      z: v.z,
      y: 2.1,
      urgency: k.cannonballs ? 78 : 88,
      id: v.id,
    });
  },
  hint(sim) {
    const k = sim.carl;
    if (!k || k.stage === "done") return "";
    const v = sim.visitor(k.id);
    if (!v || !["entering", ...CATCHABLE, "flying", "floating", "swimming", "climbing"].includes(v.status))
      return "";
    if (["flying", "floating", "swimming", "climbing"].includes(v.status))
      return `Catch ${k.name} when he climbs out · E`;
    return k.cannonballs ? `💣 Catch ${k.name} on the deck · E` : `💣 Red-card ${k.name} before the edge · E`;
  },
  panel(sim) {
    const k = sim.carl;
    if (!k || k.stage === "done") return null;
    const v = sim.visitor(k.id);
    if (!v || ["carded", "leaving", "joining"].includes(v.status)) return null;
    return {
      icon: "💣",
      title: k.cannonballs ? `CANNONBALL ${k.name.toUpperCase()} ×${k.cannonballs}` : "CANNONBALL INCOMING!",
      task: CannonballCarl.hint(sim),
      // Before the first cannonball: how much of his run to the edge is left.
      timer: k.cannonballs
        ? null
        : ["flying", "floating", "swimming", "climbing"].includes(v.status)
          ? 0
          : 1 - approachMeter(v),
    };
  },
  tag(sim, v) {
    const k = sim.carl;
    if (!k || v.kind !== "carl") return null;
    if (["carded", "leaving"].includes(v.status)) return { icon: "🟥😤", label: k.name };
    if (v.status === "windup" || v.status === "charge") return { icon: "💣‼️", label: k.name, urgent: true };
    if (["flying", "floating", "swimming", "climbing"].includes(v.status))
      return { icon: "💦😂", label: k.name };
    return { icon: "💣", label: k.name, urgent: true, meter: approachMeter(v) };
  },
};

function approachMeter(v) {
  let left = 0,
    prev = v;
  for (const p of v.path || []) {
    left += distance(prev, p);
    prev = p;
  }
  return clamp(1 - left / 14, 0, 1);
}

function pickLaunchSpot(sim, v) {
  const spots = sim.venue
    .edgeSpots()
    .filter((s) => s.axis === "x" && Math.abs(s.z) <= 5 && (!v || distance(s, v) > 3));
  return spots[Math.floor(sim.chaosRandom() * spots.length)] || sim.venue.edgeSpots()[0];
}
function intoWater(sim, spot, depth) {
  const P = sim.venue.pool;
  return { x: clamp(spot.x + spot.face * (P.solidX - P.halfX + depth), -P.floatX, P.floatX), z: spot.z };
}
function beginWindup(sim, v) {
  if (sim.closed || sim.rescue) {
    v.status = "waiting";
    return;
  }
  v.status = "windup";
  v.timer = T.windup;
  v.edge = { x: v.spot.x, z: v.spot.z };
  v.back = { x: -v.spot.face * 1.3, z: 0 };
  v.angle = v.spot.face > 0 ? Math.PI / 2 : -Math.PI / 2;
  sim.emit("carl-windup", { x: v.x, z: v.z });
}

function cannonball(sim, k, v) {
  const P = sim.venue.pool;
  k.cannonballs++;
  k.stage = "loose";
  k.inWater = true; // until he climbs out: the swimmers stop and panic, and so does everyone waiting on the deck
  v.status = "floating";
  v.timer = T.float;
  sim.score -= T.penalty;
  sim.streak = 0;
  sim.stats.cannonballs = (sim.stats.cannonballs || 0) + 1;
  sim.emit("cannonball", { x: v.x, z: v.z });
  sim.emit("points", { x: v.x, z: v.z, value: -T.penalty });
  let lost = 0;
  for (const p of sim.people) {
    if (p.status !== "swim" || distance(p, v) > T.waveRadius) continue;
    p.collisionTime = Math.max(p.collisionTime || 0, 1.3);
    p.annoyedTime = 0.9;
    p.h = Math.max(0, p.h - 8);
    if (sim.level > 1 && !p.problem && !p.stomachWarning && lost < 2 && sim.chaosRandom() < T.gogglesChance) {
      lost++;
      p.problem = "goggles";
      const side = Math.sign(v.x) || 1;
      let spot = {
        x: side * (P.solidX + 1 + sim.chaosRandom() * 1.6),
        z: clamp(v.z + (sim.chaosRandom() - 0.5) * 5, -P.turnZ, P.turnZ),
      };
      if (!sim.isDeck(spot.x, spot.z)) spot = { x: side * (P.corridorX + 0.2), z: v.z };
      sim.clutter.push({ id: ++sim.uid, type: "goggles", owner: p.id, ...spot });
      sim.emit("drop", spot);
    }
  }
  const side = Math.sign(v.x) || 1;
  for (let i = 0; i < 4; i++)
    sim.addPuddle(
      side * (P.solidX + 0.8 + (i % 2) * 0.9),
      v.z + (i - 1.5) * 1.5 + (sim.chaosRandom() - 0.5),
      0.8 + sim.chaosRandom() * 0.4,
      18,
    );
  sim.emit("toast", {
    text:
      "CANNONBALL! 💦 −" +
      T.penalty +
      (lost ? ` · ${lost} lost goggles on the deck` : "") +
      " · Watch the puddles!",
    warning: true,
  });
}

function redCard(sim, k, v) {
  sim.feedback("red-card", { x: v.x, z: v.z });
  if (!k.cannonballs) {
    // Prevented: Carl sulks into the queue like everybody else.
    sim.score += 100;
    sim.stats.prevented++;
    sim.emit("points", { x: v.x, z: v.z, value: 100 });
    sim.save("red-card", v, 100, { name: k.name });
    sim.emit("toast", { text: `Red card! ${k.name} sheepishly joins the queue. +100` });
    // Draw Carl's customer traits from the chaos stream so later arrivals match a chaos-free shift.
    sim.random = () => sim.chaosRandom();
    const p = sim.spawn({ type: "intermediate", sick: false });
    delete sim.random;
    const slot = { x: p.x, z: p.z };
    Object.assign(p, {
      name: k.name,
      carl: true,
      figure: k.figure,
      needsFins: false,
      midFins: false,
      crampAt: Infinity,
      x: v.x,
      z: v.z,
      status: "arriving",
      arrivalHold: 0,
      queueTarget: slot,
      path: sim.venue.route(v, slot),
    });
    v.status = "joining";
    sim.visitors = sim.visitors.filter((a) => a !== v);
    k.stage = "done";
    sim.carl = null;
  } else {
    sim.score += 150;
    sim.emit("points", { x: v.x, z: v.z, value: 150 });
    sim.save("red-card", v, 150, { name: k.name });
    sim.emit("toast", { text: `Red card! ${k.name} is benched for the day. +150` });
    sim.sendVisitorHome(v, "carded");
    k.stage = "done";
  }
  return true;
}
