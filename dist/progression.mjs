import { SHIFTS } from "./sim.mjs";
import { DRILL_LIST, DRILLS } from "./drills.mjs";
// Free play opens what the week's run has passed (week.mjs `unlocked`, copied into the records by the app), and a star in free
// play opens the next level (since 16 October 2026, the creator's design; it was every level open for playtesting before).
// `?unlockall` opens everything for a page, for testing.
export const UNLOCK_ALL = false;
// The live switch: starts at UNLOCK_ALL, and the QA hook (`?debug`) can flip it to see the real, star-gated map.
export const progressFlags = { unlockAll: UNLOCK_ALL };
export function isUnlocked(records, level, unlockAll = progressFlags.unlockAll) {
  return unlockAll || level <= records.unlocked;
}
export function normalizeRecords(saved = {}) {
  return {
    bests: SHIFTS.map((_, i) => Math.max(0, Number(saved?.bests?.[i]) || 0)),
    unlocked: Math.max(1, Math.min(SHIFTS.length, Math.floor(Number(saved?.unlocked)) || 1)),
    // Best score per drill (bonus shifts, see drills.mjs).
    drills: Object.fromEntries(
      DRILL_LIST.map((d) => [d.id, Math.max(0, Number(saved?.drills?.[d.id]) || 0)]),
    ),
  };
}
export function starsFor(level, score) {
  return SHIFTS[level - 1].thresholds.filter((n) => score >= n).length;
}
export function starsForDrill(id, score) {
  return DRILLS[id].config.thresholds.filter((n) => score >= n).length;
}
export function recordResult(records, level, score) {
  const index = level - 1,
    newBest = score > records.bests[index];
  if (newBest) records.bests[index] = score;
  if (starsFor(level, score) > 0)
    records.unlocked = Math.max(records.unlocked, Math.min(SHIFTS.length, level + 1));
  return newBest;
}
export function recordDrill(records, id, score) {
  const newBest = score > (records.drills[id] || 0);
  if (newBest) records.drills[id] = score;
  return newBest;
}
