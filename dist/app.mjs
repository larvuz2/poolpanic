import { screenMovement } from "./spatial.mjs";
import {
  normalizeRecords,
  starsFor,
  starsForDrill,
  recordResult,
  recordDrill,
  isUnlocked,
  progressFlags,
} from "./progression.mjs";
import {
  CAMPAIGN,
  ZONES,
  zoneOfLevel,
  zoneStatus,
  drillStatus,
  levelState,
  currentLevel,
  shiftHighlights,
} from "./campaign.mjs";
import { DRILLS } from "./drills.mjs";
import { offerBookings, BOOKINGS } from "./bookings.mjs";
import { LevelMap } from "./map.mjs";
import { guidanceState, cuePulse } from "./guidance.mjs";
import { PoolSimulation, TYPES, SHIFTS, loopPosition, swimmerLook } from "./sim.mjs";
import { PoolWorld } from "./scene.mjs";
import { PoolAudio } from "./audio.mjs";
import { CoachInput } from "./input.mjs";
import { MomentDirector, edgeArrow } from "./moments.mjs";
import { installCrashLog, describeGpu } from "./crashlog-hooks.mjs";
import { BUILD } from "./version.mjs";
import { playCinematic } from "./cinematic.mjs";
import { readTuning, isWebKit } from "./tuning.mjs";
import * as hunts from "./bisect.mjs";
import {
  STORY,
  INTRO,
  ENDING,
  money,
  shiftPay,
  normalizeStory,
  recordPay,
  fundOf,
  fundShare,
} from "./story.mjs";
const $ = (id) => document.getElementById(id),
  audio = new PoolAudio();
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
// The crash log starts first, so whatever goes wrong afterwards (even while the world is being built) is kept on the
// device. Nothing is sent anywhere: see crashlog.mjs, and the crash dialog for how a report gets to us.
let crashStorage = null;
try {
  crashStorage = localStorage;
} catch {}
// The switches for isolating a crash (tuning.mjs) and the crash hunt that runs them one at a time (bisect.mjs). The
// hunt's state is read first: a test left running by the last page means that page died in it.
const params = new URLSearchParams(location.search);
const hunt = params.get("bisect") === "hands" ? hunts.hands : hunts.main; // ?bisect=hands looks inside the hands layer
let huntState = null;
if (params.has("bisect")) {
  if (params.get("bisect") === "reset" || params.has("reset")) {
    // Start over, once: the address the page reloads into no longer says reset.
    hunt.clear(crashStorage);
    const again = new URLSearchParams(location.search);
    again.delete("reset");
    if (again.get("bisect") === "reset") again.set("bisect", "");
    history.replaceState(null, "", location.pathname + "?" + again.toString());
  }
  huntState = hunt.resume(hunt.load(crashStorage));
  hunt.save(crashStorage, huntState);
}
const huntStep = huntState && !hunt.finished(huntState) ? hunt.current(huntState) : null;
// The first-person hands layer crashed an iPad's Safari about 45 s into every Coach Cam shift (the crash hunt found
// it), so Safari's engine plays without it until that is understood. `?hands` turns it back on; a hunt or a trial
// sets its own switches and gets no default.
const testing = params.has("bisect") || params.has("trial");
const handsOff = isWebKit(navigator.userAgent) && !params.has("hands") && !testing;
const tuning = readTuning(location.search, [
  ...(huntStep ? huntStep.flags : []),
  ...(handsOff ? ["nohands"] : []),
]);
globalThis.__poolTuning = tuning;
if (tuning.has("nosound")) {
  audio.enabled = false;
  audio.init = () => {};
}
const crashlog = installCrashLog({ build: BUILD, storage: crashStorage, motion: reducedMotion.matches });
for (const e of window.__boot?.errors || []) crashlog.error("boot", e);
let input,
  accumulator = 0,
  sim,
  world,
  level = 1,
  mode = "menu",
  previous = 0,
  uiClock = 0,
  toastTimer = 0,
  queueKey = "",
  pausedByHelp = false,
  resumeState = "playing",
  helpResumeState = "playing";
let records = normalizeRecords();
try {
  records = normalizeRecords(JSON.parse(localStorage.getItem("pool-panic.records.v1")));
} catch {}
// `?locked` previews the real, star-gated map while every level is open for playtesting (see progression.mjs).
if (new URLSearchParams(location.search).has("locked")) progressFlags.unlockAll = false;
// The menu is a map. `selected` is what its panel shows: a level, or a chunk's drill. A new player starts on level
// 1; a returning one on the level the coach is up to.
level = currentLevel(records);
let selected = { kind: "level", level },
  mapView = null,
  activeBooking = null, // the booking of the shift being played (or last played), so Replay and Restart keep it
  afterResults = null, // the level the map should select when we return to it (the one just unlocked)
  nextMode = "level"; // what the results dialog's main button does: "level" (next shift) or "map" (a new area)
// Chunks cleared since the player last saw the map: each owes the next area its reveal. Kept on the device so it
// survives a reload between clearing a chunk and getting back to the map.
let mapMemory = { reveal: [] };
try {
  const saved = JSON.parse(localStorage.getItem("pool-panic.map.v1") || "{}");
  if (Array.isArray(saved.reveal)) mapMemory.reveal = saved.reveal.filter((n) => Number.isInteger(n));
} catch {}
function saveMapMemory() {
  try {
    localStorage.setItem("pool-panic.map.v1", JSON.stringify(mapMemory));
  } catch {}
}
// Per-device preferences. Coach Cam (the first-person view) is off by default.
let settings = { coachCam: false };
try {
  settings = { ...settings, ...JSON.parse(localStorage.getItem("pool-panic.settings.v1") || "{}") };
} catch {}
function saveSettings() {
  try {
    localStorage.setItem("pool-panic.settings.v1", JSON.stringify(settings));
  } catch {}
}
// Movement input in world space: screen-relative for the overview, view-relative in the Coach Cam.
function moveVector() {
  const v = input.vector();
  return world.viewMode === "coach" ? world.coachCam.movement(v.x, v.z) : screenMovement(v.x, v.z);
}
// Apply the chosen camera: the Coach Cam during shifts when enabled, the overview otherwise.
let handsToast = false;
function applyViewMode() {
  const coach = settings.coachCam && mode !== "menu" && !tuning.has("overview");
  world.setViewMode(coach ? "coach" : "overview", coach ? sim : null);
  crashlog.crumb("view", coach ? "Coach Cam" : "overview");
  if (coach && handsOff && !handsToast) {
    handsToast = true;
    toast("Coach Cam hands are off on this browser for now: they crashed Safari.");
  }
  input.lookMode = coach;
  document.body.classList.toggle("coach-cam", coach);
  if (!coach) sim.coach.lookAngle = null;
}
function releaseMouse() {
  if (document.pointerLockElement) document.exitPointerLock?.();
}
const STATION_NAMES = { fins: "Fin rack", chlorine: "Chlorine", relief: "Eye relief" };
const FIXTURE_NAMES = {
  fishNet: "Fish net",
  treats: "Dog treats",
  flashlight: "Flashlight",
  fuseBox: "Fuse box",
  medkit: "Medical kit",
};
// What the Coach Cam crosshair is on, in words.
function targetLabel(d) {
  if (d.kind === "swimmer") {
    const p = sim.get(d.id);
    if (!p) return "";
    if (p.status === "injured") return "Patch up " + p.name + " · click";
    return p.id === sim.selected ? p.name + " · selected" : "Select " + p.name + " · click";
  }
  if (d.kind === "lane")
    return "Lane " + (d.lane + 1) + (sim.get(sim.selected) ? " · click to send them here" : "");
  if (d.kind === "station") return STATION_NAMES[d.item] || "";
  if (d.kind === "lifering") return "Life ring";
  if (d.kind === "sanitation") return d.item === "skimmer" ? "Pool skimmer" : "Waste bin";
  if (d.kind === "fixture") return FIXTURE_NAMES[d.item] || "";
  if (d.kind === "visitor") {
    const v = sim.visitor?.(d.id);
    return v ? (v.kind === "dog" ? "The dog" : v.name || "Visitor") : "";
  }
  if (d.kind === "trampoline") return "Trampoline tower";
  if (d.kind === "clutter") return "Dropped gear · E";
  return "";
}
// Incident moments: stings, hit-stops and the loud alert. The first sighting of each incident is remembered per
// device, so its one-line lesson only shows once.
let seenIncidents = [];
try {
  seenIncidents = JSON.parse(localStorage.getItem("pool-panic.seen.v1") || "[]");
} catch {}
const moments = new MomentDirector({
  seen: Array.isArray(seenIncidents) ? seenIncidents : [],
  remember(list) {
    try {
      localStorage.setItem("pool-panic.seen.v1", JSON.stringify(list));
    } catch {}
  },
});
const seconds = () => performance.now() / 1000;
let stingAnimation = null,
  viewClock = 0,
  alertKey = "";
function showSting(sting) {
  if (!sting) return;
  const el = $("sting"),
    reduced = reducedMotion.matches,
    ms = sting.duration * 1000;
  el.className = "sting " + sting.tone + (sting.first ? " first" : "");
  el.querySelector(".sting-icon").textContent = sting.icon;
  el.querySelector(".sting-title").textContent = sting.title;
  el.querySelector(".sting-verb").textContent = sting.verb;
  el.querySelector(".sting-how").textContent = sting.how;
  el.hidden = false;
  document.body.classList.add("sting-on");
  world.focusMoment(sting.x, sting.z, Math.min(2, sting.duration));
  audio.sting(sting.kind, sting.first);
  stingAnimation?.cancel();
  // Slam in, hold, then fly up into the incident banner (which takes over from there).
  const rect = el.getBoundingClientRect(),
    rise = Math.round(118 - rect.top),
    at = (t) => Math.min(0.99, t / ms),
    frame = (y, scale, turn, opacity, offset) => ({
      transform: `translate(-50%, ${y}px) scale(${scale}) rotate(${turn}deg)`,
      opacity,
      offset,
    });
  stingAnimation = el.animate(
    reduced
      ? [
          { opacity: 0, transform: "translateX(-50%)" },
          { opacity: 1, transform: "translateX(-50%)", offset: at(150) },
          { opacity: 1, transform: "translateX(-50%)", offset: 1 - at(250) },
          { opacity: 0, transform: "translateX(-50%)" },
        ]
      : [
          frame(0, 1.75, -7, 0, 0),
          frame(0, 0.93, -1, 1, at(140)),
          frame(0, 1, -2, 1, at(230)),
          frame(0, 1, -2, 1, 1 - at(280)),
          frame(rise, 0.5, 0, 0, 1),
        ],
    { duration: ms, easing: "linear" },
  );
  stingAnimation.onfinish = () => {
    el.hidden = true;
    document.body.classList.remove("sting-on");
  };
}
function hideMoments() {
  stingAnimation?.cancel();
  $("sting").hidden = true;
  document.body.classList.remove("sting-on");
  $("alert-marker").hidden = $("alert-arrow").hidden = true;
  $("stamps").replaceChildren();
  alertKey = "";
}
// A save: hit-stop (in the director), confetti and a cheer, and a rubber stamp slammed onto the spot.
function showPayoff(pay) {
  if (!pay) return;
  const big = pay.tier > 1,
    reduced = reducedMotion.matches;
  audio.cheer(pay.tier);
  if (Number.isFinite(pay.x)) world.burst(pay.x, pay.z, big);
  if (big && !reduced) world.kick(0.12);
  // On the spot when it is in view; otherwise as close to it as the safe area allows (centre stage when it is
  // behind the Coach Cam).
  const p = world.screenPoint(pay.x ?? 0, 1.9, pay.z ?? 0),
    b = world.cameraBounds(),
    x = p.behind ? (b.left + b.right) / 2 : Math.max(b.left + 90, Math.min(b.right - 90, p.x)),
    y = p.behind ? (b.top + b.bottom) / 2 - 40 : Math.max(b.top + 70, Math.min(b.bottom - 40, p.y));
  const el = document.createElement("div"),
    title = document.createElement("span"),
    detail = document.createElement("small");
  el.className = `stamp tier${pay.tier} ${pay.kind}`;
  title.textContent = pay.stamp;
  detail.textContent = pay.value > 0 ? "+" + pay.value : pay.name;
  el.append(title, detail);
  el.style.left = x + "px";
  el.style.top = y + "px";
  $("stamps").appendChild(el);
  const ms = big ? 1500 : 1150,
    at = (s, turn, y = -50, opacity = 1, offset) => ({
      transform: `translate(-50%, ${y}%) scale(${s}) rotate(${turn}deg)`,
      opacity,
      offset,
    });
  el.animate(
    reduced
      ? [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }]
      : [
          at(2.4, -15, -50, 0, 0),
          at(0.92, -7, -50, 1, 0.1),
          at(1, -8, -50, 1, 0.16),
          at(1, -8, -50, 1, 0.8),
          at(0.9, -8, -95, 0, 1),
        ],
    { duration: ms, easing: "ease-out" },
  ).onfinish = () => el.remove();
}
// The loud alert: the most urgent problem gets a marker over its next target, or an arrow at the edge of the safe
// area when that target is off screen (or behind the Coach Cam).
function updateAlert() {
  const marker = $("alert-marker"),
    arrow = $("alert-arrow"),
    a = mode === "playing" ? sim.loudestAlert() : null;
  if (!a) {
    marker.hidden = arrow.hidden = true;
    alertKey = "";
    return;
  }
  const b = world.cameraBounds(),
    rect = { left: b.left + 28, right: b.right - 28, top: b.top + 28, bottom: b.bottom - 28 },
    p = world.screenPoint(a.x, a.y ?? 1.8, a.z),
    edge = edgeArrow(p, rect),
    far = Math.hypot(a.x - sim.coach.x, a.z - sim.coach.z),
    label = a.label + (far > 4 ? " · " + Math.round(far) + " m" : ""),
    tone = a.urgency >= 85 ? " danger" : "",
    key = [edge ? "edge" : "mark", a.icon, label, tone].join("|");
  marker.hidden = !!edge;
  arrow.hidden = !edge;
  const el = edge ? arrow : marker;
  if (key !== alertKey) {
    alertKey = key;
    el.querySelector("b").textContent = a.icon;
    el.querySelector("span:not(.alert-chip)").textContent = label;
  }
  if (edge) {
    // The label sits below the badge (above it on the bottom edge) and hugs the screen edge it is near.
    arrow.className =
      "alert-arrow" +
      tone +
      (Math.sin(edge.angle) > 0.6 ? " low" : "") +
      (edge.x > innerWidth - 110 ? " at-right" : edge.x < 110 ? " at-left" : "");
    arrow.style.left = edge.x + "px";
    arrow.style.top = edge.y + "px";
    arrow.style.setProperty("--angle", edge.angle + "rad");
  } else {
    // A person or visitor already wears a tag: the marker sits just above it rather than on top of it.
    const tag = a.id != null && bubbles.get(a.id),
      over = tag && !tag.hidden ? tag.getBoundingClientRect() : null;
    marker.className = "alert-marker" + tone;
    const half = marker.offsetWidth / 2 + 6;
    marker.style.left =
      Math.max(half, Math.min(innerWidth - half, over ? over.left + over.width / 2 : p.x)) + "px";
    marker.style.top = (over ? over.top - 4 : p.y) + "px";
  }
}
const bubbles = new Map();
let stationLabels = [];
let hudWasPlaying = false;
document.body.classList.add("menu");
function toast(text, warning = false) {
  $("toast").textContent = text;
  $("toast").className = "toast" + (warning ? " warning" : "");
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").hidden = true), 4200);
}
function saveRecords() {
  try {
    localStorage.setItem("pool-panic.records.v1", JSON.stringify(records));
  } catch {}
}

// ---- the story: the Ocean Fund and the cinematics ------------------------------------------------------------------
// Coach Panic is saving up to take Marina to the ocean (story.mjs). What was seen and earned lives on the device.
let story = normalizeStory();
try {
  story = normalizeStory(JSON.parse(localStorage.getItem(STORY.storageKey)));
} catch {}
function saveStory() {
  try {
    localStorage.setItem(STORY.storageKey, JSON.stringify(story));
  } catch {}
}
function renderFund(bump = false) {
  $("fund-now").textContent = money(Math.min(fundOf(story), STORY.goal));
  $("fund-goal").textContent = "/ " + money(STORY.goal);
  const pill = $("fund-pill");
  pill.setAttribute(
    "aria-label",
    `Ocean Fund: ${$("fund-now").textContent} of ${money(STORY.goal)}. Watch the story.`,
  );
  if (bump && !reducedMotion.matches) {
    pill.classList.remove("bump");
    void pill.offsetWidth;
    pill.classList.add("bump");
  }
}
// Play the intro or the ending. The intro's last scene shows the fund as it stands.
function playStory(kind, then = () => {}) {
  const dialog = $("cinematic");
  if (dialog.open) return;
  releaseMouse();
  const fund = money(fundOf(story)),
    scenes = (kind === "ending" ? ENDING : INTRO).map((p) => ({
      ...p,
      layers: p.layers.map((l) => (l.b ? { ...l, b: l.b.replace("{fund}", fund) } : l)),
    }));
  crashlog.crumb("story", kind);
  playCinematic(dialog, scenes, {
    labels: { last: kind === "ending" ? "Back to the pool ▶" : "Let's go! ▶" },
    done: (skipped) => {
      crashlog.crumb("story", kind + (skipped ? " skipped" : " finished"));
      then(skipped);
    },
  });
}
// The results' fund row: what this shift paid, the fund now, and Marina's text when a milestone was passed.
function showFundResult(pay, booked) {
  $("result-fund").hidden = false;
  $("result-fund-gain").textContent = pay.gained ? "+" + money(pay.gained) : "";
  $("result-fund-total").textContent = `${money(Math.min(pay.after, STORY.goal))} / ${money(STORY.goal)}`;
  const share = (n) => Math.min(100, (n / STORY.goal) * 100);
  const fill = $("result-fund-fill");
  fill.style.transition = "none";
  fill.style.width = share(pay.before) + "%";
  void fill.offsetWidth;
  fill.style.transition = "";
  fill.style.width = share(pay.after) + "%";
  const text = pay.texts[pay.texts.length - 1];
  $("result-fund-text").textContent = text
    ? `${STORY.love}: “${text.text}”`
    : pay.gained
      ? booked
        ? `${booked.name} pays ×${booked.payout}. Every shift gets the ocean closer.`
        : "Every shift gets the ocean closer."
      : `Shift pay ${money(pay.paid)}. Beat your best on this shift to add more.`;
  $("watch-ending").hidden = !story.ending; // once earned, the ending can be watched from any results
}

// ---- the crash hunt ------------------------------------------------------------------------------------------------
// ?trial plays one scripted shift (level 10 in the Coach Cam: Carl's cannonball, then the fish kid) with whatever
// switches the address carries; ?bisect runs the whole plan, one switch per test, reloading between tests and
// counting a test that never finished as a crash. Both leave the player idle: the incidents are the point.
const TRIAL_CAP = +params.get("trialsecs") || 100; // seconds of real time before a trial gives up waiting
// The hands crash came about 45 s into a Coach Cam shift, whatever was happening, so a hunt's test plays on until it is
// well past that (with the cap always the last word).
const TRIAL_MIN = huntStep ? Math.min(70, TRIAL_CAP - 5) : 0;
let trial = null;
function huntOverlay(html, { buttons = "" } = {}) {
  const box = $("hunt");
  box.hidden = false;
  box.innerHTML = html + buttons;
}
function huntLabel() {
  return huntStep
    ? `Crash hunt · test ${huntState.step + 1} of ${hunt.PLAN.length} · ${huntStep.label}`
    : "Trial · " + (tuning.list().join(" + ") || "everything on");
}
function showHuntResults() {
  const { lines, verdict } = hunt.summary(huntState),
    device = crashlog.session?.env?.ua || "";
  huntOverlay(
    `<strong>Crash hunt: ${hunt.finished(huntState) ? "done" : "results so far"}</strong><ul>` +
      lines.map((l) => `<li class="${l.outcome}"><span>${l.label}</span><b>${l.outcome}</b></li>`).join("") +
      `</ul><p>${verdict}</p>`,
    {
      buttons: `<button id="hunt-copy" class="primary">Copy results</button><button id="hunt-stop" class="secondary">Done</button>`,
    },
  );
  $("hunt-copy").onclick = async () => {
    $("hunt-copy").textContent = (await copyText(hunt.report(huntState, device)))
      ? "Copied ✓"
      : "Copy failed";
  };
  $("hunt-stop").onclick = () => {
    hunt.clear(crashStorage);
    location.href = location.pathname;
  };
}
function startTrial() {
  settings.coachCam = !tuning.has("overview"); // the trial's own choice, never saved
  $("coach-cam").checked = settings.coachCam;
  level = 10;
  selected = { kind: "level", level };
  start(null);
  trial = { phase: "carl", at: 0, began: performance.now() };
  huntOverlay(
    `<strong>${huntLabel()}</strong><p>Leave this tab open and do nothing. If the page closes or reloads, open the link again.</p>`,
  );
  crashlog.crumb("hunt", huntLabel());
  if (huntStep) {
    hunt.begin(huntState);
    hunt.save(crashStorage, huntState);
  }
  trial.timer = setInterval(trialTick, 250);
}
function trialTick() {
  if (!trial) return;
  if (mode === "results" || sim.status === "ended" || performance.now() - trial.began > TRIAL_CAP * 1000)
    return endTrial();
  if (mode !== "playing") return;
  const quiet = sim.time - trial.at > 6 && !sim.activeSystems().length;
  if (trial.phase === "carl" && sim.time >= 2 && sim.triggerChaos("carl")) {
    trial.phase = "carl-run";
    trial.at = sim.time;
    crashlog.crumb("hunt", "Carl");
  } else if (trial.phase === "carl-run" && quiet && sim.triggerChaos("fish")) {
    trial.phase = "fish-run";
    trial.at = sim.time;
    crashlog.crumb("hunt", "fish kid");
  } else if (trial.phase === "fish-run" && quiet && performance.now() - trial.began > TRIAL_MIN * 1000)
    endTrial();
}
function endTrial() {
  clearInterval(trial.timer);
  trial = null;
  crashlog.crumb("hunt", "survived");
  if (huntStep) {
    hunt.pass(huntState);
    hunt.save(crashStorage, huntState);
    huntOverlay(`<strong>${huntLabel()}</strong><p>Survived. Next test…</p>`);
    setTimeout(() => location.reload(), 900);
  } else {
    huntOverlay(`<strong>${huntLabel()}</strong><p>Survived: no crash in this trial.</p>`, {
      buttons: `<button id="hunt-stop" class="secondary">Close</button>`,
    });
    $("hunt-stop").onclick = () => ($("hunt").hidden = true);
  }
}

// ---- the crash log -------------------------------------------------------------------------------------------------
// What the game is doing, for the report: the shift, the venue, the view, what is going wrong right now.
let runSeed = 0; // the seed of the shift being played (the deck's schedule follows from it)
function logState() {
  if (!sim) return;
  crashlog.setState({
    mode,
    level: sim.level,
    shift: sim.config?.name,
    venue: sim.venue?.id,
    lighting: world?.lightingName,
    view: world?.viewMode,
    time: sim.time,
    score: sim.score,
    active: (sim.activeSystems?.() || []).map((x) => x.key).join("+"),
    booking: activeBooking || "",
    seed: mode === "menu" ? 0 : runSeed,
  });
}
// The player's deliberate actions go in the trail too: what they did just before something broke is often the clue.
const act = (what) => crashlog.crumb("input", what);
// A few numbers about how the GPU and the heap are doing, every ten seconds, so a crash report can show a trend.
function sampleLog() {
  const info = world?.renderer?.info,
    memory = performance.memory?.usedJSHeapSize;
  crashlog.perf({
    calls: info?.render.calls,
    tris: info && Math.round(info.render.triangles / 1000),
    geo: info?.memory.geometries,
    tex: info?.memory.textures,
    prog: info?.programs?.length,
    heapMB: memory && Math.round(memory / 1048576),
  });
}
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {}
  try {
    const box = document.createElement("textarea");
    box.value = text;
    box.style.cssText = "position:fixed;left:-999px;top:0";
    document.body.appendChild(box);
    box.select();
    const ok = document.execCommand("copy");
    box.remove();
    return ok;
  } catch {
    return false;
  }
}
// The crash dialog: what went wrong, and two ways to get the report to us (copy it, or open a prefilled GitHub
// issue). `live` is a shift that just hit an error and is paused.
let crashOn = null;
function showCrash(session, { live = false } = {}) {
  if (!session) return;
  crashOn = session;
  const dialog = $("crash-dialog"),
    troubled = session.errors.length || session.crash;
  dialog.classList.toggle("live", live);
  $("crash-eyebrow").textContent = live ? "THE POOL HIT A SNAG" : troubled ? "CRASH REPORT" : "GAME LOG";
  $("crash-title").textContent = live
    ? "Something went wrong."
    : troubled
      ? "The game had a problem last time."
      : "Nothing went wrong.";
  $("crash-summary").textContent = crashlog.headline(session, { latest: live });
  $("crash-detail").textContent = crashlog.preview(session, { latest: live });
  $("crash-copy").textContent = "Copy report";
  $("crash-issue").textContent = "Report on GitHub ↗";
  if (!dialog.open) dialog.showModal();
}
async function shareCrash(how) {
  if (!crashOn) return;
  const copied = await copyText(crashlog.report(crashOn));
  crashlog.mark(crashOn.id, "reported");
  if (how === "issue") {
    // The link carries a shortened report; the whole one is on the clipboard for the issue's text box.
    window.open(crashlog.issue(crashOn).url, "_blank", "noopener");
    $("crash-issue").textContent = copied ? "Opened · full report copied ✓" : "Opened ↗";
  } else $("crash-copy").textContent = copied ? "Copied ✓" : "Copy failed: select the text below";
}
// After an error the shift stays paused: the report first, then the pause menu (resume, restart).
function closeCrash() {
  const dialog = $("crash-dialog"),
    live = dialog.classList.contains("live");
  if (dialog.open) dialog.close();
  dialog.classList.remove("live");
  if (live && mode === "paused" && !$("pause-dialog").open) $("pause-dialog").showModal();
}
// Frames that threw, stage by stage: cosmetic stages (drawing, tags, alerts) are logged and skipped so the shift
// goes on; the simulation, or a stage that fails for a second and a half straight, stops the shift with the report.
const failing = {};
let snagged = false;
function stage(name, fn) {
  try {
    fn();
    if (failing[name]) failing[name] = 0;
    return true;
  } catch (e) {
    failing[name] = (failing[name] || 0) + 1;
    if (failing[name] === 1 || failing[name] % 300 === 0) console.error("Pool Panic frame error", name, e);
    crashlog.error("frame:" + name, e);
    return false;
  }
}
function snag() {
  if (snagged) return;
  snagged = true;
  const playing = ["playing", "countdown"].includes(mode);
  if (playing) {
    releaseMouse();
    resumeState = sim.status;
    input?.clear();
    sim.clearInput?.();
    accumulator = 0;
    sim.status = "paused";
    mode = "paused";
    audio.playing = false;
  }
  logState();
  crashlog.crumb("snag", playing ? "shift paused after an error" : "errors in the menu");
  toast("The pool hit a snag. The report is ready.", true);
  showCrash(crashlog.latest(), { live: playing });
}
function makeDemo() {
  const s = new PoolSimulation(level, 17467);
  [
    ["beginner", 0, 3],
    ["beginner", 0, 20],
    ["intermediate", 1, 9],
    ["intermediate", 1, 26],
    ["aqua", 2, 5],
  ].forEach(([type, lane, p]) => {
    const a = s.spawn({ type });
    a.status = "swim";
    a.lane = Math.min(lane + (s.lanes.length > 3 ? 1 : 0), s.lanes.length - 1);
    a.p = p;
    a.actualSpeed = TYPES[type].speed * 1.6;
    a.h = 95;
    const pos = loopPosition(p, s.lanes[a.lane]);
    a.x = pos.x;
    a.z = pos.z;
    a.angle = pos.angle;
  });
  const p = s.spawn({ type: "advanced" });
  Object.assign(p, s.venue.queuePosition(-1, 0));
  const q = s.spawn({ type: "beginner" });
  Object.assign(q, s.venue.queuePosition(1, 0));
  q.queasy = false;
  s.events = [];
  s.selected = null;
  syncVenue(s);
  return s;
}
// Rebuild the 3D world, lane buttons and station labels when a shift uses another venue or lighting mood.
let worldVersion = -1;
function syncVenue(s) {
  if (!world) return;
  const built = performance.now();
  world.setVenue(s.venue, s.config.lighting);
  if (worldVersion !== world.version) {
    crashlog.crumb(
      "world",
      "built " +
        s.venue.id +
        " · " +
        world.lightingName +
        " in " +
        Math.round(performance.now() - built) +
        " ms",
    );
    worldVersion = world.version;
    renderLaneControls(s.venue);
    for (const e of stationLabels) e.remove();
    stationLabels = world.labels.map((l) => {
      const e = document.createElement("div");
      e.className = "station-label";
      e.textContent = l.text;
      e.hidden = true;
      $("world-labels").appendChild(e);
      return e;
    });
    clearBubbles();
  }
}
function renderLaneControls(venue) {
  $("lane-controls").innerHTML =
    venue.lanes
      .map(
        (x, i) =>
          `<button class="lane-btn" data-lane="${i}" aria-label="Assign selected swimmer to lane ${i + 1}"><div class="lane-top"><span class="lane-no"><span class="lane-word">LANE </span>0${i + 1}</span><span class="lane-mode">OPEN</span></div><div class="lane-bottom"><span class="lane-count">Jump on in</span><span class="lane-caps"></span></div></button>`,
      )
      .join("") +
    (venue.trampoline
      ? `<button class="lane-btn trampoline-btn" data-lane="trampoline" aria-label="Send selected daredevil to the trampoline"><div class="lane-top"><span class="lane-no">🤸<span class="lane-word"> TRAMP</span></span><span class="lane-mode">READY</span></div><div class="lane-bottom"><span class="lane-count">Daredevils only</span><span class="lane-caps"></span></div></button>`
      : "");
  $("lane-controls").classList.toggle("five-lanes", venue.lanes.length > 3);
}
// Begin the shift the map has selected: a level (with a booking from Splash Park on) or a chunk's drill.
function start(bookingId = null) {
  audio.panic = false;
  clearTimeout(toastTimer);
  $("toast").hidden = true;
  input?.clear();
  accumulator = 0;
  document.activeElement?.blur();
  document.querySelectorAll("dialog[open]").forEach((d) => d.close());
  const drill = selected.kind === "drill" ? DRILLS[selected.id] : null;
  activeBooking = drill ? null : bookingId;
  runSeed = Date.now();
  sim = drill
    ? new PoolSimulation(drill.tier, runSeed, { config: drill.config, drill: drill.id })
    : new PoolSimulation(level, runSeed, { booking: activeBooking });
  syncVenue(sim);
  world.resetActors();
  sim.start({ countdown: true });
  mode = "countdown";
  snagged = false;
  for (const k of Object.keys(failing)) failing[k] = 0;
  moments.reset();
  hideMoments();
  applyViewMode();
  audio.init();
  audio.playing = true;
  document.body.classList.remove("menu");
  $("welcome").hidden = true;
  $("countdown").hidden = false;
  $("countdown-number").textContent = "3";
  $("countdown-shift").textContent = sim.config.name;
  $("queue-panel").hidden = false;
  $("pause").disabled = false;
  queueKey = "";
  clearBubbles();
  updateUI();
  logState();
  crashlog.crumb(
    "shift",
    "start L" +
      sim.level +
      " " +
      (sim.config?.name || "") +
      " · " +
      sim.venue.id +
      " · seed " +
      runSeed +
      (activeBooking ? " · booking " + activeBooking : ""),
  );
}
function returnMenu() {
  releaseMouse();
  snagged = false;
  crashlog.crumb("menu", "back to the map");
  audio.panic = false;
  input?.clear();
  accumulator = 0;
  document.querySelectorAll("dialog[open]").forEach((d) => d.close());
  mode = "menu";
  moments.reset();
  hideMoments();
  applyViewMode();
  $("countdown").hidden = true;
  audio.playing = true;
  // Back on the map with the level that was just unlocked selected; an area that just opened plays its reveal.
  if (afterResults) {
    level = afterResults;
    selected = { kind: "level", level };
    afterResults = null;
  }
  const reveal = mapMemory.reveal.splice(0);
  if (reveal.length) saveMapMemory();
  sim = makeDemo();
  logState();
  $("welcome").hidden = false;
  $("queue-panel").hidden = true;
  $("combo").hidden = true;
  $("closure").hidden = true;
  $("toast").hidden = true;
  document.body.classList.add("menu");
  clearBubbles();
  updateMenu(reveal);
  updateUI();
  $("start").focus({ preventScroll: true });
}
const two = (n) => String(n).padStart(2, "0");
const starText = (n) => Array.from({ length: 3 }, (_, i) => (i < n ? "★" : "☆")).join("");
const pipsHtml = (on, total) =>
  Array.from({ length: total }, (_, i) => `<i class="${i < on ? "on" : ""}" style="--k:${i}"></i>`).join("");
function selectLevel(n) {
  level = n;
  selected = { kind: "level", level: n };
  updateMenu();
}
function selectDrill(id) {
  selected = { kind: "drill", id };
  updateMenu();
}
// Tapping an act's tab selects the level you would play next in it, so the panel always shows what is on screen.
function selectAct(actId) {
  const nodes = CAMPAIGN.find((a) => a.id === actId)
      .zones.flatMap((z) => z.nodes)
      .filter((n) => n.built),
    playable = nodes.filter((n) => levelState(records, n, progressFlags) !== "locked"),
    target =
      playable.find((n) => levelState(records, n, progressFlags) !== "cleared") ||
      playable[playable.length - 1];
  if (target && !(selected.kind === "level" && selected.level === target.level)) selectLevel(target.level);
}
function updateMenu(reveal = []) {
  mapView?.update({ records, flags: progressFlags, selected, reveal });
  updatePanel();
}
// The panel under the map: the selected level (or drill), where its chunk stands, its stars and best score.
function updatePanel() {
  const num = $("panel-num"),
    icons = $("selected-shift-icons");
  if (selected.kind === "drill") {
    const drill = DRILLS[selected.id],
      zone = ZONES.find((z) => z.drill?.id === drill.id),
      c = drill.config,
      best = records.drills[drill.id] || 0;
    num.textContent = drill.icon;
    $("selected-shift-name").textContent = drill.name;
    $("selected-shift-meta").textContent = `DRILL · ${formatTime(c.duration)} · ${c.total} SWIMMERS`;
    icons.textContent = "";
    icons.removeAttribute("aria-label");
    $("panel-zone").textContent = zone.name.toUpperCase();
    $("panel-pips").innerHTML = "";
    $("panel-stars").textContent = starText(starsForDrill(drill.id, best));
    $("best-score").textContent = best
      ? "BEST · " + best.toLocaleString()
      : c.thresholds[0].toLocaleString() + " FOR ★";
  } else {
    const shift = SHIFTS[level - 1],
      zone = zoneOfLevel(level),
      status = zoneStatus(records, zone, progressFlags),
      best = records.bests[level - 1] || 0,
      notes = shiftHighlights(shift);
    num.textContent = two(level);
    $("selected-shift-name").textContent = shift.name;
    $("selected-shift-meta").textContent = `${formatTime(shift.duration)} · ${shift.total} SWIMMERS`;
    icons.textContent = notes.map((n) => n.icon).join("");
    icons.setAttribute("aria-label", notes.map((n) => n.label).join(", "));
    icons.title = notes.map((n) => n.label).join(" · ");
    $("panel-zone").textContent = zone.kind === "finale" ? `ACT ${zone.act} FINALE` : zone.name.toUpperCase();
    $("panel-pips").innerHTML = pipsHtml(status.cleared, zone.nodes.length);
    $("panel-stars").textContent = starText(starsFor(level, best));
    $("best-score").textContent = best ? "BEST · " + best.toLocaleString() : "NO SCORE YET";
  }
  num.classList.toggle("emoji", selected.kind === "drill");
  icons.hidden = selected.kind === "drill" || !icons.textContent;
}
// From Splash Park on, the club offers three bookings before a shift: a bigger payout always means more trouble.
function requestStart() {
  const shift = selected.kind === "level" ? SHIFTS[level - 1] : null,
    offer = shift ? offerBookings(level, 0, shift) : [];
  if (!offer.length) return start();
  $("booking-shift").textContent = shift.name.toUpperCase();
  $("booking-cards").innerHTML = offer
    .map(
      (b) =>
        `<button class="booking-card${b.id === "regular" ? " regular" : ""}" data-booking="${b.id}" aria-label="${b.name}, payout ×${b.payout}. ${b.note}"><span class="b-icon" aria-hidden="true">${b.icon}</span><strong>${b.name}</strong><span class="b-pay">×${b.payout}<small>PAYOUT</small></span><span class="b-note">${b.note}</span><span class="b-trouble" aria-hidden="true">${b.trouble.join(" ")}</span></button>`,
    )
    .join("");
  $("booking-dialog").showModal();
  $("booking-cards").firstElementChild.focus();
}
// HUD line: which chunk of three you are in ("WARM-UP · 2 OF 3"), or that this is a drill.
function shiftTag() {
  if (sim.drill) return "DRILL";
  const zone = zoneOfLevel(sim.level);
  if (!zone) return "";
  return zone.kind === "finale"
    ? `ACT ${zone.act} · FINALE`
    : `${zone.name.toUpperCase()} · ${zone.nodes.findIndex((n) => n.level === sim.level) + 1} OF ${zone.nodes.length}`;
}

function pause() {
  if (!["playing", "countdown"].includes(mode)) return;
  releaseMouse();
  resumeState = sim.status;
  input.clear();
  sim.clearInput();
  accumulator = 0;
  sim.status = "paused";
  mode = "paused";
  audio.playing = false;
  $("pause-dialog").showModal();
  logState();
  crashlog.crumb("pause", "at " + Math.round(sim.time) + " s");
}
function resume() {
  if (mode !== "paused") return;
  $("pause-dialog").close();
  sim.status = resumeState;
  mode = resumeState;
  audio.playing = mode === "playing";
  logState();
  crashlog.crumb("resume", "");
}
function showHelp() {
  if ($("help-dialog").open) return;
  releaseMouse();
  pausedByHelp = ["playing", "countdown"].includes(mode);
  if (pausedByHelp) {
    helpResumeState = sim.status;
    input.clear();
    sim.clearInput();
    accumulator = 0;
    sim.status = "paused";
    audio.playing = false;
    mode = "help";
  }
  $("help-dialog").showModal();
}
function closeHelp() {
  if ($("help-dialog").open) $("help-dialog").close();
  if (pausedByHelp) {
    sim.status = helpResumeState;
    mode = helpResumeState;
    audio.playing = mode === "playing";
  }
  pausedByHelp = false;
}
function pick(data) {
  if (mode === "menu") {
    toast("Start your shift to open the doors.");
    return;
  }
  if (mode !== "playing") return;
  act(
    "pick " +
      [data.kind, data.item, data.id != null && "#" + data.id, data.lane != null && "lane " + data.lane]
        .filter(Boolean)
        .join(" "),
  );
  if (data.kind === "swimmer") {
    const p = sim.get(data.id),
      item = sim.coach.carry;
    if (p?.status === "injured") sim.tendInjured(data.id);
    else {
      sim.select(data.id);
      if (
        p &&
        ((item === "fins" && p.needsFins && !p.hasFins) ||
          (item === "relief" && p.problem === "eyes") ||
          (item === "goggles" && p.problem === "goggles"))
      )
        sim.deliver(data.id);
    }
    queueKey = "";
  } else if (data.kind === "lane") sim.assign(data.lane);
  else if (data.kind === "trampoline") sim.assignTrampoline();
  else if (data.kind === "fixture") sim.useFixture(data.item);
  else if (data.kind === "visitor") sim.approachVisitor(data.id);
  else if (data.kind === "sanitation") {
    if (data.item === "skimmer") sim.coach.carry === "skimmer" ? sim.returnItem() : sim.fetch("skimmer");
    else sim.disposeWaste();
  } else if (data.kind === "lifering")
    sim.coach.carry === "lifering" ? sim.returnItem() : sim.fetch("lifering", data.ringId);
  else if (data.kind === "station") sim.fetch(data.item);
  else if (data.kind === "clutter") sim.pickup(data.id);
  updateUI();
}

function finish() {
  releaseMouse();
  input.clear();
  sim.clearInput();
  accumulator = 0;
  mode = "results";
  audio.playing = false;
  logState();
  crashlog.crumb("shift", "ended · score " + Math.round(sim.score));
  const r = sim.summary(),
    drill = sim.drill ? DRILLS[sim.drill] : null,
    played = sim.level,
    zone = drill ? null : zoneOfLevel(played),
    before = zone && zoneStatus(records, zone, progressFlags),
    starsBefore = drill ? 0 : starsFor(played, records.bests[played - 1] || 0),
    newBest = drill ? recordDrill(records, drill.id, r.score) : recordResult(records, played, r.score),
    after = zone && zoneStatus(records, zone, progressFlags);
  saveRecords();
  // A chunk just cleared wakes the next area: the map plays its reveal, and this dialog's main button goes there.
  const chunkDone = !!zone && !before.complete && after.complete,
    next = chunkDone ? ZONES[zone.order + 1] : null,
    opensArea = !!next && next.nodes.some((n) => n.built);
  if (opensArea) {
    if (!mapMemory.reveal.includes(next.order)) mapMemory.reveal.push(next.order);
    saveMapMemory();
  }
  afterResults = !drill && starsBefore === 0 && r.stars > 0 && played < SHIFTS.length ? played + 1 : null;
  nextMode = opensArea ? "map" : "level";
  const booked = sim.booking && sim.booking !== "regular" ? BOOKINGS[sim.booking] : null;
  $("result-eyebrow").textContent = drill
    ? "DRILL · " + drill.name.toUpperCase() + " · COMPLETE"
    : "LEVEL " +
      played +
      " · " +
      sim.config.name.toUpperCase() +
      (booked ? " · " + booked.name.toUpperCase() : "") +
      " · SHIFT COMPLETE";
  $("result-stars").textContent = Array.from({ length: 3 }, (_, i) => (i < r.stars ? "★" : "☆")).join(" ");
  $("result-title").textContent =
    r.stars === 3
      ? "You absolute pool legend."
      : r.stars === 2
        ? "So close to pool perfection."
        : r.stars === 1
          ? "You kept your head above water."
          : "Okay. Deep breath. Again.";
  $("result-score").innerHTML = r.score.toLocaleString() + "<small>POINTS</small>";
  $("new-best").hidden = !newBest;
  const pay = recordPay(
    story,
    drill ? "drill:" + drill.id : String(played),
    shiftPay(r.stars, booked ? booked.payout : 1),
  );
  if (pay.reached) story.ending = true;
  if (pay.gained || pay.reached) saveStory();
  showFundResult(pay, booked);
  renderFund(pay.gained > 0);
  // Where the chunk stands: three dots, so the next new place is never more than three shifts away.
  $("result-chunk").hidden = !zone;
  if (zone) {
    const name = zone.kind === "finale" ? `ACT ${zone.act}` : zone.name.toUpperCase(),
      following = ZONES[zone.order + 1],
      opens = following?.nodes.some((n) => n.built)
        ? (following.act === zone.act ? following.name : CAMPAIGN[following.act - 1].name).toUpperCase()
        : "",
      drillNote = chunkDone && zone.drill ? drillStatus(records, zone, progressFlags) : null,
      notes = [];
    if (starsBefore === 0 && r.stars === 0 && !after.complete) notes.push("EARN A ★ TO CLEAR IT");
    else if (after.complete) {
      notes.push(opens ? opens + " OPENS" : "SEASON COMPLETE 🏆"); // the last finale has nothing after it
    } else if (after.built === after.total && opens)
      notes.push(`${after.total - after.cleared} MORE TO OPEN ${opens}`);
    if (drillNote)
      notes.push(
        drillNote.unlocked
          ? `${zone.drill.icon} DRILL OPEN`
          : `${drillNote.have}/${drillNote.need} ★ FOR THE ${zone.drill.icon} DRILL`,
      );
    $("result-chunk").classList.toggle("cleared", after.complete);
    $("result-pips").innerHTML = pipsHtml(after.cleared, zone.nodes.length);
    $("result-chunk-text").textContent =
      zone.kind === "finale"
        ? after.complete
          ? `${name} COMPLETE`
          : `${name} FINALE`
        : after.complete
          ? `${name} CLEARED`
          : `${name} · ${after.cleared} OF ${after.total}`;
    $("result-chunk-note").textContent = notes.join(" · ");
  }
  const st = sim.stats,
    extra = [
      ["VIPS 👑", st.vips],
      ["FLIPS 🤸", st.flips],
      ["CRASHES 💥", st.crashes],
      ["PATCHED UP 🩹", st.healed],
      ["SAVES ✋", st.prevented],
      ["CANNONBALLS 💣", st.cannonballs],
      ["BLACKOUTS ⚡", st.blackouts],
    ].filter(([, v]) => v > 0);
  $("result-stats").innerHTML = [
    ["SERVED", r.served],
    ["HAPPY", r.happy],
    ["LOST", r.lost],
    ["AVG. WAIT", Math.round(r.avgWait) + "s"],
    ["AVG. MOOD", Math.round(r.avgHappiness) + "%"],
    ["BEST STREAK", r.bestStreak],
    ...extra.slice(0, 3),
  ]
    .map(([label, v]) => "<div><strong>" + v + "</strong><small>" + label + "</small></div>")
    .join("");
  $("result-tip").textContent = r.catastrophes
    ? "A queasy customer cost you the pool. Next time, catch the warning signs before they get in."
    : st.crashes
      ? "Crashes hurt. When a daredevil waits on the tower, select the swimmers in the splash lane and move them to another lane."
      : st.blackouts
        ? "When the lights flicker, sprint to the fuse box. A quick reset stops the blackout."
        : st.cannonballs > 1
          ? "Carl hits the deck running. Meet him before the edge and show him the red card."
          : r.collisions > 2
            ? "Traffic was your biggest troublemaker. Pair similar speeds and keep aqua out of fast lanes."
            : r.lost > 3
              ? "The deck queue needs some love. Assign waiting swimmers quickly, even if a lane is not perfect."
              : r.stars === 3
                ? drill
                  ? "Three stars! Try the next chunk, or beat this run with an even longer happy streak."
                  : "Three stars! Try the next shift, or beat this run with an even longer happy streak."
                : "A new arrival mix awaits. Can you keep the happy streak going just a little longer?";
  $("next-level").hidden = drill
    ? true
    : nextMode === "level" && (played >= SHIFTS.length || !isUnlocked(records, played + 1));
  $("next-level").textContent =
    nextMode === "map" ? "Next area ↗" : "Next shift · Level " + (played + 1) + " →";
  $("play-again").textContent = drill ? "Replay drill ↻" : "Replay level " + played + " ↻";
  $("play-again").className = $("next-level").hidden ? "primary" : "secondary";
  $("results-dialog").showModal();
  ($("next-level").hidden ? $("play-again") : $("next-level")).focus();
  if (r.stars > 0) world.confetti();
  if (chunkDone) audio.cheer(2); // a chunk cleared is worth a crowd cheer of its own
}
const CARRY_NAMES = {
  lifering: "life ring",
  relief: "eye relief",
  treats: "dog treats",
  flashlight: "flashlight",
  medkit: "medical kit",
};
function carryName(c) {
  if (c.carry === "skimmer") return c.skimmerLoaded ? "loaded skimmer" : "pool skimmer";
  if (c.carry === "fishnet") return c.netLoaded ? "net with the fish 🐟" : "fish net";
  return CARRY_NAMES[c.carry] || c.carry;
}
function moodColor(h) {
  return h > 70 ? "#73b65b" : h > 40 ? "#e6b445" : "#eb7754";
}
function problemIcon(p) {
  if (p.problem === "injured") return "🤕";
  if (p.status === "trampoline") return p.jumpStage === "waiting" && p.jumpPatience < 5 ? "😤" : "🤸";
  if (p.status === "switch") return "↔️";
  if (p.annoyedTime > 0) return "😠";
  if (sim.rescue && p.status === "swim" && p.problem !== "cramp") return "😱";
  if (p.stomachWarning) return "💩";
  if (p.status === "panic" || p.status === "evacuating" || p.status === "fleeing") return "😱";
  if (p.status === "queue" && sim.fish?.stage === "loose") return "😱";
  return p.problem === "fins"
    ? "🦶"
    : p.problem === "eyes"
      ? "👁️🔥"
      : p.problem === "goggles"
        ? "🥽"
        : p.problem === "cramp"
          ? "🦵"
          : p.queasy && (p.status === "queue" || p.sicknessTimer < 9)
            ? "🤢"
            : p.blocked > 2
              ? "💢"
              : p.h < 30
                ? "😡"
                : p.h < 60
                  ? "😐"
                  : p.status === "queue"
                    ? swimmerLook(p).icon
                    : "🙂";
}
function cardStatus(p) {
  if (p.status === "queue")
    return p.type === "daredevil" ? "Daredevil · wants the trampoline" : swimmerLook(p).label;
  if (p.status === "injured") return p.healing ? "Being bandaged…" : "Hurt · needs the med kit";
  const where = p.lane == null ? "In the pool" : "Lane " + (p.lane + 1);
  return (
    where +
    " · " +
    (p.stomachWarning
      ? "Stomach trouble"
      : p.problem === "injured"
        ? "Hurt · needs a ring"
        : p.problem === "fins"
          ? "Needs fins"
          : p.problem === "eyes"
            ? "Sore eyes"
            : p.problem === "cramp"
              ? "Cramp"
              : "Lost goggles")
  );
}
function formatTime(t) {
  const s = Math.max(0, Math.ceil(t));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}
function updateQueue() {
  const waiting = sim.people.filter((p) => p.status === "queue"),
    problems = sim.people.filter(
      (p) => (p.status === "swim" && (p.problem || p.stomachWarning)) || p.status === "injured",
    );
  $("queue-count").textContent = waiting.length + " waiting";
  // Swimmers who need the coach come first so a long queue never hides them.
  const list = [...problems, ...waiting];
  const guide = guidanceState(sim);
  const key =
    list.map((p) => p.id + ":" + p.problem + ":" + p.stomachWarning).join(",") +
    "|" +
    sim.selected +
    "|" +
    guide.swimmerId;
  if (key !== queueKey) {
    queueKey = key;
    $("queue").innerHTML = list.length
      ? list
          .map(
            (p) =>
              `<button class="swimmer-card ${p.id === sim.selected ? "selected" : ""} ${p.id === guide.swimmerId ? "guided" : ""}" data-swimmer="${p.id}" aria-label="Select ${p.name}, ${swimmerLook(p).label}${p.problem ? ", needs help" : ""}"><span class="portrait ${p.queasy ? "queasy" : ""}" style="background:${swimmerLook(p).color}">${swimmerLook(p).icon}</span><span class="card-info"><strong>${p.name}</strong><small>${cardStatus(p)}</small><span class="patience-track"><i data-hp="${p.id}"></i></span></span><span class="need-icon" data-need="${p.id}"></span></button>`,
          )
          .join("")
      : '<div class="empty-queue"><span>✓</span> All in the swim.</div>';
  }
  for (const p of list) {
    const hp = document.querySelector('[data-hp="' + p.id + '"]');
    if (hp) {
      hp.style.width = Math.max(0, p.h) + "%";
      hp.style.background = moodColor(p.h);
    }
    const need = document.querySelector('[data-need="' + p.id + '"]');
    if (need)
      need.textContent = p.stomachWarning
        ? "💩"
        : p.queasy && Math.sin(sim.time * 2) > -0.4
          ? "🤢"
          : p.problem
            ? problemIcon(p)
            : p.needsFins && !p.hasFins
              ? "🦶"
              : "";
  }
  const p = sim.get(sim.selected);
  $("send-home").textContent = p?.stomachWarning ? "Send to locker ↗" : "Send home ↗";
  $("send-home").classList.toggle("urgent", !!p?.stomachWarning);
  $("selected-detail").hidden = !p;
  $("send-home").hidden =
    !p ||
    !["queue", "enter", "swim"].includes(p.status) ||
    p.problem === "injured" ||
    !!(sim.rescue && p.status === "swim");
  if (p) {
    const profile = swimmerLook(p);
    $("selected-detail").innerHTML =
      "<b>" +
      p.name +
      " · " +
      profile.label +
      "</b><span>" +
      Math.round(p.h) +
      "% happy · " +
      (p.type === "daredevil"
        ? "Trampoline only · T"
        : p.status === "swim" && !p.problem
          ? "Pick a lane to move them"
          : profile.speed
            ? profile.speed + "× pace"
            : "Aqua class") +
      "</span>";
  }
}
function updateUI() {
  if (!sim) return;
  document.body.classList.toggle("pool-incident", !!sim.cleanup || !!sim.rescue);
  $("countdown").hidden = mode !== "countdown";
  if (mode === "countdown") $("countdown-number").textContent = Math.max(1, Math.ceil(sim.countdown));
  $("score").textContent = String(sim.score).padStart(4, "0");
  const remaining = sim.config.duration - (mode === "menu" ? 0 : sim.time);
  $("timer").textContent = formatTime(remaining);
  $("timer").classList.toggle("danger-pulse", remaining < 20 && mode === "playing");
  $("shift-label").textContent = sim.config.name.toUpperCase();
  $("level-progress").textContent = shiftTag();
  const n = sim.config.thresholds.filter((t) => sim.score >= t).length;
  $("stars").textContent = Array.from({ length: 3 }, (_, i) => (i < n ? "★" : "☆")).join(" ");
  $("score-fill").style.width =
    Math.min(100, (Math.max(0, sim.score) / sim.config.thresholds[2]) * 100) + "%";
  $("next-star").textContent =
    n >= 3
      ? "THREE-STAR COACH"
      : Math.max(0, sim.config.thresholds[n] - sim.score).toLocaleString() +
        " TO " +
        (n === 0 ? "FIRST" : n === 1 ? "SECOND" : "THIRD") +
        " STAR";
  $("clarity").textContent = Math.round(100 - sim.contamination) + "%";
  $("water-fill").style.width = 100 - sim.contamination + "%";
  $("water-fill").style.background = sim.contamination > 55 ? "#9dba59" : "#48b3b5";
  $("water-label").textContent =
    sim.contamination > 75
      ? "MURKY"
      : sim.contamination > 45
        ? "CLOUDY"
        : sim.contamination > 20
          ? "GOOD"
          : "SPARKLING";
  $("chlorine-label").textContent =
    Math.round(sim.chlorine) +
    (sim.chlorine > 75 ? " · Too high!" : sim.chlorine < 40 ? " · Low" : " · Balanced");
  $("chlorine-label").style.color = sim.chlorine > 75 ? "#c36340" : "";
  $("chlorine-dot").style.left = Math.min(98, sim.chlorine / 1.1) + "%";
  $("fin-count").textContent = sim.finsAvailable;
  $("carry").textContent = sim.coach.job
    ? sim.coach.state
    : sim.coach.carry
      ? "Holding " + carryName(sim.coach)
      : "Empty hands";
  $("return-item").hidden = !sim.coach.carry || !!sim.coach.job;
  ["fins", "chlorine", "relief"].forEach((item) => {
    $(item).classList.toggle("busy-btn", sim.coach.carry === item || sim.coach.job?.item === item);
    $(item).disabled = mode !== "playing" || !!sim.coach.carry;
  });
  $("clean").disabled = mode !== "playing" || !!sim.coach.job || !!sim.coach.carry;
  $("clean").classList.toggle("busy-btn", sim.clutter.length > 0);
  $("assist").disabled = mode !== "playing";
  $("assist").querySelector(".interact-label").textContent = sim.nearestInteraction()?.label || "Interact";
  $("pause").disabled = !["playing", "countdown"].includes(mode);
  const p = sim.get(sim.selected),
    blocked = sim.laneBlocked(),
    moving = p?.status === "swim" && !p.problem ? p : null;
  for (let i = 0; i < sim.lanes.length; i++) {
    const people = sim.lanePeople(i),
      count = sim.occupancy(i),
      average = people.length ? people.reduce((sum, p) => sum + p.h, 0) / people.length : 100;
    const b = document.querySelector('[data-lane="' + i + '"]');
    if (!b) continue;
    const splash = i === blocked,
      closed = i === sim.laneClosed(),
      moveHere = !!moving && moving.lane !== i && !splash && !closed;
    b.classList.toggle(
      "assignable",
      mode === "playing" &&
        !sim.closed &&
        !sim.rescue &&
        !splash &&
        !closed &&
        ((p?.status === "queue" && p.type !== "daredevil") || sim.coach.carry === "chlorine" || moveHere),
    );
    b.classList.toggle("splash-zone", splash);
    b.classList.toggle("lane-closed", closed);
    b.classList.toggle("danger", average < 50 || people.some((p) => p.blocked > 3));
    b.querySelector(".lane-mode").textContent = closed
      ? "CLOSED"
      : splash
        ? "SPLASH!"
        : moveHere
          ? "MOVE HERE"
          : count === 0
            ? "OPEN"
            : count === 1
              ? "SOLO"
              : count === 2
                ? "SPLIT"
                : "CIRCLE";
    b.querySelector(".lane-count").textContent = closed
      ? "Wet floor"
      : splash
        ? count
          ? "Clear this lane!"
          : "Flip incoming"
        : count === 0
          ? "Jump on in"
          : count + " swimmer" + (count === 1 ? "" : "s");
    b.querySelector(".lane-caps").innerHTML = people
      .slice(0, 8)
      .map((p) => '<i style="background:' + swimmerLook(p).color + '"></i>')
      .join("");
    b.disabled = mode !== "playing" || !!sim.rescue;
  }
  updateTrampolineButton(p);
  const chaos = sim.people.filter(
    (p) => p.status === "swim" && (p.h < 50 || p.problem || p.blocked > 3),
  ).length;
  const count = sim.people.filter((p) => p.status === "queue").length;
  $("pool-status").textContent =
    mode === "menu"
      ? "A good day for a dip."
      : sim.rescue?.kind === "crash"
        ? "CRASH! Rings, then first aid."
        : sim.rescue
          ? "Rescue in progress · hold your lanes."
          : sim.people.some((p) => p.status === "injured")
            ? "Swimmers hurt on deck · med kit!"
            : sim.fish?.stage === "loose"
              ? "Fish in the pool · clock held."
              : sim.closed
                ? "Cleanup in progress · clock held."
                : sim.outage?.stage === "dark"
                  ? "Blackout! Lanes are bumping."
                  : sim.outage?.stage === "flicker"
                    ? "The lights are flickering…"
                    : sim.fish?.stage === "approach"
                      ? "Is that kid carrying a FISH?"
                      : sim.carl
                        ? "Carl is loose. Brace for splash."
                        : sim.dog && sim.dog.stage !== "leaving"
                          ? "There’s a dog on the deck!"
                          : sim.get(sim.jumper)?.jumpStage === "waiting"
                            ? "A daredevil is waiting on the tower."
                            : sim.laneClosed() >= 0
                              ? "Lane " + (sim.laneClosed() + 1) + " is closed · wet floor."
                              : chaos > 3
                                ? "Keep calm. Mostly calm."
                                : chaos > 0
                                  ? "Someone needs a little love."
                                  : sim.streak >= 3
                                    ? "Now we’re in the swim of it."
                                    : count > 3
                                      ? "The deck is getting crowded."
                                      : "Looking good, coach.";
  $("hint").textContent =
    sim.incidentHint() ||
    (sim.coach.carry === "skimmer"
      ? sim.coach.skimmerLoaded
        ? "WASTE BIN · E TO EMPTY"
        : "POOL EDGE · E TO SCOOP"
      : sim.coach.carry === "chlorine"
        ? "WALK TO THE POOL EDGE · E TO POUR"
        : sim.coach.carry === "fins"
          ? "NEAR SWIMMER · E TO GIVE / ELSE E TO DROP"
          : sim.coach.carry
            ? "MEET YOUR SWIMMER · E TO HAND OVER"
            : sim.cleanup
              ? sim.sanitationHint().toUpperCase()
              : p?.status === "queue"
                ? "● ● ●"
                : sim.clutter.length
                  ? "PICK UP DROPPED GEAR · E"
                  : "WASD MOVE · SHIFT DASH · SPACE JUMP");
  $("combo").hidden = !!sim.cleanup || sim.streak < 2 || mode === "menu";
  if (sim.streak >= 2) {
    $("combo-text").textContent =
      sim.streak + " HAPPY IN A ROW" + (sim.multiplier() > 1 ? " · ×" + sim.multiplier().toFixed(1) : "");
    $("combo-sub").textContent =
      sim.streak < 3
        ? "One more for a score multiplier!"
        : sim.streak < 5
          ? "Five happy swimmers unlock ×1.5"
          : sim.streak < 8
            ? "Eight happy swimmers unlock ×2"
            : "Peak pool energy. Keep it going.";
  }
  renderIncidentPanel(sim.cleanup ? sanitationPanel() : sim.incidentPanel());
  audio.panic = mode !== "menu" && sim.chaosPanic();
  audio.urgency = Math.min(1, (chaos + count) / 10);
  if (mode !== "menu") updateQueue();
}
function updateTrampolineButton(p) {
  const b = document.querySelector('[data-lane="trampoline"]'),
    tr = sim.venue.trampoline;
  if (!b || !tr) return;
  const j = sim.get(sim.jumper),
    waiting = sim.people.filter((q) => q.status === "queue" && q.type === "daredevil").length;
  b.classList.toggle(
    "assignable",
    mode === "playing" && !sim.rescue && !sim.closed && !j && p?.status === "queue" && p.type === "daredevil",
  );
  b.classList.toggle("danger", j?.jumpStage === "waiting" && j.jumpPatience < 5);
  b.querySelector(".lane-mode").textContent =
    sim.rescue?.kind === "crash"
      ? "CRASH!"
      : !j
        ? "READY"
        : j.jumpStage === "toStairs"
          ? "WALKING"
          : j.jumpStage === "waiting"
            ? Math.ceil(j.jumpPatience) + "s"
            : "FLIP!";
  b.querySelector(".lane-count").textContent = j
    ? j.jumpStage === "waiting"
      ? "Clear lane " + (tr.lane + 1) + "!"
      : j.name + " on the tower"
    : waiting
      ? waiting + " daredevil" + (waiting === 1 ? "" : "s") + " waiting"
      : "Daredevils only";
  b.disabled = mode !== "playing" || !!sim.rescue;
}
function sanitationPanel() {
  const order = ["floating", "caught", "return", "treat"],
    stage = order.indexOf(sim.cleanup.stage);
  return {
    icon: "💩",
    title: ["EVERYBODY OUT!", "TO THE WASTE BIN!", "RETURN THE SKIMMER", "BALANCE THE WATER"][stage],
    task: sim.sanitationHint(),
    steps: ["SKIM", "BIN", "HANG", "CHLORINE"].map((label, i) => ({
      label: i + 1 + " · " + label,
      active: i === stage,
      done: i < stage,
    })),
  };
}
let panelKey = "";
function renderIncidentPanel(panel) {
  $("closure").hidden = !panel || mode === "menu";
  if (!panel) return;
  $("closure").firstElementChild.textContent = panel.icon;
  $("closure-title").textContent = panel.title;
  $("closure-task").textContent = panel.task || "";
  // Timed threats drain a fuse on the banner.
  const timer = document.querySelector(".closure-timer"),
    left = Number.isFinite(panel.timer) ? Math.max(0, Math.min(1, panel.timer)) : null;
  timer.hidden = left === null;
  if (left !== null) {
    timer.firstElementChild.style.width = left * 100 + "%";
    timer.classList.toggle("low", left < 0.35);
  }
  const key = JSON.stringify(panel.steps || []);
  if (key !== panelKey) {
    panelKey = key;
    const steps = document.querySelector(".cleanup-steps");
    steps.hidden = !panel.steps?.length;
    steps.innerHTML = (panel.steps || [])
      .map((s) => `<span class="${s.active ? "active" : ""} ${s.done ? "done" : ""}">${s.label}</span>`)
      .join("");
  }
}
function updateContext() {
  const floater = $("scoop-target"),
    q = sim.cleanup;
  floater.hidden = mode !== "playing" || q?.stage !== "floating" || sim.coach.carry !== "skimmer";
  if (!floater.hidden) {
    const xy = world.project(q.x, 0.85, q.z),
      ready = sim.nearestInteraction()?.kind === "scoop";
    floater.style.left = xy.x + "px";
    floater.style.top =
      Math.max(document.querySelector(".scoreboard").getBoundingClientRect().bottom + 42, xy.y) + "px";
    floater.textContent = ready ? "E · SCOOP" : "GET CLOSER";
    floater.classList.toggle("in-reach", ready);
  }
  const active = mode === "playing",
    firstPerson = world.viewMode === "coach";
  $("coach-prompt").hidden = !active;
  $("touch-controls").hidden = !active;
  $("crosshair").hidden = !active || !firstPerson;
  if (!active) return;
  const c = sim.coach,
    near = sim.nearestInteraction(),
    prompt = $("coach-prompt");
  if (firstPerson) {
    // Coach Cam: the prompt sits just above the hands; the crosshair names what a click would act on.
    prompt.style.left = innerWidth / 2 + "px";
    prompt.style.top = Math.round(innerHeight * 0.66) + "px";
    prompt.hidden = !near && !c.busy && !c.swimming && !c.waterTransition && !c.slipTime;
    const target = world.centerTarget(),
      crosshair = $("crosshair");
    crosshair.classList.toggle("on-target", !!target);
    crosshair.querySelector("span").textContent = target
      ? targetLabel(target)
      : document.pointerLockElement
        ? ""
        : matchMedia("(pointer: fine)").matches
          ? "Click the pool to look around"
          : "Drag to look around";
  } else {
    const p = world.project(c.x, (c.y || 0) + 2.2, c.z);
    prompt.style.left = Math.max(90, Math.min(innerWidth - 90, p.x)) + "px";
    prompt.style.top = Math.max(110, Math.min(innerHeight - 108, p.y)) + "px";
  }
  prompt.classList.toggle("slipped", c.slipTime > 0);
  prompt.classList.toggle("can-interact", !!near);
  prompt.querySelector("span").textContent = near
    ? near.label
    : c.busy
      ? c.busy.label
      : c.swimming
        ? sim.rescue?.stage === "stranded"
          ? sim.rescue.kind === "crash"
            ? c.carry === "lifering"
              ? "SWIM TO 🤕"
              : "CLIMB OUT · NEXT RING"
            : "SWIM TO 🦵"
          : c.carry === "fishnet" && !c.netLoaded && sim.fish?.stage === "loose"
            ? "CATCH THE FISH 🐟"
            : "SWIM TO AN EDGE"
        : c.waterTransition
          ? "RESCUE"
          : c.slipTime
            ? "😠"
            : c.y > 0.08
              ? "Nice hop!"
              : c.carry
                ? "Carrying " + carryName(c)
                : "COACH";
  prompt.querySelector("kbd").hidden = !near;
}
function clearBubbles() {
  for (const b of bubbles.values()) b.remove();
  bubbles.clear();
}
function updateBubbles() {
  const ids = new Set(),
    tagTop = document.querySelector(".scoreboard").getBoundingClientRect().bottom + 12;
  for (const p of sim.people) {
    if (
      p.status === "gone" ||
      (["exit", "enter", "evacuating", "panic", "recovering"].includes(p.status) && !(p.annoyedTime > 0))
    )
      continue;
    ids.add(p.id);
    let b = bubbles.get(p.id);
    if (!b) {
      b = document.createElement("button");
      b.type = "button";
      b.className = "bubble";
      b.dataset.swimmer = String(p.id);
      b.innerHTML =
        '<span class="rescue-marker" hidden>🛟</span><div class="face"><span class="type-icon"></span><span class="type-label"></span><span class="mood-icon"></span></div><div class="hp"><i></i></div><span class="stomach-meter" hidden><i></i><b></b></span><span class="label-name"></span>';
      $("world-labels").appendChild(b);
      bubbles.set(p.id, b);
    }
    const screen = world.project(
      p.x,
      p.status === "swim" ? (p.type === "aqua" ? 1.15 : 0.8) : p.status === "injured" ? 1.15 : 2 + (p.y || 0),
      p.z,
    );
    b.hidden =
      !screen.visible ||
      (world.viewMode === "coach" && Math.hypot(p.x - sim.coach.x, p.z - sim.coach.z) > 16);
    b.disabled = mode !== "playing" || !["queue", "swim", "injured"].includes(p.status);
    b.setAttribute("aria-label", "Select " + p.name + ", " + swimmerLook(p).label);
    b.setAttribute("aria-pressed", String(p.id === sim.selected));
    const rescuing =
      (sim.rescue?.victims || []).includes(p.id) && !p.rescueRecover && ["swim", "switch"].includes(p.status);
    b.classList.toggle("rescue-victim", rescuing);
    b.querySelector(".rescue-marker").hidden = !rescuing;
    b.classList.toggle("stomach-warning", !!p.stomachWarning);
    b.classList.toggle("injured", p.status === "injured");
    // One countdown bar: stomach trouble, or a daredevil losing patience on the tower.
    const jumpWait = p.status === "trampoline" && p.jumpStage === "waiting",
      stomach = b.querySelector(".stomach-meter");
    stomach.hidden = !p.stomachWarning && !jumpWait;
    stomach.classList.toggle("jump-meter", jumpWait);
    const left = jumpWait ? p.jumpPatience : p.sicknessTimer,
      total = jumpWait ? sim.config.jumpPatience || 15 : p.sicknessDuration;
    stomach.querySelector("i").style.width = Math.max(0, (left / total) * 100) + "%";
    stomach.querySelector("b").textContent = Math.ceil(left) + "s";
    b.classList.toggle("selected", p.id === sim.selected);
    b.classList.toggle("guided", p.id === guidanceState(sim).swimmerId);
    b.querySelector(".type-icon").textContent = swimmerLook(p).icon;
    b.querySelector(".type-label").textContent = swimmerLook(p).label;
    const statusIcon = problemIcon(p);
    b.querySelector(".mood-icon").textContent =
      statusIcon !== swimmerLook(p).icon && statusIcon !== "🙂" ? statusIcon : "";
    b.querySelector(".hp i").style.width = Math.max(0, p.h) + "%";
    b.querySelector(".hp i").style.background = moodColor(p.h);
    const name = b.querySelector(".label-name");
    name.textContent = p.name;
    name.hidden = p.id !== sim.selected;
    b.style.left =
      Math.max(b.offsetWidth / 2 + 8, Math.min(innerWidth - b.offsetWidth / 2 - 8, screen.x)) + "px";
    b.style.top = Math.max(tagTop + b.offsetHeight, screen.y) + "px";
  }
  for (const v of sim.visitors || []) {
    const tag = sim.visitorTag(v);
    if (!tag) continue;
    ids.add(v.id);
    let b = bubbles.get(v.id);
    if (!b) {
      b = document.createElement("div");
      b.className = "bubble visitor-tag";
      b.innerHTML =
        '<div class="face"><span class="type-icon"></span><span class="type-label"></span></div><div class="hp"><i></i></div>';
      $("world-labels").appendChild(b);
      bubbles.set(v.id, b);
    }
    const screen = world.project(v.x, v.kind === "dog" ? 1.4 : v.kind === "kid" ? 1.5 : 2.3, v.z);
    b.hidden = !screen.visible || mode === "menu";
    b.classList.toggle("urgent", !!tag.urgent);
    b.querySelector(".type-icon").textContent = tag.icon;
    b.querySelector(".type-label").textContent = tag.label || "";
    const meter = b.querySelector(".hp");
    meter.hidden = tag.meter === undefined;
    if (tag.meter !== undefined) {
      meter.firstElementChild.style.width = Math.round(tag.meter * 100) + "%";
      meter.firstElementChild.style.background =
        tag.meter > 0.7 ? "#eb7754" : tag.meter > 0.4 ? "#e6b445" : "#73b65b";
    }
    b.style.left =
      Math.max(b.offsetWidth / 2 + 8, Math.min(innerWidth - b.offsetWidth / 2 - 8, screen.x)) + "px";
    b.style.top = Math.max(tagTop + b.offsetHeight, screen.y) + "px";
  }
  for (const [id, b] of bubbles)
    if (!ids.has(id)) {
      b.remove();
      bubbles.delete(id);
    }
  for (let i = 0; i < stationLabels.length; i++) {
    const data = world.labels[i],
      screen = world.project(data.x, data.y, data.z);
    stationLabels[i].style.left = screen.x + "px";
    stationLabels[i].style.top = screen.y + "px";
    stationLabels[i].hidden =
      mode === "menu" ||
      sim.level < (data.minLevel || 1) ||
      (data.when ? !data.when(sim) : false) ||
      !screen.visible;
  }
}
function points(e) {
  const p = world.project(e.x, 1.4, e.z),
    el = document.createElement("div");
  el.className = "float-text";
  el.textContent = (e.value > 0 ? "+" : "") + e.value;
  el.style.left = p.x + "px";
  el.style.top = p.y + "px";
  $("world-labels").appendChild(el);
  setTimeout(() => el.remove(), 1750);
}
// What the crash log notes about the shift as it goes: the events that change how it is going, not every footstep.
const NOTABLE = new Set([
  "incident",
  "catastrophe",
  "blackout",
  "cannonball",
  "fish-dumped",
  "fish-caught",
  "crash",
  "healed",
  "rescue-safe",
  "cramp-alarm",
  "stomach-warning",
  "vip",
]);
function events() {
  const batch = sim.events.splice(0),
    // A sting says what a new incident's warning toast would; a stamp carries the points of its save.
    stung = batch.some((e) => e.type === "incident"),
    stamped = batch.filter((e) => e.type === "save" && e.value).map((e) => e.value);
  for (const e of batch) {
    // One event that goes wrong must not lose the rest of the batch (a lost "ended" would leave the shift open).
    try {
      if (NOTABLE.has(e.type))
        crashlog.crumb("event", e.type + (e.kind ? " " + e.kind : "") + (e.name ? " " + e.name : ""));
      else if (e.type === "save") crashlog.crumb("save", String(e.kind));
      if (e.type === "countdown") {
        $("countdown-number").textContent = e.value;
        if (!reducedMotion.matches)
          $("countdown-number").animate(
            [
              { transform: "scale(1.22)", opacity: 0.5 },
              { transform: "scale(1)", opacity: 1 },
            ],
            { duration: 250 },
          );
      } else if (e.type === "go") {
        mode = "playing";
        audio.playing = true;
        $("countdown").hidden = true;
        updateUI();
        logState();
      } else if (e.type === "toast") {
        if (!(stung && e.warning)) toast(e.text, e.warning);
      } else if (e.type === "points") {
        const i = stamped.indexOf(e.value);
        if (i >= 0) stamped.splice(i, 1);
        else points(e);
      } else if (e.type === "incident") showSting(moments.incident(e, seconds()));
      else if (e.type === "save") showPayoff(moments.save(e, seconds()));
      else if (e.type === "splash" || e.type === "collision" || e.type === "slip")
        world.splash(e.x, -0.12, e.z, e.type === "splash" ? 10 : 15);
      else if (e.type === "cramp-alarm" || e.type === "rescue-safe") {
        queueKey = "";
        updateUI();
      } else if (e.type === "stomach-warning") {
        queueKey = "";
        updateUI();
      } else if (e.type === "catastrophe") {
        world.splash(e.x, 0, e.z, 45);
        world.showIncident(e.x, e.z);
        world.kick(0.5);
      } else if (e.type === "fish-dumped") {
        world.bigSplash(e.x, e.z, 1);
        world.kick(0.6);
        queueKey = "";
      } else if (e.type === "fish-caught") {
        world.splash(e.x, -0.1, e.z, 18);
      } else if (e.type === "cannonball") {
        world.bigSplash(e.x, e.z, 1.6);
        world.incidentView.ripple(e.x, e.z);
        world.kick(0.75);
      } else if (e.type === "dog-splash") {
        world.bigSplash(e.x, e.z, 0.45);
      } else if (e.type === "crash") {
        world.bigSplash(e.x, e.z, 1.35);
        world.incidentView.ripple(e.x, e.z);
        world.kick(0.95);
        queueKey = "";
      } else if (e.type === "trampoline-splash") {
        world.bigSplash(e.x, e.z, 0.85);
        world.incidentView.ripple(e.x, e.z);
        world.kick(0.25);
      } else if (e.type === "healed") {
        world.sparkle(e.to?.x ?? e.x, e.to?.z ?? e.z);
        queueKey = "";
      } else if (e.type === "lane-switch") {
        queueKey = "";
      } else if (e.type === "blackout") {
        world.kick(0.25);
      } else if (e.type === "handoff") {
        world.handoff({ x: e.x, z: e.z }, e.to, e.item);
        $("carry").animate([{ transform: "scale(1.18)" }, { transform: "scale(1)" }], { duration: 150 });
      } else if (e.type === "pickup") {
        $("carry").animate([{ transform: "scale(1.18)" }, { transform: "scale(1)" }], { duration: 150 });
      } else if (e.type === "assigned") {
        queueKey = "";
        updateUI();
      } else if (e.type === "select") {
        queueKey = "";
        updateUI();
      } else if (e.type === "coach-slip") toast("Whoops! Jump over fins, or pick them up with E.");
      else if (e.type === "ended") finish();
      if (world.viewMode === "coach") world.coachCam.react(e.type, e);
      audio.effect(e.type);
    } catch (err) {
      console.error("Pool Panic event error", e.type, err);
      crashlog.error("event:" + e.type, err);
    }
  }
}
// The map covers the pool in the menu, so once the first frames have warmed the 3D scene up nothing of it is
// updated or drawn until a shift starts (moving speech bubbles under a full-screen map cost real frame time).
let warmFrames = 3;
function animate(t) {
  try {
    frame(t);
    if (failing.loop) failing.loop = 0;
  } catch (e) {
    failing.loop = (failing.loop || 0) + 1;
    if (failing.loop === 1) console.error("Pool Panic frame error", e);
    crashlog.error("frame:loop", e);
  }
  // A stage that has failed for a second and a half straight is not a passing glitch.
  if (!snagged && Object.values(failing).some((n) => n >= 90)) snag();
  requestAnimationFrame(animate);
}
let logClock = 0,
  perfClock = 0;
function frame(t) {
  const covered = mode === "menu" && warmFrames-- <= 0;
  if (!covered)
    document.documentElement.style.setProperty("--cue", cuePulse(t / 1000, reducedMotion.matches).toFixed(3));
  if (previous) crashlog.frame(t - previous);
  const dt = Math.min((t - previous) / 1000 || 0.016, 0.06),
    // Incident stings slow the game down and saves freeze it for a beat; menus always run at full speed.
    speed = mode === "playing" ? moments.timeScale(seconds()) : 1;
  previous = t;
  viewClock += dt * speed;
  if (mode === "playing" || mode === "countdown") {
    // Fixed substeps keep congestion stable even on lower frame rates. The simulation is the one stage that stops
    // the shift at once when it throws: what it holds may no longer be sound.
    const ok = stage("sim", () => {
      if (world.viewMode === "coach") {
        world.coachCam.turn(input.turn(), dt);
        sim.coach.lookAngle = world.coachCam.yaw;
      }
      const movement = moveVector();
      sim.setMovement(movement.x, movement.z);
      accumulator = Math.min(0.12, accumulator + dt * speed);
      while (accumulator >= 1 / 60) {
        sim.tick(1 / 60);
        accumulator -= 1 / 60;
      }
    });
    if (!ok) return snag();
    stage("sting", () => showSting(moments.next(seconds())));
    stage("events", events);
  } else if (mode === "menu") {
    sim.time += dt;
    for (const p of sim.people) {
      if (p.status === "swim" && p.type !== "aqua") {
        p.p = (p.p + p.actualSpeed * dt) % 31.2;
        const pos = loopPosition(p.p, sim.lanes[p.lane]);
        p.x = pos.x;
        p.z = pos.z;
        p.angle = pos.angle;
      } else if (p.type === "aqua") {
        p.x = sim.lanes[p.lane];
        p.z = -1;
      }
    }
  }
  if (!covered) {
    stage("scene", () => {
      world.sync(sim, viewClock, dt * speed, dt);
      if (world.incidentView.consumeLightning()) audio.effect("thunder");
    });
    stage("render", () => world.render());
    stage("tags", updateBubbles);
  }
  stage("context", updateContext);
  stage("alert", updateAlert);
  if (!covered) {
    uiClock += dt;
    if (uiClock > 0.12) {
      uiClock = 0;
      stage("ui", updateUI);
    }
  }
  // The log's own housekeeping: what the shift looks like now (every 2 s) and how the GPU and heap are doing (10 s).
  logClock += dt;
  perfClock += dt;
  if (logClock > 2) {
    logClock = 0;
    logState();
  }
  if (perfClock > 10) {
    perfClock = 0;
    sampleLog();
  }
}
function bind() {
  mapView = new LevelMap($("map"), {
    onLevel: selectLevel,
    onDrill: selectDrill,
    onStart: requestStart,
    onAct: selectAct,
  });
  $("scoop-target").onclick = () => sim.scoop();
  $("coach-cam").checked = settings.coachCam;
  $("coach-cam").onchange = () => {
    settings.coachCam = $("coach-cam").checked;
    saveSettings();
  };
  world.canLook = () => ["playing", "countdown"].includes(mode);
  $("start").onclick = requestStart;
  $("booking-cards").onclick = (e) => {
    const b = e.target.closest("[data-booking]");
    if (!b) return;
    $("booking-dialog").close();
    start(b.dataset.booking);
  };
  $("booking-back").onclick = () => $("booking-dialog").close();
  $("lane-controls").onclick = (e) => {
    const b = e.target.closest("[data-lane]");
    if (!b) return;
    if (b.dataset.lane === "trampoline") pick({ kind: "trampoline" });
    else pick({ kind: "lane", lane: Number(b.dataset.lane) });
  };
  $("world-labels").onclick = (e) => {
    const b = e.target.closest("button[data-swimmer]");
    if (b && !b.disabled) pick({ kind: "swimmer", id: Number(b.dataset.swimmer) });
  };
  $("queue").onclick = (e) => {
    const b = e.target.closest("[data-swimmer]");
    if (b) pick({ kind: "swimmer", id: Number(b.dataset.swimmer) });
  };
  $("send-home").onclick = () => {
    sim.home();
    updateUI();
  };
  ["chlorine", "fins", "relief"].forEach((item) => ($(item).onclick = () => sim.fetch(item)));
  $("return-item").onclick = () => sim.returnItem();
  $("clean").onclick = () => sim.tidy();
  $("assist").onclick = () => {
    act("interact (button) · " + (sim.coach.carry || "empty-handed"));
    sim.interact();
  };
  $("sound").onclick = () => {
    audio.init();
    const on = audio.toggle();
    $("sound").classList.toggle("off", !on);
    $("sound").setAttribute("aria-label", on ? "Mute sound" : "Enable sound");
  };
  $("pause").onclick = pause;
  $("resume").onclick = resume;
  $("restart").onclick = () => start(activeBooking);
  $("crash-copy").onclick = () => shareCrash("copy");
  $("crash-issue").onclick = () => shareCrash("issue");
  $("crash-dismiss").onclick = () => {
    if (crashOn && !$("crash-dialog").classList.contains("live")) crashlog.mark(crashOn.id, "dismissed");
    closeCrash();
  };
  $("crash-restart").onclick = () => {
    $("crash-dialog").classList.remove("live");
    closeCrash();
    start(activeBooking);
  };
  $("crash-map").onclick = () => {
    $("crash-dialog").classList.remove("live");
    closeCrash();
    returnMenu();
  };
  $("crash-dialog").addEventListener("cancel", (e) => {
    e.preventDefault();
    closeCrash();
  });
  $("fund-pill").onclick = () => {
    if (mode === "menu") playStory("intro");
    else
      toast(
        `Ocean Fund ${money(Math.min(fundOf(story), STORY.goal))} of ${money(STORY.goal)}. Every shift pays in.`,
      );
  };
  $("help-story").onclick = () => {
    closeHelp();
    playStory("intro", () => {
      if (story.ending) playStory("ending");
    });
  };
  $("watch-ending").onclick = () => playStory("ending");
  $("help-log").onclick = () => showCrash(crashlog.troubled()[0] || crashlog.latest());
  $("help").onclick = showHelp;
  document.querySelectorAll("[data-close]").forEach((b) => (b.onclick = closeHelp));
  $("help-dialog").addEventListener("cancel", (e) => {
    e.preventDefault();
    closeHelp();
  });
  $("pause-dialog").addEventListener("cancel", (e) => {
    e.preventDefault();
    resume();
  });
  $("results-dialog").addEventListener("cancel", (e) => {
    e.preventDefault();
    returnMenu();
  });
  $("play-again").onclick = () => start(activeBooking);
  $("back-menu").onclick = returnMenu;
  $("next-level").onclick = () => {
    if (nextMode === "map") return returnMenu();
    level = Math.min(SHIFTS.length, level + 1);
    selected = { kind: "level", level };
    requestStart();
  };
  $("zoom-in").onclick = () => world.zoomBy(1.1);
  $("zoom-out").onclick = () => world.zoomBy(1 / 1.1);
  $("reset-view").onclick = () => world.resetView();
  $("fullscreen").onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await $("game").requestFullscreen();
    } catch {
      toast("Fullscreen is unavailable here. The game still fills this window.");
    }
  };
  input = new CoachInput({
    isPlaying: () => mode === "playing",
    onJump: () => sim.jump(),
    onDash: () => {
      const m = moveVector();
      sim.setMovement(m.x, m.z);
      sim.dash();
    },
    onInteract: () => {
      act("interact · " + (sim.coach.carry || "empty-handed"));
      sim.interact();
    },
    onPause: () => {
      if (mode === "playing" || mode === "countdown") pause();
      else if (mode === "paused") resume();
    },
    onShortcut: (e) => {
      const key = e.key.toLowerCase();
      if (
        mode === "menu" &&
        key === "enter" &&
        !document.querySelector("dialog[open]") &&
        !e.target.closest?.("button, a, label, input")
      ) {
        requestStart();
        return;
      }
      if (key === "m") {
        $("sound").click();
        return;
      }
      if (key === "h") {
        $("help-dialog").open ? closeHelp() : showHelp();
        return;
      }
      if (key === "+" || key === "=") world.zoomBy(1.08);
      if (key === "-") world.zoomBy(1 / 1.08);
      if (mode === "countdown" && key === "escape") {
        pause();
        return;
      }
      if (mode !== "playing") return;
      if (key === "v") {
        // Switch cameras mid-shift; the Coach Cam picks up where the coach was facing.
        settings.coachCam = !settings.coachCam;
        saveSettings();
        $("coach-cam").checked = settings.coachCam;
        applyViewMode();
        if (settings.coachCam) world.coachCam.yaw = sim.coach.angle ?? world.coachCam.yaw;
        toast(settings.coachCam ? "Coach Cam on · click the pool to look around" : "Overview camera");
        return;
      }
      if (/^[1-9]$/.test(key) && Number(key) <= sim.lanes.length) sim.assign(Number(key) - 1);
      if (key === "t" && sim.venue.trampoline) sim.assignTrampoline?.();
      if (key === "c") sim.fetch("chlorine");
      if (key === "f") sim.fetch("fins");
      if (key === "r") sim.fetch("relief");
      if (key === "x") sim.tidy();
      if (key === "g") sim.assist();
      if (key === "escape") pause();
    },
  });
  document.addEventListener("keydown", (e) => {
    if (!$("cinematic").open) input.keyDown(e);
  });
  document.addEventListener("keyup", (e) => input.keyUp(e));
  window.addEventListener("blur", () => {
    input.clear();
    sim.clearInput();
    if (mode === "playing" || mode === "countdown") pause();
  });
  document.querySelectorAll("[data-move]").forEach((b) => {
    const [x, z] = b.dataset.move.split(",").map(Number);
    input.bindTouch(b, x, z);
  });
  $("touch-dash").onclick = () => {
    if (mode === "playing") {
      const m = moveVector();
      sim.setMovement(m.x, m.z);
      sim.dash();
    }
  };
  $("touch-jump").onclick = () => {
    if (mode === "playing") sim.jump();
  };
  $("touch-interact").onclick = () => {
    if (mode !== "playing") return;
    act("interact (touch) · " + (sim.coach.carry || "empty-handed"));
    sim.interact();
  };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      audio.playing = false;
      if (["playing", "countdown"].includes(mode)) pause();
    } else if (mode === "menu") {
      audio.init();
      audio.playing = true;
    }
  });
  const unlockMusic = () => {
    audio.init();
    audio.playing = !document.hidden && ["menu", "playing", "countdown"].includes(mode);
  };
  document.addEventListener("pointerdown", unlockMusic, { capture: true });
  document.addEventListener("keydown", unlockMusic, { capture: true });
}
try {
  world = new PoolWorld($("world"), pick);
  sim = makeDemo();
  bind();
  audio.init();
  audio.playing = true;
  updateMenu();
  updateUI();
  syncVenue(sim);
  $("loading").hidden = true;
  if (window.__boot) window.__boot.ready = true;
  renderFund();
  if (huntState && hunt.finished(huntState)) showHuntResults();
  else if (huntStep || params.has("trial")) setTimeout(startTrial, 1500);
  crashlog.setEnv({ gpu: describeGpu(world.renderer?.getContext?.()) });
  crashlog.crumb("boot", "ready in " + Math.round(performance.now()) + " ms");
  requestAnimationFrame(animate);
  // QA hook (?debug): drive the fixed-step simulation faster than real time for screenshots and repros.
  if (new URLSearchParams(location.search).has("debug"))
    window.__pool = {
      get sim() {
        return sim;
      },
      get world() {
        return world;
      },
      get mode() {
        return mode;
      },
      get moments() {
        return moments;
      },
      get crashlog() {
        return crashlog;
      },
      get story() {
        return story;
      },
      playStory,
      play(n = level, booking = null) {
        level = n;
        selected = { kind: "level", level: n };
        start(booking);
      },
      step(seconds = 1, drive = null) {
        for (let t = 0; t < seconds; t += 1 / 60) {
          drive?.(sim);
          sim.tick(1 / 60);
          if (sim.events.length) events();
        }
        updateUI();
      },
      coachCam(on = true) {
        settings.coachCam = on;
        $("coach-cam").checked = on;
        applyViewMode();
      },
      unlockAll() {
        records.unlocked = SHIFTS.length;
        updateMenu();
      },
      // See the map as a real player does: levels locked until the one before has a star.
      lockAll(on = true) {
        progressFlags.unlockAll = !on;
        updateMenu();
      },
      get records() {
        return records;
      },
      get selected() {
        return selected;
      },
      get map() {
        return mapView;
      },
      menu() {
        returnMenu();
      },
      select(n) {
        selectLevel(n);
      },
      selectDrill(id) {
        selectDrill(id);
      },
      // Save what a player would have after clearing levels 1..n with one star each.
      progress(n, stars = 1) {
        records = normalizeRecords();
        for (let i = 1; i <= n; i++) recordResult(records, i, SHIFTS[i - 1].thresholds[stars - 1]);
        level = currentLevel(records);
        selected = { kind: "level", level };
        updateMenu();
      },
      // Finish the shift being played with a given score (as if the clock ran out), for the results screens.
      end(score = null) {
        if (score !== null) sim.score = score;
        sim.status = "ended";
        sim.emit("ended");
        events();
      },
    };
  // The very first launch opens with the story, before anything can be played (`?story` shows it again; `?debug`
  // sessions for tests and repros skip it).
  if (params.has("story") || (!story.seen && !params.has("debug") && !testing))
    playStory("intro", () => {
      story.seen = true;
      saveStory();
    });
  // A launch after a crash offers the report (`?log` opens the log any time, crash or not).
  const wantsLog = new URLSearchParams(location.search).has("log");
  setTimeout(() => {
    if (mode !== "menu" || document.querySelector("dialog[open]") || testing) return;
    if (wantsLog) showCrash(crashlog.troubled()[0] || crashlog.latest());
    else if (crashlog.pending().length) showCrash(crashlog.pending().slice(-1)[0]);
  }, 1800);
  // The browser took the GPU back (memory pressure, a driver reset): pause, and build the world again when it returns.
  crashlog.onContextLost = () => {
    if (["playing", "countdown"].includes(mode)) pause();
    toast("Graphics were interrupted. Recovering…", true);
  };
  crashlog.onContextRestored = () => {
    stage("recover", () => {
      world.build(world.venue, world.lightingName);
      world.resize();
      syncVenue(sim);
    });
    toast("Graphics are back.");
  };
} catch (e) {
  console.error(e);
  crashlog.error("boot", e);
  $("loading").innerHTML =
    '<p>We couldn’t open the 3D pool.</p><p style="font-size:14px;font-weight:500;max-width:320px;text-align:center">Enable hardware acceleration in your browser and reload. Pool Panic needs WebGL to play.</p><button class="primary" style="width:200px" onclick="location.reload()">Try again ↻</button><button id="boot-report" class="secondary" style="width:200px;margin-top:10px">Copy crash report</button>';
  $("boot-report").onclick = async () => {
    $("boot-report").textContent = (await copyText(crashlog.report())) ? "Copied ✓" : "Copy failed";
  };
}
