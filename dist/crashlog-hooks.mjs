// Browser wiring for the crash log (crashlog.mjs): window errors and rejected promises, the console's errors and
// warnings, tab visibility and closing, a lost or restored WebGL context, and a lock that tells the next launch
// whether this page is still alive. Every browser object is passed in, so a check can hand it fakes.
import { CrashLog, CRASHLOG_KEY } from "./crashlog.mjs";

const LOCK = "pool-panic-session-";

// What can be said about the device without asking for anything.
export function describeEnvironment({
  nav = globalThis.navigator,
  win = globalThis.window,
  doc = globalThis.document,
  motion = false,
} = {}) {
  const out = {};
  try {
    out.ua = String(nav?.userAgent || "")
      .replace(/Mozilla\/5\.0 /, "")
      .slice(0, 150);
    out.viewport = (win?.innerWidth || 0) + "×" + (win?.innerHeight || 0);
    out.dpr = win?.devicePixelRatio || 1;
    out.touch = (nav?.maxTouchPoints || 0) > 0;
    out.cores = nav?.hardwareConcurrency || 0;
    out.memory = nav?.deviceMemory || 0; // gigabytes, where the browser says
    out.lang = nav?.language || "";
    out.reduced = !!motion;
    out.online = nav?.onLine !== false;
    void doc;
  } catch {}
  return out;
}

// The GPU the page is really drawing with, from a WebGL context that already exists.
export function describeGpu(gl) {
  try {
    const ext = gl?.getExtension?.("WEBGL_debug_renderer_info");
    if (ext) return String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "").slice(0, 100);
    return String(gl?.getParameter?.(gl.RENDERER) || "").slice(0, 100);
  } catch {
    return "";
  }
}

// Start the log and hook the browser up to it. Returns the log; `log.hooks` says what was installed.
export function installCrashLog({
  win = globalThis.window,
  doc = globalThis.document,
  con = globalThis.console,
  nav = globalThis.navigator,
  build = {},
  storage = null,
  motion = false,
  now,
  schedule,
} = {}) {
  const log = new CrashLog({ storage, now, schedule });
  log.hooks = [];
  const on = (target, type, fn, options) => {
    try {
      target?.addEventListener?.(type, fn, options);
      log.hooks.push(type);
    } catch {}
  };
  log.start({
    build,
    env: describeEnvironment({ nav, win, doc, motion }),
    page: (win?.location?.pathname || "") + (win?.location?.search || ""),
  });

  // A page that is still running in another tab holds this lock; when a page dies, its lock goes with it.
  (async () => {
    try {
      if (!nav?.locks?.request) return void log.settle(null);
      nav.locks.request(LOCK + log.session.id, () => new Promise(() => {})).catch(() => {});
      const { held = [] } = await nav.locks.query();
      log.settle(new Set(held.map((l) => String(l.name).replace(LOCK, ""))));
    } catch {
      log.settle(null);
    }
  })();

  // Uncaught errors and promises nobody caught.
  on(win, "error", (e) => {
    if (!e.error && !e.message) return; // a resource that failed to load says nothing useful here
    log.error("window", e.error || new Error(e.message), {
      file: String(e.filename || "").replace(/^https?:\/\/[^/]+\//, "/"),
      line: e.lineno,
      col: e.colno,
    });
  });
  on(win, "unhandledrejection", (e) =>
    log.error("promise", e.reason instanceof Error ? e.reason : new Error(String(e.reason))),
  );

  // The console: three.js reports shader and context problems there. Errors that start with THREE. are recorded as
  // errors (a shader that did not compile matters); everything else is only a breadcrumb.
  if (con && !con.__poolPanicLog) {
    for (const level of ["error", "warn"]) {
      const original = con[level];
      if (typeof original !== "function") continue;
      con[level] = function (...args) {
        try {
          const text = args
            .map((a) =>
              a instanceof Error
                ? a.name + ": " + a.message
                : typeof a === "string"
                  ? a
                  : typeof a === "object" && a
                    ? a.message || "[object]"
                    : String(a),
            )
            .join(" ");
          if (!/^Pool Panic/.test(text) && !/AudioContext/.test(text)) {
            if (level === "error" && /^THREE\./.test(text)) log.error("three", new Error(text));
            else log.crumb("console." + level, text);
          }
        } catch {}
        return original.apply(this, args);
      };
    }
    con.__poolPanicLog = true;
    log.hooks.push("console");
  }

  // Leaving and coming back. Going to the background is not a crash; a page that says goodbye closed on purpose.
  on(doc, "visibilitychange", () => log.setHidden(!!doc.hidden));
  on(win, "pagehide", () => log.close());
  on(win, "pageshow", (e) => {
    if (e.persisted) log.reopen();
  });

  // A GPU that gives the context back. Capture: the event does not bubble from the canvas.
  on(
    doc,
    "webglcontextlost",
    (e) => {
      e.preventDefault?.(); // lets the browser hand the context back
      log.error("webgl", new Error("WebGL context lost (the browser took the GPU back)"));
      log.onContextLost?.();
    },
    true,
  );
  on(
    doc,
    "webglcontextrestored",
    () => {
      log.crumb("webgl", "context restored");
      log.onContextRestored?.();
    },
    true,
  );
  return log;
}

// Keep the log's storage key stable for the checks.
export { CRASHLOG_KEY };
