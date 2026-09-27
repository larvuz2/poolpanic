// ⚡ Power Outage. The lights start flickering and the fuse box sparks: reset the breaker quickly (E) to
// prevent a blackout. Miss it and the lights die: swimmers bump into each other in the dark, get grumpy and
// lose goggles, and you need the flashlight to find the right breakers and bring the power back.
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export const OUTAGE_TUNING = {
  flicker: 7,
  quickReset: 0.8,
  fullReset: 1.4,
  bumpChance: 0.16,
  drain: 0.28,
  reach: 1.8,
};
const T = OUTAGE_TUNING;

export const PowerOutage = {
  key: "outage",
  init(sim) {
    sim.outage = null;
    sim.flashlight = { state: "rack" };
  },
  isActive: (sim) => !!sim.outage,
  panic: (sim) => sim.outage?.stage === "dark",
  start(sim) {
    sim.outage = { stage: "flicker", t: T.flicker, elapsed: 0, dark: 0 };
    sim.emit("chaos", { kind: "outage" });
    sim.emit("outage-flicker");
    sim.emit("toast", {
      text: "⚡ The lights are flickering! Reset the breaker at the fuse box (E) before they go out.",
      warning: true,
    });
  },
  update(sim, dt) {
    const o = sim.outage;
    if (!o) return;
    o.elapsed += dt;
    if (o.stage === "flicker") {
      o.t -= dt;
      if (o.t <= 0) {
        o.stage = "dark";
        sim.score -= 100;
        sim.stats.blackouts = (sim.stats.blackouts || 0) + 1;
        sim.emit("blackout");
        sim.emit("toast", {
          text: "BLACKOUT! Grab the flashlight, then reset the fuse box. −100",
          warning: true,
        });
      }
    } else if (o.stage === "dark") {
      o.dark += dt;
      darkChaos(sim, dt);
    } else if (o.stage === "restored") {
      o.t -= dt;
      if (o.t <= 0 && sim.flashlight.state === "rack" && sim.coach.carry !== "flashlight") sim.outage = null;
    }
  },
  interactions(sim, options) {
    const c = sim.coach,
      o = sim.outage,
      fx = sim.venue.fixtures;
    const box = {
      x: fx.fuseBox.x + Math.sin(fx.fuseBox.angle) * 0.85,
      z: fx.fuseBox.z + Math.cos(fx.fuseBox.angle) * 0.85,
    };
    if (o && ["flicker", "dark"].includes(o.stage) && distance(c, box) < T.reach) {
      if (o.stage === "flicker")
        options.push({
          kind: "reset-breaker",
          label: "Reset the breaker",
          ...box,
          rank: -320 + distance(c, box),
          run: () =>
            sim.startBusy("breaker", T.quickReset, "Resetting the breaker…", () => restore(sim, true)),
        });
      else if (c.carry === "flashlight")
        options.push({
          kind: "reset-breaker",
          label: "Reset the breakers",
          ...box,
          rank: -320 + distance(c, box),
          run: () => sim.startBusy("breaker", T.fullReset, "Flipping breakers…", () => restore(sim, false)),
        });
      else
        options.push({
          kind: "dark-fusebox",
          label: "Too dark! Get the flashlight",
          ...box,
          rank: -150 + distance(c, box),
          run: () =>
            sim.guideTo(fx.flashlight, "Too dark to find the right breaker. Grab the flashlight first!"),
        });
    }
    if (distance(c, fx.flashlight) < T.reach) {
      if (!c.carry && sim.flashlight.state === "rack" && o?.stage === "dark")
        options.push({
          kind: "flashlight",
          label: "Grab the flashlight",
          ...fx.flashlight,
          rank: -300 + distance(c, fx.flashlight),
          run: () => {
            c.carry = "flashlight";
            sim.flashlight.state = "coach";
            sim.feedback("pickup");
            return true;
          },
        });
      if (c.carry === "flashlight")
        options.push({
          kind: "return-flashlight",
          label: "Put the flashlight back",
          ...fx.flashlight,
          rank: 40 + distance(c, fx.flashlight),
          run: () => returnFlashlight(sim),
        });
    }
  },
  returnItem(sim) {
    if (sim.coach.carry !== "flashlight") return undefined;
    return returnFlashlight(sim);
  },
  hint(sim) {
    const o = sim.outage;
    if (!o) return sim.coach.carry === "flashlight" ? "Put the flashlight back · E" : "";
    if (o.stage === "flicker") return "⚡ Fuse box · E to reset before the blackout";
    if (o.stage === "dark")
      return sim.coach.carry === "flashlight"
        ? "Fuse box · E to reset the breakers"
        : "⚡ Grab the flashlight · E";
    return sim.coach.carry === "flashlight" ? "Put the flashlight back · E" : "";
  },
  panel(sim) {
    const o = sim.outage;
    if (!o || o.stage === "restored") return null;
    if (o.stage === "flicker")
      return {
        icon: "⚡",
        title: "LIGHTS FLICKERING!",
        task: `Reset the fuse box in ${Math.ceil(o.t)}s · E`,
      };
    const step = sim.coach.carry === "flashlight" ? 1 : 0;
    return {
      icon: "🔦",
      title: "BLACKOUT!",
      task: PowerOutage.hint(sim),
      steps: ["FLASHLIGHT", "FUSE BOX", "PUT BACK"].map((label, i) => ({
        label: i + 1 + " · " + label,
        active: i === step,
        done: i < step,
      })),
    };
  },
};

// Swimmers can't see each other: random bumps in shared lanes, and everyone gets a little grumpier.
function darkChaos(sim, dt) {
  for (let lane = 0; lane < sim.lanes.length; lane++) {
    const swimmers = sim.lanePeople(lane).filter((p) => p.type !== "aqua" && !p.problem);
    for (const p of swimmers) p.h = Math.max(10, p.h - dt * T.drain);
    if (swimmers.length < 2 || sim.chaosRandom() > T.bumpChance * dt) continue;
    const a = swimmers[Math.floor(sim.chaosRandom() * swimmers.length)];
    const b = swimmers.filter((p) => p !== a).sort((m, n) => distance(m, a) - distance(n, a))[0];
    for (const p of [a, b]) {
      p.collisionTime = Math.max(p.collisionTime || 0, 0.7);
      p.annoyedTime = 0.85;
      p.h = Math.max(0, p.h - 3);
    }
    sim.stats.collisions++;
    sim.emit("collision", { x: a.x, z: a.z, id: a.id });
    if (sim.level > 1 && !a.problem && sim.chaosRandom() < 0.25) {
      a.problem = "goggles";
      sim.clutter.push({ id: ++sim.uid, type: "goggles", owner: a.id, x: sim.lanes[lane], z: -9.6 });
    }
  }
}

function restore(sim, prevented) {
  const o = sim.outage;
  if (!o) return;
  o.stage = "restored";
  o.t = 1.2;
  const bonus = 100;
  sim.score += bonus;
  if (prevented) sim.stats.prevented++;
  sim.emit("points", { x: sim.coach.x, z: sim.coach.z, value: bonus });
  sim.emit("power-restored");
  sim.feedback("prevented");
  sim.emit("toast", {
    text: prevented
      ? "Breaker reset. Crisis averted! +100"
      : "Let there be light! +100 · Put the flashlight back.",
  });
}

function returnFlashlight(sim) {
  const c = sim.coach,
    point = sim.venue.fixtures.flashlight;
  if (c.carry !== "flashlight" || !sim.canInteract()) return false;
  if (distance(c, point) > T.reach) return sim.guideTo(point, "Put the flashlight back on its holder.");
  c.carry = null;
  sim.flashlight.state = "rack";
  sim.feedback("pickup");
  return true;
}
