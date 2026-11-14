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
//               it, more of them as the run goes on. Before a shift the player picks a door (the fun plan, 14 November 2026:
//               a pool, a day rule and what it pays, `dayDoors`, `RULES`), and Marina has two wishes, small objectives that pay
//               extra.
//   ONE MONEY   after every shift passed, a pick of three perks, one to take, for the whole run (`pickOffer`, a build of six
//               at most): two are paid out of the Date Fund (Phase 2: one money, the creator's choice), one with a catch is free.
//   THE STAKES  the third star pays most; short by a fifth or less on Saturday night, one last shift decides it (overtime, once
//               a run); half of what is over the goal starts next week, and far over it is a deluxe date and a gift from Marina;
//               from the third run a veteran's Monday is a real shift two levels up, with a perk on the house.
//   FOR GOOD    what a run leaves behind (`normalizeWeekSave`): the pools opened (one more with every date), the dates had (the
//               album), the stars earned (they open the coach's gear, `GEAR`), the best stars at each pool, the story's ending,
//               the challenges (`CHALLENGES`: counted over every run, each adds perks and day rules to the decks) and the
//               scrapbook (`SCRAP`).

import { SHIFTS, MARCO, STAR_CHANCE } from "./sim.mjs";
import { VENUES } from "./spatial.mjs";
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
  // The influencer filming in the middle of the deck (5 November 2026, incidents/influencer.mjs): the Wave Pool, the Aqua Disco,
  // the Lazy River and the Grand Gala Arena, the venues with spots for them (`selfieSpots`, spatial.mjs); drawn at random like
  // any other incident there, never every shift.
  influencer: {
    icon: "🤳",
    name: "Influencer",
    cost: 2,
    weight: 3,
    where: (venue) => !!VENUES[venue]?.selfieSpots?.length,
  },
};
// The roaming incidents a pool leaves out (its venue's `skips`, spatial.mjs): the director never draws them there, nor springs
// them as its surprise.
export const venueSkips = (venue) => VENUES[venue]?.skips || [];
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
// The fun plan (14 November 2026) raised them: a run now earns more as it goes (the third star, the doors' pay, a build of six
// perks, what a week carries over), and the bots that play whole runs taking doors and perks (tools/fun-report.mjs) ended every
// week at two to three times the old goals by Wednesday. Measured again, so that each bot ends a week about as far over its
// goal as it did before the plan: week 1 is still the learner's week; from week 3 a week asks more than three stars in every
// shift and both wishes pay on regular days, so a build and a better-paid door are how a date is made, and a careful coach is
// still playing for it on Friday.
export const GOAL_SHARE = [0.9, 1.5, 1.8, 1.95, 1.95, 1.95, 1.9];
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
// The second guided shift (5 November 2026, tutorial.mjs): fins, then a cramp, on the run's third shift, always at the Community
// Pool, the pool of the first lesson, with no big moment; its incidents wait until the lessons are done. Not finished, it comes
// back the next shift until it is (or its tips are skipped): `save.lesson2`.
export const LESSON_STEP = 2;
// (and 45 s longer than the day's shift, so the fins, the rescue and a little of the shift itself fit)
export const LESSON_EXTRA = 45;
export const LESSON_POOL = "club";
export const lessonDue = (save) =>
  !!save.tutorial &&
  !save.lesson2 &&
  !!save.week &&
  stepOf(save.week) >= LESSON_STEP &&
  !(save.week.chapter === FINALE_WEEK && save.week.shift === SHIFTS_PER_WEEK - 1);
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
  // The Jumping Pool (24 October 2026): a country club's deep diving pool with a station at each end, LOW, MID and HIGH (dive.mjs).
  // Send each guest to the height their skill can take; a hot tub for the guests who only came for it (its tummy trouble the only
  // kind here: `sickRate` makes it likelier), and the open massage corner for the divers out of a failed jump. No swim team, no
  // class, no lane to close; Karen and the outage still come (its venue's `skips`), Marco too (from the HIGH board, a triple).
  dive: {
    name: "The Jumping Pool",
    icon: "🤸",
    style: { venue: "dive", lighting: "dive", aqua: false, peeShare: 0.45 },
    events: [
      "Diving day",
      "Springboard Sunday",
      "High dive open",
      "Belly flop contest",
      "Club splash",
      "Summer dive-off",
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
  dive: {
    rule: "Two diving stations: LOW 🟢, MID 🟡, HIGH 🔴. Beginners low, intermediates mid, Pros high. Too high and they wipe out!",
    action:
      "Click a guest, then 1 LOW, 2 MID, 3 HIGH (4 the hot tub ♨️). E beside a 😎 show-off checks them.",
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
  "dive",
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
  // The Jumping Pool (24 October 2026): the coach bot knows every guest's height at a glance (it checks the show-offs first), so
  // on Splash Park's targets it made 3.4, 2.9, 3.2, 1.9, 2.0 and 2.2 times the two-star target at difficulties 3 to 18. These ask
  // for about 1.4 of it from difficulty 12, where the Mountain Hot Springs' bot sits (1.3 to 1.5), a little under Splash Park's
  // and the Lagoon's; up to difficulty 11 the scale is held at week-check's ceiling (2.2), which leaves the bot more over the target
  // there (1.4 to 2.3 times).
  // (Remeasured when the hot tub and the massage corner moved to the near side, by the coach: a shorter walk to both.)
  dive: [
    [11, 2.2],
    [13, 1.5],
    [20, 1.7],
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
  // ---- the perks that change a rule (the fun plan, 14 November 2026: "perks become a build"). Each bends how a shift is played
  // or what it pays; the ones with a `catch` have a price in the playing, so one of them is always offered for nothing. `needs`
  // names the incident a perk is about (never offered before it is met) and `challenge` the coach's challenge that adds it to the
  // deck (CHALLENGES, below).
  showboat: {
    icon: "🎭",
    name: "Showboat",
    text: "The streak climbs twice as fast. No making it up after it breaks",
    price: 35,
    catch: true,
    sim: { streakStep: 2, noMakeUp: true },
  },
  secondwind: {
    icon: "💨",
    name: "Second wind",
    text: "A save brings a broken streak back",
    price: 30,
    sim: { secondWind: true },
  },
  redcarpet: {
    icon: "🟥",
    name: "Red carpet",
    text: "Twice the VIPs, each worth double. They wait half as long",
    price: 40,
    catch: true,
    vips: 2,
    sim: { vipScore: 2, vipPatience: 0.5 },
  },
  autograph: {
    icon: "✍️",
    name: "Marco's autograph",
    text: "Marco swims every shift. Send him home happy: 30 s of double points",
    price: 35,
    star: true,
    sim: { autograph: 30 },
    challenge: "vips",
  },
  skates: {
    icon: "🛼",
    name: "Roller skates",
    text: "The coach is 30% faster. He slides like on ice",
    price: 30,
    catch: true,
    sim: { speed: 1.3, ice: true },
  },
  mopwheels: {
    icon: "🧹",
    name: "Mop on wheels",
    text: "A wet spot mopped scores triple. Twice as many swimmers drip",
    price: 25,
    catch: true,
    sim: { mop: 3, drip: 2 },
    challenge: "mops",
  },
  openhouse: {
    icon: "🎈",
    name: "Open house",
    text: "A quarter more guests in every shift",
    price: 35,
    catch: true,
    crowd: 1.25,
  },
  members: {
    icon: "🎟️",
    name: "Members only",
    text: "A quarter fewer guests, each worth a third more. They wait less",
    price: 40,
    catch: true,
    crowd: 0.75,
    sim: { score: 1.35, patience: 0.8 },
    challenge: "threes",
  },
  lastorders: {
    icon: "🔔",
    name: "Last orders",
    text: "Last call lasts twice as long",
    price: 35,
    sim: { lastCall: 2 },
  },
  coolhead: {
    icon: "🧊",
    name: "Cool head",
    text: "Making it up gives the whole streak back, and you have twice as long",
    price: 30,
    sim: { makeUp: 2 },
    challenge: "streaks",
  },
  encore: {
    icon: "🎤",
    name: "Encore",
    text: "The big moment pays double",
    price: 35,
    sim: { big: 2 },
  },
  tipster: {
    icon: "💡",
    name: "Tipster",
    text: "Coaching tips are worth double",
    price: 30,
    sim: { tip: 2 },
  },
  karenmgr: {
    icon: "📋",
    name: "Karen's manager",
    text: "Karen comes every shift. Calming her tips $15 for the date",
    price: 30,
    catch: true,
    needs: "karen",
    must: ["karen"],
    pays: { calmed: 15 },
  },
  dogwalker: {
    icon: "🦴",
    name: "Dog walker",
    text: "The dog comes every shift. Leading it out tips $10 for the date",
    price: 25,
    catch: true,
    needs: "dog",
    must: ["dog"],
    pays: { dogs: 10 },
    challenge: "saves",
  },
  carlfan: {
    icon: "🟥",
    name: "Carl's fan club",
    text: "The cannonball man comes every shift. A red card tips $15 for the date",
    price: 30,
    catch: true,
    needs: "carl",
    must: ["carl"],
    pays: { carded: 15 },
    challenge: "saves",
  },
  hero: {
    icon: "🦸",
    name: "Hero's bonus",
    text: "One more incident every shift. Trouble stopped in time tips $5",
    price: 30,
    catch: true,
    budget: 1,
    pays: { prevented: 5 },
  },
  highroller: {
    icon: "🎰",
    name: "High roller",
    text: "★★★ pays double. Under ★★ pays nothing",
    price: 40,
    catch: true,
    highRoller: true,
    challenge: "threes",
  },
  piggy: {
    icon: "🐷",
    name: "Piggy bank",
    text: "All the money over the goal goes to next week, not half",
    price: 30,
    piggy: true,
    challenge: "dates",
  },
  wishbone: {
    icon: "🤞",
    name: "Double or nothing",
    text: "Marina's wishes pay triple. A missed wish costs $10",
    price: 30,
    catch: true,
    wishes: 3,
    wishMiss: 10,
    challenge: "wishes",
  },
};
export const REROLL_PRICE = 10;
export const SHOP_SIZE = 3;
// A build is six perks at most: a seventh takes the place of one (the limit is what makes a run a build and not a collection).
export const BUILD_SLOTS = 6;
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
// How a simulation knob adds up across perks, gear and the day's rule: seconds are added, switches are or-ed, the rest multiply.
const SIM_ADD = ["warning", "autograph"],
  SIM_FLAG = ["ice", "noMakeUp", "secondWind"];
export function mixSim(into, more = {}) {
  for (const [k, v] of Object.entries(more))
    into[k] = SIM_ADD.includes(k)
      ? (into[k] || 0) + v
      : SIM_FLAG.includes(k)
        ? !!(into[k] || v)
        : (into[k] ?? 1) * v;
  return into;
}
export function perkEffects(owned = [], gear = null) {
  const sim = { speed: 1, dash: 1, patience: 1, cramp: 1, warning: 0, score: 1 },
    director = {},
    pays = {},
    must = [];
  let wishes = 1,
    sponsor = 0,
    vipTip = 0,
    insurance = false,
    crowd = 1,
    vips = 1,
    budget = 0,
    wishMiss = 0,
    star = false,
    highRoller = false,
    piggy = false;
  const items = [...owned.map((id) => PERKS[id]), GEAR[gear]].filter(Boolean);
  for (const p of items) {
    mixSim(sim, p.sim);
    for (const [k, v] of Object.entries(p.director || {})) director[k] = (director[k] ?? 1) * v;
    for (const [k, v] of Object.entries(p.pays || {})) pays[k] = (pays[k] || 0) + v;
    for (const k of p.must || []) if (!must.includes(k)) must.push(k);
    wishes *= p.wishes || 1;
    sponsor += p.sponsor || 0;
    vipTip += p.vipTip || 0;
    insurance ||= !!p.insurance;
    crowd *= p.crowd || 1;
    vips *= p.vips || 1;
    budget += p.budget || 0;
    wishMiss += p.wishMiss || 0;
    star ||= !!p.star;
    highRoller ||= !!p.highRoller;
    piggy ||= !!p.piggy;
  }
  return {
    sim,
    director,
    wishes,
    sponsor,
    vipTip,
    insurance,
    crowd,
    vips,
    budget,
    wishMiss,
    star,
    highRoller,
    piggy,
    pays,
    must,
  };
}

// Whether a perk is in the deck: its incident met (`known`), its challenge done (`done`, the coach's challenges).
export const perkOpen = (id, known = INCIDENT_ORDER, done = null) => {
  const p = PERKS[id];
  if (!p) return false;
  if (p.needs && !known.includes(p.needs)) return false;
  if (!Object.keys(p.director || {}).every((k) => known.includes(k))) return false;
  return !p.challenge || !done || done.includes(p.challenge);
};
// Three perks the coach does not have yet, from a seeded draw (`roll` counts rerolls so each gives a new hand). A sign against an
// incident is only offered once the player has met it (`known`): no "No bombs sign" before the cannonball man has come.
export function shopOffer(week, roll = 0, known = INCIDENT_ORDER, done = null, only = null) {
  const random = stream(
    (week.seed ^ Math.imul(week.shift + 1, 2246822519) ^ Math.imul(roll + 1, 3266489917)) >>> 0,
  );
  const pool = Object.keys(PERKS).filter(
    (id) => !week.perks.includes(id) && perkOpen(id, known, done) && (!only || only(PERKS[id])),
  );
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, SHOP_SIZE);
}
// The pick after a shift passed (the fun plan: "a pick, not a shop"): three perks, one to take. Two cost what they cost, out of
// the Date Fund (one money); one with a catch is free, so even a coach saving every dollar builds something. A gift (`week.pick
// .gift`: a veteran's Monday, Marina's gift after a deluxe date) is three for nothing. Returns [{ id, price, free }], or [] when
// there is no pick to make.
export function pickOffer(save) {
  const week = save?.week;
  if (!week?.pick) return [];
  // (a first run's first picks are plain perks, nothing with a catch: the free one is simply the first. No roller skates for
  // someone on their second shift.)
  const learner =
      !week.pick.gift && (save.runs || 0) === 0 && !save.finale && week.chapter === 1 && week.shift <= 3,
    chapter = chapterFor(week.chapter),
    hand = shopOffer(
      { ...week, shift: week.shift + (week.pick.gift ? 17 : 0) },
      week.pick.roll || 0,
      save.known,
      save.done,
      learner ? (p) => !p.catch : null,
    );
  if (learner)
    return hand.map((id, i) => ({ id, free: i === 0, price: i === 0 ? 0 : perkPrice(id, chapter) }));
  // (the free one: the first with a catch in the whole deck's order for this draw, swapped in for the hand's last)
  if (!week.pick.gift && !hand.some((id) => PERKS[id].catch)) {
    const random = stream((week.seed ^ Math.imul(week.shift + 7, 0x85ebca6b) ^ (week.pick.roll || 0)) >>> 0),
      catches = Object.keys(PERKS).filter(
        (id) => PERKS[id].catch && !week.perks.includes(id) && perkOpen(id, save.known, save.done),
      );
    if (catches.length && hand.length) hand[hand.length - 1] = catches[Math.floor(random() * catches.length)];
  }
  const freeOne = week.pick.gift ? null : hand.find((id) => PERKS[id].catch);
  return hand.map((id) => {
    const free = !!week.pick.gift || id === freeOne;
    return { id, free, price: free ? 0 : perkPrice(id, chapter) };
  });
}
// Take one of the three (`drop`: the perk it replaces when the six slots are full). Returns whether it was taken.
export function takePick(save, id, drop = null) {
  const week = save?.week,
    offer = pickOffer(save).find((o) => o.id === id);
  if (!week || !offer || week.fund < offer.price) return false;
  if (week.perks.length >= BUILD_SLOTS) {
    if (!week.perks.includes(drop)) return false;
    week.perks = week.perks.filter((p) => p !== drop);
  }
  week.fund -= offer.price;
  week.spent = (week.spent || 0) + offer.price;
  week.perks.push(id);
  week.pick = null;
  save.build = [...week.perks];
  if (Array.isArray(save.scrap) && !save.scrap.includes("perk:" + id)) save.scrap.push("perk:" + id);
  return true;
}
export function skipPick(save) {
  if (save?.week) save.week.pick = null;
}
// Three others, out of the Date Fund.
export function rerollPick(save) {
  const week = save?.week,
    price = week ? rerollPrice(chapterFor(week.chapter)) : 0;
  if (!week?.pick || week.pick.gift || week.fund < price) return false;
  week.fund -= price;
  week.spent = (week.spent || 0) + price;
  week.pick.roll = (week.pick.roll || 0) + 1;
  return true;
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
  // (The Jumping Pool: clean dives, a few of them, from any board.)
  dives: {
    icon: "✨",
    text: (n) => `${n} clean dive${n > 1 ? "s" : ""}`,
    say: "Show me some perfect dives! ✨",
    fits: (s) => !!s.dive,
    goal: (s) => Math.max(3, Math.min(8, Math.round(s.total * 0.3))),
    met: (r, n, st) => (st.cleanDives || 0) >= n,
    pay: 25,
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
const NO_LAP_LANES = ["disco", "kids", "river", "wave", "roof", "onsen", "dive"];

// The wishes of one shift: two that fit it, drawn from its seed. Each says its target and what it pays.
export function drawWishes(shape, random, payScale = 1, count = WISHES_PER_SHIFT) {
  const fitting = Object.entries(WISHES).filter(([, w]) => !w.fits || w.fits(shape));
  for (let i = fitting.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [fitting[i], fitting[j]] = [fitting[j], fitting[i]];
  }
  return fitting.slice(0, count).map(([id, w]) => {
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
  must = [],
  quiet = false,
  twists = [],
}) {
  const slots = (blueprint.chaos || []).length;
  // Gentle at first: the first shifts of the first week have nothing, then the count follows the blueprint, with a little
  // give either way so a player cannot count on it.
  let count = slots;
  if (slots > 0) count = Math.max(1, slots + (random() < 0.3 ? -1 : random() < 0.35 ? 1 : 0));
  count = Math.min(slots + heat + 1, count + extraBudget + heat);
  // A surprise: the next incident in the order, in every shift from the first Tuesday until the player has met them all.
  const next = INCIDENT_ORDER.find((k) => !known.includes(k)),
    skips = venueSkips(venue);
  random(); // (the roll the surprise used to take: kept, so the rest of the draw stays as it was)
  const surprise = next && index >= 1 && !quiet && !skips.includes(next) ? next : null;
  // (a quiet day has no roaming incident at all; a rule's or a perk's incidents come for sure, `must`, where the pool has them)
  if (quiet) count = 0;
  const sure = quiet ? [] : must.filter((k) => known.includes(k) && !skips.includes(k));
  if (surprise && count === 0) count = 1;
  count = Math.max(count, sure.length + (surprise ? 1 : 0));
  const last = new Set(recent[recent.length - 1] || []),
    before = new Set(recent[recent.length - 2] || []);
  const fair = (k, base) => ({
    kind: k,
    weight: base * (weights[k] ?? 1) * (last.has(k) ? RECENT.last : 1) * (before.has(k) ? RECENT.before : 1),
  });
  const pool = [
    ...INCIDENT_ORDER.filter((k) => known.includes(k) && !skips.includes(k)).map((k) =>
      fair(k, INCIDENTS[k].weight),
    ),
    ...Object.entries(VENUE_INCIDENTS)
      .filter(([, i]) => i.where(venue))
      .map(([k, i]) => fair(k, i.weight)),
  ];
  const kinds = [];
  if (surprise) kinds.push(surprise);
  kinds.push(...sure);
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
  // (a day rule's own twists, `twists`, come first and for sure: two busloads are two rushes)
  const forced = twists.filter((k) => allowed.some((t) => t.kind === k));
  const twistCount = Math.max(
    forced.length,
    (blueprint.twist || []).length + (heat > 1 && random() < 0.5 ? 1 : 0),
  );
  const twist = [];
  for (let i = 0; i < twistCount && allowed.length; i++) {
    const options = allowed.filter((t) => !twist.some((x) => x.kind === t.kind));
    if (i >= forced.length && !options.length) break;
    const t = i < forced.length ? { kind: forced[i] } : pickWeighted(random, options);
    twist.push({
      kind: t.kind,
      at: +(0.25 + (0.5 * (i + random())) / twistCount).toFixed(2),
      ...(t.kind === "rush" && { count: blueprint.total >= 24 ? 5 : 3 }),
    });
  }
  twist.sort((a, b) => a.at - b.at);
  return { chaos, twist, incidents: [...new Set(kinds)], surprise };
}

// ---- the day's rules, and the doors (the fun plan, 14 November 2026) ------------------------------------------------------
//
// Every day has a rule: a setting of what the game already has (a bigger crowd, shorter tempers, an incident for sure), and what
// it pays for the trouble. Before a shift the coach picks a DOOR: a pool, a day rule and a pay. The first door is the day's own
// pool; the second is a pool from later in the week (taking it swaps the two days, so a week is still six different pools) with
// a spicier rule; the third, some days, is a mystery. Pool x day rule x the coach's perks is what makes two runs differ.
//   crowd, time   multiply the guests and the shift's length          vipExtra    more VIPs
//   sim           knobs the simulation reads, like a perk's           must        incidents that come for sure
//   budget        more incidents     maxChaos   more at once          twists      mid-shift twists for sure
//   quiet         no roaming incident                                 wishes      how many wishes Marina has
//   golden        golden guests      star       Marco swims           inspector   a clean pool pays, a dirty one costs
//   not           the pools it makes no sense in                      needs       an incident that must be known
//   challenge     the coach's challenge that adds it to the deck (CHALLENGES)
export const RULES = {
  regular: { icon: "🏊", name: "Regular day", note: "Just a normal shift", payout: 1, danger: 1 },
  quiet: {
    icon: "😌",
    name: "Quiet day",
    note: "No trouble walks in. It pays less",
    payout: 0.8,
    danger: 1,
    quiet: true,
  },
  doubledate: {
    icon: "💌",
    name: "Double date",
    note: "Marina has three wishes today",
    payout: 1,
    danger: 1,
    wishes: 3,
  },
  heatwave: {
    icon: "🥵",
    name: "Heatwave",
    note: "More guests, and nobody waits long",
    payout: 1.25,
    danger: 2,
    crowd: 1.15,
    sim: { patience: 0.75 },
  },
  vipnight: {
    icon: "👑",
    name: "VIP night",
    note: "Three more VIPs. They do not wait",
    payout: 1.2,
    danger: 2,
    vipExtra: 3,
    not: ["kids"],
  },
  rush: {
    icon: "🚌",
    name: "Coach party",
    note: "Two busloads arrive at once",
    payout: 1.2,
    danger: 2,
    twists: ["rush", "rush"],
  },
  rain: {
    icon: "💦",
    name: "Wet floor day",
    note: "Every swimmer drips on the deck",
    payout: 1.2,
    danger: 2,
    sim: { drip: 5 },
    not: ["roof", "onsen", "river", "wave", "dive"],
  },
  marco: {
    icon: "🏅",
    name: "Marco's fan day",
    note: "Marco swims, and his fans come to watch",
    payout: 1.15,
    danger: 2,
    star: true,
    crowd: 1.15,
    not: ["kids", "roof", "aquatic"],
  },
  freeentry: {
    icon: "🎈",
    name: "Free entry day",
    note: "A third more guests",
    payout: 1.25,
    danger: 2,
    crowd: 1.35,
  },
  heavylegs: {
    icon: "🥱",
    name: "Heavy legs",
    note: "The coach is 15% slower today",
    payout: 1.3,
    danger: 2,
    sim: { speed: 0.85 },
  },
  powersaver: {
    icon: "⚡",
    name: "Power saver",
    note: "The lights will go out",
    payout: 1.25,
    danger: 2,
    must: ["outage"],
    needs: "outage",
  },
  dogshow: {
    icon: "🐩",
    name: "Dog show",
    note: "Two dogs get loose",
    payout: 1.25,
    danger: 2,
    must: ["dog", "dog"],
    needs: "dog",
  },
  inspector: {
    icon: "🕵️",
    name: "Health inspector",
    note: "A clean pool pays more. An accident in the water halves the pay",
    payout: 1,
    danger: 2,
    inspector: 25,
    not: ["roof", "river", "wave", "dive", "cruise"],
    challenge: "clean",
  },
  golden: {
    icon: "✨",
    name: "Golden day",
    note: "Three golden guests",
    payout: 1.1,
    danger: 1,
    golden: 3,
    challenge: "runs",
  },
  fullmoon: {
    icon: "🌕",
    name: "Full moon",
    note: "One more incident, and one more at a time",
    payout: 1.4,
    danger: 3,
    budget: 1,
    maxChaos: 1,
    challenge: "spicy",
  },
  short: {
    icon: "⏱️",
    name: "Half day",
    note: "The same crowd in three quarters of the time",
    payout: 1.3,
    danger: 3,
    time: 0.75,
    challenge: "spicy",
  },
  carlbday: {
    icon: "🎂",
    name: "Carl's birthday",
    note: "Three cannonballs, at least",
    payout: 1.4,
    danger: 3,
    must: ["carl", "carl", "carl"],
    needs: "carl",
    challenge: "saves",
  },
  karens: {
    icon: "😡",
    name: "Complaints day",
    note: "Karen comes twice",
    payout: 1.3,
    danger: 3,
    must: ["karen", "karen"],
    needs: "karen",
    challenge: "calm",
  },
  // (Saturday night's last chance, never drawn: finishShift offers it.)
  overtime: {
    icon: "⏰",
    name: "Overtime",
    note: "One last shift for the date. It pays double",
    payout: 2,
    danger: 3,
    never: true,
  },
};
// The venue a pool plays in (its own, or its first level's).
const poolVenue = (id) =>
  POOLS[id]?.style?.venue || SHIFTS[(POOLS[id]?.levels?.[0] || 1) - 1].venue || "club";
// Whether a day rule can be drawn at a pool: the pool allows it, its incidents are known and come there, its challenge is done.
export function ruleFits(id, pool, known = INCIDENT_ORDER, done = null) {
  const r = RULES[id];
  if (!r || r.never || !POOLS[pool]) return false;
  if (r.not?.includes(pool)) return false;
  if (r.needs && !known.includes(r.needs)) return false;
  const skips = venueSkips(poolVenue(pool));
  if ((r.must || []).some((k) => skips.includes(k) || !known.includes(k))) return false;
  if ((r.twists || []).some((k) => (POOLS[pool].twists?.[k] ?? 1) <= 0)) return false;
  if (r.star && POOLS[pool].style?.noStar) return false;
  return !r.challenge || !done || done.includes(r.challenge);
}
const doorOf = (rule, pool, extra = {}) => {
  const r = RULES[rule];
  return {
    id: rule + "@" + pool,
    rule,
    pool,
    swap: null,
    icon: r.icon,
    name: r.name,
    note: r.note,
    payout: r.payout,
    danger: r.danger,
    ...extra,
  };
};
// The doors of the week's next shift (`week`: its pools, seed, shift; `week.done`: the challenges done, or null for every rule;
// `week.veteran`: a run that starts with a real Monday). `seen`: the pools played: a pool's first visit is a regular day.
export function dayDoors(week, known = week.known || [], seen = null) {
  const index = week.shift,
    step = stepOf(week),
    pools = week.pools || weekPools(week.chapter, week.seed),
    today = pools[index] || "club",
    done = week.done ?? null,
    finale = week.chapter === FINALE_WEEK && index === SHIFTS_PER_WEEK - 1 && today === FINALE_POOL;
  if (week.overtime) return [doorOf("overtime", today)];
  // One door is no choice: the season finale, the first two shifts of a first run, a lesson.
  if (finale || week.lesson || (step < 2 && !week.veteran)) return [doorOf("regular", today)];
  const random = stream((week.seed ^ Math.imul(index + 7, 40503)) >>> 0),
    pick = (list) => list[Math.floor(random() * list.length)],
    fresh = (p) => !!seen && !seen.includes(p),
    fitting = (pool, test) =>
      Object.keys(RULES).filter(
        (id) => id !== "regular" && ruleFits(id, pool, known, done) && test(RULES[id]),
      );
  const doors = [];
  // The day's own pool: a regular day as often as not, else something mild.
  const mild = fitting(today, (r) => r.danger <= 2);
  doors.push(doorOf(fresh(today) || random() < 0.45 || !mild.length ? "regular" : pick(mild), today));
  // A pool from later in the week (never the finale's day), with something spicier. Taking it swaps the two days.
  const swapFine = (j) => {
    const after = [...pools];
    [after[index], after[j]] = [after[j], after[index]];
    return [index, j].every((d) => after[d] !== after[d - 1] && after[d] !== after[d + 1]);
  };
  const later = pools
    .map((p, j) => j)
    .filter(
      (j) =>
        j > index &&
        pools[j] !== today &&
        swapFine(j) && // (never the same pool two days running, before or after the swap)
        !(week.chapter === FINALE_WEEK && j === SHIFTS_PER_WEEK - 1),
    );
  const j = later.length ? pick(later) : null,
    other = j === null ? today : pools[j],
    spicy = fitting(other, (r) => r.danger >= 2).filter((id) => other !== today || id !== doors[0].rule);
  if (fresh(other) && other !== today) doors.push(doorOf("regular", other, { swap: j }));
  else if (spicy.length) doors.push(doorOf(pick(spicy), other, { swap: other === today ? null : j }));
  // The mystery, from the fifth shift of a run, six days in ten: a rule nobody names, for a little more.
  const hidden = fitting(today, () => true).filter(
    (id) => !doors.some((d) => d.rule === id && d.pool === today),
  );
  if (step >= 4 && hidden.length && random() < 0.6) {
    const rule = pick(hidden);
    doors.push(
      doorOf(rule, today, {
        id: "mystery",
        icon: "🎲",
        name: "Mystery gig",
        note: "Who knows what walks in? It pays well",
        payout: +Math.max(1.3, RULES[rule].payout + 0.15).toFixed(2),
        danger: 3,
        mystery: true,
      }),
    );
  }
  return doors;
}

// The pairs of incidents that make a crossover when they meet, and how often a shift is given one (from the run's sixth shift).
export const PAIRS = [
  ["karen", "dog"],
  ["outage", "karen"],
  ["influencer", "carl"],
];
export const PAIR_CHANCE = 0.2;
// Gives a shift's plan a crossover: the second incident of a pair a few seconds after the first (added if the plan had none).
// Returns the pair, or null. Changes `plan` in place.
function pairUp(plan, blueprint, random, known, step, gentle, last = []) {
  if (gentle || step < 5 || random() >= PAIR_CHANCE) return null;
  const venue = blueprint.venue,
    skips = venueSkips(venue),
    entry = (kind) => plan.chaos.find((c) => c.kinds[0] === kind),
    can = (k) =>
      VENUE_INCIDENTS[k]
        ? VENUE_INCIDENTS[k].where(venue)
        : known.includes(k) && !skips.includes(k) && !!INCIDENTS[k],
    // (one of the two is in the day's plan already, and the other did not come yesterday: the mix stays fair)
    options = PAIRS.filter(
      ([a, b]) =>
        can(a) && can(b) && (entry(a) || entry(b)) && [a, b].every((k) => entry(k) || !last.includes(k)),
    );
  if (!options.length) return null;
  const [a, b] = options[Math.floor(random() * options.length)],
    middle = Math.round(blueprint.duration * (0.3 + random() * 0.3)),
    first = entry(a) || { kinds: [a], window: [middle, middle + 2] };
  if (!plan.chaos.includes(first)) plan.chaos.push(first);
  const at =
      entry(a) && entry(b) ? Math.min(first.window[0], entry(b).window[0]) : (entry(b) || first).window[0],
    second = entry(b) || { kinds: [b], window: [0, 0] };
  if (!plan.chaos.includes(second)) plan.chaos.push(second);
  first.window = [at, at + 1];
  second.window = [at + 5, at + 7];
  plan.incidents = [...new Set(plan.chaos.map((c) => c.kinds[0]))];
  return [a, b];
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
    // (the overtime shift is Saturday played again: its own draws, `key`)
    key = index + (week.overtime ? 40 : 0),
    step = stepOf(week),
    // A run's very first shift is the gentle minute, unless the coach is a veteran (a real Monday: the fun plan).
    gentle = step <= 0 && !week.veteran && !week.overtime,
    random = stream((week.seed ^ Math.imul(key + 1, 2654435761)) >>> 0),
    // The doors of the day, and the one taken: without one, the day's own pool on a regular day (the overtime has one door).
    doors = dayDoors(week, known, seen),
    chosen = week.overtime ? doors[0] : (card && doors.find((c) => c.id === card)) || null,
    rule = RULES[chosen?.rule] || RULES.regular,
    poolOf = chosen?.pool || (week.pools || weekPools(week.chapter, week.seed))[index] || "club",
    // The season finale: Saturday of week 4 at the Grand Gala Arena, at the top of the week's band (never eased).
    finale = week.chapter === FINALE_WEEK && index === SHIFTS_PER_WEEK - 1 && poolOf === FINALE_POOL,
    firstVisit = !!seen && step > 0 && !finale && !week.overtime && !seen.includes(poolOf),
    // (free play names its own difficulty: `week.tier`, freePlayShift)
    drawn =
      finale || week.overtime
        ? bandOf(week.chapter)[1]
        : week.tier
          ? Math.max(1, Math.min(TOP_TIER, Math.floor(week.tier)))
          : // (a veteran's Monday is a real shift: Tuesday's draw, not the gentle minute's level 1)
            tierFor(
              week.chapter,
              week.veteran && step <= 0 ? 1 : index,
              stream((week.seed ^ Math.imul(step + 11, 2246822519)) >>> 0),
            ),
    // (a veteran's first week is two levels up: a run that starts again starts where the game is a game, VETERAN_LEVELS)
    lifted = week.veteran && !week.tier ? Math.min(TOP_TIER, drawn + VETERAN_LEVELS) : drawn,
    tier = firstVisit
      ? Math.max(Math.min(lifted, bandOf(week.chapter)[0]), lifted - FIRST_VISIT_EASE)
      : lifted,
    heat = heatOf(week.chapter),
    // Past the last band: a bigger crowd and higher targets every week (at most half as much again).
    f = Math.min(1.5, 1 + 0.1 * heat);
  // The perks of the build and the gear the coach wears (`week.gear`, set by week-ui from the save), and the conditions the
  // player took on for an endless week (`week.heat`, HEAT_RULES).
  const gear = GEAR[week.gear] ? week.gear : null,
    effects = perkEffects(week.perks, gear),
    conditions = (week.heat || []).map((id) => HEAT_RULES[id]).filter(Boolean);
  // The day's pool, and the shift: the difficulty's level for its length, crowd, star targets and the number of incidents and twists,
  // in the pool's look.
  const poolId = poolOf,
    pool = POOLS[poolId],
    look = poolLook(poolId, tier, stream((week.seed ^ Math.imul(key + 5, 1597334677)) >>> 0)),
    ref = SHIFTS[tier - 1],
    crowd = pool.crowd || 1,
    // (the last call and making it up add points to every shift but the gentle minute: the star targets follow, FUN_SCALE)
    k = scoreScale(look.venue, tier) * tierScale(tier) * crowd * (gentle ? 1 : FUN_SCALE);
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
  // moment of his own; for sure on his fan day and with his autograph in the build.
  const starRoll = stream((week.seed ^ Math.imul(key + 9, 2654435789)) >>> 0),
    starSure = !gentle && (rule.star || effects.star);
  if (look.noStar) delete blueprint.star;
  else if (look.star) blueprint.star = look.star;
  else if (starRoll() < STAR_CHANCE || starSure)
    blueprint.star = { ...MARCO, at: +(0.25 + starRoll() * 0.4).toFixed(2) };
  // Daredevils (Splash Park and the five-lane pools after it): as many as the pool's level has, for its crowd (one at least).
  if (look.daredevilAt) {
    const count = Math.max(1, Math.round((look.daredevilAt.length * ref.total) / look.nativeTotal));
    blueprint.daredevilAt = pickFractions(look.daredevilAt, Math.min(count, look.daredevilAt.length));
  }
  if (gentle) {
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
  // The crowd of the day (the rule's, the build's, the week's conditions): more guests are more points to be had, so the star
  // targets follow halfway. A half day is the same crowd in less time.
  const more = gentle
    ? 1
    : (rule.crowd || 1) * effects.crowd * conditions.reduce((m, c) => m * (c.crowd || 1), 1);
  if (more !== 1)
    blueprint = {
      ...blueprint,
      total: Math.max(4, Math.round(blueprint.total * more)),
      thresholds: blueprint.thresholds.map((t) => Math.round((t * (1 + (more - 1) * 0.5)) / 50) * 50),
    };
  if (rule.time && !gentle)
    blueprint = {
      ...blueprint,
      duration: Math.max(60, Math.round((blueprint.duration * rule.time) / 5) * 5),
    };
  if (rule.maxChaos) blueprint.maxChaos = (blueprint.maxChaos || 1) + rule.maxChaos;
  // The finale is no door to pick: a regular day, the biggest of the season.
  const cards = doors;
  const plan = directShift({
    blueprint,
    venue: blueprint.venue,
    random,
    known,
    index: step,
    heat,
    extraBudget:
      (chosen?.mystery ? 1 : 0) +
      (rule.budget || 0) +
      effects.budget +
      conditions.reduce((n, c) => n + (c.budget || 0), 0),
    weights: effects.director,
    twistWeights: pool.twists,
    recent: week.history.map((h) => (Array.isArray(h?.incidents) ? h.incidents : [])),
    must: gentle ? [] : [...(rule.must || []), ...effects.must],
    quiet: !!rule.quiet,
    twists: rule.twists || [],
  });
  // A crossover, now and then (the fun plan: "incidents meet"): two incidents that have something to say to each other come
  // seconds apart, so they are on the deck together (CROSSOVERS, sim.mjs `find`).
  const paired = pairUp(
    plan,
    blueprint,
    stream((week.seed ^ Math.imul(key + 19, 0x165667b1)) >>> 0),
    known,
    step,
    gentle,
    week.history[week.history.length - 1]?.incidents || [],
  );
  if (paired) blueprint.maxChaos = Math.max(2, blueprint.maxChaos || 1);
  const { chaos: _c, twist: _t, intro: _i, booking: _b, payout: _p, ...rest } = blueprint;
  // VIPs: the run's count (none in the first shift), the lagoon's and arena's own share of their crowd, and the pool's extra;
  // twice as many on the red carpet, three more on a VIP night.
  const nativeVips = look.nativeVips ? Math.round((look.nativeVips * rest.total) / look.nativeTotal) : 0,
    baseVips = Math.min(7, Math.max(vipCount(step), nativeVips) + (step <= 0 ? 0 : pool.vipBonus || 0)),
    vips = gentle ? baseVips : Math.min(9, Math.round(baseVips * effects.vips) + (rule.vipExtra || 0));
  // The golden guests (the fun plan: a rare jackpot): three on a golden day, else one in about one shift in ten from the first
  // Thursday, at a moment of the shift's own.
  const goldRoll = stream((week.seed ^ Math.imul(key + 17, 0x27d4eb2f)) >>> 0),
    golden = gentle
      ? []
      : rule.golden
        ? Array.from(
            { length: rule.golden },
            (_, i) => +(0.2 + (0.6 * (i + goldRoll())) / rule.golden).toFixed(2),
          )
        : step >= 3 && goldRoll() < GOLDEN_CHANCE
          ? [+(0.25 + goldRoll() * 0.5).toFixed(2)]
          : [];
  const config = {
    ...rest,
    name: pool.name, // under the HUD's "WEEK 1 · MON · 1/6", and on the countdown
    day: DAYS[index],
    pool: poolId,
    place: pool.name,
    label: finale ? "Season finale" : week.overtime ? "Overtime" : look.label,
    chaos: plan.chaos,
    twist: plan.twist,
    ...(vips > 0 && { vipAt: vipSlots(vips, random) }),
    week: { chapter: week.chapter, shift: index },
    ...(finale && { finale: true }),
    // The shift's big moment (Phase 3, big-moment.mjs): every shift but the gentle first one, about two thirds of the way.
    ...(!gentle && { big: planBig(stream((week.seed ^ Math.imul(key + 13, 2654435761)) >>> 0)) }),
    // The rules of the fun plan the simulation plays by (last call, making it up, the director's breath: sim.mjs `fun`).
    fun: { ...FUN },
    ...(golden.length && { golden }),
    ...(chosen && chosen.rule !== "regular" && { rule: chosen.rule }),
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
    dive: config.venue === "dive",
  };
  const wishes = drawWishes(
    shape,
    stream((week.seed ^ Math.imul(key + 3, 362437)) >>> 0),
    chapter.pay,
    rule.wishes || WISHES_PER_SHIFT,
  );
  // What the simulation's knobs add up to: the build, the gear, the day's rule and the week's conditions.
  const perks = { ...effects.sim };
  mixSim(perks, rule.sim);
  for (const c of conditions) mixSim(perks, c.sim);
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
    booking: null,
    cards,
    card: chosen,
    rule: chosen?.rule || "regular",
    wishes,
    plan,
    pass: passMark(config),
    perks,
    gear,
    finale,
    firstVisit,
    overtime: !!week.overtime,
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
      lesson: true, // (one door: free play picks no day rule)
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

// What a shift pays in week 1: a little for passing, more for each star, and the third star most of all (the fun plan: "three
// stars are worth chasing"; until 14 November 2026 every star paid the same $15).
export const PAY = { base: 15, star: 15, third: 25 };
// A shift is passed when its score reaches the pass mark, half of its first star: below it the pool was a mess and the shift
// pays nothing (the week goes on). It is on screen before the shift and in the HUD during it.
export const PASS_SHARE = 0.5;
export const passMark = (config) => Math.max(50, Math.round((config.thresholds[0] * PASS_SHARE) / 50) * 50);

// What a shift pays into the Date Fund: a little for finishing, more for each star, by the chapter and the door's pay.
export function shiftPay(stars, chapter, card) {
  if (stars < 0) return 0;
  const n = Math.min(3, stars);
  return roundPay(
    (PAY.base + PAY.star * Math.min(2, n) + (n >= 3 ? PAY.third : 0)) * chapter.pay * (card?.payout || 1),
  );
}

// ---- the rules of the fun plan (14 November 2026) ------------------------------------------------------------------------
// What the simulation plays by in every shift of a week and of free play (`config.fun`; a shift recorded before has none, and
// replays as it was): the last call, making it up, and the director's hold, breath and fill (sim.mjs, chaos.mjs).
export const FUN = {
  lastCall: 25, // the last seconds of a shift, when everything scores more
  lastCallScale: 1.5,
  makeUp: 12, // seconds to make up for a broken streak: the next good thing pays double and gives half the streak back
  hold: 3, // the director starts no new incident while this many things want the coach (one more for each coach more)
  breath: 8, // seconds of nothing new after an incident ends
  calm: 10, // from level 6: seconds of nothing for the coach's body before the director fills the calm
};
// What the last call and making it up add to a shift's points, measured with the coach bots (tools/fun-report.mjs): the star
// targets of every shift played by these rules are raised by as much.
export const FUN_SCALE = 1.1;
// A golden guest in about one shift in ten: serve them happy and they pay a star's worth (`PAY.star`) into the Date Fund.
export const GOLDEN_CHANCE = 0.1;
// Overtime: short by a fifth or less on Saturday night, one sudden-death shift decides it, once in a run.
export const OVERTIME_SHARE = 0.8;
// The surplus counts: half of what is over the goal starts next week's fund, and a week that ends this far over it is a deluxe
// date (a gold edge in the album, and a gift from Marina on Monday: three perks, one to take, for nothing).
export const CARRY_SHARE = 0.5;
export const DELUXE = 1.5;
// A veteran's Monday: from the third run, no gentle minute, and a free pick of one perk from three before it.
export const VETERAN_RUNS = 2;
export const VETERAN_LEVELS = 2;
// The conditions of an endless week (after the story's ending): each makes every shift of the week harder and pays a tenth
// more; a week won with two or more is a gold date too.
export const HEAT_RULES = {
  tempers: {
    icon: "😤",
    name: "Short tempers",
    text: "Every guest waits a fifth less",
    sim: { patience: 0.8 },
  },
  trouble: { icon: "🌪️", name: "Double trouble", text: "One more incident in every shift", budget: 1 },
  packed: { icon: "🧑‍🤝‍🧑", name: "Packed house", text: "A fifth more guests", crowd: 1.2 },
};
export const HEAT_PAY = 0.1;
export const heatOpen = (save) =>
  !!save?.finale &&
  !!save.week &&
  save.week.chapter > FINALE_WEEK &&
  save.week.shift === 0 &&
  !save.week.history.length;
export function setHeat(save, ids = []) {
  if (!heatOpen(save)) return false;
  save.week.heat = [...new Set(ids.filter((id) => HEAT_RULES[id]))];
  return true;
}

// ---- the coach's challenges, and the scrapbook (what lasts: the fun plan, step 7) -----------------------------------------
// A challenge counts something over every run (`save.tally`), so a lost run still moves the next one forward; done, it adds
// perks and day rules to the decks for good (`challenge` in PERKS and RULES).
export const CHALLENGES = {
  vips: { icon: "👑", name: "Red rope", text: "Serve 25 VIPs", goal: 25 },
  mops: { icon: "🧹", name: "Spotless", text: "Mop 20 wet spots", goal: 20 },
  threes: { icon: "🌟", name: "Hat-trick", text: "Earn ★★★ in 10 shifts", goal: 10 },
  streaks: { icon: "🔥", name: "Unstoppable", text: "Reach a streak of 12 in 5 shifts", goal: 5 },
  saves: { icon: "🛡️", name: "Trouble-shooter", text: "Stop trouble in time 30 times", goal: 30 },
  wishes: { icon: "💌", name: "Wish granted", text: "Make 20 of Marina's wishes come true", goal: 20 },
  dates: { icon: "💖", name: "Going steady", text: "Go on 3 dates", goal: 3 },
  spicy: { icon: "🌶️", name: "Daredevil", text: "Pass 8 shifts behind a risky door", goal: 8 },
  clean: { icon: "💧", name: "Crystal clear", text: "10 shifts without an accident in the water", goal: 10 },
  calm: { icon: "😡", name: "Customer service", text: "Calm Karen 6 times", goal: 6 },
  runs: { icon: "🔁", name: "Back again", text: "Start over twice", goal: 2 },
};
export const CHALLENGE_IDS = Object.keys(CHALLENGES);
// What a challenge adds to the decks.
export const challengeOpens = (id) => [
  ...Object.entries(PERKS)
    .filter(([, p]) => p.challenge === id)
    .map(([key, p]) => ({ kind: "perk", id: key, icon: p.icon, name: p.name })),
  ...Object.entries(RULES)
    .filter(([, r]) => r.challenge === id)
    .map(([key, r]) => ({ kind: "rule", id: key, icon: r.icon, name: r.name })),
];
// The scrapbook: everything a run can show that is worth keeping a note of (`save.scrap`): the day rules played, the perks
// taken, the crossovers (two incidents meeting, sim.mjs `find`) and a few moments.
export const CROSSOVERS = {
  viral: { icon: "📱", name: "It went viral", text: "The influencer filmed a cannonball" },
  dark: { icon: "🔦", name: "Karen in the dark", text: "Karen complained through a power cut" },
  chase: { icon: "🐕", name: "Seen off", text: "The dog chased Karen out" },
  royal: { icon: "💆", name: "The royal treatment", text: "A VIP on the massage table" },
};
export const SCRAP = {
  ...Object.fromEntries(
    Object.entries(RULES)
      .filter(([id]) => id !== "regular")
      .map(([id, r]) => ["rule:" + id, { icon: r.icon, name: r.name, text: r.note }]),
  ),
  ...Object.fromEntries(
    Object.entries(PERKS).map(([id, p]) => ["perk:" + id, { icon: p.icon, name: p.name, text: p.text }]),
  ),
  ...Object.fromEntries(Object.entries(CROSSOVERS).map(([id, c]) => ["cross:" + id, c])),
  "guest:golden": { icon: "✨", name: "The golden guest", text: "Sent home happy" },
  "date:deluxe": { icon: "💎", name: "A deluxe date", text: "A week that ended far over its goal" },
  "week:overtime": { icon: "⏰", name: "Buzzer beater", text: "A date won in overtime" },
};
export const SCRAP_IDS = Object.keys(SCRAP);

// A week starts: its seed, and its six pools drawn from the ones the player has opened (`save.ladder`), a pool never played in it
// for sure (kept in the save, so the week stays as drawn). It starts with the run's build (`save.build`), with what last week left
// over its goal (`save.carry`), and with a free pick when the coach is a veteran starting a run or Marina has a gift (both
// taken out of the save here).
export function newWeek(save, seed = Date.now()) {
  const s = seed >>> 0 || 1,
    open = openPools(save.ladder ?? LADDER.length, save.chapter),
    // (a pool never played comes for sure; without a list of the pools played, none is new)
    fresh = Array.isArray(save.seen) ? open.filter((id) => !save.seen.includes(id)) : [],
    carry = Math.max(0, Math.floor(Number(save.carry)) || 0),
    veteran = save.chapter === 1 && (save.runs || 0) >= VETERAN_RUNS,
    gift = veteran || !!save.gift;
  save.carry = 0;
  save.gift = false;
  return {
    chapter: save.chapter,
    seed: s,
    pools: weekPools(save.chapter, s, open, fresh),
    shift: 0,
    fund: carry,
    peak: carry, // the most the fund has held this week (Marina's texts come once, on the way up)
    spent: 0, // what the picks took from it
    carried: carry,
    perks: (Array.isArray(save.build) ? save.build : []).filter((p) => PERKS[p]).slice(0, BUILD_SLOTS),
    rolls: 0,
    history: [],
    status: "playing", // "playing" | "won" | "lost"
    ...(veteran && { veteran: true }),
    pick: gift ? { gift: true, roll: 0 } : null,
    overtime: false,
    heat: [],
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
// The fun plan (14 November 2026) adds the run's build (`build`), what a week left over (`carry`), Marina's gift (`gift`), the
// overtime used (`overtimeUsed`), the pools whose intro cinematic the run has shown (`shown`), and what lasts: the challenges'
// counts and the ones done (`tally`, `done`), the scrapbook (`scrap`) and the gold dates (`gold`).
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
  const perkList = (list) =>
    Array.isArray(list) ? [...new Set(list.filter((p) => PERKS[p]))].slice(0, BUILD_SLOTS) : [];
  const tally = {};
  for (const id of CHALLENGE_IDS) tally[id] = count(s.tally?.[id]);
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
      carried: count(w.carried),
      perks: perkList(w.perks),
      rolls: count(w.rolls, 1e4),
      history: Array.isArray(w.history) ? w.history.slice(0, SHIFTS_PER_WEEK + 1) : [],
      status: "playing",
      ...(w.veteran && { veteran: true }),
      pick:
        w.pick && typeof w.pick === "object" ? { gift: !!w.pick.gift, roll: count(w.pick.roll, 1e4) } : null,
      overtime: !!w.overtime,
      heat: Array.isArray(w.heat) ? [...new Set(w.heat.filter((id) => HEAT_RULES[id]))] : [],
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
    lesson2: !!s.lesson2,
    ladder,
    album,
    stars,
    gear: GEAR[s.gear] && stars >= GEAR[s.gear].stars ? s.gear : null,
    best,
    finale: !!s.finale,
    build: week ? [...week.perks] : s.v === 2 ? perkList(s.build) : [],
    carry: s.v === 2 ? count(s.carry) : 0,
    gift: !!s.gift,
    overtimeUsed: !!s.overtimeUsed,
    shown: Array.isArray(s.shown) ? [...new Set(s.shown.filter((p) => POOLS[p]))] : [],
    tally,
    done: Array.isArray(s.done) ? [...new Set(s.done.filter((id) => CHALLENGES[id]))] : [],
    scrap: Array.isArray(s.scrap) ? [...new Set(s.scrap.filter((id) => SCRAP[id]))] : [],
    gold: Array.isArray(s.gold) ? [...new Set(s.gold.filter(isDate))] : [],
    week,
  };
}

// A shift is over. Returns what happened (for the results screen) and changes `save` (and its week) in place:
//   failed   below the pass mark: it pays nothing (half with the safety net), and the week goes on
//   last     Saturday's shift: Sunday decides. `won` when the Date Fund reached the goal (a date, and the next week), else
//            `over`: the run is lost and the next one starts again at week 1, unless the fund is within a fifth of the goal and
//            the run has not used it: then `overtime`, one last shift that pays double and decides it
// A level passed opens in free play, with every level below it. What lasts (Phase 2): the stars go to the coach's total (and may
// open gear, `newGear`), the pool's best stars; a date goes in the album (`newDate`) and opens the next pool on the ladder
// (`newPool`); the date of week 4 is the story's ending (`ending`, true the first time). The fun plan: a shift passed leaves a
// pick (`week.pick`); a door from later in the week swaps the two days; the challenges count and may be done (`challenges`);
// what was new goes in the scrapbook (`finds`); a week won carries half its surplus over (`carry`) and may be deluxe.
export function finishShift(save, shift, summary, stats = {}) {
  const week = save.week,
    chapter = chapterFor(week.chapter),
    effects = perkEffects(week.perks, shift.gear),
    rule = RULES[shift.card?.rule] || RULES.regular,
    stars = summary.stars || 0,
    pass = passMark(shift.config),
    passed = (summary.score || 0) >= pass,
    conditions = (week.heat || []).filter((id) => HEAT_RULES[id]).length,
    scale = chapter.pay * (1 + HEAT_PAY * conditions);
  const wishes = checkWishes(shift.wishes, summary, stats);
  // The incidents met: the ones that really started (`summary.met`), not the ones planned (19 October 2026: a shift that ended
  // before its fish came counted the fish as met). Without `met` (an older caller), the plan.
  const met = Array.isArray(summary.met) ? summary.met : shift.plan.incidents;
  for (const k of met) if (INCIDENTS[k] && !save.known.includes(k)) save.known.push(k);
  if (Array.isArray(save.seen) && POOLS[shift.pool] && !save.seen.includes(shift.pool))
    save.seen.push(shift.pool);
  if (shift.config?.tutorial) save.tutorial = true;
  if (shift.config?.tutorial === 2 && summary.lessons) save.lesson2 = true;
  // What lasts: the stars, and the best at this pool.
  const starsBefore = save.stars || 0;
  save.stars = starsBefore + stars;
  const newGear = GEAR_IDS.filter((id) => starsBefore < GEAR[id].stars && save.stars >= GEAR[id].stars);
  if (save.best && POOLS[shift.pool]) save.best[shift.pool] = Math.max(save.best[shift.pool] || 0, stars);
  const insured = !passed && effects.insurance;
  const failed = !passed;
  const unlockedBefore = save.unlocked;
  if (passed) save.unlocked = Math.max(save.unlocked, Math.min(TOP_TIER, shift.tier));
  // The shift's pay: the stars, by the week and the door; the high roller's all or nothing; the inspector's verdict.
  const dirty = (summary.catastrophes || 0) > 0;
  let pay = passed
    ? shiftPay(stars, { pay: scale }, shift.card)
    : insured
      ? roundPay(shiftPay(1, { pay: scale }, shift.card) / 2)
      : 0;
  if (passed && effects.highRoller) pay = stars >= 3 ? pay * 2 : stars >= 2 ? pay : 0;
  if (passed && rule.inspector && dirty) pay = roundPay(pay / 2);
  const inspector = passed && rule.inspector && !dirty ? roundPay(rule.inspector * scale) : 0,
    missed = wishes.filter((w) => !w.met).length,
    wishPay = failed
      ? 0
      : Math.max(
          0,
          wishes.filter((w) => w.met).reduce((sum, w) => sum + roundPay(w.pay * effects.wishes), 0) -
            missed * effects.wishMiss * (effects.wishMiss ? Math.round(scale) : 0),
        ),
    sponsor = passed && effects.sponsor ? roundPay(effects.sponsor * scale) : 0,
    vipTips = passed && effects.vipTip && stats.vips > 0 ? roundPay(effects.vipTip * scale * stats.vips) : 0,
    // What the build's "trouble pays" perks tip (Karen calmed, the dog led out, a red card, trouble stopped in time).
    tips = passed
      ? Object.entries(effects.pays).reduce(
          (sum, [k, v]) => sum + (stats[k] > 0 ? roundPay(v * scale * stats[k]) : 0),
          0,
        )
      : 0,
    golden = passed && stats.golden > 0 ? roundPay(PAY.star * scale * stats.golden) : 0,
    gained = pay + wishPay + sponsor + vipTips + tips + golden + inspector;
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
    ...(shift.card?.rule && shift.card.rule !== "regular" && { rule: shift.card.rule }),
  });
  // A door from later in the week: the two days change places, so the week is still six different pools.
  const swap = shift.card?.swap;
  if (Number.isInteger(swap) && swap > week.shift && swap < SHIFTS_PER_WEEK && Array.isArray(week.pools))
    [week.pools[week.shift], week.pools[swap]] = [week.pools[swap], week.pools[week.shift]];
  // The scrapbook: the day's rule, the crossovers the shift saw, a golden guest sent home happy.
  const finds = [];
  const note = (id) => {
    if (SCRAP[id] && Array.isArray(save.scrap) && !save.scrap.includes(id)) {
      save.scrap.push(id);
      finds.push(id);
    }
  };
  if (shift.card?.rule && shift.card.rule !== "regular" && !shift.overtime) note("rule:" + shift.card.rule);
  for (const id of Array.isArray(summary.finds) ? summary.finds : []) note("cross:" + id);
  if (stats.golden > 0) note("guest:golden");
  // The challenges: what this shift adds to the counts of all runs.
  const add = {
    vips: stats.vips || 0,
    mops: stats.mopped || 0,
    threes: passed && stars >= 3 ? 1 : 0,
    streaks: (summary.bestStreak || 0) >= 12 ? 1 : 0,
    saves: stats.prevented || 0,
    wishes: failed ? 0 : wishes.filter((w) => w.met).length,
    spicy: passed && (shift.card?.danger || 1) >= 2 ? 1 : 0,
    clean: passed && !dirty ? 1 : 0,
    calm: stats.calmed || 0,
  };
  const last = !!week.overtime || week.shift >= SHIFTS_PER_WEEK - 1,
    goal = chapter.goal;
  // What is short of the next star (the results say it: "120 short of ★★★").
  const target = shift.config?.thresholds?.[stars];
  const result = {
    stars,
    pass,
    passed,
    pay,
    wishPay,
    sponsor,
    vipTips,
    tips,
    golden,
    inspector,
    gained,
    wishes,
    insured,
    failed,
    before,
    peakBefore,
    fund: week.fund,
    goal,
    deluxe: roundPay(goal * DELUXE),
    last,
    won: false,
    over: false,
    overtime: false,
    wasOvertime: !!week.overtime,
    carry: 0,
    deluxeDate: false,
    chapter,
    step: shift.step,
    tier: shift.tier,
    unlocked: save.unlocked > unlockedBefore ? save.unlocked : 0,
    surprise: shift.plan.surprise,
    finale: !!shift.finale,
    rule: shift.card?.rule || "regular",
    nextStar:
      stars < 3 && target
        ? { stars: stars + 1, short: Math.max(1, Math.ceil(target - (summary.score || 0))) }
        : null,
    newGear,
    newPool: null,
    newDate: false,
    ending: false,
    finds,
    challenges: [],
    pick: false,
  };
  if (last) {
    result.won = week.fund >= goal;
    if (result.won) {
      week.status = "won";
      save.dates.push(chapter.date.id);
      add.dates = 1;
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
      // The surplus counts: half of it (all, with the piggy bank) starts next week's fund; far over the goal, or with two
      // conditions taken on, the date is deluxe: gold in the album, and a gift from Marina on Monday.
      // (what is over the deluxe line carries nothing more: a great week helps the next one, it does not win it)
      result.carry =
        Math.floor(((Math.min(week.fund, result.deluxe) - goal) * (effects.piggy ? 1 : CARRY_SHARE)) / 5) * 5;
      save.carry = result.carry;
      result.deluxeDate = week.fund >= result.deluxe || conditions >= 2;
      if (result.deluxeDate) {
        save.gift = true;
        if (Array.isArray(save.gold) && !save.gold.includes(chapter.date.id)) save.gold.push(chapter.date.id);
        note("date:deluxe");
      }
      if (week.overtime) note("week:overtime");
      save.build = [...week.perks];
      save.chapter = week.chapter + 1;
      save.bestWeek = Math.max(save.bestWeek, save.chapter);
    } else if (!week.overtime && !save.overtimeUsed && week.fund >= goal * OVERTIME_SHARE) {
      // Saturday night, close: one last shift for the date (once in a run).
      result.overtime = true;
      week.overtime = true;
      week.pick = null;
      save.overtimeUsed = true;
    } else {
      // Game over: the run starts again at week 1 (what was discovered, the pools, the album, the stars and the levels stay;
      // the build, the carry and the gift do not).
      result.over = true;
      week.status = "lost";
      save.runs++;
      add.runs = 1;
      save.chapter = 1;
      save.dates = [];
      save.build = [];
      save.carry = 0;
      save.gift = false;
      save.overtimeUsed = false;
      save.shown = [];
    }
  } else {
    week.shift++;
    week.rolls = 0;
    // A shift passed leaves a pick: three perks, one to take (the fun plan, "a pick, not a shop").
    week.pick = passed ? { roll: 0 } : null;
    result.pick = passed;
  }
  // The challenges done by this shift, and what each adds to the decks.
  if (save.tally && Array.isArray(save.done))
    for (const id of CHALLENGE_IDS) {
      save.tally[id] = (save.tally[id] || 0) + (add[id] || 0);
      if (save.tally[id] >= CHALLENGES[id].goal && !save.done.includes(id)) {
        save.done.push(id);
        result.challenges.push(id);
      }
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
    perShift = left > 0 ? need / left : need,
    deluxe = roundPay(chapter.goal * DELUXE);
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
    deluxe,
    deluxeNeed: Math.max(0, deluxe - week.fund),
  };
}

// The shop of before the fun plan (one money): a perk paid out of the Date Fund. The game now offers a pick after each shift
// (`pickOffer`, `takePick`); these stay for the checks and the tools that buy by name. Returns whether it was bought.
export function buyPerk(week, id) {
  const p = PERKS[id],
    price = perkPrice(id, chapterFor(week.chapter));
  if (!p || week.perks.includes(id) || week.perks.length >= BUILD_SLOTS || week.fund < price) return false;
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
