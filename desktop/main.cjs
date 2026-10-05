"use strict";
// Pool Panic as a desktop app: one window showing the game (../dist, or a copy of it in ./game once packaged) from a privileged
// app://game/ address, Steam through steamworks.js when the Steam client is there, and the player's progress mirrored to a
// plain file that Steam Cloud can sync. Nothing here changes how the game plays: with no Steam it is the same game in a window.
const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  ipcMain,
  net,
  protocol,
  screen,
  session,
  shell,
} = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const lib = require("./lib.cjs");
const { createSteam, readConfig } = require("./steam.cjs");

const log = (...args) => console.log("[pool-panic]", ...args);
const bundled = path.join(__dirname, "game");
const GAME_ROOT = fs.existsSync(path.join(bundled, "index.html"))
  ? bundled
  : path.join(__dirname, "..", "dist");

// Settings from the environment, for trying things on a development machine (none of them is needed to play).
const env = process.env;
const DEV = env.POOLPANIC_DEV === "1" || !app.isPackaged;
// A tester build (lib.cjs, desktop/README.md): playtest mode is on and the game's log is posted to the report service for the page. It is one
// when a tester.json lies beside the game (the downloads CI makes write it), or when it is run from the source with `--tester` (or the
// environment variable POOLPANIC_TESTER=1, or POOLPANIC_REPORTS=<address> to post to a service of your own). A Steam build is none of these.
const TESTER = (() => {
  try {
    const file = path.join(GAME_ROOT, "tester.json");
    if (fs.existsSync(file)) return lib.readTester(fs.readFileSync(file, "utf8"), { allowLocal: DEV });
  } catch {}
  if (DEV && (process.argv.includes("--tester") || env.POOLPANIC_TESTER === "1" || env.POOLPANIC_REPORTS))
    return lib.readTester(JSON.stringify({ reports: env.POOLPANIC_REPORTS }), { allowLocal: true });
  return null;
})();
const QUERY = env.POOLPANIC_QUERY
  ? "?" + env.POOLPANIC_QUERY.replace(/^\?/, "") // e.g. "debug&dpr=1"
  : TESTER
    ? "?" + TESTER.query
    : "";

// The player's data (settings, the progress mirror, the window's place) lives in one folder with a name that has no spaces,
// which is what Steam's Auto-Cloud paths are written against: %APPDATA%/PoolPanic, ~/Library/Application Support/PoolPanic,
// ~/.config/PoolPanic.
app.setPath("userData", env.POOLPANIC_DATA || path.join(app.getPath("appData"), "PoolPanic"));
const SAVES = path.join(app.getPath("userData"), "saves", "progress.json");
const WINDOW_FILE = path.join(app.getPath("userData"), "window.json");
app.setAppUserModelId("com.poolpanic.game");

// ---- Steam: before the app is ready, because the overlay's switches must be on the command line by then ----------------
const steam = createSteam({ config: readConfig(path.join(__dirname, "steam.config.json")), log });
const started = steam.start();
if (TESTER) log("Tester build: playtest mode on, the log goes to " + TESTER.reports);
if (started.available) {
  steam.enableOverlay();
  log("Steam is running: " + (started.name || "?") + (started.deck ? " (a Steam Deck)" : ""));
}

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required"); // the music starts with the first click, as in a browser, but never waits for one
if (env.POOLPANIC_SOFTWARE_GL === "1") {
  // For a machine with no graphics card (a test run on a server): draw with SwiftShader.
  app.commandLine.appendSwitch("use-gl", "angle");
  app.commandLine.appendSwitch("use-angle", "swiftshader");
  app.commandLine.appendSwitch("enable-unsafe-swiftshader");
  app.commandLine.appendSwitch("ignore-gpu-blocklist");
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  },
]);

// ---- the progress mirror -----------------------------------------------------------------------------------------------------
function readSaves() {
  try {
    return lib.readSaveFile(fs.readFileSync(SAVES, "utf8"))?.keys || null;
  } catch {
    return null;
  }
}
// Written whole to a temporary file and renamed over the old one, with the one before kept beside it, so a crash or a power
// cut in the middle leaves a good file.
function writeSaves(values) {
  const text = lib.buildSaveFile(values);
  try {
    fs.mkdirSync(path.dirname(SAVES), { recursive: true });
    const temporary = SAVES + ".tmp";
    fs.writeFileSync(temporary, text);
    if (fs.existsSync(SAVES)) fs.copyFileSync(SAVES, SAVES.replace(/\.json$/, ".previous.json"));
    fs.renameSync(temporary, SAVES);
  } catch (error) {
    log("The progress file could not be written:", error.message);
  }
}

// ---- the window --------------------------------------------------------------------------------------------------------------
let win = null;

function windowState() {
  let saved = null;
  try {
    saved = JSON.parse(fs.readFileSync(WINDOW_FILE, "utf8"));
  } catch {}
  return lib.fitWindow(
    saved,
    screen.getAllDisplays().map((d) => d.workArea),
  );
}
function rememberWindow() {
  if (!win || win.isDestroyed()) return;
  const bounds = win.isMaximized() || win.isFullScreen() ? win.getNormalBounds() : win.getBounds();
  try {
    fs.writeFileSync(
      WINDOW_FILE,
      JSON.stringify({ ...bounds, maximized: win.isMaximized(), fullscreen: win.isFullScreen() }),
    );
  } catch {}
}

function createWindow() {
  const state = windowState();
  win = new BrowserWindow({
    ...(state.x === undefined ? {} : { x: state.x, y: state.y }),
    width: state.width,
    height: state.height,
    minWidth: 960,
    minHeight: 540,
    fullscreen: env.POOLPANIC_FULLSCREEN === "1" || state.fullscreen,
    show: false,
    title: "Pool Panic",
    backgroundColor: "#103b48",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: false, // the shift clock is the game's own, but the music and a screenshot tool should not stall
      devTools: DEV,
    },
  });
  if (state.maximized) win.maximize();
  win.once("ready-to-show", () => win.show());
  win.on("resize", debounce(rememberWindow, 400));
  win.on("move", debounce(rememberWindow, 400));
  win.on("close", rememberWindow);
  win.on("closed", () => (win = null));
  win.on("page-title-updated", (event) => event.preventDefault()); // the window is called Pool Panic, whatever the page says

  // The game's own address only; links that leave it go to the browser, if they are ones the game uses.
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(lib.GAME_ORIGIN + "/")) event.preventDefault();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (lib.isSafeExternalUrl(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    const fullscreen = input.key === "F11" || (input.alt && input.key === "Enter");
    if (fullscreen) {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    } else if (DEV && input.control && input.shift && input.key.toLowerCase() === "i") {
      win.webContents.toggleDevTools();
    }
  });
  // A window that dies is reloaded, so the game's own crash dialog can say what happened; one that keeps dying is left alone.
  const gone = [];
  win.webContents.on("render-process-gone", (_event, details) => {
    log("The game's window process is gone:", details.reason);
    if (details.reason === "clean-exit" || !win || win.isDestroyed()) return;
    const now = Date.now();
    gone.push(now);
    while (gone.length && now - gone[0] > 60000) gone.shift();
    if (gone.length <= 3) win.webContents.reload();
    else {
      log("It keeps stopping: not reloading it again.");
      dialog.showErrorBox(
        "Pool Panic",
        `The game's window keeps stopping (${details.reason}). Please start the game again; if it repeats, send the game's log (Help, then Open the game log).`,
      );
    }
  });
  if (DEV)
    win.webContents.on("console-message", (event, ...legacy) => {
      // (Electron passes the details on the event now; older ones passed them as arguments.)
      const level = event.level ?? legacy[0];
      const message = event.message ?? legacy[1];
      if (["warning", "error", 2, 3].includes(level)) log("console:", message);
    });

  win.loadURL(lib.GAME_ORIGIN + "/index.html" + QUERY);
}

function debounce(fn, ms) {
  let timer = null;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}

// ---- messages from the game's window ------------------------------------------------------------------------------------
const trusted = (event) => {
  try {
    return (event.senderFrame?.url || "").startsWith(lib.GAME_ORIGIN + "/");
  } catch {
    return false;
  }
};
const on = (channel, handler) =>
  ipcMain.on(channel, (event, ...args) =>
    trusted(event) ? handler(event, ...args) : (event.returnValue = null),
  );

on("desktop:boot", (event) => {
  event.returnValue = {
    version: app.getVersion(),
    platform: process.platform,
    steam: steam.status(),
    saveKeys: lib.SAVE_KEYS,
    saves: readSaves(),
    tester: !!TESTER,
  };
});
on("desktop:save", (_event, values) => writeSaves(values));
on("desktop:save-now", (event, values) => {
  writeSaves(values);
  event.returnValue = true;
});
on("desktop:fullscreen", () => win?.setFullScreen(!win.isFullScreen()));
on("desktop:quit", () => app.quit());
on("desktop:open", (_event, url) => lib.isSafeExternalUrl(url) && shell.openExternal(url));
// A tester build posts the page's log to the report service (the window may only talk to its own files). The address is fixed here, not
// the page's to choose, and only the game's own window may ask; the answer is the service's own: {ok, status, body, retryAfter}.
ipcMain.handle("desktop:report", async (event, text) => {
  if (!TESTER || !trusted(event)) return { ok: false, status: 0, error: "not a tester build" };
  if (typeof text !== "string" || Buffer.byteLength(text) > lib.MAX_REPORT_BODY)
    return { ok: false, status: 413, error: "too big" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await net.fetch(TESTER.reports, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: text,
      signal: controller.signal,
    });
    let body = null;
    try {
      body = await response.json();
    } catch {}
    const retryAfter = Number(response.headers.get("retry-after")) || 0;
    return { ok: response.ok, status: response.status, body, ...(retryAfter > 0 && { retryAfter }) };
  } catch (error) {
    return { ok: false, status: 0, error: error?.name === "AbortError" ? "timed out" : "no connection" };
  } finally {
    clearTimeout(timer);
  }
});
on("steam:unlock", (_event, id) => steam.unlock(id));
on("steam:stat", (_event, name, value) => steam.setStat(name, value));
on("steam:presence", (_event, text) => steam.richPresence(text));

// ---- starting ------------------------------------------------------------------------------------------------------------------
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'", // the page's import map and its boot guard are inline
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "connect-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

async function serve(request) {
  const file = lib.resolveGameFile(GAME_ROOT, request.url);
  if (!file) return new Response("Not found", { status: 404 });
  try {
    const response = await net.fetch(pathToFileURL(file).toString());
    if (!response.ok) return new Response("Not found", { status: 404 });
    const headers = new Headers({ "Content-Type": lib.mimeFor(file), "Cache-Control": "no-cache" });
    if (file.endsWith(".html")) headers.set("Content-Security-Policy", CSP);
    return new Response(response.body, { status: 200, headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

if (started.restart || !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.whenReady().then(() => {
    protocol.handle("app", serve);
    // Only what the game uses: going full screen, copying a crash report. A camera, a microphone or a location is never asked for.
    const allowed = new Set(["fullscreen", "clipboard-sanitized-write", "pointerLock"]);
    session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) =>
      callback(allowed.has(permission)),
    );
    session.defaultSession.setPermissionCheckHandler((_contents, permission) => allowed.has(permission));
    if (process.platform === "darwin") {
      Menu.setApplicationMenu(
        Menu.buildFromTemplate([{ role: "appMenu" }, { role: "editMenu" }, { role: "windowMenu" }]),
      );
    } else Menu.setApplicationMenu(null);
    createWindow();
    app.on("activate", () => BrowserWindow.getAllWindows().length === 0 && createWindow());
  });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", rememberWindow);
}
