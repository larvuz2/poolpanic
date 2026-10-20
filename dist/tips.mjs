// 📣 Coaching tips (Phase 3, 20 October 2026). Coach Waters is a coach: in the lane pools a lap swimmer now and then asks for a tip
// ("How's my stroke?", 📣 over them). The coach walks to the end of their lane (or beside an outer lane, where he can reach them as
// anywhere: `swimmerInReach`) and presses E as they come by: a moment's coaching ("High elbows!"), and the swimmer is happier, swims
// a little faster for the rest of the workout, and it is points and one more for the happy streak. Left unanswered, the ask lapses
// and the swimmer is a little disappointed.
//
// Why: the diagnostic of 19 October found the coach idle more than half of a lane-pool shift (the swimmers just swim). A tip is
// something worth doing in every quiet moment, and a choice (the VIP's ask, or the beginner's who is fed up?). A chore, not an
// incident: it never counts towards the incidents a shift may run at once, and never holds the clock. Its numbers come from a
// random stream of its own, so the rest of the shift is the same with or without them.
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export const TIPS = {
  from: 2, // the first level with asks
  chance: [0.42, 0.62], // of a lap swimmer asking once in a workout, at level 2 and at level 20
  at: [0.2, 0.62], // how far into their workout they ask (a share of it)
  limit: 10, // s an ask waits for the coach
  coach: 0.45, // s of coaching (the coach is busy)
  points: 40,
  vipPoints: 80,
  mood: 12, // happiness a tip gives
  boost: 1.12, // speed for the rest of the workout
  missed: 5, // happiness lost when nobody came
};
const T = TIPS;

// What a swimmer asks, and what the coach says back, by who they are.
export const ASKS = {
  beginner: {
    ask: "Help with my kick?",
    tips: ["Kick from the hips!", "Long arms, nice and easy!", "Blow bubbles out!"],
  },
  intermediate: {
    ask: "How's my stroke?",
    tips: ["High elbows!", "Breathe every three!", "Reach and glide!"],
  },
  advanced: { ask: "Time my lap!", tips: ["Faster turns!", "Hold that pace!", "Tight streamline!"] },
  senior: { ask: "Am I doing it right?", tips: ["Lovely and steady!", "Keep it gentle!", "Perfect form!"] },
  vip: { ask: "Watch this, coach!", tips: ["Superstar!", "Textbook!", "World class!"] },
};

// The pools where swimmers swim lengths and can ask: every lap-lane pool but the cruise ship (busy enough already).
export const tipsVenue = (venue) =>
  !!venue.pool &&
  !venue.kids &&
  !venue.class &&
  !venue.river &&
  !venue.waves &&
  !venue.roof &&
  !venue.onsen &&
  !venue.cruise;
const LAP = new Set(["beginner", "intermediate", "advanced", "senior"]);

function tipsRandom(sim) {
  if (!sim.tipSeed) sim.tipSeed = (sim.seed ^ 0x27d4eb2f) >>> 0 || 9;
  sim.tipSeed = (Math.imul(sim.tipSeed, 1664525) + 1013904223) >>> 0;
  return sim.tipSeed / 4294967296;
}
const askOf = (p) => ASKS[p.vip ? "vip" : p.type] || ASKS.intermediate;
export const askText = (p) => askOf(p).ask;

// A lap swimmer's tip, each frame they swim (sim.mjs updateLane): decided once, the first time they swim; then the ask, and its clock.
export function tickTips(sim, p, dt) {
  if (!LAP.has(p.type) || p.racer || sim.level < T.from || !tipsVenue(sim.venue) || sim.config.tutorial)
    return;
  if (p.tipAt === undefined) {
    const k = Math.min(1, Math.max(0, (sim.level - 2) / 18)),
      chance = T.chance[0] + (T.chance[1] - T.chance[0]) * k,
      roll = tipsRandom(sim),
      share = T.at[0] + tipsRandom(sim) * (T.at[1] - T.at[0]);
    p.tipAt = roll < chance ? share * (p.workTarget || 31.2) : Infinity;
  }
  if (p.ask) {
    if (p.problem) return; // (a problem first: the tip waits)
    p.ask.t += dt;
    if (p.ask.t >= T.limit) {
      p.ask = null;
      p.h = Math.max(0, p.h - T.missed);
      sim.stats.tipsMissed = (sim.stats.tipsMissed || 0) + 1;
      sim.emit("tip-missed", { id: p.id, x: p.x, z: p.z });
    }
    return;
  }
  if (p.tipDone || p.problem || p.stomachWarning || (p.traveled || 0) < p.tipAt) return;
  p.tipDone = true;
  p.ask = { t: 0, text: askText(p) };
  sim.stats.tipsAsked = (sim.stats.tipsAsked || 0) + 1;
  sim.emit("tip-ask", { id: p.id, x: p.x, z: p.z, text: p.ask.text });
  if (!sim.tipsTold) {
    sim.tipsTold = true;
    sim.emit("toast", {
      text:
        "📣 " +
        p.name +
        " asks: “" +
        p.ask.text +
        "” Meet them at the end of their lane and press E to coach them.",
    });
  }
}

// The coach answers: a moment's coaching, then the swimmer's boost, the points and the streak.
export function giveTip(sim, p) {
  if (!p?.ask || p.status !== "swim" || !sim.canInteract()) return false;
  if (!sim.swimmerInReach(p))
    return sim.guideTo(sim.servicePoint(p), "Get to the end of " + p.name + "’s lane and press E.");
  const lines = askOf(p).tips,
    line = lines[Math.floor(tipsRandom(sim) * lines.length)];
  return sim.startBusy(
    "coach",
    T.coach,
    "Coaching " + p.name + "…",
    () => {
      if (!p.ask || p.status !== "swim") return;
      p.ask = null;
      p.coached = true;
      p.boost = T.boost;
      p.h = Math.min(100, p.h + T.mood);
      const value = p.vip ? T.vipPoints : T.points;
      sim.score += value;
      sim.stats.tips = (sim.stats.tips || 0) + 1;
      sim.emit("points", { x: p.x, z: p.z, value });
      sim.emit("tip", { id: p.id, x: p.x, z: p.z, text: line, value });
      sim.bumpStreak("tip", p);
    },
    p,
  );
}

// The system's hooks (chaos.mjs SYSTEMS): E beside an asking swimmer, a quiet alert, a hint.
export const CoachTips = {
  key: "tips",
  isActive: () => false,
  describe(sim) {
    const n = sim.people.filter((p) => p.ask).length;
    return n ? n + " asking for tips" : "";
  },
  interactions(sim, options) {
    for (const p of sim.people) {
      if (!p.ask || p.status !== "swim" || !sim.swimmerInReach(p)) continue;
      options.push({
        kind: "tip",
        id: p.id,
        label: "Coach " + p.name,
        ...sim.servicePoint(p),
        rank: 0.6 + distance(sim.coach, p) * 0.5 - (p.vip ? 0.3 : 0),
        run: () => giveTip(sim, p),
      });
    }
  },
  alert(sim, alerts) {
    const c = sim.coach;
    const p = sim.people
      .filter((q) => q.ask && q.status === "swim")
      .sort((a, b) => b.ask.t - a.ask.t || distance(a, c) - distance(b, c))[0];
    if (p) {
      const at = sim.servicePoint(p);
      alerts.push({
        kind: "tip",
        icon: "📣",
        label: "Coach " + p.name,
        x: at.x,
        z: at.z,
        y: 1.2,
        urgency: 26,
      });
    }
  },
  hint(sim) {
    const p = sim.people.find((q) => q.ask && q.status === "swim");
    return p ? "📣 " + p.name + " wants a tip · meet them at the end of their lane · E" : "";
  },
};
