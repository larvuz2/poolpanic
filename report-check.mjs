// The crash-report sink (netlify/functions/report.mjs): what a POST must carry to be kept, how a report is read back (a device's list,
// one report as markdown or JSON, the newest one, the admin list), the replace-on-the-same-id rule, the 40 kept per device, the size
// limit counted in bytes however the body arrives, the per-device and site-wide rate limits, that nothing but the user-agent of the
// sender is stored, and that every failure (a store that throws included) answers with JSON instead of throwing. The Blobs store is
// faked in memory; nothing here touches the network. It also fails when the deploy would not build the function: the functions folder
// missing from netlify.toml, or @netlify/blobs missing from package.json and its lock file.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import * as mod from "./netlify/functions/report.mjs";

const { handle } = mod;
const read = (file) => readFileSync(new URL(file, import.meta.url), "utf8");
const BASE = "https://poolpanic.test/api/report";
const HOUR = 3600 * 1000;
const DEVICE = "K7Q2M5XA";

// ---- a fake of the one Blobs store -----------------------------------------------------------------------------------------------
// It behaves as the real client does (read from node_modules/@netlify/blobs/dist/main.js): `get` of a key that is not there is null
// and `type: "json"` parses what was stored, `delete` of a key that is not there is quiet, `set` is given a string under a key the real
// store accepts, and `list({ prefix })` answers { blobs: [{ etag, key }], directories: [] } with no promise about the order, so this
// one scrambles it and the function has to sort.
function fakeStore() {
  const data = new Map();
  const scramble = (text) => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 1000003, 7);
  return {
    data,
    async get(key, { type } = {}) {
      if (!data.has(key)) return null;
      return type === "json" ? JSON.parse(data.get(key)) : data.get(key);
    },
    async set(key, value) {
      assert.equal(typeof value, "string", "the store is given a string");
      assert.ok(
        key && !key.startsWith("/") && Buffer.byteLength(key) <= 600,
        `a key the real store takes: ${key}`,
      );
      data.set(key, value);
      return { modified: true, etag: `"${scramble(value)}"` };
    },
    async delete(key) {
      data.delete(key);
    },
    async list({ prefix = "" } = {}) {
      const keys = [...data.keys()].filter((key) => key.startsWith(prefix));
      keys.sort((a, b) => scramble(a) - scramble(b));
      return { blobs: keys.map((key) => ({ etag: '"e"', key })), directories: [] };
    },
  };
}

// A store whose every call fails, or only the calls named (the others go to `inner`).
const failing = (inner, ...broken) =>
  Object.fromEntries(
    ["get", "set", "delete", "list"].map((name) => [
      name,
      (...args) => {
        if (broken.length && !broken.includes(name)) return inner[name](...args);
        throw new Error(`the store is down (${name})`);
      },
    ]),
  );

// One site: its own store, clock and environment.
function world({ env = {} } = {}) {
  const real = fakeStore();
  const w = {
    store: real, // a test may swap this for a failing one; `keys` keeps looking at the real one

    clock: Date.UTC(2026, 9, 4, 3, 30, 0),
    env,
    logged: [],
    call: (request, extra = {}) =>
      handle(request, {
        store: w.store,
        env: w.env,
        now: () => w.clock,
        log: (...parts) => w.logged.push(parts.join(" ")),
        ...extra,
      }),
    post: (body, headers = {}) =>
      w.call(
        new Request(BASE, {
          method: "POST",
          body: typeof body === "string" ? body : JSON.stringify(body),
          headers: { "user-agent": "Mozilla/5.0 (iPad) check", ...headers },
        }),
      ),
    get: (query = "") => w.call(new Request(BASE + query)),
    keys: (prefix = "r/") => [...real.data.keys()].filter((key) => key.startsWith(prefix)),
  };
  return w;
}

const report = "# Pool Panic crash\n\nTypeError: x is undefined (Écran noyé 🏊)\n";
const session = {
  build: { commit: "abc1234", context: "deploy-preview", branch: "claude/crash-sink" },
  errors: [{ message: "x is undefined", at: 12345 }],
  nested: { anything: ["goes", 1, null, { here: true }] },
};
const good = (over = {}) => ({
  v: 1,
  device: DEVICE,
  id: "m3x9k2ab",
  headline: "TypeError in tick",
  report,
  session,
  ...over,
});

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const deviceCode = (n) =>
  Array.from({ length: 8 }, (_, i) => B32[Math.floor(n / 32 ** (7 - i)) % 32]).join("");
const stamp = (ms) => String(ms).padStart(13, "0");

// What every answer has in common, then the answer as JSON.
function common(res) {
  assert.equal(res.headers.get("cache-control"), "no-store", "answers are never cached");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  const cors = [...res.headers.keys()].filter((name) => name.startsWith("access-control-"));
  assert.deepEqual(cors, [], "no CORS headers: the game is served from the same site");
}
async function asJson(res, status) {
  common(res);
  const text = await res.text();
  assert.equal(res.status, status, `status ${res.status}, wanted ${status}: ${text.slice(0, 200)}`);
  assert.match(res.headers.get("content-type"), /^application\/json; charset=utf-8$/);
  return JSON.parse(text);
}
async function asMarkdown(res) {
  common(res);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "text/markdown; charset=utf-8");
  return res.text();
}

// ---- a good report, read back every way ------------------------------------------------------------------------------------------
{
  const w = world();
  const ua = "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1";
  const sent = await asJson(await w.post(good(), { "user-agent": ua }), 200);
  const key = `r/${DEVICE}/${stamp(w.clock)}-m3x9k2ab`;
  assert.deepEqual(sent, { ok: true, device: DEVICE, id: "m3x9k2ab", key, count: 1 });

  const stored = JSON.parse(w.store.data.get(key));
  assert.deepEqual(stored, {
    v: 1,
    device: DEVICE,
    id: "m3x9k2ab",
    at: w.clock,
    headline: "TypeError in tick",
    report,
    session,
    ua,
  });
  assert.deepEqual(w.keys("meta/"), ["meta/rate/2026100403"], "one counter for the site's hour");

  const iso = new Date(w.clock).toISOString();
  assert.equal(iso, "2026-10-04T03:30:00.000Z");
  const list = await asJson(await w.get(`?device=${DEVICE}`), 200);
  assert.deepEqual(list, {
    ok: true,
    device: DEVICE,
    reports: [
      {
        id: "m3x9k2ab",
        at: w.clock,
        iso,
        headline: "TypeError in tick",
        bytes: Buffer.byteLength(report),
        commit: "abc1234",
        ua,
      },
    ],
  });
  assert.ok(
    Buffer.byteLength(report) > report.length,
    "the report has multi-byte characters, so bytes are not characters",
  );

  assert.equal(
    await asMarkdown(await w.get(`?device=${DEVICE}&id=m3x9k2ab`)),
    report,
    "one report as markdown",
  );
  assert.equal(
    await asMarkdown(await w.get(`?device=${DEVICE}&latest=1`)),
    report,
    "the newest one as markdown",
  );
  assert.deepEqual(
    await asJson(await w.get(`?device=${DEVICE}&id=m3x9k2ab&format=json`), 200),
    { ok: true, ...stored },
    "the whole stored record, the raw session included",
  );
  assert.deepEqual(await asJson(await w.get(`?device=${DEVICE}&latest=1&format=json`), 200), {
    ok: true,
    ...stored,
  });
  assert.equal(
    (await asJson(await w.get(`?device=${DEVICE}&latest=0`), 200)).reports.length,
    1,
    "latest=0 is the list",
  );
}

// ---- reading what is not there ----------------------------------------------------------------------------------------------------
{
  const w = world();
  await asJson(await w.post(good()), 200);
  const nobody = await asJson(await w.get("?device=ABCDEFGH"), 200);
  assert.deepEqual(
    nobody,
    { ok: true, device: "ABCDEFGH", reports: [] },
    "a device with no reports is an empty list, not an error",
  );
  assert.deepEqual(await asJson(await w.get("?device=ABCDEFGH&latest=1"), 404), {
    ok: false,
    error: "not found",
  });
  assert.deepEqual(await asJson(await w.get("?device=ABCDEFGH&id=m3x9k2ab"), 404), {
    ok: false,
    error: "not found",
  });
  assert.deepEqual(await asJson(await w.get(`?device=${DEVICE}&id=nosuchid`), 404), {
    ok: false,
    error: "not found",
  });
  assert.equal((await asJson(await w.get(`?device=${DEVICE}&id=nosuchid&format=json`), 404)).ok, false);
  // A badly formed question is a 400, not a 404, and a code that is only a prefix of a real one finds nothing.
  for (const query of [
    "",
    "?id=m3x9k2ab",
    "?device=k7q2m5xa",
    "?device=K7Q2M5X",
    `?device=${DEVICE}&id=NOPE`,
    `?device=${DEVICE}&id=a`,
  ]) {
    const answer = await asJson(await w.get(query), 400);
    assert.equal(answer.ok, false, query);
    assert.equal(typeof answer.error, "string");
  }
  assert.deepEqual((await asJson(await w.get("?device=K7Q2M5X2"), 200)).reports, []);
}

// ---- newest first, whatever order the store lists in ------------------------------------------------------------------------------
{
  const w = world();
  for (const id of ["aaaa", "bbbb", "cccc", "dddd", "eeee"]) {
    w.clock += 60_000;
    await asJson(await w.post(good({ id, headline: `crash ${id}`, report: `# ${id}` })), 200);
  }
  const list = await asJson(await w.get(`?device=${DEVICE}`), 200);
  assert.deepEqual(
    list.reports.map((r) => r.id),
    ["eeee", "dddd", "cccc", "bbbb", "aaaa"],
  );
  assert.equal(await asMarkdown(await w.get(`?device=${DEVICE}&latest=1`)), "# eeee");
  assert.equal(await asMarkdown(await w.get(`?device=${DEVICE}&id=cccc`)), "# cccc");
}

// ---- a report sent again under the same id replaces the earlier one ------------------------------------------------------------------
{
  const w = world();
  await asJson(await w.post(good({ id: "sess0001", headline: "first", report: "# one" })), 200);
  w.clock += 60_000;
  const again = await asJson(
    await w.post(good({ id: "sess0001", headline: "second", report: "# two, after more errors" })),
    200,
  );
  assert.equal(again.count, 1, "it replaced the first, so there is still one");
  assert.deepEqual(w.keys(), [again.key], "the earlier copy is gone from the store");
  const list = await asJson(await w.get(`?device=${DEVICE}`), 200);
  assert.deepEqual(
    list.reports.map((r) => [r.id, r.headline, r.at]),
    [["sess0001", "second", w.clock]],
  );
  assert.equal(await asMarkdown(await w.get(`?device=${DEVICE}&id=sess0001`)), "# two, after more errors");

  // Sent again in the very same millisecond it is the same key, and still one report.
  const same = await asJson(await w.post(good({ id: "sess0001", report: "# three" })), 200);
  assert.deepEqual([same.key, same.count, w.keys().length], [again.key, 1, 1]);
  assert.equal(await asMarkdown(await w.get(`?device=${DEVICE}&latest=1`)), "# three");

  // Another id adds to it, and another device's id of the same name is its own report.
  const other = await asJson(await w.post(good({ id: "sess0002", report: "# other" })), 200);
  assert.equal(other.count, 2);
  await asJson(await w.post(good({ device: "ABCDEFGH", id: "sess0001", report: "# theirs" })), 200);
  assert.equal(await asMarkdown(await w.get(`?device=${DEVICE}&id=sess0001`)), "# three");
  assert.equal(await asMarkdown(await w.get("?device=ABCDEFGH&id=sess0001")), "# theirs");
}

// ---- at most 40 reports a device, the oldest dropped ------------------------------------------------------------------------------
{
  const w = world();
  let last;
  for (let i = 0; i < 45; i++) {
    w.clock += 4 * 60_000; // 15 an hour: under the 20 an hour a device may add
    last = await asJson(
      await w.post(good({ id: `s${String(i).padStart(4, "0")}`, headline: `crash ${i}` })),
      200,
    );
  }
  assert.equal(last.count, 40, "the answer says how many are kept, not how many were sent");
  assert.equal(w.keys().length, 40, "the store holds 40");
  const list = (await asJson(await w.get(`?device=${DEVICE}`), 200)).reports;
  assert.equal(list.length, 40);
  assert.equal(list[0].headline, "crash 44");
  assert.equal(list.at(-1).headline, "crash 5", "crashes 0 to 4, the oldest, were dropped");
  assert.equal(
    w.keys("meta/").length,
    1,
    "three hours went by and only the counter of the current one is left",
  );
  // Sending one of the kept ids again does not push anything out.
  w.clock += 60_000;
  const again = await asJson(await w.post(good({ id: "s0005", headline: "crash 5 again" })), 200);
  assert.equal(again.count, 40);
  assert.equal(w.keys().length, 40);
  const after = (await asJson(await w.get(`?device=${DEVICE}`), 200)).reports;
  assert.equal(after.length, 40);
  assert.equal(after[0].headline, "crash 5 again");
  assert.equal(after.at(-1).headline, "crash 6");
}

// ---- what a report must carry ----------------------------------------------------------------------------------------------------
{
  const refused = [
    ["not JSON", "{nope", /JSON/],
    ["an empty body", "", /JSON/],
    ["an array", "[1, 2]", /object/],
    ["null", "null", /object/],
    ["a number", "7", /object/],
    ["a string", '"report"', /object/],
    ["no v", good({ v: undefined }), /v must be 1/],
    ["v is 2", good({ v: 2 }), /v must be 1/],
    ["v is a string", good({ v: "1" }), /v must be 1/],
    ["no device", good({ device: undefined }), /device/],
    ["a lower case device", good({ device: "k7q2m5xa" }), /device/],
    ["a short device", good({ device: "K7Q2M5X" }), /device/],
    ["a long device", good({ device: "K7Q2M5XAA" }), /device/],
    ["a device with 0, 1, 8 or 9", good({ device: "K0Q1M8X9" }), /device/],
    ["a device with a slash", good({ device: "K7Q2/5XA" }), /device/],
    ["a numeric device", good({ device: 12345678 }), /device/],
    ["no id", good({ id: undefined }), /id/],
    ["a short id", good({ id: "abc" }), /id/],
    ["a long id", good({ id: "a".repeat(25) }), /id/],
    ["an upper case id", good({ id: "ABCD1234" }), /id/],
    ["an id with a dash", good({ id: "ab-cd-ef" }), /id/],
    ["an id with a slash", good({ id: "ab/../cd" }), /id/],
    ["a numeric id", good({ id: 12345678 }), /id/],
    ["no headline", good({ headline: undefined }), /headline/],
    ["a numeric headline", good({ headline: 5 }), /headline/],
    ["no report", good({ report: undefined }), /report/],
    ["an empty report", good({ report: "" }), /report/],
    ["a blank report", good({ report: " \n\t " }), /report/],
    ["a numeric report", good({ report: 5 }), /report/],
    ["a session that is a string", good({ session: "x" }), /session/],
    ["a session that is an array", good({ session: [1] }), /session/],
    ["a session that is a number", good({ session: 3 }), /session/],
  ];
  for (const [name, body, why] of refused) {
    const w = world();
    const answer = await asJson(await w.post(body), 400);
    assert.equal(answer.ok, false, name);
    assert.match(answer.error, why, name);
    assert.equal(w.store.data.size, 0, `${name}: nothing was stored, not even a counter`);
  }

  // What is still fine, and what is clipped.
  const w = world();
  const edge = await asJson(await w.post(good({ id: "abcd", headline: "", session: undefined })), 200);
  assert.equal(JSON.parse(w.store.data.get(edge.key)).session, null, "no session is stored as null");
  assert.equal(JSON.parse(w.store.data.get(edge.key)).headline, "");
  const nulled = await asJson(await w.post(good({ id: "efgh", session: null })), 200);
  assert.equal(JSON.parse(w.store.data.get(nulled.key)).session, null);
  const longest = await asJson(await w.post(good({ id: "a".repeat(24) })), 200);
  assert.equal(JSON.parse(w.store.data.get(longest.key)).id, "a".repeat(24));
  const big = await asJson(
    await w.post(good({ id: "bigone01", headline: "h".repeat(300), report: "r".repeat(200000) })),
    200,
  );
  const kept = JSON.parse(w.store.data.get(big.key));
  assert.equal(kept.headline.length, 200, "the headline is clipped to 200 characters");
  assert.equal(kept.report.length, 160000, "the report is clipped to 160000 characters");
}

// ---- the size limit, counted in bytes ---------------------------------------------------------------------------------------------
{
  const w = world();
  const LIMIT = 262144;
  const fill = (extra) =>
    JSON.stringify(good({ report: "x".repeat(LIMIT - JSON.stringify(good({ report: "" })).length + extra) }));
  const exact = fill(0);
  assert.equal(Buffer.byteLength(exact), LIMIT);
  const request = new Request(BASE, { method: "POST", body: exact });
  assert.equal(
    request.headers.get("content-length"),
    null,
    "the request carries no content-length, as the function must not rely on one",
  );
  await asJson(await w.call(request), 200);
  await asJson(await w.post(fill(1)), 413);
  assert.equal(w.keys().length, 1, "the body that was one byte over was not stored");

  // Bytes, not characters: 140000 characters of é are 280000 bytes.
  const accents = JSON.stringify(good({ id: "accent01", report: "é".repeat(140000) }));
  assert.ok(accents.length < LIMIT && Buffer.byteLength(accents) > LIMIT);
  assert.deepEqual(await asJson(await w.post(accents), 413), { ok: false, error: "body too large" });

  // A body that never ends is cut off at the limit, not read to its end.
  let pulled = 0;
  const endless = new ReadableStream({
    pull(controller) {
      controller.enqueue(new TextEncoder().encode("x".repeat(65536)));
      if (++pulled > 5000) controller.close();
    },
  });
  await asJson(await w.call(new Request(BASE, { method: "POST", body: endless, duplex: "half" })), 413);
  assert.ok(pulled < 50, `read ${pulled} chunks of an endless body`);

  // A header that says it is too big is believed without reading anything.
  const lying = new Request(BASE, {
    method: "POST",
    body: "{}",
    headers: { "content-length": String(LIMIT + 1) },
  });
  assert.equal(lying.headers.get("content-length"), String(LIMIT + 1));
  await asJson(await w.call(lying), 413);
}

// ---- the methods -----------------------------------------------------------------------------------------------------------------
{
  const w = world();
  for (const method of ["PUT", "DELETE", "PATCH", "HEAD"]) {
    const res = await w.call(new Request(BASE, { method }));
    const answer = await asJson(res, 405);
    assert.equal(answer.ok, false, method);
    assert.equal(res.headers.get("allow"), "GET, POST, OPTIONS", method);
  }
  const options = await w.call(new Request(BASE, { method: "OPTIONS" }));
  common(options);
  assert.equal(options.status, 204);
  assert.equal(await options.text(), "");
  assert.equal(options.headers.get("allow"), "GET, POST, OPTIONS");
  assert.equal(w.store.data.size, 0);
}

// ---- rate limits: twenty an hour for a device -------------------------------------------------------------------------------------
{
  const w = world();
  const t0 = w.clock;
  for (let i = 1; i <= 20; i++) {
    w.clock = t0 + i * 1000;
    await asJson(await w.post(good({ id: `rate${String(i).padStart(4, "0")}` })), 200);
  }
  const refused = await w.post(good({ id: "onemore1" }));
  const answer = await asJson(refused, 429);
  assert.match(answer.error, /this device/);
  assert.equal(
    refused.headers.get("retry-after"),
    "3581",
    "when the oldest of the twenty leaves the hour, in seconds",
  );
  assert.equal(w.keys().length, 20, "the refused report was not stored");
  assert.deepEqual(
    JSON.parse(w.store.data.get("meta/rate/2026100403")),
    { count: 20 },
    "and was not counted",
  );

  // An id the device already has is a replacement, not a new report, so it is let through.
  await asJson(await w.post(good({ id: "rate0001", headline: "sent again" })), 200);
  await asJson(await w.post(good({ device: "ABCDEFGH" })), 200); // another device is not held back
  assert.equal(
    (await asJson(await w.get(`?device=${DEVICE}`), 200)).reports.length,
    20,
    "reading is never limited",
  );
  assert.equal((await asJson(await w.post(good({ id: "onemore1" })), 429)).ok, false, "still full");

  w.clock += HOUR;
  await asJson(await w.post(good({ id: "onemore1" })), 200);
}

// ---- rate limits: four hundred an hour for the whole site -------------------------------------------------------------------------
{
  const w = world();
  for (let i = 0; i < 400; i++) await asJson(await w.post(good({ device: deviceCode(i) })), 200);
  const refused = await w.post(good({ device: deviceCode(1000) }));
  const answer = await asJson(refused, 429);
  assert.match(answer.error, /too many reports/);
  assert.equal(
    refused.headers.get("retry-after"),
    "1800",
    "the half hour that is left of this hour, in seconds",
  );
  assert.deepEqual(w.keys(`r/${deviceCode(1000)}/`), [], "nothing stored for the refused one");
  assert.deepEqual(JSON.parse(w.store.data.get("meta/rate/2026100403")), { count: 400 });
  assert.equal(
    (await asJson(await w.get(`?device=${deviceCode(5)}`), 200)).reports.length,
    1,
    "reading is never limited",
  );

  w.clock += 30 * 60_000; // 04:00, a new hour
  await asJson(await w.post(good({ device: deviceCode(1000) })), 200);
  assert.deepEqual(
    w.keys("meta/"),
    ["meta/rate/2026100404"],
    "the new hour has its own counter and the old one is gone",
  );
  assert.deepEqual(JSON.parse(w.store.data.get("meta/rate/2026100404")), { count: 1 });
}

// ---- the admin list ---------------------------------------------------------------------------------------------------------------
{
  // Off: nothing is set, or it is set to nothing. The path answers as if it were not there.
  for (const env of [{}, { REPORT_ADMIN_KEY: "" }, { REPORT_ADMIN_KEY: undefined }]) {
    const w = world({ env });
    await asJson(await w.post(good()), 200);
    for (const query of ["?admin=open-sesame", "?admin=", "?admin", `?admin=x&device=${DEVICE}`]) {
      assert.deepEqual(
        await asJson(await w.get(query), 404),
        { ok: false, error: "not found" },
        `${JSON.stringify(env)} ${query}`,
      );
    }
  }

  const w = world({ env: { REPORT_ADMIN_KEY: "open-sesame" } });
  for (let i = 0; i < 70; i++) {
    w.clock += 60_000;
    await asJson(
      await w.post(
        good({ device: deviceCode(i), id: `adm${String(i).padStart(3, "0")}`, headline: `crash ${i}` }),
      ),
      200,
    );
  }
  const listed = await asJson(await w.get("?admin=open-sesame"), 200);
  assert.equal(listed.ok, true);
  assert.equal(listed.reports.length, 60, "the 60 newest of all devices");
  assert.deepEqual(listed.reports[0], {
    device: deviceCode(69).slice(0, 2) + "…",
    id: "adm069",
    at: w.clock,
    iso: new Date(w.clock).toISOString(),
    headline: "crash 69",
  });
  assert.equal(listed.reports.at(-1).headline, "crash 10");
  assert.deepEqual(
    listed.reports.map((r) => r.headline),
    Array.from({ length: 60 }, (_, i) => `crash ${69 - i}`),
    "newest first",
  );
  const text = JSON.stringify(listed);
  for (let i = 0; i < 70; i++)
    assert.ok(!text.includes(deviceCode(i)), `the list does not hand out the code of device ${i}`);

  // A wrong key, a longer or shorter one, another case: all the same 404, and the device parameter does not get round it.
  for (const query of [
    "?admin=open-sesam",
    "?admin=open-sesame!",
    "?admin=OPEN-SESAME",
    "?admin=",
    "?admin=%00",
    `?admin=nope&device=${deviceCode(69)}`,
  ]) {
    assert.deepEqual(await asJson(await w.get(query), 404), { ok: false, error: "not found" }, query);
  }
  assert.equal(
    (await asJson(await w.get(`?admin=open-sesame&device=${deviceCode(69)}`), 200)).reports.length,
    60,
    "the admin list wins",
  );
}

// ---- nothing but the user-agent is kept ---------------------------------------------------------------------------------------------
{
  const w = world();
  const headers = {
    "user-agent": "u".repeat(500),
    "x-forwarded-for": "203.0.113.77",
    "x-nf-client-connection-ip": "203.0.113.77",
    "client-ip": "203.0.113.77",
    forwarded: "for=203.0.113.77",
    cookie: "pp=secret-cookie",
    authorization: "Bearer secret-token",
    referer: "https://poolpanic.netlify.app/?code=secret-referrer",
    "x-custom": "custom-value",
  };
  const request = new Request(BASE, { method: "POST", body: JSON.stringify(good()), headers });
  for (const name of Object.keys(headers))
    assert.ok(request.headers.has(name), `the request does carry ${name}`);
  const res = await w.call(request);
  const answer = await res.text();
  const everything = [...w.store.data.values()].join("\n") + answer + [...res.headers.values()].join("\n");
  for (const leak of ["203.0.113.77", "secret-cookie", "secret-token", "secret-referrer", "custom-value"])
    assert.ok(!everything.includes(leak), `${leak} is not stored or sent back`);
  const [key] = w.keys();
  const stored = JSON.parse(w.store.data.get(key));
  assert.deepEqual(Object.keys(stored).sort(), [
    "at",
    "device",
    "headline",
    "id",
    "report",
    "session",
    "ua",
    "v",
  ]);
  assert.equal(stored.ua, "u".repeat(200), "the user-agent is clipped to 200 characters");
  const list = await asJson(await w.get(`?device=${DEVICE}`), 200);
  assert.equal(list.reports[0].ua, "u".repeat(200));

  // No user-agent at all is an empty one, and the list leaves the field out.
  const bare = world();
  const none = await asJson(await bare.post(good(), { "user-agent": "" }), 200);
  assert.equal(JSON.parse(bare.store.data.get(none.key)).ua, "");
  assert.ok(!("ua" in (await asJson(await bare.get(`?device=${DEVICE}`), 200)).reports[0]));
}

// ---- a store that fails ------------------------------------------------------------------------------------------------------------
{
  const down = { ok: false, error: "storage" };
  const w = world();
  await asJson(await w.post(good({ id: "keepme01" })), 200);
  const healthy = w.store;

  w.store = failing(healthy);
  w.logged.length = 0;
  assert.deepEqual(await asJson(await w.post(good({ id: "newone01" })), 500), down, "POST");
  assert.deepEqual(await asJson(await w.get(`?device=${DEVICE}`), 500), down, "a device's list");
  assert.deepEqual(await asJson(await w.get(`?device=${DEVICE}&id=keepme01`), 500), down, "one report");
  assert.deepEqual(await asJson(await w.get(`?device=${DEVICE}&latest=1`), 500), down, "the newest");
  w.env = { REPORT_ADMIN_KEY: "open-sesame" };
  assert.deepEqual(await asJson(await w.get("?admin=open-sesame"), 500), down, "the admin list");
  assert.equal(w.logged.length, 5, "each failure is logged once");
  assert.ok(
    w.logged.every((line) => /the store is down/.test(line)),
    "the log says what failed",
  );
  assert.ok(
    w.logged.every((line) => !line.includes(DEVICE) && !line.includes("open-sesame")),
    "and holds no code or key",
  );

  // The store reads but cannot write: the report is refused and nothing is half stored.
  w.store = failing(healthy, "set");
  assert.deepEqual(await asJson(await w.post(good({ id: "newone01" })), 500), down);
  assert.equal(w.keys().length, 1);

  // The report is stored but the old copy cannot be deleted: the sender is told it is kept, and the next POST tidies up.
  w.store = failing(healthy, "delete");
  w.logged.length = 0;
  w.clock += 60_000;
  const kept = await asJson(await w.post(good({ id: "keepme01", report: "# resent" })), 200);
  assert.equal(kept.ok, true);
  assert.equal(w.keys().length, 2, "both copies are there for now");
  assert.match(w.logged.join("\n"), /tidy-up failed/);
  w.store = healthy;
  w.clock += 60_000;
  await asJson(await w.post(good({ id: "keepme01", report: "# resent again" })), 200);
  assert.equal(w.keys().length, 1, "the next POST left one");
  assert.equal(await asMarkdown(await w.get(`?device=${DEVICE}&id=keepme01`)), "# resent again");

  // A report in the store that is not JSON, no store at all, and a bug that is not the store's: each a JSON 500 that never throws.
  healthy.data.set(`r/ABCDEFGH/${stamp(w.clock)}-broken01`, "not json {");
  assert.deepEqual(await asJson(await w.get("?device=ABCDEFGH&id=broken01"), 500), down);
  assert.deepEqual(
    await asJson(await handle(new Request(`${BASE}?device=${DEVICE}`), { log() {} }), 500),
    down,
    "no store",
  );
  const clockBroke = await asJson(
    await w.call(new Request(BASE, { method: "POST", body: JSON.stringify(good({ id: "newone02" })) }), {
      now: () => {
        throw new Error("clock");
      },
    }),
    500,
  );
  assert.deepEqual(
    clockBroke,
    { ok: false, error: "internal" },
    "a mistake that is not the store's is told apart",
  );
}

// ---- the function as Netlify loads it ------------------------------------------------------------------------------------------------
{
  assert.equal(typeof mod.default, "function", "Netlify calls the default export with a Request");
  assert.deepEqual(mod.config, { path: "/api/report" });
  assert.equal(typeof mod.openStore, "function");
  assert.equal(typeof mod.handle, "function");

  // The package is imported inside the function, never at the top of the file, and by a literal name: Netlify's bundler follows only
  // those into the deployed function. (A static import would make this very check need the package to load the file.)
  const source = read("./netlify/functions/report.mjs");
  assert.ok(/await import\("@netlify\/blobs"\)/.test(source), 'imports "@netlify/blobs" by a literal name');
  assert.ok(!/^import .*@netlify\/blobs/m.test(source), "and not at the top of the file");

  // The context Netlify gives a function (and the Netlify build, which can have one too) must never reach a real store from a check.
  const saved = {
    env: process.env.NETLIFY_BLOBS_CONTEXT,
    global: globalThis.netlifyBlobsContext,
    fetch: globalThis.fetch,
  };
  const restore = () => {
    if (saved.env === undefined) delete process.env.NETLIFY_BLOBS_CONTEXT;
    else process.env.NETLIFY_BLOBS_CONTEXT = saved.env;
    if (saved.global === undefined) delete globalThis.netlifyBlobsContext;
    else globalThis.netlifyBlobsContext = saved.global;
    globalThis.fetch = saved.fetch;
  };
  try {
    globalThis.fetch = () => assert.fail("a check must not use the network");
    delete process.env.NETLIFY_BLOBS_CONTEXT;
    delete globalThis.netlifyBlobsContext;
    // Without Blobs set up for the site the default export still answers, with JSON, instead of throwing, and says why in the log.
    const errors = [];
    const consoleError = console.error;
    console.error = (...parts) => errors.push(parts.join(" "));
    let res;
    try {
      res = await mod.default(new Request(`${BASE}?device=${DEVICE}`));
    } finally {
      console.error = consoleError;
    }
    assert.deepEqual(await asJson(res, 500), { ok: false, error: "storage" });
    assert.match(errors.join("\n"), /store could not be opened/);
    assert.ok(!errors.join("\n").includes(DEVICE), "and the log holds no code");

    // With a context the package opens the store (nothing is requested until it is used).
    const context = {
      siteID: "site-id",
      token: "token",
      edgeURL: "https://edge.test",
      uncachedEdgeURL: "https://uncached.test",
    };
    process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify(context)).toString("base64");
    let store;
    try {
      store = await mod.openStore();
    } catch (error) {
      assert.fail(`openStore() failed (is @netlify/blobs installed? run npm install): ${error.message}`);
    }
    for (const method of ["get", "set", "delete", "list"])
      assert.equal(typeof store[method], "function", `the store has ${method}`);
  } finally {
    restore();
  }
}

// ---- what the deploy needs -----------------------------------------------------------------------------------------------------------
{
  assert.ok(existsSync(new URL("./netlify/functions/report.mjs", import.meta.url)));

  // netlify.toml must name the functions folder, or the deploy builds no function and /api/report answers with the site's 404.
  let table = "";
  const setting = {};
  for (const line of read("./netlify.toml").split("\n")) {
    const header = /^\s*\[+([^\]]+)\]+\s*(#.*)?$/.exec(line);
    if (header) table = header[1].trim();
    const pair = /^\s*([A-Za-z_]+)\s*=\s*"([^"]*)"\s*(#.*)?$/.exec(line);
    if (pair) setting[`${table}.${pair[1]}`] = pair[2];
  }
  assert.equal(
    setting["functions.directory"],
    "netlify/functions",
    'netlify.toml needs [functions] directory = "netlify/functions", or no function is deployed',
  );

  // The package must be a regular dependency, in the lock file too, so that the deploy installs it and bundles it with the function.
  const pkg = JSON.parse(read("./package.json"));
  assert.match(
    pkg.dependencies?.["@netlify/blobs"] ?? "",
    /^\^?\d+\.\d+\.\d+$/,
    "@netlify/blobs is a dependency of package.json",
  );
  const lock = JSON.parse(read("./package-lock.json"));
  assert.equal(
    lock.packages[""].dependencies["@netlify/blobs"],
    pkg.dependencies["@netlify/blobs"],
    "the lock file agrees",
  );
  assert.ok(lock.packages["node_modules/@netlify/blobs"]?.version, "and has it locked");
  assert.ok(pkg.scripts.format.includes('"netlify/functions/*.mjs"'), "npm run format covers the function");
}

console.log(
  "Report checks passed: validation of a posted report, what is kept (the user-agent and nothing else about the sender), the list, markdown, JSON and newest reads, replace on the same id, 40 kept per device, 413 counted in bytes without a content-length, the per-device and site-wide rate limits, the admin list, a failing store as a JSON 500, and the functions folder and package the deploy needs.",
);
