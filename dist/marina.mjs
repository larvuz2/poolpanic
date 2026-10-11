// Marina: she never walks onto the pool deck. She is in the full-screen cinematics around a week (the invite at its start,
// the date when the Date Fund is full, a rain check when the week is lost), in her texts, and in her wishes for each shift
// (week.mjs WISHES). Pure data and one function.
//
// Videos. Put a file under dist/assets/video/marina/ and name it in VIDEOS against the scene's id (for example
// `"date-icecream": "assets/video/marina/date-icecream.mp4"`): that scene then plays the video full screen, its caption
// under it, and moves on when it ends. A scene with no video, or one whose video cannot play, shows its drawn panels (the
// emoji placeholders below), so the game never waits on a missing file.

export const VIDEOS = {
  // "invite-icecream": "assets/video/marina/invite-icecream.mp4",
  // "date-icecream": "assets/video/marina/date-icecream.mp4",
};

const phone = (text, extra = []) => [
  { e: "📱", x: 50, y: 56, s: 30, a: "pulse" },
  { b: text, x: 50, y: 26 },
  ...extra,
];

// The invite at the start of a chapter's week: what the date is, and what it costs.
function invite(chapter) {
  const d = chapter.date;
  return [
    {
      bg: "pool",
      hold: 3600,
      text: `Coach Panic works the ${chapter.place}. Five days, two shifts a day.`,
      layers: [
        { e: "🧑", x: 50, y: 54, s: 18, a: "sway" },
        { e: "🏊", x: 20, y: 76, s: 9, a: "bob" },
        { e: "🏊", x: 80, y: 78, s: 8, a: "bob2" },
      ],
    },
    {
      bg: "dream",
      hold: 4000,
      text: "A text from Marina…",
      layers: phone(`${d.name} this weekend? ${d.icon} Only if you can treat me 😉`),
    },
    {
      bg: "jar",
      hold: 0,
      text: `Save ${money(chapter.goal)} by Friday and it's a date. Lose a shift, and the week starts over.`,
      layers: [
        { e: "💰", x: 50, y: 56, s: 22, a: "pulse" },
        { e: d.icon, x: 26, y: 40, s: 12, a: "float" },
        { e: "💌", x: 74, y: 42, s: 10, a: "float2" },
        { b: `Date Fund: ${money(chapter.goal)} by Friday`, x: 50, y: 18 },
      ],
    },
  ];
}

// The weekend: the Date Fund made it.
function date(chapter) {
  const d = chapter.date;
  return [
    {
      bg: "dream",
      hold: 3600,
      text: `Friday night. The Date Fund is full: ${money(chapter.goal)}!`,
      layers: phone("I'm ready! Pick me up at eight 💖", [{ e: "🎉", x: 18, y: 30, s: 10, a: "float" }]),
    },
    {
      bg: chapter.date.id === "ocean" ? "sea" : "dream",
      hold: 4200,
      text: `The weekend: ${d.name.toLowerCase()} with Marina.`,
      layers: [
        { e: "🧑", x: 38, y: 60, s: 16, a: "sway" },
        { e: "👩", x: 60, y: 60, s: 16, a: "sway" },
        { e: d.icon, x: 50, y: 30, s: 14, a: "pulse" },
        { e: "❤️", x: 50, y: 48, s: 8, a: "float" },
      ],
    },
    {
      bg: "pool",
      hold: 0,
      text: "Monday comes round again. A new pool, a new week, and Marina's already planning the next date…",
      layers: [
        { e: "📅", x: 50, y: 50, s: 20, a: "pulse" },
        { b: "Same time next weekend? 😘", x: 50, y: 20 },
      ],
    },
  ];
}

// The week is lost: a shift that did not pass, or a Friday short of the goal.
function raincheck(chapter, why) {
  return [
    {
      bg: "dream",
      hold: 0,
      text:
        why === "short"
          ? `Friday night, and the Date Fund is short of ${money(chapter.goal)}. The week starts over on Monday.`
          : "The shift fell apart, and the pool closed early. The week starts over on Monday.",
      layers: phone("Rain check? I'll save the date for you 💛 Try again!", [
        { e: "🌧️", x: 20, y: 30, s: 10, a: "float" },
      ]),
    },
  ];
}

export const money = (n) => "$" + Math.round(n).toLocaleString("en-US");

// The panels of a scene: `kind` is "invite", "date" or "raincheck"; its id (for VIDEOS) is `kind-<date id>` (the rain check
// has one, `raincheck`). A scene with a video plays it in its first panel, with nothing timed: it moves on when it ends.
export function scene(kind, chapter, why = "") {
  const id = kind === "raincheck" ? "raincheck" : kind + "-" + chapter.date.id;
  const panels =
    kind === "invite" ? invite(chapter) : kind === "date" ? date(chapter) : raincheck(chapter, why);
  const video = VIDEOS[id];
  if (video) return { id, panels: [{ ...panels[0], video, hold: 0 }, ...panels.slice(1)] };
  return { id, panels };
}
