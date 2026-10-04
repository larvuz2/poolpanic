// 🐶 Loose Dog. A dog slips in through a locker door and makes mischief: it steals fins (even off the rack)
// and goggles and drops them somewhere else, bowls over waiting swimmers, belly-flops into a lane and then
// shakes itself dry into slippery puddles. You can't outrun it, but you can bribe it: grab the dog treats,
// let it follow you, and lead it out through a locker door.
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const DOG_TUNING = {
  run: 5.6,
  zoom: 7.2,
  follow: 7.4,
  notice: 7.5,
  loseInterest: 9.5,
  mischiefPause: [1.2, 2.4],
  swimSeconds: 3.4,
  swimSpeed: 2.2,
  exitReach: 2.2,
};
const T = DOG_TUNING;
const DOG_NAMES = ["Biscuit", "Noodle", "Pickles", "Waffles", "Mochi", "Pretzel"];

export const LooseDog = {
  key: "dog",
  init(sim) {
    sim.dog = null;
  },
  isActive: (sim) => !!sim.dog,
  panic: (sim) => !!sim.dog && sim.dog.stage !== "leaving",
  // For the shift's diary (trace.mjs): `describe` is where the incident stands, in words that change only when its stage does (a line is
  // written each time it changes, and a stage that lasts too long is said to be waiting); `detail` is what moves, for the periodic pulse.
  describe(sim) {
    const d = sim.dog;
    if (!d) return "";
    return (
      "stage " +
      d.stage +
      " · dog " +
      (sim.visitor(d.id)?.status ?? "gone") +
      (d.carry ? " · carrying " + (d.carry.type || "something") : "")
    );
  },
  detail(sim) {
    const d = sim.dog;
    return d && { at: sim.visitor(d.id), swims: d.swims, lost: d.lost };
  },
  start(sim) {
    const v = sim.spawnVisitor("dog", {
      systemKey: "dog",
      name: DOG_NAMES[Math.floor(sim.chaosRandom() * DOG_NAMES.length)],
      hold: 0.25,
    });
    sim.dog = { stage: "loose", id: v.id, carry: null, swims: 0, lost: 0 };
    sim.emit("chaos", { kind: "dog" });
    sim.incident("dog", v, { id: v.id, name: v.name });
    sim.emit("toast", {
      text: `🐶 ${v.name} got in! Grab the dog treats and lead them back out through a locker door.`,
      warning: true,
    });
  },
  update(sim, dt) {
    const d = sim.dog;
    if (!d) return;
    const v = sim.visitor(d.id);
    if (!v) {
      sim.dog = null;
      return;
    }
    v.timer = Math.max(0, (v.timer || 0) - dt);
    if (d.stage === "leaving") {
      sim.walkVisitor(v, dt, 4.2);
      return;
    }
    const c = sim.coach,
      lured = c.carry === "treats" && !c.swimming && !c.waterTransition;
    if (d.stage === "following") {
      follow(sim, d, v, dt, lured);
      return;
    }
    if (lured && onDeck(v) && distance(v, c) < T.notice) {
      dropCarried(sim, d, v);
      d.stage = "following";
      d.lost = 0;
      v.status = "following";
      v.path = [];
      sim.emit("dog-notice", { x: v.x, z: v.z });
      sim.emit("toast", { text: `${v.name} smells the treats! Lead them to a locker door.` });
      return;
    }
    mischief(sim, d, v, dt);
  },
  interactions(sim, options) {
    const c = sim.coach,
      jar = sim.venue.fixtures.treats;
    if (!jar || distance(c, jar) > 1.9) return;
    if (!c.carry && sim.dog && sim.dog.stage !== "leaving")
      options.push({
        kind: "treats",
        label: "Grab the dog treats",
        x: jar.x,
        z: jar.z,
        rank: -260 + distance(c, jar),
        run: () => {
          c.carry = "treats";
          sim.feedback("pickup");
          return true;
        },
      });
    // E only puts the treats back once the dog is gone; the return button still works any time.
    if (c.carry === "treats" && (!sim.dog || sim.dog.stage === "leaving"))
      options.push({
        kind: "return-treats",
        label: "Put the treats back",
        x: jar.x,
        z: jar.z,
        rank: 50 + distance(c, jar),
        run: () => returnTreats(sim),
      });
  },
  returnItem(sim) {
    if (sim.coach.carry !== "treats") return undefined;
    return returnTreats(sim);
  },
  finCount: (sim) => (sim.dog?.carry?.type === "fins" ? 1 : 0),
  // Loud alert: the treats, then the dog, then the nearest locker door once it follows.
  alert(sim, alerts) {
    const d = sim.dog,
      v = d && sim.visitor(d.id),
      c = sim.coach;
    if (!v || d.stage === "leaving") return;
    if (d.stage === "following") {
      const door = sim.venue.arrival,
        exit = [-1, 1]
          .map((side) => ({ x: side * door.outsideX, z: door.doorZ }))
          .sort((a, b) => distance(a, c) - distance(b, c))[0];
      alerts.push({ kind: "dog", icon: "🚪", label: "Locker door", ...exit, y: 2.2, urgency: 60 });
    } else if (c.carry === "treats")
      alerts.push({ kind: "dog", icon: "🐶", label: v.name, x: v.x, z: v.z, y: 1.3, urgency: 60, id: v.id });
    else {
      const jar = sim.venue.fixtures.treats;
      alerts.push({ kind: "dog", icon: "🦴", label: "Treats", x: jar.x, z: jar.z, y: 1.6, urgency: 60 });
    }
  },
  hint(sim) {
    const d = sim.dog;
    if (!d || d.stage === "leaving") return "";
    const v = sim.visitor(d.id);
    if (d.stage === "following") return `Lead ${v?.name || "the dog"} to a locker door`;
    return sim.coach.carry === "treats"
      ? `Get close to ${v?.name || "the dog"} with the treats`
      : "🐶 Grab the dog treats · E";
  },
  panel(sim) {
    const d = sim.dog;
    if (!d || d.stage === "leaving") return null;
    const v = sim.visitor(d.id),
      step = d.stage === "following" ? 2 : sim.coach.carry === "treats" ? 1 : 0;
    return {
      icon: "🐶",
      title: d.stage === "following" ? "GOOD DOG… THIS WAY!" : "DOG ON THE DECK!",
      task: LooseDog.hint(sim),
      steps: ["TREATS", "LURE " + (v?.name || "").toUpperCase(), "DOOR"].map((label, i) => ({
        label: i + 1 + " · " + label,
        active: i === step,
        done: i < step,
      })),
    };
  },
  tag(sim, v) {
    const d = sim.dog;
    if (!d || v.kind !== "dog") return null;
    const carrying = d.carry ? (d.carry.type === "fins" ? " 🦶" : " 🥽") : "";
    if (d.stage === "following") return { icon: "🐶💕", label: v.name };
    if (["swim", "leap"].includes(v.status)) return { icon: "🐶💦", label: v.name, urgent: true };
    return { icon: "🐶" + carrying, label: v.name, urgent: !!carrying };
  },
};

function onDeck(v) {
  return !["swim", "paddle", "leap", "climb", "entering"].includes(v.status);
}

function returnTreats(sim) {
  const c = sim.coach,
    jar = sim.venue.fixtures.treats;
  if (c.carry !== "treats" || !sim.canInteract()) return false;
  if (distance(c, jar) > 1.9) return sim.guideTo(jar, "Put the treats back in their jar.");
  c.carry = null;
  sim.feedback("pickup");
  return true;
}

function dropCarried(sim, d, v) {
  if (!d.carry) return;
  let { x, z } = v;
  if (!sim.venue.isDeck(x, z, sim.level, 0.2)) ({ x, z } = nearestRoamSpot(sim, v));
  sim.clutter.push({ id: ++sim.uid, type: d.carry.type, owner: d.carry.owner ?? undefined, x, z });
  sim.emit("drop", { x, z });
  d.carry = null;
}

export function roamSpots(sim) {
  const venue = sim.venue;
  if (venue._roamSpots) return venue._roamSpots;
  const spots = [],
    d = venue.deck,
    P = venue.pool;
  for (let x = d.minX + 1.2; x <= d.maxX - 1.2; x += 1.6)
    for (let z = d.minZ + 1.4; z <= d.maxZ - 1; z += 1.6) {
      if (Math.abs(x) < P.keepOutX + 0.4 && Math.abs(z) < P.keepOutZ + 0.4) continue;
      if (z < -10.6 && Math.abs(x) < 6) continue;
      if (venue.isDeck(x, z, 3, 0.75)) spots.push({ x, z });
    }
  venue._roamSpots = spots;
  return spots;
}
function nearestRoamSpot(sim, p) {
  return roamSpots(sim).reduce((best, s) => (!best || distance(s, p) < distance(best, p) ? s : best), null);
}
function randomRoamSpot(sim, v, minDistance = 4) {
  const spots = roamSpots(sim).filter((s) => distance(s, v) > minDistance);
  return spots[Math.floor(sim.chaosRandom() * spots.length)] || roamSpots(sim)[0];
}
function runTo(sim, v, target, status, speed) {
  v.status = status;
  v.speed = speed;
  v.target = { x: target.x, z: target.z };
  v.path = sim.venue.route(v, target);
}

function mischief(sim, d, v, dt) {
  switch (v.status) {
    case "entering":
      if (sim.walkVisitor(v, dt, T.run)) {
        v.status = "sniff";
        v.timer = 0.8;
      }
      return;
    case "sniff":
      if (v.timer === 0) chooseMischief(sim, d, v);
      return;
    case "zoom":
    case "carry":
      if (sim.walkVisitor(v, dt, v.speed)) {
        if (v.status === "carry") dropCarried(sim, d, v);
        rest(sim, v);
      }
      return;
    case "steal": {
      const item = v.stealId != null ? sim.clutter.find((f) => f.id === v.stealId) : null;
      if (v.stealId != null && !item) return rest(sim, v);
      if (sim.walkVisitor(v, dt, v.speed)) {
        if (item) {
          sim.clutter = sim.clutter.filter((f) => f !== item);
          d.carry = { type: item.type, owner: item.owner };
        } else if (sim.finsAvailable > 0) {
          sim.finsAvailable--;
          d.carry = { type: "fins" };
        } else return rest(sim, v);
        sim.emit("dog-steal", { x: v.x, z: v.z, item: d.carry.type });
        sim.emit("toast", {
          text: `${v.name} ran off with ${d.carry.type === "fins" ? "a pair of fins" : "someone's goggles"}!`,
          warning: true,
        });
        runTo(sim, v, randomRoamSpot(sim, v, 7), "carry", T.zoom);
      }
      return;
    }
    case "bowl": {
      const p = sim.get(v.targetId);
      if (!p || !walkerOnDeck(p)) return rest(sim, v);
      if (v.timer === 0) {
        v.path = sim.venue.route(v, p);
        v.timer = 0.3;
      }
      sim.walkVisitor(v, dt, T.zoom);
      if (distance(v, p) < 0.62) {
        if (!p.slipTime && !p.stunned) {
          p.slipTime = 0.65;
          p.stunned = 3;
          p.annoyedTime = 0.85;
          p.deckPenalty = (p.deckPenalty || 0) + 6;
          p.h = Math.max(0, p.h - 6);
          sim.emit("slip", { id: p.id, x: p.x, z: p.z });
          sim.emit("dog-bowl", { x: v.x, z: v.z });
        }
        runTo(sim, v, randomRoamSpot(sim, v, 6), "zoom", T.zoom);
      }
      return;
    }
    case "to-edge":
      if (sim.walkVisitor(v, dt, T.run)) {
        if (sim.closed || sim.rescue) return rest(sim, v);
        v.status = "leap";
        v.leapT = 0;
        v.leapFrom = { x: v.x, z: v.z };
        v.leapTo = intoWater(sim, v.spot, 1.4);
      }
      return;
    case "leap":
      v.leapT = Math.min(1, v.leapT + dt / 0.45);
      v.x = v.leapFrom.x + (v.leapTo.x - v.leapFrom.x) * v.leapT;
      v.z = v.leapFrom.z + (v.leapTo.z - v.leapFrom.z) * v.leapT;
      if (v.leapT === 1) {
        v.status = "swim";
        v.timer = T.swimSeconds;
        v.bumped = [];
        const P = sim.venue.pool;
        v.swimTo = {
          x: clamp(-v.x * 0.4, -P.floatX, P.floatX),
          z: clamp(v.z + (sim.chaosRandom() - 0.5) * 6, -P.floatZ, P.floatZ),
        };
        d.swims++;
        sim.emit("splash", { x: v.x, z: v.z });
        sim.emit("dog-splash", { x: v.x, z: v.z });
      }
      return;
    case "swim": {
      const step = T.swimSpeed * dt,
        dist = distance(v, v.swimTo);
      if (dist > step) {
        v.angle = Math.atan2(v.swimTo.x - v.x, v.swimTo.z - v.z);
        v.x += ((v.swimTo.x - v.x) / dist) * step;
        v.z += ((v.swimTo.z - v.z) / dist) * step;
      }
      for (const p of sim.people)
        if (p.status === "swim" && !v.bumped.includes(p.id) && distance(p, v) < 1.3) {
          v.bumped.push(p.id);
          p.collisionTime = Math.max(p.collisionTime || 0, 0.8);
          p.annoyedTime = 0.85;
          p.h = Math.max(0, p.h - 4);
          sim.emit("collision", { x: p.x, z: p.z, id: p.id });
        }
      if (v.timer === 0 || dist <= step) {
        const exit = nearestExit(sim, v);
        v.status = "paddle";
        v.exit = exit;
      }
      return;
    }
    case "paddle": {
      const step = T.swimSpeed * 1.2 * dt,
        dist = distance(v, v.exit.water);
      v.angle = Math.atan2(v.exit.water.x - v.x, v.exit.water.z - v.z);
      if (dist <= step) {
        v.status = "climb";
        v.leapT = 0;
        v.leapFrom = { x: v.x, z: v.z };
        v.leapTo = v.exit.deck;
      } else {
        v.x += ((v.exit.water.x - v.x) / dist) * step;
        v.z += ((v.exit.water.z - v.z) / dist) * step;
      }
      return;
    }
    case "climb":
      v.leapT = Math.min(1, v.leapT + dt / 0.4);
      v.x = v.leapFrom.x + (v.leapTo.x - v.leapFrom.x) * v.leapT;
      v.z = v.leapFrom.z + (v.leapTo.z - v.leapFrom.z) * v.leapT;
      if (v.leapT === 1) {
        v.status = "shake";
        v.timer = 1.1;
      }
      return;
    case "shake":
      if (v.timer === 0) {
        sim.addPuddle(v.x, v.z, 1.15, 15);
        for (const p of sim.people)
          if (walkerOnDeck(p) && distance(p, v) < 1.9) {
            p.annoyedTime = 0.85;
            p.h = Math.max(0, p.h - 3);
          }
        sim.emit("dog-shake", { x: v.x, z: v.z });
        rest(sim, v);
      }
      return;
    case "following":
      return;
    default:
      rest(sim, v);
  }
}

function rest(sim, v) {
  v.status = "sniff";
  v.timer = T.mischiefPause[0] + sim.chaosRandom() * (T.mischiefPause[1] - T.mischiefPause[0]);
  v.path = [];
}

function walkerOnDeck(p) {
  return (
    ["queue", "enter", "arriving"].includes(p.status) ||
    (p.status === "exit" && p.exitPhase !== "water" && p.exitPhase !== "climb")
  );
}

function chooseMischief(sim, d, v) {
  const options = [];
  const items = sim.clutter.filter((f) => ["fins", "goggles"].includes(f.type));
  if (!d.carry && items.length) options.push(["steal-item", 3]);
  if (!d.carry && sim.finsAvailable > 0) options.push(["steal-rack", 2]);
  const walkers = sim.people.filter(walkerOnDeck);
  if (walkers.length) options.push(["bowl", 3]);
  if (!sim.closed && !sim.rescue && d.swims < 3) options.push(["splash", d.swims ? 1.5 : 3]);
  options.push(["zoom", 1.2]);
  const total = options.reduce((a, [, w]) => a + w, 0);
  let roll = sim.chaosRandom() * total,
    choice = options[0][0];
  for (const [kind, weight] of options) {
    roll -= weight;
    if (roll <= 0) {
      choice = kind;
      break;
    }
  }
  if (choice === "steal-item") {
    const item = items[Math.floor(sim.chaosRandom() * items.length)];
    v.stealId = item.id;
    runTo(sim, v, item, "steal", T.run);
  } else if (choice === "steal-rack") {
    const rack = sim.venue.stations.fins,
      n = Math.hypot(rack.x, rack.z) || 1;
    v.stealId = null;
    runTo(sim, v, { x: rack.x - (rack.x / n) * 1.25, z: rack.z - (rack.z / n) * 1.25 }, "steal", T.run);
  } else if (choice === "bowl") {
    const p = walkers[Math.floor(sim.chaosRandom() * walkers.length)];
    v.targetId = p.id;
    v.timer = 0;
    runTo(sim, v, p, "bowl", T.zoom);
  } else if (choice === "splash") {
    v.spot = sim.pickEdgeSpot();
    runTo(sim, v, v.spot, "to-edge", T.run);
  } else runTo(sim, v, randomRoamSpot(sim, v, 6), "zoom", T.zoom);
}

function intoWater(sim, spot, depth) {
  const P = sim.venue.pool;
  return spot.axis === "x"
    ? { x: clamp(spot.x + spot.face * (P.solidX - P.halfX + depth), -P.floatX, P.floatX), z: spot.z }
    : { x: spot.x, z: clamp(spot.z + spot.face * (P.solidZ - P.halfZ + depth), -P.floatZ, P.floatZ) };
}
function nearestExit(sim, v) {
  const P = sim.venue.pool;
  const side = P.halfX - Math.abs(v.x) < P.halfZ - Math.abs(v.z);
  if (side) {
    const s = Math.sign(v.x) || 1;
    return { water: { x: s * (P.halfX - 0.3), z: v.z }, deck: { x: s * (P.solidX + 0.55), z: v.z } };
  }
  const s = Math.sign(v.z) || 1;
  return { water: { x: v.x, z: s * (P.halfZ - 0.3) }, deck: { x: v.x, z: s * (P.solidZ + 0.6) } };
}

function follow(sim, d, v, dt, lured) {
  const c = sim.coach;
  if (!lured) {
    d.stage = "loose";
    rest(sim, v);
    return;
  }
  const gap = distance(v, c);
  d.lost = gap > T.loseInterest ? d.lost + dt : 0;
  if (d.lost > 2) {
    d.stage = "loose";
    rest(sim, v);
    sim.emit("toast", { text: `${v.name} lost interest. Keep the treats close!`, warning: true });
    return;
  }
  const behind = { x: c.x - Math.sin(c.angle) * 1.1, z: c.z - Math.cos(c.angle) * 1.1 };
  const target = sim.venue.isDeck(behind.x, behind.z, sim.level, 0.1) ? behind : c;
  if (distance(v, target) > 0.35) {
    if (v.timer === 0) {
      v.path = sim.venue.route(v, target);
      v.timer = 0.2;
    }
    sim.walkVisitor(v, dt, Math.min(T.follow, 2 + distance(v, target) * 3));
    v.status = "following";
  }
  const door = sim.venue.arrival;
  for (const side of [-1, 1]) {
    const exit = { x: side * door.outsideX, z: door.doorZ };
    const coachAtDoor = distance(c, exit) < 1.9 && distance(v, exit) < 4.5;
    if (coachAtDoor || (distance(v, exit) < T.exitReach && distance(c, exit) < T.exitReach + 2.5)) {
      c.carry = null;
      d.stage = "leaving";
      sim.sendVisitorHome(v, "leaving");
      sim.score += 150;
      sim.stats.prevented++;
      sim.emit("points", { x: v.x, z: v.z, value: 150 });
      sim.feedback("prevented", { x: v.x, z: v.z });
      sim.save("dog-out", v, 150, { name: v.name });
      sim.emit("toast", { text: `Good dog! ${v.name} trots home with a treat. +150` });
      return;
    }
  }
}
