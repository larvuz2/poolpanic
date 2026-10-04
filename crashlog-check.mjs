// The crash log: what it keeps, what it counts as a crash, what a report says, and that it can never get in the game's
// way. Drives CrashLog and the browser wiring with a fake device (storage, clock, window, console, locks).
import assert from "node:assert/strict";
import { CrashLog, LIMITS, CRASHLOG_KEY, ISSUE_URL } from "./dist/crashlog.mjs";
import { installCrashLog, describeEnvironment, describeGpu } from "./dist/crashlog-hooks.mjs";
import { BUILD } from "./dist/version.mjs";

const memory = () => {
  const data = new Map();
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
  };
};
const clock = (start = 1_790_000_000_000) => {
  let t = start;
  const f = () => t;
  f.tick = (ms) => (t += ms);
  return f;
};
const fresh = (storage, now) => new CrashLog({ storage, now, schedule: () => 1 });
const boom = (message = "Cannot read properties of undefined (reading 'x')") => {
  const e = new TypeError(message);
  e.stack = `TypeError: ${message}\n    at updateAlert (https://poolpanic.netlify.app/app.mjs:1180:22)\n    at animate (https://poolpanic.netlify.app/app.mjs:1450:9)`;
  return e;
};

// 1) The version stamp exists and says "dev" from a checkout.
assert.equal(typeof BUILD.commit, "string");

// 2) Breadcrumbs: kept in order, the same thing again is counted, the ring never grows past its limit.
{
  const store = memory(),
    now = clock(),
    log = fresh(store, now);
  log.start({
    build: { commit: "abc1234", context: "production" },
    env: { ua: "TestBrowser/1" },
    page: "/index.html?debug",
  });
  now.tick(1500);
  log.crumb("incident", "fish Timmy");
  log.crumb("incident", "fish Timmy");
  log.crumb("view", "Coach Cam");
  const trail = log.session.crumbs;
  assert.deepEqual(
    trail.map((c) => c[1]),
    ["start", "incident", "view"],
  );
  assert.equal(trail[1][3], 2, "A repeat is counted, not repeated");
  const steps = LIMITS.crumbs + 150;
  for (let i = 0; i < steps; i++) log.crumb("tick", "step " + i);
  assert.equal(log.session.crumbs.length, LIMITS.crumbs, "The ring holds " + LIMITS.crumbs);
  assert.equal(log.session.crumbs.at(-1)[2], "step " + (steps - 1), "…and keeps the newest");
  log.crumb("long", "x".repeat(1000));
  assert.ok(log.session.crumbs.at(-1)[2].length <= LIMITS.crumb, "A crumb is clipped");
  // State: small flat facts only.
  log.setState({
    level: 5,
    shift: "Aqua hour",
    venue: "club",
    view: "coach",
    time: 61.234567,
    junk: { a: 1 },
    nope: NaN,
    list: [1],
  });
  assert.deepEqual(log.session.state, {
    level: 5,
    shift: "Aqua hour",
    venue: "club",
    view: "coach",
    time: 61.23,
  });
}

// 3) Errors: recorded with a tidy stack; the same error counts up; distinct ones are capped; the state is kept with them.
{
  const store = memory(),
    now = clock(),
    log = fresh(store, now);
  log.start({ build: { commit: "abc1234" } });
  log.setState({ level: 5, venue: "club", active: "fish", mode: "playing" });
  now.tick(2000);
  const first = log.error("frame:alert", boom(), { line: 1180 });
  assert.equal(first.count, 1);
  assert.ok(!/https?:/.test(first.stack), "Stack frames lose the origin");
  assert.match(first.stack, /at updateAlert \(\/app\.mjs:1180:22\)/);
  assert.equal(first.state.active, "fish", "The game's state is kept with the error");
  now.tick(40);
  const again = log.error("frame:alert", boom());
  assert.equal(again, first, "Same error, same record");
  assert.equal(first.count, 2);
  assert.equal(log.session.errors.length, 1);
  assert.equal(
    log.session.crumbs.filter((c) => c[1] === "error").length,
    1,
    "One breadcrumb for the first sighting",
  );
  for (let i = 0; i < 30; i++) log.error("frame:tags", boom("different " + i));
  assert.equal(log.session.errors.length, LIMITS.errors);
  // Odd things get thrown.
  log.error("promise", "just a string");
  log.error("promise", null);
  log.error("promise", { message: "an object" });
  assert.ok(log.session.errors.at(-1).message.length > 0);
  // Written at once: a crash right after this must find it.
  const raw = JSON.parse(store.getItem(CRASHLOG_KEY + "." + log.session.id));
  assert.equal(raw.errors.length, log.session.errors.length);
  // An error that comes back every frame is counted, not written to storage every frame.
  const busy = memory(),
    put = busy.setItem;
  let writes = 0;
  busy.setItem = (k, v) => (writes++, put(k, v));
  const loop = fresh(busy, now);
  loop.start();
  writes = 0;
  loop.error("frame:scene", boom("again and again"));
  assert.equal(writes, 1, "A new error is written at once");
  for (let i = 0; i < 300; i++) loop.error("frame:scene", boom("again and again"));
  assert.equal(loop.session.errors[0].count, 301);
  assert.equal(writes, 1, "…the same one again waits for the next scheduled write");
}

// 4) Across launches: an earlier session with errors is offered once, until reported or set aside.
{
  const store = memory(),
    now = clock(),
    a = fresh(store, now);
  a.start({ build: { commit: "abc1234" } });
  a.error("window", boom());
  a.close();
  now.tick(60_000);
  const b = fresh(store, now);
  b.start({ build: { commit: "def5678" } });
  b.settle(new Set());
  assert.equal(b.pending().length, 1);
  assert.equal(b.pending()[0].id, a.session.id);
  assert.notEqual(b.session.id, a.session.id);
  assert.match(b.headline(b.pending()[0]), /window: TypeError/);
  b.mark(a.session.id, "reported");
  assert.equal(b.pending().length, 0, "Reported: not offered again");
  const c = fresh(store, now);
  c.start();
  c.settle(new Set());
  assert.equal(c.pending().length, 0, "…on any later launch");
  assert.equal(c.troubled().length, 1, "…but it is still in the log");
  // Sent to the developer is the same, and remembers where it went.
  const f = fresh(memory(), now);
  f.start();
  f.error("window", boom());
  f.close();
  const g = fresh(f.storage, now);
  g.start();
  g.settle(new Set());
  assert.equal(g.pending().length, 1);
  assert.equal(g.mark(f.session.id, "sent", { device: "K7Q2M5XA", automatic: true, junk: { a: 1 } }), true);
  assert.equal(g.pending().length, 0, "Sent: not offered again");
  const sentRecord = fresh(f.storage, now)
    .readAll()
    .find((x) => x.id === f.session.id);
  assert.equal(sentRecord.sent.device, "K7Q2M5XA", "…and the session says where it went, on the device");
  assert.equal(sentRecord.sent.automatic, true);
  assert.equal(sentRecord.sent.junk, undefined, "…in small flat facts only");
  assert.ok(sentRecord.sent.at > 0);
  assert.equal(g.mark("nope", "sent"), false);
  // Set aside is the same.
  const d = fresh(memory(), now);
  d.start();
  d.error("window", boom());
  d.close();
  const e = fresh(d.storage, now);
  e.start();
  e.mark(d.session.id, "dismissed");
  assert.equal(e.pending().length, 0);
  // Clearing keeps only this launch.
  e.clear();
  assert.equal(e.troubled().length, 0);
  assert.equal(fresh(d.storage, now).readAll().length, 1);
}

// 5) A page that vanished mid-shift is a crash; going to the background, quitting from the menu or living on in another tab is not.
{
  const store = memory(),
    now = clock(),
    play = (log, mode) => {
      log.start();
      log.setState({ mode, level: 5, venue: "club" });
      now.tick(30_000);
      log.crumb("event", "incident fish");
      log.flush(true); // the throttle's timer, which the fake scheduler never fires
    };
  const lost = fresh(store, now);
  play(lost, "playing"); // no close(): the tab died
  const hidden = fresh(store, now);
  play(hidden, "playing");
  hidden.setHidden(true); // in the background when it went
  const menu = fresh(store, now);
  play(menu, "menu"); // never started a shift
  const other = fresh(store, now);
  play(other, "playing"); // still running in another tab
  const closed = fresh(store, now);
  play(closed, "playing");
  closed.close(); // said goodbye
  const brief = fresh(store, now);
  brief.start();
  brief.setState({ mode: "playing" }); // gone within seconds of starting: not a session worth a prompt
  now.tick(1000);
  brief.crumb("event", "x");
  brief.flush(true);
  now.tick(60_000);
  const next = fresh(store, now);
  next.start();
  assert.equal(
    next.suspects.length,
    2,
    "Suspects: the tab that died and the one that may live on in another tab",
  );
  next.settle(new Set([other.session.id]));
  const crashed = next.pending().map((s) => s.id);
  assert.ok(crashed.includes(lost.session.id), "A page that vanished mid-shift crashed");
  assert.ok(!crashed.includes(hidden.session.id), "The background is not a crash");
  assert.ok(!crashed.includes(menu.session.id), "Quitting from the menu is not a crash");
  assert.ok(!crashed.includes(other.session.id), "A page still alive in another tab is not a crash");
  assert.ok(!crashed.includes(closed.session.id), "A page that closed is not a crash");
  assert.ok(!crashed.includes(brief.session.id), "A launch that lasted seconds is not worth a prompt");
  const after = next.pending().find((s) => s.id === lost.session.id);
  assert.equal(after.crash, "unclean");
  assert.match(next.headline(after), /ended in the middle of a shift/);
  assert.match(next.report(after), /Ended:\*\* without closing/);
  assert.match(next.report(after), /level 5/, "…and the report says what it was playing");
  // Without the browser's answer (no Web Locks), a session quiet for a while is gone; a recent one might not be.
  const s2 = memory(),
    n2 = clock(),
    p2 = fresh(s2, n2);
  p2.start();
  p2.setState({ mode: "playing" });
  n2.tick(20_000);
  p2.crumb("x", "y");
  p2.flush(true);
  n2.tick(10_000);
  const q2 = fresh(s2, n2);
  q2.start();
  q2.settle(null);
  assert.equal(q2.pending().length, 0, "Quiet for 10 s: it may still be running");
  n2.tick(LIMITS.stale + 1000);
  const r2 = fresh(s2, n2);
  r2.start();
  r2.settle(null);
  assert.equal(r2.pending().length, 1, "Quiet for a minute: gone");
}

// 6) Two tabs never overwrite each other, and the log stays within its limits.
{
  const store = memory(),
    now = clock(),
    one = fresh(store, now),
    two = fresh(store, now);
  one.start();
  two.start();
  one.crumb("a", "from tab one");
  two.crumb("b", "from tab two");
  one.flush(true);
  two.flush(true);
  const ids = fresh(store, now)
    .readAll()
    .map((s) => s.id);
  assert.ok(
    ids.includes(one.session.id) && ids.includes(two.session.id),
    "Both tabs' sessions are on the device",
  );
  // Only the newest sessions are kept; troubled ones outlive clean ones.
  const s3 = memory(),
    n3 = clock();
  const bad = fresh(s3, n3);
  bad.start();
  bad.error("window", boom());
  bad.close();
  for (let i = 0; i < LIMITS.sessions + 4; i++) {
    n3.tick(1000);
    const x = fresh(s3, n3);
    x.start();
    x.close();
  }
  const last = fresh(s3, n3);
  last.start();
  assert.equal(last.sessions.length, LIMITS.sessions, "At most " + LIMITS.sessions + " sessions");
  assert.ok(
    last.sessions.some((s) => s.id === bad.session.id),
    "The one that went wrong is still there",
  );
  const keys = [...s3.data.keys()].filter((k) => k.startsWith(CRASHLOG_KEY + "."));
  assert.equal(
    keys.length,
    last.sessions.length,
    "Pruned sessions are removed from storage, not just the index",
  );
  // One session's size is capped.
  const s4 = memory(),
    big = fresh(s4, clock());
  big.start();
  for (let i = 0; i < 100; i++) big.crumb("k" + (i % 7), ("word ".repeat(40) + i).slice(0, 180));
  for (let i = 0; i < 12; i++) big.error("frame:x", boom("m".repeat(300) + i));
  assert.ok(
    s4.getItem(CRASHLOG_KEY + "." + big.session.id).length <= LIMITS.bytes,
    "A session is stored within " + LIMITS.bytes + " bytes",
  );
  assert.equal(big.session.errors.length, 12, "Errors survive the squeeze");
}

// 7) It cannot get in the game's way: a full or forbidden storage, damaged data, no storage at all.
{
  const now = clock();
  const full = {
    getItem: () => null,
    setItem: () => {
      throw new DOMException("quota", "QuotaExceededError");
    },
    removeItem: () => {},
  };
  const log = fresh(full, now);
  log.start();
  log.error("window", boom());
  log.crumb("a", "b");
  log.flush(true);
  assert.equal(log.session.errors.length, 1, "Still recorded in memory when the device will not store it");
  const junk = memory();
  junk.setItem(CRASHLOG_KEY, "{not json");
  junk.setItem(CRASHLOG_KEY + ".x", "[]");
  const ok = fresh(junk, now);
  ok.start();
  assert.equal(ok.pending().length, 0, "Damaged data is ignored");
  junk.setItem(CRASHLOG_KEY, JSON.stringify(["x", 5, null]));
  const again = fresh(junk, now);
  again.start();
  const none = fresh(null, now);
  none.start();
  none.error("window", boom());
  assert.equal(none.session.errors.length, 1, "No storage at all is fine");
  const idle = fresh(memory(), now);
  idle.crumb("before start", "nothing happens");
  idle.error("window", boom());
  idle.setState({ a: 1 });
  assert.equal(idle.latest(), null);
}

// 8) Frame timing becomes one line now and then.
{
  const log = fresh(memory(), clock());
  log.start();
  log.perf({ calls: 400 });
  assert.ok(!log.session.crumbs.some((c) => c[1] === "perf"), "No frames, no line");
  for (let i = 0; i < 60; i++) log.frame(16.7);
  log.frame(250);
  log.frame(3000);
  log.perf({ calls: 412, tris: 380, heapMB: 91, bad: { x: 1 } });
  const perf = log.session.crumbs.find((c) => c[1] === "perf");
  assert.match(perf[2], /fps \d+ · worst 3000 ms · 2 slow · calls 412 · tris 380 · heapMB 91/);
  assert.ok(
    log.session.crumbs.some((c) => c[1] === "stall"),
    "A frame that took seconds is noted on its own",
  );
  // A long frame is marked in the trail, but a slow device does not fill it with markers.
  const time = clock(),
    slow = fresh(memory(), time),
    stalls = () => slow.session.crumbs.filter((c) => c[1] === "stall").length;
  slow.start();
  slow.frame(900);
  slow.frame(950);
  assert.equal(stalls(), 1, "One marker per four seconds");
  time.tick(5000);
  slow.frame(800);
  assert.equal(stalls(), 2, "…and another once they have passed");
  time.tick(5000);
  slow.frame(300);
  assert.equal(stalls(), 2, "A frame that is only slow is not marked");
  // Coming back from the background: the first frame after it is long by nature and does not count.
  time.tick(5000);
  slow.setHidden(true);
  slow.setHidden(false);
  slow.frame(45_000);
  assert.equal(stalls(), 2, "A tab that was in the background did not stall");
  slow.frame(900);
  assert.equal(stalls(), 3, "…but the frames after it count again");
}

// 9) The report and the GitHub issue link.
{
  const store = memory(),
    now = clock(),
    log = fresh(store, now);
  log.start({
    build: { commit: "711194c", context: "production", branch: "main", built: "2026-09-29 21:55Z" },
    env: {
      ua: "Chrome 141 on Android",
      viewport: "412×915",
      dpr: 2.6,
      touch: true,
      gpu: "Adreno (TM) 740",
      canvas: "1030×2287",
      maxTexture: 8192,
      webgl2: false,
      cores: 8,
      memory: 4,
    },
    page: "/index.html",
  });
  log.setState({
    mode: "playing",
    level: 5,
    shift: "Aqua hour",
    venue: "club",
    lighting: "indoor",
    view: "coach",
    time: 62,
    score: 1200,
    active: "fish",
    rescue: "stranded cramp",
    coach: "swimming carrying lifering @-4.2,0.6",
    crowd: "swim 6, queue 3, exit 1",
    seed: 1790000000123,
  });
  for (let i = 0; i < 60; i++) {
    now.tick(1000);
    log.crumb("event", i === 30 ? "incident fish Timmy" : "save " + i);
  }
  log.error("frame:alert", boom());
  const text = log.report();
  for (const want of [
    "711194c",
    "production",
    "Chrome 141 on Android",
    "412×915",
    "Adreno",
    'level 5 "Aqua hour"',
    "club",
    "Coach Cam".toLowerCase() === "" ? "" : "coach",
    "active: fish",
    "rescue stranded cramp",
    "coach swimming carrying lifering @-4.2,0.6",
    "crowd: swim 6, queue 3, exit 1",
    "canvas 1030×2287",
    "WebGL 1",
    "max texture 8192",
    "## Timeline",
    "seed 1790000000123",
    "frame:alert",
    "TypeError",
    "at updateAlert",
    "incident fish Timmy",
  ])
    assert.ok(text.includes(want), "The report says " + want);
  assert.ok(text.length < 12000, "A report is short enough to paste (" + text.length + ")");
  // What a dialog shows: where the game was, the top of the stack and the last few things that happened.
  const preview = log.preview();
  assert.match(
    preview,
    /^Level 5 "Aqua hour" · club · coach · playing · shift 62 s\nBuild 711194c \(production\)/,
  );
  assert.match(preview, /frame:alert · TypeError: Cannot read properties/);
  assert.match(preview, /at updateAlert/);
  assert.match(preview, /Last things that happened:/);
  assert.ok(preview.length < 1600, "The preview stays short (" + preview.length + ")");
  log.error("frame:sim", boom("the second one"));
  assert.match(log.headline(), /Cannot read properties/, "The headline is the first error");
  assert.match(
    log.headline(log.session, { latest: true }),
    /the second one/,
    "…or the newest, for a snag that just happened",
  );
  assert.match(log.preview(log.session, { latest: true }), /frame:sim · TypeError: the second one/);
  const issue = log.issue();
  assert.ok(issue.url.startsWith(ISSUE_URL + "?labels=crash&title="));
  assert.ok(issue.url.length <= LIMITS.issueUrl, "The issue link fits (" + issue.url.length + ")");
  assert.match(decodeURIComponent(issue.url), /TypeError/);
  assert.match(issue.title, /^Crash: frame:alert: TypeError/);
  // A huge message still fits in a link.
  const huge = fresh(memory(), now);
  huge.start();
  for (let i = 0; i < 12; i++) huge.error("frame:" + i, boom("z".repeat(400) + i));
  for (let i = 0; i < 100; i++) huge.crumb("c", "y".repeat(170) + i);
  const long = huge.issue();
  assert.ok(
    long.url.length <= LIMITS.issueUrl,
    "Even the worst report fits a link (" + long.url.length + ")",
  );
  assert.equal(long.truncated, true);
  // Nothing to report.
  assert.match(fresh(memory(), now).report(null), /Nothing has been recorded/);
  assert.match(log.headline({ errors: [], crumbs: [] }), /No errors/);
}

// 10) The browser wiring, against a fake browser.
{
  const listeners = { win: {}, doc: {} };
  const win = {
    innerWidth: 412,
    innerHeight: 915,
    devicePixelRatio: 2.6,
    location: { pathname: "/index.html", search: "?log" },
    addEventListener: (t, f, c) => (listeners.win[t] = f),
  };
  const doc = { hidden: false, addEventListener: (t, f, c) => (listeners.doc[t] = f) };
  const calls = [];
  const con = { error: (...a) => calls.push(["error", ...a]), warn: (...a) => calls.push(["warn", ...a]) };
  const locks = { held: [], requested: [] };
  const nav = {
    userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/141",
    maxTouchPoints: 5,
    hardwareConcurrency: 8,
    deviceMemory: 4,
    language: "en-GB",
    locks: {
      request: (name, fn) => {
        locks.requested.push(name);
        fn();
        return Promise.resolve();
      },
      query: async () => ({ held: locks.held.map((name) => ({ name })) }),
    },
  };
  const store = memory();
  const before = fresh(store, clock());
  before.start();
  before.setState({ mode: "playing", level: 5 });
  before.crumb("x", "y");
  before.session.lastAt += 20_000; // it had been running a while
  before.flush(true);
  const log = installCrashLog({
    win,
    doc,
    con,
    nav,
    build: { commit: "abc1234" },
    storage: store,
    motion: true,
  });
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(log.session.env.viewport, "412×915");
  assert.equal(log.session.env.touch, true);
  assert.equal(log.session.env.reduced, true);
  assert.match(log.session.env.ua, /^\(Linux; Android 14\)/, "The user agent is trimmed");
  assert.equal(log.session.page, "/index.html?log");
  assert.deepEqual(locks.requested, ["pool-panic-session-" + log.session.id], "This page holds its lock");
  assert.equal(log.pending().length, 1, "A session whose lock is not held crashed");
  assert.equal(log.pending()[0].crash, "unclean");
  for (const type of ["error", "unhandledrejection"])
    assert.ok(listeners.win[type], type + " is listened for");
  for (const type of ["pagehide", "pageshow"]) assert.ok(listeners.win[type]);
  for (const type of ["visibilitychange", "webglcontextlost", "webglcontextrestored"])
    assert.ok(listeners.doc[type]);
  // Uncaught errors and rejections.
  listeners.win.error({
    error: boom("from window"),
    message: "from window",
    filename: "https://x.app/app.mjs",
    lineno: 7,
    colno: 3,
  });
  listeners.win.error({ message: "", error: null }); // a failed image or script tag: nothing to say
  listeners.win.unhandledrejection({ reason: boom("from a promise") });
  listeners.win.unhandledrejection({ reason: "plain" });
  assert.deepEqual(
    log.session.errors.map((e) => e.src + ":" + e.message),
    ["window:from window", "promise:from a promise", "promise:plain"],
  );
  assert.equal(log.session.errors[0].extra.file, "/app.mjs");
  // The console: the originals still run, three.js errors count as errors, everything else is a breadcrumb.
  con.error("THREE.WebGLProgram: Shader Error 0 - VALIDATE_STATUS false");
  con.error("some other error", new Error("inner"));
  con.warn("THREE.WebGLRenderer: Context Lost.");
  con.error("Pool Panic frame error", "scene", boom());
  con.warn("The AudioContext was not allowed to start.");
  assert.equal(calls.length, 5, "Every console call still reaches the console");
  assert.ok(log.session.errors.some((e) => e.src === "three" && /Shader Error/.test(e.message)));
  assert.ok(
    log.session.crumbs.some((c) => c[1] === "console.error" && /some other error Error: inner/.test(c[2])),
  );
  assert.ok(log.session.crumbs.some((c) => c[1] === "console.warn" && /Context Lost/.test(c[2])));
  assert.ok(
    !log.session.crumbs.some((c) => /Pool Panic|AudioContext/.test(c[2])),
    "The game's own reports and audio chatter are not repeated",
  );
  const second = installCrashLog({
    win: { addEventListener() {} },
    doc: { addEventListener() {} },
    con,
    nav,
    storage: memory(),
  });
  assert.ok(!second.hooks.includes("console"), "The console is wrapped once");
  // Background, goodbye, coming back.
  doc.hidden = true;
  listeners.doc.visibilitychange();
  assert.equal(log.session.hidden, true);
  doc.hidden = false;
  listeners.doc.visibilitychange();
  assert.equal(log.session.hidden, false);
  listeners.win.pagehide();
  assert.equal(log.session.open, false);
  listeners.win.pageshow({ persisted: true });
  assert.equal(log.session.open, true, "Coming back from the back-forward cache reopens the session");
  // The GPU going away.
  let prevented = false,
    lost = 0,
    back = 0;
  log.onContextLost = () => lost++;
  log.onContextRestored = () => back++;
  listeners.doc.webglcontextlost({ preventDefault: () => (prevented = true) });
  assert.ok(prevented, "The lost context is not given up on");
  assert.ok(log.session.errors.some((e) => e.src === "webgl"));
  listeners.doc.webglcontextrestored({});
  assert.deepEqual([lost, back], [1, 1]);
  // A browser without Web Locks still starts.
  const bare = installCrashLog({
    win: { addEventListener() {} },
    doc: { addEventListener() {} },
    con: {},
    nav: {},
    storage: memory(),
  });
  await new Promise((r) => setTimeout(r, 5));
  assert.ok(bare.session, "No locks, no window, no console: the log still starts");
  // The environment helpers never throw.
  assert.deepEqual(describeEnvironment({ nav: null, win: null, doc: null }).reduced, false);
  assert.equal(describeGpu(null), "");
  assert.equal(
    describeGpu({
      getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 1 }),
      getParameter: () => "ANGLE (NVIDIA GeForce RTX 3060)",
    }),
    "ANGLE (NVIDIA GeForce RTX 3060)",
  );
  assert.equal(
    describeGpu({
      getExtension: () => {
        throw new Error("lost");
      },
    }),
    "",
  );
}

console.log(
  "Crash log checks passed: breadcrumbs and errors kept and capped, repeats counted, sessions stored one per key so tabs never clash, a page that vanished mid-shift told from the background, a closed page and another tab, reports and GitHub issue links that fit, a full or broken storage shrugged off, and the browser wiring (errors, rejections, console, visibility, WebGL loss, Web Locks) driven with a fake browser.",
);
