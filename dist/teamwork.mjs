// Many hands (23 October 2026, the creator: "if two players hold E at same time on any incident it speeds things up … a
// progression wheel above incident … like Overcooked … a visual reference when a second player starts pressing E … (no
// numbers)"). A hold-to-act job (hold E beside it until its wheel fills: calming Karen, for a start) fills faster with every
// coach holding E on it at once. Pure: an incident keeps the list of coaches on its job (`helpers`, coach indices in the order
// they joined, so a crew's machines agree), gives its own times for one, two and three coaches (Karen's: 8, 5 and 3 seconds,
// the creator's), asks `teamTime` how long the wheel takes with the hands on it now, and puts `teamTag` on its tag for the
// wheel to draw (app.mjs: one face per coach round the wheel, in that coach's colour, and a second ring once two are on it).

// Seconds to fill the wheel with `n` coaches on it, from a job's times for one, two and three (more than three: the last).
export const teamTime = (times, n) => times[Math.max(1, Math.min(n, times.length)) - 1];

// A coach joins the job (once; the order of joining is kept). Returns whether they were new on it.
export function joinTeam(helpers, index) {
  if (helpers.includes(index)) return false;
  helpers.push(index);
  return true;
}

// The coaches on the job as the wheel shows them: their looks (crew.mjs ids), in the order they joined. Only in a crew: a
// single player's wheel has no faces.
export function teamTag(sim, helpers) {
  if (!(sim.coaches?.length > 1)) return undefined;
  return helpers.map((i) => sim.coaches[i]?.look || "waters");
}
