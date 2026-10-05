// 😡 Karen. She comes through a locker door, does not swim, and marches straight at the coach to complain about
// everything. Anyone on deck close to her on the way gets annoyed: they stop what they are doing, cover their ears
// and lose happiness and points. Run to her and HOLD E until the ring fills (the coach calms her down with both
// arms; she rants the whole time). Let go, or step away, and the ring drains. Calmed, she sighs and leaves through
// the same door, and her influence is gone. The simulation only reports facts: the sounds, the red scribbles, the
// annoyed poses and the calming gesture are all the presentation layer's.
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const KAREN_TUNING = {
  walk: 3.1, // she is in a hurry
  leave: 3.4,
  stop: 1.25, // she stops this far from the coach and starts in
  resume: 2.2, // the coach steps further away than this and she follows
  reach: 2.0, // how close the coach must be to calm her
  calmTime: 3, // seconds of holding E
  release: 1.6, // seconds for a full ring to drain once E is let go
  radius: 3.3, // her annoying range, in metres
  linger: 0.55, // an annoyed person stays annoyed this long after she moves on
  penalty: 20, // score, once per person annoyed
  deckPenalty: 6, // happiness, once per person annoyed
  reward: 100,
  cleanBonus: 50, // nobody got annoyed at all
  sigh: 1.5, // calmed: the pause before she leaves
  voice: [1.3, 2.4], // seconds between her squawks
};
const T = KAREN_TUNING;

// What she does while she rants, one step after the other: wave her arms, point at the pool, wave her arms, point
// at nothing in particular, and so on.
export const KAREN_GESTURES = [
  { kind: "complain", time: 2.6 },
  { kind: "point", at: "pool", time: 1.9 },
  { kind: "complain", time: 2.6 },
  { kind: "point", at: "random", time: 1.5 },
  { kind: "complain", time: 2.6 },
  { kind: "point", at: "random", time: 1.5 },
];

// People who can be annoyed: standing or walking on the deck (not in the water, not mid-emergency).
const WALKING = ["arriving", "enter"];
export const annoyable = (p) =>
  (p.status === "queue" ||
    WALKING.includes(p.status) ||
    (p.status === "exit" && !["water", "climb"].includes(p.exitPhase))) &&
  !(p.arrivalHold > 0);

export const Karen = {
  key: "karen",
  init(sim) {
    sim.karen = null;
  },
  isActive: (sim) => !!sim.karen,
  // For the shift's diary (trace.mjs): `describe` is where the incident stands, in words that change only when its stage does (a line is
  // written each time it changes, and a stage that lasts too long is said to be waiting); `detail` is what moves, for the periodic pulse.
  describe(sim) {
    const k = sim.karen;
    if (!k) return "";
    return (
      "stage " +
      k.stage +
      " · " +
      (sim.visitor(k.id)?.status ?? "gone") +
      (k.calming ? " · being calmed" : "")
    );
  },
  detail(sim) {
    const k = sim.karen;
    return k && { at: sim.visitor(k.id), calm: k.progress, annoyed: k.annoyed?.size };
  },
  start(sim) {
    const v = sim.spawnVisitor("karen", { systemKey: "karen", name: "Karen", hold: 0.3 });
    v.path.push(...sim.venue.route(v.path[0], coachTarget(sim)));
    sim.karen = {
      id: v.id,
      stage: "approach",
      progress: 0,
      calming: false,
      latched: false,
      annoyed: new Set(),
      repath: 0,
      gesture: -1,
      gestureT: 0,
      voiceT: 0.4,
      elapsed: 0,
    };
    sim.emit("chaos", { kind: "karen" });
    sim.incident("karen", v, { id: v.id, name: "Karen" });
    sim.emit("toast", {
      text: "😡 Karen is here to complain! Run to her and hold E to calm her down.",
      warning: true,
    });
  },
  update(sim, dt) {
    // Visitors' annoyance fades by itself (swimmers' is handled where they are moved, in tickAnnoyed).
    for (const v of sim.visitors) if (v.karenAnnoyed > 0) v.karenAnnoyed = Math.max(0, v.karenAnnoyed - dt);
    const k = sim.karen;
    if (!k) return;
    const v = sim.visitor(k.id);
    if (!v) {
      sim.coach.calming = false;
      sim.karen = null;
      return;
    }
    k.elapsed += dt;
    const c = sim.coach;
    switch (v.status) {
      case "entering":
        if (v.hold <= 0) v.status = "marching";
        sim.walkVisitor(v, dt, T.walk);
        return;
      case "marching":
      case "ranting": {
        const target = coachTarget(sim),
          onDeck = target === c;
        if (v.status === "marching") {
          // Out of the locker room she heads for wherever the coach is now, re-planning as the coach moves.
          const outside = Math.abs(v.x) <= sim.venue.arrival.outsideX + 0.2;
          k.repath -= dt;
          if (outside && k.repath <= 0) {
            k.repath = 0.4;
            v.path = sim.venue.route(v, target);
          }
          const close = distance(v, target) <= (onDeck ? T.stop : 0.6);
          if (close) {
            v.status = "ranting";
            v.path = [];
            k.stage = "ranting";
            sim.emit("karen-arrive", { x: v.x, z: v.z });
          } else sim.walkVisitor(v, dt, T.walk);
        } else if (distance(v, target) > (onDeck ? T.resume : 0.9)) {
          v.status = "marching";
          k.stage = "approach";
          k.repath = 0;
        }
        annoyBystanders(sim, k, v);
        rant(sim, k, v, dt);
        calm(sim, k, v, dt);
        return;
      }
      case "calmed":
        v.timer -= dt;
        v.face = Math.atan2(c.x - v.x, c.z - v.z);
        if (v.timer <= 0) {
          sim.sendVisitorHome(v, "leaving");
          k.stage = "leaving";
        }
        return;
      case "leaving":
        sim.walkVisitor(v, dt, T.leave);
        return;
    }
  },
  interactions(sim, options) {
    const k = sim.karen,
      c = sim.coach;
    if (!k) return;
    const v = sim.visitor(k.id);
    if (!v || !["marching", "ranting"].includes(v.status) || !inReach(sim, v)) return;
    options.push({
      kind: "calm",
      label: "✋ Hold E · calm Karen down",
      x: v.x,
      z: v.z,
      rank: -330 + distance(c, v),
      run: () => beginCalm(sim, k),
    });
  },
  // Loud alert: Karen herself, until she is calmed.
  alert(sim, alerts) {
    const k = sim.karen,
      v = k && sim.visitor(k.id);
    if (!v || !["marching", "ranting"].includes(v.status)) return;
    alerts.push({ kind: "karen", icon: "😡", label: "Karen", x: v.x, z: v.z, y: 2.3, urgency: 86, id: v.id });
  },
  hint(sim) {
    const k = sim.karen,
      v = k && sim.visitor(k.id);
    if (!v || !["marching", "ranting"].includes(v.status)) return "";
    if (k.calming) return "✋ Keep holding E · calming Karen";
    return k.stage === "ranting" || inReach(sim, v)
      ? "😡 Hold E next to Karen to calm her down"
      : "😡 Run to Karen · then hold E";
  },
  panel(sim) {
    const k = sim.karen,
      v = k && sim.visitor(k.id);
    if (!v || !["marching", "ranting"].includes(v.status)) return null;
    return {
      icon: "😡",
      title: k.annoyed.size ? `KAREN · ${k.annoyed.size} ANNOYED` : "KAREN IS COMPLAINING!",
      task: Karen.hint(sim),
      steps: [
        { label: "🏃 REACH KAREN", active: !inReach(sim, v), done: inReach(sim, v) },
        { label: "✋ HOLD E", active: inReach(sim, v), done: false },
      ],
    };
  },
  tag(sim, v) {
    const k = sim.karen;
    if (!k || v.kind !== "karen") return null;
    if (["calmed", "leaving"].includes(v.status)) return { icon: "😌", label: "Karen" };
    if (v.status === "entering") return { icon: "😡", label: "Karen", urgent: true };
    return { icon: "😡", label: "Karen", urgent: true, ring: k.progress };
  },
};

// Karen walks towards the coach; a coach in the water (a rescue) cannot be reached, so she goes to the nearest edge.
function coachTarget(sim) {
  const c = sim.coach;
  if (!c.swimming && !c.waterTransition && sim.isDeck(c.x, c.z)) return c;
  const spots = sim.venue.edgeSpots();
  return spots.reduce((best, s) => (distance(s, c) < distance(best, c) ? s : best), spots[0]);
}
function inReach(sim, v) {
  const c = sim.coach;
  return !c.swimming && !c.waterTransition && distance(c, v) <= T.reach;
}

// Everybody on the deck within her range stops, covers their ears and loses a little happiness, once each.
function annoyBystanders(sim, k, v) {
  for (const p of sim.people) {
    if (!annoyable(p) || distance(p, v) > T.radius) continue;
    p.karenAnnoyed = T.linger;
    if (k.annoyed.has(p.id)) continue;
    k.annoyed.add(p.id);
    sim.score -= T.penalty;
    sim.streak = 0;
    sim.stats.annoyed = (sim.stats.annoyed || 0) + 1;
    p.deckPenalty = (p.deckPenalty || 0) + T.deckPenalty;
    p.h = Math.max(0, p.h - T.deckPenalty);
    sim.emit("points", { x: p.x, z: p.z, value: -T.penalty });
  }
  for (const o of sim.visitors) if (o !== v && distance(o, v) <= T.radius) o.karenAnnoyed = T.linger;
}

// The rant: which gesture she is in (the view plays it), where she looks, and her squawks.
function rant(sim, k, v, dt) {
  const c = sim.coach;
  k.gestureT -= dt;
  if (k.gestureT <= 0) {
    k.gesture = (k.gesture + 1) % KAREN_GESTURES.length;
    const g = KAREN_GESTURES[k.gesture];
    k.gestureT = g.time;
    v.gesture = g.kind;
    v.gazeAt =
      g.at === "pool"
        ? { x: 0, z: 0 }
        : g.at === "random"
          ? {
              x: v.x + Math.cos(sim.chaosRandom() * 6.283) * 6,
              z: v.z + Math.sin(sim.chaosRandom() * 6.283) * 6,
            }
          : null;
  }
  const gaze = v.gesture === "point" && v.gazeAt ? v.gazeAt : c;
  v.face = Math.atan2(gaze.x - v.x, gaze.z - v.z);
  if (v.status === "ranting") v.angle = v.face;
  k.voiceT -= dt;
  if (k.voiceT <= 0) {
    k.voiceT = T.voice[0] + sim.chaosRandom() * (T.voice[1] - T.voice[0]);
    sim.emit("karen-voice", { x: v.x, z: v.z });
  }
}

function beginCalm(sim, k) {
  k.calming = true;
  // Pressed with the key down: calm while it is held. Clicked or tapped: calm until the coach moves or steps away.
  k.latched = !sim.holdInteract;
  sim.coach.calming = true;
  return true;
}

function calm(sim, k, v, dt) {
  const c = sim.coach,
    moving = !!(c.input?.x || c.input?.z);
  if (k.calming) {
    const holding = sim.holdInteract || (k.latched && !moving);
    if (!holding || !inReach(sim, v) || sim.status !== "playing") {
      k.calming = false;
      k.latched = false;
    }
  }
  c.calming = k.calming;
  if (k.calming) {
    c.angle = Math.atan2(v.x - c.x, v.z - c.z);
    k.progress = clamp(k.progress + dt / T.calmTime, 0, 1);
    if (k.progress >= 1) return calmed(sim, k, v);
  } else k.progress = Math.max(0, k.progress - dt / T.release);
}

function calmed(sim, k, v) {
  const clean = k.annoyed.size === 0,
    value = T.reward + (clean ? T.cleanBonus : 0);
  k.calming = false;
  k.latched = false;
  sim.coach.calming = false;
  k.stage = "calmed";
  v.status = "calmed";
  v.timer = T.sigh;
  v.path = [];
  v.gesture = null;
  sim.score += value;
  sim.stats.calmed = (sim.stats.calmed || 0) + 1;
  sim.stats.prevented++;
  sim.emit("points", { x: v.x, z: v.z, value });
  sim.save("karen", v, value, { name: "Karen" });
  sim.emit("karen-calmed", { x: v.x, z: v.z });
  sim.emit("toast", {
    text: `Karen calms down and leaves. +${value}${clean ? " · nobody was annoyed" : ""}`,
  });
}
