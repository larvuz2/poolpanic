// Sending a crash report to the developer, only when the player says so: a button in the crash dialog, or the box beside it that
// makes every later report go by itself. One POST of the report crashlog.mjs wrote, to this site's own /api/report
// (netlify/functions/report.mjs), which keeps it where the developer can read it. A report lists this device, the error and the last
// things that happened in the game: no name, no account, no address. The device code is a random label made on this device the first
// time it is needed, so "everything this device has sent" can be asked for by one short code instead of by copying text around.
// Pure apart from the storage and the fetch it is handed. The desktop app has no site to send to and never offers it.

export const REPORT_PREFS_KEY = "pool-panic.reports.v1";
export const REPORT_URL = "/api/report";
export const REPORT_LIMITS = { body: 240000, wait: 10000 };
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; // RFC 4648 base32: no 0, 1, 8 or 9 to mistake for letters
const DEVICE = /^[A-Z2-7]{8}$/;

// A number in [0, 1) from the browser's secure generator (the code is what lets a report be read back), else Math.random.
function secureRandom() {
  try {
    const n = new Uint32Array(1);
    globalThis.crypto.getRandomValues(n);
    return n[0] / 4294967296;
  } catch {
    return Math.random();
  }
}
export function newDeviceCode(random = secureRandom) {
  let code = "";
  for (let i = 0; i < 8; i++) code += ALPHABET[Math.floor(random() * 32) % 32];
  return code;
}

// {device, auto}: the device's code (made and kept on first use) and whether reports go by themselves (true, false, or null when
// the player has not said: the dialog then offers the box ticked).
export function readPrefs(storage, random = secureRandom) {
  let saved = {};
  try {
    saved = JSON.parse(storage?.getItem(REPORT_PREFS_KEY) || "{}") || {};
  } catch {}
  const prefs = {
    device: DEVICE.test(saved.device) ? saved.device : newDeviceCode(random),
    auto: typeof saved.auto === "boolean" ? saved.auto : null,
  };
  if (prefs.device !== saved.device) savePrefs(storage, prefs);
  return prefs;
}
export function savePrefs(storage, prefs) {
  try {
    storage?.setItem(REPORT_PREFS_KEY, JSON.stringify({ device: prefs.device, auto: prefs.auto }));
  } catch {}
}

// Only where there is a site to send to: a page served over http(s), not the desktop app.
export const canSend = ({ desktop = false, protocol = "" } = {}) => !desktop && /^https?:$/.test(protocol);

// What is posted for a session: its report (Markdown, so it reads as it is) and the raw session next to it, unless that would be
// too big for the service (then the report alone).
export function reportPayload(log, session, device) {
  const payload = {
    v: 1,
    device,
    id: session.id,
    headline: String(log.headline(session)).slice(0, 200),
    report: log.report(session),
    session,
  };
  // (the service counts bytes, not characters: an arrow or a × in the report is three of them)
  const bytes = (text) =>
    typeof TextEncoder === "function" ? new TextEncoder().encode(text).length : text.length * 3;
  if (bytes(JSON.stringify(payload)) > REPORT_LIMITS.body) payload.session = null;
  return payload;
}

export async function sendReport(
  payload,
  { fetch = globalThis.fetch, url = REPORT_URL, wait = REPORT_LIMITS.wait } = {},
) {
  if (typeof fetch !== "function") return { ok: false, status: 0, error: "no connection" };
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller && setTimeout(() => controller.abort(), wait);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller?.signal,
    });
    let body = null;
    try {
      body = await response.json();
    } catch {}
    if (response.ok && body?.ok) return { ok: true, status: response.status };
    return { ok: false, status: response.status, error: body?.error || "HTTP " + response.status };
  } catch (e) {
    return { ok: false, status: 0, error: e?.name === "AbortError" ? "timed out" : "no connection" };
  } finally {
    clearTimeout(timer);
  }
}

// What the dialog says when a send did not work.
export function sendProblem(result) {
  if (!result || result.ok) return "";
  if (result.status === 0)
    return result.error === "timed out" ? "The report service did not answer in time." : "No connection.";
  if ([404, 405, 501].includes(result.status))
    return "The report service is not on this server (only the Netlify site has it).";
  if (result.status === 413) return "The report is too big for the service.";
  if (result.status === 429) return "Too many reports just now: try again in a while.";
  return "The report service said: " + (result.error || "HTTP " + result.status);
}
