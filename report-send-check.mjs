// Sending a crash report (dist/report-send.mjs): the device code, what the player has said about sending by themselves, where sending is
// offered, what is posted and how every way a send can fail is told. A fake fetch and a fake storage stand in for the browser.
import assert from "node:assert/strict";
import { CrashLog } from "./dist/crashlog.mjs";
import {
  REPORT_PREFS_KEY,
  REPORT_URL,
  REPORT_LIMITS,
  newDeviceCode,
  readPrefs,
  savePrefs,
  canSend,
  reportPayload,
  slimSession,
  sendReport,
  sendProblem,
} from "./dist/report-send.mjs";

const memory = () => {
  const data = new Map();
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
  };
};
const DEVICE = /^[A-Z2-7]{8}$/;

// 1) The device code: eight characters of RFC 4648 base32, from the secure generator by default, different each time.
{
  for (let i = 0; i < 50; i++) assert.match(newDeviceCode(), DEVICE);
  assert.equal(
    new Set(Array.from({ length: 40 }, () => newDeviceCode())).size,
    40,
    "40 codes, 40 different ones",
  );
  assert.equal(
    newDeviceCode(() => 0),
    "AAAAAAAA",
  );
  assert.equal(
    newDeviceCode(() => 0.999999),
    "77777777",
  );
  let n = 0;
  assert.match(
    newDeviceCode(() => (n++ % 32) / 32),
    DEVICE,
  );
}

// 2) What a device remembers: its code, made once and kept; whether reports go by themselves (never said: null).
{
  const store = memory();
  const first = readPrefs(store);
  assert.match(first.device, DEVICE);
  assert.equal(first.auto, null, "the player has not said yet");
  assert.equal(readPrefs(store).device, first.device, "the code is kept");
  assert.ok(store.getItem(REPORT_PREFS_KEY), "…on the device, under pool-panic.*");
  assert.ok(REPORT_PREFS_KEY.startsWith("pool-panic."));
  first.auto = true;
  savePrefs(store, first);
  assert.deepEqual(readPrefs(store), { device: first.device, auto: true });
  first.auto = false;
  savePrefs(store, first);
  assert.equal(readPrefs(store).auto, false, "unticked is a no, not 'never said'");
  // Damaged or foreign data is replaced, never trusted.
  store.setItem(REPORT_PREFS_KEY, "{not json");
  assert.match(readPrefs(store).device, DEVICE);
  store.setItem(REPORT_PREFS_KEY, JSON.stringify({ device: "k7q2m9xa!", auto: "yes" }));
  const fixed = readPrefs(store);
  assert.match(fixed.device, DEVICE);
  assert.equal(fixed.auto, null);
  // No storage at all (a private window): a code for this page, nothing remembered, nothing thrown.
  assert.match(readPrefs(null).device, DEVICE);
  assert.doesNotThrow(() => savePrefs(null, { device: "AAAAAAAA", auto: true }));
  const full = {
    getItem: () => null,
    setItem: () => {
      throw new Error("quota");
    },
  };
  assert.match(readPrefs(full).device, DEVICE);
}

// 3) Where sending is offered: on a page served over http(s), never in the desktop app.
{
  assert.equal(canSend({ desktop: false, protocol: "https:" }), true);
  assert.equal(canSend({ desktop: false, protocol: "http:" }), true);
  assert.equal(
    canSend({ desktop: true, protocol: "https:" }),
    false,
    "the desktop app has no site to send to",
  );
  assert.equal(canSend({ desktop: false, protocol: "file:" }), false);
  assert.equal(canSend({ desktop: false, protocol: "app:" }), false);
  assert.equal(canSend(), false);
}

// 4) What is posted: the id, the headline, the report as Markdown and the raw session; the session alone is dropped when it is too big.
{
  const log = new CrashLog({ storage: memory(), now: () => 1_790_000_000_000, schedule: () => 1 });
  log.start({ build: { commit: "abc1234" }, env: { ua: "Test/1" } });
  log.setState({ mode: "playing", level: 3 });
  log.crumb("rescue", "t4s stranded cramp victims #1 Coco (intermediate)");
  const boom = new TypeError("Cannot read properties of undefined");
  boom.stack = "TypeError: x\n    at f (https://poolpanic.netlify.app/app.mjs:1:1)";
  log.error("frame:sim", boom);
  const payload = reportPayload(log, log.session, "K7Q2M5XA");
  assert.equal(payload.v, 1);
  assert.equal(payload.device, "K7Q2M5XA");
  assert.equal(payload.id, log.session.id);
  assert.match(payload.headline, /^frame:sim: TypeError: Cannot read/);
  assert.ok(payload.headline.length <= 200);
  assert.match(payload.report, /# Pool Panic crash report/);
  assert.match(
    payload.report,
    /\*\*Device code:\*\* K7Q2M5XA/,
    "the report says which device sent it, as a pasted one does",
  );
  assert.match(payload.report, /stranded cramp victims #1 Coco/);
  assert.equal(payload.session, log.session);
  assert.ok(JSON.stringify(payload).length < REPORT_LIMITS.body);
  for (let i = 0; i < 30; i++)
    log.session.errors.push({
      id: "e" + i,
      message: "m".repeat(9000),
      stack: "",
      count: 1,
      at: 0,
      last: 0,
      src: "x",
      name: "E",
    });
  assert.equal(
    reportPayload(log, log.session, "K7Q2M5XA").session,
    null,
    "too big for the service: the report alone",
  );
  assert.match(reportPayload(log, log.session, "K7Q2M5XA").report, /Pool Panic crash report/);
}

// 5) Sending: one POST of JSON to the site's own address; every way it can fail is an answer, never a throw.
{
  const calls = [];
  const answer = (status, body) => async (url, options) => {
    calls.push({ url, options });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  const payload = { v: 1, device: "K7Q2M5XA", id: "abc", headline: "h", report: "r", session: null };
  assert.equal(REPORT_URL, "/api/report");
  const ok = await sendReport(payload, { fetch: answer(200, { ok: true, device: "K7Q2M5XA" }) });
  assert.deepEqual(ok, { ok: true, status: 200 });
  assert.equal(calls[0].url, "/api/report");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers["content-type"], "application/json");
  assert.deepEqual(JSON.parse(calls[0].options.body), payload);
  assert.ok(calls[0].options.signal, "it can be given up on");
  // The service says no.
  for (const [status, body, text] of [
    [400, { ok: false, error: "bad device" }, /bad device/],
    [413, { ok: false, error: "too big" }, /too big for the service/],
    [429, { ok: false, error: "slow down" }, /Too many reports/],
    [404, null, /not on this server/],
    [405, null, /not on this server/],
    [501, null, /not on this server/],
    [500, { ok: false, error: "storage" }, /storage/],
  ]) {
    const result = await sendReport(payload, { fetch: answer(status, body) });
    assert.equal(result.ok, false);
    assert.equal(result.status, status);
    assert.match(sendProblem(result), text, `a ${status} is told as ${text}`);
  }
  // A service that asks for quiet says for how long, in the header: it is passed on.
  const quiet = await sendReport(payload, {
    fetch: async () => ({
      ok: false,
      status: 429,
      headers: { get: (name) => (name === "retry-after" ? "90" : null) },
      json: async () => ({ ok: false, error: "slow down" }),
    }),
  });
  assert.deepEqual(quiet, { ok: false, status: 429, error: "slow down", retryAfter: 90 });
  assert.equal(
    (await sendReport(payload, { fetch: answer(429, { ok: false, error: "x" }) })).retryAfter,
    undefined,
    "no header, nothing to pass on",
  );
  // A 200 that is not the service (a static server's page) is not a send.
  const html = await sendReport(payload, {
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("<!doctype");
      },
    }),
  });
  assert.equal(html.ok, false);
  // No connection, no fetch, a slow server.
  const offline = await sendReport(payload, {
    fetch: async () => {
      throw new TypeError("Failed to fetch");
    },
  });
  assert.deepEqual(offline, { ok: false, status: 0, error: "no connection" });
  assert.match(sendProblem(offline), /No connection/);
  assert.equal((await sendReport(payload, { fetch: null })).ok, false);
  const slow = await sendReport(payload, {
    wait: 20,
    fetch: (url, { signal }) =>
      new Promise((resolve, reject) =>
        signal.addEventListener("abort", () =>
          reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
        ),
      ),
  });
  assert.deepEqual(slow, { ok: false, status: 0, error: "timed out" });
  assert.match(sendProblem(slow), /did not answer/);
  assert.equal(sendProblem({ ok: true }), "");
  assert.equal(sendProblem(null), "");
}

// 6) What a playtest sends again and again: the report carries everything, so the raw session comes without its breadcrumbs and recordings;
// a report that would be too big for the service loses its oldest breadcrumbs, then its recorded shift, until it fits.
{
  const log = new CrashLog({ storage: memory(), now: () => 1_790_000_000_000, schedule: () => 1 });
  log.start({ build: { commit: "abc1234" }, env: { ua: "Test/1" } });
  log.setLimits({ crumbs: 1000, bytes: 240000 });
  log.setState({ level: 7 });
  for (let i = 0; i < 300; i++) log.crumb("t", "line " + i);
  log.flag("stuck at the edge", { kind: "stuck" });
  log.setPlaytest({ lines: ["- Level 7"], data: { v: 1, levels: { 7: { runs: 1 } } } });
  log.attach("replays", { level: 7, seed: 5, ticks: 3, inputs: [[0, "jump"]] });
  const slim = slimSession(log.session);
  assert.equal(slim.crumbs.length, 30, "the newest thirty");
  assert.equal(slim.crumbs.at(-1)[2], "[stuck] stuck at the edge");
  assert.equal(slim.replays, undefined);
  assert.deepEqual(
    slim.playtest,
    { data: { v: 1, levels: { 7: { runs: 1 } } } },
    "the lines are in the report; the data stays",
  );
  assert.equal(slim.flags.length, 1, "what was flagged stays");
  assert.equal(slim.id, log.session.id);
  assert.equal(log.session.crumbs.length, 302, "…and the log itself is not touched");
  const live = reportPayload(log, log.session, "K7Q2M5XA", { slim: true });
  assert.equal(live.session.crumbs.length, 30);
  assert.match(live.report, /## Flagged by the player/);
  assert.match(
    live.report,
    /## Replay: level 7 seed 5 \(1 inputs\)/,
    "the newest recorded shift is in the report",
  );
  assert.match(live.report, /line 299/);
  assert.match(live.headline, /^Playtest L7 · 1 flagged: stuck at the edge/);
  assert.equal(
    reportPayload(log, log.session, "K7Q2M5XA").session.crumbs.length,
    302,
    "the whole session when it is not slim",
  );

  // Too big even without the session: half of the oldest breadcrumbs go (the newest kept), and then, only if that is not enough, the
  // recorded shift.
  const size = (text) => new TextEncoder().encode(text).length;
  const make = (arrows) => {
    const big = new CrashLog({ storage: null, now: () => 1_790_000_000_000, schedule: () => 1 });
    big.start({});
    big.setLimits({ crumbs: 1000 });
    for (let i = 0; i < 1000; i++) big.crumb("t", "line " + i + " " + "→".repeat(arrows));
    big.attach("replays", { level: 7, seed: 5, ticks: 3, inputs: [], pad: "x".repeat(30000) });
    return reportPayload(big, big.session, "K7Q2M5XA", { slim: true });
  };
  const some = make(100); // (about 330 bytes a line: 330 KB of timeline)
  assert.ok(size(JSON.stringify(some)) <= REPORT_LIMITS.body, "it fits: " + size(JSON.stringify(some)));
  assert.match(some.report, /line 999 /, "the newest breadcrumbs are kept");
  assert.ok(!/line 0 /.test(some.report), "the oldest are the ones that went");
  assert.ok(some.report.includes("## Replay: level 7"), "the recorded shift stays while that is enough");
  const lots = make(300); // (clipped to a line of 240 characters: 700 KB of timeline)
  assert.ok(size(JSON.stringify(lots)) <= REPORT_LIMITS.body, "it fits: " + size(JSON.stringify(lots)));
  assert.match(lots.report, /line 999 /);
  assert.ok(!lots.report.includes("## Replay"), "the recorded shift goes when it has to");
  assert.ok(lots.report.includes("# Pool Panic crash report"));
}

console.log(
  "Report send checks passed: a device code that names this device's reports, the player's say on automatic sending (never said, yes, no), sending offered only on a served page and never in the desktop app, a payload with the report and the session (the report alone when too big), and every way a send can fail told plainly, a playtest's slim live copy, and a report too big for the service shrunk to fit with its newest lines kept.",
);
