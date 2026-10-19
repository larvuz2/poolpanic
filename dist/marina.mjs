// Marina: she never walks onto the pool deck. She is in the full-screen cinematics around a week (the invite at its start,
// the date when the Date Fund is full, a rain check when the week is lost), in her texts, and in her wishes for each shift
// (week.mjs WISHES). Pure data and one function.
//
// Videos. Put a file under dist/assets/video/marina/ and name it in VIDEOS against the scene's id (for example
// `"date-icecream": "assets/video/marina/date-icecream.mp4"`): that scene then plays the video full screen, its caption
// under it, and moves on when it ends. A scene with no video, or one whose video cannot play, shows its drawn panels (the
// emoji placeholders below), so the game never waits on a missing file.

import { ART } from "./story.mjs";

export const VIDEOS = {
  // "invite-icecream": "assets/video/marina/invite-icecream.mp4",
  // "date-icecream": "assets/video/marina/date-icecream.mp4",
};

const phone = (text, extra = []) => [
  { e: "📱", x: 50, y: 56, s: 30, a: "pulse" },
  { b: text, x: 50, y: 26 },
  ...extra,
];

// The first week opens with the story so far (the creator, 15 October 2026: "more context" at the beginning): Marina has never
// seen the ocean, and Coach Waters dreams of taking her there one day.
const PROLOGUE = [
  {
    bg: "pool",
    img: ART.marinaDreams,
    hold: 4000,
    text: "Marina has never seen the ocean. She keeps a postcard of it on her table.",
    layers: [
      { e: "👩", x: 36, y: 56, s: 18, a: "sway" },
      { e: "🌊", x: 80, y: 72, s: 10, a: "float" },
    ],
  },
  {
    bg: "dream",
    img: ART.coachDaydream,
    hold: 4200,
    text: "Coach Waters dreams of taking her there one day. One date at a time…",
    layers: [
      { e: "🧑", x: 34, y: 66, s: 15, a: "bob" },
      { e: "☁️", x: 62, y: 34, s: 44, a: "float" },
      { e: "🏖️", x: 62, y: 40, s: 9 },
    ],
  },
];

// The invite at the start of a chapter's week: what the date is, and what it costs (the first week with the prologue in it).
function invite(chapter) {
  const d = chapter.date;
  return [
    {
      bg: "pool",
      img: ART.coachPool,
      hold: 3600,
      text: `Week ${chapter.id}. Coach Waters works the town's pools: six shifts, Monday to Saturday.`,
      layers: [
        { e: "🧑", x: 50, y: 54, s: 18, a: "sway" },
        { e: "🏊", x: 20, y: 76, s: 9, a: "bob" },
        { e: "🏊", x: 80, y: 78, s: 8, a: "bob2" },
      ],
    },
    ...(chapter.id === 1 ? PROLOGUE : []),
    {
      bg: "dream",
      img: ART.marinaText,
      hold: 4000,
      text: "A text from Marina…",
      layers: phone(`${d.name} on Sunday? ${d.icon} Only if you can treat me 😉`),
    },
    {
      bg: "jar",
      img: ART.fundJar,
      hold: 0,
      text: `Save ${money(chapter.goal)} by Saturday night and Sunday is a date. Fall short, and it's game over.`,
      layers: [
        { e: "💰", x: 50, y: 56, s: 22, a: "pulse" },
        { e: d.icon, x: 26, y: 40, s: 12, a: "float" },
        { e: "💌", x: 74, y: 42, s: 10, a: "float2" },
        { b: `Date Fund: ${money(chapter.goal)} by Saturday`, x: 50, y: 18 },
      ],
    },
  ];
}

// Sunday: the Date Fund made it. `extra`: a pool opened on the ladder by this date (`newPool`: { icon, name }), shown before the
// week ends; and, after week 4's ocean trip, the story's ending (`ending`: the first time, with the credits) or, in a later run, a
// shorter close (`seasonDone`).
function date(chapter, extra = {}) {
  const d = chapter.date;
  const panels = [
    {
      bg: "dream",
      img: ART.marinaReady,
      hold: 3600,
      text: `Saturday night. The Date Fund is full: ${money(chapter.goal)}!`,
      layers: phone("I'm ready! Pick me up at eight 💖", [{ e: "🎉", x: 18, y: 30, s: 10, a: "float" }]),
    },
    {
      bg: chapter.date.id === "ocean" ? "sea" : "dream",
      img: ART.date[d.id],
      hold: 4200,
      text: `Sunday: ${d.name.toLowerCase()} with Marina.`,
      layers: [
        { e: "🧑", x: 38, y: 60, s: 16, a: "sway" },
        { e: "👩", x: 60, y: 60, s: 16, a: "sway" },
        { e: d.icon, x: 50, y: 30, s: 14, a: "pulse" },
        { e: "❤️", x: 50, y: 48, s: 8, a: "float" },
      ],
    },
  ];
  if (extra.ending) panels.push(...ending().slice(1, -1));
  if (extra.newPool)
    panels.push({
      bg: "pool",
      hold: 4200,
      text: `A new pool opens for good: ${extra.newPool.name}! It's in next week's shifts.`,
      layers: [
        { e: extra.newPool.icon, x: 50, y: 50, s: 26, a: "pulse" },
        { e: "🔓", x: 74, y: 30, s: 10, a: "float" },
        { b: `New pool: ${extra.newPool.name}`, x: 50, y: 16 },
      ],
    });
  panels.push(
    extra.ending
      ? ending().at(-1)
      : extra.seasonDone
        ? {
            bg: "sea",
            img: ART.date.ocean,
            hold: 0,
            text: "The season is over, and the pools never close: from here every week is harder than the last. How far can you go?",
            layers: [{ e: "🌊", x: 50, y: 60, s: 20, a: "float" }],
          }
        : {
            bg: "pool",
            img: ART.coachPool,
            hold: 0,
            text: "Monday comes round again: busier pools, a harder week, and Marina's already planning the next date…",
            layers: [
              { e: "📅", x: 50, y: 50, s: 20, a: "pulse" },
              { b: "Same time next Sunday? 😘", x: 50, y: 20 },
            ],
          },
  );
  return panels;
}

// The story's ending (Phase 2, 19 October 2026): the season finale won and the ocean trip paid for, Marina sees the sea; the cast
// rolls by; then the run goes on, endless. Played after week 4's date the first time (and from the album any time after).
export const CAST = [
  { role: "Coach Waters", name: "the coach" },
  { role: "Marina", name: "who had never seen the ocean" },
  { role: "Marco “the Missile”", name: "the fastest lane in town" },
  { role: "Valentina", name: "the aqua disco's instructor" },
  { role: "Karen", name: "who would like to speak to the manager" },
  { role: "Carl and the leopard man", name: "cannonballs" },
  { role: "The fish kid", name: "and his bucket" },
  { role: "Biscuit, Noodle, Pickles and friends", name: "loose dogs" },
  { role: "The snow monkeys", name: "of the Mountain Hot Springs" },
  { role: "Every swimmer", name: "who waited in line" },
];
function ending() {
  return [
    {
      bg: "sea",
      img: ART.date.ocean,
      hold: 4200,
      text: "Sunday: the ocean trip with Marina.",
      layers: [{ e: "🌊", x: 50, y: 60, s: 20, a: "float" }],
    },
    {
      bg: "sea",
      img: ART.date.ocean,
      hold: 4600,
      text: "Marina sees the ocean for the very first time. She doesn't need the postcard any more.",
      layers: [{ b: "It's even bluer than the pool! 🌊", x: 52, y: 22 }],
    },
    {
      bg: "night",
      hold: 9000,
      text: "Pool Panic",
      credits: CAST,
      layers: [],
    },
    {
      bg: "sea",
      img: ART.date.ocean,
      hold: 0,
      text: "Thanks for playing! The season is over, but the pools never close: from here every week is harder than the last. How far can you go?",
      layers: [{ e: "❤️", x: 50, y: 34, s: 14, a: "pulse" }],
    },
  ];
}

// Game over: a Saturday night short of the goal. The run starts again at week 1.
function raincheck(chapter, why) {
  return [
    {
      bg: "dream",
      img: ART.raincheck,
      hold: 0,
      text:
        why === "short"
          ? `Saturday night, and the Date Fund is short of ${money(chapter.goal)}. Game over: the next run starts again at week 1.`
          : "The week fell apart. Game over: the next run starts again at week 1.",
      layers: phone("Rain check? I'll save the date for you 💛 Try again!", [
        { e: "🌧️", x: 20, y: 30, s: 10, a: "float" },
      ]),
    },
  ];
}

export const money = (n) => "$" + Math.round(n).toLocaleString("en-US");

// The panels of a scene: `kind` is "invite", "date", "raincheck" or "ending"; its id (for VIDEOS) is `kind-<date id>` (the rain
// check has one, `raincheck`, and the ending `ending`). A scene with a video plays it in its first panel, with nothing timed: it
// moves on when it ends. `extra` is the date's (see `date`); for the rain check, `why`.
export function scene(kind, chapter, extra = "") {
  const id = kind === "raincheck" || kind === "ending" ? kind : kind + "-" + chapter.date.id;
  const panels =
    kind === "invite"
      ? invite(chapter)
      : kind === "date"
        ? date(chapter, extra || {})
        : kind === "ending"
          ? ending()
          : raincheck(chapter, extra);
  const video = VIDEOS[id];
  if (video) return { id, panels: [{ ...panels[0], video, hold: 0 }, ...panels.slice(1)] };
  return { id, panels };
}
