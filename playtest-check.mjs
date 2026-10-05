// Playtest mode (dist/playtest.mjs): the switch that is remembered on the device, the live copy's sender (when it sends, never twice at once,
// slower after failures, stopped where there is no service), and the notes on what has been played and seen. A fake clock and a fake send
// stand in for the browser.
import assert from "node:assert/strict";
import {
  PLAYTEST_KEY,
  COVERAGE_KEY,
  PLAYTEST_LIMITS,
  INCIDENT_KINDS,
  SEND_GAPS,
  liveWant,
  playtestChoice,
  readPlaytest,
  savePlaytest,
  LiveSender,
  Coverage,
} from "./dist/playtest.mjs";
import { LIMITS } from "./dist/crashlog.mjs";

const memory = () => {
  const data = new Map();
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
  };
};

// 1) The switch: the address says, else the device's own choice stands.
{
  assert.deepEqual(playtestChoice("", false), { on: false, said: false });
  assert.deepEqual(
    playtestChoice("?debug", true),
    { on: true, said: false },
    "no word: what the device chose",
  );
  for (const search of [
    "?playtest",
    "?playtest=",
    "?playtest=1",
    "?playtest=on",
    "?a=b&playtest=yes",
    "?playtest=true",
  ])
    assert.deepEqual(playtestChoice(search, false), { on: true, said: true }, search);
  for (const search of [
    "?playtest=off",
    "?playtest=0",
    "?playtest=false",
    "?playtest=NO",
    "?playtest=%20Off%20",
  ])
    assert.deepEqual(playtestChoice(search, true), { on: false, said: true }, search);
  assert.deepEqual(playtestChoice(undefined, undefined), { on: false, said: false });
  assert.ok(PLAYTEST_KEY.startsWith("pool-panic.") && COVERAGE_KEY.startsWith("pool-panic."));
  assert.notEqual(PLAYTEST_KEY, COVERAGE_KEY);
}

// 2) Remembered on the device; off forgets; broken or missing storage is just "off".
{
  const store = memory();
  assert.equal(readPlaytest(store), false);
  savePlaytest(store, true);
  assert.equal(readPlaytest(store), true);
  savePlaytest(store, false);
  assert.equal(readPlaytest(store), false);
  assert.equal(store.data.size, 0, "off leaves nothing behind");
  store.setItem(PLAYTEST_KEY, "{not json");
  assert.equal(readPlaytest(store), false);
  store.setItem(PLAYTEST_KEY, JSON.stringify({ on: "yes" }));
  assert.equal(readPlaytest(store), false, "only a real true counts");
  assert.equal(readPlaytest(null), false);
  assert.doesNotThrow(() => savePlaytest(null, true));
  assert.doesNotThrow(() =>
    savePlaytest(
      {
        setItem() {
          throw new Error("quota");
        },
      },
      true,
    ),
  );
}

// 3) The log budget a playtest asks for is one the crash log knows, and bigger than the ordinary one where it matters.
{
  for (const key of Object.keys(PLAYTEST_LIMITS))
    assert.ok(key in LIMITS, key + " is a limit of the crash log");
  assert.ok(PLAYTEST_LIMITS.crumbs > LIMITS.crumbs && PLAYTEST_LIMITS.bytes > LIMITS.bytes);
  assert.ok(
    PLAYTEST_LIMITS.sessions * PLAYTEST_LIMITS.bytes < 1.2e6,
    "and still small beside a device's storage",
  );
}

// 4) The live sender: when to send.
{
  let now = 100_000;
  const sent = [];
  let answer = { ok: true, status: 200 };
  let gate = null; // a promise the send waits for, to hold one in flight
  const sender = new LiveSender({
    now: () => now,
    send: async () => {
      sent.push(now);
      if (gate) await gate;
      return answer;
    },
  });
  assert.equal(sender.poll(), null, "nothing changed: nothing to send");
  assert.match(sender.describe(), /Nothing sent yet/);
  sender.dirty("calm");
  assert.match(sender.describe(), /Waiting to send the first copy/);
  await sender.poll(); // the first one goes at once
  assert.deepEqual(sent, [100_000]);
  assert.equal(sender.sent, 1);
  assert.match(sender.describe(), /^Live ✓ last copy just now · 1 sent$/);
  assert.equal(sender.poll(), null, "and nothing is wanted until the log changes again");

  // A calm change waits out the calm gap, a busy one the busy gap, an urgent one the short gap, and the strongest reason wins.
  sender.dirty("calm");
  now += SEND_GAPS.calm - 1;
  assert.equal(sender.poll(), null, "not yet");
  now += 1;
  await sender.poll();
  assert.equal(sent.length, 2, "after the calm gap");
  sender.dirty("calm");
  sender.dirty("busy");
  sender.dirty("calm"); // (a weaker reason does not water the stronger one down)
  now += SEND_GAPS.busy - 1;
  assert.equal(sender.poll(), null);
  now += 1;
  await sender.poll();
  assert.equal(sent.length, 3, "after the busy gap");
  sender.dirty("busy");
  sender.dirty("urgent");
  now += SEND_GAPS.urgent;
  await sender.poll();
  assert.equal(sent.length, 4, "an urgent one goes after the short gap");
  assert.ok(
    SEND_GAPS.urgent < SEND_GAPS.beat && SEND_GAPS.beat < SEND_GAPS.busy && SEND_GAPS.busy < SEND_GAPS.calm,
  );
  // A beat (the copy renewed while a shift is played) goes after its own gap, beats a busy reason and gives way to an urgent one.
  sender.dirty("busy");
  sender.dirty("beat");
  now += SEND_GAPS.beat - 1;
  assert.equal(sender.poll(), null, "not before the beat's gap");
  now += 1;
  await sender.poll();
  assert.equal(sent.length, 5, "a beat goes after the beat's gap, though a busy reason was asked first");
  sender.dirty("beat");
  sender.dirty("calm"); // (a weaker reason does not water it down)
  sender.dirty("urgent");
  now += SEND_GAPS.urgent;
  await sender.poll();
  assert.equal(sent.length, 6, "an urgent reason beats the beat");
  assert.match(sender.describe(), /^Live ✓ last copy just now · 6 sent$/);
  now += 7_000;
  assert.match(sender.describe(), /last copy 7 s ago/);

  // Never two at once: while one is on its way, polls start nothing and flushNow does not start another.
  let release;
  gate = new Promise((resolve) => (release = resolve));
  sender.dirty("urgent");
  now += 10_000;
  const first = sender.poll();
  assert.ok(first, "one starts");
  assert.equal(sent.length, 7);
  assert.match(sender.describe(), /^Sending…$/);
  sender.dirty("urgent");
  now += 10_000;
  assert.equal(sender.poll(), null);
  assert.equal(sender.flushNow(), null);
  release();
  await first;
  gate = null;
  assert.equal(sent.length, 7, "still the one");
  // (the change made while it was on its way is still wanted)
  now += SEND_GAPS.urgent;
  await sender.poll();
  assert.equal(sent.length, 8);

  // The page is going away: send now, whatever the gap, even when nothing is marked.
  now += 1;
  await sender.flushNow();
  assert.equal(sent.length, 9, "flushNow does not wait");
  assert.equal(sender.wanted, null);

  // A failure: still wanted, and the gap doubles with each one in a row; a success starts it over.
  answer = { ok: false, status: 0, error: "no connection" };
  sender.dirty("calm");
  now += SEND_GAPS.calm;
  await sender.poll();
  assert.equal(sent.length, 10);
  assert.equal(sender.failures, 1);
  assert.match(sender.describe(), /^Could not send \(no connection\), trying again\.$/);
  now += SEND_GAPS.calm * 2 - 1;
  assert.equal(sender.poll(), null, "twice the gap after one failure");
  now += 1;
  await sender.poll();
  assert.equal(sender.failures, 2);
  assert.match(sender.describe(), /trying again · ×2\./);
  now += SEND_GAPS.calm * 4;
  answer = { ok: true, status: 200 };
  await sender.poll();
  assert.equal(sender.failures, 0, "a send that goes through starts it over");
  assert.equal(sender.error, "");
  for (let i = 0; i < 12; i++) sender.failures++; // the gap has a ceiling
  assert.equal(sender.gap("calm"), SEND_GAPS.max);
  sender.failures = 0;

  // A send that throws is a failure, not an exception.
  const shaky = new LiveSender({
    now: () => now,
    send: async () => {
      throw new Error("boom");
    },
  });
  shaky.dirty("urgent");
  const result = await shaky.poll();
  assert.equal(result.ok, false);
  assert.equal(shaky.failures, 1);

  // The service asks for quiet (429, with how long): nothing is sent until then. The service is not there (404, 405, 501): it stops for good.
  const polite = new LiveSender({
    now: () => now,
    send: async () => ({ ok: false, status: 429, error: "slow down", retryAfter: 90 }),
  });
  polite.dirty("urgent");
  await polite.poll();
  assert.equal(polite.holdUntil, now + 90_000);
  now += 60_000;
  assert.equal(polite.poll(), null, "quiet was asked for");
  now += 31_000 + SEND_GAPS.urgent * 2;
  assert.ok(polite.poll(), "and after it, it tries again");
  for (const status of [404, 405, 501]) {
    let calls = 0;
    const gone = new LiveSender({
      now: () => now,
      send: async () => (calls++, { ok: false, status, error: "HTTP " + status }),
    });
    gone.dirty("urgent");
    await gone.poll();
    assert.equal(gone.dead, true, "a " + status + " means there is no service here");
    assert.match(gone.describe(), /Not sending: this server has no report service/);
    gone.dirty("urgent");
    now += 10 * SEND_GAPS.max;
    assert.equal(gone.poll(), null);
    assert.equal(gone.flushNow(), null, "not even when the page is going away");
    assert.equal(calls, 1);
  }
}

// 5) The notes on what has been covered.
{
  const c = new Coverage();
  c.event({ type: "incident", kind: "fish" }); // nothing is being played yet: nothing is noted
  assert.deepEqual(c.levels, {});
  c.begin({ level: 4, name: "Rush hour", booking: "stag" });
  c.event({ type: "incident", kind: "karen", x: 1, z: 2 });
  c.event({ type: "save", kind: "karen", value: 100 });
  c.event({ type: "incident", kind: "fish" });
  c.event({ type: "fish-dumped" });
  c.event({ type: "fish-dumped" });
  for (const type of [
    "points",
    "splash",
    "toast",
    "chaos",
    "go",
    "countdown",
    "ended",
    "dash",
    "jump",
    "karen-voice",
  ])
    c.event({ type });
  c.event({ type: "blackout" });
  assert.deepEqual(c.levels["4"].incidents, { karen: 1, fish: 1 });
  assert.deepEqual(c.levels["4"].saves, { karen: 1 });
  assert.deepEqual(
    c.levels["4"].events,
    { "fish-dumped": 2, blackout: 1 },
    "the routine events are not counted",
  );
  assert.equal(c.levels["4"].runs, 1);
  assert.equal(c.levels["4"].booking, "stag");
  c.finish({ score: 1234.4, stars: 2 });
  assert.equal(c.levels["4"].done, 1);
  assert.equal(c.levels["4"].best, 1234);
  assert.deepEqual(c.levels["4"].last, { score: 1234, stars: 2 });
  c.begin({ level: 4 }); // the same level again: another run, the notes add up
  c.event({ type: "incident", kind: "karen" });
  c.finish({ score: 900, stars: 1 });
  assert.equal(c.levels["4"].runs, 2);
  assert.equal(c.levels["4"].done, 2);
  assert.equal(c.levels["4"].best, 1234, "the best stays");
  assert.deepEqual(c.levels["4"].last, { score: 900, stars: 1 });
  assert.equal(c.levels["4"].incidents.karen, 2);
  c.begin({ level: 10, name: "Pool legend" });
  c.begin({ drill: "pump", name: "Pump drill" }); // a drill is a shift of its own kind
  c.event({ type: "incident", kind: "cramp" });
  c.flag();
  c.begin({ level: 2 });
  c.flag();
  c.flag();
  assert.equal(c.levels["drill:pump"].flags, 1);
  assert.equal(c.levels["2"].flags, 2);
  assert.deepEqual(c.finished(), [4], "only levels that were finished, in order, never a drill");
  const totals = c.totals();
  assert.deepEqual(totals.incidents, { karen: 2, fish: 1, cramp: 1 });
  assert.deepEqual(totals.saves, { karen: 1 });

  const lines = c.lines(Object.keys(INCIDENT_KINDS));
  assert.match(lines[0], /^- Level 2 · 1 run, 0 finished · flagged ×2$/, "level order, numbers numerically");
  assert.match(
    lines[1],
    /^- Level 4 "Rush hour" · 2 runs, 2 finished · last 900 points, 1★ \(best 1234\) · incidents: karen 2, fish 1 · saved: karen 1 · also: fish-dumped 2, blackout 1$/,
  );
  assert.match(lines[2], /^- Level 10 "Pool legend" · 1 run, 0 finished$/);
  assert.match(
    lines[3],
    /^- Drill pump "Pump drill" · 1 run, 0 finished · incidents: cramp 1 · flagged ×1$/,
    "drills come after the levels",
  );
  assert.match(
    lines.at(-1),
    /^- Incidents not seen yet: stomach, spill, dog, carl, flicker, crash, rush, team, class, closure, storm$/,
  );
  const all = new Coverage();
  all.begin({ level: 1 });
  for (const kind of Object.keys(INCIDENT_KINDS)) all.event({ type: "incident", kind });
  assert.match(all.lines(Object.keys(INCIDENT_KINDS)).at(-1), /none, every kind has happened/);
  assert.equal(new Coverage().lines().length, 0, "without a list of kinds there is no closing line");

  // It is plain data that comes back from the device as it went there; what is not ours is not taken.
  const back = new Coverage(JSON.parse(JSON.stringify(c.data)));
  assert.deepEqual(back.data, c.data);
  assert.deepEqual(new Coverage({ v: 2, levels: { 1: {} } }).data, { v: 1, levels: {} });
  assert.deepEqual(new Coverage("junk").data, { v: 1, levels: {} });
  assert.deepEqual(
    new Coverage({ v: 1, levels: { 3: 7, 4: null, 5: { runs: 1 } } }).levels,
    { 5: { runs: 1, done: 0, best: 0, flags: 0, incidents: {}, saves: {}, events: {} } },
    "rows that are not rows are dropped, the others are filled in",
  );
  const many = {
    v: 1,
    levels: Object.fromEntries(Array.from({ length: 80 }, (_, i) => [String(i + 1), { runs: 1 }])),
  };
  assert.equal(Object.keys(new Coverage(many).levels).length, 40, "no more than forty rows from a device");
  // A row from an older note without every table still counts.
  const old = new Coverage({ v: 1, levels: { 6: { runs: 1, done: 1, best: 5 } } });
  old.begin({ level: 6 });
  old.event({ type: "incident", kind: "dog" });
  assert.equal(old.levels["6"].incidents.dog, 1);
}

// What the live copy asks for each second: a beat all through a shift being played (the countdown too), a calm copy when the log changed
// anywhere else, nothing when nothing changed.
{
  assert.equal(liveWant({ mode: "playing" }), "beat");
  assert.equal(liveWant({ mode: "playing", changed: true }), "beat");
  assert.equal(liveWant({ mode: "countdown" }), "beat");
  for (const mode of ["menu", "paused", "results", ""]) {
    assert.equal(liveWant({ mode, changed: true }), "calm", mode + ": a change asks for a calm copy");
    assert.equal(liveWant({ mode }), null, mode + ": nothing changed, nothing asked");
  }
  assert.equal(liveWant(), null);
  // Over an hour of play the beat stays inside what the service takes for the whole site (2400 replacements an hour).
  assert.ok(3600_000 / SEND_GAPS.beat <= 2400 / 2, "a beat all hour is at most half the site's budget");
}

console.log(
  "Playtest checks passed: the switch from the address and from the device (on, off, nothing said), a log budget the crash log accepts, the live sender (the gaps by reason, the strongest reason wins, never two at once, doubling after failures, quiet when asked, stopped where there is no service, flush when the page goes), and the notes on levels played and incidents seen (adding up across runs, drills apart, routine events left out, plain data back from the device).",
);
