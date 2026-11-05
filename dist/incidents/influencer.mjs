// 🤳 The influencer (5 November 2026, the creator: "make this incident [the rooftop's selfie] appear in other venues as well…
// like the Wave Pool, the Aqua Disco, the Lazy River, the Gala! They just stand there in the middle of the deck and swimmers or
// the coach can stumble… so the coach has to go and press E, like Karen, same progress bar, and then they leave… not always,
// it's random, in the pool of incidents").
// A guest comes out of a door with a phone up and plants themselves in the middle of the deck, on the guests' busiest walk
// (`venue.selfieSpots`), filming themselves (the Selfie clip and the pink phone, as on the rooftop's edge). Every so often they
// stroll to a better angle. The warning is them walking out and the tag over them; the prevention window is the time before
// someone walks into them; the comic failure is a guest (or a coach) tripping over them, down for a moment, cross, and points
// lost; the recovery is physical: a coach goes to them and HOLDS E beside them until the wheel fills (Karen's wheel, times and
// many hands: 8 s alone, 5 with two, 3 with three, teamwork.mjs), and they put the phone away and leave. Let go, or step away,
// and the wheel drains.
// The simulation only reports facts: the model, the clip, the phone and its flash, the sounds are the presentation's.
import { teamTime, joinTeam, teamTag } from "../teamwork.mjs";
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const INFLUENCER_TUNING = {
  walk: 1.4, // a stroll, filming on the way
  leave: 2.6,
  times: [8, 5, 3], // seconds of holding E: one coach alone, two together, three (Karen's, as the creator asked)
  release: 1.6, // seconds for a full wheel to drain once nobody is on it
  reach: 1.8, // how close a coach must be to hold E on them
  trip: 0.6, // a guest walking this close to them trips over them (metres, middle to middle)
  coachTrip: 0.5, // and a coach on foot this close
  coachSlip: 1.1, // seconds a coach is down
  coachSpeed: 0.8, // m/s: a coach walking into them trips; one standing still or creeping up does not
  penalty: 25, // points lost when a guest trips over them (a wet spot's)
  mood: 8, // happiness the guest loses (on top of a trip's 6)
  coachPenalty: 15, // points lost when a coach trips over them
  reward: 90,
  cleanBonus: 40, // nobody tripped at all
  move: [16, 26], // seconds on a spot before they stroll to a better angle
  done: 1.2, // seconds putting the phone away before they go
};
const T = INFLUENCER_TUNING;

// Their names: whoever they are online.
export const HANDLES = [
  "@SplashQueen",
  "@PoolBoi",
  "@Wet&Wild",
  "@SelfieSam",
  "@LifeguardLife",
  "@Cannon_Bae",
];

// Where the influencer is (posing or strolling) and in the way: `who` (a guest or a coach) within `radius` of them, and not one
// who has tripped over them already (`tripped`, by guest id; a coach remembers it himself).
export function influencerAt(sim, who, radius = T.trip) {
  const k = sim.influencer;
  if (!k || (who.id !== undefined && k.tripped.includes(who.id))) return null;
  const v = sim.visitor(k.id);
  if (!v || !inTheWay(v)) return null;
  return distance(v, who) < radius ? v : null;
}
const inTheWay = (v) => ["posing", "strolling"].includes(v.status);

// A guest has tripped over them (sim.tickDeckTrip made them fall, as on a wet spot): cross, and it costs points.
export function trippedOverInfluencer(sim, p, v) {
  const k = sim.influencer;
  k.tripped.push(p.id);
  p.h = Math.max(0, p.h - T.mood);
  p.deckPenalty = (p.deckPenalty || 0) + T.mood;
  sim.score -= T.penalty;
  sim.stats.influencerTrips = (sim.stats.influencerTrips || 0) + 1;
  sim.breakStreak("influencer", p);
  sim.emit("points", { x: p.x, z: p.z, value: -T.penalty });
  sim.emit("influencer-trip", { id: p.id, x: p.x, z: p.z, by: v.id });
  if (k.tripped.length <= 2 || sim.time - (k.toldAt ?? -99) > 12) {
    k.toldAt = sim.time;
    sim.emit("toast", {
      text: `${p.name} tripped over ${v.name}! −${T.penalty} · Hold E by them to move them on`,
      warning: true,
    });
  }
}

// A coach on foot walking into them (coach.mjs): down for a moment, and it costs a little. Once up he can step away without
// falling again (`c.influencerTrip`).
export function coachTripsOverInfluencer(sim, c) {
  const v = influencerAt(sim, c, T.coachTrip);
  if (!v) {
    if (c.influencerTrip && !influencerAt(sim, c, T.coachTrip + 0.5)) c.influencerTrip = null;
    return false;
  }
  if (c.influencerTrip === v.id || Math.hypot(c.vx, c.vz) < T.coachSpeed) return false;
  c.influencerTrip = v.id;
  c.slipTime = c.slipLength = T.coachSlip;
  c.slipCooldown = Math.max(c.slipCooldown, T.coachSlip + 0.6);
  c.dashTime = 0;
  c.vx *= 0.15;
  c.vz *= 0.15;
  sim.score -= T.coachPenalty;
  sim.stats.influencerTrips = (sim.stats.influencerTrips || 0) + 1;
  sim.stats.coachInfluencerTrips = (sim.stats.coachInfluencerTrips || 0) + 1;
  sim.influencer.coachTrips = (sim.influencer.coachTrips || 0) + 1;
  sim.emit("points", { x: c.x, z: c.z, value: -T.coachPenalty });
  sim.emit("coach-slip", { x: c.x, z: c.z, influencer: true });
  return true;
}

export const Influencer = {
  key: "influencer",
  init(sim) {
    sim.influencer = null;
  },
  isActive: (sim) => !!sim.influencer,
  // Only where the deck has a spot for them (the director only draws it there: VENUE_INCIDENTS in week.mjs).
  canStart: (sim) => !!sim.venue.selfieSpots?.length,
  describe(sim) {
    const k = sim.influencer;
    if (!k) return "";
    const v = sim.visitor(k.id);
    return (
      "stage " +
      k.stage +
      " · " +
      (v?.status ?? "gone") +
      (k.calming
        ? " · being moved on" + (k.helpers.length > 1 ? ` by ${k.helpers.length} coaches` : "")
        : "") +
      (k.tripped.length ? ` · ${k.tripped.length} tripped` : "")
    );
  },
  detail(sim) {
    const k = sim.influencer;
    return (
      k && { at: sim.visitor(k.id), wheel: k.progress, tripped: k.tripped.length, coach: k.coachTrips || 0 }
    );
  },
  start(sim) {
    const spots = sim.venue.selfieSpots;
    if (!spots?.length) return false;
    const name = HANDLES[Math.floor(sim.chaosRandom() * HANDLES.length)];
    const v = sim.spawnVisitor("influencer", { systemKey: "influencer", name, hold: 0.3 });
    const spot = pickSpot(sim, v, null);
    v.path.push(...sim.venue.route(v.path[0], spot));
    v.spot = spot;
    sim.influencer = {
      id: v.id,
      stage: "approach",
      progress: 0,
      calming: false,
      helpers: [], // the coaches holding E on them, in the order they joined (teamwork.mjs)
      tripped: [], // the guests who have tripped over them (each once)
      coachTrips: 0,
      moveT: 0,
      elapsed: 0,
    };
    sim.emit("chaos", { kind: "influencer" });
    sim.incident("influencer", v, { id: v.id, name });
    sim.emit("toast", {
      text: `🤳 ${name} is filming in the middle of the deck! People will trip over them. Hold E beside them to move them on.`,
      warning: true,
    });
  },
  // (With a crew: the first coach on the wheel, else the one nearest them.)
  focus(sim) {
    const k = sim.influencer;
    return k?.helpers?.length ? k.helpers[0] : { near: k && sim.visitor(k.id) };
  },
  update(sim, dt) {
    const k = sim.influencer;
    if (!k) return;
    const v = sim.visitor(k.id);
    if (!v) {
      for (const c of sim.coaches) if (c.calmWho === "influencer") c.calming = c.calmLatched = false;
      sim.influencer = null;
      return;
    }
    k.elapsed += dt;
    switch (v.status) {
      case "entering":
        if (v.hold <= 0) v.status = "strolling";
        sim.walkVisitor(v, dt, T.walk);
        return;
      case "strolling":
      case "posing": {
        if (v.status === "strolling" && sim.walkVisitor(v, dt, T.walk)) {
          v.status = "posing";
          k.stage = "posing";
          k.moveT = T.move[0] + sim.chaosRandom() * (T.move[1] - T.move[0]);
          // Facing the pool's middle, the deck behind them in the shot.
          v.angle = v.face = Math.atan2(-v.x, -v.z);
        }
        if (v.status === "posing" && !k.calming) {
          k.moveT -= dt;
          if (k.moveT <= 0) {
            // A better angle: on to another spot (filming on the way).
            const spot = pickSpot(sim, v, v.spot);
            v.spot = spot;
            v.path = sim.venue.route(v, spot);
            v.status = "strolling";
            k.stage = "strolling";
            sim.emit("influencer-move", { x: v.x, z: v.z });
          }
        }
        calm(sim, k, v, dt);
        return;
      }
      case "done":
        v.timer -= dt;
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
    const k = sim.influencer,
      c = sim.coach;
    if (!k) return;
    const v = sim.visitor(k.id);
    if (!v || !inTheWay(v) || !inReach(sim, v) || c.calming) return;
    options.push({
      kind: "influencer",
      label: k.helpers.length
        ? `✋ Hold E · help move ${v.name} on (faster together)`
        : `✋ Hold E · move ${v.name} on`,
      x: v.x,
      z: v.z,
      rank: -320 + distance(c, v),
      run: () => beginCalm(sim, k),
    });
  },
  alert(sim, alerts) {
    const k = sim.influencer,
      v = k && sim.visitor(k.id);
    if (!v || !inTheWay(v)) return;
    alerts.push({
      kind: "influencer",
      icon: "🤳",
      label: v.name,
      x: v.x,
      z: v.z,
      y: 2.3,
      urgency: 72,
      id: v.id,
    });
  },
  hint(sim) {
    const k = sim.influencer,
      v = k && sim.visitor(k.id);
    if (!v || !inTheWay(v)) return "";
    if (k.calming) return `✋ Keep holding E · moving ${v.name} on`;
    return inReach(sim, v)
      ? `🤳 Hold E next to ${v.name} to move them on`
      : `🤳 Walk to ${v.name} · then hold E`;
  },
  panel(sim) {
    const k = sim.influencer,
      v = k && sim.visitor(k.id);
    if (!v || !inTheWay(v)) return null;
    return {
      icon: "🤳",
      title: k.tripped.length ? `INFLUENCER · ${k.tripped.length} TRIPPED` : "INFLUENCER ON THE DECK!",
      task: Influencer.hint(sim),
      steps: [
        { label: "🚶 REACH THEM", active: !inReach(sim, v), done: inReach(sim, v) },
        { label: "✋ HOLD E", active: inReach(sim, v), done: false },
      ],
    };
  },
  tag(sim, v) {
    const k = sim.influencer;
    if (!k || v.kind !== "influencer") return null;
    if (["done", "leaving"].includes(v.status)) return { icon: "👋", label: v.name };
    if (v.status === "entering") return { icon: "🤳", label: v.name, urgent: true };
    return { icon: "🤳", label: v.name, urgent: true, ring: k.progress, team: teamTag(sim, k.helpers) };
  },
};

// A spot to film from: one of the venue's, never the one they are on, and not right where a coach stands (they would trip over
// each other at once). The shift's incident stream decides which.
function pickSpot(sim, v, current) {
  const spots = sim.venue.selfieSpots.filter(
    (s) => s !== current && sim.coaches.every((c) => distance(c, s) > 1.5),
  );
  const list = spots.length ? spots : sim.venue.selfieSpots;
  return list[Math.floor(sim.chaosRandom() * list.length) % list.length];
}
function inReach(sim, v, c = sim.coach) {
  return !c.swimming && !c.waterTransition && !c.wading && distance(c, v) <= T.reach;
}

// A coach presses E beside them (run as that coach: the actor). Pressed with the key down: they hold while it is held. Clicked
// or tapped: until they move or step away. (The coach's `calming` is Karen's: planted, palms out, talking them down; coach.mjs.)
function beginCalm(sim, k) {
  const c = sim.coach;
  c.calming = true;
  c.calmWho = "influencer";
  c.calmLatched = !c.holding;
  k.calming = true;
  const before = k.helpers.length;
  if (joinTeam(k.helpers, sim.actor ?? 0) && before > 0) {
    const v = sim.visitor(k.id);
    sim.emit("team-up", { x: v?.x ?? c.x, z: v?.z ?? c.z, kind: "influencer", helpers: k.helpers.length });
  }
  return true;
}

// Every coach on them keeps at it while they hold E (or stay put after a click) and stay in reach; the wheel fills at the speed
// of the hands on it, and drains when nobody is. While someone is on them they stop and listen (no strolling off).
function calm(sim, k, v, dt) {
  const playing = sim.status === "playing";
  k.helpers = k.helpers.filter((i) => {
    const c = sim.coaches[i];
    if (!c) return false;
    const moving = !!(c.input?.x || c.input?.z),
      holding = c.holding || (c.calmLatched && !moving),
      on = c.calming && c.calmWho === "influencer" && holding && inReach(sim, v, c) && playing;
    if (!on && c.calmWho === "influencer") c.calming = c.calmLatched = false;
    return on;
  });
  k.calming = k.helpers.length > 0;
  if (k.calming) {
    if (v.status === "strolling") {
      v.path = [];
      v.status = "posing";
      k.stage = "posing";
    }
    const first = sim.coaches[k.helpers[0]];
    v.face = Math.atan2(first.x - v.x, first.z - v.z);
    for (const i of k.helpers) {
      const c = sim.coaches[i];
      c.angle = Math.atan2(v.x - c.x, v.z - c.z);
    }
    k.progress = clamp(k.progress + dt / teamTime(T.times, k.helpers.length), 0, 1);
    if (k.progress >= 1) return movedOn(sim, k, v);
  } else k.progress = Math.max(0, k.progress - dt / T.release);
}

function movedOn(sim, k, v) {
  const clean = k.tripped.length === 0 && !k.coachTrips,
    value = T.reward + (clean ? T.cleanBonus : 0);
  k.calming = false;
  for (const i of k.helpers) {
    const c = sim.coaches[i];
    if (c) c.calming = c.calmLatched = false;
  }
  k.team = k.helpers.length;
  k.helpers = [];
  k.stage = "done";
  v.status = "done";
  v.timer = T.done;
  v.path = [];
  sim.score += value;
  sim.stats.influencersMoved = (sim.stats.influencersMoved || 0) + 1;
  sim.stats.prevented++;
  sim.emit("points", { x: v.x, z: v.z, value });
  sim.save("influencer", v, value, { name: v.name });
  sim.emit("influencer-done", { x: v.x, z: v.z });
  sim.emit("toast", {
    text: `${v.name} puts the phone away and leaves. +${value}${clean ? " · nobody tripped" : ""}${k.team > 1 ? " · teamwork!" : ""}`,
  });
}
