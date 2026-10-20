import { loadProp } from "./scene/prop-models.mjs";
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
import { guidanceState, cuePulse, laneVerdict } from "./guidance.mjs";
import { TIPS } from "./tips.mjs";
import { Tutor } from "./tutorial.mjs";
import {
  PoolSimulation,
  TYPES,
  SHIFTS,
  loopPosition,
  swimmerLook as baseSwimmerLook,
  freePlayGuests,
  CLASS_ROOM,
  KIDS_ROOM,
  SENIOR_LOOKS,
  streakTier,
  STREAK_TIERS,
} from "./sim.mjs";
import { PoolWorld } from "./scene.mjs";
import { activeChoice, chooseCoach, loadCoachModel, coachModelReady } from "./scene/coach-model.mjs";
import {
  activeSwimmerChoice,
  chooseSwimmers,
  loadSwimmerModels,
  loadFigure,
  swimmerModelsReady,
} from "./scene/swimmer-models.mjs";
import { loadFishModel } from "./scene/fish-model.mjs";
import { cannonballMan } from "./incidents/carl.mjs";
import { PoolAudio } from "./audio.mjs";
import { CoachInput } from "./input.mjs";
import { MomentDirector, edgeArrow } from "./moments.mjs";
import { installCrashLog, describeGpu } from "./crashlog-hooks.mjs";
import { Tracer, describeEvent, isNoisy, crowdSummary } from "./trace.mjs";
import { footprint, surfaceMB } from "./scene/footprint.mjs";
import {
  readPrefs,
  savePrefs,
  canSend,
  bridgeFetch,
  reportPayload,
  sendReport,
  sendProblem,
} from "./report-send.mjs";
import {
  PLAYTEST_LIMITS,
  COVERAGE_KEY,
  INCIDENT_KINDS,
  playtestChoice,
  readPlaytest,
  savePlaytest,
  LiveSender,
  liveWant,
  Coverage,
} from "./playtest.mjs";
import { Recorder, apply as applyInput, REPLAY_LIMITS } from "./replay.mjs";
import { HighlightPicker, ClipPlayer, HIGHLIGHT } from "./highlight.mjs";
import { BUILD } from "./version.mjs";
import { playCinematic } from "./cinematic.mjs";
import { readTuning, isWebKit } from "./tuning.mjs";
import {
  isTouchWebKit,
  bootGfx,
  markDrawing,
  resetGfx,
  graphicsPlan,
  Governor,
  QUALITY_CHOICES,
  qualityOf,
  readQuality,
} from "./gfx.mjs";
import { installWeek } from "./week-ui.mjs";
import { passMark } from "./week.mjs";
import { RIDE, ROUTES as RIVER_ROUTES } from "./river-ride.mjs";
import { waveBoard } from "./waves.mjs";
import { BATHE } from "./wave-pool.mjs";
import { CHILL, GUEST_KIND, nextDrop, SEATS, seatVerdict, wishWord } from "./rooftop.mjs";
import { ROOF_BEDS } from "./roof-plan.mjs";
import { slide } from "./ship.mjs";
import { SOAK, springGuests, monkeyIn } from "./onsen.mjs";
import { SPRINGS } from "./onsen-plan.mjs";
import { Achievements } from "./achievements.mjs";
import { isDesktop, quitGame, richPresence, unlockAchievement } from "./platform.mjs";
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
// device. Nothing is sent unless the player says so: see crashlog.mjs, report-send.mjs and the crash dialog.
let crashStorage = null;
try {
  crashStorage = localStorage;
} catch {}
// The switches for isolating a crash (tuning.mjs) and the crash hunt that runs them one at a time (bisect.mjs). The
// hunt's state is read first: a test left running by the last page means that page died in it.
const params = new URLSearchParams(location.search);
// ?bisect=hands looks inside the hands layer, ?bisect=shift plays plain shifts in the overview (the crash about 45 s into a shift),
// ?bisect=play lets the player play the shifts (the same crash, with the touches and the sound a hunt left alone never has)
const hunt = { hands: hunts.hands, shift: hunts.shift, play: hunts.play }[params.get("bisect")] || hunts.main;
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
const playHunt = hunt === hunts.play && !!huntState;
// The first-person hands layer crashed an iPad's Safari about 45 s into every Coach Cam shift (the crash hunt found
// it), so Safari's engine plays without it until that is understood. `?hands` turns it back on; a hunt or a trial
// sets its own switches and gets no default.
const testing = params.has("bisect") || params.has("trial");
const handsOff = isWebKit(navigator.userAgent) && !params.has("hands") && (!testing || playHunt);
// How hard to drive the graphics here (gfx.mjs): a touch device with WebKit draws at most 60 frames a second; a page that died in the
// middle of a shift is said in the log (`?gfx=reset` clears the count).
if (params.get("gfx") === "reset") resetGfx(crashStorage);
const touchWebKit = isTouchWebKit({
  userAgent: navigator.userAgent,
  maxTouchPoints: navigator.maxTouchPoints,
});
const gfxBoot = bootGfx(crashStorage, { count: !testing });
// (The played hunt draws every test as light as the lightest crash so far, tier 2, so that only its own switch differs.)
// Since 16 October 2026 a crash no longer makes the next launch draw lighter (the creator: the browser's pixels back; the iPad died at
// every tier it was given). The mark is still read, for the log. The played hunt keeps its tier-2 baseline.
const gfxTier = playHunt ? 2 : 0;
// The quality the player chose in Help (Auto, Low, Medium, Standard, High, Ultra); a hunt or a trial plays Auto.
const gfxQuality = testing ? "auto" : readQuality(crashStorage);
const tuning = readTuning(location.search, [
  ...(huntStep ? huntStep.flags : []),
  ...(handsOff ? ["nohands"] : []),
  ...graphicsPlan({ tier: gfxTier, quality: gfxQuality }).flags,
]);
globalThis.__poolTuning = tuning;
const gfx = (globalThis.__poolGfx = {
  plan: graphicsPlan({
    tier: gfxTier,
    touch: touchWebKit,
    deviceRatio: devicePixelRatio || 1,
    dprCap: tuning.number("dpr", null),
    testing,
    quality: gfxQuality,
  }),
  governor: new Governor(),
  scale: 1,
});
if (tuning.has("nosound")) {
  audio.enabled = false;
  audio.init = () => {};
}
// Playtest mode (playtest.mjs): `?playtest` switches it on for this device (and the device remembers), `?playtest=off` switches it off.
// A playtest keeps a longer diary, sends it to the developer while the game runs, and has a button for flagging a problem.
const playtestWord = playtestChoice(location.search, readPlaytest(crashStorage));
if (playtestWord.said) savePlaytest(crashStorage, playtestWord.on);
const playtest = playtestWord.on;
const crashlog = installCrashLog({ build: BUILD, storage: crashStorage, motion: reducedMotion.matches });
// The crash log is saved every 2 s (it was every half second: up to 240 kB to the device's storage each time in a playtest); the
// played hunt's test of the log (`nolog`) saves it every 5 s.
crashlog.gap = tuning.has("nolog") ? 5000 : 2000;
if (playtest) {
  crashlog.setLimits(PLAYTEST_LIMITS);
  crashlog.crumb("playtest", "on");
}
for (const e of window.__boot?.errors || []) crashlog.error("boot", e);
// The shift's diary: what changed in the simulation, in plain words, after every frame (trace.mjs). A failing diary is switched off,
// never the game.
const tracer = new Tracer((kind, text) => crashlog.crumb(kind, text), { verbose: playtest });
let tracing = true;
function trace() {
  if (!tracing || !sim) return;
  try {
    tracer.look(sim);
  } catch (e) {
    tracing = false;
    crashlog.error("trace", e);
  }
}
// The playtest's own state (see the playtest section below): what has been covered, the live sender, the recorder of the shift being played.
let coverage = null,
  live = null,
  recorder = null,
  playtestBroken = false;
// The highlight replay (Phase 3, highlight.mjs): the shift's clips as it is played, and the clip being played back.
let highlights = null,
  clip = null; // {player, live (the ended shift), reopen, clock} while the highlight plays
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
  helpResumeState = "playing",
  tutor = null; // the guided first shift's tips (tutorial.mjs), or null
// The Aqua Disco's song follows the shift's clock (music.mjs): beat 0 at the go, as the class dances; it waits through the
// countdown and goes when the power does. The Kids Pool, Senior Aqua Fit and the Lazy River have songs of their own on the same
// clock.
audio.clock = () =>
  (sim?.venue?.class ||
    sim?.venue?.kids ||
    sim?.venue?.seniors ||
    sim?.venue?.river ||
    sim?.venue?.waves ||
    sim?.venue?.roof ||
    sim?.venue?.cruise ||
    sim?.venue?.onsen) &&
  (mode === "playing" || mode === "countdown")
    ? {
        time: sim.time,
        running: mode === "playing" && !sim.clockHeld(),
        dark: sim.outage?.stage === "dark",
        song: sim.venue.kids
          ? "kids"
          : sim.venue.seniors
            ? "senior"
            : sim.venue.river
              ? "river"
              : sim.venue.waves
                ? "wave"
                : sim.venue.roof
                  ? "roof"
                  : sim.venue.cruise
                    ? "cruise"
                    : sim.venue.onsen
                      ? "onsen"
                      : "disco",
        // (The Rooftop Pool's DJ builds to the drops the simulation has planned, on its bar lines: rooftop.mjs.)
        drops: sim.roof?.drops || null,
      }
    : null;
let records = normalizeRecords();
try {
  records = normalizeRecords(JSON.parse(localStorage.getItem("pool-panic.records.v1")));
} catch {}
// `?locked` previews the real, star-gated map while every level is open for playtesting (see progression.mjs).
if (new URLSearchParams(location.search).has("locked")) progressFlags.unlockAll = false;
if (new URLSearchParams(location.search).has("unlockall")) progressFlags.unlockAll = true;
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
// Per-device preferences. Coach Cam (the first-person view) is off at every launch (the creator, 15 October 2026): V or the
// toggle turns it on for the session, and a choice saved before is not brought back.
let settings = { coachCam: false };
try {
  settings = { ...settings, ...JSON.parse(localStorage.getItem("pool-panic.settings.v1") || "{}") };
} catch {}
settings.coachCam = false;
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
  if (!coach) {
    sim.coach.lookAngle = null;
    recorder?.look(null);
  }
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
  if (d.kind === "lane" && sim.venue.river)
    return "The river" + (sim.get(sim.selected)?.hasFins ? " · click to send them down it" : "");
  if (d.kind === "lane")
    return laneWord(sim) + " " + (d.lane + 1) + (sim.get(sim.selected) ? " · click to send them here" : "");
  if (d.kind === "lane" && sim.venue.waves) return "The waves";
  if (d.kind === "station" && d.item === "fins" && sim.venue.river) return "Tube rack";
  if (d.kind === "station" && d.item === "fins" && sim.venue.waves) return "Tube hut";
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
// Coach Waters is saving up to take Marina to the ocean (story.mjs). What was seen and earned lives on the device.
let story = normalizeStory();
try {
  story = normalizeStory(JSON.parse(localStorage.getItem(STORY.storageKey)));
} catch {}
function saveStory() {
  try {
    localStorage.setItem(STORY.storageKey, JSON.stringify(story));
  } catch {}
}
// Achievements (achievements.mjs): kept on the device, shown as a toast, and told to Steam when the game runs in the desktop app.
let achieved = [];
try {
  achieved = JSON.parse(localStorage.getItem("pool-panic.achievements.v1") || "[]");
} catch {}
const achievements = new Achievements({
  unlocked: achieved,
  remember: (list) => {
    try {
      localStorage.setItem("pool-panic.achievements.v1", JSON.stringify(list));
    } catch {}
  },
  announce: (a) => {
    toast("🏆 " + a.name + " · " + a.text);
    unlockAchievement(a.id);
  },
});
achievements.replay(unlockAchievement); // (those earned before Steam was there; nothing in a browser)
// The top bar's pill: the week's Date Fund against its goal, always in sight (the date, what is saved, what it costs).
function renderFund(bump = false) {
  const pill = $("fund-pill"),
    week = weekUi?.pill();
  if (week) {
    pill.querySelector("span").textContent = week.icon;
    $("fund-now").textContent = money(week.now);
    $("fund-goal").textContent = "/ " + money(week.goal);
    pill.setAttribute("aria-label", `Date Fund: ${money(week.now)} of ${money(week.goal)}.`);
    pill.title = "Date Fund for this weekend's date with Marina";
  } else {
    $("fund-now").textContent = money(Math.min(fundOf(story), STORY.goal));
    $("fund-goal").textContent = "/ " + money(STORY.goal);
    pill.setAttribute(
      "aria-label",
      `Ocean Fund: ${$("fund-now").textContent} of ${money(STORY.goal)}. Watch the story.`,
    );
  }
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
// `?trial=shift` and `?bisect=shift` play a plain shift instead, in the overview with no incident of its own: the recorded level 2
// that crashed an iPad (below), or with `?bot` a level 3 played by a bot. The crash they hunt came about 45 s after the go,
// whatever the level was and whatever was happening.
const plainTrial = params.get("trial") === "shift" || hunt === hunts.shift;
const TRIAL_CAP = +params.get("trialsecs") || 100; // seconds the page may be seen before a trial gives up waiting
// The hands crash came about 45 s into a Coach Cam shift, whatever was happening, so a hunt's test plays on until it is
// well past that (with the cap always the last word); a plain shift plays 56 s from the go (the recorded level 2 lasts 60), or 75 s
// of the bot's level 3, a long way past 43 to 46. (`trialplay=N` shortens the play to N seconds, for rehearsing the hunt where the
// game runs slowly.)
const TRIAL_MIN = plainTrial
  ? Math.min(+params.get("trialplay") || (params.has("bot") ? 75 : 56), TRIAL_CAP - 5)
  : huntStep
    ? Math.min(70, TRIAL_CAP - 5)
    : 0;
let trial = null;
let awake = null; // the screen wake lock a trial holds, so an iPad left alone does not go to sleep in the middle of a test
let awakeWord = "";
async function keepAwake() {
  if (awake || awakeWord === "asking") return;
  if (!navigator.wakeLock) {
    if (!awakeWord) crashlog.crumb("hunt", "this browser cannot keep the screen awake");
    awakeWord = "none";
    return;
  }
  awakeWord = "asking";
  try {
    awake = await navigator.wakeLock.request("screen");
    awake.addEventListener?.("release", () => (awake = null));
    if (awakeWord !== "kept") crashlog.crumb("hunt", "the screen is kept awake");
    awakeWord = "kept";
  } catch (e) {
    awakeWord = "refused";
    crashlog.crumb("hunt", "could not keep the screen awake: " + String(e?.message || e).slice(0, 80));
  }
}
document.addEventListener("visibilitychange", () => {
  if (trial && !document.hidden) keepAwake();
});
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
  // (In the diary too, for whoever reads the log from afar: a crumb is short, so the verdict is a second one.)
  crashlog.crumb(
    "hunt",
    (hunt.finished(huntState) ? "done: " : "so far: ") + lines.map((l) => l.id + " " + l.outcome).join(", "),
  );
  crashlog.crumb("hunt", verdict);
  live?.dirty("urgent");
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
// The shift that ended an iPad's page 44.0 s after the go (hunt/lunch-rush.json: a level 2 played on 4 October 2026, as the recorder
// kept it). A plain trial plays it again input for input (the simulation is seeded and fixed-step, so it is the same shift every
// time, in every test), through the game's own frame loop. `?bot` plays a level 3 with a bot instead, and so does a page that
// cannot fetch the recording.
let replayRun = null; // {record, next, ticks} while a recorded shift is being fed to the simulation
let shiftGuests = null; // the guests free play added to the shift being played (Marco, VIPs), or null
let nextSeed = 0; // the seed the next shift starts with (a replayed one; else the clock decides)
async function loadHuntShift() {
  try {
    const r = await fetch(new URL("./hunt/lunch-rush.json", import.meta.url));
    if (!r.ok) throw new Error("HTTP " + r.status);
    const record = await r.json();
    if (!Number.isInteger(record.level) || !Array.isArray(record.inputs)) throw new Error("not a recording");
    return record;
  } catch (e) {
    crashlog.crumb("hunt", "no recorded shift (" + String(e?.message || e).slice(0, 60) + "): a bot plays");
    return null;
  }
}
// The inputs that come before this tick, given as the player gave them; one that cannot be given ends the replay, not the shift.
function feedReplay() {
  const run = replayRun;
  try {
    while (run.next < run.record.inputs.length && run.record.inputs[run.next][0] <= run.ticks)
      applyInput(sim, run.record.inputs[run.next++], run.record);
  } catch (e) {
    crashlog.error("hunt:replay", e);
    replayRun = null;
    return;
  }
  run.ticks++;
}
async function startTrial() {
  settings.coachCam = !tuning.has("overview"); // the trial's own choice, never saved
  $("coach-cam").checked = settings.coachCam;
  const record = plainTrial && !params.has("bot") ? await loadHuntShift() : null;
  level = record ? record.level : plainTrial ? 3 : 10;
  selected = { kind: "level", level };
  nextSeed = record ? record.seed : plainTrial ? 138 : 0; // (138: a level 3 the bot plays for 75 s with no pool closed and swimmers in the water)
  start(record?.booking || null);
  replayRun = record ? { record, next: 0, ticks: 0 } : null;
  const now = performance.now();
  // `seen` is the time the page has been in front of someone, `played` the part of it the shift has been running (from the go).
  trial = { phase: plainTrial ? "plain" : "carl", at: 0, began: now, last: now, seen: 0, played: 0 };
  huntOverlay(
    `<strong>${huntLabel()}</strong><p>${
      plainTrial
        ? "Leave the iPad awake with this tab in front and do nothing: " +
          (record ? "a recorded shift plays back" : "a bot plays the shift") +
          ". It goes on to the next test by itself, even after a crash."
        : "Leave this tab open and do nothing. If the page closes or reloads, open the link again."
    }</p>`,
  );
  const switches = tuning.describe();
  crashlog.crumb(
    "hunt",
    huntLabel() +
      (switches.length ? " · switches: " + switches.join(" + ") : "") +
      (plainTrial
        ? record
          ? " · replaying level " +
            record.level +
            " seed " +
            record.seed +
            " (" +
            record.inputs.length +
            " inputs)"
          : " · bot, level 3"
        : ""),
  );
  if (huntStep) {
    hunt.begin(huntState);
    hunt.save(crashStorage, huntState);
  }
  keepAwake();
  trial.timer = setInterval(trialTick, 250);
}
// The player of a plain trial: every so often it sends the swimmer who has waited longest to the emptiest lane that will have
// them (a lane that is closed, in its splash zone or full says no, and the next is tried), as a player does with two taps. The
// crash this hunts came in shifts that were played, with swimmers in the water, and in a shift nobody plays nobody swims.
function botPlay() {
  if (sim.status !== "playing") return;
  const waiting = sim.people.find((p) => p.status === "queue" && p.type !== "daredevil");
  if (!waiting) return;
  sim.select(waiting.id);
  const lanes = sim.lanes.map((_, i) => i).sort((a, b) => sim.occupancy(a) - sim.occupancy(b));
  for (const lane of lanes) if (sim.assign(lane)) return;
}
function trialTick() {
  if (!trial) return;
  // Time counts only while the page is in front (a locked iPad is not a test), and played only while the shift runs.
  const now = performance.now(),
    gap = Math.min(1000, now - trial.last);
  trial.last = now;
  if (!document.hidden) {
    trial.seen += gap;
    if (mode === "playing") trial.played += gap;
  }
  const enough = trial.played >= TRIAL_MIN * 1000;
  // A page that dies cannot say when, so a hunt's log goes out about every 3 s (the "beat" pace) and not every 20: the last word
  // from a crashed test then says within a few seconds how far it got.
  if (live && now - (trial.sent || 0) > 3000) {
    trial.sent = now;
    live.dirty("beat");
  }
  if (mode === "results" || sim.status === "ended") return endTrial(!plainTrial || enough);
  if (trial.seen > TRIAL_CAP * 1000) return endTrial(!plainTrial || enough);
  // The page pauses the shift when it is hidden; nobody is there to press play when it comes back.
  if (mode === "paused" && !document.hidden) return resume();
  if (mode !== "playing") return;
  if (plainTrial) {
    if (!replayRun && now - (trial.botAt || 0) > 700) {
      trial.botAt = now;
      try {
        botPlay();
      } catch (e) {
        crashlog.error("hunt:bot", e);
      }
    }
    return enough && endTrial();
  }
  const quiet = sim.time - trial.at > 6 && !sim.activeSystems().length;
  if (trial.phase === "carl" && sim.time >= 2 && sim.triggerChaos("carl")) {
    trial.phase = "carl-run";
    trial.at = sim.time;
    crashlog.crumb("hunt", "Carl");
  } else if (trial.phase === "carl-run" && quiet && sim.triggerChaos("fish")) {
    trial.phase = "fish-run";
    trial.at = sim.time;
    crashlog.crumb("hunt", "fish kid");
  } else if (trial.phase === "fish-run" && quiet && trial.seen > TRIAL_MIN * 1000) endTrial();
}
// `played` is false when the test could not be played through (the page was hidden or paused for the whole of the cap).
function endTrial(played = true) {
  clearInterval(trial.timer);
  trial = null;
  replayRun = null;
  awake?.release?.().catch?.(() => {});
  awake = null;
  const label = huntLabel();
  crashlog.crumb("hunt", played ? "survived" : "not played through");
  if (huntStep) {
    (played ? hunt.pass : hunt.skip)(huntState);
    hunt.save(crashStorage, huntState);
    huntOverlay(
      `<strong>${label}</strong><p>${played ? "Survived. Next test…" : "Could not be played through. Next test…"}</p>`,
    );
    setTimeout(() => location.reload(), 900);
  } else {
    huntOverlay(
      `<strong>${label}</strong><p>${played ? "Survived: no crash in this trial." : "Not played through."}</p>`,
      { buttons: `<button id="hunt-stop" class="secondary">Close</button>` },
    );
    $("hunt-stop").onclick = () => ($("hunt").hidden = true);
  }
}

// The played hunt (?bisect=play): the player plays ordinary shifts and each launch takes one suspect out (bisect.mjs PLAY_PLAN). A test
// starts when a shift is under way with the page in front, is passed after PLAY_SECONDS of it, and is a crash when the page dies in it
// (the next launch finds it still running). A hidden page or a shift that ends sooner leaves the test to be played again.
let playTest = null;
function playHuntBanner(text) {
  huntOverlay(`<strong>${huntLabel()}</strong><p>${text}</p>`);
  $("hunt").classList.add("compact");
}
function startPlayHunt() {
  const sofar = hunt
    .summary(huntState)
    .lines.map((l) => l.id + " " + l.outcome)
    .join(", ");
  // (The words crash-triage.mjs reads a hunt test by: the label line, "survived", and "so far: …".)
  crashlog.crumb("hunt", huntLabel() + " · switches: " + (tuning.describe().join(" + ") || "none"));
  crashlog.crumb("hunt", "so far: " + sofar);
  live?.dirty("urgent");
  playHuntBanner(
    "Play a shift of level 2 or higher, as you normally would, for a minute. If the game crashes, open it again: the next test starts by itself.",
  );
  setInterval(playHuntTick, 250);
}
function playHuntTick() {
  // (Once a test is passed, the page reloads into the next one; until then it plays on, and counts nothing.)
  if (!huntStep || hunt.current(huntState) !== huntStep) return;
  const now = performance.now(),
    shiftOn = ["playing", "countdown", "paused"].includes(mode);
  if (!playTest) {
    if (mode !== "playing" || document.hidden) return;
    playTest = { played: 0, last: now, shown: -1 };
    crashlog.crumb("hunt", "test begins: " + huntStep.label);
  }
  const gap = Math.min(1000, now - playTest.last);
  playTest.last = now;
  // A page in the background may be ended by the system without that being a crash: the test waits for it to come back.
  if (document.hidden || !shiftOn) {
    if (huntState.running) {
      hunt.abandon(huntState);
      hunt.save(crashStorage, huntState);
    }
    if (!shiftOn) {
      crashlog.crumb("hunt", "the shift ended before " + hunts.PLAY_SECONDS + " s: not counted");
      playTest = null;
      playHuntBanner("That shift ended too soon to count. Play another (level 3 or higher lasts longer).");
    }
    return;
  }
  if (mode !== "playing") return;
  if (!huntState.running) {
    hunt.begin(huntState);
    hunt.save(crashStorage, huntState);
  }
  playTest.played += gap;
  const secs = Math.floor(playTest.played / 1000);
  if (secs !== playTest.shown) {
    playTest.shown = secs;
    playHuntBanner(secs + " of " + hunts.PLAY_SECONDS + " s played. Keep playing normally.");
  }
  if (playTest.played < hunts.PLAY_SECONDS * 1000) return;
  const label = huntLabel(); // (the test's own, before the step moves on)
  hunt.pass(huntState);
  hunt.save(crashStorage, huntState);
  crashlog.crumb("hunt", "survived");
  live?.dirty("urgent");
  playTest = null;
  huntOverlay(`<strong>${label}</strong><p>Survived ✓ The next test starts in a moment…</p>`);
  setTimeout(() => location.reload(), 1800);
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
    rescue: sim.rescue ? sim.rescue.stage + " " + (sim.rescue.kind || "") : "",
    coach: sim.coach
      ? (sim.coach.swimming ? "swimming" : sim.coach.waterTransition?.kind || "deck") +
        (sim.coach.carry ? " carrying " + sim.coach.carry : "") +
        " @" +
        Math.round(sim.coach.x * 10) / 10 +
        "," +
        Math.round(sim.coach.z * 10) / 10
      : "",
    crowd: crowdSummary(sim),
    booking: activeBooking || "",
    seed: mode === "menu" ? 0 : runSeed,
  });
}
// The player's deliberate actions go in the trail too: what they did just before something broke is often the clue.
const act = (what) => crashlog.crumb("input", what);
// A few numbers about how the GPU, the scene and the heap are doing, every ten seconds (and a moment after each save), so a crash
// report can show a trend: a count that only climbs from shift to shift is a leak.
function sampleLog() {
  const info = world?.renderer?.info,
    memory = performance.memory?.usedJSHeapSize;
  let scene = {};
  try {
    scene = footprint(world?.scene, world?.coachCam?.scene);
  } catch {}
  crashlog.perf({
    calls: info?.render.calls,
    tris: info && Math.round(info.render.triangles / 1000),
    geo: info?.memory.geometries,
    tex: info?.memory.textures,
    prog: info?.programs?.length,
    heapMB: memory && Math.round(memory / 1048576),
    nodes: scene.nodes,
    meshes: scene.meshes,
    skinned: scene.skinned,
    bones: scene.bones,
    lights: scene.lights,
    shadows: scene.shadows,
    geoMB: scene.geoMB,
    texMB: scene.texMB,
    shadowMB: scene.shadowMB,
    parts: world?.particles?.length,
    people: sim?.people?.length,
    dom: document.getElementsByTagName("*").length,
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
// The crash dialog: what went wrong, and three ways to get the report to the developer: send it (report-send.mjs: once, or every time
// if the box is left ticked), copy it, or open a prefilled GitHub issue. `live` is a shift that just hit an error and is paused.
const reportPrefs = readPrefs(crashStorage);
// A tester build of the desktop app hands the page a way to post (desktop/preload.cjs); a Steam build, and a browser's tab on a server with
// no report service, have none.
const desktopPost =
  typeof globalThis.desktop?.sendReport === "function" ? globalThis.desktop.sendReport : null;
const reportsOpen = () =>
  canSend({ desktop: isDesktop(), protocol: location.protocol, bridge: !!desktopPost });
const postReport = (payload) => sendReport(payload, desktopPost ? { fetch: bridgeFetch(desktopPost) } : {});
// A playtest sends by itself: whoever switched it on is the one who reads the log.
const autoSend = () => reportPrefs.auto === true || playtest;
let crashOn = null;
function showCrash(session, { live = false } = {}) {
  if (!session) return;
  crashOn = session;
  const dialog = $("crash-dialog"),
    sendable = reportsOpen(),
    troubled = session.errors.length || session.crash || session.flags?.length;
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
  for (const id of ["crash-send", "crash-auto-row", "crash-device"]) $(id).hidden = !sendable;
  $("crash-device-code").textContent = reportPrefs.device;
  $("crash-auto").checked = reportPrefs.auto !== false;
  showSent(session);
  if (!dialog.open) dialog.showModal();
  // A shift that just hit an error is sent at once when the player has said reports may go by themselves.
  if (sendable && autoSend() && troubled && !session.sent) shareCrash("send");
}
function showSent(session, problem = "") {
  const line = $("crash-sent");
  line.hidden = !(session.sent || problem);
  line.classList.toggle("bad", !!problem);
  line.textContent = problem || "Sent ✓ Device code " + reportPrefs.device + ".";
  $("crash-send").textContent = session.sent ? "Send again" : "Send report";
}
async function sendSession(session, automatic = false) {
  crashlog.flush(true);
  const result = await postReport(reportPayload(crashlog, session, reportPrefs.device));
  crashlog.crumb(
    "report",
    (automatic ? "automatic " : "") + "send " + (result.ok ? "ok" : "failed: " + result.error),
  );
  if (result.ok) crashlog.mark(session.id, "sent", { device: reportPrefs.device, automatic });
  return result;
}
// Earlier sessions that went wrong go by themselves when the player has switched that on. One that cannot be sent stays pending, so
// the dialog offers it as usual.
async function sendPending() {
  let sent = 0;
  for (const session of crashlog.pending().slice(-3)) if ((await sendSession(session, true)).ok) sent++;
  if (sent) toast(sent === 1 ? "The last crash report was sent." : sent + " crash reports were sent.");
}
async function shareCrash(how) {
  if (!crashOn) return;
  if (how === "send") {
    const session = crashOn,
      button = $("crash-send");
    // The box is the player's say: ticked when they send, every later report goes by itself.
    reportPrefs.auto = $("crash-auto").checked;
    savePrefs(crashStorage, reportPrefs);
    button.disabled = true;
    button.textContent = "Sending…";
    const result = await sendSession(session);
    button.disabled = false;
    showSent(session, sendProblem(result));
    return;
  }
  const copied = await copyText(
    crashlog.report(crashOn, { device: reportsOpen() ? reportPrefs.device : "" }),
  );
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
// ---- playtest ------------------------------------------------------------------------------------------------------------------
// `?playtest` (playtest.mjs): a bug button for flagging a problem, the log sent to the developer while the game runs (so a page that dies
// has left a recent copy, and the shift can be read as it is played), notes on what has been played and seen, a recorder that makes any
// shift replayable (replay.mjs), and a way to make an incident happen. None of it exists for an ordinary player.
const INCIDENT_NAMES = Object.keys(INCIDENT_KINDS);
const TRIGGERS = [
  ["cramp", "🛟 Cramp"],
  ["fish", "🐟 Fish kid"],
  ["dog", "🐶 Loose dog"],
  ["carl", "💣 Cannonball man"],
  ["karen", "😡 Karen"],
  ["outage", "⚡ Power cut"],
];
let pulseClock = 0,
  liveAt = 0, // when the live copy was last asked about, by the wall clock: a slow page (a few frames a second) must not slow its own beat
  liveRev = -1,
  liveWorked = null,
  coverageTimer = 0,
  ptPaused = false,
  ptResume = "playing",
  ptReason = "other",
  ptTimer = 0;
if (playtest)
  try {
    let saved = null;
    try {
      saved = JSON.parse(crashStorage?.getItem(COVERAGE_KEY) || "null");
    } catch {}
    coverage = new Coverage(saved);
    if (reportsOpen()) {
      live = new LiveSender({ send: sendLive, now: () => performance.now() });
      crashlog.onNewError = () => live.dirty("urgent");
    }
  } catch (e) {
    playtestBroken = true;
    crashlog.error("playtest", e);
  }
// What has been covered goes to the device (a playtest goes on over page loads) and into every report.
function saveCoverage() {
  if (!coverage) return;
  try {
    crashStorage?.setItem(COVERAGE_KEY, JSON.stringify(coverage.data));
  } catch {}
  crashlog.setPlaytest({ lines: coverage.lines(INCIDENT_NAMES), data: coverage.data });
}
const touchCoverage = () => {
  if (!coverageTimer)
    coverageTimer = setTimeout(() => {
      coverageTimer = 0;
      saveCoverage();
    }, 1500);
};
// Every shift is recorded (replay.mjs): the highlight replay at its end plays it again (Phase 3, highlight.mjs), and a playtest
// sends the record with its log. A recorder that breaks stops recording, never the shift.
function startRecorder(drill) {
  try {
    recorder = new Recorder(
      sim,
      {
        level: sim.level,
        seed: runSeed,
        booking: activeBooking || "",
        drill: drill?.id || "",
        man: forcedMan || "",
        ...(shiftGuests && { guests: shiftGuests }),
        // A shift of the week was built, not looked up: the record carries what it was built from.
        ...(weekShift && { week: { config: weekShift.config, perks: weekShift.perks } }),
      },
      // (a playtest's goes in the log, which keeps to the usual size; a player's own may be longer)
      { inputs: playtest ? REPLAY_LIMITS.inputs : 24000 },
    );
  } catch (e) {
    recorder = null;
    crashlog.error("recorder", e);
  }
  highlights = new HighlightPicker();
}
// A shift begins (a playtest): its record goes with the log and the coverage notes the level.
function beginPlaytestShift(drill) {
  if (playtestBroken) return;
  try {
    if (recorder) crashlog.attach("replays", recorder.record);
    coverage?.begin({
      level: sim.level,
      drill: drill?.id || "",
      name: sim.config.name,
      booking: activeBooking || "",
    });
    touchCoverage();
  } catch (e) {
    playtestBroken = true;
    recorder = null;
    crashlog.error("playtest", e);
  }
}
// The log as the live copy sends it (playtest.mjs's LiveSender decides when). Nothing is written to the log for a send that worked, or the
// log would change by being sent: only a change from working to not working, and back.
async function sendLive() {
  const session = crashlog.session;
  crashlog.flush(true);
  const result = await postReport(reportPayload(crashlog, session, reportPrefs.device, { slim: true }));
  if (result.ok !== liveWorked) {
    liveWorked = result.ok;
    crashlog.crumb("report", result.ok ? "live copy is going through" : "live copy failed: " + result.error);
  }
  return result;
}
// Every frame of a playtest: the pulse (where everything is, every few seconds, quicker while an incident runs) and the live copy.
function playtestTick(dt) {
  if (playtestBroken) return;
  try {
    const busy = !!(sim.activeSystems().length || sim.rescue);
    if (mode === "playing") {
      pulseClock += dt;
      if (pulseClock > (busy ? 2.5 : 8)) {
        pulseClock = 0;
        crashlog.crumb("pulse", tracer.pulse(sim));
      }
    }
    const wall = performance.now();
    if (live && wall - liveAt > 1000) {
      liveAt = wall;
      const changed = crashlog.rev !== liveRev;
      liveRev = crashlog.rev;
      const want = liveWant({ mode, changed });
      // (`nolog`: a playtest's log goes out when the shift is over, not while it is played.)
      if (want && !(tuning.has("nolog") && ["playing", "countdown"].includes(mode))) live.dirty(want);
      live.poll();
    }
  } catch (e) {
    playtestBroken = true;
    crashlog.error("playtest", e);
  }
}
const crampCandidate = () =>
  sim.level >= 2 && !sim.rescue && !sim.cleanup
    ? sim.people.find(
        (p) =>
          p.status === "swim" &&
          !p.problem &&
          !p.sick &&
          !p.crampDone &&
          // (At the Lazy River: a rider in sight, away from the cave and the tunnel.)
          (sim.venue.river
            ? !p.away && p.s > sim.venue.river.start + 4 && p.s < sim.venue.river.end - 4
            : Math.abs(p.z) < 5.6),
      )
    : null;
// Why a trigger is not offered right now, or "" when it is.
function triggerBlocker(key) {
  if (!ptPaused || ptResume !== "playing") return "start a shift";
  if (key === "cramp")
    return sim.level < 2
      ? "from level 2"
      : sim.rescue || sim.cleanup
        ? "something is going on"
        : crampCandidate()
          ? ""
          : "nobody is swimming";
  const system = sim.system(key);
  return system ? sim.chaosBlocker(system, true) : "not in this build";
}
// The models a shift that plans the incident fetches as it begins (loadCannonballMan, loadFishKid below): a forced incident
// fetches them first, or the tester would see the classic Carl and kid where a player sees the models.
function incidentModels(key) {
  if (activeSwimmerChoice() !== "models") return [];
  if (key === "carl") return [loadFigure(cannonballMan(sim.config, sim.level).id)];
  if (key === "fish") return [loadFigure("kid"), loadFishModel()];
  return [];
}
let ptTriggering = false;
async function triggerNow(key) {
  if (ptTriggering || triggerBlocker(key)) return;
  const fetching = incidentModels(key);
  if (fetching.length) {
    // (the shift waits behind the panel, which says so; a slow connection does not hold it for more than a few seconds)
    ptTriggering = true;
    toast("Playtest: fetching the models…");
    try {
      await Promise.race([Promise.all(fetching), new Promise((resolve) => setTimeout(resolve, 6000))]);
    } catch {}
    ptTriggering = false;
    if (triggerBlocker(key)) return; // (the panel was closed, or the shift ended, while they came)
  }
  closePlaytest(); // the shift runs again first: an incident starts in a running shift
  let ok = false;
  try {
    if (key === "cramp") {
      const p = crampCandidate();
      ok = !!p && sim.startCramp(p);
    } else ok = sim.triggerChaos(key);
  } catch (e) {
    crashlog.error("playtest:trigger", e);
  }
  crashlog.crumb(
    "playtest",
    "trigger " + key + (ok ? " ok" : " refused") + " · t" + Math.round(sim.time) + "s",
  );
  toast(ok ? "Playtest: " + key + " started." : "That cannot start right now.");
}
function showPlaytest() {
  if ($("playtest-dialog").open) return;
  releaseMouse();
  ptPaused = ["playing", "countdown"].includes(mode);
  if (ptPaused) {
    ptResume = sim.status;
    input.clear();
    sim.clearInput();
    accumulator = 0;
    sim.status = "paused";
    audio.playing = false;
    mode = "playtest";
  }
  crashlog.crumb("playtest", "panel opened" + (ptPaused ? " · t" + Math.round(sim.time) + "s" : ""));
  renderPlaytest();
  $("playtest-dialog").showModal();
  clearInterval(ptTimer);
  ptTimer = setInterval(renderPlaytestStatus, 1000);
}
function closePlaytest() {
  clearInterval(ptTimer);
  if ($("playtest-dialog").open) $("playtest-dialog").close();
  if (ptPaused) {
    sim.status = ptResume;
    mode = ptResume;
    audio.playing = mode === "playing";
  }
  ptPaused = false;
}
function renderPlaytestStatus() {
  const line = $("playtest-live");
  if (live) {
    line.textContent = live.describe();
    line.classList.toggle("bad", live.failures > 0 || live.dead);
  } else {
    line.textContent = reportsOpen()
      ? ""
      : "Not sending: this page is not served from the site (the desktop app, or a file). The log stays on this device: copy the report below.";
    line.classList.add("bad");
  }
  const active = ptPaused
    ? sim
        .activeSystems()
        .map((x) => x.key)
        .join(", ")
    : "";
  $("playtest-map").hidden = !ptPaused;
  $("playtest-where").textContent = ptPaused
    ? "Level " +
      sim.level +
      ' "' +
      (sim.config?.name || "") +
      '" · ' +
      Math.round(sim.time) +
      " s" +
      (active ? " · " + active : "")
    : "On the map (no shift running)";
}
function renderPlaytest() {
  renderPlaytestStatus();
  $("playtest-code").textContent = reportPrefs.device;
  for (const b of $("playtest-reasons").querySelectorAll("button"))
    b.setAttribute("aria-pressed", String(b.dataset.reason === ptReason));
  const box = $("playtest-triggers");
  box.replaceChildren();
  for (const [key, label] of TRIGGERS) {
    const why = triggerBlocker(key),
      b = document.createElement("button");
    b.type = "button";
    b.dataset.trigger = key;
    b.disabled = !!why;
    b.textContent = label;
    if (why) {
      const small = document.createElement("small");
      small.textContent = why;
      b.append(small);
    }
    box.append(b);
  }
  const seen = $("playtest-seen"),
    totals = coverage.totals().incidents,
    finished = coverage.finished();
  seen.replaceChildren();
  const add = (cls, text) => {
    const span = document.createElement("span");
    span.className = cls;
    span.textContent = text;
    seen.append(span, document.createElement("br"));
  };
  add("got", "Levels finished: " + (finished.length ? finished.join(", ") : "none yet"));
  add(
    "got",
    "Incidents seen: " +
      (INCIDENT_NAMES.filter((k) => totals[k])
        .map((k) => INCIDENT_KINDS[k] + (totals[k] > 1 ? " ×" + totals[k] : ""))
        .join(", ") || "none yet"),
  );
  const missing = INCIDENT_NAMES.filter((k) => !totals[k]).map((k) => INCIDENT_KINDS[k]);
  if (missing.length) add("none", "Not yet: " + missing.join(", "));
}
function flagProblem() {
  const note = $("playtest-note").value.trim();
  logState();
  // (the shift waits behind the panel, but the flag is about the shift: its state says "playing", not "playtest")
  crashlog.setState({ mode: ptPaused ? ptResume : mode });
  if (ptPaused) crashlog.crumb("pulse", tracer.pulse(sim)); // where everything is, at the moment of the flag
  crashlog.flag(note, { kind: ptReason });
  coverage?.flag();
  saveCoverage();
  live?.dirty("urgent");
  $("playtest-note").value = "";
  closePlaytest();
  toast("Flagged ✓ " + (live ? "It is on its way to the developer." : "It is in the log."));
}
function bindPlaytest() {
  $("playtest").hidden = !playtest;
  document.body.classList.toggle("playtest", playtest);
  if (!playtest) return;
  $("playtest").onclick = showPlaytest;
  $("playtest-close").onclick = $("playtest-x").onclick = closePlaytest;
  $("playtest-dialog").addEventListener("cancel", (e) => {
    e.preventDefault();
    closePlaytest();
  });
  $("playtest-reasons").onclick = (e) => {
    const b = e.target.closest("button[data-reason]");
    if (!b) return;
    ptReason = b.dataset.reason;
    for (const x of $("playtest-reasons").querySelectorAll("button"))
      x.setAttribute("aria-pressed", String(x === b));
  };
  $("playtest-flag").onclick = flagProblem;
  // Out of the shift behind the panel and onto the map (what the pause dialog has no button for): the shift stops where it is.
  $("playtest-map").onclick = () => {
    crashlog.crumb(
      "playtest",
      "back to the map from the panel" + (ptPaused ? " · t" + Math.round(sim.time) + "s" : ""),
    );
    clearInterval(ptTimer);
    ptPaused = false;
    returnMenu();
  };
  $("playtest-triggers").onclick = (e) => {
    const b = e.target.closest("button[data-trigger]");
    if (b && !b.disabled) triggerNow(b.dataset.trigger);
  };
  $("playtest-code-copy").onclick = async () => {
    const button = $("playtest-code-copy");
    button.textContent = (await copyText(reportPrefs.device)) ? "Copied ✓" : "Copy failed";
    setTimeout(() => (button.textContent = "Copy code"), 1800);
  };
  $("playtest-send").onclick = async () => {
    const button = $("playtest-send");
    button.disabled = true;
    live?.dirty("urgent");
    await live?.flushNow();
    button.disabled = false;
    renderPlaytestStatus();
  };
  $("playtest-copy").onclick = async () => {
    const button = $("playtest-copy");
    button.textContent = (await copyText(
      crashlog.report(crashlog.session, { device: reportPrefs.device, replay: 1 }),
    ))
      ? "Copied ✓"
      : "Copy failed";
    setTimeout(() => (button.textContent = "Copy the report"), 1800);
  };
  $("playtest-reset").onclick = () => {
    coverage = new Coverage();
    saveCoverage();
    crashlog.crumb("playtest", "notes started over");
    renderPlaytest();
  };
  $("playtest-off").onclick = () => {
    savePlaytest(crashStorage, false);
    const url = new URL(location.href);
    url.searchParams.delete("playtest");
    location.replace(url);
  };
  // The page going into the background: the newest copy goes now (a moment later, after the log has noted it). The page going away:
  // at once, there may be no later.
  document.addEventListener(
    "visibilitychange",
    () => document.hidden && setTimeout(() => live?.flushNow(), 0),
  );
  window.addEventListener("pagehide", () => live?.flushNow());
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
// The Aqua Disco has zones of open water where the other pools have lanes (the same thing to the simulation).
const laneWord = (sim) => (sim?.venue?.class ? "Zone" : sim?.venue?.onsen ? "Spring" : "Lane");
function renderLaneControls(venue) {
  // The kit's names: the Lazy River's rack and the Wave Pool's hut hold tubes, not fins.
  const tubes = venue.river || venue.waves;
  $("fins").innerHTML = tubes
    ? '<span>🛟</span>Tubes <b id="fin-count">' + (venue.tubes ?? 3) + "</b><kbd>F</kbd>"
    : '<span>🦶</span>Fins <b id="fin-count">3</b><kbd>F</kbd>';
  $("fins").title = tubes
    ? "Walk to the tube " + (venue.waves ? "hut" : "rack") + " · E to pick up"
    : "Walk to the fin rack · E to pick up";
  // The Lazy River has no lanes either: one button sends a guest with a tube off to the boarding dock.
  if (venue.river) {
    $("lane-controls").innerHTML =
      // (Two ways round since Phase 3: 1 the lazy loop, 2 the rapids, river-ride.mjs ROUTES.)
      `<button class="lane-btn pool-btn river-btn" data-lane="river" data-route="0" aria-label="Send the selected guest round the lazy loop"><div class="lane-top"><span class="lane-no">🐢 LAZY<kbd>1</kbd></span><span class="lane-mode">OPEN</span></div><div class="lane-bottom"><span class="lane-count">Hand a guest a tube</span><span class="lane-caps"></span></div></button>` +
      `<button class="lane-btn pool-btn river-btn" data-lane="river" data-route="1" aria-label="Send the selected guest down the rapids"><div class="lane-top"><span class="lane-no">⚡ RAPIDS<kbd>2</kbd></span><span class="lane-mode">OPEN</span></div><div class="lane-bottom"><span class="lane-count">For thrill-seekers</span><span class="lane-caps"></span></div></button>`;
    $("lane-controls").classList.remove("five-lanes");
    return;
  }
  // The Rooftop Pool has no lanes and nobody is sent anywhere: its one button is the bar (a tray of margaritas, 1 or F), and it
  // shows the orders waiting and the DJ's next drop.
  if (venue.roof) {
    // (Since Phase 3 the coach seats the guests waiting by the lift: 1 the water, 2 a sunbed, 3 a cabana, rooftop.mjs SEATS.)
    $("lane-controls").innerHTML =
      SEATS.map(
        (s, i) =>
          `<button class="lane-btn pool-btn seat-btn" data-lane="seat" data-seat="${i}" aria-label="Seat the selected guest: ${s.name.toLowerCase()}"><div class="lane-top"><span class="lane-no">${s.icon} ${s.name}<kbd>${i + 1}</kbd></span><span class="lane-mode">OPEN</span></div><div class="lane-bottom"><span class="lane-count"></span><span class="lane-caps"></span></div></button>`,
      ).join("") +
      `<button class="lane-btn pool-btn bar-btn" data-lane="bar" aria-label="Get a tray of margaritas from the bar"><div class="lane-top"><span class="lane-no">🍹 BAR<kbd>B</kbd></span><span class="lane-mode">OPEN</span></div><div class="lane-bottom"><span class="lane-count">No orders yet</span><span class="lane-caps"></span></div></button>`;
    $("lane-controls").classList.add("five-lanes");
    $("fins").innerHTML = '<span>🍹</span>Tray <b id="fin-count">3</b><kbd>F</kbd>';
    $("fins").title = "Walk to the bar · E for a tray of margaritas";
    return;
  }
  // The Wave Pool has no lanes and nobody is sent in: one button stops the wave machine, or starts it again.
  if (venue.waves) {
    $("lane-controls").innerHTML =
      `<button class="lane-btn pool-btn waves-btn" data-lane="waves" aria-label="Stop the waves, or start them again"><div class="lane-top"><span class="lane-no">🌊 WAVES</span><span class="lane-mode">ON</span></div><div class="lane-bottom"><span class="lane-count">Press 1 to stop</span><span class="lane-caps"></span></div></button>`;
    $("lane-controls").classList.remove("five-lanes");
    return;
  }
  // The Kids Pool has no lanes: one button sends the kid the coach has caught into the pool (its emptiest zone, sim.poolLane).
  if (venue.kids) {
    $("lane-controls").innerHTML =
      `<button class="lane-btn pool-btn" data-lane="pool" aria-label="Send the kid you caught into the pool"><div class="lane-top"><span class="lane-no">🌊 POOL</span><span class="lane-mode">OPEN</span></div><div class="lane-bottom"><span class="lane-count">Catch a kid first</span><span class="lane-caps"></span></div></button>`;
    $("lane-controls").classList.remove("five-lanes");
    return;
  }
  const word = venue.class ? "ZONE" : venue.onsen ? "SPRING" : "LANE";
  $("lane-controls").innerHTML =
    venue.lanes
      .map(
        (x, i) =>
          `<button class="lane-btn" data-lane="${i}" aria-label="Assign selected swimmer to ${word.toLowerCase()} ${i + 1}"><div class="lane-top"><span class="lane-no"><span class="lane-word">${word} </span>0${i + 1}</span><span class="lane-mode">OPEN</span></div><div class="lane-bottom"><span class="lane-count">Jump on in</span><span class="lane-caps"></span></div></button>`,
      )
      .join("") +
    (venue.cruise
      ? `<button class="lane-btn pool-btn bar-btn" data-lane="bar" aria-label="Get a tray of margaritas from the bar"><div class="lane-top"><span class="lane-no">🍹<span class="lane-word"> BAR</span></span><span class="lane-mode">OPEN</span></div><div class="lane-bottom"><span class="lane-count">No orders yet</span><span class="lane-caps"></span></div></button>` +
        `<div class="lane-btn ship-gauge" aria-label="How far the ship is rolling"><div class="lane-top"><span class="lane-no">⚓<span class="lane-word"> SHIP</span></span><span class="lane-mode">STEADY</span></div><div class="lane-bottom"><span class="lane-count">0°</span><span class="ship-dial"><i></i></span></div></div>`
      : "") +
    (venue.trampoline
      ? `<button class="lane-btn trampoline-btn" data-lane="trampoline" aria-label="Send selected daredevil to the trampoline"><div class="lane-top"><span class="lane-no">🤸<span class="lane-word"> TRAMP</span></span><span class="lane-mode">READY</span></div><div class="lane-bottom"><span class="lane-count">Daredevils only</span><span class="lane-caps"></span></div></button>`
      : "");
  $("lane-controls").classList.toggle("five-lanes", venue.lanes.length > 3);
}
// ?cannonball=carl or ?cannonball=leopard puts that man in every Cannonball incident, whatever the level (to look at him).
const forcedMan = ["carl", "leopard"].includes(params.get("cannonball")) ? params.get("cannonball") : null;
// A shift with a Cannonball incident has its cannonball man (Carl or the leopard man, by the level) as a model: it is fetched
// while the shift begins, long before the incident, and the classic Carl plays if it is not there in time.
function loadCannonballMan(s) {
  if (activeSwimmerChoice() !== "models" || !s.config.chaos?.some((e) => e.kinds.includes("carl"))) return;
  loadFigure(cannonballMan(s.config, s.level).id);
}
// The same for the fish kid and his bucket (about 1.5 MB): a shift that can have the fish incident fetches them as it begins.
function loadFishKid(s) {
  // (The Kids Pool's children all wear his model: fetched as the shift begins there, whatever the incidents.)
  if (activeSwimmerChoice() === "models" && s.venue.kids) loadFigure("kid");
  // (And Senior Aqua Fit's four seniors, about 4.5 MB together, fetched as a shift there begins.)
  if (activeSwimmerChoice() === "models" && s.venue.seniors) for (const id of SENIOR_LOOKS) loadFigure(id);
  if (activeSwimmerChoice() !== "models" || !s.config.chaos?.some((e) => e.kinds.includes("fish"))) return;
  loadFigure("kid");
  loadFishModel(); // (and the fish he lets go: scene/fish-model.mjs)
}
// And a star guest (the Aquatic Centre's Marco): his model is fetched as the shift begins; until it is there he is a swimmer like
// any other (the classic figure, then the model once loaded).
function loadStar(s) {
  if (activeSwimmerChoice() !== "models" || !s.config.star) return;
  loadFigure(s.config.star.id);
}
// Begin the shift the map has selected: a level (with a booking from Splash Park on) or a chunk's drill.
// The week (week.mjs, week-ui.mjs) is the main game: `week` is the shift it built (its blueprint tier, its config with the director's
// incidents, a booking, the shop's perks). Without one, a level of the map (free play) or a drill.
let weekShift = null,
  weekUi = null;
function start(bookingId = null, week = null) {
  weekShift = week;
  audio.panic = false;
  clearTimeout(toastTimer);
  $("toast").hidden = true;
  input?.clear();
  accumulator = 0;
  document.activeElement?.blur();
  document.querySelectorAll("dialog[open]").forEach((d) => d.close());
  const drill = !week && selected.kind === "drill" ? DRILLS[selected.id] : null;
  activeBooking = week ? week.booking : drill ? null : bookingId;
  runSeed = nextSeed || Date.now();
  nextSeed = 0;
  const man = forcedMan && { cannonball: forcedMan };
  // Free play's added guests (Marco, VIPs: freePlayGuests, from the seed); never in a trial or a hunt, which replay old recordings.
  // The shift's record carries them, so a replay builds the same shift.
  shiftGuests = !week && !drill && !testing ? freePlayGuests(runSeed, level) : null;
  if (shiftGuests && !Object.keys(shiftGuests).length) shiftGuests = null;
  sim = week
    ? new PoolSimulation(week.tier, runSeed, {
        config: { ...week.config, ...man },
        booking: week.booking,
        perks: week.perks,
      })
    : drill
      ? new PoolSimulation(drill.tier, runSeed, { config: { ...drill.config, ...man }, drill: drill.id })
      : new PoolSimulation(level, runSeed, {
          booking: activeBooking,
          config: { ...SHIFTS[level - 1], ...shiftGuests, ...man },
        });
  tutor = sim.config.tutorial ? new Tutor() : null;
  $("tutor").hidden = true;
  syncVenue(sim);
  world.resetActors();
  tracer.reset();
  startRecorder(drill);
  if (playtest) beginPlaytestShift(drill);
  loadCannonballMan(sim);
  loadFishKid(sim);
  loadStar(sim);
  for (const name of sim.venue.props || ["mop", "mop-bucket"]) loadProp(name);
  richPresence(
    week
      ? "Week " + week.chapter.id + " · " + week.day
      : drill
        ? "Drill · " + drill.name
        : "Level " + level + " · " + sim.config.name,
  );
  weekUi?.hideMenu();
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
  $("queue-panel").hidden = true;
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
      (activeBooking ? " · booking " + activeBooking : "") +
      (week ? " · week " + week.chapter.id + " shift " + (week.index + 1) : ""),
  );
  try {
    crashlog.crumb("plan", tracer.plan(sim));
  } catch {}
  live?.dirty("urgent");
}
// The Graphics row of Help: the six choices, which one is on, and what the crash safety holds back.
let qualityPending = false;
function renderQuality() {
  const chosen = settings.quality || "auto";
  $("quality-buttons").innerHTML = QUALITY_CHOICES.map(
    (id) =>
      `<button class="quality-btn${id === chosen ? " on" : ""}" data-quality="${id}" aria-pressed="${id === chosen}">${id === "auto" ? "Auto" : qualityOf(id).name}</button>`,
  ).join("");
  const capped = gfx.plan.tier > 0;
  $("quality-note").textContent = qualityPending
    ? "Saved. It switches when you are back on the menu."
    : capped
      ? `Held back after a shift stopped the browser (${gfx.plan.says}).`
      : chosen === "auto"
        ? "Auto: Standard, lighter on phones and tablets."
        : chosen === "ultra"
          ? "Ultra draws more pixels than the screen has: for strong graphics cards."
          : "";
  $("quality-reset").hidden = !capped || qualityPending;
}
// The On-screen controls row of Help: the walk pad and the Dash, Jump and Interact buttons. Auto shows them on a touch screen; On shows them
// whatever the pointer (an iPad playing the desktop app through Steam Link sends its touches as mouse clicks); Off hides them.
const TOUCHPAD_CHOICES = [
  ["auto", "Auto"],
  ["on", "On"],
  ["off", "Off"],
];
function renderTouchpad() {
  const chosen = settings.touchpad || "auto";
  document.body.classList.toggle("touchpad-on", chosen === "on");
  document.body.classList.toggle("touchpad-off", chosen === "off");
  $("touchpad-buttons").innerHTML = TOUCHPAD_CHOICES.map(
    ([id, name]) =>
      `<button class="quality-btn${id === chosen ? " on" : ""}" data-touchpad="${id}" aria-pressed="${id === chosen}">${name}</button>`,
  ).join("");
  $("touchpad-note").textContent =
    chosen === "on"
      ? "The walk pad and the action buttons show during a shift, for a mouse too (Steam Link on an iPad)."
      : chosen === "off"
        ? "Hidden, even on a touch screen."
        : "Auto: shown on touch screens.";
}
function returnMenu() {
  if (qualityPending) return location.reload(); // a new graphics quality takes a fresh start (everything is saved)
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
  weekShift = null;
  weekUi?.dismiss();
  clearBubbles();
  syncUnlocks();
  updateMenu(reveal);
  weekUi?.menu();
  renderFund();
  updateUI();
  $(document.body.classList.contains("freeplay") ? "start" : "wk-go").focus({ preventScroll: true });
}
// The levels the week's run has passed open in free play (week.mjs `unlocked`).
function syncUnlocks() {
  const run = weekUi?.save?.unlocked || 1;
  if (run > records.unlocked) {
    records.unlocked = Math.min(SHIFTS.length, run);
    saveRecords?.();
  }
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
      notes = shiftHighlights(shift, level);
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
  // (A booking that brings the cannonball man brings the one this level has.)
  const noted = (b) => b.note.replace("Cannonball Carl", "Cannonball " + cannonballMan(shift, level).name);
  $("booking-cards").innerHTML = offer
    .map(
      (b) =>
        `<button class="booking-card${b.id === "regular" ? " regular" : ""}" data-booking="${b.id}" aria-label="${b.name}, payout ×${b.payout}. ${noted(b)}"><span class="b-icon" aria-hidden="true">${b.icon}</span><strong>${b.name}</strong><span class="b-pay">×${b.payout}<small>PAYOUT</small></span><span class="b-note">${noted(b)}</span><span class="b-trouble" aria-hidden="true">${b.trouble.join(" ")}</span></button>`,
    )
    .join("");
  $("booking-dialog").showModal();
  $("booking-cards").firstElementChild.focus();
}
// HUD line: which chunk of three you are in ("WARM-UP · 2 OF 3"), or that this is a drill.
function shiftTag() {
  const weekTag = weekUi?.hudTag(sim.config);
  if (weekTag) return weekTag;
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
  menuLook(true);
  $("pause-dialog").showModal();
  logState();
  crashlog.crumb("pause", "at " + Math.round(sim.time) + " s");
}
// The ⚙ button: in a shift it pauses it and opens the menu (resume, how to play, sound, full screen, the camera, restart);
// anywhere else the same menu opens as settings, with nothing to pause.
function openMenu() {
  if (["playing", "countdown"].includes(mode)) return pause();
  if (mode === "paused") return resume();
  if ($("pause-dialog").open) return closeSettings();
  releaseMouse();
  menuLook(false);
  $("pause-dialog").showModal();
}
function closeSettings() {
  if ($("pause-dialog").open) $("pause-dialog").close();
}
function menuLook(paused) {
  $("pause-eyebrow").textContent = paused ? "TAKE A BREATHER" : "POOL PANIC";
  $("pause-title").textContent = paused ? "TAKE FIVE." : "SETTINGS";
  $("resume").innerHTML = paused ? "BACK IN ▶" : "Close";
  $("restart").hidden = !paused;
  $("camera-row").hidden = !paused;
}
function resume() {
  if (mode !== "paused") return closeSettings();
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

// The results' numbers and the tip (a free-play level, a drill or a shift of the week).
function renderResultDetails(r, drill) {
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
          ? cannonballMan(sim.config, sim.level).name +
            " hits the deck running. Meet him before the edge and show him the red card."
          : r.collisions > 2
            ? "Traffic was your biggest troublemaker. Pair similar speeds and keep aqua out of fast lanes."
            : r.lost > 3
              ? "The deck queue needs some love. Assign waiting swimmers quickly, even if a lane is not perfect."
              : r.served === 0
                ? "Nobody was served this time. Click a waiting swimmer, then a lane: every swimmer served is points."
                : r.stars === 3
                  ? drill
                    ? "Three stars! Try the next chunk, or beat this run with an even longer happy streak."
                    : "Three stars! Try the next shift, or beat this run with an even longer happy streak."
                  : "A new arrival mix awaits. Can you keep the happy streak going just a little longer?";
}
// A shift of the week is over: the week's part of the results (week-ui.mjs), and its buttons.
function finishWeek() {
  const r = sim.summary(),
    ws = weekShift;
  achievements.shift({
    stars: r.stars,
    drill: false,
    levelStars: (n) => starsFor(n, records.bests[n - 1] || 0),
    levels: SHIFTS.length,
  });
  richPresence("Looking at the results");
  if (coverage)
    try {
      coverage.finish({ score: r.score, stars: r.stars });
      saveCoverage();
      live?.dirty("urgent");
    } catch (e) {
      crashlog.error("playtest", e);
    }
  const res = weekUi.finish(r, sim.stats);
  if (!res) return returnMenu();
  if (res.won && res.chapter.date.id === "ocean" && !res.chapter.heat) achievements.fund();
  $("result-eyebrow").textContent =
    `WEEK ${ws.chapter.id} · ${ws.day.toUpperCase()} · ${ws.place.toUpperCase()}` +
    (ws.finale ? " · SEASON FINALE" : "") +
    (ws.card && ws.card.id !== "regular" ? " · " + ws.card.name.toUpperCase() : "") +
    (res.failed ? " · NOT PASSED" : " · SHIFT COMPLETE");
  $("result-stars").textContent = Array.from({ length: 3 }, (_, i) => (i < r.stars ? "★" : "☆")).join(" ");
  $("result-title").textContent = res.won
    ? res.finale
      ? "The season is yours! And it's a date 💖"
      : "It's a date! 💖"
    : res.over
      ? "Not enough for the date…"
      : res.failed
        ? "The pool fell apart. Tomorrow's another day."
        : r.stars === 3
          ? "You absolute pool legend."
          : r.stars === 2
            ? "So close to pool perfection."
            : r.stars === 1
              ? "You kept your head above water."
              : "Passed, just. Phew.";
  $("result-score").innerHTML = r.score.toLocaleString() + "<small>POINTS</small>";
  $("new-best").hidden = true;
  $("result-fund").hidden = true;
  $("result-chunk").hidden = true;
  renderResultDetails(r, null);
  renderFund(res.gained > 0);
  $("next-level").hidden = false;
  $("next-level").textContent = weekUi.nextLabel();
  $("play-again").hidden = true;
  $("back-menu").textContent = "Back to the menu";
  $("results-dialog").showModal();
  $("next-level").focus({ preventScroll: true });
  $("results-dialog").scrollTop = 0;
  offerHighlight();
  if (!res.failed) world.confetti();
  if (res.won) audio.cheer(2);
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
  if (sim.config.week && weekUi) return finishWeek();
  $("result-week").hidden = true;
  $("play-again").hidden = false;
  $("back-menu").textContent = "Back to the map";
  const r = sim.summary(),
    drill = sim.drill ? DRILLS[sim.drill] : null,
    played = sim.level,
    zone = drill ? null : zoneOfLevel(played),
    before = zone && zoneStatus(records, zone, progressFlags),
    starsBefore = drill ? 0 : starsFor(played, records.bests[played - 1] || 0),
    newBest = drill ? recordDrill(records, drill.id, r.score) : recordResult(records, played, r.score),
    after = zone && zoneStatus(records, zone, progressFlags);
  saveRecords();
  if (coverage)
    try {
      coverage.finish({ score: r.score, stars: r.stars });
      saveCoverage();
      live?.dirty("urgent");
    } catch (e) {
      crashlog.error("playtest", e);
    }
  achievements.shift({
    stars: r.stars,
    drill: !!drill,
    levelStars: (n) => starsFor(n, records.bests[n - 1] || 0),
    levels: SHIFTS.length,
  });
  richPresence("Looking at the results");
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
  if (pay.reached) {
    story.ending = true;
    achievements.fund();
  }
  if (pay.gained || pay.reached) saveStory();
  $("result-fund").hidden = true; // (the Ocean Fund still counts in free play; the week's Date Fund is the one on screen)
  void booked;
  renderFund(false);
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
  renderResultDetails(r, drill);
  $("next-level").hidden = drill
    ? true
    : nextMode === "level" && (played >= SHIFTS.length || !isUnlocked(records, played + 1));
  $("next-level").textContent =
    nextMode === "map" ? "Next area ↗" : "Next shift · Level " + (played + 1) + " →";
  $("play-again").textContent = drill ? "Replay drill ↻" : "Replay level " + played + " ↻";
  $("play-again").className = $("next-level").hidden ? "primary" : "secondary";
  $("results-dialog").showModal();
  // (focus the main button without scrolling to it: on a 720p screen the card used to open scrolled to the bottom, with its
  // stars and score cut off)
  ($("next-level").hidden ? $("play-again") : $("next-level")).focus({ preventScroll: true });
  $("results-dialog").scrollTop = 0;
  offerHighlight();
  if (r.stars > 0) world.confetti();
  if (chunkDone) audio.cheer(2); // a chunk cleared is worth a crowd cheer of its own
}
const CARRY_NAMES = {
  lifering: "life ring",
  relief: "eye relief",
  treats: "dog treats",
  flashlight: "flashlight",
  medkit: "medical kit",
  mop: "mop",
};
function carryName(c) {
  if (c.carry === "skimmer") return c.skimmerLoaded ? "loaded skimmer" : "pool skimmer";
  if (c.carry === "fishnet") return c.netLoaded ? "net with the fish 🐟" : "fish net";
  if (c.carry === "fins" && (sim?.venue?.river || sim?.venue?.waves)) return "a tube 🛟";
  if (c.carry === "tray") return "a tray · " + (c.tray || 0) + " 🍹";
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
  if (p.stomachWarning) return p.sickKind === "pee" ? "🚽" : "💩";
  if (p.ask && p.status === "swim" && !p.problem) return "📣";
  // (Waiting by the lift on the roof: what they would like, Phase 3.)
  if (sim.venue.roof && p.status === "queue") return { pool: "💬", bed: "🛏️", cabana: "👑" }[p.wish] || "💬";
  if (p.problem === "dizzy") return "💫";
  // (The Rooftop Pool: an order, a selfie on the edge, overboard, and a tipsy guest.)
  if (p.status === "overboard") return "🆘";
  if (p.problem === "selfie") return "📸";
  if (p.problem === "drink") return "🍹";
  if (p.status === "fell-in") return "🆘";
  if ((sim.venue.roof || p.chill) && p.goal === "waitbed" && p.status === "enter") return "🛏️";
  if (p.problem === "cramp" && p.under) return "🌊";
  if (p.status === "panic" || p.status === "evacuating" || p.status === "fleeing") return "😱";
  if (p.status === "queue" && sim.fish?.stage === "loose") return "😱";
  // (The hot springs: a monkey in their spring, or freezing in the snow.)
  if (p.monkeyScare && p.status === "swim") return "😱";
  if (sim.venue.onsen && p.status === "queue" && (p.cold || 0) > SOAK.coldFrom) return "🥶";
  return p.problem === "fins"
    ? sim.venue.river || sim.venue.waves
      ? "🛟"
      : "🦶"
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
                  : p.tipsy
                    ? "🥴"
                    : p.status === "queue"
                      ? roofLook(p).icon
                      : "🙂";
}
function cardStatus(p) {
  // The hot springs: how cold they are getting in the snow, where they are off to, a monkey in their spring.
  if (sim.venue.onsen && !p.stomachWarning && !p.problem) {
    const cold = p.cold || 0;
    if (p.status === "queue")
      return (
        roofLook(p).label +
        (cold > 0.75
          ? " · ❄️ FREEZING! Send them to a spring"
          : cold > SOAK.coldFrom
            ? " · ❄️ getting cold"
            : "")
      );
    if (p.status === "enter") return "Off to Spring " + (p.lane + 1);
    if (p.status === "swim")
      return "Spring " + (p.lane + 1) + (p.monkeyScare ? " · 🐒 A MONKEY! Panicking" : " · soaking ♨️");
  }
  if (p.status === "queue")
    return p.type === "daredevil"
      ? "Daredevil · wants the trampoline"
      : p.finsFirst && !p.hasFins
        ? roofLook(p).label + (sim.venue.river ? " · wants a tube" : " · wants fins first")
        : p.finsFirst && sim.venue.river
          ? roofLook(p).label + " · has a tube: send them down the river"
          : p.wheelchair && !p.chairParked
            ? roofLook(p).label + " · ♿ in a wheelchair"
            : roofLook(p).label;
  if (p.status === "injured") return p.healing ? "Being bandaged…" : "Hurt · needs the med kit";
  if (p.status === "fell-in") return "In the pool! · help them out at the edge (E)";
  if (sim.venue.roof || p.chill) return roofStatus(p);
  // (The Wave Pool's guests on their way down to the beach: the coach's chance to hand them a tube.)
  if (p.status === "enter" && sim.venue.waves)
    return (
      roofLook(p).label +
      (p.hasFins ? " · has a tube" : p.needsFins ? " · heading in · hand them a tube!" : " · heading in")
    );
  const where = sim.venue.waves
    ? "In the waves"
    : sim.venue.river
      ? p.away
        ? p.route === "rapids"
          ? "Shooting the rapids!"
          : "Round the bend"
        : p.route === "rapids"
          ? "Back from the rapids"
          : "On the lazy loop"
      : p.lane == null
        ? "In the pool"
        : laneWord(sim) + " " + (p.lane + 1);
  return (
    where +
    " · " +
    (p.stomachWarning
      ? "Stomach trouble"
      : p.problem === "injured"
        ? "Hurt · needs a ring"
        : p.problem === "fins"
          ? sim.venue.river
            ? "Needs a tube"
            : "Needs fins"
          : p.problem === "eyes"
            ? "Sore eyes"
            : p.problem === "cramp"
              ? p.under
                ? "Knocked under!"
                : "Cramp"
              : p.problem === "dizzy"
                ? "Dizzy! Get them out"
                : "Lost goggles")
  );
}
// The Rooftop Pool's line on a guest's card: where they are, and what they want.
function roofStatus(p) {
  const kind = roofLook(p).label;
  if (p.status === "overboard") return "OVERBOARD! Haul them back (E at the edge)";
  if (p.problem === "selfie") return "📸 Selfie on the edge! Stop them";
  if (p.stomachWarning)
    return (p.sickKind === "pee" ? "Needs a wee" : "Stomach trouble") + " · send them home";
  const where =
    p.status === "lounge"
      ? ROOF_BEDS_CABANA(p)
      : p.status === "swim"
        ? "In the pool"
        : p.status === "enter"
          ? p.goal === "waitbed"
            ? sim.venue.cruise
              ? "Waiting for a lounger!"
              : "Waiting for a free sunbed!"
            : p.goal === "bed"
              ? sim.venue.cruise
                ? "Off to a lounger"
                : "Off to a sunbed"
              : "Off to the water"
          : p.status === "queue"
            ? "Waiting by the lift · wants " +
              wishWord(p) +
              " (" +
              ({ pool: "1", bed: "2", cabana: "3" }[p.wish] || "1") +
              ")"
            : kind;
  return (
    where +
    (p.problem === "drink"
      ? " · wants a margarita! 🍹"
      : p.problem === "eyes"
        ? " · sore eyes"
        : p.tipsy
          ? " · tipsy 🥴"
          : "")
  );
}
const ROOF_BEDS_CABANA = (p) =>
  sim.venue.cruise
    ? sim.roof?.beds[p.bed]?.adrift
      ? "On a lounger adrift! · straighten the row"
      : "On a lounger"
    : p.vip && p.bed >= 12
      ? "In a cabana 👑"
      : "On a sunbed";
// What a guest is up on the roof: a sunbather, a socialite or a party animal (rooftop.mjs GUEST_KIND), a VIP of one of those.
function roofLook(p) {
  const look = baseSwimmerLook(p);
  if (!(sim?.venue?.roof || p.chill) || !GUEST_KIND[p.type]) return look;
  return { ...look, label: (p.vip ? "VIP · " : "") + GUEST_KIND[p.type] };
}
function formatTime(t) {
  const s = Math.max(0, Math.ceil(t));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}
// The deck's guests are not listed (20 October 2026, the creator: "no need to show all of the cards on the left… we are
// already seeing that on top of each swimmer"): their names, needs and moods ride on the tags over them. What is left is a small
// chip for the guest the coach has selected, with what they are doing and the Send home button (a queasy guest is stopped there).
function updateQueue() {
  const p = sim.get(sim.selected);
  $("send-home").textContent = p?.stomachWarning ? "Send to locker ↗" : "Send home ↗";
  $("send-home").classList.toggle("urgent", !!p?.stomachWarning);
  $("queue-panel").hidden = !p || !["playing", "paused", "countdown", "help"].includes(mode);
  $("send-home").hidden =
    !p ||
    !["queue", "enter", "swim"].includes(p.status) ||
    p.problem === "injured" ||
    !!(sim.rescue && p.status === "swim");
  if (p) {
    const profile = roofLook(p);
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
        : p.type === "child"
          ? p.status === "queue"
            ? "Caught! Send them INTO THE POOL · 1"
            : "Splashing about"
          : sim.venue.roof || p.chill
            ? (p.status === "lounge"
                ? "Lounging"
                : p.status === "swim"
                  ? p.chatting
                    ? "Chatting in the pool"
                    : "Chilling in the pool"
                  : sim.venue.cruise
                    ? "On deck"
                    : "On the roof") +
              (p.drinks ? " · " + p.drinks + " 🍹" : "") +
              (p.tipsy ? " · tipsy 🥴" : "")
            : p.status === "swim" && !p.problem && sim.venue.waves
              ? (p.hasFins ? "Riding the waves in a tube" : "Riding the waves") +
                ((p.dizzy || 0) >= BATHE.woozy ? " · 💫 woozy" : "")
              : p.status === "swim" && !p.problem
                ? sim.venue.river
                  ? p.lap
                    ? "Floating to the exit dock"
                    : "Riding the river"
                  : sim.venue.onsen
                    ? "Soaking in Spring " + (p.lane + 1) + ((p.cold || 0) > 0.1 ? " · warming up" : "")
                    : "Pick a lane to move them"
                : profile.speed
                  ? profile.speed + "× pace"
                  : "Aqua class") +
      "</span>";
  }
}
// The Wave Pool's WAVES button (renderLaneControls): ON with the seconds left of the set, the calm's countdown to the next, the
// horn, a monster on its way (red, flashing), STOPPED by the coach (and for how long: the bathers grow restless), or stopped for an
// emergency. Its dots are the bathers in the water, red for the dizzy ones.
function updateShipGauge(b) {
  const S = sim.ship,
    deg = (S.angle * 180) / Math.PI,
    k = slide(sim),
    warn = S.phase === "warn",
    adrift = sim.roof?.beds.filter((q) => q.adrift).length || 0;
  b.classList.toggle("danger", warn || Math.abs(k) > 0.3);
  b.querySelector(".lane-mode").textContent = warn
    ? "SWELL " + Math.max(1, Math.ceil(S.dur - S.t))
    : k
      ? deg > 0
        ? "STBD ▶"
        : "◀ PORT"
      : "STEADY";
  b.querySelector(".lane-count").textContent =
    Math.abs(deg).toFixed(0) +
    "°" +
    (warn
      ? " · 🔔 hold on!"
      : adrift
        ? " · " + adrift + " lounger" + (adrift > 1 ? "s" : "") + " adrift"
        : "");
  // (The dial's bar shows the deck: it tips the way she rolls, so the screen's left goes down when she leans to port.)
  b.querySelector(".ship-dial i").style.transform = "rotate(" + (-deg * 2).toFixed(1) + "deg)";
}
function updateWavesButton(b) {
  const board = waveBoard(sim.waves);
  if (!board) return;
  const bathers = sim.people.filter((q) => q.status === "swim"),
    dizzy = bathers.filter((q) => q.problem === "dizzy").length,
    secs = board.seconds !== undefined ? Math.max(0, Math.ceil(board.seconds)) : null;
  b.classList.toggle("danger", board.state === "monster" || dizzy > 0);
  b.classList.toggle("assignable", board.state === "stopped");
  b.classList.toggle("waves-off", board.state === "stopped" || board.state === "halted");
  b.querySelector(".lane-mode").textContent =
    board.state === "running"
      ? "ON"
      : board.state === "monster"
        ? "MONSTER!"
        : board.state === "horn"
          ? "HORN"
          : board.state === "calm"
            ? "CALM"
            : board.state === "halted"
              ? board.reason === "blackout"
                ? "NO POWER"
                : "STOPPED"
              : "OFF";
  b.querySelector(".lane-count").textContent =
    board.state === "stopped"
      ? (board.seconds > BATHE.grace ? "They want waves! " : "Stopped · ") + "press Z to start"
      : board.state === "halted"
        ? board.reason === "rescue"
          ? "Stopped for the rescue"
          : board.reason === "blackout"
            ? "Fix the power"
            : "Stopped · pool closed"
        : board.state === "monster"
          ? "Monster in " + secs + " · Z to stop!"
          : board.state === "horn"
            ? "Waves in " + secs
            : board.state === "calm"
              ? "Next set in " + secs + " · Z stops"
              : (dizzy ? dizzy + " dizzy · " : "") + secs + "s left · Z stops";
  b.querySelector(".lane-caps").innerHTML = bathers
    .slice(0, 12)
    .map((q) => '<i style="background:' + (q.problem === "dizzy" ? "#ef5a4a" : roofLook(q).color) + '"></i>')
    .join("");
  b.disabled = mode !== "playing";
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
  const pass = sim.config.week ? passMark(sim.config) : 0;
  $("next-star").classList.toggle("below-pass", sim.score < pass);
  $("next-star").textContent =
    sim.score < pass
      ? (pass - Math.max(0, sim.score)).toLocaleString() + " TO PASS THE SHIFT"
      : n >= 3
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
  $("fin-count").textContent = sim.venue.roof
    ? sim.coach.carry === "tray"
      ? sim.coach.tray
      : CHILL.tray
    : sim.finsAvailable;
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
  // The mop (incidents/wet.mjs): how many wet spots are on the deck, and whether the coach has it.
  const wet = sim.wetSpots?.length || 0;
  $("mop").disabled =
    mode !== "playing" || !!sim.coach.job || (!!sim.coach.carry && sim.coach.carry !== "mop");
  $("mop").classList.toggle("busy-btn", wet > 0 || sim.coach.carry === "mop");
  $("wet-count").hidden = !wet;
  $("wet-count").textContent = wet;
  // A calmer HUD (19 October 2026, Phase 1): a tool that is not needed right now is not on screen. Eye relief shows when someone
  // has sore eyes, Tidy deck when gear lies on the deck, the mop when there is a wet spot (or the coach holds what they need);
  // their keys (R, X, Q) always work.
  const holding = (item) => sim.coach.carry === item || sim.coach.job?.item === item;
  $("relief").hidden = !holding("relief") && !sim.people.some((p) => p.problem === "eyes");
  $("clean").hidden = !sim.clutter.length;
  $("mop").hidden = !wet && !holding("mop");
  $("assist").disabled = mode !== "playing";
  $("assist").querySelector(".interact-label").textContent = sim.nearestInteraction()?.label || "Interact";
  const p = sim.get(sim.selected),
    blocked = sim.laneBlocked(),
    moving = p?.status === "swim" && !p.problem ? p : null;
  // The Kids Pool's one button: how many are splashing, and whether there is room (KIDS_ROOM).
  const poolBtn = document.querySelector('[data-lane="pool"]');
  if (poolBtn) {
    const kids = sim.people.filter((q) => ["swim", "enter"].includes(q.status) && q.type === "child");
    poolBtn.classList.toggle(
      "assignable",
      mode === "playing" && !sim.closed && !sim.rescue && p?.status === "queue",
    );
    poolBtn.classList.toggle("danger", kids.length > KIDS_ROOM);
    poolBtn.querySelector(".lane-mode").textContent = sim.closed
      ? "CLOSED"
      : kids.length > KIDS_ROOM
        ? "PACKED!"
        : kids.length === KIDS_ROOM
          ? "FULL"
          : kids.length
            ? "SPLASHING"
            : "OPEN";
    poolBtn.querySelector(".lane-count").textContent =
      p?.status === "queue"
        ? "Send " + p.name + " in!"
        : kids.length
          ? kids.length + " of " + KIDS_ROOM + " kids splashing"
          : "Catch a kid first";
    poolBtn.querySelector(".lane-caps").innerHTML = kids
      .slice(0, 10)
      .map((q) => '<i style="background:' + roofLook(q).color + '"></i>')
      .join("");
    poolBtn.disabled = mode !== "playing" || !!sim.rescue;
  }
  // The Lazy River's one button: who is riding, who is round the loop, and whether the selected guest has a tube yet.
  // The Lazy River's two ways round (Phase 3): who is on each, the rapids' room, and what the selected guest would make of it.
  for (const riverBtn of document.querySelectorAll('[data-lane="river"]')) {
    const route = Number(riverBtn.dataset.route) || 0,
      riding = sim.people.filter((q) => ["swim", "enter"].includes(q.status) && (q.lane || 0) === route),
      away = riding.filter((q) => q.away).length,
      ready = p?.status === "queue" && p.hasFins,
      packed = route === 1 && riding.filter((q) => !q.rushDone).length >= RIVER_ROUTES.rapidsRoom,
      verdict = ready ? laneVerdict(sim, p, route) : null;
    riverBtn.classList.toggle("assignable", mode === "playing" && !sim.closed && !sim.rescue && ready);
    riverBtn.classList.toggle(
      "danger",
      packed || (route === 0 && riding.filter((q) => !q.away).length > RIDE.crowd),
    );
    riverBtn.querySelector(".lane-mode").textContent = sim.closed
      ? "CLOSED"
      : sim.rescue
        ? "STOPPED"
        : packed
          ? "PACKED!"
          : riding.length
            ? "FLOWING"
            : "OPEN";
    riverBtn.querySelector(".lane-count").textContent =
      p?.status === "queue"
        ? p.hasFins
          ? verdict?.text || "Send " + p.name
          : "Hand " + p.name + " a tube first"
        : riding.length
          ? riding.length + " on tubes" + (away ? " · " + away + " round the bend" : "")
          : route === 1
            ? "Thrill-seekers ⚡ · " + RIVER_ROUTES.rapidsRoom + " at a time"
            : "Chillers 🐢 love it";
    riverBtn.querySelector(".lane-caps").innerHTML = riding
      .slice(0, 10)
      .map((q) => '<i style="background:' + roofLook(q).color + '"></i>')
      .join("");
    riverBtn.disabled = mode !== "playing" || !!sim.rescue;
  }
  // The Rooftop Pool's one button: the bar. The orders waiting (a dot each, gold for a VIP's), what is on the tray, and the DJ's
  // next drop once the build-up has begun.
  const barBtn = document.querySelector('[data-lane="bar"]');
  if (barBtn) {
    const orders = sim.people.filter((q) => q.problem === "drink"),
      at = nextDrop(sim),
      building = !!sim.roof?.warned && at != null;
    barBtn.querySelector(".lane-mode").textContent =
      sim.coach.carry === "tray"
        ? "TRAY " + sim.coach.tray + "/" + CHILL.tray
        : building
          ? "DROP " + Math.max(1, Math.ceil(at - sim.time))
          : "OPEN";
    barBtn.querySelector(".lane-count").textContent = orders.length
      ? orders.length + " margarita" + (orders.length > 1 ? "s" : "") + " ordered"
      : building
        ? "🎧 The drop is coming!"
        : "No orders · press B for a tray";
    barBtn.querySelector(".lane-caps").innerHTML = orders
      .slice(0, 10)
      .map((q) => '<i style="background:' + (q.vip ? "#e9a92b" : "#9fe06a") + '"></i>')
      .join("");
    barBtn.classList.toggle("danger", building || orders.some((q) => (q.orderT || 0) > CHILL.grace * 3));
    barBtn.disabled = mode !== "playing";
  }
  // The Rooftop Pool's seats (Phase 3): what is free, and what the selected guest would make of each.
  for (const seatBtn of document.querySelectorAll('[data-lane="seat"]')) {
    const i = Number(seatBtn.dataset.seat) || 0,
      seat = SEATS[i].id,
      waiting = p?.status === "queue" && p.chill ? p : null,
      verdict = waiting ? seatVerdict(sim, waiting, i) : null,
      beds = sim.roof?.beds || [],
      free = beds.filter(
        (b) => !b.guest && !b.messy && !!ROOF_BEDS[b.id]?.cabana === (seat === "cabana"),
      ).length,
      messy = beds.filter((b) => b.messy && !!ROOF_BEDS[b.id]?.cabana === (seat === "cabana")).length,
      inWater = sim.people.filter((q) => q.chill && q.status === "swim").length;
    seatBtn.classList.toggle("assignable", mode === "playing" && !!waiting && !verdict?.none);
    seatBtn.classList.toggle("danger", seat !== "pool" && free === 0);
    seatBtn.querySelector(".lane-mode").textContent =
      seat === "pool"
        ? inWater
          ? inWater + " IN"
          : "OPEN"
        : free
          ? free + " FREE"
          : messy
            ? "MESSY"
            : "FULL";
    seatBtn.querySelector(".lane-count").textContent = verdict
      ? verdict.text
      : seat === "pool"
        ? "Chat groups"
        : seat === "bed"
          ? messy
            ? messy + " to tidy (E)"
            : "Sunbathers 🛏️"
          : "VIPs 👑 · bigger tips";
    seatBtn.disabled = mode !== "playing";
  }
  // The Cruise Ship's gauge: how far she rolls now (the bar tips with her), a big swell's countdown, what slid.
  const gauge = document.querySelector(".ship-gauge");
  if (gauge && sim.ship) updateShipGauge(gauge);
  // The Wave Pool's one button: the machine's state, the clock to the next set, the bathers in the water and how many are dizzy.
  const wavesBtn = document.querySelector('[data-lane="waves"]');
  if (wavesBtn) updateWavesButton(wavesBtn);
  for (let i = 0; i < sim.lanes.length; i++) {
    if (sim.venue.river || sim.venue.waves || sim.venue.roof) break;
    const people = sim.lanePeople(i),
      count = sim.occupancy(i),
      average = people.length ? people.reduce((sum, p) => sum + p.h, 0) / people.length : 100;
    const b = document.querySelector('[data-lane="' + i + '"]');
    if (!b) continue;
    // (the big moment's race lane, Phase 3: locked like the splash lane until the race is over)
    const race =
        sim.big?.kind === "race" && ["announce", "live"].includes(sim.big.stage) && i === sim.big.lane,
      splash = i === blocked || race,
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
    // (At the Aqua Disco a zone holds CLASS_ROOM dancers; more and they crowd each other.)
    const zone = !!sim.venue.class;
    // (At the hot springs a spring has its seats: FULL when they are all taken, MONKEY! when one is sitting in it.)
    if (sim.venue.onsen) {
      const guests = springGuests(sim, i),
        cap = SPRINGS[i].cap,
        monkey = !!monkeyIn(sim, i);
      b.classList.toggle("danger", monkey || average < 50);
      b.classList.toggle("assignable", b.classList.contains("assignable") && guests.length < cap);
      b.querySelector(".lane-mode").textContent = monkey
        ? "MONKEY!"
        : guests.length >= cap
          ? "FULL"
          : guests.length === 0
            ? "OPEN"
            : "ROOM";
      b.querySelector(".lane-count").textContent = monkey
        ? "🐒 Shoo it out!"
        : guests.length + " of " + cap + " seats";
      b.querySelector(".lane-caps").innerHTML = guests
        .map((p) => '<i style="background:' + roofLook(p).color + '"></i>')
        .join("");
      b.disabled = mode !== "playing" || !!sim.rescue;
      continue;
    }
    b.querySelector(".lane-mode").textContent = closed
      ? "CLOSED"
      : splash
        ? race
          ? "RACE!"
          : "SPLASH!"
        : moveHere
          ? "MOVE HERE"
          : count === 0
            ? "OPEN"
            : zone
              ? count < CLASS_ROOM
                ? "ROOM"
                : count === CLASS_ROOM
                  ? "FULL"
                  : "PACKED!"
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
          : race
            ? "Clear for the race 🏁"
            : "Flip incoming"
        : count === 0
          ? "Jump on in"
          : zone
            ? count + " of " + CLASS_ROOM + " dancers"
            : count + " swimmer" + (count === 1 ? "" : "s");
    b.querySelector(".lane-caps").innerHTML = people
      .slice(0, 8)
      .map((p) => '<i style="background:' + roofLook(p).color + '"></i>')
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
                      : sim.karen && !["calmed", "leaving"].includes(sim.visitor(sim.karen.id)?.status)
                        ? "Karen is complaining. Everyone is annoyed."
                        : sim.carl
                          ? sim.carl.name + " is loose. Brace for splash."
                          : sim.dog && sim.dog.stage !== "leaving"
                            ? "There’s a dog on the deck!"
                            : sim.get(sim.jumper)?.jumpStage === "waiting"
                              ? "A daredevil is waiting on the tower."
                              : sim.laneClosed() >= 0
                                ? laneWord(sim) + " " + (sim.laneClosed() + 1) + " is closed · wet floor."
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
        : sim.coach.carry === "tray"
          ? "NEAR A GUEST WHO ORDERED · E TO SERVE"
          : sim.coach.carry === "fins"
            ? sim.venue.river || sim.venue.waves
              ? "NEAR A GUEST · E TO GIVE THE TUBE / ELSE E TO DROP"
              : "NEAR SWIMMER · E TO GIVE / ELSE E TO DROP"
            : sim.coach.carry
              ? "MEET YOUR SWIMMER · E TO HAND OVER"
              : sim.cleanup
                ? sim.sanitationHint().toUpperCase()
                : p?.status === "queue"
                  ? "● ● ●"
                  : sim.clutter.length
                    ? "PICK UP DROPPED GEAR · E"
                    : "WASD MOVE · SHIFT DASH · SPACE JUMP");
  // The happy streak's badge (Phase 3): the count, its tier and multiplier, what the next tier needs, and the guest who puts it at
  // risk; for a moment after it breaks, what broke it.
  const tier = streakTier(sim.streak),
    nextTier = STREAK_TIERS.find((s) => s.at > sim.streak),
    risk = sim.streak >= 3 ? sim.streakRisk() : null,
    noted = streakNote && performance.now() < streakNote.until;
  audio.heat = STREAK_TIERS.indexOf(tier);
  $("combo").hidden = mode === "menu" || (!noted && (!!sim.cleanup || sim.streak < 2));
  $("combo").classList.toggle("broken", !!noted);
  $("combo").classList.toggle("hot", !noted && tier.mult >= 2);
  $("combo").classList.toggle("at-risk", !noted && !!risk);
  $("combo-icon").textContent = noted ? "💔" : tier.mult >= 2.5 ? "⚡" : tier.mult >= 2 ? "🔥" : "✦";
  if (noted) {
    $("combo-text").textContent = streakNote.text;
    $("combo-sub").textContent = streakNote.sub;
  } else if (sim.streak >= 2) {
    $("combo-text").textContent =
      sim.streak + " IN A ROW" + (tier.mult > 1 ? " · " + tier.name + " ×" + tier.mult : "");
    $("combo-sub").textContent = risk
      ? "⚠ " +
        risk.name +
        " is " +
        (risk.status === "queue" ? "tired of waiting" : "unhappy") +
        ": help them!"
      : nextTier
        ? nextTier.at -
          sim.streak +
          " more for ×" +
          nextTier.mult +
          " · happy guests, saves and tips all count"
        : "Unstoppable. Keep it going!";
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
  // A wee: everybody out, then the chlorine (there is nothing to scoop).
  if (sim.cleanup.kind === "pee")
    return {
      icon: "💛",
      title: "WHO PEED?!",
      task: sim.sanitationHint(),
      steps: ["EVERYBODY OUT", "CHLORINE"].map((label, i) => ({
        label: i + 1 + " · " + label,
        active: i === 1,
        done: i < 1,
      })),
    };
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
  $("closure").classList.toggle("big-moment", !!panel?.big);
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
// Writing to the page only what changed: a tag is redrawn every frame, and a write that changes nothing still makes the browser do
// work (a new text node, a style recalculation).
const put = (el, text) => {
  if (el.textContent !== text) el.textContent = text;
};
const putProp = (el, prop, value) => {
  if (el[prop] !== value) el[prop] = value;
};
const putStyle = (el, prop, value) => {
  if (el.style[prop] !== value) el.style[prop] = value;
};
const putAttr = (el, name, value) => {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
};
// A tag's place over its person, kept on screen and below the scoreboard. Its size is measured only when its text changed (reading
// a size makes the browser lay the page out), and it moves in whole pixels.
function placeTag(b, screen, tagTop) {
  const key = b.textContent + (b.querySelector(".label-name")?.hidden ? "" : "|n");
  if (b._sizeKey !== key || !b._w) {
    b._sizeKey = key;
    b._w = b.offsetWidth;
    b._h = b.offsetHeight;
  }
  putStyle(
    b,
    "left",
    Math.round(Math.max(b._w / 2 + 8, Math.min(innerWidth - b._w / 2 - 8, screen.x))) + "px",
  );
  putStyle(b, "top", Math.round(Math.max(tagTop + b._h, screen.y)) + "px");
}
function updateBubbles() {
  // `notags` (the played hunt): no tag, bubble or label is drawn over the pool at all.
  if (tuning.has("notags")) {
    if (bubbles.size) clearBubbles();
    $("world-labels").hidden = true;
    return;
  }
  const ids = new Set(),
    tagTop = document.querySelector(".scoreboard").getBoundingClientRect().bottom + 12;
  for (const p of sim.people) {
    if (
      p.status === "gone" ||
      p.away || // (round the Lazy River's loop, out of sight)
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
    // (Only what changed is written: a tag is updated every frame and most frames change nothing in it. 16 October 2026.)
    putProp(
      b,
      "hidden",
      !screen.visible ||
        (world.viewMode === "coach" && Math.hypot(p.x - sim.coach.x, p.z - sim.coach.z) > 16),
    );
    putProp(b, "disabled", mode !== "playing" || !["queue", "swim", "injured"].includes(p.status));
    putAttr(b, "aria-label", "Select " + p.name + ", " + roofLook(p).label);
    putAttr(b, "aria-pressed", String(p.id === sim.selected));
    const rescuing =
      (sim.rescue?.victims || []).includes(p.id) && !p.rescueRecover && ["swim", "switch"].includes(p.status);
    b.classList.toggle("rescue-victim", rescuing);
    putProp(b.querySelector(".rescue-marker"), "hidden", !rescuing);
    b.classList.toggle("stomach-warning", !!p.stomachWarning);
    b.classList.toggle("injured", p.status === "injured");
    // One countdown bar: stomach trouble, or a daredevil losing patience on the tower.
    const jumpWait = p.status === "trampoline" && p.jumpStage === "waiting",
      asking = !!p.ask && p.status === "swim" && !p.problem && !p.stomachWarning,
      stomach = b.querySelector(".stomach-meter");
    putProp(stomach, "hidden", !p.stomachWarning && !jumpWait && !asking);
    stomach.classList.toggle("jump-meter", jumpWait);
    stomach.classList.toggle("tip-meter", asking);
    b.classList.toggle("asking", asking);
    if (!stomach.hidden) {
      const left = jumpWait ? p.jumpPatience : asking ? TIPS.limit - p.ask.t : p.sicknessTimer,
        total = jumpWait ? sim.config.jumpPatience || 15 : asking ? TIPS.limit : p.sicknessDuration;
      putStyle(stomach.querySelector("i"), "width", Math.round(Math.max(0, (left / total) * 100)) + "%");
      put(stomach.querySelector("b"), Math.ceil(left) + "s");
    }
    b.classList.toggle("selected", p.id === sim.selected);
    b.classList.toggle("guided", p.id === guidanceState(sim).swimmerId);
    // A calmer pool (Phase 1): a swimmer happily swimming, with nothing wrong, keeps a small faded tag (the icon only), so the
    // tags that stand out are the ones that need the coach. Still clickable, to move them to another lane.
    b.classList.toggle(
      "quiet",
      p.status === "swim" &&
        !p.problem &&
        !p.stomachWarning &&
        !p.ask &&
        !rescuing &&
        p.id !== sim.selected &&
        p.h >= 55 &&
        !p.vip &&
        !p.star,
    );
    put(b.querySelector(".type-icon"), roofLook(p).icon);
    put(b.querySelector(".type-label"), roofLook(p).label);
    const statusIcon = problemIcon(p);
    put(
      b.querySelector(".mood-icon"),
      statusIcon !== roofLook(p).icon && statusIcon !== "🙂" ? statusIcon : "",
    );
    const hp = b.querySelector(".hp i");
    putStyle(hp, "width", Math.round(Math.max(0, p.h)) + "%");
    putStyle(hp, "background", moodColor(p.h));
    const name = b.querySelector(".label-name");
    put(name, p.name);
    putProp(name, "hidden", p.id !== sim.selected);
    placeTag(b, screen, tagTop);
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
        '<div class="ring" hidden><b></b></div><div class="face"><span class="type-icon"></span><span class="type-label"></span></div><div class="hp"><i></i></div>';
      $("world-labels").appendChild(b);
      bubbles.set(v.id, b);
    }
    const screen = world.project(v.x, v.kind === "dog" ? 1.4 : v.kind === "kid" ? 1.5 : 2.3, v.z);
    b.hidden = !screen.visible || mode === "menu";
    b.classList.toggle("urgent", !!tag.urgent);
    b.querySelector(".type-icon").textContent = tag.icon;
    b.querySelector(".type-label").textContent = tag.label || "";
    // A circular progress ring (hold E to calm Karen): filled in degrees through a CSS variable.
    const ring = b.querySelector(".ring");
    ring.hidden = tag.ring === undefined;
    if (tag.ring !== undefined) {
      ring.style.setProperty("--fill", Math.round(tag.ring * 360) + "deg");
      ring.classList.toggle("holding", tag.ring > 0.02);
      ring.firstElementChild.textContent = tag.ring > 0.02 ? Math.round(tag.ring * 100) + "%" : "E";
    }
    const meter = b.querySelector(".hp");
    meter.hidden = tag.meter === undefined;
    if (tag.meter !== undefined) {
      meter.firstElementChild.style.width = Math.round(tag.meter * 100) + "%";
      meter.firstElementChild.style.background =
        tag.meter > 0.7 ? "#eb7754" : tag.meter > 0.4 ? "#e6b445" : "#73b65b";
    }
    placeTag(b, screen, tagTop);
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
// ---- the highlight replay (Phase 3, highlight.mjs) --------------------------------------------------------------------
// At the end of a shift its best clip (the funniest moment: a cannonball, a crash, a guest over the edge, the race…) can be watched
// again: the shift is rebuilt from its record and run fast to a few seconds before it (REWIND), then played for about ten seconds,
// slowed round the moment, with the camera on it and no HUD (a clean picture for clips). Any key or click skips it.
function bestClip() {
  const best = highlights?.best();
  if (!best || !recorder || recorder.record.broken || recorder.record.truncated) return null;
  return best;
}
// The results' button (and, for a really good clip, the clip itself, once, as the card opens).
function offerHighlight() {
  const best = bestClip(),
    b = $("watch-highlight");
  b.hidden = !best;
  if (!best) return;
  b.textContent = "🎬 Watch the highlight · " + best.title;
  b.onclick = () => playHighlight(best);
  if (best.weight >= HIGHLIGHT.auto && !reducedMotion.matches && !params.has("noreplay"))
    setTimeout(() => mode === "results" && !clip && $("results-dialog").open && playHighlight(best), 900);
}
function playHighlight(best) {
  if (clip || mode !== "results") return;
  let player;
  try {
    player = new ClipPlayer(recorder.record, best);
  } catch (e) {
    crashlog.error("highlight", e);
    toast("This one can't be replayed, sorry.");
    return;
  }
  clip = { player, live: sim, best, clock: 0, focused: false, reopen: $("results-dialog").open };
  if (clip.reopen) $("results-dialog").close();
  crashlog.crumb("highlight", best.title + " @" + best.tick);
  mode = "replay";
  document.body.classList.add("replaying");
  $("replay").hidden = false;
  $("replay-title").textContent = best.title;
  $("replay-state").textContent = "⏪ REWINDING…";
  $("replay-fill").style.width = "0%";
  sim = player.sim;
  world.resetActors();
  setTimeout(() => {
    document.addEventListener("keydown", skipHighlight, { capture: true });
    document.addEventListener("pointerdown", skipHighlight, { capture: true });
  }, 50);
}
function skipHighlight(e) {
  e.preventDefault();
  e.stopPropagation();
  stopHighlight();
}
function replayFrame(dt) {
  const c = clip;
  if (!c) return;
  const p = c.player;
  if (p.tick < p.from) {
    p.seek();
    if (replayDrifted(p)) return;
    if (p.tick >= p.from) {
      $("replay-state").textContent = "▶ REPLAY";
      if (c.best.x != null) world.focusMoment(c.best.x, c.best.z, HIGHLIGHT.before + HIGHLIGHT.after);
    }
    return;
  }
  c.clock += dt * p.speed();
  while (c.clock >= 1 / 60 && !p.done) {
    c.clock -= 1 / 60;
    p.step();
    // The clip's sounds and splashes (not its toasts or stings).
    for (const e of p.sim.events) {
      if (e.type === "splash" || e.type === "collision") world.splash(e.x, -0.12, e.z, 10);
      else if (e.type === "cannonball") world.bigSplash(e.x, e.z, 1.6);
      else if (e.type === "fish-dumped" || e.type === "race-go") world.bigSplash(e.x, e.z, 1);
      else if (e.type === "drop" && e.headline) world.fireworks(0, 0, 7);
      if (e.type !== "toast") audio.effect(e.type, e);
    }
    p.sim.events.length = 0;
  }
  if (replayDrifted(p)) return;
  $("replay-state").textContent = p.speed() < 1 ? "▶ REPLAY · SLOW-MO" : "▶ REPLAY";
  $("replay-fill").style.width = Math.round(p.progress * 100) + "%";
  if (p.done) stopHighlight();
}
// A replay that stops matching its record's checkpoints (a bug: something moved the shift that was not an input) is logged and
// closed, never shown wrong and never allowed to stop the game.
function replayDrifted(p) {
  if (!p.drift) return false;
  crashlog.error("highlight", new Error("the replay drifted at tick " + p.drift.tick));
  stopHighlight();
  toast("This one can't be replayed, sorry.");
  return true;
}
function stopHighlight() {
  const c = clip;
  if (!c) return;
  clip = null;
  document.removeEventListener("keydown", skipHighlight, { capture: true });
  document.removeEventListener("pointerdown", skipHighlight, { capture: true });
  sim = c.live;
  world.resetActors();
  mode = "results";
  document.body.classList.remove("replaying");
  $("replay").hidden = true;
  if (c.reopen && !$("results-dialog").open) $("results-dialog").showModal();
}
// The happy streak's moments (Phase 3): a tier reached flashes the badge, names the tier over where it happened and bursts there;
// a broken streak shatters the badge and says what broke it, for a moment.
let streakNote = null; // {text, until} while the badge shows a break
function streakTierUp(e) {
  const badge = $("combo");
  badge.classList.remove("tier-up");
  void badge.offsetWidth;
  badge.classList.add("tier-up");
  if (Number.isFinite(e.x)) {
    points({ x: e.x, z: e.z, text: e.name + " ×" + e.mult, tone: "good streak-word" });
    if (!reducedMotion.matches) world.burst(e.x, e.z, e.mult >= 2);
  }
}
// The big moment's result (big-moment.mjs): a showbill card for a moment, fireworks and confetti for a great one.
function bigResult(e) {
  const el = document.createElement("div");
  el.className = "big-result " + e.result;
  el.innerHTML =
    (e.result === "great" ? "⭐ " : e.result === "good" ? "👍 " : "💥 ") +
    e.words.toUpperCase() +
    "<small>" +
    (e.score ? e.score + " · " : "") +
    (e.points > 0 ? "+" : "") +
    e.points +
    " points</small>";
  $("game").appendChild(el);
  setTimeout(() => el.remove(), 2700);
  if (e.result === "great" && !reducedMotion.matches) {
    world.fireworks(e.x || 0, e.z || 0, 4);
    world.confetti();
  }
}
const BREAKS = {
  lost: "{name} gave up waiting",
  angry: "{name} left cross",
  meh: "{name} left unhappy",
  mess: "an accident in the water",
  cannonball: "a cannonball",
  fish: "a fish in the pool",
  karen: "Karen annoyed {name}",
  crash: "a trampoline crash",
  slip: "{name} slipped",
  overboard: "{name} went over the edge",
  "fell-in": "{name} slid into the pool",
  knockout: "{name} was knocked under",
  monkey: "a monkey in a spring",
  race: "a pile-up in the race lane",
  big: "the big moment going wrong",
};
function streakBroken(e) {
  const why = (BREAKS[e.why] || "").replace("{name}", e.name || "someone");
  streakNote = {
    text: "STREAK LOST · " + e.was,
    sub: why ? "Broken by " + why : "",
    until: performance.now() + 2600,
  };
  const badge = $("combo");
  badge.classList.remove("tier-up", "broken");
  void badge.offsetWidth;
  badge.classList.add("broken");
}
function points(e) {
  const p = world.project(e.x, 1.4, e.z),
    el = document.createElement("div");
  el.className = "float-text" + (e.tone ? " verdict " + e.tone : "");
  el.textContent = e.text ?? (e.value > 0 ? "+" : "") + e.value;
  el.style.left = p.x + "px";
  el.style.top = p.y + "px";
  $("world-labels").appendChild(el);
  setTimeout(() => el.remove(), 1750);
}
// What the crash log notes about the shift as it goes: every event but the endless ones (footsteps, splashes, points: trace.mjs
// says which), with the small facts it carries; the diary of changes (trace.mjs) is written beside them.
function events() {
  const batch = sim.events.splice(0),
    // A sting says what a new incident's warning toast would; a stamp carries the points of its save.
    stung = batch.some((e) => e.type === "incident"),
    stamped = batch.filter((e) => e.type === "save" && e.value).map((e) => e.value);
  for (const e of batch) {
    // One event that goes wrong must not lose the rest of the batch (a lost "ended" would leave the shift open).
    try {
      coverage?.event(e);
      if (recorder && highlights) highlights.note(e, recorder.ticks);
      if (e.type === "save") crashlog.crumb("save", describeEvent(e));
      else if (!isNoisy(e)) crashlog.crumb("event", describeEvent(e));
      if (e.type === "save") achievements.save(e.kind);
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
      } else if (e.type === "karen-arrive") world.kick(0.15);
      else if (e.type === "karen-calmed") world.sparkle(e.x, e.z);
      else if (e.type === "cannonball") {
        world.bigSplash(e.x, e.z, 1.6);
        world.incidentView.ripple(e.x, e.z);
        world.kick(0.75);
      } else if (e.type === "dog-splash") {
        world.bigSplash(e.x, e.z, 0.45);
      } else if (e.type === "coach-fell") {
        world.bigSplash(e.x ?? sim.coach.x, e.z ?? sim.coach.z, 0.7);
        world.kick(0.3);
      } else if (e.type === "wave-hit") {
        // (A crest jolting a bather: the scene splashes them; only a hard hit sprays.)
        if (e.s > 0.3) world.splash(e.x, -0.05, e.z, Math.round(4 + e.s * 10), true);
      } else if (e.type === "wave-break") {
        world.waveBreak?.(e);
        if (e.kind === "monster") world.kick(0.55);
      } else if (e.type === "knockout") {
        world.bigSplash(e.x, e.z, 0.9);
        world.kick(0.45);
        queueKey = "";
      } else if (e.type === "dizzy" || e.type === "dizzy-over" || e.type === "towel") {
        queueKey = "";
      } else if (e.type === "monster-warning") {
        world.kick(0.15);
      } else if (e.type === "drop") {
        // The DJ's drop: the roof jumps, confetti over the pool (and the headline drop's fireworks over the city).
        world.kick(e.headline ? 0.6 : 0.35);
        if (e.headline && !reducedMotion.matches) world.fireworks(0, 0, 7);
        for (let k = 0; k < 6; k++)
          world.splash(
            -2 + Math.random() * 4,
            1.6,
            -8 + k * 3.2,
            6,
            true,
            [0xff4fb4, 0xffd23f, 0x7fe0ff][k % 3],
          );
      } else if (e.type === "swell-warning") {
        world.kick(0.12);
      } else if (e.type === "fell-in") {
        world.bigSplash(e.x, e.z, 0.7);
        world.kick(0.35);
        queueKey = "";
      } else if (e.type === "spill") {
        // The pool slops over its low end onto the deck.
        for (let k = 0; k < 4; k++) world.splash(e.x - 1.5 + k, 0.05, e.z, 9, true);
        world.kick(0.12);
      } else if (e.type === "straightened") {
        world.sparkle(e.x, e.z);
        queueKey = "";
      } else if (e.type === "overboard") {
        world.bigSplash(e.x, e.z, 0.8);
        world.kick(0.5);
        queueKey = "";
      } else if (e.type === "serve") {
        world.handoff({ x: e.x, z: e.z }, e.to, "margarita");
        $("carry").animate([{ transform: "scale(1.18)" }, { transform: "scale(1)" }], { duration: 150 });
        queueKey = "";
      } else if (
        e.type === "order" ||
        e.type === "selfie-start" ||
        e.type === "tipsy" ||
        e.type === "lie-down"
      ) {
        queueKey = "";
      } else if (e.type === "drop-splash") {
        world.kick(0.15);
      } else if (e.type === "tube-lost" || e.type === "bather-bump") {
        world.splash(e.x, -0.05, e.z, 8, true);
      } else if (e.type === "tube-bump") {
        world.splash(e.x, -0.12, e.z, 6, true);
      } else if (e.type === "board") {
        world.splash(e.x, -0.12, e.z, 8, true);
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
        // The lane choice judged at once (guidance.mjs laneVerdict): a small word over the swimmer.
        const sent = sim.get(e.id),
          verdict = e.verdict || laneVerdict(sim, sent, e.lane);
        if (sent && verdict)
          points({ x: sent.x, z: sent.z, text: verdict.text, tone: verdict.good ? "good" : "bad" });
      } else if (e.type === "select") {
        queueKey = "";
        updateUI();
      } else if (e.type === "coach-slip")
        toast(
          e.wet
            ? "Whoops! Coach Waters slipped on a wet spot. Mop it (Q), go round, or jump over it (Space)."
            : "Whoops! Jump over fins, or pick them up with E.",
        );
      else if (e.type === "ended") finish();
      else if (e.type === "streak-tier") streakTierUp(e);
      else if (e.type === "big-done") bigResult(e);
      else if (e.type === "rapids")
        points({
          x: e.x,
          z: e.z,
          text: e.thrill ? "WOOO! ⚡" : "AAAAH! 😱",
          tone: e.thrill ? "good" : "bad",
        });
      else if (e.type === "race-go") world.bigSplash(e.x, -7.2, 0.9);
      else if (e.type === "race-finish")
        points({ x: e.x, z: e.z, text: "🏆 " + e.name + " wins!", tone: "good" });
      else if (e.type === "tip")
        points({ x: e.x, z: e.z, text: "📣 " + e.text + " +" + e.value, tone: "good" });
      else if (e.type === "tip-ask") points({ x: e.x, z: e.z, text: "📣 " + e.text, tone: "ask" });
      else if (e.type === "streak-broken") streakBroken(e);
      if (world.viewMode === "coach") world.coachCam.react(e.type, e);
      audio.effect(e.type, e);
    } catch (err) {
      console.error("Pool Panic event error", e.type, err);
      crashlog.error("event:" + e.type, err);
    }
  }
  // The moments a crash is likeliest to follow reach the disk at once (the page may be about to die), and the numbers are taken
  // as they happen and again a few seconds later, so a jump in what the scene holds shows up next to what caused it.
  if (coverage && batch.some((e) => !isNoisy(e) && e.type !== "toast")) touchCoverage();
  if (batch.some((e) => MOMENTS.has(e.type))) {
    crashlog.flush(true);
    live?.dirty("urgent");
    try {
      sampleLog();
      setTimeout(() => ["playing", "paused"].includes(mode) && sampleLog(), 3000);
    } catch {}
  }
  if (tutor) renderTutor(tutor.update(sim, batch));
}
// The guided first shift's tip (tutorial.mjs): one line at a time, at the top of the screen, with a way to skip the tips.
function renderTutor(tip) {
  const box = $("tutor");
  box.hidden = !tip || mode !== "playing";
  if (!tip) return;
  put($("tutor-step"), tip.id === "finale" ? "✓" : tip.step + "/" + tip.total);
  put($("tutor-text"), tip.text);
  box.classList.toggle("finale", tip.id === "finale");
}
function skipTutor() {
  tutor?.skip();
  weekUi?.skipTutorial();
  $("tutor").hidden = true;
}
const MOMENTS = new Set([
  "save",
  "incident",
  "catastrophe",
  "rescue-safe",
  "crash",
  "cannonball",
  "blackout",
]);
// The map covers the pool in the menu, so once the first frames have warmed the 3D scene up nothing of it is
// updated or drawn until a shift starts (moving speech bubbles under a full-screen map cost real frame time).
let warmFrames = 3;
// The frame-rate cap (gfx.mjs: 60 on a touch device with WebKit, whose 120 Hz screen would ask for twice the drawing), the governor that
// lowers the resolution while the frames of a shift are slow (off since 16 October 2026: `gfx.plan.govern`), and the mark a shift
// being drawn leaves on the device (a page that died with it still there is said in the next launch's log).
let lastDrawn = 0,
  drawingMarked = false;
function governFrame(t) {
  const drawing =
    (mode === "playing" || mode === "countdown") && document.visibilityState === "visible" && !testing;
  if (drawing !== drawingMarked) {
    drawingMarked = drawing;
    markDrawing(crashStorage, drawing);
  }
  if (!gfx.plan.govern || !drawing || !lastDrawn) return;
  const scale = gfx.governor.frame(t - lastDrawn);
  if (scale === null) return;
  const before = world.renderer?.getPixelRatio?.();
  gfx.scale = scale;
  world.resize();
  crashlog.crumb(
    "gfx",
    "frames slow (" +
      gfx.governor.fps +
      " fps): pixel ratio " +
      before +
      " → " +
      world.renderer?.getPixelRatio?.(),
  );
}
// A page that is hidden or closed has put its shift away: the system may end it there without that being a crash.
const putAway = () => {
  if (!drawingMarked) return;
  drawingMarked = false;
  markDrawing(crashStorage, false);
};
document.addEventListener("visibilitychange", () => document.hidden && putAway());
window.addEventListener("pagehide", putAway);
function animate(t) {
  if (gfx.plan.fpsCap && lastDrawn && t - lastDrawn < 1000 / gfx.plan.fpsCap - 3) {
    requestAnimationFrame(animate);
    return;
  }
  try {
    governFrame(t);
  } catch (e) {
    crashlog.error("frame:gfx", e);
  }
  lastDrawn = t;
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
  if (mode === "replay") {
    if (!stage("replay", () => replayFrame(dt))) return stopHighlight();
  } else if (mode === "playing" || mode === "countdown") {
    // Fixed substeps keep congestion stable even on lower frame rates. The simulation is the one stage that stops
    // the shift at once when it throws: what it holds may no longer be sound.
    const ok = stage("sim", () => {
      if (world.viewMode === "coach") {
        world.coachCam.turn(input.turn(), dt);
        sim.coach.lookAngle = world.coachCam.yaw;
        recorder?.look(sim.coach.lookAngle);
      }
      if (!replayRun) {
        const movement = moveVector();
        sim.setMovement(movement.x, movement.z);
      }
      accumulator = Math.min(0.12, accumulator + dt * speed);
      while (accumulator >= 1 / 60) {
        if (replayRun) feedReplay();
        sim.tick(1 / 60);
        accumulator -= 1 / 60;
      }
    });
    if (!ok) return snag();
    trace();
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
    // (The crash hunt's two last suspects: `nosync` leaves the 3D scene alone, neither updated nor drawn, `norender` updates it
    // and draws nothing. The simulation, the page and the sound go on in both.)
    if (!tuning.has("nosync"))
      stage("scene", () => {
        world.sync(sim, viewClock, dt * speed, dt);
        if (world.incidentView.consumeLightning()) audio.effect("thunder");
      });
    if (!tuning.has("nosync") && !tuning.has("norender")) stage("render", () => world.render());
    if (!tuning.has("nosync")) stage("tags", updateBubbles);
  }
  if (mode === "replay") return; // (the highlight: no HUD, no tags, no log of its own)
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
  if (perfClock > (playtest ? 5 : 10)) {
    perfClock = 0;
    sampleLog();
  }
  if (playtest) playtestTick(dt);
}
function bind() {
  weekUi = installWeek({
    $,
    storage: crashStorage,
    startShift: (shift) => start(null, shift),
    returnMenu,
    playScene: (panels, then, last = "Let's go! ▶") => {
      releaseMouse();
      crashlog.crumb("story", "marina scene");
      playCinematic($("cinematic"), panels, { labels: { last }, done: () => then() });
    },
    toast,
    crumb: (kind, text) => crashlog.crumb(kind, text),
    presence: richPresence,
    celebrate: () => world.confetti(),
  });
  weekUi.menu();
  // Free play: the map of the levels the run has opened. The week card's link shows it, "The week" goes back.
  weekUi.onFreePlay = (on) => {
    document.body.classList.toggle("freeplay", on);
    crashlog.crumb("menu", on ? "free play" : "the week");
    if (on) {
      syncUnlocks();
      if (!isUnlocked(records, level)) selectLevel(Math.min(records.unlocked, SHIFTS.length));
      else updateMenu();
      $("start").focus({ preventScroll: true });
    } else {
      weekUi.menu();
      $("wk-go").focus({ preventScroll: true });
    }
  };
  $("fp-back").onclick = () => weekUi.freePlay(false);
  syncUnlocks();
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
    else if (b.dataset.lane === "pool") pick({ kind: "lane", lane: sim.poolLane() });
    else if (b.dataset.lane === "bar") sim.fetch("bar");
    else if (b.dataset.lane === "seat") pick({ kind: "lane", lane: Number(b.dataset.seat) || 0 });
    else if (b.dataset.lane === "river") pick({ kind: "lane", lane: Number(b.dataset.route) || 0 });
    else if (b.dataset.lane === "waves") {
      if (mode === "playing") sim.toggleWaves();
    } else pick({ kind: "lane", lane: Number(b.dataset.lane) });
  };
  $("world-labels").onclick = (e) => {
    const b = e.target.closest("button[data-swimmer]");
    if (b && !b.disabled) pick({ kind: "swimmer", id: Number(b.dataset.swimmer) });
  };
  $("send-home").onclick = () => {
    sim.home();
    updateUI();
  };
  ["chlorine", "fins", "relief"].forEach((item) => ($(item).onclick = () => sim.fetch(item)));
  $("return-item").onclick = () => sim.returnItem();
  $("clean").onclick = () => sim.tidy();
  $("tutor-skip").onclick = () => skipTutor();
  $("mop").onclick = () => sim.mop();
  $("assist").onclick = () => {
    act("interact (button) · " + (sim.coach.carry || "empty-handed"));
    sim.interact();
  };
  $("sound").onclick = () => {
    audio.init();
    const on = audio.toggle();
    $("sound").classList.toggle("off", !on);
    $("sound-label").textContent = on ? "Sound: on" : "Sound: off";
    toast(on ? "Sound on ♫" : "Sound off");
  };
  $("settings").onclick = openMenu;
  $("resume").onclick = resume;
  if (isDesktop()) {
    $("quit-game").hidden = false; // (a window needs a way out that is not the keyboard)
    $("quit-game").onclick = quitGame;
  }
  $("restart").onclick = () => start(activeBooking);
  try {
    bindPlaytest();
  } catch (e) {
    crashlog.error("playtest", e);
  }
  $("crash-send").onclick = () => shareCrash("send");
  $("crash-auto").onchange = () => {
    reportPrefs.auto = $("crash-auto").checked;
    savePrefs(crashStorage, reportPrefs);
  };
  $("crash-copy").onclick = () => shareCrash("copy");
  $("crash-code-copy").onclick = async () => {
    const button = $("crash-code-copy");
    button.textContent = (await copyText(reportPrefs.device)) ? "Copied ✓" : "Copy failed";
    setTimeout(() => (button.textContent = "Copy code"), 1800);
  };
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
    const week = weekUi?.pill();
    if (week)
      toast(
        `Date Fund ${money(week.now)} of ${money(week.goal)}. Fill it by Saturday night and Sunday is a date with Marina ${week.icon}`,
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
  renderTouchpad();
  $("touchpad-buttons").onclick = (e) => {
    const b = e.target.closest("[data-touchpad]");
    if (!b) return;
    settings.touchpad = b.dataset.touchpad;
    saveSettings();
    renderTouchpad();
  };
  renderQuality();
  $("quality-buttons").onclick = (e) => {
    const b = e.target.closest("[data-quality]");
    if (!b || b.dataset.quality === (settings.quality || "auto")) return;
    settings.quality = b.dataset.quality;
    saveSettings();
    crashlog.crumb("gfx", "quality chosen: " + settings.quality);
    // Antialiasing is fixed when the drawing surface is made, so a new quality takes a fresh start: now on the menu, or as soon as
    // this shift is over.
    if (["playing", "countdown", "paused"].includes(mode)) {
      qualityPending = true;
      renderQuality();
    } else location.reload();
  };
  $("quality-reset").onclick = () => {
    resetGfx(crashStorage);
    crashlog.crumb("gfx", "crash safety reset by the player");
    if (["playing", "countdown", "paused"].includes(mode)) {
      qualityPending = true;
      renderQuality();
    } else location.reload();
  };
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
    if (weekUi?.pending) {
      $("results-dialog").close();
      return weekUi.next();
    }
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
    // E held (or the touch button pressed): Karen's calm-down fills while it is.
    onHold: (on) => sim.setHold?.(on),
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
        // Enter is the screen's one START: the week's, or the selected level's in free play.
        if (document.body.classList.contains("freeplay")) requestStart();
        else weekUi?.go();
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
      // One meaning per key (19 October 2026, Phase 1): the numbers only ever send someone to a place (a lane, a zone, a spring,
      // the pool, the river); a pool's own action has a key of its own: B the bar (rooftop, ship), Z the wave machine.
      if (sim.venue.kids && key === "1") sim.assign(sim.poolLane());
      else if (
        /^[1-9]$/.test(key) &&
        Number(key) <= (sim.venue.roof ? SEATS.length : sim.lanes.length) &&
        !sim.venue.waves
      )
        sim.assign(Number(key) - 1);
      if (key === "z" && sim.venue.waves) sim.toggleWaves();
      if (key === "b" && (sim.venue.roof || sim.venue.cruise)) sim.fetch("bar");
      if (key === "t" && sim.venue.trampoline) sim.assignTrampoline?.();
      if (key === "c") sim.fetch("chlorine");
      if (key === "f") sim.fetch("fins");
      if (key === "r") sim.fetch("relief");
      if (key === "x") sim.tidy();
      if (key === "q") sim.mop();
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
  // Touch: holding the button counts as holding E (a tap alone starts a calm-down that carries on by itself).
  for (const id of ["touch-interact", "assist"]) {
    const button = $(id);
    button.addEventListener("pointerdown", () => {
      if (mode === "playing") sim.setHold?.(true);
    });
    for (const name of ["pointerup", "pointercancel", "pointerleave"])
      button.addEventListener(name, () => sim.setHold?.(false));
  }
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
  // The crash hunt's character-models test (?nomodels): classic characters for this page only, nothing remembered.
  if (tuning.has("nomodels")) {
    chooseCoach("classic", false);
    chooseSwimmers("classic", false);
  }
  // Coach Waters' model and the five swimmers' are fetched first, together (a few seconds at most; without them the classic
  // coach and swimmers play, and a swimmer model that arrives later is used from the next swimmer on).
  const began = performance.now();
  const fetching = [];
  if (activeChoice() === "panic") fetching.push(loadCoachModel());
  if (activeSwimmerChoice() === "models") fetching.push(loadSwimmerModels());
  if (fetching.length) {
    await Promise.race([Promise.all(fetching), new Promise((resolve) => setTimeout(resolve, 6000))]);
    const took = Math.round(performance.now() - began) + " ms";
    if (activeChoice() === "panic")
      crashlog.crumb(
        "coach",
        (coachModelReady() ? "Coach Waters loaded in " : "Coach Waters not ready after ") + took,
      );
    if (activeSwimmerChoice() === "models")
      crashlog.crumb(
        "swimmers",
        (swimmerModelsReady() ? "swimmer models loaded in " : "swimmer models not ready after ") + took,
      );
  }
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
  if (playtest)
    toast(
      "Playtest on · device code " +
        reportPrefs.device +
        (live ? " · the log is sent as you play" : " · not sending from here") +
        " · 🐞 flags a problem",
    );
  if (huntState && hunt.finished(huntState)) showHuntResults();
  else if (playHunt) startPlayHunt();
  else if (huntStep || params.has("trial")) setTimeout(startTrial, 1500);
  // The GPU, and how big the drawing surface is (the likeliest thing to run a small device out of memory).
  const surface = world.renderer?.domElement,
    gl = world.renderer?.getContext?.();
  let samples = 0;
  try {
    samples = gl?.getParameter?.(gl.SAMPLES) || 0; // what the browser really gave the drawing surface (4 when it multisamples)
  } catch {}
  crashlog.setEnv({
    gpu: describeGpu(gl),
    canvas: surface ? surface.width + "×" + surface.height : "",
    samples,
    surfaceMB: surface ? surfaceMB({ width: surface.width, height: surface.height, samples }) : 0,
    maxTexture: world.renderer?.capabilities?.maxTextureSize,
    webgl2: world.renderer?.capabilities?.isWebGL2,
  });
  // Every change of the page's size is a new drawing surface (a canvas that is resized is the likeliest thing to leak on a browser with
  // an idle toolbar that comes and goes), so the log says each one: the page's size, the visual viewport's and the surface's.
  const sized = (what) =>
    crashlog.crumb(
      "view",
      what +
        " " +
        innerWidth +
        "×" +
        innerHeight +
        (window.visualViewport
          ? " (visual " + Math.round(visualViewport.width) + "×" + Math.round(visualViewport.height) + ")"
          : "") +
        (surface ? " surface " + surface.width + "×" + surface.height : ""),
    );
  window.addEventListener("resize", () => sized("resize"));
  window.visualViewport?.addEventListener("resize", () => sized("visual resize"));
  crashlog.crumb(
    "gfx",
    "quality " +
      gfx.plan.quality +
      (gfx.plan.quality === "auto" ? "" : " (" + gfx.plan.level + ")") +
      " · tier " +
      gfx.plan.tier +
      " (" +
      gfx.plan.says +
      ")" +
      (touchWebKit ? " · touch WebKit" : "") +
      " · pixel ratio " +
      world.renderer?.getPixelRatio?.() +
      (gfx.plan.fpsCap ? " · at most " + gfx.plan.fpsCap + " fps" : "") +
      (gfx.plan.govern ? " · governor on" : "") +
      (gfxBoot.died ? " · the last page died in a shift" + (testing ? " (a test: not counted)" : "") : ""),
  );
  crashlog.crumb("boot", "ready in " + Math.round(performance.now()) + " ms");
  requestAnimationFrame(animate);
  // QA hook (?debug): drive the fixed-step simulation faster than real time for screenshots and repros.
  if (new URLSearchParams(location.search).has("debug"))
    window.__pool = {
      get sim() {
        return sim;
      },
      get week() {
        return weekUi;
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
      get audio() {
        return audio;
      },
      get crashlog() {
        return crashlog;
      },
      get story() {
        return story;
      },
      playStory,
      // The playtest's parts, for tests and repros.
      get playtest() {
        return {
          on: playtest,
          coverage,
          live,
          recorder,
          open: showPlaytest,
          close: closePlaytest,
          flag: flagProblem,
          trigger: triggerNow,
        };
      },
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
  if (params.has("story")) playStory("intro");
  // A launch after a crash offers the report (`?log` opens the log any time, crash or not).
  const wantsLog = new URLSearchParams(location.search).has("log");
  setTimeout(async () => {
    if (reportsOpen() && autoSend()) await sendPending();
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
