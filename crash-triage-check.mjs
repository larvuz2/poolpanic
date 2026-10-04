// The reading half of the crash watch (tools/crash-triage.mjs, docs/crash-watch.md): what the creator's devices have sent, sorted into what
// needs a look. The reports are made by the real CrashLog (dist/crashlog.mjs), so a change to the report's format that the reader cannot
// follow fails here, and the service is a fake that answers as netlify/functions/report.mjs does.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CrashLog, LIMITS } from "./dist/crashlog.mjs";
import {
  parseReport,
  classify,
  fitsKnown,
  groupHunts,
  triage,
  attention,
  format,
  main,
  label,
  loggedTokens,
  readLog,
  KNOWN,
  DEVICE,
} from "./tools/crash-triage.mjs";

const CODE = "TEST2345";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.1 Safari/605.1.15";
const memory = () => {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
  };
};
const boom = (message) => {
  const e = new TypeError(message);
  e.stack = `TypeError: ${message}\n    at updateAlert (https://poolpanic.netlify.app/app.mjs:1180:22)\n    at animate (https://poolpanic.netlify.app/app.mjs:1450:9)`;
  return e;
};
let counter = 0;

// One launch as the game would have reported it. Times are seconds since the page opened. `end`: the last word of the log. `how`: "crash"
// (the next launch finds the page gone), "closed" (it said goodbye) or "running".
function launch(spec) {
  const {
    commit = "2bf1480",
    level = 2,
    name = "Lunch rush",
    go = 8,
    end = 52,
    how = "crash",
    hidden = [],
    hiddenOpen = 0,
    replay = false,
    errors = [],
    flags = [],
    waits = [],
    hunt = [],
    fps = 45,
    ua = UA,
    touch = true,
    at = 1_790_000_000_000 + counter * 600_000,
  } = spec;
  const store = memory();
  let t = at;
  const now = () => t;
  const make = () => new CrashLog({ storage: store, now, schedule: () => 1 });
  const log = make();
  log.start({
    build: { commit, context: "deploy-preview", branch: "claude/test" },
    env: { ua, viewport: "1366×892", dpr: 2, touch, gpu: "Apple GPU", canvas: "2322×1516", cores: 8 },
    page: "/?playtest",
  });
  const steps = [];
  const put = (s, fn) => steps.push([s, steps.length, fn]);
  if (level) {
    put(1, () => log.crumb("shift", `start L${level} ${name} · club · seed 5`));
    put(1, () => log.crumb("plan", "plan: twist@30s"));
    put(go, () => log.crumb("event", "go"));
  }
  for (const [from, to] of hidden) {
    put(from, () => log.crumb("hidden", ""));
    put(to, () => log.crumb("visible", ""));
  }
  if (hiddenOpen) put(hiddenOpen, () => log.crumb("hidden", ""));
  for (const [s, src, message] of errors) put(s, () => log.error(src, boom(message)));
  for (const [s, note, kind] of flags) put(s, () => log.flag(note, { kind }));
  for (const [s, text] of waits) put(s, () => log.crumb("waiting", text));
  for (const [s, text] of hunt) put(s, () => log.crumb("hunt", text));
  put(end - 2, () => log.crumb("perf", `fps ${fps} · worst 34 ms · 0 slow · calls 250`));
  put(end, () => log.crumb("event", 'toast "Gus lost patience. Customer lost −100" warning'));
  steps.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (const [s, , fn] of steps) {
    t = Math.max(t, log.session.t0 + s * 1000);
    fn();
  }
  log.setState({
    level,
    shift: name,
    venue: "club",
    lighting: "indoor",
    view: "overview",
    mode: level ? "playing" : "menu",
    time: 40.98,
    score: -100,
  });
  log.flush(true);
  let report, headline;
  if (how === "crash") {
    t += LIMITS.stale + 1000;
    const next = make();
    next.start();
    next.settle(null);
    const s = next.pending().find((x) => x.id === log.session.id);
    assert.ok(s, "the page that vanished is a crash for the next launch");
    report = next.report(s, { device: CODE });
    headline = next.headline(s);
  } else {
    if (how === "closed") log.close();
    report = log.report(log.session, { device: CODE });
    headline = log.headline(log.session);
  }
  counter++;
  if (replay) report += "\n\n## Replay: level " + level + " seed 5 (64 inputs)\n\n```json\n{}\n```";
  return { id: log.session.id, at: t, md: report, headline };
}

// The report service as the game and the developer see it: a list of a device's launches (newest first) and one report by id.
function service(launches, { failList = false, failId = "", list = null } = {}) {
  const calls = [];
  const answer = (status, body) => ({
    ok: status < 300,
    status,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  });
  const fetch = async (url) => {
    calls.push(String(url));
    const u = new URL(url);
    if (u.searchParams.get("device") !== CODE)
      return answer(200, { ok: true, device: u.searchParams.get("device"), reports: [] });
    const id = u.searchParams.get("id");
    if (!id) {
      if (failList) return answer(500, { ok: false, error: "storage" });
      return answer(
        200,
        list || {
          ok: true,
          device: CODE,
          reports: [...launches].reverse().map((l) => ({
            id: l.id,
            at: l.at,
            iso: new Date(l.at).toISOString(),
            headline: l.headline,
            bytes: l.md.length,
            commit: "2bf1480",
            ua: UA,
          })),
        },
      );
    }
    if (id === failId) return answer(500, { ok: false });
    const found = launches.find((l) => l.id === id);
    return found ? answer(200, found.md) : answer(404, { ok: false });
  };
  return { fetch, calls };
}
const tmp = mkdtempSync(join(tmpdir(), "crash-triage-check-"));
const NOW = 1_790_000_000_000 + 40 * 600_000;
const run = (launches, extra = {}) =>
  triage({
    devices: [CODE],
    hosts: ["https://one.test", "https://two.test"],
    fetch: service(launches, extra.service).fetch,
    out: join(tmp, "out"),
    now: NOW,
    ...extra.args,
  });

// 1) One report read as facts: the crash that has been hunted (44 s after the go, the page just gone), what the game was doing, the device.
{
  const l = launch({ go: 8, end: 52 });
  const p = parseReport(l.md);
  assert.equal(p.endedWord, "crash");
  assert.equal(p.level, 2);
  assert.equal(p.shiftName, "Lunch rush");
  assert.equal(p.go, 8);
  assert.equal(p.played, 44, "the last word came 44 s after the go");
  assert.equal(p.fps, 45);
  assert.equal(p.commit, "2bf1480");
  assert.equal(p.context, "deploy-preview");
  assert.equal(p.canvas, "2322×1516");
  assert.equal(p.plan, "plan: twist@30s");
  assert.match(p.browser, /Safari 26\.6\.1 on an iPad that says it is a Mac/);
  assert.match(p.game, /level 2 "Lunch rush" · club · indoor · overview · playing/);
  assert.ok(
    p.final.length > 0 && p.final.every((r) => r.kind !== "perf"),
    "the final seconds leave the numbers out",
  );
  assert.equal(p.final.at(-1).kind, "event");
  const c = classify(p);
  assert.deepEqual([c.kind, c.sig], ["crash", "c"]);
  assert.ok(fitsKnown(p, c), "a tab killed 44 s after the go with no error is the known crash");
  assert.equal(KNOWN.from, 38);
  // Not the known one: too early, or an error came with it.
  const early = parseReport(launch({ go: 8, end: 28 }).md);
  assert.ok(!fitsKnown(early, classify(early)), "20 s in is not it");
  assert.equal(early.played, 20);
  const noGo = parseReport(launch({ level: 0, end: 20, how: "running" }).md);
  assert.equal(noGo.played, null, "no shift, no go");
  assert.ok(!fitsKnown(noGo, classify(noGo)));
}

// 2) The time hidden after the go is not played; the last shift of a launch is the one that counts.
{
  const l = launch({ go: 8, end: 60, hidden: [[20, 32]] });
  assert.equal(parseReport(l.md).played, 40, "52 s since the go, 12 s of them in the background");
  assert.equal(parseReport(l.md).hiddenAfterGo, 12);
  const before = parseReport(launch({ go: 30, end: 60, hidden: [[10, 20]] }).md);
  assert.equal(before.played, 30, "hidden before the go costs the shift nothing");
  const closed = parseReport(launch({ go: 8, end: 60, hidden: [[40, 50]], how: "crash" }).md);
  assert.equal(closed.played, 42, "52 s since the go, 10 of them hidden");
  // A background span still open when the log ends (the tab was killed while hidden) is not played either.
  const open = parseReport(launch({ go: 8, end: 60, hiddenOpen: 50, how: "crash" }).md);
  assert.equal(open.played, 42);
  assert.equal(open.hiddenAfterGo, 10);
}

// 3) Errors, flags and a stuck incident are what the matter is; a context lost while hidden is a note, a stack is kept.
{
  const err = parseReport(
    launch({
      errors: [[30, "frame:tags", "Cannot read properties of undefined (reading 'x')"]],
      how: "closed",
    }).md,
  );
  const c = classify(err);
  assert.deepEqual([c.kind, c.sig], ["error", "e1"]);
  assert.equal(c.errors[0].src, "frame:tags");
  assert.match(c.errors[0].text, /TypeError: Cannot read properties of undefined/);
  assert.match(err.stack[0], /^TypeError: Cannot read/);
  assert.ok(
    err.stack.some((x) => /updateAlert/.test(x)),
    "the first lines of the stack are kept",
  );
  assert.ok(err.stack.length <= 5);
  const both = parseReport(launch({ errors: [[30, "frame:tags", "boom"]], how: "crash", go: 8, end: 52 }).md);
  assert.deepEqual(classify(both).sig, "ce1", "an error and then a crash: both in the token");
  assert.ok(!fitsKnown(both, classify(both)), "…and not the known crash, which has no error");
  const lost = parseReport(
    launch({ errors: [[30, "webgl", "WebGL context lost (the browser took the GPU back)"]], how: "closed" })
      .md,
  );
  const cl = classify(lost);
  assert.deepEqual([cl.kind, cl.sig], ["clean", ""], "the GPU taken back while hidden is not the matter");
  assert.equal(cl.notes.length, 1);
  const flagged = parseReport(launch({ flags: [[20, "the fish kid froze", "stuck"]], how: "closed" }).md);
  const cf = classify(flagged);
  assert.deepEqual([cf.kind, cf.sig], ["flag", "f1"]);
  assert.deepEqual(flagged.flags[0], { at: 20, kind: "stuck", note: "the fish kid froze" });
  const stuck = parseReport(
    launch({
      waits: [
        [30, "t17s fish has been like this for 25 s · stage loose"],
        [55, "t42s fish has been like this for 50 s · stage loose"],
      ],
      how: "closed",
    }).md,
  );
  const cs = classify(stuck);
  assert.deepEqual([cs.kind, cs.sig], ["stuck", "w"]);
  assert.equal(stuck.stuck, 50);
  const short = parseReport(
    launch({ waits: [[30, "t17s fish has been like this for 25 s"]], how: "closed" }).md,
  );
  assert.equal(classify(short).kind, "clean", "25 s is a diary line, not a stuck incident");
  const clean = parseReport(launch({ how: "closed" }).md);
  assert.deepEqual([classify(clean).kind, classify(clean).sig], ["clean", ""]);
  const running = parseReport(launch({ how: "running" }).md);
  assert.equal(running.endedWord, "running");
  assert.equal(classify(running).kind, "clean", "a launch that is still going has not crashed");
}

// 4) A service read in full: what is new, what is clean, tokens, the saved reports, and nothing new once the tokens are handed back.
{
  const launches = [
    launch({ how: "closed" }), // clean
    launch({ go: 8, end: 52, replay: true }), // the known crash, with the shift recorded in it
    launch({ go: 8, end: 24, errors: [[20, "frame:alert", "kaboom"]] }), // crash with an error
    launch({ flags: [[20, "looks wrong", "wrong"]], how: "closed" }), // flagged
  ];
  const result = await run(launches);
  assert.equal(result.errors.length, 0);
  assert.equal(result.devices.length, 1);
  assert.equal(result.devices[0].host, "https://one.test", "the first host that answers");
  const items = attention(result);
  assert.equal(items.length, 3, "three launches have something the matter");
  assert.deepEqual(
    items.map((i) => i.launch.class.kind),
    ["flag", "crash", "crash"],
    "newest first",
  );
  assert.deepEqual(
    items.map((i) => i.token),
    items.map((i) => i.launch.id + ":" + i.launch.class.sig),
  );
  assert.ok(
    !items[1].launch.known && items[2].launch.known,
    "the crash with an error is not the known one, the plain one is",
  );
  for (const l of result.devices[0].launches) {
    assert.ok(existsSync(l.path), "every report is saved");
    assert.equal(readFileSync(l.path, "utf8"), launches.find((x) => x.id === l.id).md);
    assert.ok(!l.path.includes(CODE), "a saved report's name does not give the device code away");
  }
  const text = format(result);
  assert.match(text, /NEW 1\. \S+:f1 · FLAG/);
  assert.match(text, /KNOWN: fits the 45-second crash/);
  assert.match(text, /ERROR frame:alert: TypeError: kaboom/);
  assert.match(text, /FLAGGED \[wrong\] "looks wrong"/);
  assert.match(text, /\(no recording in it\)/, "a report with no recording says so");
  assert.match(
    text,
    /saved: \S+\.md · replay: node tools\/replay\.mjs \S+\.md --diary --pulse/,
    "a report with the shift recorded in it says how to play it again",
  );
  assert.deepEqual(parseReport(launches[1].md).replay, { level: 2, seed: 5, inputs: 64 });
  assert.match(text, /TOKENS TO WRITE INTO THE LOG WHEN THESE ARE DEALT WITH: \S+:f1 \S+:ce1 \S+:c/);
  assert.ok(
    !text.includes(CODE),
    "the digest names a device by its first two characters, not the code that reads its reports",
  );
  assert.equal(label(CODE), "TE******");
  // Hand the tokens back: nothing is new. A token that is not one of these changes nothing.
  const handled = items.map((i) => i.token);
  const again = await run(launches, { args: { handled: [...handled, "something:else"] } });
  assert.equal(attention(again).length, 0);
  assert.match(format(again), /NOTHING NEW\./);
  // A launch that gains a problem is a new token, and says what it was looked at as before.
  const grown = launch({ go: 8, end: 52, errors: [[30, "frame:tags", "boom"]] });
  const before = grown.id + ":e1";
  const next = await run([grown], { args: { handled: [before] } });
  const [item] = attention(next);
  assert.equal(item.token, grown.id + ":ce1");
  assert.deepEqual(item.launch.prior, [before]);
  assert.match(format(next), /looked at before as \S+:e1/);
}

// 5) A hunt (?bisect=shift) is read as one run, not as crashes: tests in order, each one's outcome, and the page's own verdict at the end.
{
  const head = (n, text, switches, tail = "replaying level 2 seed 99 (64 inputs)") =>
    `Crash hunt · test ${n} of 12 · ${text} · switches: ${switches} · ${tail}`;
  const tests = [
    launch({ go: 8, end: 53, hunt: [[6, head(1, "Everything on", "overview")]], how: "crash" }), // crashed 45 s after the go
    launch({
      go: 8,
      end: 66,
      hunt: [
        [6, head(2, "Pixel ratio 1 (a third of the pixels)", "overview + dpr=1")],
        [66, "survived"],
      ],
      how: "closed",
    }),
    launch({
      go: 8,
      end: 40,
      hunt: [
        [6, head(3, "3D scene updated, never drawn", "overview + norender")],
        [40, "not played through"],
      ],
      how: "closed",
    }),
    launch({
      go: 8,
      end: 50,
      hunt: [[6, head(4, "3D scene neither updated nor drawn", "overview + nosync")]],
      how: "crash",
    }),
  ];
  const lastWord = Math.max(...tests.map((l) => l.at));
  const first = await run(tests, { args: { now: lastWord + 10 * 60_000 } });
  let [d] = first.devices;
  assert.deepEqual(
    d.launches.map((l) => l.class.kind),
    ["hunt", "hunt", "hunt", "hunt"],
  );
  assert.equal(d.launches.filter((l) => l.token).length, 0, "a hunt test has no token of its own");
  assert.equal(d.hunts.length, 1);
  let h = d.hunts[0];
  assert.deepEqual(
    h.tests.map((t) => [t.n, t.outcome]),
    [
      [1, "crashed"],
      [2, "survived"],
      [3, "unclear"],
      [4, "crashed"],
    ],
  );
  assert.equal(h.tests[0].played, 45, "how far into the shift the crashed test had got");
  assert.equal(h.tests[0].switches, "overview");
  assert.equal(h.tests[1].switches, "overview + dpr=1");
  assert.equal(h.of, 12);
  assert.equal(h.done, false);
  assert.match(h.token, /^hunt:\S+:partial$/);
  assert.equal(
    attention(first).length,
    0,
    "a hunt that is still going (the last word 10 minutes ago) is waited for",
  );
  // Quiet for a while with no ending: read as it stands, once.
  const quiet = await run(tests, { args: { now: lastWord + 3 * 3600_000 } });
  const quietItems = attention(quiet);
  assert.equal(quietItems.length, 1);
  assert.equal(quietItems[0].type, "hunt");
  assert.match(
    format(quiet, {}),
    /HUNT RUN from \S+ · hunt:\S+:partial · device TE\*{6} · 4 of 12 tests · PARTIAL, quiet for \d+ min/,
  );
  assert.match(format(quiet), /CRASHED +45 s after the go +\[overview\]/);
  // The launch after the last test shows the page's own list and verdict (no test of its own): the run is done.
  const results = launch({
    level: 0,
    end: 10,
    how: "closed",
    hunt: [
      [5, "done: control crashed, dpr1 ok, norender ok"],
      [5, "The crash went away with: Pixel ratio 1 (a third of the pixels). That is where to look."],
    ],
  });
  const full = await run([...tests, results]);
  h = full.devices[0].hunts[0];
  assert.equal(h.done, true);
  assert.match(h.token, /^hunt:\S+:done$/);
  assert.match(h.doneLine, /^control crashed, dpr1 ok/);
  assert.match(h.verdict, /^The crash went away with: Pixel ratio 1/);
  assert.equal(h.tests.at(-1).outcome, "crashed");
  const items = attention(full);
  assert.equal(items.length, 1);
  assert.match(format(full), /the page's verdict: The crash went away with: Pixel ratio 1/);
  assert.equal(
    attention(await run([...tests, results], { args: { handled: [items[0].token] } })).length,
    0,
    "handled once",
  );
  // A second run (its test 1 comes after test 4) is a run of its own.
  const again = launch({
    go: 8,
    end: 66,
    hunt: [
      [6, head(1, "Everything on", "overview")],
      [66, "survived"],
    ],
    how: "closed",
  });
  const two = await run([...tests, results, again]);
  assert.equal(two.devices[0].hunts.length, 2);
  assert.equal(two.devices[0].hunts[1].tests.length, 1);
  assert.equal(two.devices[0].hunts[0].done, true, "the results belong to the run before them");
  assert.equal(two.devices[0].hunts[1].done, false);
  // The tests are groupHunts' business alone: the same answer from the launches it is given.
  assert.equal(groupHunts(two.devices[0].launches, NOW).length, 2);
}

// 6) The service failing: said, never read as "nothing new"; one report failing does not stop the others; the next host is tried.
{
  const launches = [launch({ how: "closed" }), launch({ go: 8, end: 52 })];
  const down = await run(launches, { service: { failList: true } });
  assert.equal(down.devices.length, 0);
  assert.equal(down.errors.length, 2, "one for each host");
  assert.match(down.errors[0], /one\.test: HTTP 500/);
  assert.match(format(down), /COULD NOT READ: https:\/\/one\.test: HTTP 500/);
  assert.match(format(down), /NOTHING READ\./);
  assert.ok(!/NOTHING NEW/.test(format(down)));
  const part = await run(launches, { service: { failId: launches[1].id } });
  assert.equal(part.devices[0].launches.length, 1, "the others are still read");
  assert.match(part.errors[0], /report \S+: HTTP 500/);
  const odd = await run(launches, { service: { list: "not json at all" } });
  assert.equal(odd.devices.length, 0);
  const second = triage({
    devices: [CODE],
    hosts: ["https://broken.test", "https://good.test"],
    fetch: async (url) =>
      String(url).startsWith("https://broken.test")
        ? { ok: false, status: 502, text: async () => "bad gateway" }
        : service(launches).fetch(url),
    now: NOW,
  });
  const read = await second;
  assert.equal(read.devices[0].host, "https://good.test", "the next host is tried");
  assert.match(read.errors[0], /broken\.test: HTTP 502/);
  const unknown = await triage({
    devices: ["ZZZZ2345"],
    hosts: ["https://one.test"],
    fetch: service(launches).fetch,
    now: NOW,
  });
  assert.equal(
    unknown.devices[0].launches.length,
    0,
    "a device that never sent anything is an empty list, not an error",
  );
  assert.match(format(unknown), /NOTHING NEW\./);
}

// 7) The command line: usage, the exit codes, the digest and the JSON.
{
  const launches = [launch({ go: 8, end: 52 }), launch({ how: "closed" })];
  const { fetch } = service(launches);
  const real = globalThis.fetch;
  globalThis.fetch = fetch;
  try {
    const lines = [];
    const code = await main(["TEST2345", "--host", "https://one.test", "--out", join(tmp, "cli")], {}, (x) =>
      lines.push(x),
    );
    assert.equal(code, 0);
    assert.match(lines.join("\n"), /NEW 1\. \S+:c · CRASH/);
    assert.ok(existsSync(join(tmp, "cli", launches[0].id + ".md")));
    const handled = [];
    assert.equal(
      await main(
        [
          "TEST2345",
          "--host",
          "https://one.test",
          "--out",
          join(tmp, "cli"),
          "--handled",
          launches[0].id + ":c",
        ],
        {},
        (x) => handled.push(x),
      ),
      0,
    );
    assert.match(handled.join("\n"), /NOTHING NEW\./);
    const json = [];
    assert.equal(
      await main(["TEST2345", "--host", "https://one.test", "--out", join(tmp, "cli"), "--json"], {}, (x) =>
        json.push(x),
      ),
      0,
    );
    const parsed = JSON.parse(json.join("\n"));
    assert.deepEqual(parsed.attention, [launches[0].id + ":c"]);
    assert.equal(parsed.devices[0].launches.find((l) => l.id === launches[0].id).known, true);
    assert.ok(!JSON.stringify(parsed).includes("viewport"), "the JSON is the facts, not the reports");
    const err = console.error;
    const said = [];
    console.error = (x) => said.push(x);
    try {
      assert.equal(await main([], {}, () => {}), 2, "no device");
      assert.equal(await main(["short"], {}, () => {}), 2, "not a device code");
      assert.equal(await main(["test2345"], {}, () => {}), 2, "lower case is not one either");
    } finally {
      console.error = err;
    }
    assert.match(said[0], /usage: node tools\/crash-triage\.mjs CODE/);
    assert.ok(DEVICE.test("OQL6QS7M") && !DEVICE.test("OQL1QS7M"), "a device code has no 0, 1, 8 or 9");
    globalThis.fetch = service([], { failList: true }).fetch;
    assert.equal(
      await main(["TEST2345", "--host", "https://one.test", "--out", join(tmp, "cli")], {}, () => {}),
      3,
      "nothing readable",
    );
  } finally {
    globalThis.fetch = real;
  }
}

// 8) The log: which tokens the log issue names as handled, whose words count, and the command line reading them from it.
{
  const OWNER = "larvuz2";
  const item = (login, body) => ({ user: { login }, body });
  assert.deepEqual(
    loggedTokens(
      [
        item(OWNER, "The body: each comment ends with a line `handled: <tokens>`, here inside a sentence."),
        item(OWNER, "First entry.\n\nhandled: aaa111bbb2:c aaa111bbb3:e2\n"),
        item("LarvUz2", "Another.\r\nHandled: hunt:aaa111bbb4:done, aaa111bbb5:w\r\n"),
        item("a-stranger", "handled: zzz999zzz9:c"),
        item(OWNER, "4. **`handled:` tokens collected** (a numbered line is not a handled line): nope:c"),
        item(OWNER, "handled: all of them, the five above"),
        null,
      ],
      OWNER,
    ),
    ["aaa111bbb2:c", "aaa111bbb3:e2", "hunt:aaa111bbb4:done", "aaa111bbb5:w"],
    "the owner's lines that start handled: and only their tokens; a stranger's words, a sentence and prose are not the log",
  );

  // GitHub's REST API as a fake: the issue, then its comments a hundred at a time.
  const github = (comments, { status = 200 } = {}) => {
    const calls = [];
    const fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      const u = new URL(url);
      const answer = (body) => ({
        ok: status < 300,
        status,
        text: async () => JSON.stringify(body),
      });
      if (status >= 300) return answer({ message: "no" });
      const m = /^\/repos\/([^/]+\/[^/]+)\/issues\/(\d+)(\/comments)?$/.exec(u.pathname);
      if (!m) return answer({ message: "Not Found" });
      if (!m[3]) return answer(item(m[1].split("/")[0], "The body."));
      const page = Number(u.searchParams.get("page")) || 1;
      return answer(comments.slice((page - 1) * 100, page * 100));
    };
    return { fetch, calls };
  };

  // More than a hundred comments are read in pages, the issue's own body first.
  const many = Array.from({ length: 101 }, (_, i) =>
    item(OWNER, "handled: " + String(i).padStart(10, "a") + ":c"),
  );
  const paged = github(many);
  const log = await readLog({ issue: 22, fetch: paged.fetch });
  assert.equal(log.tokens.length, 101, "every page is read");
  assert.equal(paged.calls.length, 3, "the issue, then two pages of comments");
  assert.match(paged.calls[0].url, /^https:\/\/api\.github\.com\/repos\/larvuz2\/poolpanic\/issues\/22$/);
  assert.ok(paged.calls[0].init.headers["user-agent"], "GitHub asks for a user agent");
  await assert.rejects(() => readLog({ issue: 22, fetch: github([], { status: 403 }).fetch }), /HTTP 403/);

  // The command line, with the log and the report service answering through the one fetch of the platform.
  const launches = [launch({ go: 8, end: 52 }), launch({ how: "closed" })];
  const service2 = service(launches);
  const route = (comments, options) => {
    const gh = github(comments, options);
    return {
      gh,
      fetch: (url, init) =>
        String(url).startsWith("https://api.github.com/") ? gh.fetch(url, init) : service2.fetch(url, init),
    };
  };
  const real = globalThis.fetch;
  const run = async (extra, comments, options) => {
    const r = route(comments, options);
    globalThis.fetch = r.fetch;
    const lines = [];
    const code = await main(
      ["TEST2345", "--host", "https://one.test", "--out", join(tmp, "log"), ...extra],
      {},
      (x) => lines.push(x),
    );
    return { code, text: lines.join("\n"), gh: r.gh };
  };
  try {
    const open = await run(["--issue", "22"], []);
    assert.equal(open.code, 0);
    assert.match(open.text, /^Log: issue #22 of larvuz2\/poolpanic read; 0 tokens already handled\./);
    assert.match(open.text, /NEW 1\. \S+:c · CRASH/, "nothing in the log: the crash is new");

    const dealt = await run(
      ["--issue", "22"],
      [item(OWNER, "Looked at.\n\nhandled: " + launches[0].id + ":c")],
    );
    assert.equal(dealt.code, 0);
    assert.match(dealt.text, /read; 1 tokens already handled\./);
    assert.match(dealt.text, /NOTHING NEW\./, "what the log names is not looked at again");

    const stranger = await run(["--issue", "22"], [item("a-stranger", "handled: " + launches[0].id + ":c")]);
    assert.match(stranger.text, /NEW 1\./, "a stranger cannot mark a crash as dealt with");

    const both = await run(["--issue", "22", "--handled", launches[0].id + ":c"], []);
    assert.match(
      both.text,
      /NOTHING NEW\./,
      "tokens given on the command line and tokens from the log are added together",
    );

    const other = await run(["--issue", "7", "--repo", "someone/else"], []);
    assert.match(other.gh.calls[0].url, /repos\/someone\/else\/issues\/7$/);
    assert.match(other.text, /Log: issue #7 of someone\/else read/);

    const json = await run(["--issue", "22", "--json"], [item(OWNER, "handled: " + launches[0].id + ":c")]);
    assert.deepEqual(JSON.parse(json.text).attention, [], "the JSON stays JSON: the log line is left out");

    const down = await run(["--issue", "22"], [], { status: 403 });
    assert.equal(down.code, 3, "a log that cannot be read is nothing read");
    assert.match(down.text, /COULD NOT READ THE LOG \(issue #22 of larvuz2\/poolpanic\): HTTP 403/);
    assert.ok(!/NOTHING NEW|NEW 1\./.test(down.text), "…and never read as nothing new, nor everything new");

    const err = console.error;
    const said = [];
    console.error = (x) => said.push(x);
    try {
      assert.equal(await main(["TEST2345", "--issue", "twenty"], {}, () => {}), 2);
      assert.equal(await main(["TEST2345", "--issue", "22", "--repo", "no slash"], {}, () => {}), 3);
    } finally {
      console.error = err;
    }
    assert.match(said[0], /--issue wants an issue number/);
  } finally {
    globalThis.fetch = real;
  }
}

rmSync(tmp, { recursive: true, force: true });
console.log(
  "Crash triage checks passed: a report made by the real crash log read as facts (the shift's level, how long it had been played when the last word came with the time hidden left out, the final seconds), the known 45-second crash told from a crash with an error or at another time, errors, flags and stuck incidents with tokens, a lost GPU as a note, tokens handed back so nothing is looked at twice (and a launch that gains a problem looked at again), a hunt read as one run with each test's outcome and the page's verdict, a failing service said and never read as nothing new, the digest naming a device by two characters, the command line, and the log issue read for the tokens already handled (only the owner's lines that start handled:, read in pages, a stranger's words and a log that cannot be read never taken for a record).",
);
