// Playtest mode: what turns Pool Panic into something the developer can debug from afar while someone plays the whole game on a device
// that has no console. Three pure pieces, no DOM and no globals (the storage, the clock and the sender are handed in, so the checks can
// drive them); app.mjs does the wiring.
//
//   playtestChoice / readPlaytest / savePlaytest   the switch: `?playtest` turns it on and the device remembers, `?playtest=off` ends it
//   LiveSender                                      when to send the log while the game runs, so a page that dies still left a recent copy
//   Coverage                                        which levels were played and which incidents were seen, with how each one went
//
// Playtest is deliberate: nothing here runs for an ordinary player. A playtest sends the log to the developer by itself (the person who
// switched it on is the person who wants it read), still without a name, an account or an address: see report-send.mjs.

export const PLAYTEST_KEY = "pool-panic.playtest.v1"; // {on}: whether this device is playtesting
export const COVERAGE_KEY = "pool-panic.playtest.seen.v1"; // what the playtest has covered so far (a Coverage's data)
// The crash log keeps a longer diary while a playtest is on: a whole shift or two instead of its last minute.
export const PLAYTEST_LIMITS = { crumbs: 1000, bytes: 240000, sessions: 4, replays: 2 };

// ---- the switch ----------------------------------------------------------------------------------------------------------------
const OFF = ["off", "0", "false", "no", "n", "stop"];
// What the address says: `?playtest` (or =1, =on, =yes) is on, `?playtest=off` (or 0, false, no) is off, and without the word the
// device's own choice stands. `said` is whether the address said anything, so the choice is only written when it did.
export function playtestChoice(search = "", stored = false) {
  let value = null;
  try {
    value = new URLSearchParams(search).get("playtest");
  } catch {}
  if (value === null) return { on: !!stored, said: false };
  return { on: !OFF.includes(value.trim().toLowerCase()), said: true };
}
export function readPlaytest(storage) {
  try {
    return JSON.parse(storage?.getItem(PLAYTEST_KEY) || "{}")?.on === true;
  } catch {
    return false;
  }
}
export function savePlaytest(storage, on) {
  try {
    if (on) storage?.setItem(PLAYTEST_KEY, JSON.stringify({ on: true }));
    else storage?.removeItem(PLAYTEST_KEY);
  } catch {}
}

// The kinds of incident a shift can have (what `sim.incident(kind)` says, apart from the ones that only follow from another), with the name
// the panel gives them: what a playtest is out to see at least once.
export const INCIDENT_KINDS = {
  cramp: "cramp rescue",
  stomach: "tummy trouble",
  spill: "spill",
  fish: "fish kid",
  dog: "loose dog",
  carl: "cannonball man",
  karen: "Karen",
  flicker: "power cut",
  crash: "trampoline crash",
  rush: "rush",
  team: "swim team",
  class: "class",
  closure: "lane closed",
  storm: "storm",
};

// ---- when to send --------------------------------------------------------------------------------------------------------------
// The log is sent again and again while the game runs (the service keeps one copy per session and replaces it), so that if the page
// dies the copy on the server is seconds old, and the developer can read how a shift is going while it is played. This decides only
// when: the game asks `dirty()` when the log changed (and how much it matters), calls `poll()` now and then, and the sender does the
// rest: never two sends at once, quicker while an incident runs, an urgent one (a problem was flagged, an error, a save) soon, slower
// and slower after failures, stopped for good where there is no service (a local server answers 404). While a shift is played the copy is
// also renewed every few seconds whether or not the log changed (a "beat", see `liveWant`): a page that dies leaves a copy on the server
// that says to within a few seconds when it stopped, and in a calm minute the log may not change for twenty.
export const SEND_GAPS = { calm: 20000, busy: 8000, beat: 3000, urgent: 2000, max: 120000 };
const WEIGHT = { calm: 1, busy: 2, beat: 3, urgent: 4 };

// What the live copy asks for this second, given what the game is doing and whether the log changed since it last looked: a beat all
// through a shift being played (the countdown too), else a calm copy when the log changed, else nothing. (The moments that matter more ask
// for "urgent" themselves.) The server takes 2400 replacements an hour for the whole site (netlify/functions/report.mjs): a beat every
// three seconds is 1200 an hour of play, so a player has the budget to themselves.
export function liveWant({ mode = "", changed = false } = {}) {
  if (mode === "playing" || mode === "countdown") return "beat";
  return changed ? "calm" : null;
}

export class LiveSender {
  // `send()` makes the payload fresh and resolves {ok, status, error?} (report-send.mjs's sendReport); it may throw, which counts as
  // a failure. `now()` is a clock in milliseconds.
  constructor({ send, now = () => Date.now(), gaps = SEND_GAPS } = {}) {
    this.sendNow = send;
    this.now = now;
    this.gaps = { ...SEND_GAPS, ...gaps };
    this.wanted = null; // the strongest reason there is to send ("calm", "busy", "urgent"), or null: nothing changed
    this.last = -Infinity; // when the last send began
    this.holdUntil = -Infinity; // the service asked for quiet until then
    this.failures = 0;
    this.sent = 0; // how many went through
    this.okAt = null; // when the last one did
    this.error = ""; // what went wrong the last time
    this.sending = false;
    this.dead = false; // there is no service here: stop trying
  }
  dirty(kind = "calm") {
    if (!this.wanted || WEIGHT[kind] > WEIGHT[this.wanted]) this.wanted = kind;
  }
  // How long to wait before the next send, in milliseconds: the reason's own gap, doubled for each failure in a row.
  gap(kind = this.wanted) {
    return Math.min(this.gaps.max, (this.gaps[kind] || this.gaps.calm) * 2 ** Math.min(this.failures, 6));
  }
  due() {
    if (this.dead || this.sending || !this.wanted) return false;
    const now = this.now();
    return now >= this.holdUntil && now - this.last >= this.gap();
  }
  // Called often (every frame is fine): starts a send when one is due. Resolves when it is over; null when there was nothing to do.
  poll() {
    return this.due() ? this.run() : null;
  }
  // The page is going away or into the background: send now, whatever the gap, unless a send is on its way already.
  flushNow() {
    if (this.dead || this.sending) return null;
    this.wanted = "urgent";
    this.last = -Infinity;
    this.holdUntil = -Infinity;
    return this.run();
  }
  async run() {
    const asked = this.wanted || "calm";
    this.wanted = null;
    this.sending = true;
    this.last = this.now();
    let result;
    try {
      result = await this.sendNow();
    } catch {
      result = { ok: false, status: 0, error: "no connection" };
    }
    this.sending = false;
    if (result?.ok) {
      this.failures = 0;
      this.sent++;
      this.okAt = this.now();
      this.error = "";
      return result;
    }
    this.failures++;
    this.error = result?.error || "failed";
    this.dirty(asked); // it did not go: it is still wanted
    const status = result?.status || 0;
    if ([404, 405, 501].includes(status)) {
      this.dead = true; // a server without the service: say so once and leave it alone
      this.wanted = null;
    } else if (status === 429) this.holdUntil = this.now() + (Number(result.retryAfter) || 60) * 1000;
    return result;
  }
  // One line for the panel: how the sending is going.
  describe() {
    if (this.dead) return "Not sending: this server has no report service.";
    if (this.sending) return "Sending…";
    if (this.failures)
      return (
        "Could not send (" +
        (this.error || "failed") +
        "), trying again" +
        (this.failures > 1 ? " · ×" + this.failures : "") +
        "."
      );
    if (this.okAt === null) return this.wanted ? "Waiting to send the first copy…" : "Nothing sent yet.";
    const seconds = Math.max(0, Math.round((this.now() - this.okAt) / 1000));
    return (
      "Live ✓ last copy " + (seconds < 2 ? "just now" : seconds + " s ago") + " · " + this.sent + " sent"
    );
  }
}

// ---- what has been covered -----------------------------------------------------------------------------------------------------
// Events that say nothing about how a shift went: the diary leaves them out and so does this.
const SKIP = new Set([
  "toast",
  "points",
  "chaos",
  "go",
  "countdown",
  "splash",
  "collision",
  "select",
  "assigned",
  "door-open",
  "arrived",
  "spawn",
  "served",
  "gone",
  "visitor-gone",
  "dash",
  "jump",
  "land",
  "drop",
  "busy",
  "blocked",
  "trampoline-bounce",
  "trampoline-climb",
  "karen-voice",
  "outage-flicker",
  "scoop-miss",
  "scoop-cast",
  "pickup",
  "handoff",
  "lane-switch",
  "ended",
  // the steps of an incident that its own lines already tell (the cannonball man's run, the kid's dodge, the fish's darts, the dog's
  // sniffing, Karen's arrival, the alarm of a cramp, the launch off the trampoline)
  "carl-windup",
  "carl-charge",
  "carl-jump",
  "kid-dodge",
  "fish-dart",
  "dog-notice",
  "dog-shake",
  "karen-arrive",
  "cramp-alarm",
  "trampoline-launch",
]);
const bump = (table, key, by = 1) => {
  table[key] = (table[key] || 0) + by;
};
const MAX_LEVELS = 40;
// A row as the notes keep it: the numbers and the three tables are always there, whatever an older note left out.
const fill = (row) => {
  for (const k of ["runs", "done", "best", "flags"]) if (!Number.isFinite(row[k])) row[k] = 0;
  for (const k of ["incidents", "saves", "events"]) if (!row[k] || typeof row[k] !== "object") row[k] = {};
  return row;
};

// Which shifts were played and what happened in each: per level (a drill is "drill:<id>") how many runs and how many were finished, the best
// score, which incidents began, which were saved, and every other event that is not routine (a dumped fish, a blackout, a crash) counted by
// name, plus how many problems the player flagged. It is plain data (`data`), kept on the device, so a playtest that goes on across several
// page loads (a crash, a reload) still adds up, and every report carries it.
export class Coverage {
  constructor(saved = null) {
    this.data = { v: 1, levels: {} };
    if (saved && saved.v === 1 && saved.levels && typeof saved.levels === "object")
      for (const [key, row] of Object.entries(saved.levels).slice(0, MAX_LEVELS))
        if (row && typeof row === "object") this.data.levels[key] = fill(row);
    this.key = null; // the shift being played
  }
  get levels() {
    return this.data.levels;
  }
  row(key) {
    return (this.data.levels[key] ??= fill({}));
  }
  // A shift begins: `level` (a number) or `drill` (an id), with its name.
  begin({ level = 0, drill = "", name = "", booking = "" } = {}) {
    this.key = drill ? "drill:" + drill : String(level);
    const row = this.row(this.key);
    row.runs++;
    if (name) row.name = String(name).slice(0, 40);
    if (booking) row.booking = booking;
    return row;
  }
  // A simulation event, as the game's event loop gets it.
  event(e) {
    const row = this.key && this.data.levels[this.key];
    if (!row || !e?.type) return;
    if (e.type === "incident") bump(row.incidents, String(e.kind || "?"));
    else if (e.type === "save") bump(row.saves, String(e.kind || "?"));
    else if (!SKIP.has(e.type)) bump(row.events, e.type);
  }
  finish({ score = 0, stars = 0 } = {}) {
    const row = this.key && this.data.levels[this.key];
    if (!row) return;
    row.done++;
    row.best = Math.max(row.best || 0, Math.round(score));
    row.last = { score: Math.round(score), stars };
  }
  // The player flagged a problem during the shift being played (or, when none is, a general one).
  flag() {
    bump(this.row(this.key || "menu"), "flags");
  }
  // Every incident kind that began anywhere, with the count, and the same for saves.
  totals() {
    const out = { incidents: {}, saves: {} };
    for (const row of Object.values(this.data.levels)) {
      for (const [k, n] of Object.entries(row.incidents || {})) bump(out.incidents, k, n);
      for (const [k, n] of Object.entries(row.saves || {})) bump(out.saves, k, n);
    }
    return out;
  }
  // The levels (not drills) that were finished at least once.
  finished() {
    return Object.entries(this.data.levels)
      .filter(([key, row]) => /^\d+$/.test(key) && row.done > 0)
      .map(([key]) => Number(key))
      .sort((a, b) => a - b);
  }
  // The report's lines: one per shift played, in level order, and a closing line of what was never seen.
  lines(expected = []) {
    const keys = Object.keys(this.data.levels).sort((a, b) => {
      const na = /^\d+$/.test(a),
        nb = /^\d+$/.test(b);
      return na && nb ? Number(a) - Number(b) : na ? -1 : nb ? 1 : a < b ? -1 : 1;
    });
    const table = (t) =>
      Object.entries(t || {})
        .map(([k, n]) => k + " " + n)
        .join(", ");
    const lines = keys.map((key) => {
      const row = this.data.levels[key],
        bits = [
          (/^\d+$/.test(key) ? "Level " + key : "Drill " + key.slice(6)) +
            (row.name ? ' "' + row.name + '"' : ""),
          row.runs + (row.runs === 1 ? " run" : " runs") + ", " + row.done + " finished",
        ];
      if (row.last)
        bits.push("last " + row.last.score + " points, " + row.last.stars + "★ (best " + row.best + ")");
      if (table(row.incidents)) bits.push("incidents: " + table(row.incidents));
      if (table(row.saves)) bits.push("saved: " + table(row.saves));
      if (table(row.events)) bits.push("also: " + table(row.events));
      if (row.flags) bits.push("flagged ×" + row.flags);
      return "- " + bits.join(" · ");
    });
    const seen = this.totals().incidents,
      missing = expected.filter((k) => !seen[k]);
    if (expected.length)
      lines.push(
        "- Incidents not seen yet: " +
          (missing.length ? missing.join(", ") : "none, every kind has happened"),
      );
    return lines;
  }
}
