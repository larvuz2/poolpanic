// 🐟 Fish Kid. A kid wanders in hugging a bucket with a huge fish. Stop him on the deck (E) before he reaches
// the edge. If he dumps it, everybody bolts out of the water and runs in panicked circles while the coach
// grabs the fish net, dives in and chases the fish (it darts away but tires). Catching it reopens the pool;
// then hand the fish back to the sobbing kid and hang the net up again.
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Tuned with a human-like chase bot (8-way input, ~0.2 s reactions): median catch ≈ 8 s after the dive,
// worst ≈ 13 s. Coach swims at 4.2; darts outpace it, stamina guarantees the chase ends.
export const FISH_TUNING = {
  kidSpeed: 2.3,
  stopReach: 2.0,
  dumpSeconds: 1.0,
  fleeRadius: 7,
  dartRadius: 2.7,
  cruise: 1.3,
  flee: 3.9,
  dart: 7.0,
  dartSeconds: 0.4,
  dartCooldown: 1.0,
  stamina: 8,
  catchReach: 0.5,
  bodyReach: 0.5,
  dangerRadius: 2.2,
};
const T = FISH_TUNING;
const KID_NAMES = ["Timmy", "Rosie", "Benji", "Lola", "Arlo", "Mina"];

export const FishKid = {
  key: "fish",
  init(sim) {
    sim.fish = null;
    sim.fishNet = { state: "wall" };
  },
  isActive: (sim) => !!sim.fish,
  canStart: (sim) => sim.fishNet.state === "wall" && sim.coach.carry !== "fishnet",
  // The pool stays closed (and the shift clock waits) until the fish is netted.
  holdsClock: (sim) => sim.fish?.stage === "loose",
  panic: (sim) => sim.fish?.stage === "loose",
  // For the shift's diary (trace.mjs): `describe` is where the incident stands, in words that change only when its stage does (a line is
  // written each time it changes, and a stage that lasts too long is said to be waiting); `detail` is what moves, for the periodic pulse.
  describe(sim) {
    const f = sim.fish;
    if (!f) return "";
    return (
      "stage " +
      f.stage +
      " · kid " +
      (sim.visitor(f.kid)?.status ?? "gone") +
      " · net " +
      sim.fishNet.state +
      (sim.closed ? " · pool closed" : "")
    );
  },
  detail(sim) {
    const f = sim.fish;
    return f && { stamina: f.stamina, fish: f, kid: sim.visitor(f.kid) };
  },
  start(sim) {
    const spot = sim.pickEdgeSpot(sim.coach);
    const kid = sim.spawnVisitor("kid", {
      systemKey: "fish",
      name: KID_NAMES[Math.floor(sim.chaosRandom() * KID_NAMES.length)],
      spot,
      hasFish: true,
      dodged: false,
    });
    kid.path.push(...sim.venue.route(kid.path[0], spot));
    sim.fish = {
      stage: "approach",
      kid: kid.id,
      x: 0,
      z: 0,
      vx: 0,
      vz: 0,
      wander: 0,
      stamina: T.stamina,
      burst: 0,
      burstCooldown: 0,
      leap: 0,
      elapsed: 0,
    };
    sim.emit("chaos", { kind: "fish" });
    sim.incident("fish", kid, { id: kid.id, name: kid.name });
    sim.emit("toast", {
      text: `🐟 ${kid.name} is sneaking a FISH toward the pool! Stop him before he reaches the edge (E).`,
      warning: true,
    });
  },
  update(sim, dt) {
    const f = sim.fish;
    if (!f) return;
    const kid = sim.visitor(f.kid);
    if (kid) updateKid(sim, kid, f, dt);
    if (f.stage === "loose") swimFish(sim, f, dt);
    // Once the fish is netted (even if it was already handed back), the pool the fish closed reopens.
    if (f.closedPool && ["netted", "done"].includes(f.stage)) {
      f.settle = Math.max(0, (f.settle ?? 1.2) - dt);
      if (f.settle === 0 && !sim.people.some((p) => p.status === "fleeing" && p.fleePhase !== "run")) {
        f.closedPool = false;
        const returned = f.stage === "done";
        if (!returned) f.stage = "returning";
        if (sim.closed && !sim.cleanup) sim.reopenPool();
        sim.emit("toast", {
          text: returned
            ? "Fish secured! Everybody back in."
            : "Fish secured! Everybody back in. Now return it to " + (kid?.name || "the kid") + ".",
        });
      }
    }
    // The incident is over once the kid has left, the pool is open again and the net is back on its hooks.
    if (["prevented", "done"].includes(f.stage) && !f.closedPool && !kid && sim.fishNet.state === "wall")
      sim.fish = null;
  },
  interactions(sim, options) {
    const c = sim.coach,
      f = sim.fish,
      hook = sim.venue.fixtures.fishNet,
      hookPoint = { x: hook.x + Math.sin(hook.angle) * 0.9, z: hook.z + Math.cos(hook.angle) * 0.9 };
    const kid = f && sim.visitor(f.kid);
    if (
      kid &&
      ["entering", "walking", "waiting", "dumping"].includes(kid.status) &&
      distance(c, kid) < T.stopReach
    )
      options.push({
        kind: "stop-kid",
        label: "Stop " + kid.name + "! No fish in the pool",
        x: kid.x,
        z: kid.z,
        rank: -300 + distance(c, kid),
        run: () => stopKid(sim, kid),
      });
    if (
      kid &&
      kid.status === "crying" &&
      c.carry === "fishnet" &&
      c.netLoaded &&
      distance(c, kid) < T.stopReach
    )
      options.push({
        kind: "return-fish",
        label: "Give the fish back to " + kid.name,
        x: kid.x,
        z: kid.z,
        rank: -290 + distance(c, kid),
        run: () => returnFish(sim, kid),
      });
    if (distance(c, hookPoint) < 1.8) {
      if (!c.carry && sim.fishNet.state === "wall" && ["loose", "netted"].includes(f?.stage))
        options.push({
          kind: "fishnet",
          label: "Grab the fish net",
          ...hookPoint,
          rank: -280 + distance(c, hookPoint),
          run: () => grabNet(sim),
        });
      if (c.carry === "fishnet" && !c.netLoaded)
        options.push({
          kind: "hang-fishnet",
          label: "Hang up the fish net",
          ...hookPoint,
          rank: -280 + distance(c, hookPoint),
          run: () => hangNet(sim),
        });
    }
  },
  returnItem(sim) {
    if (sim.coach.carry !== "fishnet") return undefined;
    return hangNet(sim);
  },
  waterMission: (sim) =>
    sim.coach.carry === "fishnet" && !sim.coach.netLoaded && sim.fish?.stage === "loose" ? "fish" : null,
  onSwimStep(sim) {
    const c = sim.coach,
      f = sim.fish;
    if (f?.stage !== "loose" || c.carry !== "fishnet" || c.netLoaded) return;
    const head = { x: c.x + Math.sin(c.angle) * 0.75, z: c.z + Math.cos(c.angle) * 0.75 };
    if (distance(head, f) < T.catchReach || distance(c, f) < T.bodyReach) {
      f.stage = "netted";
      f.settle = 1.2;
      c.netLoaded = true;
      sim.score += 75;
      sim.stats.fishCaught = (sim.stats.fishCaught || 0) + 1;
      sim.emit("points", { x: f.x, z: f.z, value: 75 });
      sim.feedback("fish-caught", { x: f.x, z: f.z });
      sim.save("fish-caught", f, 75);
      sim.emit("toast", { text: "GOT IT! 🐟 +75 · Swim to an edge and climb out with the net." });
    }
  },
  // Loud alert: the kid before the edge, then the net and the fish, then handing the fish back.
  alert(sim, alerts) {
    const f = sim.fish,
      c = sim.coach;
    if (!f) return;
    const kid = sim.visitor(f.kid);
    if (f.stage === "approach" && kid)
      alerts.push({
        kind: "fish",
        icon: "🪣",
        label: kid.name,
        x: kid.x,
        z: kid.z,
        y: 1.9,
        urgency: 90,
        id: kid.id,
      });
    else if (f.stage === "loose") {
      const net = sim.venue.fixtures.fishNet;
      alerts.push(
        c.carry === "fishnet"
          ? { kind: "fish-loose", icon: "🐟", label: "Fish", x: f.x, z: f.z, y: 0.5, urgency: 70 }
          : { kind: "fish-loose", icon: "🥅", label: "Fish net", x: net.x, z: net.z, y: 1.8, urgency: 70 },
      );
    } else if (kid && (f.stage === "netted" || (c.carry === "fishnet" && c.netLoaded)))
      alerts.push({
        kind: "fish-return",
        icon: "🐟",
        label: kid.name,
        x: kid.x,
        z: kid.z,
        y: 1.9,
        urgency: 25,
        id: kid.id,
      });
  },
  hint(sim) {
    const f = sim.fish,
      c = sim.coach;
    if (!f) return c.carry === "fishnet" ? "Hang the fish net back on its hooks · E" : "";
    const kid = sim.visitor(f.kid);
    if (f.stage === "approach") return "🐟 Stop " + (kid?.name || "the kid") + " at the edge · E";
    if (f.stage === "loose") {
      if (c.swimming) return "Chase the fish · net it on contact";
      if (c.carry === "fishnet") return "Pool edge · dive in with the net";
      return "Grab the fish net · E";
    }
    if (f.stage === "netted" || (c.carry === "fishnet" && c.netLoaded))
      return c.swimming
        ? "Swim to an edge to climb out"
        : "Give the fish back to " + (kid?.name || "the kid") + " · E";
    if (c.carry === "fishnet") return "Hang up the fish net · E";
    return "";
  },
  panel(sim) {
    const f = sim.fish,
      c = sim.coach;
    if (!f || ["prevented"].includes(f.stage)) return null;
    const kid = sim.visitor(f.kid);
    if (f.stage === "approach")
      return {
        icon: "🐟",
        title: "FISH INCOMING!",
        task: "Stop " + (kid?.name || "the kid") + " with the bucket before the edge · E",
        // How much of the walk to the edge is left.
        timer: kid && kid.status !== "dumping" ? clamp(pathLength(kid) / (kid.routeLength || 1), 0, 1) : 0,
      };
    const step =
      f.stage === "loose"
        ? c.carry === "fishnet"
          ? 1
          : 0
        : f.stage === "netted"
          ? 2
          : c.carry === "fishnet" && c.netLoaded
            ? 2
            : 3;
    return {
      icon: "🐟",
      title:
        f.stage === "loose" ? "FISH IN THE POOL!" : f.stage === "netted" ? "GOT IT!" : "RETURN & TIDY UP",
      task: FishKid.hint(sim),
      steps: ["NET", "CATCH", "RETURN", "HANG"].map((label, i) => ({
        label: i + 1 + " · " + label,
        active: i === step,
        done: i < step,
      })),
    };
  },
  tag(sim, v) {
    const f = sim.fish;
    if (!f || v.kind !== "kid") return null;
    const total = v.routeLength || 1,
      left = pathLength(v);
    if (["entering", "walking", "waiting", "dumping"].includes(v.status))
      return { icon: "🪣🐟", label: v.name, meter: clamp(1 - left / total, 0, 1), urgent: true };
    if (v.status === "crying") return { icon: "😭", label: v.name };
    if (v.status === "happy") return { icon: "🥳", label: v.name };
    if (v.status === "sulking") return { icon: "😤", label: v.name };
    return null;
  },
};

function pathLength(v) {
  let total = 0,
    prev = v;
  for (const p of v.path || []) {
    total += distance(prev, p);
    prev = p;
  }
  return total;
}

function updateKid(sim, kid, f, dt) {
  if (kid.status === "entering" || kid.status === "walking") {
    if (kid.status === "entering" && kid.hold <= 0) {
      kid.status = "walking";
      kid.routeLength = pathLength(kid);
    }
    // One cheeky sidestep when the coach closes in.
    if (kid.status === "walking" && !kid.dodged && distance(sim.coach, kid) < 2.5 && pathLength(kid) > 2.5) {
      const heading = kid.path[0] ? Math.atan2(kid.path[0].x - kid.x, kid.path[0].z - kid.z) : kid.angle;
      const away =
        Math.sign((sim.coach.x - kid.x) * Math.cos(heading) - (sim.coach.z - kid.z) * Math.sin(heading)) || 1;
      const side = { x: kid.x - Math.cos(heading) * 1.3 * away, z: kid.z + Math.sin(heading) * 1.3 * away };
      if (sim.venue.isDeck(side.x, side.z, sim.level, 0.35) && !inPoolZone(sim, side)) {
        kid.dodged = true;
        kid.dodge = { from: { x: kid.x, z: kid.z }, to: side, t: 0 };
        kid.status = "dodging";
        sim.emit("kid-dodge", { x: kid.x, z: kid.z });
      }
    }
    if (kid.status !== "dodging" && sim.walkVisitor(kid, dt, T.kidSpeed)) {
      kid.status = sim.closed || sim.rescue ? "waiting" : "dumping";
      kid.dumpTime = T.dumpSeconds;
      kid.angle = kid.spot.axis === "x" ? (kid.spot.face > 0 ? Math.PI / 2 : -Math.PI / 2) : Math.PI;
    }
  } else if (kid.status === "dodging") {
    kid.dodge.t = Math.min(1, kid.dodge.t + dt / 0.3);
    kid.x = kid.dodge.from.x + (kid.dodge.to.x - kid.dodge.from.x) * kid.dodge.t;
    kid.z = kid.dodge.from.z + (kid.dodge.to.z - kid.dodge.from.z) * kid.dodge.t;
    if (kid.dodge.t === 1) {
      kid.status = "walking";
      kid.path = sim.venue.route(kid, kid.spot);
    }
  } else if (kid.status === "waiting") {
    if (!sim.closed && !sim.rescue) {
      kid.status = "dumping";
      kid.dumpTime = T.dumpSeconds;
    }
  } else if (kid.status === "dumping") {
    // Never tip the fish in while the pool is closed or a rescue is under way.
    if (sim.closed || sim.rescue) kid.status = "waiting";
    else {
      kid.dumpTime -= dt;
      if (kid.dumpTime <= 0) dumpFish(sim, kid, f);
    }
  } else if (["sulking", "happy", "leaving"].includes(kid.status)) {
    sim.walkVisitor(kid, dt, kid.status === "happy" ? 3.2 : 2.2);
  }
}

function inPoolZone(sim, p) {
  const P = sim.venue.pool;
  return Math.abs(p.x) < P.keepOutX && Math.abs(p.z) < P.keepOutZ;
}

function stopKid(sim, kid) {
  const f = sim.fish;
  sim.sendVisitorHome(kid, "sulking");
  f.stage = "prevented";
  sim.score += 100;
  sim.stats.prevented++;
  sim.emit("points", { x: kid.x, z: kid.z, value: 100 });
  sim.feedback("prevented", { x: kid.x, z: kid.z });
  sim.save("fish-stopped", kid, 100, { name: kid.name });
  sim.emit("toast", { text: `Nice save! ${kid.name}'s fish goes home in its bucket. +100` });
  return true;
}

function dumpFish(sim, kid, f) {
  const P = sim.venue.pool;
  kid.status = "crying";
  kid.hasFish = false;
  kid.path = [];
  f.stage = "loose";
  f.x = clamp(kid.x + (kid.spot.axis === "x" ? kid.spot.face * 1.6 : 0), -P.floatX, P.floatX);
  f.z = clamp(kid.z + (kid.spot.axis === "z" ? kid.spot.face * 1.6 : 0), -P.floatZ, P.floatZ);
  f.wander = Math.atan2(-f.x, -f.z);
  f.vx = f.vz = 0;
  f.closedPool = true;
  sim.closed = 1;
  sim.selected = null;
  sim.score -= 200;
  sim.streak = 0;
  sim.stats.fishDumped = (sim.stats.fishDumped || 0) + 1;
  for (const p of sim.people) if (["swim", "enter", "switch"].includes(p.status)) sim.startFleeing(p);
  sim.emit("fish-dumped", { x: f.x, z: f.z });
  sim.incident("fish-loose", f, { name: kid.name });
  sim.emit("points", { x: kid.x, z: kid.z, value: -200 });
  sim.emit("toast", {
    text: "🐟 FISH IN THE POOL! Everybody out! Grab the fish net and dive in after it.",
    warning: true,
  });
}

// Pick the escape heading that gains the most distance from the coach while keeping open water ahead, so the
// fish slides along walls and jukes out of corners instead of pinning itself.
function headingScore(sim, f, c, dx, dz, look) {
  const P = sim.venue.pool,
    soon = { x: c.x + (c.vx || 0) * 0.35, z: c.z + (c.vz || 0) * 0.35 };
  // Closest approach to the coach (now and a moment from now) along the escape path.
  let danger = Infinity;
  for (const t of [0.25, 0.5, 0.75, 1]) {
    const px = f.x + dx * look * t,
      pz = f.z + dz * look * t;
    danger = Math.min(danger, Math.hypot(px - c.x, pz - c.z), Math.hypot(px - soon.x, pz - soon.z));
  }
  const px = f.x + dx * look,
    pz = f.z + dz * look;
  const clear = Math.min(P.floatX - Math.abs(px), P.floatZ - Math.abs(pz));
  return (
    Math.hypot(px - soon.x, pz - soon.z) * 0.6 +
    Math.min(clear, 2) -
    Math.max(0, T.dangerRadius - danger) * 8 -
    (clear < 0 ? 5 - clear * 2 : 0)
  );
}
// Choose the escape heading; the current heading gets a commitment bonus so the fish doesn't dither.
function escapeHeading(sim, f, c, look, current = null) {
  let best = current
    ? { ...current, score: headingScore(sim, f, c, current.x, current.z, look) + 0.9 }
    : null;
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2,
      dx = Math.sin(a),
      dz = Math.cos(a),
      score = headingScore(sim, f, c, dx, dz, look);
    if (!best || score > best.score) best = { x: dx, z: dz, score };
  }
  return best;
}

// Wander calmly; flee from a swimming coach, darting (juking) when close. Darts spend stamina.
function swimFish(sim, f, dt) {
  const c = sim.coach,
    P = sim.venue.pool;
  f.elapsed += dt;
  f.burst = Math.max(0, f.burst - dt);
  f.burstCooldown = Math.max(0, f.burstCooldown - dt);
  f.leap = Math.max(0, f.leap - dt);
  f.replan = (f.replan || 0) - dt;
  const threat = c.swimming ? distance(c, f) : Infinity;
  const tired = f.stamina <= 0 || f.elapsed > 45 ? 0.72 : 1;
  let dx, dz, speed, turn;
  if (threat < T.fleeRadius) {
    if (threat < T.dartRadius && f.burstCooldown === 0 && f.stamina > 0) {
      f.flee = escapeHeading(sim, f, c, 2.6);
      f.burst = T.dartSeconds;
      f.burstCooldown = T.dartCooldown;
      f.replan = T.dartSeconds + 0.25;
      f.stamina--;
      if (sim.chaosRandom() < 0.4) f.leap = 0.55;
      sim.emit("fish-dart", { x: f.x, z: f.z });
    } else if (f.replan <= 0 || !f.flee) {
      f.flee = escapeHeading(sim, f, c, 1.8, f.flee);
      f.replan = 0.2;
    }
    dx = f.flee.x;
    dz = f.flee.z;
    speed = f.burst > 0 ? T.dart : T.flee * tired;
    turn = f.burst > 0 ? 18 : 10;
  } else {
    f.flee = null;
    f.wander += (sim.chaosRandom() - 0.5) * dt * 3;
    dx = Math.sin(f.wander);
    dz = Math.cos(f.wander);
    const margin = 1.1,
      gapX = P.floatX - Math.abs(f.x),
      gapZ = P.floatZ - Math.abs(f.z);
    if (gapX < margin) dx -= Math.sign(f.x) * (1 - gapX / margin) * 1.2;
    if (gapZ < margin) dz -= Math.sign(f.z) * (1 - gapZ / margin) * 1.2;
    speed = T.cruise;
    turn = 2;
  }
  const n = Math.hypot(dx, dz) || 1;
  const k = Math.min(1, dt * turn);
  f.vx += ((dx / n) * speed - f.vx) * k;
  f.vz += ((dz / n) * speed - f.vz) * k;
  f.x += f.vx * dt;
  f.z += f.vz * dt;
  if (Math.abs(f.x) > P.floatX) {
    f.x = Math.sign(f.x) * P.floatX;
    f.vx = 0;
    f.wander = Math.atan2(-f.x, f.vz || 1);
  }
  if (Math.abs(f.z) > P.floatZ) {
    f.z = Math.sign(f.z) * P.floatZ;
    f.vz = 0;
    f.wander = Math.atan2(f.vx || 1, -f.z);
  }
  if (Math.hypot(f.vx, f.vz) > 0.05) f.heading = Math.atan2(f.vx, f.vz);
}

function grabNet(sim) {
  const c = sim.coach;
  if (c.carry) return false;
  c.carry = "fishnet";
  c.netLoaded = false;
  c.rescueEntryArmed = true;
  sim.fishNet.state = "coach";
  sim.feedback("pickup");
  sim.emit("toast", { text: "Net in hand! Walk to the pool edge to dive in." });
  return true;
}

function hangNet(sim) {
  const c = sim.coach,
    hook = sim.venue.fixtures.fishNet,
    point = { x: hook.x + Math.sin(hook.angle) * 0.9, z: hook.z + Math.cos(hook.angle) * 0.9 };
  if (c.carry !== "fishnet" || !sim.canInteract()) return false;
  if (c.netLoaded)
    return sim.guideTo(sim.visitor(sim.fish?.kid) || point, "Give the fish back to the kid first.");
  if (distance(c, point) > 1.8) return sim.guideTo(point, "Hang the fish net back on its hooks.");
  c.carry = null;
  sim.fishNet.state = "wall";
  sim.feedback("pickup");
  return true;
}

function returnFish(sim, kid) {
  const c = sim.coach;
  c.netLoaded = false;
  kid.hasFish = true;
  sim.sendVisitorHome(kid, "happy");
  if (sim.fish) sim.fish.stage = "done";
  sim.score += 50;
  sim.emit("points", { x: kid.x, z: kid.z, value: 50 });
  sim.save("fish-returned", kid, 50, { name: kid.name });
  sim.feedback("handoff", { item: "fish", to: { x: kid.x, z: kid.z } });
  sim.emit("toast", { text: `${kid.name} is thrilled! 🐟 +50 · Hang the net back up.` });
  return true;
}
