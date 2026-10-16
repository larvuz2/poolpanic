// The week: Pool Panic's main loop (restructured on 16 October 2026, the creator's design). Coach Waters works six shifts, one a
// day from Monday to Saturday, to save up for a date with Marina on Sunday. Pure: no DOM, no storage of its own (the app hands
// the state in and saves what comes back), seeded, so a check can play it.
//
//   a RUN       weeks one after another, each harder than the last, for as long as the dates keep coming. A Sunday with too
//               little in the Date Fund ends the run: the next one starts again at week 1. The levels passed stay open in
//               free play (the map), like a level select.
//   a WEEK      six shifts and a date. Every shift's pay goes into the Date Fund, which only ever goes up; the goal (the date)
//               is on screen all week. A shift that is not passed pays nothing, but the week goes on.
//   a SHIFT     built when it is reached, never the same twice: a random level (one of the season's shifts, for its pool,
//               length, crowd and star targets) from a difficulty that rises with every shift of the run (`STEP`), and the
//               incident director's draw (which incidents, how many, when). The first shift of a run is a gentle minute. VIPs
//               come in every shift after it, more of them as the run goes on. Before a shift the player picks one of two or
//               three cards (a regular day, a booking that pays more for more trouble, a mystery), and Marina has two wishes,
//               small objectives that pay extra.
//   TIPS        the coach's pocket money, earned in every shift, spent in the shop between shifts on perks that last the week.
//               Spending tips never touches the Date Fund.

import { SHIFTS, MARCO, STAR_CHANCE } from "./sim.mjs";
import { BOOKINGS } from "./bookings.mjs";

export const WEEK_KEY = "pool-panic.week.v1";
export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DATE_DAY = "Sunday";
export const SHIFTS_PER_WEEK = DAYS.length;

// ---- the incident director -------------------------------------------------------------------------------------------

// The order in which the roaming incidents first surprise a player. Change it freely: the director only ever brings in the
// next one in this list, and only once the player has played a few shifts.
export const INCIDENT_ORDER = ["dog", "fish", "carl", "outage", "karen"];

// Every roaming incident the director can draw: how heavy it is (`cost`, what it takes from a shift's budget) and how often
// it comes (`weight`). All of them work in every pool.
export const INCIDENTS = {
  dog: { icon: "🐶", name: "Loose dog", cost: 2, weight: 3 },
  fish: { icon: "🐟", name: "Fish kid", cost: 3, weight: 3 },
  carl: { icon: "💣", name: "Cannonball man", cost: 3, weight: 3 },
  outage: { icon: "⚡", name: "Power outage", cost: 3, weight: 2 },
  karen: { icon: "😡", name: "Karen", cost: 2, weight: 2 },
};

// The mid-shift twists, and where each may happen.
export const TWIST_RULES = {
  rush: { weight: 3 },
  closure: { weight: 2 },
  team: { weight: 2 },
  class: { weight: 1, venues: ["club"] },
  storm: { weight: 3, venues: ["lagoon"], lighting: ["dusk", "golden"] },
};

// A small seeded random stream (the same numbers for the same seed, everywhere).
export function stream(seed) {
  // Scrambled first, so seeds next to each other (two weeks started a second apart) start far apart.
  let s = seed >>> 0;
  s = Math.imul(s ^ (s >>> 16), 2246822507) >>> 0;
  s = Math.imul(s ^ (s >>> 13), 3266489909) >>> 0;
  s = (s ^ (s >>> 16)) >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const pickWeighted = (random, items) => {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let roll = random() * total;
  for (const item of items) if ((roll -= item.weight) < 0) return item;
  return items[items.length - 1];
};

// ---- the weeks and their dates -----------------------------------------------------------------------------------------

// Each week of a run ends with a date, dearer as the run goes on, and pays more (`pay`, what a star is worth). The goal is what
// the date costs: six shifts at two stars with a wish or two make it with something to spare; two shifts failed do not.
export const BASE_GOAL = 300;
export const CHAPTERS = [
  { id: 1, date: { id: "icecream", icon: "🍦", name: "Ice cream on the pier" } },
  { id: 2, date: { id: "movie", icon: "🎬", name: "Movie night" } },
  { id: 3, date: { id: "dinner", icon: "🍝", name: "Dinner by the lagoon" } },
  { id: 4, date: { id: "ocean", icon: "🌊", name: "The ocean trip" } },
];
// After the fourth week the dates go round these, and the weeks keep getting harder.
export const HEAT_DATES = [
  { id: "picnic", icon: "🧺", name: "A picnic in the park" },
  { id: "concert", icon: "🎸", name: "A concert under the stars" },
  { id: "karaoke", icon: "🎤", name: "Karaoke night" },
  { id: "sailing", icon: "⛵", name: "A day on a sailboat" },
];
export function chapterFor(n) {
  const id = Math.max(1, Math.floor(n) || 1),
    heat = Math.max(0, id - CHAPTERS.length),
    pay = +(1 + 0.3 * (id - 1)).toFixed(2);
  return {
    id,
    heat,
    place: "the town's pools",
    date: id <= CHAPTERS.length ? CHAPTERS[id - 1].date : HEAT_DATES[(heat - 1) % HEAT_DATES.length],
    goal: Math.round((BASE_GOAL * pay) / 10) * 10,
    pay,
  };
}

// ---- the difficulty --------------------------------------------------------------------------------------------------

// A run's shifts in order, from 0 (week 1, Monday): what sets how hard a shift is.
export const stepOf = (week) => (week.chapter - 1) * SHIFTS_PER_WEEK + week.shift;
// The level a shift is built on: the first of a run is level 1, then a random one from a window that climbs a level a shift
// (step 6, week 2's Monday, is around level 7; step 19 reaches the last, the gala). Past it the gala's levels come round
// again, a little harder each time (`over`: how many shifts past the top).
export const TOP_TIER = SHIFTS.length;
export function tierFor(step, random) {
  if (step <= 0) return 1;
  const center = Math.min(TOP_TIER, 1 + step),
    lo = Math.max(2, center - 2),
    hi = Math.min(TOP_TIER, center + 1);
  return lo + Math.floor(random() * (hi - lo + 1));
}
export const overTop = (step) => Math.max(0, step - (TOP_TIER - 1));
// The first shift of a run: level 1 stretched to a gentle minute, easy to pass.
export const FIRST_SHIFT = { duration: 60, total: 7 };
// VIPs (a big tip, short patience) in every shift (the creator, 16 October 2026: "always"): one in the gentle first minute, two from
// the next, one more every three shifts (at most six).
export const vipCount = (step) => (step <= 0 ? 1 : Math.min(6, 2 + Math.floor(step / 3)));

// ---- the pools ---------------------------------------------------------------------------------------------------------

// Where Coach Waters works. A week sends him round them in a mix (the creator, 16 October 2026: "place 1, place 2, place 3, then
// place 1 again, then place 4, then place 2"): every pool at least once a week, never the same one two days running, in an order
// drawn for the week. How hard a shift is comes from the run (`tierFor`), not from the pool: a pool gives the shift its look, its
// crowd and its own trouble (Splash Park's trampoline, the lagoon's storm, the Aquatic Centre's star VIP), and the difficulty gives
// it its length, crowd size, star targets and incidents. `levels` are the season's levels in that pool (their looks are borrowed);
// `from` is the first week a pool is in the mix; `score` scales the star targets there (the coach bot's measure: a wide pool serves
// a crowd faster than the club's three lanes, a narrow one slower).
export const POOLS = {
  club: { name: "Community Pool", icon: "🏫", levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  resort: { name: "Splash Park", icon: "🌴", levels: [11, 12, 13, 14, 15, 16] },
  lagoon: { name: "Sunset Lagoon", icon: "🌅", levels: [17, 18, 19] },
  aquatic: {
    name: "Aquatic Centre",
    icon: "🏅",
    // A competitive pool: few beginners, nearly no aqua aerobics (none written in), mostly Intermediates and Pros, one more VIP
    // than anywhere else, and always Marco "the Missile".
    style: {
      venue: "aquatic",
      lighting: "aquatic",
      mix: [0.08, 0.52, 0.97],
      opening: ["intermediate", "advanced", "intermediate"],
      aqua: false,
      star: { ...MARCO, at: 0.4 },
    },
    events: [
      "Time trials",
      "Masters meet",
      "Relay night",
      "Club championships",
      "Qualifier heats",
      "Record attempt",
    ],
    vipBonus: 1,
    crowd: 0.8, // fewer swimmers than anywhere else, and faster: a crowd of lane swimmers fills five lanes quickly
    twists: { team: 3 }, // swim teams train here: more likely than elsewhere
  },
  // The Aqua Disco (16 October 2026): an aqua-aerobics class and nothing else, in zones of open water, dancing Valentina's routine
  // to the music; every incident still comes.
  disco: {
    name: "Aqua Disco",
    icon: "🪩",
    style: { venue: "disco", lighting: "disco", aqua: true },
    events: ["Aqua Disco night", "Glow class", "Retro hour", "Foam party", "Neon splash", "Latin fever"],
    twists: { team: 0, class: 0 }, // nobody swims laps here: no swim team; the whole shift is a class already
  },
  arena: { name: "Grand Gala Arena", icon: "🏟️", levels: [20], from: 3 },
};
export const POOL_IDS = Object.keys(POOLS);
// The pools of a week (the arena joins from week 3).
export const poolsOf = (chapter) => POOL_IDS.filter((id) => (POOLS[id].from || 1) <= chapter);

// The week's itinerary: one pool a day. Every pool of the week once, then the days left from the others, no pool two days running;
// the very first Monday of a run is the Community Pool (the gentle minute).
export function weekPools(chapter, seed) {
  const random = stream((seed ^ 0x51ed27) >>> 0),
    pools = poolsOf(chapter),
    shuffle = (list) => {
      const a = [...list];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
  let best = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    const extra = shuffle(pools).slice(0, Math.max(0, SHIFTS_PER_WEEK - pools.length));
    const days = shuffle([...pools, ...extra]).slice(0, SHIFTS_PER_WEEK);
    if (chapter === 1) {
      const i = days.indexOf("club");
      [days[0], days[i]] = [days[i], days[0]];
    }
    best = days;
    if (days.every((d, i) => i === 0 || d !== days[i - 1])) break;
  }
  return best;
}

// The look of a pool at a difficulty: the level of that pool whose own place in the season is nearest (Splash Park at an easy
// difficulty borrows Splash landing's daylight, at a hard one Midnight rush's night), or the pool's own style.
function poolLook(id, tier, random) {
  const pool = POOLS[id];
  if (pool.style) return { ...pool.style, label: pool.events[Math.floor(random() * pool.events.length)] };
  const level = pool.levels.reduce((a, b) => (Math.abs(b - tier) < Math.abs(a - tier) ? b : a));
  const L = SHIFTS[level - 1];
  return {
    venue: L.venue || "club",
    ...(L.lighting && { lighting: L.lighting }),
    ...(L.daylight && { daylight: L.daylight }),
    ...(L.mix && { mix: L.mix }),
    ...(L.jumpPatience && { jumpPatience: L.jumpPatience }),
    daredevilAt: L.daredevilAt || null,
    nativeTotal: L.total,
    nativeVips: (L.vipAt || []).length,
    label: L.name,
  };
}
// Spread `count` arrivals out of a level's list of fractions (the first, the last, and evenly between).
function pickFractions(list, count) {
  if (!list?.length || count <= 0) return null;
  if (count >= list.length) return list;
  if (count === 1) return [list[Math.floor(list.length / 2)]];
  return Array.from({ length: count }, (_, i) => list[Math.round((i * (list.length - 1)) / (count - 1))]);
}
// How the star targets scale in each pool against the season's own levels: 1 where a level was made for that floor plan (the
// club's three lanes for levels 1 to 10, the five-lane plan for 11 to 20). Measured with the coach bot against the pools' own
// levels (week-check.mjs keeps it in bounds): five lanes serve the club's crowds faster, three lanes serve the five-lane crowds
// slower, and the Aquatic Centre's crowd of lane swimmers is the hardest to keep moving.
export function scoreScale(venue, tier) {
  const scale = SCORE_SCALE[venue] || SCORE_SCALE.resort;
  return (scale.find(([upTo]) => tier <= upTo) || scale[scale.length - 1])[1];
}
const SCORE_SCALE = {
  club: [
    [10, 1],
    [20, 0.85],
  ],
  resort: [
    [10, 1.3],
    [20, 1],
  ],
  aquatic: [
    [10, 1.4],
    [13, 1],
    [20, 0.65],
  ],
  // A class of aqua dancers is the gentlest crowd in the game: the stars ask more of it (calibrated with the coach bot).
  disco: [
    [10, 1.65],
    [20, 1.3],
  ],
};

// ---- the shop --------------------------------------------------------------------------------------------------------

// What the coach can buy with tips, for the rest of the week. `sim` perks are read by the simulation (sim.mjs `perks`), the
// others by the week itself. `price` is in tips.
export const PERKS = {
  shoes: {
    icon: "👟",
    name: "Running shoes",
    text: "The coach runs 12% faster",
    price: 6,
    sim: { speed: 1.12 },
  },
  whistle: { icon: "📯", name: "Turbo whistle", text: "Dash again 40% sooner", price: 5, sim: { dash: 0.6 } },
  benches: {
    icon: "⛱️",
    name: "Shady benches",
    text: "The queue waits 25% longer",
    price: 7,
    sim: { patience: 1.25 },
  },
  stretch: {
    icon: "🧘",
    name: "Stretching poster",
    text: "Half as many cramps",
    price: 6,
    sim: { cramp: 0.5 },
  },
  tummy: {
    icon: "🔔",
    name: "Tummy alarm",
    text: "4 more seconds to send a queasy swimmer home",
    price: 5,
    sim: { warning: 4 },
  },
  megaphone: {
    icon: "📣",
    name: "Megaphone",
    text: "Every swim scores 10% more",
    price: 8,
    sim: { score: 1.1 },
  },
  nodogs: {
    icon: "🚫",
    name: "No dogs sign",
    text: "The loose dog comes far less",
    price: 4,
    director: { dog: 0.25 },
  },
  nobombs: {
    icon: "🪧",
    name: "No bombs sign",
    text: "The cannonball man comes far less",
    price: 4,
    director: { carl: 0.25 },
  },
  tipjar: { icon: "🫙", name: "Tip jar", text: "50% more tips from every shift", price: 5, tips: 1.5 },
  charm: {
    icon: "💐",
    name: "Lucky charm from Marina",
    text: "Marina's wishes pay 50% more",
    price: 6,
    wishes: 1.5,
  },
  sponsor: {
    icon: "🤝",
    name: "Local sponsor",
    text: "+$15 for the date after every shift",
    price: 9,
    sponsor: 15,
  },
  insurance: {
    icon: "🛟",
    name: "Safety net",
    text: "A failed shift still pays half",
    price: 8,
    insurance: true,
  },
};
export const REROLL_PRICE = 2;
export const SHOP_SIZE = 3;

// What the perks bought this week add up to: the simulation's multipliers, the director's weights and the week's own rules.
export function perkEffects(owned = []) {
  const sim = { speed: 1, dash: 1, patience: 1, cramp: 1, warning: 0, score: 1 },
    director = {};
  let tips = 1,
    wishes = 1,
    sponsor = 0,
    insurance = false;
  for (const id of owned) {
    const p = PERKS[id];
    if (!p) continue;
    for (const [k, v] of Object.entries(p.sim || {})) sim[k] = k === "warning" ? sim[k] + v : sim[k] * v;
    for (const [k, v] of Object.entries(p.director || {})) director[k] = (director[k] ?? 1) * v;
    tips *= p.tips || 1;
    wishes *= p.wishes || 1;
    sponsor += p.sponsor || 0;
    insurance ||= !!p.insurance;
  }
  return { sim, director, tips, wishes, sponsor, insurance };
}

// Three perks the coach does not have yet, from a seeded draw (`roll` counts rerolls so each gives a new hand).
export function shopOffer(week, roll = 0) {
  const random = stream(
    (week.seed ^ Math.imul(week.shift + 1, 2246822519) ^ Math.imul(roll + 1, 3266489917)) >>> 0,
  );
  const pool = Object.keys(PERKS).filter((id) => !week.perks.includes(id));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, SHOP_SIZE);
}

// ---- Marina's wishes (the objectives of a shift) ---------------------------------------------------------------------

// Each wish is something Marina texts before a shift and checks after it. `fits` says whether a shift can have it at all;
// `goal` makes its target for that shift; `met` reads the shift's summary (sim.summary() plus sim.stats).
export const WISHES = {
  smiles: {
    icon: "😊",
    text: (n) => `Make ${n} swimmers happy`,
    say: "Make people smile today! 😊",
    goal: (s) => Math.max(3, Math.round(s.total * 0.45)),
    met: (r, n) => r.happy >= n,
    pay: 15,
  },
  nobody: {
    icon: "🙅",
    text: () => "Nobody storms off",
    say: "Don't let anyone leave grumpy 🥺",
    fits: (s) => s.total >= 6,
    met: (r) => r.lost === 0,
    pay: 20,
  },
  streak: {
    icon: "✨",
    text: (n) => `A happy streak of ${n}`,
    say: "Keep a happy streak going ✨",
    goal: (s) => Math.min(8, Math.max(3, Math.round(s.total * 0.25))),
    met: (r, n) => r.bestStreak >= n,
    pay: 15,
  },
  twostars: {
    icon: "⭐",
    text: () => "Earn ★★ or better",
    say: "Two stars and I'll be impressed ⭐",
    met: (r) => r.stars >= 2,
    pay: 20,
  },
  perfect: {
    icon: "🌟",
    text: () => "A perfect ★★★ shift",
    say: "Three stars? You'd be my hero 🌟",
    fits: (s) => s.index >= 2,
    met: (r) => r.stars >= 3,
    pay: 40,
  },
  smooth: {
    icon: "🏊",
    text: () => "No collisions in the lanes",
    say: "No bumping into each other! 🏊",
    fits: (s) => s.total >= 6,
    met: (r) => r.collisions === 0,
    pay: 20,
  },
  quick: {
    icon: "⏱️",
    text: (n) => `Average wait under ${n} s`,
    say: "Nobody likes waiting ⏱️",
    goal: (s) => (s.tier >= 8 ? 14 : 12),
    met: (r, n) => r.avgWait <= n,
    pay: 15,
  },
  mood: {
    icon: "💛",
    text: (n) => `Average mood ${n}% or more`,
    say: "Happy pool, happy me 💛",
    goal: (s) => (s.tier >= 10 ? 70 : 75),
    met: (r, n) => r.avgHappiness >= n,
    pay: 15,
  },
  saves: {
    icon: "🛡️",
    text: () => "Stop trouble before it starts",
    say: "Catch trouble early, my hero 🛡️",
    fits: (s) => s.incidents.length > 0,
    met: (r, n, st) => (st.prevented || 0) >= 1,
    pay: 25,
  },
  clean: {
    icon: "💧",
    text: () => "Keep the water clean",
    say: "Please, no accidents in the pool 💧",
    fits: (s) => s.tier >= 3,
    met: (r) => (r.catastrophes || 0) === 0,
    pay: 15,
  },
  vips: {
    icon: "👑",
    text: (n) => `Serve ${n} VIP${n > 1 ? "s" : ""}`,
    say: "Treat the VIPs like royalty 👑",
    fits: (s) => s.vips > 0,
    goal: (s) => s.vips,
    met: (r, n, st) => (st.vips || 0) >= n,
    pay: 30,
  },
  flips: {
    icon: "🤸",
    text: (n) => `${n} clean trampoline flip${n > 1 ? "s" : ""}`,
    say: "Show me some flips! 🤸",
    fits: (s) => s.daredevils > 0,
    goal: (s) => Math.max(1, Math.min(3, s.daredevils - 1)),
    met: (r, n, st) => (st.flips || 0) >= n,
    pay: 25,
  },
};
export const WISHES_PER_SHIFT = 2;

// The wishes of one shift: two that fit it, drawn from its seed. Each says its target and what it pays.
export function drawWishes(shape, random, payScale = 1) {
  const fitting = Object.entries(WISHES).filter(([, w]) => !w.fits || w.fits(shape));
  for (let i = fitting.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [fitting[i], fitting[j]] = [fitting[j], fitting[i]];
  }
  return fitting.slice(0, WISHES_PER_SHIFT).map(([id, w]) => {
    const target = w.goal ? w.goal(shape) : 0;
    return { id, icon: w.icon, text: w.text(target), say: w.say, target, pay: roundPay(w.pay * payScale) };
  });
}
export function checkWishes(wishes, summary, stats = {}) {
  return wishes.map((w) => ({ ...w, met: !!WISHES[w.id]?.met(summary, w.target, stats) }));
}

// ---- building a shift -------------------------------------------------------------------------------------------------

const roundPay = (n) => Math.max(5, Math.round(n / 5) * 5);
// The director's draw for one shift. `known` are the incidents the player has met; one that is not yet known may come as a
// surprise (`surprise`). `extraBudget` is the mystery card's. Returns { chaos, twist, incidents, surprise }.
export function directShift({
  blueprint,
  venue,
  random,
  known = [],
  index = 0,
  heat = 0,
  extraBudget = 0,
  weights = {},
  twistWeights = {},
  surprised = false,
}) {
  const slots = (blueprint.chaos || []).length;
  // Gentle at first: the first shifts of the first week have nothing, then the count follows the blueprint, with a little
  // give either way so a player cannot count on it.
  let count = slots;
  if (slots > 0) count = Math.max(1, slots + (random() < 0.3 ? -1 : random() < 0.35 ? 1 : 0));
  count = Math.min(slots + heat + 1, count + extraBudget + heat);
  // A surprise: the next incident in the order, once the player has a few shifts behind them, never two in a row.
  const next = INCIDENT_ORDER.find((k) => !known.includes(k));
  const roll = random();
  const surprise = next && index >= 3 && !surprised && (roll < 0.55 || extraBudget > 0) ? next : null;
  if (surprise && count === 0) count = 1;
  const pool = INCIDENT_ORDER.filter((k) => known.includes(k)).map((k) => ({
    kind: k,
    weight: INCIDENTS[k].weight * (weights[k] ?? 1),
  }));
  const kinds = [];
  if (surprise) kinds.push(surprise);
  while (kinds.length < count && pool.length) {
    const last = kinds[kinds.length - 1];
    const choice = pickWeighted(
      random,
      pool.map((p) => ({ ...p, weight: p.kind === last ? p.weight * 0.25 : p.weight })),
    );
    kinds.push(choice.kind);
  }
  // Spread them over the shift (never in its last 20 s), in a random order, each in its own window.
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  const start = Math.max(12, blueprint.duration * 0.14),
    end = blueprint.duration - 22,
    span = Math.max(1, (end - start) / Math.max(1, kinds.length));
  const chaos = kinds.map((kind, i) => {
    const a = start + i * span + random() * span * 0.25;
    return { kinds: [kind], window: [Math.round(a + span * 0.05), Math.round(a + span * 0.7)] };
  });
  // Twists: as many as the blueprint had, of kinds this pool allows, at random moments.
  const allowed = Object.entries(TWIST_RULES)
    .filter(([, r]) => !r.venues || r.venues.includes(venue))
    .filter(([, r]) => !r.lighting || r.lighting.includes(blueprint.lighting))
    .map(([kind, r]) => ({ kind, weight: r.weight * (twistWeights[kind] ?? 1) }))
    .filter((t) => t.weight > 0);
  const twistCount = (blueprint.twist || []).length + (heat > 1 && random() < 0.5 ? 1 : 0);
  const twist = [];
  for (let i = 0; i < twistCount && allowed.length; i++) {
    const options = allowed.filter((t) => !twist.some((x) => x.kind === t.kind));
    if (!options.length) break;
    const t = pickWeighted(random, options);
    twist.push({
      kind: t.kind,
      at: +(0.25 + (0.5 * (i + random())) / twistCount).toFixed(2),
      ...(t.kind === "rush" && { count: blueprint.total >= 24 ? 5 : 3 }),
    });
  }
  twist.sort((a, b) => a.at - b.at);
  return { chaos, twist, incidents: [...new Set(kinds)], surprise };
}

// The cards offered before a shift: a regular day, a booking (more trouble, better pay) once a few shifts are behind, and a
// mystery once the week is under way. A booking is only offered when its trouble is known.
export function shiftCards(index, random, known = [], blueprint = {}) {
  const cards = [
    { id: "regular", icon: "🏊", name: "Regular day", note: "Just a normal shift", payout: 1, danger: 1 },
  ];
  if (index >= 2) {
    const fixedLight =
      blueprint.daylight ||
      ["arena", "aquatic", "disco"].includes(blueprint.venue) ||
      blueprint.lighting === "night";
    const bookings = Object.values(BOOKINGS).filter(
      (b) =>
        b.id !== "regular" &&
        !(b.lighting && fixedLight) &&
        (b.chaos || []).every((c) => c.kinds.every((k) => known.includes(k))),
    );
    if (bookings.length) {
      const b = bookings[Math.floor(random() * bookings.length)];
      cards.push({
        id: b.id,
        booking: b.id,
        icon: b.icon,
        name: b.name,
        note: b.note,
        payout: b.payout,
        danger: 2,
      });
    }
  }
  if (index >= 4 && random() < 0.7)
    cards.push({
      id: "mystery",
      icon: "🎲",
      name: "Mystery gig",
      note: "Who knows what walks in? Pays well",
      payout: 1.3,
      danger: 3,
      mystery: true,
    });
  return cards;
}

// VIP arrivals for a shift (fractions of the arrivals, as SHIFTS' `vipAt`), spread over it and kept clear of the first ones.
function vipSlots(count, random) {
  const at = [];
  for (let k = 0; k < count; k++) at.push(+(0.12 + (0.8 * (k + 0.2 + random() * 0.6)) / count).toFixed(2));
  return at;
}

// One shift of the week: everything the game needs to play it. `card` is the card picked (or null for the first look).
export function buildShift(week, card = null, known = week.known || []) {
  const chapter = chapterFor(week.chapter),
    index = week.shift,
    step = stepOf(week),
    random = stream((week.seed ^ Math.imul(index + 1, 2654435761)) >>> 0),
    tier = tierFor(step, stream((week.seed ^ Math.imul(step + 11, 2246822519)) >>> 0)),
    over = overTop(step),
    // Past the top level: a little more crowd and higher targets for every shift beyond it (at most half as much again).
    f = Math.min(1.5, 1 + 0.03 * over),
    heat = over > 0 ? 1 + Math.floor(over / SHIFTS_PER_WEEK) : 0;
  // The day's pool, and the shift: the difficulty's level for its length, crowd, star targets and the number of incidents and twists,
  // in the pool's look.
  const poolId = (week.pools || weekPools(week.chapter, week.seed))[index] || "club",
    pool = POOLS[poolId],
    look = poolLook(poolId, tier, stream((week.seed ^ Math.imul(index + 5, 1597334677)) >>> 0)),
    ref = SHIFTS[tier - 1],
    crowd = pool.crowd || 1,
    k = scoreScale(look.venue, tier) * crowd;
  let blueprint = {
    name: ref.name,
    duration: ref.duration,
    total: Math.max(4, Math.round(ref.total * crowd)),
    thresholds: ref.thresholds.map((t) => Math.round((t * k) / 50) * 50),
    ...(ref.finChance !== undefined && { finChance: ref.finChance }),
    ...(ref.chaos && { chaos: ref.chaos }),
    ...(ref.twist && { twist: ref.twist }),
    ...(ref.maxChaos && { maxChaos: ref.maxChaos }),
    venue: look.venue,
    ...(look.lighting && { lighting: look.lighting }),
    ...(look.daylight && { daylight: look.daylight }),
    ...(look.mix && { mix: look.mix }),
    ...(look.jumpPatience && { jumpPatience: look.jumpPatience }),
    ...(look.opening && { opening: look.opening }),
    ...(look.aqua === false && { aqua: false }),
  };
  // Marco "the Missile": always at the Aquatic Centre, and in more than half the shifts of every other pool (`STAR_CHANCE`), at a
  // moment of his own.
  const starRoll = stream((week.seed ^ Math.imul(index + 9, 2654435789)) >>> 0);
  if (look.star) blueprint.star = look.star;
  else if (starRoll() < STAR_CHANCE) blueprint.star = { ...MARCO, at: +(0.25 + starRoll() * 0.4).toFixed(2) };
  // Daredevils (Splash Park and the five-lane pools after it): as many as the pool's level has, for its crowd (one at least).
  if (look.daredevilAt) {
    const count = Math.max(1, Math.round((look.daredevilAt.length * ref.total) / look.nativeTotal));
    blueprint.daredevilAt = pickFractions(look.daredevilAt, Math.min(count, look.daredevilAt.length));
  }
  if (step <= 0) {
    // The gentle minute: level 1 stretched, the same number of swimmers a minute, the star targets in proportion, and an easy
    // line (no aqua guest standing in a lane).
    const k = FIRST_SHIFT.duration / blueprint.duration;
    blueprint = {
      ...blueprint,
      duration: FIRST_SHIFT.duration,
      total: FIRST_SHIFT.total,
      thresholds: blueprint.thresholds.map((t) => Math.round((t * k) / 50) * 50),
      opening: ["beginner", "intermediate", "beginner"],
      aqua: false,
    };
  } else if (f > 1)
    blueprint = {
      ...blueprint,
      total: Math.round(blueprint.total * f),
      thresholds: blueprint.thresholds.map((t) => Math.round((t * f) / 50) * 50),
    };
  const cards = shiftCards(step, stream((week.seed ^ Math.imul(index + 7, 40503)) >>> 0), known, blueprint);
  const chosen = (card && cards.find((c) => c.id === card)) || null;
  const effects = perkEffects(week.perks);
  const plan = directShift({
    blueprint,
    venue: blueprint.venue,
    random,
    known,
    index: step,
    heat,
    extraBudget: chosen?.mystery ? 1 : 0,
    weights: effects.director,
    twistWeights: pool.twists,
    surprised: !!week.history[week.history.length - 1]?.surprise,
  });
  const { chaos: _c, twist: _t, intro: _i, booking: _b, payout: _p, ...rest } = blueprint;
  // VIPs: the run's count (none in the first shift), the lagoon's and arena's own share of their crowd, and the pool's extra.
  const nativeVips = look.nativeVips ? Math.round((look.nativeVips * rest.total) / look.nativeTotal) : 0,
    vips = Math.min(7, Math.max(vipCount(step), nativeVips) + (step <= 0 ? 0 : pool.vipBonus || 0));
  const config = {
    ...rest,
    name: pool.name, // under the HUD's "WEEK 1 · MON · 1/6", and on the countdown
    day: DAYS[index],
    pool: poolId,
    place: pool.name,
    label: look.label,
    chaos: plan.chaos,
    twist: plan.twist,
    ...(vips > 0 && { vipAt: vipSlots(vips, random) }),
    ...(chosen?.mystery && { payout: 1.15 }),
    week: { chapter: week.chapter, shift: index },
  };
  if (plan.surprise) config.intro = plan.surprise;
  const shape = {
    index: step,
    tier,
    total: config.total,
    incidents: plan.incidents,
    vips: (config.vipAt || []).length,
    daredevils: (config.daredevilAt || []).length,
  };
  const wishes = drawWishes(shape, stream((week.seed ^ Math.imul(index + 3, 362437)) >>> 0), chapter.pay);
  return {
    index,
    step,
    day: DAYS[index],
    pool: poolId,
    place: pool.name,
    icon: pool.icon,
    label: look.label,
    tier,
    chapter,
    config,
    booking: chosen?.booking || null,
    cards,
    card: chosen,
    wishes,
    plan,
    pass: passMark(config),
    perks: effects.sim,
  };
}

// ---- the week's state --------------------------------------------------------------------------------------------------

export const PAY = { base: 15, star: 15 };
// A shift is passed when its score reaches the pass mark, half of its first star: below it the pool was a mess and the shift
// pays nothing (the week goes on). It is on screen before the shift and in the HUD during it.
export const PASS_SHARE = 0.5;
export const passMark = (config) => Math.max(50, Math.round((config.thresholds[0] * PASS_SHARE) / 50) * 50);

// What a shift pays into the Date Fund: a little for finishing, more for each star, by the chapter and the card.
export function shiftPay(stars, chapter, card) {
  if (stars < 0) return 0;
  return roundPay((PAY.base + PAY.star * Math.min(3, stars)) * chapter.pay * (card?.payout || 1));
}
// Tips: pocket money for the shop.
export function shiftTips(stars, summary = {}, stats = {}, wishesMet = 0, multiplier = 1) {
  const raw = 2 + stars + Math.min(3, stats.prevented || 0) + wishesMet;
  return Math.round(raw * multiplier);
}

export function newWeek(save, seed = Date.now()) {
  return {
    chapter: save.chapter,
    seed: seed >>> 0 || 1,
    pools: weekPools(save.chapter, seed >>> 0 || 1),
    shift: 0,
    fund: 0,
    tips: 0,
    perks: [],
    rolls: 0,
    history: [],
    status: "playing", // "playing" | "won" | "lost"
  };
}

// The save: which week of the run the player is on, what they have discovered, the dates of the run, the week in progress,
// and the levels the run has opened in free play (`unlocked`: every level up to it, never less than 1).
export function normalizeWeekSave(saved = {}) {
  const s = saved && typeof saved === "object" ? saved : {};
  const known = Array.isArray(s.known) ? s.known.filter((k) => INCIDENTS[k]) : [];
  const dates = Array.isArray(s.dates) ? s.dates.filter((d) => typeof d === "string" && d.length < 40) : [];
  const chapter = Math.max(1, Math.min(999, Math.floor(Number(s.chapter)) || 1));
  const count = (v, max = 1e6) => Math.max(0, Math.min(max, Math.floor(Number(v)) || 0));
  let week = null;
  const w = s.week;
  // A week saved by the old ten-shift version (two shifts a day) is not carried over: its shifts do not fit six days.
  if (w && typeof w === "object" && w.status === "playing" && s.v === 2) {
    const seed = count(w.seed, 4294967295) || 1;
    week = {
      chapter,
      seed,
      pools: weekPools(chapter, seed), // (drawn again from the seed, never read from the save)
      shift: count(w.shift, SHIFTS_PER_WEEK - 1),
      fund: count(w.fund),
      tips: count(w.tips, 1e4),
      perks: Array.isArray(w.perks) ? [...new Set(w.perks.filter((p) => PERKS[p]))] : [],
      rolls: count(w.rolls, 1e4),
      history: Array.isArray(w.history) ? w.history.slice(0, SHIFTS_PER_WEEK) : [],
      status: "playing",
    };
  }
  return {
    v: 2,
    chapter: s.v === 2 ? chapter : 1,
    known: [...new Set(known)],
    dates: s.v === 2 ? dates : [],
    runs: count(s.runs ?? s.weeksLost),
    bestWeek: Math.max(1, count(s.bestWeek, 999) || 1),
    bestFund: count(s.bestFund),
    unlocked: Math.max(1, Math.min(TOP_TIER, count(s.unlocked, TOP_TIER) || 1)),
    invited: Array.isArray(s.invited)
      ? s.invited.filter((n) => Number.isInteger(n) && n > 0).slice(-100)
      : [],
    week,
  };
}

// A shift is over. Returns what happened (for the results screen) and changes `save` (and its week) in place:
//   failed   below the pass mark: it pays nothing (half with the safety net), and the week goes on
//   last     Saturday's shift: Sunday decides. `won` when the Date Fund reached the goal (a date, and the next week), else
//            `over`: the run is lost and the next one starts again at week 1
// A level passed opens in free play, with every level below it.
export function finishShift(save, shift, summary, stats = {}) {
  const week = save.week,
    chapter = chapterFor(week.chapter),
    effects = perkEffects(week.perks),
    stars = summary.stars || 0,
    pass = passMark(shift.config),
    passed = (summary.score || 0) >= pass;
  const wishes = checkWishes(shift.wishes, summary, stats);
  for (const k of shift.plan.incidents) if (!save.known.includes(k)) save.known.push(k);
  const insured = !passed && effects.insurance;
  const failed = !passed;
  const unlockedBefore = save.unlocked;
  if (passed) save.unlocked = Math.max(save.unlocked, Math.min(TOP_TIER, shift.tier));
  const pay = passed
      ? shiftPay(stars, chapter, shift.card)
      : insured
        ? roundPay(shiftPay(1, chapter, shift.card) / 2)
        : 0,
    wishPay = failed
      ? 0
      : wishes.filter((w) => w.met).reduce((sum, w) => sum + roundPay(w.pay * effects.wishes), 0),
    sponsor = passed ? effects.sponsor : 0,
    gained = pay + wishPay + sponsor,
    tips = shiftTips(stars, summary, stats, failed ? 0 : wishes.filter((w) => w.met).length, effects.tips);
  const before = week.fund;
  week.fund += gained;
  week.tips += tips;
  week.history.push({
    stars,
    score: Math.round(summary.score || 0),
    passed,
    gained,
    wishes: wishes.filter((w) => w.met).length,
    surprise: shift.plan.surprise || null,
  });
  const last = week.shift >= SHIFTS_PER_WEEK - 1;
  const result = {
    stars,
    pass,
    passed,
    pay,
    wishPay,
    sponsor,
    gained,
    tips,
    wishes,
    insured,
    failed,
    before,
    fund: week.fund,
    goal: chapter.goal,
    last,
    won: false,
    over: false,
    chapter,
    step: shift.step,
    tier: shift.tier,
    unlocked: save.unlocked > unlockedBefore ? save.unlocked : 0,
    surprise: shift.plan.surprise,
  };
  if (last) {
    result.won = week.fund >= chapter.goal;
    result.over = !result.won;
    week.status = result.won ? "won" : "lost";
    if (result.won) {
      save.dates.push(chapter.date.id);
      save.chapter = week.chapter + 1;
      save.bestWeek = Math.max(save.bestWeek, save.chapter);
    } else {
      // Game over: the run starts again at week 1 (what was discovered and the levels opened stay).
      save.runs++;
      save.chapter = 1;
      save.dates = [];
    }
  } else {
    week.shift++;
    week.rolls = 0;
  }
  save.bestFund = Math.max(save.bestFund, week.fund);
  if (week.status !== "playing") save.week = null;
  return result;
}

// Where the week stands against its goal, for the Date Fund bar: how far, and whether the pace will make it.
export function outlook(week) {
  const chapter = chapterFor(week.chapter),
    played = week.shift,
    left = SHIFTS_PER_WEEK - played,
    share = Math.min(1, week.fund / chapter.goal),
    need = Math.max(0, chapter.goal - week.fund),
    perShift = left > 0 ? need / left : need;
  // A two-star shift on a regular card, with one of Marina's wishes, is the "on track" pace.
  const pace = shiftPay(2, chapter, null) + roundPay(20 * chapter.pay);
  return {
    share,
    need,
    left,
    perShift: Math.ceil(perShift),
    onTrack: need === 0 || perShift <= pace,
    reached: need === 0,
  };
}

// Buying: tips go down, the perk is the week's. Never touches the Date Fund.
export function buyPerk(week, id) {
  const p = PERKS[id];
  if (!p || week.perks.includes(id) || week.tips < p.price) return false;
  week.tips -= p.price;
  week.perks.push(id);
  return true;
}
export function reroll(week) {
  if (week.tips < REROLL_PRICE) return false;
  week.tips -= REROLL_PRICE;
  week.rolls++;
  return true;
}

// Marina's texts as the Date Fund fills (a share of the goal passed by this shift).
export const MARINA_TEXTS = [
  { at: 0.25, text: "A quarter of the way! I'm already picking an outfit 👗" },
  { at: 0.5, text: "Halfway there! I can't wait for the weekend 💕" },
  { at: 0.75, text: "Almost! Don't let a fish ruin it now 🐟😅" },
  { at: 1, text: "You did it! It's a date this weekend 💖" },
];
export const textsPassed = (before, after, goal) =>
  MARINA_TEXTS.filter((m) => before / goal < m.at && after / goal >= m.at);
