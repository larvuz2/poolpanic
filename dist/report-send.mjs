// Sending a crash report to the developer, only when the player says so: a button in the crash dialog, or the box beside it that
// makes every later report go by itself. One POST of the report crashlog.mjs wrote, to this site's own /api/report
// (netlify/functions/report.mjs), which keeps it where the developer can read it. A report lists this device, the error and the last
// things that happened in the game: no name, no account, no address. The device code is a random label made on this device the first
// time it is needed, so "everything this device has sent" can be asked for by one short code instead of by copying text around.
// Pure apart from the storage and the fetch it is handed. The desktop app's window may only talk to its own files, so a tester build (not
// the Steam one: desktop/README.md) gives the page `window.desktop.sendReport`, which hands the text to the app's main process to post;
// `bridgeFetch` makes that look like a fetch to `sendReport`. A Steam build has no such thing and never offers sending.

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

// Only where there is somewhere to send to: a page served over http(s), or the desktop app when its window has been given a way to post.
export const canSend = ({ desktop = false, protocol = "", bridge = false } = {}) =>
  desktop ? !!bridge : /^https?:$/.test(protocol);

// The desktop window's way to post (`bridge(text)` answers {ok, status, body, retryAfter} from the main process), made to look like the
// fetch `sendReport` is written for.
export const bridgeFetch =
  (bridge) =>
  async (_url, { body } = {}) => {
    const answer = await bridge(String(body ?? ""));
    if (!answer || !answer.status) {
      // No answer from the service at all (no connection, or too slow): what a fetch does, which `sendReport` knows how to say.
      const error = new Error(answer?.error || "no connection");
      error.name = answer?.error === "timed out" ? "AbortError" : "Error";
      throw error;
    }
    return {
      ok: !!answer?.ok,
      status: Number(answer?.status) || 0,
      json: async () => answer?.body ?? null,
      headers: {
        get: (name) =>
          String(name).toLowerCase() === "retry-after" && answer?.retryAfter
            ? String(answer.retryAfter)
            : null,
      },
    };
  };

// What is posted for a session: its report (Markdown, so it reads as it is) and the raw session next to it, unless that would be
// too big for the service (then the report alone, and if even that is too big, a report with fewer of the oldest breadcrumbs and no
// recorded shifts). `slim` is for the log sent again and again during a playtest: the report carries all of it, so the raw session
// comes without its breadcrumbs and recordings.
const bytes = (text) =>
  typeof TextEncoder === "function" ? new TextEncoder().encode(text).length : text.length * 3; // (the service counts bytes, not characters: an arrow or a × is three of them)
export const slimSession = (session) => ({
  ...session,
  crumbs: session.crumbs.slice(-30),
  replays: undefined,
  playtest: session.playtest && { data: session.playtest.data },
});
export function reportPayload(log, session, device, { slim = false } = {}) {
  const payload = {
    v: 1,
    device,
    id: session.id,
    headline: String(log.headline(session)).slice(0, 200),
    report: log.report(session, { device, replay: 1 }),
    session: slim ? slimSession(session) : session,
  };
  if (bytes(JSON.stringify(payload)) > REPORT_LIMITS.body) payload.session = null;
  // Still too big: the oldest breadcrumbs go first (half of them each time), and the recorded shift after the first try.
  let crumbs = session.crumbs.length;
  for (let pass = 0; bytes(JSON.stringify(payload)) > REPORT_LIMITS.body && crumbs > 20; pass++) {
    crumbs = Math.floor(crumbs / 2);
    payload.report = log.report(session, { device, crumbs, replay: pass === 0 ? 1 : 0 });
  }
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
    // (a service that is asking for quiet says for how long, in seconds)
    const wait = Number(response.headers?.get?.("retry-after"));
    return {
      ok: false,
      status: response.status,
      error: body?.error || "HTTP " + response.status,
      ...(wait > 0 && { retryAfter: wait }),
    };
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
