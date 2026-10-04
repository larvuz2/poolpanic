// The crash-report sink: a Netlify Function (v2) that the game sends its crash log to, so the developer, who can only make plain
// HTTPS GET requests, can read it back with one URL. The report itself is made by dist/crashlog.mjs; this file only keeps it.
//
//   POST /api/report                        the game sends { v, device, id, headline, report, session }
//   GET  /api/report?device=CODE            that device's reports, newest first
//   GET  /api/report?device=CODE&id=ID      one report as markdown (add &format=json for the whole stored record)
//   GET  /api/report?device=CODE&latest=1   the newest one (also takes &format=json)
//   GET  /api/report?admin=KEY              the newest reports of every device, only while REPORT_ADMIN_KEY is set to KEY
//
// There are no accounts. What lets you read a report is the random per-device code the game makes (8 characters of base32, such as
// K7Q2M5XA), and a device with no reports reads as an empty list, so a code nobody used cannot be told from a wrong one. Reports live in
// the site-wide Netlify Blobs store "reports", which every deploy of the site shares: a deploy preview and the public site see the
// same reports. Nothing about the sender but its user-agent is kept (never the address, never another header). The admin list
// needs the environment variable REPORT_ADMIN_KEY (Netlify site settings, scope Functions); without it that path is a plain 404.
import { createHash, timingSafeEqual } from "node:crypto";

// Where the game and the developer reach it. The game is served from the same site, so there are no CORS headers on purpose.
export const config = { path: "/api/report" };

const MAX_BODY = 262144; // bytes a POST may carry
const MAX_HEADLINE = 200; // characters kept
const MAX_REPORT = 240000; // characters of markdown kept (the game never sends more bytes than that in all)
const MAX_UA = 200; // characters of user-agent kept
const KEEP = 40; // reports kept per device: the oldest go first
const PER_DEVICE = 40; // reports a device may add per hour: as many as it keeps, so a device whose game crashes on every launch is heard 40 times
const PER_HOUR = 400; // new reports the whole site takes per hour
const UPDATES_PER_HOUR = 2400; // POSTs per hour that only replace a report the device already has (a playtest sends its log again every few seconds)
const ADMIN_LIST = 60; // reports the admin list shows
const HOUR = 3600 * 1000;
const ALLOW = "GET, POST, OPTIONS";

const DEVICE = /^[A-Z2-7]{8}$/;
const ID = /^[0-9a-z]{4,24}$/;
// r/<device>/<13-digit time>-<id>: the zero padded time makes a listing of one device's prefix sort oldest first.
const KEY = /^r\/([A-Z2-7]{8})\/(\d{13})-([0-9a-z]{4,24})$/;

const HEADERS = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
const reply = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...HEADERS, "content-type": "application/json; charset=utf-8", ...headers },
  });
const fail = (status, error, headers) => reply(status, { ok: false, error }, headers);
const markdown = (text) =>
  new Response(text, { headers: { ...HEADERS, "content-type": "text/markdown; charset=utf-8" } });

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const clip = (text, max) => text.slice(0, max);
// Both sides are hashed first so that the two buffers are the same length and the comparison takes the same time whatever is typed.
const digest = (text) => createHash("sha256").update(String(text)).digest();
const sameSecret = (a, b) => timingSafeEqual(digest(a), digest(b));

const keyOf = (device, at, id) => `r/${device}/${String(at).padStart(13, "0")}-${id}`;
const parseKey = (key) => {
  const found = KEY.exec(key);
  return found && { key, device: found[1], at: Number(found[2]), id: found[3] };
};
const oldestFirst = (a, b) => a.at - b.at || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
const retryAfter = (ms) => ({ "retry-after": String(Math.max(1, Math.ceil(ms / 1000))) });

// A failing store is told apart from a mistake in this file: the first is a 500 "storage", the second a 500 "internal".
class StoreError extends Error {}
const guarded = (store) =>
  Object.fromEntries(
    ["get", "set", "delete", "list"].map((name) => [
      name,
      async (...args) => {
        try {
          return await store[name](...args);
        } catch (cause) {
          throw new StoreError(`${name} failed: ${cause?.message}`, { cause });
        }
      },
    ]),
  );

// The body as text, or null when it is over `limit` bytes. The size is counted as the bytes arrive instead of trusted from the header
// (a request can leave that out or lie), and a body that goes over is dropped without reading the rest of it.
async function readBody(request, limit) {
  if (Number(request.headers.get("content-length")) > limit) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

// One device's stored reports, oldest first. The store promises no order, so the time inside each key does the sorting here.
async function reportsOf(db, device) {
  const { blobs } = await db.list({ prefix: `r/${device}/` });
  return blobs
    .map((blob) => parseKey(blob.key))
    .filter(Boolean)
    .sort(oldestFirst);
}

// ---- POST: validate, rate limit, store, tidy up ----------------------------------------------------------------------------------
async function receive(request, db, at, log) {
  let text;
  try {
    text = await readBody(request, MAX_BODY);
  } catch {
    return fail(400, "the body could not be read");
  }
  if (text === null) return fail(413, "body too large");
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return fail(400, "body is not valid JSON");
  }
  if (!isObject(body)) return fail(400, "body must be a JSON object");
  if (body.v !== 1) return fail(400, "v must be 1");
  const { device, id } = body;
  if (typeof device !== "string" || !DEVICE.test(device))
    return fail(400, "device must be 8 characters of A-Z and 2-7");
  if (typeof id !== "string" || !ID.test(id))
    return fail(400, "id must be 4 to 24 characters of 0-9 and a-z");
  if (typeof body.headline !== "string") return fail(400, "headline must be a string");
  if (typeof body.report !== "string" || body.report.trim() === "")
    return fail(400, "report must be a non-empty string");
  if (body.session != null && !isObject(body.session)) return fail(400, "session must be an object");

  // A device may add 40 reports an hour, counted from the times in its own keys. A report sent again under an id the device already
  // has replaces that one instead of adding to the pile, so it is not counted as a new one: a playtest sends its log again every few
  // seconds, and the stored data does not grow with it.
  const known = await reportsOf(db, device);
  const update = known.some((r) => r.id === id);
  const recent = known.filter((r) => r.id !== id && r.at > at - HOUR);
  if (!update && recent.length >= PER_DEVICE)
    return fail(
      429,
      "too many reports from this device, try again later",
      retryAfter(recent[0].at + HOUR - at),
    );

  // The whole site takes 400 new reports and 2400 replacements an hour: one small counter per UTC hour (yyyymmddhh). Only POSTs that
  // get this far are counted.
  const counterKey = `meta/rate/${new Date(at).toISOString().slice(0, 13).replace(/\D/g, "")}`;
  const counter = await db.get(counterKey, { type: "json" });
  const used = Number(counter?.count) || 0,
    updatesUsed = Number(counter?.updates) || 0;
  if (update ? updatesUsed >= UPDATES_PER_HOUR : used >= PER_HOUR)
    return fail(
      429,
      "too many reports, try again later",
      retryAfter((Math.floor(at / HOUR) + 1) * HOUR - at),
    );
  await db.set(
    counterKey,
    JSON.stringify(
      update
        ? { count: used, updates: updatesUsed + 1 }
        : updatesUsed
          ? { count: used + 1, updates: updatesUsed }
          : { count: used + 1 },
    ),
  );
  if (counter == null) {
    // The first POST of the hour: the counters of earlier hours are of no use any more.
    const { blobs } = await db.list({ prefix: "meta/rate/" });
    await Promise.allSettled(
      blobs.filter((blob) => blob.key < counterKey).map((blob) => db.delete(blob.key)),
    );
  }

  const record = {
    v: 1,
    device,
    id,
    at,
    headline: clip(body.headline, MAX_HEADLINE),
    report: clip(body.report, MAX_REPORT),
    session: body.session ?? null,
    ua: clip(request.headers.get("user-agent") ?? "", MAX_UA),
  };
  const key = keyOf(device, at, id);
  await db.set(key, JSON.stringify(record));

  // Housekeeping after the new report is safely stored, so a failure here can lose nothing: the earlier copy of this id, and whatever
  // is over the 40 kept. A delete that fails is left for the next POST, which works the same lists out again.
  const others = known.filter((r) => r.id !== id);
  const over = others.slice(0, Math.max(0, others.length + 1 - KEEP));
  const replaced = known.filter((r) => r.id === id && r.key !== key);
  const results = await Promise.allSettled([...replaced, ...over].map((r) => db.delete(r.key)));
  for (const result of results)
    if (result.status === "rejected") log("report: tidy-up failed:", result.reason?.message);
  return reply(200, { ok: true, device, id, key, count: others.length + 1 - over.length });
}

// ---- GET: a device's list, one report, or the admin list --------------------------------------------------------------------------
const summary = (r, record) => {
  const out = {
    id: r.id,
    at: r.at,
    iso: new Date(r.at).toISOString(),
    headline: record.headline,
    bytes: Buffer.byteLength(String(record.report ?? "")),
  };
  const commit = record.session?.build?.commit;
  if (typeof commit === "string") out.commit = commit.slice(0, 40);
  if (record.ua) out.ua = record.ua;
  return out;
};

// The newest reports first, each looked up in the store; one that has gone missing meanwhile is left out.
async function load(db, listed) {
  const records = await Promise.all(listed.map((r) => db.get(r.key, { type: "json" })));
  return listed.flatMap((r, i) => (records[i] ? [[r, records[i]]] : []));
}

async function admin(given, db, env) {
  const secret = env.REPORT_ADMIN_KEY;
  // Switched off, or the wrong key: the path answers as if it were not there.
  if (typeof secret !== "string" || secret === "" || !sameSecret(given, secret))
    return fail(404, "not found");
  const { blobs } = await db.list({ prefix: "r/" });
  const newest = blobs
    .map((blob) => parseKey(blob.key))
    .filter(Boolean)
    .sort(oldestFirst)
    .reverse()
    .slice(0, ADMIN_LIST);
  const reports = (await load(db, newest)).map(([r, record]) => ({
    // Only the start of the code: the code is what reads a device's reports, and this list must not hand it out.
    device: r.device.slice(0, 2) + "…",
    id: r.id,
    at: r.at,
    iso: new Date(r.at).toISOString(),
    headline: record.headline,
  }));
  return reply(200, { ok: true, reports });
}

async function read(params, db, env) {
  if (params.has("admin")) return admin(params.get("admin"), db, env);
  const device = params.get("device") ?? "";
  if (!DEVICE.test(device)) return fail(400, "device must be 8 characters of A-Z and 2-7");
  const id = params.get("id");
  if (id !== null && !ID.test(id)) return fail(400, "id must be 4 to 24 characters of 0-9 and a-z");
  const latest = !["", "0", "false"].includes(params.get("latest") ?? "");
  const stored = (await reportsOf(db, device)).reverse();

  if (id !== null || latest) {
    const found = id === null ? stored[0] : stored.find((r) => r.id === id);
    const record = found && (await db.get(found.key, { type: "json" }));
    if (!record) return fail(404, "not found");
    return params.get("format")?.toLowerCase() === "json"
      ? reply(200, { ok: true, ...record })
      : markdown(record.report);
  }
  const reports = (await load(db, stored.slice(0, KEEP))).map(([r, record]) => summary(r, record));
  return reply(200, { ok: true, device, reports });
}

// ---- the function ----------------------------------------------------------------------------------------------------------------
// `store` is a Netlify Blobs store (the check passes a fake with the same four methods), `env` the environment variables, `now` the
// clock in milliseconds and `log` where a failure is written. It never throws: every path answers with a Response.
export async function handle(request, { store, env = {}, now = Date.now, log = console.error } = {}) {
  try {
    const db = guarded(store);
    switch (request.method) {
      case "POST":
        return await receive(request, db, Math.trunc(now()), log);
      case "GET":
        return await read(new URL(request.url).searchParams, db, env);
      case "OPTIONS":
        return new Response(null, { status: 204, headers: { ...HEADERS, allow: ALLOW } });
      default:
        return fail(405, "method not allowed", { allow: ALLOW });
    }
  } catch (error) {
    // Never the device code or the body: only what went wrong.
    log("report:", request.method, error?.message);
    return fail(500, error instanceof StoreError ? "storage" : "internal");
  }
}

// The package is imported here and not at the top of the file so that the checks can load this file without it. The specifier is a
// literal string because Netlify's bundler (nft) follows only those into the deployed function. The store is opened with strong
// consistency: the developer reads a report right after the game sent it, and a report sent again deletes its earlier copy, while
// the default (eventual) consistency may still show the old state for up to a minute. Strong reads need the uncached edge address
// in the Blobs context Netlify gives a function; if the log ever shows BlobsConsistencyError, drop the option: getStore("reports").
export async function openStore() {
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: "reports", consistency: "strong" });
}

export default async (request) => {
  let store;
  try {
    store = await openStore();
  } catch (error) {
    console.error("report: the store could not be opened:", error?.message);
    return fail(500, "storage");
  }
  return handle(request, { store, env: process.env });
};
