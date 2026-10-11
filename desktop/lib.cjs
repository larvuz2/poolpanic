"use strict";
// The pure parts of the desktop shell, with no Electron in them so that desktop-check.mjs can load them: which file a game
// address means (and that nothing outside the game's folder can be asked for), what to serve it as, which of the game's saved
// keys are mirrored to a file Steam Cloud can sync, what such a file looks like, and which links may leave the game.
const path = require("node:path");

// The game is served from app://game/ (see main.cjs): module scripts, fetch, WebAudio and localStorage need a real origin, which
// file:// does not give.
const GAME_ORIGIN = "app://game";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

function mimeFor(file) {
  return TYPES[path.extname(String(file)).toLowerCase()] || "application/octet-stream";
}

// app://game/<path> to the file under `root` that it names, or null: another scheme or host, a path that climbs out of the
// folder (also written %2e%2e or with backslashes), a NUL, or something that is not a path at all.
function resolveGameFile(root, address) {
  let url;
  try {
    url = new URL(address);
  } catch {
    return null;
  }
  if (url.protocol !== "app:" || url.hostname !== "game") return null;
  let rel;
  try {
    rel = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (rel.includes("\0") || rel.includes("\\")) return null;
  if (rel === "" || rel === "/") rel = "/index.html";
  const base = path.resolve(root);
  const file = path.resolve(base, "." + rel);
  const inside = path.relative(base, file);
  if (!inside || inside.startsWith("..") || path.isAbsolute(inside)) return null;
  return file;
}

// ---- the save mirror -----------------------------------------------------------------------------------------------------
// The game keeps its progress in localStorage, which in a desktop app is a LevelDB folder that Steam Cloud cannot sync. The
// preload copies these keys to one plain JSON file (saves/progress.json in the app's data folder, which Steam's Auto-Cloud
// is pointed at) every time they change, and puts them back before the game starts. The crash log and the hunt's state are
// left out: they describe a device, not a player.
const SAVE_KEYS = [
  "pool-panic.records.v1",
  "pool-panic.story.v1",
  "pool-panic.map.v1",
  "pool-panic.seen.v1",
  "pool-panic.settings.v1",
  "pool-panic.swimmers.v1",
  "pool-panic.coach.v1",
  "pool-panic.achievements.v1",
];
const SAVE_VERSION = 1;
const MAX_VALUE = 256 * 1024; // a value larger than this is not one of the game's

// The file's text for the keys' current values (null: not set).
function buildSaveFile(values, now = Date.now()) {
  const keys = {};
  for (const key of SAVE_KEYS) {
    const value = values?.[key];
    if (typeof value === "string" && value.length <= MAX_VALUE) keys[key] = value;
  }
  return JSON.stringify({ version: SAVE_VERSION, savedAt: now, keys }, null, 2);
}

// The keys a file holds, or null if it is not one of ours. Anything that is not a saved key, or not a plain string, is dropped.
function readSaveFile(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || data.version !== SAVE_VERSION || typeof data.keys !== "object" || !data.keys) return null;
  const keys = {};
  for (const key of SAVE_KEYS) {
    const value = data.keys[key];
    if (typeof value === "string" && value.length <= MAX_VALUE) keys[key] = value;
  }
  return { savedAt: Number(data.savedAt) || 0, keys };
}

// Whether two sets of values would write the same file (the mirror only writes when something changed).
function sameValues(a, b) {
  return SAVE_KEYS.every((key) => (a?.[key] ?? null) === (b?.[key] ?? null));
}

// ---- links and windows ---------------------------------------------------------------------------------------------------
// Only https links leave the game, and only to a host the game links to (the crash dialog opens a GitHub issue; a store page
// or a support page can be added here).
const LINK_HOSTS = ["github.com", "store.steampowered.com", "steamcommunity.com"];
function isSafeExternalUrl(address) {
  try {
    const url = new URL(address);
    return (
      url.protocol === "https:" &&
      LINK_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith("." + h))
    );
  } catch {
    return false;
  }
}

// A saved window put back on a screen that exists now (a monitor may have been unplugged since): `displays` are the work areas
// [{x, y, width, height}]. A window that is entirely off every screen goes to the middle of the first one.
function fitWindow(saved, displays, defaults = { width: 1280, height: 720 }) {
  const first = displays?.[0] || { x: 0, y: 0, width: 1920, height: 1080 };
  const size = (v, fallback, min) => (Number.isFinite(v) && v >= min ? Math.round(v) : fallback);
  const width = Math.min(size(saved?.width, defaults.width, 640), first.width);
  const height = Math.min(size(saved?.height, defaults.height, 360), first.height);
  const out = { width, height, maximized: !!saved?.maximized, fullscreen: !!saved?.fullscreen };
  const visible = (d) =>
    Number.isFinite(saved?.x) &&
    Number.isFinite(saved?.y) &&
    saved.x + width > d.x + 40 &&
    saved.x < d.x + d.width - 40 &&
    saved.y >= d.y - 8 &&
    saved.y < d.y + d.height - 40;
  if ((displays || []).some(visible)) {
    out.x = Math.round(saved.x);
    out.y = Math.round(saved.y);
  }
  return out;
}

// ---- tester builds ---------------------------------------------------------------------------------------------------------------
// A tester build (the creator's own Mac and Windows machines, from the downloads CI makes) has playtest mode on and may post the game's log
// to the report service, which the locked-down window cannot do by itself: the main process posts it for the page. A file beside the game
// says so, `tester.json`: {"reports": "https://…/api/report", "query": "playtest"}. The Steam build has no such file and never posts anything.
const REPORT_PATH = "/api/report";
const DEFAULT_REPORTS = "https://poolpanic.netlify.app" + REPORT_PATH;
const MAX_REPORT_BODY = 262144; // what the report service takes in one post (netlify/functions/report.mjs)

// An address the app may post a report to: https and the report path, nothing else in it (a developer's own fake service on this machine
// may be http://localhost when `allowLocal` says so, which only an unpacked app does).
function isReportUrl(address, { allowLocal = false } = {}) {
  let url;
  try {
    url = new URL(address);
  } catch {
    return false;
  }
  if (url.username || url.password || url.search || url.hash || url.pathname !== REPORT_PATH) return false;
  if (url.protocol === "https:") return true;
  return allowLocal && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
}

// What a tester.json says, or null when it is not one (a file that cannot be read is not a tester build, so a damaged Steam build never posts by
// accident). A report address that is not allowed becomes the project's own, and the query is only letters, digits and `= & . - _`.
function readTester(text, { allowLocal = false } = {}) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  return {
    reports:
      typeof data.reports === "string" && isReportUrl(data.reports, { allowLocal })
        ? data.reports
        : DEFAULT_REPORTS,
    query: typeof data.query === "string" && /^[\w=&.-]{0,200}$/.test(data.query) ? data.query : "playtest",
  };
}

module.exports = {
  DEFAULT_REPORTS,
  MAX_REPORT_BODY,
  isReportUrl,
  readTester,
  GAME_ORIGIN,
  SAVE_KEYS,
  SAVE_VERSION,
  buildSaveFile,
  fitWindow,
  isSafeExternalUrl,
  mimeFor,
  readSaveFile,
  resolveGameFile,
  sameValues,
};
