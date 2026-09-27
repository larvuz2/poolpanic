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
