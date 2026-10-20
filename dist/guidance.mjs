// One cue language, shared by the world and HUD. No timer or tutorial modal.
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function guidanceState(sim) {
  if (sim.status !== "playing") return { swimmerId: null, lanes: false };
  if (sim.rescue) {
    if (sim.rescue.kind === "crash") {
      // Point at the stranded victim closest to the coach.
      const next = (sim.strandedVictims?.() || []).sort(
        (a, b) => distance(a, sim.coach) - distance(b, sim.coach),
      )[0];
      return { swimmerId: next?.id ?? null, lanes: false };
    }
    return { swimmerId: sim.rescue.stage === "stranded" ? sim.rescue.victim : null, lanes: false };
  }
  const selected = sim.get(sim.selected);
  if (selected?.status === "queue" && selected.type === "daredevil")
    return { swimmerId: selected.id, lanes: false, trampoline: !sim.jumper && sim.closed <= 0 };
  if (selected?.status === "queue") return { swimmerId: selected.id, lanes: sim.closed <= 0 };
  // A swimmer already in the water can be moved to any other lane.
  if (selected?.status === "swim" && !selected.problem)
    return { swimmerId: selected.id, lanes: sim.closed <= 0, laneExcept: selected.lane };
  const next = sim.people.find((p) => p.status === "queue");
  return { swimmerId: next?.id ?? null, lanes: false };
}
export function cuePulse(time, reduced = false) {
  return reduced ? 1 : 0.5 + 0.5 * Math.sin((time * Math.PI * 2) / 1.35);
}

// What the coach's lane choice was worth, said the moment a swimmer is sent (19 October 2026, Phase 1: on the first shift the
// score sat at 0 for 24 seconds while every choice was right, because points only come when a swimmer finishes). Only in a pool
// with lap lanes; null elsewhere. It follows the simulation's own rules: two to a lane split it, from three they swim in a circle
// and the slowest sets the pace; aqua aerobics stands still and gets in every lap swimmer's way.
const SPEED = { beginner: 0.55, intermediate: 1, advanced: 1.5, senior: 0.5, aqua: 0 };
export function laneVerdict(sim, p, lane) {
  const v = sim.venue;
  // The Lazy River's two ways round (river-ride.mjs ROUTES): the rapids for a thrill-seeker, the lazy loop for a chiller.
  if (v.river && p?.type === "rider") {
    if (lane === 1) {
      const busy = sim.people.filter(
        (q) => q !== p && q.lane === 1 && ["swim", "enter"].includes(q.status) && !q.rushDone,
      );
      if (busy.length >= 3) return { good: false, text: "The rapids are packed 😬" };
      return p.thrill
        ? { good: true, text: "Loves the rapids ⚡👍" }
        : { good: false, text: "Too wild for them 😬" };
    }
    return p.thrill
      ? { good: false, text: "They'll get bored 😬" }
      : { good: true, text: "Nice and lazy 🐢👍" };
  }
  if (!p || v.kids || v.river || v.waves || v.roof || v.onsen || v.class || !(p.type in SPEED)) return null;
  const others = sim.people.filter(
    (a) => a !== p && a.lane === lane && ["swim", "enter", "switch"].includes(a.status) && a.type in SPEED,
  );
  if (!others.length) return { good: true, text: "Own lane 👍" };
  const aquaHere = others.some((a) => a.type === "aqua"),
    lapHere = others.some((a) => a.type !== "aqua");
  if (p.type === "aqua")
    return lapHere
      ? { good: false, text: "Aqua blocks the laps 😬" }
      : { good: true, text: "Aqua together 👍" };
  if (aquaHere) return { good: false, text: "Aqua in the way 😬" };
  if (others.every((a) => a.type === p.type)) return { good: true, text: "Good match 👍" };
  if (others.length < 2) return { good: true, text: "Sharing 👍" };
  const mine = SPEED[p.type],
    slowest = Math.min(...others.map((a) => SPEED[a.type])),
    fastest = Math.max(...others.map((a) => SPEED[a.type]));
  if (mine - slowest > 0.3) return { good: false, text: "Stuck behind slower swimmers 😬" };
  if (fastest - mine > 0.3) return { good: false, text: "Too slow for this lane 😬" };
  return { good: true, text: "OK 👌" };
}
