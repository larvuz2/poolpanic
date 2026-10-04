// The crash log: a small black box for the game. It keeps a ring of breadcrumbs (what the game and the player were
// doing), records every error and the other things that pass for a crash (a frame that threw, a lost GPU context, a
// tab that died without closing), and keeps all of it on the device so the next launch can offer a report.
// Nothing leaves the device by itself: the player copies the report, opens the prefilled GitHub issue or sends it to the developer
// (report-send.mjs, only when they say so or have switched automatic sending on).
// Pure module (no DOM, no globals): storage, clock and scheduler are passed in, so the checks can drive it.
// The browser wiring (window errors, console, visibility, WebGL, tab locks) is in crashlog-hooks.mjs.
//
// Storage: `key` holds the list of session ids (oldest first) and `key.<id>` holds one session, so two tabs never
// overwrite each other's log.

export const CRASHLOG_KEY = "pool-panic.crashlog.v1";
export const ISSUE_URL = "https://github.com/larvuz2/poolpanic/issues/new";

export const LIMITS = {
  sessions: 8, // sessions kept on the device
  crumbs: 400, // breadcrumbs per session: the shift's diary (trace.mjs) writes a line for every change that matters
  errors: 12, // distinct errors per session
  flags: 24, // problems the player flagged (playtest), each with the trail around it
  replays: 3, // recorded shifts kept in a session (replay.mjs)
  crumb: 240, // characters per breadcrumb
  message: 320, // characters per error message
  stack: 1800, // characters per stack
  bytes: 90000, // one session, stored
  issueUrl: 6800, // longest prefilled issue link
  stale: 45000, // a session this quiet is gone when nothing better tells us (ms)
};

const clip = (value, n) => {
  const text = String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  return text.length > n ? text.slice(0, n - 1) + "…" : text;
};
// Stack frames without the page's origin (it only makes the lines longer), at most the first dozen.
const tidyStack = (stack, max) =>
  clip(
    String(stack || "")
      .split("\n")
      .slice(0, 14)
      .map((line) => line.replace(/https?:\/\/[^/\s)]+\//g, "/").replace(/\s+$/, ""))
      .join("\n"),
    max,
  );
// Small flat records only: strings, finite numbers and booleans.
const flat = (object) => {
  const out = {};
  for (const [k, v] of Object.entries(object || {})) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = Math.round(v * 100) / 100;
    else if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "string") out[k] = clip(v, 120);
  }
  return out;
};
const seconds = (ms) => (ms / 1000).toFixed(1);
// In the middle of a shift: the only time a page that vanished counts as a crash.
const PLAYING = ["playing", "countdown", "paused"];
// The game's state as one line (the report's "Game" line, and each flagged problem's).
const gameLine = (st = {}) =>
  (st.level ? "level " + st.level + (st.shift ? ' "' + st.shift + '"' : "") : "menu") +
  [
    st.venue,
    st.lighting,
    st.view,
    st.mode,
    st.time !== undefined && "shift " + st.time + " s",
    st.score !== undefined && "score " + st.score,
    st.active && "active: " + st.active,
    st.rescue && "rescue " + st.rescue,
    st.coach && "coach " + st.coach,
    st.crowd && "crowd: " + st.crowd,
    st.booking && "booking " + st.booking,
    st.seed && "seed " + st.seed,
  ]
    .filter(Boolean)
    .map((x) => " · " + x)
    .join("");

export class CrashLog {
  constructor({
    storage = null,
    now = () => Date.now(),
    schedule = (fn, ms) => setTimeout(fn, ms),
    key = CRASHLOG_KEY,
  } = {}) {
    this.storage = storage;
    this.now = now;
    this.schedule = schedule;
    this.key = key;
    this.limits = { ...LIMITS }; // the budget: a playtest asks for a longer diary (setLimits)
    this.rev = 0; // goes up with everything worth sending again (a line of the diary, an error, a flag), not with the state's refresh
    this.onNewError = null; // called with the record of an error this session has not had before
    this.sessions = []; // everything on the device, oldest first (this launch's session last)
    this.session = null;
    this.suspects = []; // earlier sessions that may have ended badly, until `settle` knows
    this.dirty = false;
    this.lastWrite = -Infinity;
    this.timer = null;
    this.frames = { count: 0, slow: 0, max: 0, sum: 0 };
    this.stalledAt = -Infinity;
    this.resumed = false;
  }

  // Begin this launch's session. Earlier ones that were left open in the middle of a shift and never went to the
  // background did not close on purpose (the tab crashed, ran out of memory, froze and was killed, or the browser was
  // force-quit): they are suspects until `settle` learns whether their page is still alive in another tab.
  start({ build = {}, env = {}, page = "" } = {}) {
    this.sessions = this.readAll();
    this.suspects = this.sessions.filter(
      (s) =>
        s.open && !s.hidden && !s.crash && PLAYING.includes(s.state?.mode) && (s.lastAt || 0) - s.t0 > 5000,
    );
    const t0 = this.now();
    this.session = {
      id: t0.toString(36) + Math.floor(Math.random() * 1296).toString(36),
      t0,
      lastAt: t0,
      build: flat(build),
      env: flat(env),
      page: clip(page, 160),
      state: {},
      crumbs: [],
      errors: [],
      open: true,
      hidden: false,
    };
    this.sessions.push(this.session);
    this.prune();
    this.writeIndex();
    this.crumb("start", "launch");
    this.flush(true);
    return this.session;
  }

  // `alive` is the set of session ids whose page is still running (null when the browser cannot say): a suspect that
  // is not in it crashed. Without an answer, one that has been quiet for a while is taken to be gone.
  settle(alive = null) {
    for (const s of this.suspects) {
      const gone = alive ? !alive.has(s.id) : this.now() - (s.lastAt || 0) > LIMITS.stale;
      if (!gone) continue;
      s.crash = "unclean";
      s.open = false;
      this.write(s);
    }
    this.suspects = [];
  }

  // ---- recording ------------------------------------------------------------------------------------------------
  crumb(kind, text = "") {
    const s = this.session;
    if (!s) return;
    const line = clip(text, LIMITS.crumb),
      at = this.now() - s.t0,
      last = s.crumbs[s.crumbs.length - 1];
    s.lastAt = this.now();
    if (kind !== "perf") this.rev++; // (the numbers every few seconds alone are not worth sending again)
    if (last && last[1] === kind && last[2] === line) {
      last[3] = (last[3] || 1) + 1; // the same thing again: count it instead of repeating it
      last[0] = at;
    } else s.crumbs.push([at, clip(kind, 24), line, 1]);
    if (s.crumbs.length > this.limits.crumbs) s.crumbs.splice(0, s.crumbs.length - this.limits.crumbs);
    this.touch();
  }

  // A different budget for this log (a playtest keeps a longer diary): any of the limits above.
  setLimits(patch = {}) {
    for (const [k, v] of Object.entries(patch))
      if (k in LIMITS && Number.isFinite(v) && v > 0) this.limits[k] = v;
  }

  // The player flagged a problem. The diary is a ring and moves on, so the flag keeps what was around it whole: the game's state at that
  // moment and the last lines of the trail. Returns the record.
  flag(note, { kind = "", trail = 14 } = {}) {
    const s = this.session;
    if (!s) return null;
    const record = {
      at: this.now() - s.t0,
      kind: clip(kind, 24),
      note: clip(note, 400),
      state: { ...s.state },
      trail: s.crumbs
        .slice(-trail)
        .map(([t, k, text, n]) =>
          clip("+" + seconds(t) + " s  " + k + " " + text + (n > 1 ? " ×" + n : ""), 140),
        ),
    };
    (s.flags ||= []).push(record);
    if (s.flags.length > this.limits.flags) s.flags.splice(0, s.flags.length - this.limits.flags);
    this.crumb("flag", (kind ? "[" + kind + "] " : "") + (note || "(no note)"));
    this.flush(true);
    return record;
  }

  // What the playtest has covered (playtest.mjs's Coverage): `lines` are its report lines, `data` the structured form.
  setPlaytest({ lines = [], data = null } = {}) {
    const s = this.session;
    if (!s) return;
    s.playtest = { lines: lines.slice(0, 60).map((l) => clip(l, 400)), data };
    this.rev++;
    this.touch();
  }

  // A structured record kept with the session (a recorded shift, replay.mjs): `list` names where it goes, and only the newest few stay.
  // The record is kept by reference, so what the recorder adds to it later is written with the next flush.
  attach(list, record) {
    const s = this.session;
    if (!s || !record) return;
    const items = (s[list] ||= []);
    if (!items.includes(record)) items.push(record);
    if (items.length > this.limits.replays) items.splice(0, items.length - this.limits.replays);
    this.touch();
  }

  // More about the device, learned after the start (the GPU, once the world has a context).
  setEnv(patch) {
    const s = this.session;
    if (!s) return;
    Object.assign(s.env, flat(patch));
    this.touch();
  }

  // What the game is doing now (level, venue, view, incident, clock ...). Merged into the last known state.
  setState(patch) {
    const s = this.session;
    if (!s) return;
    Object.assign(s.state, flat(patch));
    s.lastAt = this.now();
    this.touch();
  }

  // Record an error. Repeats of the same error count up instead of piling up. Returns the record.
  error(src, err, extra = {}) {
    const s = this.session;
    if (!s) return null;
    const name = clip(err?.name || (err instanceof Error ? "Error" : typeof err), 60),
      message = clip(err?.message ?? err, LIMITS.message),
      stack = tidyStack(err?.stack, LIMITS.stack),
      top = stack.split("\n").find((line) => /^\s*at /.test(line)) || "",
      id = [src, name, message, top.trim()].join("|"),
      at = this.now() - s.t0;
    s.lastAt = this.now();
    let record = s.errors.find((e) => e.id === id);
    const known = !!record;
    if (record) {
      record.count++;
      record.last = at;
    } else {
      record = {
        id,
        src: clip(src, 40),
        name,
        message,
        stack,
        at,
        last: at,
        count: 1,
        state: { ...s.state },
        extra: flat(extra),
      };
      s.errors.push(record);
      if (s.errors.length > this.limits.errors) s.errors.splice(0, s.errors.length - this.limits.errors);
      this.crumb("error", src + ": " + name + ": " + message);
    }
    // A new kind of error is written at once (the page may be about to die). The same one again waits for the next
    // scheduled write, so an error that comes back every frame is counted instead of written sixty times a second.
    this.rev++;
    if (known) this.touch();
    else {
      this.flush(true);
      try {
        this.onNewError?.(record);
      } catch {}
    }
    return record;
  }

  // Frame timing, fed by the frame loop: kept as counters and summed up into a "perf" crumb now and then.
  frame(ms) {
    if (this.resumed) {
      this.resumed = false;
      return;
    }
    const f = this.frames;
    f.count++;
    f.sum += ms;
    if (ms > 100) f.slow++;
    if (ms > f.max) f.max = ms;
    // A frame this long deserves a line of its own so it sits in the trail next to what caused it (at most one every
    // four seconds: a slow device must not fill the trail with them).
    if (ms > 700 && this.now() - this.stalledAt > 4000) {
      this.stalledAt = this.now();
      this.crumb("stall", Math.round(ms) + " ms frame");
    }
  }
  perf(info = {}) {
    const f = this.frames;
    if (!f.count) return;
    const bits = [
      "fps " + Math.round(1000 / (f.sum / f.count)),
      "worst " + Math.round(f.max) + " ms",
      f.slow + " slow",
    ];
    for (const [k, v] of Object.entries(flat(info))) bits.push(k + " " + v);
    this.crumb("perf", bits.join(" · "));
    this.frames = { count: 0, slow: 0, max: 0, sum: 0 };
  }

  // In the background is not a crash: a page the system kills there was not in use.
  setHidden(hidden) {
    if (!this.session) return;
    this.session.hidden = !!hidden;
    this.session.open = true;
    this.crumb(hidden ? "hidden" : "visible", "");
    this.resumed = true; // the frame after a spell in the background is long by nature: not a stall
    this.flush(true);
  }
  // A page that says goodbye closed on purpose.
  close() {
    if (!this.session) return;
    this.session.open = false;
    this.flush(true);
  }
  reopen() {
    if (!this.session) return;
    this.session.open = true;
    this.session.hidden = false;
    this.flush(true);
  }

  // ---- storage --------------------------------------------------------------------------------------------------
  readIndex() {
    try {
      const ids = JSON.parse(this.storage?.getItem(this.key) || "[]");
      return Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : [];
    } catch {
      return [];
    }
  }
  readAll() {
    const out = [];
    for (const id of this.readIndex()) {
      try {
        const s = JSON.parse(this.storage.getItem(this.key + "." + id));
        if (s && s.id === id && Array.isArray(s.crumbs) && Array.isArray(s.errors)) out.push(s);
      } catch {}
    }
    return out;
  }
  writeIndex() {
    try {
      // Read again: another tab may have added its session since this one started.
      const ids = new Set(this.readIndex());
      for (const s of this.sessions) ids.add(s.id);
      const keep = [...ids].filter(
        (id) => this.sessions.some((s) => s.id === id) || this.storage.getItem(this.key + "." + id) !== null,
      );
      this.storage?.setItem(this.key, JSON.stringify(keep));
    } catch {}
  }
  // Keep the newest sessions; the ones that went wrong outlive the clean ones.
  prune() {
    while (this.sessions.length > this.limits.sessions) {
      const i = this.sessions.findIndex((s) => s !== this.session && !s.errors.length && !s.crash);
      const [gone] = this.sessions.splice(i >= 0 ? i : 0, 1);
      try {
        this.storage?.removeItem(this.key + "." + gone.id);
      } catch {}
    }
  }
  touch() {
    this.dirty = true;
    if (this.timer) return;
    const wait = Math.max(0, 500 - (this.now() - this.lastWrite));
    this.timer = this.schedule(() => {
      this.timer = null;
      this.flush(true);
    }, wait);
  }
  flush(force = false) {
    if (!this.session || (!this.dirty && !force)) return;
    this.dirty = false;
    this.lastWrite = this.now();
    this.write(this.session);
  }
  write(s) {
    if (!this.storage) return;
    let text = JSON.stringify(s);
    // Too much for the device: forget the oldest breadcrumbs first.
    for (let guard = 0; text.length > this.limits.bytes && s.crumbs.length && guard < 20; guard++) {
      s.crumbs.splice(0, Math.max(1, Math.ceil(s.crumbs.length / 4)));
      text = JSON.stringify(s);
    }
    try {
      this.storage.setItem(this.key + "." + s.id, text);
    } catch {
      // Quota or private mode: keep the errors, drop the trail, and try once more.
      try {
        s.crumbs.splice(0, Math.max(0, s.crumbs.length - 10));
        this.storage.setItem(this.key + "." + s.id, JSON.stringify(s));
      } catch {}
    }
  }

  // ---- reading --------------------------------------------------------------------------------------------------
  latest() {
    return this.session || this.sessions[this.sessions.length - 1] || null;
  }
  // Earlier sessions that went wrong (or had a problem flagged in a playtest) and were not reported, sent or set aside.
  pending() {
    return this.sessions.filter(
      (s) =>
        s !== this.session &&
        (s.errors.length || s.crash || s.flags?.length) &&
        !s.reported &&
        !s.dismissed &&
        !s.sent,
    );
  }
  // Every session that went wrong (this one included), newest first.
  troubled() {
    return this.sessions.filter((s) => s.errors.length || s.crash || s.flags?.length).reverse();
  }
  // `what`: "reported" (copied, or opened as an issue), "sent" (to the developer: `info` says when and from which device code) or
  // "dismissed" (set aside).
  mark(id, what = "reported", info = null) {
    const s = this.sessions.find((x) => x.id === id);
    if (!s) return false;
    if (what === "sent") s.sent = { at: this.now(), ...flat(info) };
    else s[what === "reported" ? "reported" : "dismissed"] = true;
    this.write(s);
    return true;
  }
  clear() {
    for (const s of this.sessions) {
      if (s === this.session) continue;
      try {
        this.storage?.removeItem(this.key + "." + s.id);
      } catch {}
    }
    this.sessions = this.session ? [this.session] : [];
    if (this.session) {
      this.session.errors = [];
      this.session.crash = undefined;
      this.write(this.session);
    }
    this.writeIndex();
  }

  // A short sentence for a dialog: what went wrong in a session (the first error, or with `latest` the newest one).
  headline(s = this.latest(), { latest = false } = {}) {
    if (!s) return "Nothing has gone wrong.";
    const e = latest ? s.errors[s.errors.length - 1] : s.errors[0];
    // A playtest's reports are told apart in a list by where the game was and what the player flagged.
    const flags = s.flags?.length
      ? " · " +
        s.flags.length +
        " flagged: " +
        clip(s.flags[s.flags.length - 1].note || s.flags[s.flags.length - 1].kind || "no note", 60)
      : "";
    const prefix = s.playtest
      ? "Playtest " + (s.state?.level ? "L" + s.state.level : "menu") + flags + " · "
      : "";
    if (e) return prefix + e.src + ": " + e.name + ": " + e.message;
    if (s.crash === "unclean")
      return (
        prefix +
        "The page ended in the middle of a shift without closing (a tab crash, running out of memory, or a forced close)."
      );
    return prefix ? prefix + "no errors" : "No errors were recorded.";
  }

  // What a dialog shows before anyone copies anything: where the game was, the error's first stack frames and the
  // last few things that happened.
  preview(s = this.latest(), { latest = false } = {}) {
    if (!s) return "";
    const st = s.state || {},
      e = latest ? s.errors[s.errors.length - 1] : s.errors[0],
      lines = [
        (st.level ? "Level " + st.level + (st.shift ? ' "' + st.shift + '"' : "") : "Menu") +
          [st.venue, st.view, st.mode, st.time !== undefined && "shift " + st.time + " s"]
            .filter(Boolean)
            .map((x) => " · " + x)
            .join(""),
        "Build " + (s.build?.commit || "dev") + (s.build?.context ? " (" + s.build.context + ")" : ""),
      ];
    if (e) {
      lines.push("", e.src + " · " + e.name + ": " + e.message + (e.count > 1 ? " ×" + e.count : ""));
      for (const l of String(e.stack || "")
        .split("\n")
        .filter((x) => /^\s*at /.test(x))
        .slice(0, 5))
        lines.push("  " + l.trim());
    } else if (s.crash === "unclean")
      lines.push("", "The page ended in the middle of a shift without closing.");
    const trail = s.crumbs.filter((c) => c[1] !== "perf").slice(-12);
    if (trail.length) {
      lines.push("", "Last things that happened:");
      for (const [at, kind, text, n] of trail)
        lines.push("  +" + seconds(at) + " s  " + kind + " " + text + (n > 1 ? " ×" + n : ""));
    }
    return lines.join("\n");
  }

  // The full report, as Markdown that reads fine as plain text too.
  // `device`: the device code the report is sent under (report-send.mjs), so a report that is only copied and pasted still says it.
  report(s = this.latest(), { crumbs = this.limits.crumbs, stackLines = 14, device = "", replay = 0 } = {}) {
    if (!s) return "Pool Panic crash report\n\nNothing has been recorded yet.";
    const replays = replay > 0 ? (s.replays || []).slice(-replay) : [];
    const b = s.build || {},
      env = s.env || {},
      st = s.state || {},
      when = new Date(s.t0).toISOString().replace("T", " ").slice(0, 19) + " UTC",
      ran = Math.max(0, (s.lastAt || s.t0) - s.t0),
      lines = [];
    lines.push("# Pool Panic crash report", "");
    lines.push(
      "- **Build:** " +
        (b.commit || "dev") +
        (b.context ? " (" + b.context + (b.branch ? ", " + b.branch : "") + ")" : "") +
        (b.built ? " · built " + b.built : ""),
    );
    lines.push("- **When:** " + when + " · session ran " + Math.round(ran / 1000) + " s");
    if (device)
      lines.push("- **Device code:** " + device + " (the reports this device has sent are found by it)");
    lines.push(
      "- **Device:** " +
        [
          env.ua,
          env.viewport && "viewport " + env.viewport,
          env.dpr && env.dpr + "× pixels",
          env.touch ? "touch" : "",
          env.gpu && "GPU " + env.gpu,
          env.canvas && "canvas " + env.canvas,
          env.webgl2 === false && "WebGL 1",
          env.maxTexture && "max texture " + env.maxTexture,
          env.cores && env.cores + " cores",
          env.memory && env.memory + " GB",
          env.reduced ? "reduced motion" : "",
        ]
          .filter(Boolean)
          .join(" · "),
    );
    if (s.page) lines.push("- **Page:** `" + s.page + "`");
    lines.push("- **Game:** " + gameLine(st));
    if (s.crash === "unclean")
      lines.push("- **Ended:** without closing (tab crash, out of memory, freeze or forced close)");
    else if (s.open === false) lines.push("- **Ended:** closed normally");
    lines.push("");
    if (s.flags?.length) {
      lines.push("## Flagged by the player", "");
      s.flags.forEach((f, i) => {
        lines.push(
          i +
            1 +
            ". +" +
            seconds(f.at) +
            " s" +
            (f.kind ? " [" + f.kind + "]" : "") +
            " " +
            JSON.stringify(f.note || "(no note)"),
        );
        if (f.state && Object.keys(f.state).length) lines.push("   game: " + gameLine(f.state));
        if (f.trail?.length) lines.push("   ```", ...f.trail.map((l) => "   " + l), "   ```");
      });
      lines.push("");
    }
    if (s.playtest?.lines?.length) lines.push("## Playtest so far", "", ...s.playtest.lines, "");
    if (s.errors.length) {
      lines.push("## Errors", "");
      s.errors.forEach((e, i) => {
        lines.push(
          i +
            1 +
            ". `" +
            e.src +
            "` " +
            e.name +
            ": " +
            e.message +
            (e.count > 1 ? " ×" + e.count : "") +
            " (at +" +
            seconds(e.at) +
            " s" +
            (e.count > 1 ? ", last +" + seconds(e.last) + " s" : "") +
            ")",
        );
        const game = Object.entries(e.state || {})
          .filter(([, v]) => v !== "")
          .map(([k, v]) => k + " " + v)
          .join(", ");
        if (game) lines.push("   game: " + game);
        if (e.extra && Object.keys(e.extra).length)
          lines.push(
            "   where: " +
              Object.entries(e.extra)
                .map(([k, v]) => k + " " + v)
                .join(", "),
          );
        if (e.stack)
          lines.push(
            "   ```",
            ...e.stack
              .split("\n")
              .slice(0, stackLines)
              .map((l) => "   " + l),
            "   ```",
          );
      });
      lines.push("");
    }
    const trail = s.crumbs.slice(-crumbs);
    if (trail.length) {
      lines.push(
        "## Timeline (newest last; +seconds since the page opened, tNN is the shift's own clock)",
        "",
        "```",
      );
      for (const [at, kind, text, n] of trail)
        lines.push(
          "+" + seconds(at).padStart(6) + " s  " + kind.padEnd(9) + " " + text + (n > 1 ? " ×" + n : ""),
        );
      lines.push("```");
    }
    // Recorded shifts (replay.mjs), newest last: the whole record on one line, for tools to read, not people.
    for (const r of replays)
      lines.push(
        "",
        "## Replay: level " +
          (r.level ?? "?") +
          " seed " +
          r.seed +
          " (" +
          (r.inputs?.length ?? 0) +
          " inputs)",
        "",
        "```json",
        JSON.stringify(r),
        "```",
      );
    return lines.join("\n");
  }

  // A prefilled GitHub issue for the same report, kept short enough for a link: the oldest breadcrumbs and the
  // deepest stack lines go first.
  issue(s = this.latest()) {
    const title = "Crash: " + clip(this.headline(s), 90),
      link = (body) =>
        ISSUE_URL + "?labels=crash&title=" + encodeURIComponent(title) + "&body=" + encodeURIComponent(body);
    let crumbs = 40,
      stackLines = 8;
    for (let guard = 0; guard < 8; guard++) {
      const body = this.report(s, { crumbs, stackLines }),
        url = link(body);
      if (url.length <= LIMITS.issueUrl)
        return { url, title, body, truncated: !s || crumbs < s.crumbs.length };
      if (crumbs > 10) crumbs = Math.floor(crumbs / 2);
      else if (stackLines > 4) stackLines -= 2;
      else break;
    }
    // Still too long (enormous messages): cut the text itself.
    let body = this.report(s, { crumbs: 8, stackLines: 4 });
    while (link(body).length > LIMITS.issueUrl && body.length > 300)
      body = body.slice(0, Math.floor(body.length * 0.85));
    return { url: link(body), title, body, truncated: true };
  }
}
