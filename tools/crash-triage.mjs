#!/usr/bin/env node
// The reading half of the crash watch (docs/crash-watch.md): what have the creator's devices sent that nobody has looked at yet?
//
//   node tools/crash-triage.mjs CODE[,CODE…] [--issue N [--repo OWNER/NAME]] [--handled "token token …"] [--host URL …] [--out DIR] [--json] [--limit 40]
//
// For each device code it lists the launches the report service holds (netlify/functions/report.mjs), fetches them, and sorts each into
//   crash   the page ended in the middle of a shift without closing (a tab crash, memory, a freeze)
//   error   the game logged an error (a WebGL context lost is a note, not an error: the browser takes the GPU back while a page is hidden)
//   stuck   an incident that has been in one state for 50 s or more (the diary's `waiting` lines)
//   flag    the player flagged a problem from the 🐞 panel
//   hunt    a test of the crash hunt (?bisect=shift): never looked at one by one, read together as one run
//   clean   nothing the matter
// A launch with something the matter has a token (`muu6aara97:c`, or `:e2`, `:w`, `:f1`, or several together: `:ce2`). A run that writes
// the tokens it has dealt with into the log and hands them back (--handled, or --issue N to read them from the log issue itself: every line
// that starts `handled:` in its body and in the comments of the repo's owner) is not asked about them again; a launch that gains a problem
// (an error, then a crash) has a new token and is looked at again. A hunt run is `hunt:<its first launch>:done` or `:partial` (quiet for
// 30 minutes). What is new is printed in full: the build, what the game was doing, how long the shift had been played when the last word
// came, the final seconds of the diary, whether it is the known 45-second crash, where the report is saved and how to replay its shift.
//
// Plain GETs only. In the agent sandbox Node needs NODE_USE_ENV_PROXY=1 and NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt (see
// /root/.ccr/README.md); TLS checking is never switched off. Exit codes: 0 read (even when nothing is new), 2 bad usage, 3 nothing readable
// (the report service, or the log when --issue was asked for: nothing is then called new, because what is handled is not known).
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const HOSTS = ["https://poolpanic.netlify.app"];
export const LOG_REPO = "larvuz2/poolpanic";
export const DEVICE = /^[A-Z2-7]{8}$/;
// The crash that has been hunted since 4 October 2026: an iPad's tab killed 38 to 55 s after the go of a shift, with no error. When it has been
// found and fixed this window must change (a crash inside it is then a new one): docs/crash-watch.md says so.
export const KNOWN = { name: "the 45-second crash", from: 38, to: 55 };
export const STUCK_AFTER = 50; // seconds a state has lasted, from the diary's waiting lines
export const QUIET_HUNT = 30; // minutes without a word after which a hunt that is not done is read as it stands
const BENIGN = [/WebGL context lost/];
const round1 = (n) => Math.round(n * 10) / 10;

// ---- reading one report ---------------------------------------------------------------------------------------------------------------

// "Safari 26.6.1 on Mac (touch)" from a report's device line.
export function shortDevice(text = "") {
  const ua = text.split(" · ")[0] || "";
  const safari = ua.match(/Version\/([\d.]+).*Safari/),
    chrome = ua.match(/(?:Chrome|CriOS)\/(\d+)/),
    firefox = ua.match(/(?:Firefox|FxiOS)\/(\d+)/);
  const browser = chrome
    ? "Chrome " + chrome[1]
    : safari
      ? "Safari " + safari[1]
      : firefox
        ? "Firefox " + firefox[1]
        : "";
  const where = /iPad|iPhone/.test(ua)
    ? "iOS"
    : /Macintosh/.test(ua)
      ? / · touch/.test(text)
        ? "an iPad that says it is a Mac"
        : "Mac"
      : /Windows/.test(ua)
        ? "Windows"
        : /Android/.test(ua)
          ? "Android"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  const words = [browser, where].filter(Boolean).join(" on ");
  return words || ua.slice(0, 60);
}

// The Markdown of dist/crashlog.mjs `report()`, as facts.
export function parseReport(md = "") {
  const field = (label) => (md.match(new RegExp("^- \\*\\*" + label + ":\\*\\* (.*)$", "m")) || [])[1] || "";
  const section = (title) => {
    const at = md.indexOf("\n## " + title);
    if (at < 0) return [];
    const end = md.indexOf("\n## ", at + 4);
    return md.slice(at, end < 0 ? undefined : end).split("\n");
  };
  const build = field("Build"),
    device = field("Device"),
    game = field("Game"),
    when = field("When"),
    ended = field("Ended");
  // The timeline: `+  12.3 s  kind      text ×n`.
  const rows = [];
  for (const l of section("Timeline")) {
    const m = l.match(/^\+\s*([\d.]+) s {2}(\S+)\s+(.*)$/);
    if (!m) continue;
    const text = m[3].match(/^(.*?)(?: ×(\d+))?$/);
    rows.push({ t: Number(m[1]), kind: m[2], text: text[1], n: text[2] ? Number(text[2]) : 1 });
  }
  // The errors, and the first stack (the lines inside the first code fence).
  const errors = [],
    stack = [];
  let inFence = false,
    fenced = 0;
  for (const l of section("Errors")) {
    const m = l.match(/^\d+\. `([^`]+)` (.*?) \(at \+([\d.]+) s/);
    if (m) errors.push({ src: m[1], text: m[2], at: Number(m[3]) });
    else if (/^\s*```/.test(l)) {
      inFence = !inFence;
      if (inFence) fenced++;
    } else if (inFence && fenced === 1 && stack.length < 5) stack.push(l.trim());
  }
  const flags = [];
  for (const l of section("Flagged by the player")) {
    const m = l.match(/^\d+\. \+([\d.]+) s(?: \[(\w+)\])? (".*")\s*$/);
    if (!m) continue;
    let note = m[3];
    try {
      note = JSON.parse(m[3]);
    } catch {}
    flags.push({ at: Number(m[1]), kind: m[2] || "", note });
  }
  // The last shift of the launch: where it began, when the go came, and how long it had been played when the last word came.
  // (The header's "session ran N s" is the page's last word to within a couple of seconds, which the diary's last row need not be: in a
  // calm minute nothing is written down, and the live copy is renewed all the same.)
  const ran = Number((when.match(/session ran (\d+) s/) || [])[1] || 0),
    last = Math.max(rows.length ? rows[rows.length - 1].t : 0, ran);
  let start = -1;
  rows.forEach((r, i) => {
    if (r.kind === "shift" && /^start L\d/.test(r.text)) start = i;
  });
  const shift = start >= 0 ? rows[start].text.match(/^start L(\d+) (.*?)(?: · |$)/) : null,
    go = rows.slice(start + 1).find((r) => r.kind === "event" && r.text === "go");
  let hidden = 0,
    hiddenAt = null;
  for (const r of rows) {
    if (r.kind === "hidden") hiddenAt = r.t;
    else if (r.kind === "visible" && hiddenAt !== null) {
      if (go) hidden += Math.max(0, r.t - Math.max(hiddenAt, go.t));
      hiddenAt = null;
    }
  }
  if (hiddenAt !== null && go) hidden += Math.max(0, last - Math.max(hiddenAt, go.t));
  const perf = [...rows].reverse().find((r) => r.kind === "perf");
  const waits = rows
    .filter((r) => r.kind === "waiting")
    .map((r) => ({
      at: r.t,
      seconds: Number((r.text.match(/has been like this for (\d+) s/) || [])[1] || 0),
      text: r.text,
    }));
  // A hunt test (app.mjs startTrial/endTrial/showHuntResults): which test, how it ended, and the page's own list and verdict at the end.
  const huntRows = rows.filter((r) => r.kind === "hunt");
  let hunt = null;
  if (huntRows.length) {
    const first = huntRows.find((r) => /^Crash hunt · test \d+ of \d+/.test(r.text)),
      parts =
        first &&
        first.text.match(
          /^Crash hunt · test (\d+) of (\d+) · (.*?)(?: · switches: (.*?))?(?: · (?:replaying|bot)\b.*)?$/,
        ),
      doneAt = huntRows.findIndex((r) => /^(done|so far): /.test(r.text));
    hunt = {
      n: parts ? Number(parts[1]) : 0,
      of: parts ? Number(parts[2]) : 0,
      label: parts ? parts[3] : huntRows[0].text,
      switches: parts ? parts[4] || "" : "",
      survived: huntRows.some((r) => r.text === "survived"),
      unclear: huntRows.some((r) => r.text === "not played through"),
      done:
        doneAt >= 0 && /^done: /.test(huntRows[doneAt].text)
          ? huntRows[doneAt].text.replace(/^done: /, "")
          : "",
      verdict: doneAt >= 0 && /^done: /.test(huntRows[doneAt].text) ? huntRows[doneAt + 1]?.text || "" : "",
      awake: huntRows.find((r) => /screen/.test(r.text))?.text || "",
    };
  }
  const replay = (md.match(/^## Replay: level (\d+) seed (\d+) \((\d+) inputs\)/m) || [])
    .slice(1)
    .map(Number);
  return {
    build,
    commit: (build.match(/^(\S+)/) || [])[1] || "",
    context: (build.match(/\((\w[\w-]*)/) || [])[1] || "",
    when,
    device,
    browser: shortDevice(device),
    canvas: (device.match(/canvas (\d+×\d+)/) || [])[1] || "",
    page: field("Page").replace(/`/g, ""),
    game,
    endedWord: /without closing/.test(ended) ? "crash" : /closed normally/.test(ended) ? "closed" : "running",
    errors,
    stack,
    flags,
    stuck: Math.max(0, ...waits.map((w) => w.seconds)),
    waits: waits.slice(-3),
    last,
    level: shift ? Number(shift[1]) : null,
    shiftName: shift ? shift[2] : "",
    plan: (rows.slice(start + 1).find((r) => r.kind === "plan") || {}).text || "",
    go: go ? go.t : null,
    played: go ? round1(Math.max(0, last - go.t - hidden)) : null,
    hiddenAfterGo: round1(hidden),
    fps: perf ? Number((perf.text.match(/fps (\d+)/) || [])[1] || 0) : null,
    final: rows.filter((r) => r.kind !== "perf").slice(-12),
    replay: replay.length ? { level: replay[0], seed: replay[1], inputs: replay[2] } : null,
    hunt,
  };
}

// What is the matter with a launch, if anything: {kind, sig, errors, notes}. `sig` is what goes after the launch's id in its token.
export function classify(p) {
  const notes = [],
    errors = [];
  for (const e of p.errors) (BENIGN.some((re) => re.test(e.text)) ? notes : errors).push(e);
  if (p.hunt) return { kind: "hunt", sig: "", errors, notes };
  const crashed = p.endedWord === "crash",
    stuck = p.stuck >= STUCK_AFTER;
  const sig =
    (crashed ? "c" : "") +
    (errors.length ? "e" + errors.length : "") +
    (stuck ? "w" : "") +
    (p.flags.length ? "f" + p.flags.length : "");
  const kind = crashed
    ? "crash"
    : errors.length
      ? "error"
      : stuck
        ? "stuck"
        : p.flags.length
          ? "flag"
          : "clean";
  return { kind, sig, errors, notes };
}

// Does a crash fit the one being hunted: a tab killed 38 to 55 s after the go of a shift, with no error?
export const fitsKnown = (p, c) =>
  c.kind === "crash" &&
  !c.errors.length &&
  p.played !== null &&
  p.played >= KNOWN.from &&
  p.played <= KNOWN.to;

// ---- hunts ----------------------------------------------------------------------------------------------------------------------------

// A device's hunt tests as runs (a run starts at its test 1): each test's outcome and how far into the shift it had got, whether the run is
// done (the launch after the last test shows the page's own list and verdict, and has no test of its own), and how long ago it last said
// anything.
export function groupHunts(launches, now = Date.now()) {
  const tests = launches.filter((l) => l.parsed.hunt?.n > 0).sort((a, b) => a.at - b.at),
    shows = launches
      .filter((l) => l.parsed.hunt && !l.parsed.hunt.n && l.parsed.hunt.done)
      .sort((a, b) => a.at - b.at);
  const runs = [];
  let previous = 0;
  for (const l of tests) {
    if (!runs.length || l.parsed.hunt.n <= previous) runs.push({ launches: [], shown: null });
    runs[runs.length - 1].launches.push(l);
    previous = l.parsed.hunt.n;
  }
  // (a results launch belongs to the latest run that began before it)
  for (const l of shows) {
    const run = [...runs].reverse().find((r) => r.launches[0].at <= l.at);
    if (run) run.shown = l;
  }
  return runs.map(({ launches: run, shown }) => ({
    first: run[0].id,
    of: run[0].parsed.hunt.of,
    tests: run.map((l, i) => {
      const h = l.parsed.hunt,
        outcome = h.survived
          ? "survived"
          : h.unclear
            ? "unclear"
            : l.parsed.endedWord === "crash"
              ? "crashed"
              : i === run.length - 1 && !shown
                ? "running"
                : "ended";
      return {
        id: l.id,
        n: h.n,
        label: h.label,
        switches: h.switches,
        outcome,
        played: l.parsed.played,
        fps: l.parsed.fps,
      };
    }),
    done: !!shown,
    doneLine: shown ? shown.parsed.hunt.done : "",
    verdict: shown ? shown.parsed.hunt.verdict : "",
    quietMinutes: Math.round((now - Math.max(run[run.length - 1].at, shown ? shown.at : 0)) / 60000),
    token: "hunt:" + run[0].id + ":" + (shown ? "done" : "partial"),
  }));
}

// ---- reading a service ----------------------------------------------------------------------------------------------------------------

// The launches of each device: {at, devices: [{code, host, launches, hunts}], errors}. `fetch` is the platform's, or a fake.
export async function triage({
  devices,
  hosts = HOSTS,
  handled = [],
  fetch = globalThis.fetch,
  out = null,
  now = Date.now(),
  limit = 40,
}) {
  const done = new Set(handled.map(String));
  const result = { at: new Date(now).toISOString(), devices: [], errors: [] };
  const base = (h) => h.replace(/\/$/, "") + "/api/report?device=";
  if (out) mkdirSync(out, { recursive: true });
  for (const code of devices) {
    let listed = null,
      host = "";
    for (const h of hosts) {
      try {
        const res = await fetch(base(h) + code, { headers: { accept: "application/json" } });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const body = JSON.parse(await res.text());
        if (!body?.ok || !Array.isArray(body.reports)) throw new Error("not a list of reports");
        listed = body.reports;
        host = h;
        break;
      } catch (e) {
        result.errors.push(h + ": " + (e?.message || e));
      }
    }
    if (!listed) continue;
    const launches = [];
    for (const r of listed.slice(0, limit)) {
      try {
        const res = await fetch(base(host) + code + "&id=" + encodeURIComponent(r.id));
        if (!res.ok) throw new Error("HTTP " + res.status);
        const md = await res.text(),
          path = out ? join(out, r.id + ".md") : "";
        if (path) writeFileSync(path, md);
        const parsed = parseReport(md),
          cls = classify(parsed),
          token = cls.sig ? r.id + ":" + cls.sig : "";
        launches.push({
          id: r.id,
          at: r.at,
          headline: r.headline || "",
          parsed,
          class: cls,
          token,
          handled: !token || done.has(token),
          prior: [...done].filter((t) => t.startsWith(r.id + ":") && t !== token),
          known: fitsKnown(parsed, cls),
          path,
        });
      } catch (e) {
        result.errors.push("report " + r.id + ": " + (e?.message || e));
      }
    }
    const hunts = groupHunts(launches, now);
    for (const h of hunts) h.handled = done.has(h.token);
    result.devices.push({ code, host, launches, hunts });
  }
  return result;
}

// What needs a look: launches with something the matter that are not handled, newest first; then the hunt runs that are done, or have gone
// quiet, and are not handled.
export function attention(result) {
  const launches = [],
    hunts = [];
  for (const d of result.devices) {
    for (const l of d.launches)
      if (!l.handled && l.class.kind !== "hunt")
        launches.push({ type: "launch", device: d.code, token: l.token, launch: l });
    for (const h of d.hunts)
      if (!h.handled && (h.done || h.quietMinutes >= QUIET_HUNT))
        hunts.push({ type: "hunt", device: d.code, token: h.token, hunt: h });
  }
  return [...launches.sort((a, b) => b.launch.at - a.launch.at), ...hunts];
}

// ---- the digest -----------------------------------------------------------------------------------------------------------------------

const utc = (ms) => new Date(ms).toISOString().replace("T", " ").slice(5, 16) + "Z";
// A device in the digest: its first two characters only. The code is what lets anyone read the device's reports, and a digest is what gets
// pasted into an issue.
export const label = (code) => code.slice(0, 2) + "******";
export function format(result, { replayCommand = "node tools/replay.mjs" } = {}) {
  const out = ["Crash triage · " + result.at.replace("T", " ").slice(0, 16) + "Z"];
  for (const e of result.errors) out.push("COULD NOT READ: " + e);
  for (const d of result.devices) {
    const count = (kind) => d.launches.filter((l) => l.class.kind === kind).length;
    out.push(
      "Device " +
        label(d.code) +
        " (" +
        d.host +
        "): " +
        d.launches.length +
        " launches · " +
        (d.launches.length - count("clean") - count("hunt")) +
        " with something the matter · " +
        count("hunt") +
        " hunt tests · " +
        count("clean") +
        " clean",
    );
  }
  const items = attention(result);
  if (!items.length) out.push("", result.devices.length ? "NOTHING NEW." : "NOTHING READ.");
  items
    .filter((i) => i.type === "launch")
    .forEach((i, n) => {
      const l = i.launch,
        p = l.parsed;
      out.push(
        "",
        "NEW " +
          (n + 1) +
          ". " +
          l.token +
          " · " +
          l.class.kind.toUpperCase() +
          " · " +
          utc(l.at) +
          " · device " +
          label(i.device),
      );
      out.push(
        "   build " +
          p.commit +
          (p.context ? " (" + p.context + ")" : "") +
          " · " +
          (p.browser || "?") +
          (p.canvas ? " · canvas " + p.canvas : ""),
      );
      out.push("   " + (p.game || "(no game line)"));
      const bits = [];
      if (p.endedWord === "crash") bits.push("the page ended without closing");
      bits.push(
        p.played !== null
          ? "shift played " +
              p.played +
              " s after the go" +
              (p.hiddenAfterGo ? " (" + p.hiddenAfterGo + " s hidden not counted)" : "")
          : "no shift had gone yet",
      );
      if (p.fps) bits.push("last fps " + p.fps);
      if (p.plan) bits.push(p.plan);
      out.push("   " + bits.join(" · "));
      if (l.known)
        out.push(
          "   KNOWN: fits " +
            KNOWN.name +
            " (a tab killed " +
            KNOWN.from +
            " to " +
            KNOWN.to +
            " s after the go, no error): tally it, do not start again.",
        );
      if (l.prior.length) out.push("   (looked at before as " + l.prior.join(" ") + ")");
      for (const e of l.class.errors.slice(0, 3))
        out.push("   ERROR " + e.src + ": " + e.text + " (+" + e.at + " s)");
      if (l.class.errors.length && p.stack.length) out.push("   stack: " + p.stack.slice(0, 4).join(" | "));
      for (const f of p.flags.slice(0, 3))
        out.push(
          "   FLAGGED " + (f.kind ? "[" + f.kind + "] " : "") + JSON.stringify(f.note) + " (+" + f.at + " s)",
        );
      if (p.stuck >= STUCK_AFTER)
        out.push(
          "   STUCK " +
            p.waits
              .slice(-2)
              .map((w) => w.text)
              .join(" | "),
        );
      for (const note of l.class.notes.slice(0, 2)) out.push("   note: " + note.text);
      out.push("   final seconds:");
      for (const r of p.final)
        out.push("     +" + String(r.t).padStart(6) + " s  " + r.kind.padEnd(9) + " " + r.text.slice(0, 150));
      if (l.path)
        out.push(
          "   saved: " +
            l.path +
            (p.replay
              ? " · replay: " + replayCommand + " " + l.path + " --diary --pulse"
              : " · (no recording in it)"),
        );
    });
  for (const i of items.filter((x) => x.type === "hunt")) {
    const h = i.hunt;
    out.push(
      "",
      "HUNT RUN from " +
        h.first +
        " · " +
        i.token +
        " · device " +
        label(i.device) +
        " · " +
        h.tests.length +
        " of " +
        h.of +
        " tests · " +
        (h.done ? "DONE" : "PARTIAL, quiet for " + h.quietMinutes + " min"),
    );
    for (const t of h.tests)
      out.push(
        "   " +
          String(t.n).padStart(2) +
          ". " +
          t.label.padEnd(46) +
          " " +
          t.outcome.toUpperCase().padEnd(9) +
          (t.played !== null ? " " + t.played + " s after the go" : "") +
          (t.switches ? "   [" + t.switches + "]" : ""),
      );
    if (h.doneLine) out.push("   the page's own list: " + h.doneLine);
    if (h.verdict) out.push("   the page's verdict: " + h.verdict);
  }
  const tokens = items.map((i) => i.token);
  if (tokens.length)
    out.push("", "TOKENS TO WRITE INTO THE LOG WHEN THESE ARE DEALT WITH: " + tokens.join(" "));
  return out.join("\n");
}

// ---- the log --------------------------------------------------------------------------------------------------------------------------

// A token as the reader writes it: `muu6aara97:c`, `muu6aara97:e2`, `hunt:muu6aara97:done`. Anything else after `handled:` is prose.
const TOKEN = /^[A-Za-z0-9]+(?::[A-Za-z0-9]+){1,2}$/;

// The tokens a log names as dealt with: every word of a line that starts `handled:`, in the issue's body and in the comments written by the
// repo's owner. Nobody else's words count: the issue is public, and a stranger's comment is neither a record nor an instruction.
export function loggedTokens(items = [], owner = "") {
  const tokens = new Set();
  for (const item of items) {
    if (!item || String(item.user?.login || "").toLowerCase() !== owner.toLowerCase()) continue;
    for (const line of String(item.body || "").split(/\r?\n/)) {
      const m = /^\s*handled:\s*(.*)$/i.exec(line);
      if (m) for (const t of m[1].split(/[\s,]+/)) if (TOKEN.test(t)) tokens.add(t);
    }
  }
  return [...tokens];
}

// The log issue's body and comments from GitHub's REST API (plain GETs; the agent sandbox's proxy lets them through with a high limit).
export async function readLog({ repo = LOG_REPO, issue, fetch = globalThis.fetch }) {
  const base = "https://api.github.com/repos/" + repo + "/issues/" + issue;
  const get = async (url) => {
    const res = await fetch(url, {
      headers: { accept: "application/vnd.github+json", "user-agent": "pool-panic-crash-watch" },
    });
    if (!res.ok) throw new Error("HTTP " + res.status + " from " + url.replace(/\?.*/, ""));
    return JSON.parse(await res.text());
  };
  const items = [await get(base)];
  for (let page = 1; page <= 10; page++) {
    const batch = await get(base + "/comments?per_page=100&page=" + page);
    if (!Array.isArray(batch)) throw new Error("not a list of comments");
    items.push(...batch);
    if (batch.length < 100) break;
  }
  return { items, owner: repo.split("/")[0], tokens: loggedTokens(items, repo.split("/")[0]) };
}

// ---- the command line -----------------------------------------------------------------------------------------------------------------

export async function main(argv = process.argv.slice(2), env = process.env, log = console.log) {
  const args = [...argv];
  const take = (name) => {
    const values = [];
    for (let i = 0; i < args.length; i++)
      if (args[i] === "--" + name) {
        values.push(args[i + 1]);
        args.splice(i, 2);
        i--;
      }
    return values;
  };
  const hosts = take("host"),
    handled = take("handled").flatMap((s) =>
      String(s || "")
        .split(/[\s,]+/)
        .filter(Boolean),
    ),
    outs = take("out"),
    limits = take("limit"),
    issues = take("issue"),
    repos = take("repo"),
    json = args.includes("--json");
  const devices = args
    .filter((a) => a !== "--json")
    .flatMap((a) => a.split(","))
    .filter(Boolean);
  if (!devices.length || devices.some((d) => !DEVICE.test(d))) {
    console.error(
      'usage: node tools/crash-triage.mjs CODE[,CODE…] [--issue N [--repo OWNER/NAME]] [--handled "token …"] [--host URL …] [--out DIR] [--json] [--limit N]\n(a device code is 8 characters, A to Z and 2 to 7)',
    );
    return 2;
  }
  if (issues.length && !/^[1-9]\d{0,6}$/.test(String(issues[0]))) {
    console.error("--issue wants an issue number");
    return 2;
  }
  if (issues.length) {
    const repo = repos[0] || LOG_REPO;
    try {
      if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error("--repo wants OWNER/NAME");
      const logged = await readLog({ repo, issue: issues[0] });
      handled.push(...logged.tokens);
      if (!json)
        log(
          "Log: issue #" +
            issues[0] +
            " of " +
            repo +
            " read; " +
            logged.tokens.length +
            " tokens already handled.",
        );
    } catch (e) {
      log(
        "COULD NOT READ THE LOG (issue #" +
          issues[0] +
          " of " +
          repo +
          "): " +
          (e?.message || e) +
          '.\nNothing has been looked at, because what is already handled is not known. Read the issue\'s comments with the GitHub tools and run again with --handled "<the tokens>".',
      );
      return 3;
    }
  }
  const result = await triage({
    devices,
    hosts: hosts.length ? hosts : HOSTS,
    handled,
    out: outs[0] || join(env.TMPDIR || tmpdir(), "pool-panic-crash-reports"),
    limit: Number(limits[0]) || 40,
  });
  if (json) {
    const slim = (l) => ({
      id: l.id,
      at: l.at,
      token: l.token,
      kind: l.class.kind,
      handled: l.handled,
      known: l.known,
      path: l.path,
      headline: l.headline,
      played: l.parsed.played,
      level: l.parsed.level,
      errors: l.class.errors,
      flags: l.parsed.flags,
    });
    log(
      JSON.stringify(
        {
          at: result.at,
          errors: result.errors,
          devices: result.devices.map((d) => ({
            code: d.code,
            host: d.host,
            launches: d.launches.map(slim),
            hunts: d.hunts,
          })),
          attention: attention(result).map((i) => i.token),
        },
        null,
        1,
      ),
    );
  } else log(format(result));
  return result.devices.length ? 0 : 3;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await main();
