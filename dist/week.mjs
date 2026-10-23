// The week: Pool Panic's main loop (restructured on 16 October 2026, the creator's design). Coach Waters works six shifts, one a
// day from Monday to Saturday, to save up for a date with Marina on Sunday. Pure: no DOM, no storage of its own (the app hands
// the state in and saves what comes back), seeded, so a check can play it.
//
//   a RUN       weeks one after another, each harder than the last, for as long as the dates keep coming. A Sunday with too
//               little in the Date Fund ends the run: the next one starts again at week 1. The levels passed stay open in
//               free play (the map), like a level select. Week 4 ends with the season finale at the Grand Gala Arena and,
//               with the ocean trip, the story's ending; the run goes on after it, endless (Phase 2, 19 October 2026).
//   a WEEK      six shifts and a date, at the pools the player has opened (`LADDER`). Every shift's pay goes into the Date
//               Fund; the goal (the date) is on screen all week. A shift that is not passed pays nothing, but the week goes on.
//   a SHIFT     built when it is reached, never the same twice: a random level (one of the season's shifts, for its length,
//               crowd and incidents) from the week's band (`tierFor`: difficulty by week), and the incident director's draw
//               (which incidents, how many, when). The first shift of a run is a gentle minute. VIPs come in every shift after
//               it, more of them as the run goes on. Before a shift the player picks one of two or three cards (a regular day,
//               a booking that pays more for more trouble, a mystery), and Marina has two wishes, small objectives that pay extra.
//   ONE MONEY   the shop between shifts sells perks for the rest of the week, paid out of the Date Fund (Phase 2: one money,
//               the creator's choice): spend now to earn more, or save for the date.
//   FOR GOOD    what a run leaves behind (`normalizeWeekSave`): the pools opened (one more with every date), the dates had (the
//               album), the stars earned (they open the coach's gear, `GEAR`), the best stars at each pool, the story's ending.

import { SHIFTS, MARCO, STAR_CHANCE } from "./sim.mjs";
import { VENUES } from "./spatial.mjs";
import { BOOKINGS } from "./bookings.mjs";
import { planBig } from "./big-moment.mjs";

export const WEEK_KEY = "pool-panic.week.v1";
export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DATE_DAY = "Sunday";
export const SHIFTS_PER_WEEK = DAYS.length;

// ---- the incident director -------------------------------------------------------------------------------------------

// The order in which the roaming incidents first surprise a player. Change it freely: the director brings in the next one in
// this list each shift from the first Tuesday (the creator, 17 October 2026: "I never got Karen, I never got the cannonballs…
// make sure that we have a fair mix"), so a new player has met all five by the end of the first week.
export const INCIDENT_ORDER = ["dog", "fish", "carl", "outage", "karen"];

// Every roaming incident the director can draw: how heavy it is (`cost`, what it takes from a shift's budget) and how often
// it comes (`weight`: the same for all five since 17 October 2026, a fair mix). All of them work in every pool.
export const INCIDENTS = {
  dog: { icon: "🐶", name: "Loose dog", cost: 2, weight: 3 },
  fish: { icon: "🐟", name: "Fish kid", cost: 3, weight: 3 },
  carl: { icon: "💣", name: "Cannonball man", cost: 3, weight: 3 },
  outage: { icon: "⚡", name: "Power outage", cost: 3, weight: 3 },
  karen: { icon: "😡", name: "Karen", cost: 2, weight: 3 },
};
// The incidents only some pools have, because they need something there (23 October 2026): the massage needs a massage table
// (incidents/massage.mjs; the venues with one: spatial.mjs). The director draws one like any other incident where the pool
// has what it needs, from the very first shift it can come in (no surprise to wait for: the table is there to see), and never
// elsewhere. They are not in INCIDENT_ORDER (the five every pool has, met in week 1).
export const VENUE_INCIDENTS = {
  massage: {
    icon: "💆",
    name: "Massage",
    cost: 2,
    weight: 3,
    where: (venue) => !!VENUES[venue]?.fixtures?.massage,
  },
};
// A fair mix: an incident that came in the last shift is less likely in this one, and one from the shift before a little less
// (never ruled out: the same one two shifts running still happens, the creator wants that), and one already drawn for this shift
// is much less likely to come twice in it.
export const RECENT = { last: 0.4, before: 0.7, again: 0.2 };

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
// the date costs (`GOAL_SHARE` of six shifts' worth of pay).
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
// How much of a week's pay its date asks (Phase 2, tuned 19 October 2026 with the coach bots playing whole runs, no shopping): week
// 1 is a learner's week (a careful beginner makes it about half the time, a good coach on Thursday); from week 2 a good coach ends
// Saturday at about 1.1 to 1.3 times the goal, with something to spend in the shop; from week 7 the goal grows slower than the
// pay, and the weeks get harder through their crowds and trouble instead.
export const GOAL_SHARE = [0.8, 1.08, 1.08, 1.08, 1.04, 1.04, 1];
export function chapterFor(n) {
  const id = Math.max(1, Math.floor(n) || 1),
    heat = Math.max(0, id - CHAPTERS.length),
    pay = +(1 + 0.3 * (id - 1)).toFixed(2),
    share = GOAL_SHARE[Math.min(GOAL_SHARE.length, id) - 1];
  return {
    id,
    heat,
    place: "the town's pools",
    date: id <= CHAPTERS.length ? CHAPTERS[id - 1].date : HEAT_DATES[(heat - 1) % HEAT_DATES.length],
    goal: Math.round((BASE_GOAL * pay * share) / 10) * 10,
    pay,
  };
}

// ---- the difficulty --------------------------------------------------------------------------------------------------

// A run's shifts in order, from 0 (week 1, Monday): the run's clock (VIPs, the cards and the director read it).
export const stepOf = (week) => (week.chapter - 1) * SHIFTS_PER_WEEK + week.shift;
// Difficulty by week (Phase 2, 19 October 2026; until then it climbed a level every shift and hit a wall in week 4): each week has
// a band of levels (`WEEK_BANDS`, the levels' length, crowd and incidents), Monday at its foot and Saturday at its top, a level
// either way at random. The run's very first shift is level 1 (the gentle minute). Past the last band the weeks stay at the hardest
// levels and grow instead (`heatOf`: bigger crowds, higher targets, more incidents).
export const TOP_TIER = SHIFTS.length;
export const WEEK_BANDS = [
  [2, 5],
  [4, 8],
  [6, 11],
  [9, 14],
  [11, 16],
  [13, 18],
  [15, 20],
  [17, 20],
];
export const bandOf = (chapter) =>
  WEEK_BANDS[Math.min(WEEK_BANDS.length, Math.max(1, Math.floor(chapter) || 1)) - 1];
export function tierFor(chapter, day, random) {
  if (chapter <= 1 && day <= 0) return 1;
  const [lo, hi] = bandOf(chapter),
    centre = lo + ((hi - lo) * Math.max(0, Math.min(SHIFTS_PER_WEEK - 1, day))) / (SHIFTS_PER_WEEK - 1),
    roll = random();
  return Math.max(lo, Math.min(hi, Math.round(centre + (roll < 0.25 ? -1 : roll < 0.75 ? 0 : 1))));
}
// How far a week is past the last band (0 until then): each week past it, a bigger crowd and higher targets, and more trouble.
export const heatOf = (chapter) => Math.max(0, Math.floor(chapter) - WEEK_BANDS.length);
// The star targets of each level, smoothed across the season (Phase 2): measured with the expert coach bot in all thirteen pools,
// the season's levels were jagged (a dip at 8 and 10, a jump at 11 where the five-lane levels begin, a wall at 17, 19 and 20).
// Each level's targets are scaled so the same coach makes a little less of them level after level, with no step.
// (Measured 19 October 2026 in two rounds of 78 shifts a level, 6 in each pool, the second in the weeks each level comes in: the
// expert's share of the two-star target now goes from about 1.6 at level 2 to 1.15 at level 20, close to a straight line.)
const TIER_SCALE = [
  1, 1.2, 0.95, 0.75, 0.85, 0.95, 1, 0.85, 0.85, 0.7, 1.35, 1.15, 0.95, 1.05, 0.95, 0.85, 0.7, 0.8, 0.6, 0.6,
];
export const tierScale = (tier) => TIER_SCALE[Math.max(1, Math.min(TOP_TIER, Math.floor(tier) || 1)) - 1];
// The first shift of a run: level 1 stretched to a gentle minute, easy to pass.
export const FIRST_SHIFT = { duration: 60, total: 7 };
// The guided first shift (Phase 1, tutorial.mjs) is the gentle minute played a little longer, so its lessons fit.
export const TUTORIAL_SECONDS = 90;
// VIPs (a big tip, short patience) in every shift (the creator, 16 October 2026: "always"): one in the gentle first minute, two from
// the next, one more every three shifts (at most six).
export const vipCount = (step) => (step <= 0 ? 1 : Math.min(6, 2 + Math.floor(step / 3)));

// ---- the pools ---------------------------------------------------------------------------------------------------------

// Where Coach Waters works. A week sends him to six of them, each once, drawn at random (`weekPools`), so any pool can come in any
// week. How hard a shift is comes from the run (`tierFor`), not from the pool: a pool gives the shift its look, its crowd and its
// own trouble (Splash Park's trampoline, the lagoon's storm, the Aquatic Centre's star VIP, the disco's class, the Kids Pool's
// running kids), and the difficulty gives it its length, crowd size, star targets and incidents. `levels` are the season's levels
// in that pool (their looks are borrowed). A new pool is a new entry here (and its `SCORE_SCALE`, below): it joins every week's draw.
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
  // The Kids Pool (16 October 2026): children and nobody else, running about the deck until the coach catches one, splashing
  // about anywhere in a pool with no lanes. More tummy trouble than anywhere (`sickRate`), half of it a wee (`peeShare`); every
  // incident still comes; no Marco (it is a children's pool), VIP kids instead.
  kids: {
    name: "Kids Pool",
    icon: "🦆",
    style: { venue: "kids", lighting: "day", sickRate: 0.32, peeShare: 0.5, noStar: true },
    events: [
      "Splash day",
      "Rubber duck races",
      "Paddle party",
      "Little swimmers",
      "Summer camp",
      "Pool noodle fun",
    ],
    twists: { team: 0, class: 0, closure: 0 }, // no swim team, no aqua class; a closed zone means nothing to a kid
  },
  // Senior Aqua Fit (16 October 2026): a glass conservatory spa for seniors, who walk slowly and stooped, come in wheelchairs and
  // get up out of them to swim, cramp more often and wait more patiently; every incident still comes, Marco too (the one young
  // swimmer among them).
  senior: {
    name: "Senior Aqua Fit",
    icon: "👵",
    style: { venue: "senior", lighting: "senior" },
    events: [
      "Golden hour swim",
      "Tea dance splash",
      "Silver swimmers",
      "Gentle laps",
      "Hip & knee club",
      "Sunday best",
    ],
    twists: { team: 0, class: 0 }, // no swim team, no aqua class: it is their pool
  },
  // The Lazy River (17 October 2026): a jungle river that curves through the room; guests come in through the jungle gate, take a
  // tube from the coach, get on at the boarding dock and float away round a loop nobody sees all of, then float back in and get
  // off at the exit dock. Nobody swims laps: no swim team, no class, no lane to close. Every incident still comes, Marco too (he
  // paddles his tube faster than the current).
  river: {
    name: "Lazy River",
    icon: "🛟",
    style: { venue: "river", lighting: "river" },
    events: ["Jungle cruise", "Tube parade", "Monsoon float", "Explorer day", "Lazy Sunday", "Temple rapids"],
    twists: { team: 0, class: 0, closure: 0 },
  },
  // The Wave Pool (17 October 2026): a surf park with a beach. Nobody queues and nobody is sent anywhere: guests walk in through the
  // gate and straight down the beach into the waves, and the coach meets them with one of five tubes. The waves make the bathers
  // dizzy, the coach stops the machine (and the bathers grumble) or helps them out, and a wave that hits a dizzy bather knocks them
  // under. No lanes: no swim team, no class, no lane to close. Every incident still comes, Marco too (he surfs).
  wave: {
    name: "Wave Pool",
    icon: "🌊",
    style: { venue: "wave", lighting: "wave", aqua: false },
    events: ["Surf's up", "Big wave Saturday", "Tidal party", "Swell season", "Beach bash", "Monster mash"],
    twists: { team: 0, class: 0, closure: 0 },
  },
  // The Rooftop Pool (17 October 2026): an infinity pool on a tower 185 m up, at sunset (rooftop.mjs). Nobody swims (no Marco), and
  // lots of VIPs (the creator: "we got lots of VIPs"): two more than the run's count.
  roof: {
    name: "Rooftop Pool",
    icon: "🌇",
    vipBonus: 2,
    style: { venue: "roof", lighting: "roof", aqua: false, noStar: true },
    events: [
      "Sunset session",
      "Sky high soirée",
      "Golden hour",
      "Rooftop takeover",
      "Penthouse party",
      "DJ all night",
    ],
    twists: { team: 0, class: 0, closure: 0 },
  },
  // The cruise ship (18 October 2026): a pool deck at sea that rolls (ship.mjs): two lap lanes and free water to chill in, sun
  // loungers that slide, the pool sloshing over its ends. Every incident still comes, Marco too (he has the lanes).
  cruise: {
    name: "Cruise Ship",
    icon: "🛳️",
    style: { venue: "cruise", lighting: "cruise" },
    events: [
      "Bon voyage",
      "Captain's party",
      "Rough seas",
      "Island hopping",
      "Sail away",
      "Full steam ahead",
    ],
    twists: { class: 0, closure: 0 },
  },
  // The Mountain Hot Springs (18 October 2026): four natural hot springs on an icy terrace in the snow (onsen.mjs). Guests wait in
  // the cold until they are sent to a spring, and the snow monkeys come out of the forest for the warm water. Nobody swims laps
  // (no swim team, no class, no spring to close); every incident still comes, Marco too (he comes for a soak after training).
  onsen: {
    name: "Mountain Hot Springs",
    icon: "♨️",
    style: { venue: "onsen", lighting: "onsen", aqua: false },
    events: [
      "First snow",
      "Snow monkey season",
      "Steam & stars",
      "Winter solstice",
      "Lantern night",
      "Blizzard soak",
    ],
    twists: { team: 0, class: 0, closure: 0 },
  },
  arena: { name: "Grand Gala Arena", icon: "🏟️", levels: [20] },
};
export const POOL_IDS = Object.keys(POOLS);

// The card a pool shows before its first shift (Phase 1, 19 October 2026): what is different here, in one line, and the one thing
// to do about it, in another. The picker shows it with the pool's icon; that shift is played FIRST_VISIT_EASE levels easier (never
// below the week's band).
export const FIRST_VISIT_EASE = 2;
export const POOL_INTROS = {
  club: {
    rule: "Three lanes. Keep speeds together: Pros hate getting stuck behind Beginners.",
    action: "Click a swimmer, then a lane (or 1–3).",
  },
  resort: {
    rule: "Five lanes and a trampoline. Daredevils 🤸 only want the tower, and lane 5 must be empty when they jump.",
    action: "Select a daredevil, then T. Clear lane 5 first.",
  },
  lagoon: {
    rule: "Five lanes by the sea at sunset. A storm can roll in and leave puddles on the deck.",
    action: "Walk round the puddles, or jump them (Space).",
  },
  aquatic: {
    rule: "A competition pool: fast swimmers, and Marco “the Missile” wants a clear lane.",
    action: "Give the Pros lanes of their own (1–5).",
  },
  disco: {
    rule: "No lanes: four zones of aqua dancers. A fifth in a zone and they bump elbows.",
    action: "Send each dancer to a zone with room (1–4).",
  },
  kids: {
    rule: "Only kids, and they never wait in line: they run all over the deck.",
    action: "Catch one (click them, or E beside them), then POOL (1).",
  },
  senior: {
    rule: "Seniors walk slowly, some in wheelchairs, and they cramp more often.",
    action: "Keep a life ring handy: E to grab one, then walk into the pool.",
  },
  river: {
    rule: "Everyone wants a tube 🛟, and the river has two ways round: the lazy loop 🐢 and the rapids ⚡.",
    action:
      "A tube from the rack (F), hand it over (E), then 1 the lazy loop for chillers, 2 the rapids for thrill-seekers.",
  },
  wave: {
    rule: "Bathers walk straight into the waves, and every wave makes them dizzy 💫.",
    action: "Meet them with a tube (F). Z stops the wave machine.",
  },
  roof: {
    rule: "Nobody swims up here: guests wait by the lift for you to seat them, then chill and order margaritas 🍹.",
    action: "Seat them where they'd like: 1 water, 2 sunbed, 3 cabana. B for margaritas, E to tidy a sunbed.",
  },
  cruise: {
    rule: "The ship rolls: people, sun loungers and you slide downhill.",
    action: "Keep people off the pool's ends. E straightens a lounger row; B for the bar.",
  },
  onsen: {
    rule: "Guests get cold waiting in the snow 🥶, and snow monkeys 🐒 want the warm water.",
    action: "Send guests to a spring (1–4). Run into a monkey to shoo it.",
  },
  arena: {
    rule: "The season finale: five lanes, a big crowd and lots of VIPs 👑.",
    action: "VIPs tip big but hate waiting: serve them first.",
  },
};
// ---- the pool ladder (Phase 2, 19 October 2026) -------------------------------------------------------------------------

// The pools as a ladder, opened across runs (the creator's choice, "the ladder"): a first run works at the first three, and every
// date with Marina opens the next one for good, whichever run it comes in (`save.ladder`, how many are open). The order is the
// creator's to change, like INCIDENT_ORDER: gentle lane pools first, then one new set of rules at a time, the strangest last. The
// Grand Gala Arena is not on it: it is the season finale, Saturday of week 4 (`FINALE_WEEK`), and joins the draw after it.
export const LADDER = [
  "club",
  "resort",
  "kids",
  "lagoon",
  "disco",
  "aquatic",
  "onsen",
  "wave",
  "senior",
  "river",
  "cruise",
  "roof",
];
export const LADDER_START = 3;
export const FINALE_WEEK = 4;
export const FINALE_POOL = "arena";
// The pools a week can visit: the first `ladder` of the ladder, and the arena once a run is past its finale.
export function openPools(ladder = LADDER.length, chapter = 1) {
  const n = Math.max(LADDER_START, Math.min(LADDER.length, Math.floor(Number(ladder)) || LADDER_START));
  return [...LADDER.slice(0, n), ...(chapter > FINALE_WEEK ? [FINALE_POOL] : [])];
}

// The week's itinerary, one pool a day, drawn at random from the pools open (`open`) when the week starts, and kept in the save:
// - the run's very first shift is the Community Pool (the gentle minute), and Saturday of week 4 is the finale at the arena;
// - a pool never played yet (`fresh`: one just opened on the ladder) is always in the week, so a new pool comes at once;
// - with six pools or more open, six different ones, the ones left out changing week to week (the creator, 16 October 2026:
//   "you cannot repeat venue per week"); with fewer (a first run has three), each comes as evenly as it can, never two days
//   running.
export function weekPools(chapter, seed, open = openPools(LADDER.length, chapter), fresh = []) {
  const random = stream((seed ^ 0x51ed27 ^ Math.imul(chapter, 0x9e3779b1)) >>> 0),
    shuffle = (list) => {
      const a = [...list];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
  const pools = [...new Set(open.filter((id) => POOLS[id]))];
  if (!pools.length) pools.push("club");
  const fixed = Array(SHIFTS_PER_WEEK).fill(null);
  if (chapter === 1) fixed[0] = "club";
  if (chapter === FINALE_WEEK) fixed[SHIFTS_PER_WEEK - 1] = FINALE_POOL;
  const used = Object.fromEntries(pools.map((id) => [id, fixed.filter((f) => f === id).length])),
    free = fixed.filter((f) => !f).length,
    bag = [];
  const add = (id) => {
    bag.push(id);
    used[id] = (used[id] || 0) + 1;
  };
  for (const id of shuffle(pools.filter((p) => fresh.includes(p))))
    if (!used[id] && bag.length < free) add(id);
  for (const id of shuffle(pools.filter((p) => !used[p]))) if (bag.length < free) add(id);
  while (bag.length < free) {
    const least = Math.min(...pools.map((p) => used[p])),
      options = pools.filter((p) => used[p] === least);
    add(options[Math.floor(random() * options.length)]);
  }
  let best = null;
  for (let attempt = 0; attempt < 120; attempt++) {
    const order = shuffle(bag),
      days = fixed.map((f) => f || order.shift());
    if (days.every((d, i) => i === 0 || d !== days[i - 1])) return days;
    best ||= days;
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
// Recalibrated 19 October 2026 (Phase 0): the coach bot used to switch cramps off, which flattered the pools with the most cramps
// (Senior Aqua Fit, the Lazy River). Measured again with an expert bot that rescues cramps (cramps now spaced out, rescue.mjs),
// 13 pools x 9 difficulties x 4 seeds against the median of all pools, and checked on fresh seeds: every pool passes 92-100% of
// shifts for it, at 1.7 to 2.2 stars. The notes under each pool below are from the first calibrations; the numbers are the new ones.
export function scoreScale(venue, tier) {
  const scale = SCORE_SCALE[venue] || SCORE_SCALE.resort;
  return (scale.find(([upTo]) => tier <= upTo) || scale[scale.length - 1])[1];
}
// Phase 3 (20 October 2026) raised every pool's targets by what the new play adds there (coaching tips, the big moment, the livelier
// streak, the river's rapids, the rooftop's seating): the expert coach bot's share of the two-star target, measured before and after
// on the same shifts (38 a pool), back where it was. Tier 1 (the gentle first minute, which has none of it) is as it was.
const SCORE_SCALE = {
  club: [
    [1, 1],
    [10, 1.2],
    [20, 0.9],
  ],
  resort: [
    [10, 1.2],
    [20, 1.05],
  ],
  aquatic: [
    [10, 1.55],
    [13, 1.25],
    [20, 0.8],
  ],
  // A class of aqua dancers is the gentlest crowd in the game: the stars ask more of it (calibrated with the coach bot).
  disco: [
    [10, 2],
    [20, 1.6],
  ],
  // The Kids Pool: a little above Splash Park's (the bot catches a running kid at once; a player has to chase one), which leaves
  // the bot about as far over the two stars as in the disco (calibrated 16 October 2026). Since 20 October a kid's points follow
  // their mood (sim.mjs KID_MOOD_PAY) and the birthday party has room: a coach who keeps the pool from packing scores as before
  // from level 5, and about 1.4 times as much at levels 2 to 4, where the party used to make every kid cross.
  kids: [
    [4, 2.2],
    [10, 1.6],
    [20, 1.25],
  ],
  // Senior Aqua Fit: slow walkers, a stand-up for every wheelchair and steady lengths serve fewer guests in a shift, so the stars
  // ask less (the coach bot scored about half of what it does at Splash Park on the same targets; calibrated 16 October 2026).
  senior: [
    [10, 0.65],
    [20, 0.8],
  ],
  // The Lazy River: about Splash Park's at first; a big crowd queues for ten tubes and a loop of half a minute, so the stars ask
  // less late in a run (calibrated with the coach bot, 17 October 2026; the rapids, Phase 3, are quicker round: a little more).
  river: [
    [10, 1.3],
    [13, 0.85],
    [20, 0.4],
  ],
  // The Wave Pool: guests walk straight in and have to be caught for a tube, and the waves knock them dizzy, so the stars ask less
  // (on the plain targets the coach bot only just made two stars, and fell short late in a run; calibrated 17 October 2026).
  wave: [
    [10, 1],
    [15, 0.75],
    [20, 0.8],
  ],
  // The Rooftop Pool: margaritas tip well and the VIPs are many, so the stars ask more (on the plain targets the coach bot made
  // about 1.6 times Splash Park's share of two stars; scaled, about the same as there; calibrated 17 October 2026).
  roof: [
    [10, 1.7],
    [15, 1.6],
    [20, 1.65],
  ],
  // The Cruise Ship: about Splash Park's at first; later in a run the big swells (loungers to straighten, guests in the pool, spills
  // to mop) take more of the coach's time, so the stars ask less (the coach bot on the plain targets made about Splash Park's
  // share of two stars to tier 12, about 0.7 of it by tier 18; calibrated 18 October 2026).
  cruise: [
    [10, 1.05],
    [13, 0.95],
    [20, 0.6],
  ],
  // The Mountain Hot Springs: nobody swims laps, so a spring never jams, and a guest sent straight to one is warm and happy;
  // only the cold, the monkeys and the ice take points, so the stars ask more (on Splash Park's targets the coach bot made about
  // 1.5 times its share there early in a run, 1.2 times later; calibrated 18 October 2026).
  onsen: [
    [10, 2.05],
    [15, 1.75],
    [20, 1.9],
  ],
};

// ---- the shop --------------------------------------------------------------------------------------------------------

// What the coach can buy between shifts, for the rest of the week, out of the Date Fund (Phase 2: one money; until 19 October 2026
// the shop took tips, a second money that never touched the fund). `price` is in dollars in week 1 and grows with the week's pay
// (`perkPrice`), so a perk always costs about half a shift's pay: spend now to earn more, or save for the date. `sim` perks are read
// by the simulation (sim.mjs `perks`), the others by the week itself. Dollar amounts a perk pays (`sponsor`, `vipTip`) grow with
// the pay too.
export const PERKS = {
  shoes: {
    icon: "👟",
    name: "Running shoes",
    text: "The coach runs 12% faster",
    price: 30,
    sim: { speed: 1.12 },
  },
  whistle: {
    icon: "📯",
    name: "Turbo whistle",
    text: "Dash again 40% sooner",
    price: 20,
    sim: { dash: 0.6 },
  },
  benches: {
    icon: "⛱️",
    name: "Shady benches",
    text: "The queue waits 25% longer",
    price: 35,
    sim: { patience: 1.25 },
  },
  stretch: {
    icon: "🧘",
    name: "Stretching poster",
    text: "Half as many cramps",
    price: 30,
    sim: { cramp: 0.5 },
  },
  tummy: {
    icon: "🔔",
    name: "Tummy alarm",
    text: "4 more seconds to send a queasy swimmer home",
    price: 25,
    sim: { warning: 4 },
  },
  megaphone: {
    icon: "📣",
    name: "Megaphone",
    text: "Every swim scores 10% more",
    price: 40,
    sim: { score: 1.1 },
  },
  nodogs: {
    icon: "🚫",
    name: "No dogs sign",
    text: "The loose dog comes far less",
    price: 20,
    director: { dog: 0.25 },
  },
  nobombs: {
    icon: "🪧",
    name: "No bombs sign",
    text: "The cannonball man comes far less",
    price: 20,
    director: { carl: 0.25 },
  },
  tipjar: {
    icon: "🫙",
    name: "Tip jar",
    text: "Every VIP served tips $5 for the date",
    price: 25,
    vipTip: 5,
  },
  charm: {
    icon: "💐",
    name: "Lucky charm from Marina",
    text: "Marina's wishes pay 50% more",
    price: 35,
    wishes: 1.5,
  },
  sponsor: {
    icon: "🤝",
    name: "Local sponsor",
    text: "+$15 for the date after every shift passed",
    price: 40,
    sponsor: 15,
  },
  insurance: {
    icon: "🛟",
    name: "Safety net",
    text: "A failed shift still pays half",
    price: 30,
    insurance: true,
  },
};
export const REROLL_PRICE = 10;
export const SHOP_SIZE = 3;
// What a perk, or a new hand, costs in a week (`chapter`): its week-1 price times the week's pay, in fives.
export const perkPrice = (id, chapter) => roundPay((PERKS[id]?.price || 0) * (chapter?.pay || 1));
export const rerollPrice = (chapter) => roundPay(REROLL_PRICE * (chapter?.pay || 1));

// The coach's gear (Phase 2: progress that lasts): kept for good once the stars earned in all runs (`save.stars`) reach its mark,
// and worn one piece at a time, chosen in the coach's locker on the main screen. Each is a smaller, lasting cousin of a shop perk,
// and stacks with them. A piece worn is in the shift's perks, so a replay of the shift plays it the same.
export const GEAR = {
  cap: { icon: "🧢", name: "Lucky cap", text: "Marina's wishes pay 20% more", stars: 5, wishes: 1.2 },
  slides: {
    icon: "🩴",
    name: "Pool slides",
    text: "The coach runs 8% faster",
    stars: 15,
    sim: { speed: 1.08 },
  },
  silver: {
    icon: "📯",
    name: "Silver whistle",
    text: "Dash again 30% sooner",
    stars: 30,
    sim: { dash: 0.7 },
  },
  shades: {
    icon: "🕶️",
    name: "Mirrored shades",
    text: "The queue waits 15% longer",
    stars: 50,
    sim: { patience: 1.15 },
  },
  vest: { icon: "🦺", name: "Lifeguard vest", text: "A third fewer cramps", stars: 75, sim: { cramp: 0.67 } },
  clipboard: {
    icon: "📋",
    name: "Golden clipboard",
    text: "Every swim scores 5% more",
    stars: 105,
    sim: { score: 1.05 },
  },
  medal: {
    icon: "🏅",
    name: "Coach of the Year medal",
    text: "+$10 for the date after every shift passed",
    stars: 140,
    sponsor: 10,
  },
};
export const GEAR_IDS = Object.keys(GEAR);
// The gear open at a number of stars, in the order it opens.
export const gearOpen = (stars = 0) => GEAR_IDS.filter((id) => (Number(stars) || 0) >= GEAR[id].stars);

// What the perks bought this week, and the gear worn, add up to: the simulation's multipliers, the director's weights and the
// week's own rules. `sponsor` and `vipTip` are week-1 dollars (times the week's pay when paid).
export function perkEffects(owned = [], gear = null) {
  const sim = { speed: 1, dash: 1, patience: 1, cramp: 1, warning: 0, score: 1 },
    director = {};
  let wishes = 1,
    sponsor = 0,
    vipTip = 0,
    insurance = false;
  const items = [...owned.map((id) => PERKS[id]), GEAR[gear]].filter(Boolean);
  for (const p of items) {
    for (const [k, v] of Object.entries(p.sim || {})) sim[k] = k === "warning" ? sim[k] + v : sim[k] * v;
    for (const [k, v] of Object.entries(p.director || {})) director[k] = (director[k] ?? 1) * v;
    wishes *= p.wishes || 1;
    sponsor += p.sponsor || 0;
    vipTip += p.vipTip || 0;
    insurance ||= !!p.insurance;
  }
  return { sim, director, wishes, sponsor, vipTip, insurance };
}

// Three perks the coach does not have yet, from a seeded draw (`roll` counts rerolls so each gives a new hand). A sign against an
// incident is only offered once the player has met it (`known`): no "No bombs sign" before the cannonball man has come.
export function shopOffer(week, roll = 0, known = INCIDENT_ORDER) {
  const random = stream(
    (week.seed ^ Math.imul(week.shift + 1, 2246822519) ^ Math.imul(roll + 1, 3266489917)) >>> 0,
  );
  const pool = Object.keys(PERKS).filter(
    (id) => !week.perks.includes(id) && Object.keys(PERKS[id].director || {}).every((k) => known.includes(k)),
  );
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
    fits: (s) => s.total >= 6 && s.lanes !== false,
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
// The venues without lap lanes, where "No collisions in the lanes" makes no sense (20 October 2026: Marina asked it at the Kids
// Pool).
const NO_LAP_LANES = ["disco", "kids", "river", "wave", "roof", "onsen"];

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
// A wish is only met in a shift that served someone: "no collisions" or "a short wait" with nobody served is not a wish come
// true (19 October 2026: an empty shift paid out both).
export function checkWishes(wishes, summary, stats = {}) {
  return wishes.map((w) => ({
    ...w,
    met: (summary.served || 0) > 0 && !!WISHES[w.id]?.met(summary, w.target, stats),
  }));
}

// ---- building a shift -------------------------------------------------------------------------------------------------

const roundPay = (n) => Math.max(5, Math.round(n / 5) * 5);
// The director's draw for one shift. `known` are the incidents the player has met; the next one not yet known comes as a
// surprise (`surprise`) in every shift from the first Tuesday until all are met. `recent` are the incidents of the shifts before
// this one, the latest last (a list of lists), for the fair mix. `extraBudget` is the mystery card's. Returns { chaos, twist,
// incidents, surprise }.
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
  recent = [],
}) {
  const slots = (blueprint.chaos || []).length;
  // Gentle at first: the first shifts of the first week have nothing, then the count follows the blueprint, with a little
  // give either way so a player cannot count on it.
  let count = slots;
  if (slots > 0) count = Math.max(1, slots + (random() < 0.3 ? -1 : random() < 0.35 ? 1 : 0));
  count = Math.min(slots + heat + 1, count + extraBudget + heat);
  // A surprise: the next incident in the order, in every shift from the first Tuesday until the player has met them all.
  const next = INCIDENT_ORDER.find((k) => !known.includes(k));
  random(); // (the roll the surprise used to take: kept, so the rest of the draw stays as it was)
  const surprise = next && index >= 1 ? next : null;
  if (surprise && count === 0) count = 1;
  const last = new Set(recent[recent.length - 1] || []),
    before = new Set(recent[recent.length - 2] || []);
  const fair = (k, base) => ({
    kind: k,
    weight: base * (weights[k] ?? 1) * (last.has(k) ? RECENT.last : 1) * (before.has(k) ? RECENT.before : 1),
  });
  const pool = [
    ...INCIDENT_ORDER.filter((k) => known.includes(k)).map((k) => fair(k, INCIDENTS[k].weight)),
    ...Object.entries(VENUE_INCIDENTS)
      .filter(([, i]) => i.where(venue))
      .map(([k, i]) => fair(k, i.weight)),
  ];
  const kinds = [];
  if (surprise) kinds.push(surprise);
  while (kinds.length < count && pool.length) {
    const choice = pickWeighted(
      random,
      pool.map((p) => ({ ...p, weight: kinds.includes(p.kind) ? p.weight * RECENT.again : p.weight })),
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
// `seen`: the pools the player has played (week-ui keeps them in the save). A pool's first visit (`firstVisit`) is played two
// levels easier (`FIRST_VISIT_EASE`), never below level 2, and the picker shows its card (`POOL_INTROS`). Without `seen` (checks,
// replays of older shifts) nothing changes.
export function buildShift(week, card = null, known = week.known || [], seen = null) {
  const chapter = chapterFor(week.chapter),
    index = week.shift,
    step = stepOf(week),
    random = stream((week.seed ^ Math.imul(index + 1, 2654435761)) >>> 0),
    poolOf = (week.pools || weekPools(week.chapter, week.seed))[index] || "club",
    // The season finale: Saturday of week 4 at the Grand Gala Arena, at the top of the week's band (never eased).
    finale = week.chapter === FINALE_WEEK && index === SHIFTS_PER_WEEK - 1 && poolOf === FINALE_POOL,
    firstVisit = !!seen && step > 0 && !finale && !seen.includes(poolOf),
    // (free play names its own difficulty: `week.tier`, freePlayShift)
    drawn = finale
      ? bandOf(week.chapter)[1]
      : week.tier
        ? Math.max(1, Math.min(TOP_TIER, Math.floor(week.tier)))
        : tierFor(week.chapter, index, stream((week.seed ^ Math.imul(step + 11, 2246822519)) >>> 0)),
    tier = firstVisit ? Math.max(Math.min(drawn, bandOf(week.chapter)[0]), drawn - FIRST_VISIT_EASE) : drawn,
    heat = heatOf(week.chapter),
    // Past the last band: a bigger crowd and higher targets every week (at most half as much again).
    f = Math.min(1.5, 1 + 0.1 * heat);
  // The day's pool, and the shift: the difficulty's level for its length, crowd, star targets and the number of incidents and twists,
  // in the pool's look.
  const poolId = poolOf,
    pool = POOLS[poolId],
    look = poolLook(poolId, tier, stream((week.seed ^ Math.imul(index + 5, 1597334677)) >>> 0)),
    ref = SHIFTS[tier - 1],
    crowd = pool.crowd || 1,
    k = scoreScale(look.venue, tier) * tierScale(tier) * crowd;
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
    ...(look.sickRate && { sickRate: look.sickRate }),
    ...(look.peeShare && { peeShare: look.peeShare }),
  };
  // Marco "the Missile": always at the Aquatic Centre, and in more than half the shifts of every other pool (`STAR_CHANCE`), at a
  // moment of his own.
  const starRoll = stream((week.seed ^ Math.imul(index + 9, 2654435789)) >>> 0);
  if (look.noStar) delete blueprint.star;
  else if (look.star) blueprint.star = look.star;
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
  // The finale is no gig to pick: a regular day, the biggest of the season.
  const offered = shiftCards(step, stream((week.seed ^ Math.imul(index + 7, 40503)) >>> 0), known, blueprint),
    cards = finale ? offered.slice(0, 1) : offered;
  const chosen = (card && cards.find((c) => c.id === card)) || null;
  // The perks bought this week and the gear the coach wears (`week.gear`, set by week-ui from the save).
  const gear = GEAR[week.gear] ? week.gear : null,
    effects = perkEffects(week.perks, gear);
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
    recent: week.history.map((h) => (Array.isArray(h?.incidents) ? h.incidents : [])),
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
    label: finale ? "Season finale" : look.label,
    chaos: plan.chaos,
    twist: plan.twist,
    ...(vips > 0 && { vipAt: vipSlots(vips, random) }),
    week: { chapter: week.chapter, shift: index },
    ...(finale && { finale: true }),
    // The shift's big moment (Phase 3, big-moment.mjs): every shift but the gentle first one, about two thirds of the way.
    ...(step > 0 && { big: planBig(stream((week.seed ^ Math.imul(index + 13, 2654435761)) >>> 0)) }),
  };
  if (plan.surprise) config.intro = plan.surprise;
  const shape = {
    index: step,
    tier,
    total: config.total,
    incidents: plan.incidents,
    vips: (config.vipAt || []).length,
    daredevils: (config.daredevilAt || []).length,
    // (lap lanes: where swimmers can collide; not the disco's zones, the Kids Pool, the river, the waves, the roof or the springs)
    lanes: !NO_LAP_LANES.includes(config.venue),
  };
  const wishes = drawWishes(shape, stream((week.seed ^ Math.imul(index + 3, 362437)) >>> 0), chapter.pay);
  return {
    index,
    step,
    day: DAYS[index],
    pool: poolId,
    place: pool.name,
    icon: pool.icon,
    label: config.label,
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
    gear,
    finale,
    firstVisit,
    intro: firstVisit || finale ? POOL_INTROS[poolId] || null : null,
  };
}

// ---- free play (21 October 2026) -------------------------------------------------------------------------------------
// The menu's FREE PLAY: any pool the ladder has opened (and the Grand Gala Arena once a run has reached its finale), at a
// difficulty the player picks; nothing in it touches the week (no Date Fund, no wishes, no shop, no new pool). A difficulty is a
// level of the season, open once a run has passed it (`save.unlocked`, the highest level a run has passed), Easy always.
export const FREE_LEVELS = [
  { id: "easy", name: "Easy", tier: 3 },
  { id: "normal", name: "Normal", tier: 8 },
  { id: "hard", name: "Hard", tier: 13 },
  { id: "expert", name: "Expert", tier: 18 },
];
export const freeLevel = (id) => FREE_LEVELS.find((l) => l.id === id) || FREE_LEVELS[0];
export const freeLevelOpen = (id, unlocked = 1, all = false) =>
  all || freeLevel(id).tier <= Math.max(FREE_LEVELS[0].tier, Math.floor(unlocked) || 1);
// The pools in the ladder's order, then the arena: each open or not yet (`all`: dev mode, every one open, dev.mjs).
export function freePools(save = {}, all = false) {
  const open = Math.max(LADDER_START, Math.min(LADDER.length, Math.floor(save.ladder) || LADDER_START)),
    seen = Array.isArray(save.seen) ? save.seen : [];
  return [
    ...LADDER.map((id, i) => ({ id, open: all || i < open })),
    {
      id: FINALE_POOL,
      open: all || !!save.finale || seen.includes(FINALE_POOL) || (save.bestWeek || 1) > FINALE_WEEK,
    },
  ];
}
// A free-play shift: the week's own builder at the chosen pool and difficulty (a mid-run day, so a full crowd and the big moment),
// without the week (`config.week`) and without its wishes, booking or perks; `config.free` says which pool and difficulty.
export function freePlayShift(poolId, levelId, seed, known = []) {
  const level = freeLevel(levelId),
    pool = POOLS[poolId] ? poolId : "club",
    week = {
      chapter: 2,
      shift: 1,
      seed: seed >>> 0 || 1,
      pools: Array(SHIFTS_PER_WEEK).fill(pool),
      history: [],
      perks: [],
      known,
      tier: level.tier,
    },
    shift = buildShift(week, null, known);
  const { week: _week, day: _day, ...config } = shift.config;
  const free = { pool, level: level.id, name: level.name };
  return {
    ...shift,
    config: { ...config, free },
    free,
    wishes: [],
    booking: null,
    card: null,
    cards: [],
    intro: null,
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

// A week starts: its seed, and its six pools drawn from the ones the player has opened (`save.ladder`), a pool never played in it
// for sure (kept in the save, so the week stays as drawn).
export function newWeek(save, seed = Date.now()) {
  const s = seed >>> 0 || 1,
    open = openPools(save.ladder ?? LADDER.length, save.chapter),
    // (a pool never played comes for sure; without a list of the pools played, none is new)
    fresh = Array.isArray(save.seen) ? open.filter((id) => !save.seen.includes(id)) : [];
  return {
    chapter: save.chapter,
    seed: s,
    pools: weekPools(save.chapter, s, open, fresh),
    shift: 0,
    fund: 0,
    peak: 0, // the most the fund has held this week (Marina's texts come once, on the way up)
    spent: 0, // what the shop took from it
    perks: [],
    rolls: 0,
    history: [],
    status: "playing", // "playing" | "won" | "lost"
  };
}

// All the dates there are, in the order a run meets them (the album shows them so).
export const ALL_DATES = [...CHAPTERS.map((c) => c.date), ...HEAT_DATES];
// The first week that has a date (to play its scene again from the album).
export const chapterOfDate = (id) => {
  const i = CHAPTERS.findIndex((c) => c.date.id === id);
  if (i >= 0) return chapterFor(i + 1);
  const h = HEAT_DATES.findIndex((d) => d.id === id);
  return h >= 0 ? chapterFor(CHAPTERS.length + 1 + h) : null;
};

// The save: which week of the run the player is on, what they have discovered, the dates of the run, the week in progress, the
// levels the run has opened in free play (`unlocked`: every level up to it, never less than 1), and what lasts across runs
// (Phase 2): the pools open on the ladder (`ladder`), every date ever had (`album`), the stars earned in all runs (`stars`), the gear
// worn (`gear`), the best stars at each pool (`best`) and whether the story's ending has been seen (`finale`). A save from before
// Phase 2 keeps every pool it has played open (and one more for each week it ever reached), and its dates in the album.
export function normalizeWeekSave(saved = {}) {
  const s = saved && typeof saved === "object" ? saved : {};
  const known = Array.isArray(s.known) ? s.known.filter((k) => INCIDENTS[k]) : [];
  const dates = Array.isArray(s.dates) ? s.dates.filter((d) => typeof d === "string" && d.length < 40) : [];
  const chapter = Math.max(1, Math.min(999, Math.floor(Number(s.chapter)) || 1));
  const count = (v, max = 1e6) => Math.max(0, Math.min(max, Math.floor(Number(v)) || 0));
  const bestWeek = Math.max(1, count(s.bestWeek, 999) || 1);
  const seen = Array.isArray(s.seen) ? [...new Set(s.seen.filter((p) => POOLS[p]))] : [];
  const ladder =
    s.ladder !== undefined
      ? Math.max(LADDER_START, Math.min(LADDER.length, count(s.ladder, LADDER.length)))
      : Math.max(
          LADDER_START,
          Math.min(LADDER.length, LADDER_START + bestWeek - 1),
          ...seen.map((p) => LADDER.indexOf(p) + 1),
        );
  const isDate = (id) => ALL_DATES.some((d) => d.id === id);
  const album = Array.isArray(s.album)
    ? [...new Set(s.album.filter(isDate))]
    : [
        ...new Set([
          ...CHAPTERS.slice(0, Math.min(CHAPTERS.length, bestWeek - 1)).map((c) => c.date.id),
          ...(s.v === 2 ? dates.filter(isDate) : []),
        ]),
      ];
  const stars = count(s.stars, 1e7);
  const best = {};
  for (const [id, n] of Object.entries(s.best && typeof s.best === "object" ? s.best : {}))
    if (POOLS[id]) best[id] = Math.min(3, count(n, 3));
  let week = null;
  const w = s.week;
  // A week saved by the old ten-shift version (two shifts a day) is not carried over: its shifts do not fit six days.
  if (w && typeof w === "object" && w.status === "playing" && s.v === 2) {
    const seed = count(w.seed, 4294967295) || 1;
    const pools =
      Array.isArray(w.pools) && w.pools.length === SHIFTS_PER_WEEK && w.pools.every((p) => POOLS[p])
        ? [...w.pools]
        : weekPools(chapter, seed, openPools(ladder, chapter)); // (a week saved before the ladder: drawn again)
    const fund = count(w.fund);
    week = {
      chapter,
      seed,
      pools,
      shift: count(w.shift, SHIFTS_PER_WEEK - 1),
      fund,
      peak: Math.max(fund, count(w.peak)),
      spent: count(w.spent),
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
    bestWeek,
    bestFund: count(s.bestFund),
    unlocked: Math.max(1, Math.min(TOP_TIER, count(s.unlocked, TOP_TIER) || 1)),
    invited: Array.isArray(s.invited)
      ? s.invited.filter((n) => Number.isInteger(n) && n > 0).slice(-100)
      : [],
    // The pools played at least once (their first visit is easier and shows a card), and whether the guided first shift has been
    // played or skipped (`tutorial`, Phase 1).
    seen,
    tutorial: !!s.tutorial,
    ladder,
    album,
    stars,
    gear: GEAR[s.gear] && stars >= GEAR[s.gear].stars ? s.gear : null,
    best,
    finale: !!s.finale,
    week,
  };
}

// A shift is over. Returns what happened (for the results screen) and changes `save` (and its week) in place:
//   failed   below the pass mark: it pays nothing (half with the safety net), and the week goes on
//   last     Saturday's shift: Sunday decides. `won` when the Date Fund reached the goal (a date, and the next week), else
//            `over`: the run is lost and the next one starts again at week 1
// A level passed opens in free play, with every level below it. What lasts (Phase 2): the stars go to the coach's total (and may
// open gear, `newGear`), the pool's best stars; a date goes in the album (`newDate`) and opens the next pool on the ladder
// (`newPool`); the date of week 4 is the story's ending (`ending`, true the first time).
export function finishShift(save, shift, summary, stats = {}) {
  const week = save.week,
    chapter = chapterFor(week.chapter),
    effects = perkEffects(week.perks, shift.gear),
    stars = summary.stars || 0,
    pass = passMark(shift.config),
    passed = (summary.score || 0) >= pass;
  const wishes = checkWishes(shift.wishes, summary, stats);
  // The incidents met: the ones that really started (`summary.met`), not the ones planned (19 October 2026: a shift that ended
  // before its fish came counted the fish as met). Without `met` (an older caller), the plan.
  const met = Array.isArray(summary.met) ? summary.met : shift.plan.incidents;
  for (const k of met) if (INCIDENTS[k] && !save.known.includes(k)) save.known.push(k);
  if (Array.isArray(save.seen) && POOLS[shift.pool] && !save.seen.includes(shift.pool))
    save.seen.push(shift.pool);
  if (shift.config?.tutorial) save.tutorial = true;
  // What lasts: the stars, and the best at this pool.
  const starsBefore = save.stars || 0;
  save.stars = starsBefore + stars;
  const newGear = GEAR_IDS.filter((id) => starsBefore < GEAR[id].stars && save.stars >= GEAR[id].stars);
  if (save.best && POOLS[shift.pool]) save.best[shift.pool] = Math.max(save.best[shift.pool] || 0, stars);
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
    sponsor = passed && effects.sponsor ? roundPay(effects.sponsor * chapter.pay) : 0,
    vipTips =
      passed && effects.vipTip && stats.vips > 0 ? roundPay(effects.vipTip * chapter.pay * stats.vips) : 0,
    gained = pay + wishPay + sponsor + vipTips;
  const before = week.fund,
    peakBefore = Math.max(week.peak || 0, before);
  week.fund += gained;
  week.peak = Math.max(peakBefore, week.fund);
  week.history.push({
    stars,
    score: Math.round(summary.score || 0),
    passed,
    gained,
    wishes: wishes.filter((w) => w.met).length,
    surprise: shift.plan.surprise || null,
    incidents: shift.plan.incidents,
  });
  const last = week.shift >= SHIFTS_PER_WEEK - 1;
  const result = {
    stars,
    pass,
    passed,
    pay,
    wishPay,
    sponsor,
    vipTips,
    gained,
    wishes,
    insured,
    failed,
    before,
    peakBefore,
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
    finale: !!shift.finale,
    newGear,
    newPool: null,
    newDate: false,
    ending: false,
  };
  if (last) {
    result.won = week.fund >= chapter.goal;
    result.over = !result.won;
    week.status = result.won ? "won" : "lost";
    if (result.won) {
      save.dates.push(chapter.date.id);
      if (Array.isArray(save.album) && !save.album.includes(chapter.date.id)) {
        save.album.push(chapter.date.id);
        result.newDate = true;
      }
      // Every date opens the next pool on the ladder, for good.
      if (typeof save.ladder === "number" && save.ladder < LADDER.length) {
        save.ladder++;
        result.newPool = LADDER[save.ladder - 1];
      }
      // The ocean trip after the season finale: the story's ending (the first time), then the run goes on, endless.
      if (chapter.id === FINALE_WEEK) {
        result.ending = !save.finale;
        save.finale = true;
      }
      save.chapter = week.chapter + 1;
      save.bestWeek = Math.max(save.bestWeek, save.chapter);
    } else {
      // Game over: the run starts again at week 1 (what was discovered, the pools, the album, the stars and the levels stay).
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
    pace,
    perShift: Math.ceil(perShift),
    onTrack: need === 0 || perShift <= pace,
    reached: need === 0,
  };
}

// The shop (one money): a perk is paid out of the Date Fund, and is the week's. Returns whether it was bought.
export function buyPerk(week, id) {
  const p = PERKS[id],
    price = perkPrice(id, chapterFor(week.chapter));
  if (!p || week.perks.includes(id) || week.fund < price) return false;
  week.fund -= price;
  week.spent = (week.spent || 0) + price;
  week.perks.push(id);
  return true;
}
// A new hand in the shop, also out of the Date Fund.
export function reroll(week) {
  const price = rerollPrice(chapterFor(week.chapter));
  if (week.fund < price) return false;
  week.fund -= price;
  week.spent = (week.spent || 0) + price;
  week.rolls++;
  return true;
}

// Marina's texts as the Date Fund fills (a share of the goal passed by this shift). With one money the fund can go down (the shop):
// a text comes once, the first time the fund passes its mark (pass the most it held before, `peakBefore`).
export const MARINA_TEXTS = [
  { at: 0.25, text: "A quarter of the way! I'm already picking an outfit 👗" },
  { at: 0.5, text: "Halfway there! I can't wait for the weekend 💕" },
  { at: 0.75, text: "Almost! Don't let a fish ruin it now 🐟😅" },
  { at: 1, text: "You did it! It's a date this weekend 💖" },
];
export const textsPassed = (before, after, goal) =>
  MARINA_TEXTS.filter((m) => before / goal < m.at && after / goal >= m.at);
