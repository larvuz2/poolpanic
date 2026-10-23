// Co-op crews (22 October 2026, the creator: "if we are two players, the scaling of the swimmers and incidents increases, and if
// we are three players, we increase again"). Up to three coaches on one shift, each a player online (net.mjs), out of six: Coach
// Waters, whom a single player always is, Coach Brooks, the senior coach (shorter, rounder, a grey moustache), Coach Rivers, and
// since 23 October 2026 Coach Storm (the tough coach: shaved head, tattoo sleeves), Coach Fontaine (an afro, no cap) and Coach
// Marsh (the grumpy one: round as Carl, bald, a scowl even at rest). Pure: the
// shift a crew plays is the solo shift with more of everything, made here from the shift's config before the simulation starts,
// so the host and every guest build the very same shift from the same config, seed and crew.

// The six coaches a player can be (the character select, coop-ui.mjs), in the order the carousel shows them. `model` is the
// file in dist/assets (coach-panic.glb is Coach Waters' file of old). A new coach goes at the end: a crew's default picks are
// the first free ones.
export const COACHES = [
  { id: "waters", name: "Coach Waters", short: "Waters", model: "coach-panic.glb", colour: "#ff6b3d" },
  { id: "brooks", name: "Coach Brooks", short: "Brooks", model: "coach-brooks.glb", colour: "#4fb3ff" },
  { id: "rivers", name: "Coach Rivers", short: "Rivers", model: "coach-rivers.glb", colour: "#ffd23d" },
  { id: "storm", name: "Coach Storm", short: "Storm", model: "coach-storm.glb", colour: "#9be33a" },
  {
    id: "fontaine",
    name: "Coach Fontaine",
    short: "Fontaine",
    model: "coach-fontaine.glb",
    colour: "#b07cff",
  },
  { id: "marsh", name: "Coach Marsh", short: "Marsh", model: "coach-marsh.glb", colour: "#1fbf8f" },
];
export const COACH_IDS = COACHES.map((c) => c.id);
export const MAX_CREW = 3;
export const coachInfo = (id) => COACHES.find((c) => c.id === id) || COACHES[0];

// What a crew of two or three adds, by crew size (index 0 is one coach: the shift as it is).
//  guests     the shift's swimmers, times this (more wet spots, poos and wees as they come; not many more: the lanes are what
//             holds a shift's guests, and an overfull lane makes its swimmers walk out, whoever is on the deck)
//  tips       how much more often a lap swimmer asks for a coaching tip (tips.mjs): the work for more hands
//  fins       how much more often a guest will not swim without fins: a little (the rack has its three pairs, crew or not, and a
//             queue waiting on fins that are all in the water only goes home)
//  incidents  the shift's planned incidents, times this (rounded; the extra ones in the later part of the shift)
//  together   how many incidents may run at once, more than the shift's own
//  stars      the star targets, times this: measured with crews of coach bots (crew-check.mjs), so a crew playing as well as the
//             solo bot plays stars about as often as it does
export const CREW = {
  guests: [1, 1.15, 1.3],
  tips: [1, 1.5, 1.9],
  fins: [1, 1.05, 1.1],
  incidents: [1, 1.6, 2.2],
  together: [0, 1, 1],
  stars: [1, 1.15, 1.2],
};

const round50 = (n) => Math.round(n / 50) * 50;

// The shift a crew of `size` plays: `config` (a level's, a week day's, a drill's) with more guests and incidents and higher star
// targets. A crew of one gets `config` itself, untouched.
export function crewConfig(config, size) {
  const n = Math.max(1, Math.min(MAX_CREW, Math.floor(size) || 1));
  if (n === 1 || !config) return config;
  const k = n - 1,
    out = { ...config, crewSize: n };
  if (config.total) out.total = Math.round(config.total * CREW.guests[k]);
  out.finBoost = (config.finBoost || 1) * CREW.fins[k];
  out.tipBoost = (config.tipBoost || 1) * CREW.tips[k];
  const chaos = config.chaos || [];
  if (chaos.length) {
    const want = Math.round(chaos.length * CREW.incidents[k]),
      kinds = [...new Set(chaos.flatMap((e) => e.kinds))],
      duration = config.duration || 120,
      extra = [];
    // The extra incidents: any kind the shift already has, one after another through the later part of the shift (the plan
    // waits for an incident of the same kind to be over before its next one starts: chaos.mjs).
    for (let i = 0; i < want - chaos.length; i++) {
      const from = chaos[i % chaos.length],
        mid = (from.window[0] + from.window[1]) / 2,
        at = Math.min(duration - 25, mid + duration * (0.18 + 0.12 * i)),
        span = Math.max(8, (from.window[1] - from.window[0]) / 2);
      extra.push({
        kinds,
        window: [Math.max(10, at - span), Math.max(12, Math.min(duration - 15, at + span))],
      });
    }
    out.chaos = [...chaos, ...extra];
  }
  out.maxChaos = (config.maxChaos || 1) + CREW.together[k];
  if (config.thresholds) out.thresholds = config.thresholds.map((t) => round50(t * CREW.stars[k]));
  return out;
}

// A crew as the simulation takes it (`options.crew`): one coach id per player, the host's first, known ids only, at most three,
// every id once (the character select keeps picks unique; a crew that comes in with a repeat gets the next free coach instead).
export function normalCrew(crew) {
  if (!Array.isArray(crew) || !crew.length) return ["waters"];
  const out = [];
  for (const id of crew.slice(0, MAX_CREW)) {
    const pick = COACH_IDS.includes(id) && !out.includes(id) ? id : COACH_IDS.find((c) => !out.includes(c));
    out.push(pick);
  }
  return out;
}
