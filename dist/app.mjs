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
import { incidentCards, stickerUrl, STICKERS } from "./incident-cards.mjs";
import { TIPS } from "./tips.mjs";
import { Tutor } from "./tutorial.mjs";
import {
  PoolSimulation,
  TYPES,
  SHIFTS,
  loopPosition,
  swimmerLook as baseSwimmerLook,
  freePlayGuests,
  SENIOR_LOOKS,
  streakTier,
  STREAK_TIERS,
} from "./sim.mjs";
import { PoolWorld } from "./scene.mjs";
import {
  activeChoice,
  chooseCoach,
  loadCoachModel,
  coachModelReady,
  loadCrewModel,
} from "./scene/coach-model.mjs";
import {
  activeSwimmerChoice,
  chooseSwimmers,
  loadSwimmerModels,
  loadFigure,
  swimmerModelsReady,
  swimmerLoadShare,
  swimmerTemplate,
} from "./scene/swimmer-models.mjs";
import { loadFishModel } from "./scene/fish-model.mjs";
import { loadHarbourside } from "./scene/harbourside.mjs";
import { loadSplashPark } from "./scene/splashpark.mjs";
import { loadKidsPool } from "./scene/kidspool.mjs";
import { loadLagoonClub } from "./scene/lagoonclub.mjs";
import { loadDiscoClub } from "./scene/discoclub.mjs";
import { loadAquaticClub } from "./scene/aquaticclub.mjs";
import { loadCrowdModels } from "./scene/crowd-models.mjs";
import { loadOfficials } from "./scene/officials.mjs";
import { loadOnsenClub } from "./scene/onsenclub.mjs";
import { loadWaveClub } from "./scene/waveclub.mjs";
import { loadSeniorClub } from "./scene/seniorclub.mjs";
import { loadRiverClub } from "./scene/riverclub.mjs";
import { loadCruiseClub } from "./scene/cruiseclub.mjs";
import { loadRoofClub } from "./scene/roofclub.mjs";
import { loadDiveClub } from "./scene/diveclub.mjs";
import { loadArenaClub } from "./scene/arenaclub.mjs";
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
import { devOn } from "./dev.mjs";
import { installLookTuner, antialiasOff, LOOK_DEFAULTS } from "./look-tuner.mjs";
import { MenuStage, GUESTS, GUEST_FIGURES } from "./scene/menu-stage.mjs";
import { installTitle, normalizeSettings, volumesOf, grainOpacity, motionReduced } from "./title.mjs";
import { installFreePlay } from "./free-ui.mjs";
import { freePlayShift, freeLevel, POOLS, RULES } from "./week.mjs";
import { installCoop } from "./coop-ui.mjs";
import { CoopGuest, Predictor } from "./net.mjs";
import { coachInfo } from "./crew.mjs";
import { snapshotFor } from "./sound-mix.mjs";
import { loadDog } from "./scene/dog-model.mjs";
import { loadMacaws } from "./scene/macaws.mjs";
import { pendingInvite } from "./steam-net.mjs";
import { COACH_TUNING } from "./spatial.mjs";
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
import { SOAK } from "./onsen.mjs";
import { HEIGHTS, TUB_LANE } from "./dive-plan.mjs";
import { SKILL, shownType } from "./dive.mjs";
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
// The window's size, read once and again after it changes: asked in a frame, after the frame's own writes to the page, it can
// make the browser lay the page out there and then (the tags, the alert and the coach's prompt all place themselves by it).
const win = { w: 0, h: 0 };
const windowSize = () => {
  if (!win.w) {
    win.w = innerWidth;
    win.h = innerHeight;
  }
  return win;
};
addEventListener("resize", () => (win.w = 0));
const finePointer = window.matchMedia("(pointer: fine)");
// Reduce motion: the system's wish, unless Settings says otherwise (`motionChoice`, set once the settings are read).
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
let motionChoice = "auto";
const reducedMotion = {
  get matches() {
    return motionReduced({ motion: motionChoice }, motionQuery.matches);
  },
};
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
// The Look tuner's antialiasing switch (look-tuner.mjs, dev mode only), read before the drawing surface is made.
const lookNoAA = (() => {
  try {
    const saved = JSON.parse(crashStorage?.getItem("pool-panic.settings.v1") || "{}") || {};
    return !testing && antialiasOff(crashStorage, devOn(saved, params));
  } catch {
    return false;
  }
})();
const tuning = readTuning(location.search, [
  ...(lookNoAA ? ["noaa"] : []),
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
  menuStage = null, // the menu's 3D stage (scene/menu-stage.mjs): drawn instead of the venue while the menu is up
  title = null, // the title screen's behaviour (title.mjs)
  doorsOpening = false,
  freeUi = null, // FREE PLAY's window (free-ui.mjs)
  coopUi = null, // PLAY WITH FRIENDS' window (coop-ui.mjs)
  // A co-op shift being played (net.mjs): { session, shift, predictor }. Its shift never pauses, nobody's machine slows it.
  coop = null,
  freeChoice = null, // the pool and difficulty of the free-play shift being played (play again plays it again)
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
    sim?.venue?.onsen ||
    sim?.venue?.dive) &&
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
                      : sim.venue.dive
                        ? "dive"
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
// Settings' sliders and switches (title.mjs): volumes, brightness, film grain, the Coach Cam's mouse, reduce motion.
settings = normalizeSettings(settings);
motionChoice = settings.motion;
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
// The Coach Cam on or off, from any of its switches (the shift card's, Settings', V): all three show the same, and a shift
// under way (or paused) changes view at once, the Coach Cam picking up where the coach faces.
function setCoachCam(on) {
  settings.coachCam = !!on;
  saveSettings();
  $("coach-cam").checked = settings.coachCam;
  $("set-coachcam").checked = settings.coachCam;
  if (!world || !sim || !["playing", "countdown", "paused"].includes(mode)) return;
  applyViewMode();
  if (settings.coachCam && world.coachCam) world.coachCam.yaw = sim.coach.angle ?? world.coachCam.yaw;
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
// A sticker's picture (assets/hud/stickers/, tools/hud/stickers.mjs); the incident's emoji stands in if the file is not there.
function stickerImage(key, fallback = "❗") {
  const img = document.createElement("img");
  img.alt = "";
  img.draggable = false;
  img.decoding = "async";
  img.onerror = () =>
    img.replaceWith(Object.assign(document.createElement("span"), { textContent: fallback }));
  img.src = stickerUrl(key);
  return img;
}
// (fetched once the game is up, so the first incident's sticker is on screen with its sting)
const warmStickers = () => STICKERS.forEach((key) => (new Image().src = stickerUrl(key)));
let stingAnimation = null,
  viewClock = 0,
  alertKey = "";
function showSting(sting) {
  if (!sting) return;
  const el = $("sting"),
    reduced = reducedMotion.matches,
    ms = sting.duration * 1000;
  el.className = "sting " + sting.tone + (sting.first ? " first" : "") + (sting.sticker ? " has-art" : "");
  // Its sticker and its name; one short line the first time a player meets it, and never which key to press (13 November
  // 2026, "minimize all of the text that is on the HUD"). The same sticker then waits in the row below (renderStickers).
  const icon = el.querySelector(".sting-icon");
  if (sting.sticker) icon.replaceChildren(stickerImage(sting.sticker, sting.icon));
  else icon.textContent = sting.icon;
  el.querySelector(".sting-title").textContent = sting.title;
  el.querySelector(".sting-verb").textContent = sting.first ? sting.line || "" : "";
  el.hidden = false;
  document.body.classList.add("sting-on");
  world.focusMoment(sting.x, sting.z, Math.min(2, sting.duration));
  audio.sting(sting.kind, sting.first);
  stingAnimation?.cancel();
  // Slam in at the top of the column of messages, hold, then shrink away: the incident banner takes its place there.
  const at = (t) => Math.min(0.99, t / ms),
    frame = (x, scale, turn, opacity, offset) => ({
      transform: `translateX(${x}px) scale(${scale}) rotate(${turn}deg)`,
      opacity,
      offset,
    });
  stingAnimation = el.animate(
    reduced
      ? [{ opacity: 0 }, { opacity: 1, offset: at(150) }, { opacity: 1, offset: 1 - at(250) }, { opacity: 0 }]
      : [
          frame(-70, 1.45, -7, 0, 0),
          frame(6, 0.95, -1, 1, at(140)),
          frame(0, 1, -2, 1, at(230)),
          frame(0, 1, -2, 1, 1 - at(280)),
          frame(-20, 0.7, 0, 0, 1),
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
let markerHalf = 0;
function updateAlert() {
  const marker = $("alert-marker"),
    arrow = $("alert-arrow"),
    a = mode === "playing" ? sim.loudestAlert() : null;
  if (!a) {
    putFlag(marker, "hidden", true);
    putFlag(arrow, "hidden", true);
    alertKey = "";
    return;
  }
  const b = world.cameraBounds(),
    rect = { left: b.left + 28, right: b.right - 28, top: b.top + 28, bottom: b.bottom - 28 },
    p = world.screenPoint(a.x, a.y ?? 1.8, a.z),
    edge = edgeArrow(p, rect),
    far = Math.hypot(a.x - sim.coach.x, a.z - sim.coach.z),
    label = a.label + (far > (a.near ?? 4) ? " · " + Math.round(far) + " m" : ""),
    tone = a.urgency >= 85 ? " danger" : "",
    key = (edge ? "edge|" : "mark|") + a.icon + "|" + label + "|" + tone,
    width = windowSize().w;
  putFlag(marker, "hidden", !!edge);
  putFlag(arrow, "hidden", !edge);
  const el = edge ? arrow : marker;
  if (key !== alertKey) {
    alertKey = key;
    put(part(el, "b"), a.icon);
    put(part(el, "span:not(.alert-chip)"), label);
    markerHalf = 0; // (its words changed: measured again below)
  }
  if (edge) {
    // The label sits below the badge (above it on the bottom edge) and hugs the screen edge it is near.
    const look =
      "alert-arrow" +
      tone +
      (Math.sin(edge.angle) > 0.6 ? " low" : "") +
      (edge.x > width - 110 ? " at-right" : edge.x < 110 ? " at-left" : "");
    if (arrow.className !== look) arrow.className = look;
    putStyle(arrow, "left", edge.x + "px");
    putStyle(arrow, "top", edge.y + "px");
    putStyle(arrow, "--angle", edge.angle + "rad");
  } else {
    // A person or visitor already wears a tag: the marker sits just above it rather than on top of it. Where the tag is comes
    // from where it was put this frame (placeTags: its middle at `_left`, its foot at `_top`, a quiet one drawn at 0.8), not
    // from the page, which would have to lay itself out to say (every frame of every incident, until 13 November 2026).
    const tag = a.id != null && bubbles.get(a.id),
      over = tag && tag._w && tag._p?.seen.hidden === false ? tag : null,
      look = "alert-marker" + tone;
    if (marker.className !== look) marker.className = look;
    // (its own width is measured when its words change, not every frame)
    if (!markerHalf) markerHalf = marker.offsetWidth / 2 + 6;
    putStyle(
      marker,
      "left",
      Math.max(markerHalf, Math.min(width - markerHalf, over ? over._left : p.x)) + "px",
    );
    putStyle(marker, "top", (over ? over._top - over._h * (over._p.seen.cQuiet ? 0.8 : 1) - 4 : p.y) + "px");
  }
}
const bubbles = new Map();
let stationLabels = [];
const STATION_LABEL_NEAR = 6,
  HUD_TOP = 4;
let coinSeen = null,
  coinSimSeen = null,
  coinGather = 0,
  coinGatherAt = 0;
// The Look tuner (look-tuner.mjs): its sidebar, and whether it holds the shift still.
let lookTuner = null,
  lookFreeze = false;
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
  if (live && mode === "paused" && !$("pause-dialog").open) {
    fillPauseShift();
    $("pause-dialog").showModal();
  }
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
  ["massage", "💆 Massage"],
  ["influencer", "🤳 Influencer"],
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
        ...(coop && { crew: coop.shift.options.crew }),
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
      // (the copy is put together between two frames, not in one: the whole log as text, twice)
      if (live.due()) whenIdle(() => live?.poll());
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
  if (key === "massage" && !sim.venue.fixtures?.massage) return "no massage table here";
  if (key === "influencer" && !sim.venue.selfieSpots?.length) return "not at this pool";
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
// (how long each stage took in this frame, in ms: what a slow frame's line in the log is made of, `hitchWatch`)
const stageMs = {};
function stage(name, fn) {
  const began = performance.now();
  try {
    fn();
    if (failing[name]) failing[name] = 0;
    stageMs[name] = performance.now() - began;
    return true;
  } catch (e) {
    stageMs[name] = performance.now() - began;
    failing[name] = (failing[name] || 0) + 1;
    if (failing[name] === 1 || failing[name] % 300 === 0) console.error("Pool Panic frame error", name, e);
    crashlog.error("frame:" + name, e);
    return false;
  }
}
// Housekeeping that can wait a moment (the log's numbers every few seconds, a playtest's copy of the log) is done when the page
// has nothing else to do, between two frames, and within a second at the latest: never inside a frame, where it was a few
// milliseconds on top of whatever that frame had to do (13 November 2026).
const whenIdle = (fn, within = 1000) =>
  typeof requestIdleCallback === "function"
    ? requestIdleCallback(() => fn(), { timeout: within })
    : setTimeout(fn, 0);
// A frame that took far longer than the ones around it, while a shift is played, leaves a line in the log: how long, which
// stages of the frame took the time, what was going on, and whether a shader was compiled or a picture sent to the graphics card
// just then (which a shift should never do after its first frame: warmShaders, warmCast). Written because the machine this game
// is made on has no graphics card (13 November 2026): what lags on a player's machine is that machine's to say, and a tester
// build's log says it by itself. "Far longer" is against the shift's own recent frames (a slow device's every frame is long, and
// must not fill the log), at most one line every four seconds and thirty a shift.
const HITCH = { work: 34, gap: 110, times: 2.5, every: 4000, settle: 2500, most: 30 };
const hitch = { since: 0, at: 0, skipped: 0, lines: 0, work: 0, gap: 0, programs: 0, textures: 0, sim: null };
function hitchWatch(gap, work) {
  if (mode !== "playing" || world.cinematic || !sim) {
    hitch.since = 0;
    return;
  }
  const now = performance.now(),
    info = world.renderer?.info,
    programs = info?.programs?.length || 0,
    textures = info?.memory?.textures || 0,
    shaders = programs - hitch.programs,
    pictures = textures - hitch.textures;
  hitch.programs = programs;
  hitch.textures = textures;
  if (hitch.sim !== sim) {
    hitch.sim = sim;
    hitch.lines = 0;
    hitch.since = 0;
  }
  if (!hitch.since) {
    // (a shift's first moments are its warm-up, and so is coming back from a pause)
    hitch.since = now;
    hitch.work = work;
    hitch.gap = gap;
    return;
  }
  const usualWork = hitch.work,
    usualGap = hitch.gap;
  // (what a frame usually takes here: the recent ones, a hitch itself counting for little)
  hitch.work += (Math.min(work, usualWork * 3 + 5) - usualWork) * 0.05;
  hitch.gap += (Math.min(gap, usualGap * 3 + 5) - usualGap) * 0.05;
  if (now - hitch.since < HITCH.settle || gap > 2000) return;
  // (too much of the game's own work in one frame, or a long wait between two frames that was not the game's work: the
  // graphics card, the browser, memory being tidied)
  const heavy = work > Math.max(HITCH.work, usualWork * HITCH.times),
    late = gap > Math.max(HITCH.gap, usualGap * HITCH.times),
    compiled = shaders > 0;
  if (!heavy && !late && !compiled) return;
  if (now - hitch.at < HITCH.every || hitch.lines >= HITCH.most) {
    hitch.skipped++;
    return;
  }
  hitch.at = now;
  hitch.lines++;
  let parts = "";
  for (let n = 0; n < 3; n++) {
    let top = "",
      ms = 2;
    for (const name in stageMs)
      if (stageMs[name] > ms && !parts.includes(name + " ")) {
        top = name;
        ms = stageMs[name];
      }
    if (!top) break;
    parts += (parts ? ", " : "") + top + " " + Math.round(ms);
  }
  const going = [
    (sim.activeSystems?.() || []).map((s) => s.key).join("+"),
    sim.rescue ? "rescue" : "",
    sim.cleanup ? "cleanup" : "",
    sim.big && ["announce", "live"].includes(sim.big.stage) ? "big moment" : "",
  ]
    .filter(Boolean)
    .join("+");
  crashlog.crumb(
    "hitch",
    (heavy
      ? Math.round(work) +
        " ms of the game's work in one frame" +
        (parts ? " (" + parts + ")" : "") +
        ", usually " +
        Math.round(usualWork)
      : late
        ? Math.round(gap) +
          " ms between two frames, usually " +
          Math.round(usualGap) +
          "; the game's own work " +
          Math.round(work) +
          " ms"
        : "no slow frame") +
      (compiled ? " · " + shaders + " shader" + (shaders > 1 ? "s" : "") + " compiled mid-shift" : "") +
      (pictures > 0 ? " · " + pictures + " new picture" + (pictures > 1 ? "s" : "") + " on the card" : "") +
      (going ? " · during " + going : "") +
      (hitch.skipped ? " · " + hitch.skipped + " more not written" : ""),
  );
  hitch.skipped = 0;
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
    lookTuner?.refresh();
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
// No row of lane buttons since 13 November 2026 (the creator: "I don't think we need to display all of the pool lanes. On the
// bottom of this screen, let's remove that. Instead, whenever we click on a swimmer that is waiting to be assigned… we see a
// very, very subtle glow on the lanes on top of the pool. It's very visual that I have to click on top of the lanes to assign
// the swimmer"). A guest is sent by clicking the place itself, which glows while they are selected (scene.mjs laneHighlights:
// a lane, a zone, a spring, a board, the kids' pool, the river); the numbers still do it too. What is left down there is the
// few choices that are not a place in the pool, as small chips that show only when they are of use: the river's two ways
// round and the rooftop's seats (while a waiting guest is selected), the bar (while a drink is ordered), the wave machine.
const chip = (extra, attrs, icon, key, label) =>
  `<button class="lane-btn chip ${extra}" ${attrs} aria-label="${label}" title="${label}"><span class="chip-icon" aria-hidden="true">${icon}</span><span class="lane-mode"></span><span class="lane-count"></span><span class="lane-caps"></span><kbd>${key}</kbd></button>`;
function renderLaneControls(venue) {
  // The kit's names: the Lazy River's rack and the Wave Pool's hut hold tubes, not fins.
  const tubes = venue.river || venue.waves;
  $("fins").innerHTML = tubes
    ? '<span>🛟</span>Tubes <b id="fin-count">' + (venue.tubes ?? 3) + "</b><kbd>F</kbd>"
    : '<span>🦶</span>Fins <b id="fin-count">3</b><kbd>F</kbd>';
  $("fins").title = tubes ? "Tubes" : "Fins";
  const bar = chip("bar-btn", 'data-lane="bar" hidden', "🍹", "B", "A tray of margaritas from the bar");
  let chips = "";
  // (The Lazy River's two ways round: 1 the lazy loop, 2 the rapids, river-ride.mjs ROUTES.)
  if (venue.river)
    chips =
      chip("river-btn when-ready", 'data-lane="river" data-route="0"', "🐢", "1", "The lazy loop") +
      chip("river-btn when-ready", 'data-lane="river" data-route="1"', "⚡", "2", "The rapids");
  // (The Rooftop Pool's seats for a guest waiting by the lift: 1 the water, 2 a sunbed, 3 a cabana, rooftop.mjs SEATS.)
  else if (venue.roof) {
    chips =
      SEATS.map((s, i) =>
        chip("seat-btn when-ready", `data-lane="seat" data-seat="${i}"`, s.icon, i + 1, s.name.toLowerCase()),
      ).join("") + bar;
    $("fins").innerHTML = '<span>🍹</span>Tray <b id="fin-count">3</b><kbd>F</kbd>';
    $("fins").title = "A tray of margaritas";
  }
  // (The Wave Pool's machine: stopped, or started again.)
  else if (venue.waves) chips = chip("waves-btn", 'data-lane="waves"', "🌊", "Z", "The wave machine");
  else if (venue.cruise) chips = bar;
  $("lane-controls").innerHTML = chips;
  $("lane-controls").classList.remove("five-lanes");
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
  // (And the Jumping Pool's two big divers, Carl and the leopard man, who come to dive there: dive.mjs.)
  if (activeSwimmerChoice() === "models" && s.venue.dive)
    for (const id of ["carl", "leopard"]) loadFigure(id);
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
// START, from the menu: the coach walks to the doors and opens them, the light fills the screen and the shift begins behind it
// (scene/menu-stage.mjs `openDoors`). Anywhere else (a restart, a trial), or with reduced motion, the shift begins at once.
// The dressed venues, each loaded when a shift there is chosen (3 November 2026). Until then all thirteen loaded one after the
// other behind the menu at every launch: about 100 MB fetched and 190 MB more of the page's memory, most of it never played. The
// Community Pool (the Harbourside) still loads at launch; START loads the shift's venue while the doors open (a few tenths of a
// second from the desktop app's disk, the doors take three and a half), and the week's next pool is fetched behind the menu.
// Until a venue is in (and with ?nomodels) its classic look plays, as before.
const VENUE_LOADS = {
  resort: ["Splash Park", loadSplashPark],
  kids: ["Kids Pool", loadKidsPool],
  lagoon: ["Sunset Lagoon", loadLagoonClub],
  disco: ["Aqua Disco", loadDiscoClub],
  // (the hall's crowd, scene/crowd-models.mjs, and its officials, scene/officials.mjs, come with it)
  aquatic: [
    "Aquatic Centre",
    () => Promise.all([loadAquaticClub(), loadCrowdModels(), loadOfficials()]).then(([m]) => m),
  ],
  onsen: ["Mountain Hot Springs", loadOnsenClub],
  wave: ["Wave Pool", loadWaveClub],
  senior: ["Senior Aqua Fit", loadSeniorClub],
  // (its macaws, scene/macaws.mjs, come with it)
  river: ["Lazy River", () => Promise.all([loadRiverClub(), loadMacaws()]).then(([m]) => m)],
  cruise: ["Cruise Ship", loadCruiseClub],
  roof: ["Rooftop Pool", loadRoofClub],
  dive: ["Jumping Pool", loadDiveClub],
  arena: ["Grand Gala Arena", () => Promise.all([loadArenaClub(), loadCrowdModels()]).then(([m]) => m)],
};
const venueLoads = new Map();
// `{ promise, done }` for the venue `id`, started on the first ask; null for a venue with nothing to load.
function loadVenue(id) {
  const job = VENUE_LOADS[id];
  if (!job || tuning.has("nomodels")) return null;
  if (!venueLoads.has(id)) {
    const began = performance.now(),
      load = { done: false };
    load.promise = Promise.resolve()
      .then(job[1])
      .catch(() => null)
      .then((model) => {
        load.done = true;
        crashlog.crumb(
          "venue",
          (model ? job[0] + " loaded in " : job[0] + " failed after ") +
            Math.round(performance.now() - began) +
            " ms" +
            (model ? "" : ": the classic " + job[0] + " stays"),
        );
        return model;
      });
    venueLoads.set(id, load);
  }
  return venueLoads.get(id);
}
// `then` at once when the venue is in (or has nothing to load), else when it is, 15 s at most (the classic look plays after that).
function whenVenue(load, then) {
  if (!load || load.done) return then();
  Promise.race([load.promise, new Promise((r) => setTimeout(r, 15000))]).then(then);
}
// The pool of the week's next shift, fetched behind the menu so its START is as quick as the Community Pool's.
function prefetchNextPool() {
  const w = weekUi?.save?.week,
    pool = w?.pools?.[w.shift];
  if (pool) loadVenue(POOLS[pool]?.style?.venue || pool);
}
function start(bookingId = null, week = null) {
  if (doorsOpening) return;
  // (the shift's venue loads now, if it is not in yet: loadVenue)
  const venue = loadVenue(week?.config?.venue || SHIFTS[level - 1]?.venue || "club");
  if (mode === "menu" && menuStage?.ready && !reducedMotion.matches && !testing) {
    document.querySelectorAll("dialog[open]").forEach((d) => d.close());
    document.activeElement?.blur();
    const flash = $("door-flash");
    let finishing = false;
    const finish = () => {
      if (!doorsOpening || finishing) return;
      finishing = true;
      whenVenue(venue, () => {
        doorsOpening = false;
        startNow(bookingId, week);
        flash.classList.add("out");
        flash.style.opacity = 0;
        setTimeout(() => flash.classList.remove("out"), 900);
        document.body.classList.remove("doors");
      });
    };
    const opening = menuStage.openDoors({
      flash: (v) => (flash.style.opacity = v),
      sound: () => audio.effect("doors-open"),
      then: finish,
    });
    if (opening) {
      doorsOpening = true;
      // (Should the stage stop drawing, the shift still starts: a watch that sees the doors' clock stand still for 3 s.)
      let last = -1;
      const watch = setInterval(() => {
        const t = menuStage?.open?.t ?? -1;
        if (!doorsOpening || t === last) {
          clearInterval(watch);
          finish();
        }
        last = t;
      }, 3000);
      document.body.classList.add("doors");
      audio.stopMenu(1.2);
      crashlog.crumb("menu", "the doors open");
      return;
    }
  }
  if (testing) startNow(bookingId, week);
  else whenVenue(venue, () => startNow(bookingId, week));
}
// FREE PLAY (free-ui.mjs): a shift at the pool and difficulty chosen, built by the week's builder without the week.
function startFree(pool, levelId) {
  const shift = freePlayShift(
    pool,
    levelId,
    (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0,
    weekUi?.save?.known || [],
  );
  crashlog.crumb(
    "free",
    `free play · ${pool} · ${levelId} · tier ${shift.tier} · incidents ${shift.plan.incidents.join(",") || "none"}`,
  );
  start(null, shift);
}
// PLAY WITH FRIENDS (coop-ui.mjs, net.mjs): every machine of the crew builds the same free-play shift from the host's pool,
// difficulty, seed and met incidents, with a coach for each player; the host plays it, the guests follow it.
function startCoop(shift, session) {
  $("coop-dialog").close();
  coop = { session, shift, predictor: new Predictor() };
  for (const look of shift.options.crew) loadCrewModel(look, coachInfo(look).model);
  // (the names over the others' coaches: the player's, or their coach's when they have none)
  world.setCrewNames?.(
    shift.options.crew.map((look, i) => {
      const n = session.player(i)?.name;
      return n && n !== "Coach" ? n : coachInfo(look).short;
    }),
  );
  const week = freePlayShift(shift.choice.pool, shift.choice.level, shift.seed, shift.known || []);
  crashlog.crumb(
    "coop",
    `co-op · ${session.index === 0 ? "host" : "guest " + session.index} · crew ${shift.options.crew.join(",")} · ${shift.choice.pool} · ${shift.choice.level}`,
  );
  nextSeed = shift.seed;
  if (!session.coopWired) {
    session.coopWired = true;
    session.on("closed", () => {
      if (coop?.session !== session) return;
      coop = null;
      world.drawAhead = null;
      returnMenu();
      toast("The host left the crew: the shift is over.", true);
    });
    session.on("left", (p) => coop && toast(`${p.name} dropped out: their coach waits for them.`, true));
    session.on("desync", ({ tick }) => crashlog.crumb("coop", "out of step with the host at tick " + tick));
  }
  start(null, week);
}
function leaveCoop() {
  if (!coop) return;
  coop = null;
  world.drawAhead = null;
  coopUi?.leave();
}
function startNow(bookingId = null, week = null) {
  audio.stopMenu(1);
  freeChoice = week?.free ? { pool: week.free.pool, level: week.free.level } : null;
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
        ...(coop && { crew: coop.shift.options.crew }),
      })
    : drill
      ? new PoolSimulation(drill.tier, runSeed, { config: { ...drill.config, ...man }, drill: drill.id })
      : new PoolSimulation(level, runSeed, {
          booking: activeBooking,
          config: { ...SHIFTS[level - 1], ...shiftGuests, ...man },
        });
  tutor = sim.config.tutorial ? new Tutor(sim.config.tutorial) : null;
  $("tutor").hidden = true;
  syncVenue(sim);
  world.resetActors();
  tracer.reset();
  startRecorder(drill);
  // (co-op: the session shares this machine's inputs and, on a guest, plays the host's: after the recorder, which then records
  // what is played, not what is asked)
  if (coop) coop.session.attach(sim);
  if (playtest) beginPlaytestShift(drill);
  loadCannonballMan(sim);
  loadFishKid(sim);
  loadStar(sim);
  for (const name of sim.venue.props || ["mop", "mop-bucket"]) loadProp(name);
  richPresence(
    week?.free
      ? "Free play · " + week.place
      : week
        ? "Week " + week.chapter.id + " · " + week.day
        : drill
          ? "Drill · " + drill.name
          : "Level " + level + " · " + sim.config.name,
  );
  weekUi?.hideMenu();
  sim.start({ countdown: true });
  mode = "countdown";
  // The intro cinematic, before the countdown (scene/intro-cinematic.mjs): the shift waits until it is over or skipped. Not in
  // co-op (the crew's machines start together), the Coach Cam, a replay, or when Settings has it off.
  // (in a run, a pool's cinematic plays the first time the pool comes, not every shift: the fun plan, "the reward's feel")
  const cinematic =
    settings.cinematics !== false &&
    (!week || weekUi?.cinematicDue?.(week.pool) !== false) &&
    !coop &&
    world.viewMode !== "coach" &&
    !replayRun &&
    !tuning.has("nocine");
  snagged = false;
  $("clock").classList.remove("last-call");
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
  if (cinematic) startCinematic();
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
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $("game").requestFullscreen();
  } catch {
    toast("Fullscreen is unavailable here. The game still fills this window.");
  }
}
// Settings at work (title.mjs): the mix, the light of the venues and of the menu, the film grain, the Coach Cam's mouse,
// reduce motion.
function applySettings(s = settings) {
  audio.setVolumes(volumesOf(s));
  world?.setBrightness?.(s.brightness / 100);
  if (menuStage) menuStage.brightness = s.brightness / 100;
  document.documentElement.style.setProperty("--grain", grainOpacity(s));
  if (world?.coachCam) {
    world.coachCam.lookScale = s.sensitivity / 100;
    world.coachCam.invertY = s.invertY;
  }
  motionChoice = s.motion;
  frameCap = s.cap60 === false ? 0 : 60;
  if ($("set-look")) $("set-look").hidden = !devMode();
  document.body.classList.toggle("calm", reducedMotion.matches);
  // (dev mode switched in Settings: the menu's FREE PLAY count follows at once)
  if (mode === "menu") weekUi?.menu();
}
// Dev mode (dev.mjs): every pool and difficulty open in FREE PLAY; the address's ?dev=1 or ?dev=0 wins over the setting.
function devMode() {
  return devOn(settings, params);
}
// The first guests behind the menu's doors (scene/menu-stage.mjs GUESTS), each as soon as its model is in: three of the swimmers
// (loading for the game anyway), and the leopard man, Carl, Marco and Valentina (their figures, which a shift would load).
async function loadMenuGuests(swimmersLoading) {
  const add = (spec, template) => template && menuStage?.addGuest(spec, template);
  const want = (id) => GUESTS.find((g) => g.id === id);
  const jobs = [];
  if (swimmersLoading)
    jobs.push(
      swimmersLoading.then(() => {
        for (const spec of GUESTS) if (!GUEST_FIGURES.includes(spec.id)) add(spec, swimmerTemplate(spec.id));
      }),
    );
  // (the leopard man, Carl, Marco and Valentina: the same files their shifts load, kept once loaded)
  for (const id of GUEST_FIGURES) jobs.push(loadFigure(id).then((t) => add(want(id), t)));
  const results = await Promise.allSettled(jobs);
  crashlog.crumb(
    "menu",
    `guests behind the doors: ${menuStage?.guests.length || 0} of ${GUESTS.length}` +
      (results.some((r) => r.status === "rejected") ? " (a model failed)" : ""),
  );
}
// The menu's stage failed to draw: the menu's plain backdrop behind it (.menu-art; never the old menu's picture).
function dropMenuStage() {
  crashlog.crumb("menu", "the 3D stage stopped drawing; the plain backdrop behind the menu instead");
  menuStage?.dispose();
  menuStage = null;
  document.body.classList.remove("stage");
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
  // The menu's music comes back after a shift: the second track, quieter, fading in slower (the shift's song stops).
  audio.playing = false;
  if (title) audio.startMenu("return", { fade: 6, level: 0.7 });
  menuStage?.reset();
  title?.showTip();
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
  renderStickers(NO_CARDS);
  $("toast").hidden = true;
  document.body.classList.add("menu");
  weekShift = null;
  weekUi?.dismiss();
  clearBubbles();
  syncUnlocks();
  updateMenu(reveal);
  weekUi?.menu();
  prefetchNextPool();
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
  if (sim.config.free) return "FREE PLAY · " + freeLevel(sim.config.free.level).name.toUpperCase();
  const weekTag = weekUi?.hudTag(sim.config);
  if (weekTag) return weekTag;
  if (sim.drill) return "DRILL";
  const zone = zoneOfLevel(sim.level);
  if (!zone) return "";
  return zone.kind === "finale"
    ? `ACT ${zone.act} · FINALE`
    : `${zone.name.toUpperCase()} · ${zone.nodes.findIndex((n) => n.level === sim.level) + 1} OF ${zone.nodes.length}`;
}

// What the HUD no longer shows in a shift (5 November 2026): the venue and the shift, the coins it takes to pass and to earn each
// star, and which are already earned. Shown only in the pause menu, of a shift.
function fillPauseShift() {
  const live = ["playing", "countdown", "paused"].includes(mode);
  $("pause-shift").hidden = !live;
  if (!live) return;
  const pool = POOLS[sim.config.pool]?.name || sim.config.place || sim.venue?.name || "";
  $("pause-venue").textContent = pool || sim.config.name;
  // (the day's rule, the fun plan: its name and what it does, here and nowhere over the pool)
  const rule = RULES[sim.config.rule];
  $("pause-tag").textContent = [
    pool && sim.config.name !== pool ? sim.config.name : "",
    shiftTag(),
    rule ? rule.icon + " " + rule.name + ": " + rule.note : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const coins = (n) => Math.round(n).toLocaleString("en-US"),
    pass = sim.config.week ? passMark(sim.config) : 0,
    rows = [
      ...(pass ? [{ label: "PASS", at: pass }] : []),
      ...sim.config.thresholds.map((at, i) => ({ label: "★".repeat(i + 1), at })),
    ];
  $("pause-goals").innerHTML =
    `<div class="pause-now"><img src="assets/hud/coin.webp" alt="" width="22" height="22" /><b>${coins(sim.score)}</b> Splash Coins</div>` +
    rows
      .map(
        (r) =>
          `<div class="pause-goal${sim.score >= r.at ? " met" : ""}"><span>${r.label}</span><b>${coins(r.at)}</b><i>${sim.score >= r.at ? "✓" : coins(r.at - sim.score) + " to go"}</i></div>`,
      )
      .join("");
}
// The intro cinematic's page side: the letterbox, a name card for each shot (the coach, the venue and its shift, "here they
// come…"), a white flash at every cut, the HUD hidden; any key or click skips it.
function startCinematic() {
  const venueName = (
      POOLS[sim.config.pool]?.name ||
      sim.config.place ||
      sim.venue?.name ||
      sim.config.name
    ).toUpperCase(),
    venueCard = [
      venueName,
      [sim.config.name !== venueName ? sim.config.name : "", shiftTag()].filter(Boolean).join(" · "),
    ],
    // (one card a shot, by its kind: the venues' own shots have theirs)
    cards = {
      coach: ["COACH WATERS", "On duty"],
      venue: venueCard,
      crane: venueCard,
      monkey: ["SNOW MONKEYS", "They want the hot water too"],
      valentina: ["VALENTINA", "Tonight's routine"],
      dj: ["THE DJ", "Waiting for the drop"],
      bartender: ["SKY BAR", "Margaritas, three to a tray"],
      nervous: ["HERE THEY COME…", ""],
    };
  const overlay = $("intro-cine"),
    black = $("cine-black");
  let dipped = false;
  // The end: its last half second dips to black (the card stays over it), the game comes up out of the black. A skip is a cut.
  world.onCinematicDip = () => {
    dipped = true;
    overlay.classList.add("dipping");
    black.classList.remove("out");
    black.classList.add("dip");
  };
  world.onCinematic = (index, kind) => {
    if (index < 0) {
      document.body.classList.remove("cine-on");
      $("countdown").hidden = mode !== "countdown";
      crashlog.crumb("cinematic", dipped ? "done" : "skipped");
      if (!dipped) {
        overlay.hidden = true;
        return;
      }
      // the camera is the game's again under the black: let it draw, then fade the black away
      overlay.classList.add("closing");
      let frames = 0;
      const back = () => {
        if (++frames < 3) return requestAnimationFrame(back);
        black.classList.remove("dip");
        black.classList.add("back");
        // gone once the black has lifted (or a little after, should the browser not say so)
        let done = false;
        const finish = () => {
          if (done || !overlay.classList.contains("closing")) return; // (a new cinematic took the overlay)
          done = true;
          overlay.hidden = true;
          overlay.classList.remove("closing", "dipping");
          black.classList.remove("back");
        };
        black.addEventListener("transitionend", finish, { once: true });
        setTimeout(finish, 1500);
      };
      requestAnimationFrame(back);
      return;
    }
    const [title, sub] = cards[kind] || ["", ""];
    $("cine-title").textContent = title;
    $("cine-sub").textContent = sub;
    // (a white flash at each cut; the first shot comes up out of black instead)
    for (const el of index > 0 ? [$("cine-card"), $("cine-flash")] : [$("cine-card")]) {
      el.classList.remove("on");
      requestAnimationFrame(() => el.classList.add("on"));
    }
    $("cine-card").dataset.shot = kind;
  };
  document.body.classList.add("cine-on");
  overlay.classList.remove("closing", "dipping");
  overlay.hidden = false;
  $("countdown").hidden = true;
  // From black: the screen stays black while the venue's first frames draw (the first one warms every shader, scene.mjs), the
  // cinematic's clock held meanwhile, then the picture eases in and the shots run from their start.
  black.classList.remove("out", "dip", "back");
  world.startCinematic(sim, { hold: true });
  let frames = 0;
  const reveal = () => {
    if (!world.cinematic) return;
    if (++frames < 3) return requestAnimationFrame(reveal);
    world.cinematic.hold = false;
    black.classList.add("out");
  };
  requestAnimationFrame(reveal);
}
function skipCinematic(e) {
  if (!world?.cinematic || mode !== "countdown") return;
  e.preventDefault();
  e.stopPropagation();
  world.endCinematic();
}
document.addEventListener("keydown", skipCinematic, { capture: true });
document.addEventListener("pointerdown", skipCinematic, { capture: true });
function pause() {
  if (!["playing", "countdown"].includes(mode)) return;
  fillPauseShift();
  // (a co-op shift goes on for the others: the menu opens over it, as the settings)
  if (coop) {
    releaseMouse();
    menuLook(false);
    $("pause-dialog").showModal();
    return;
  }
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
  fillPauseShift();
  releaseMouse();
  menuLook(false);
  $("pause-dialog").showModal();
}
function closeSettings() {
  if ($("pause-dialog").open) $("pause-dialog").close();
}
let restartLabel = null;
function menuLook(paused) {
  restartLabel ??= $("restart").textContent;
  $("pause-eyebrow").textContent = paused ? "TAKE A BREATHER" : "POOL PANIC";
  $("pause-title").textContent = paused ? "TAKE FIVE." : "SETTINGS";
  $("resume").innerHTML = paused ? "BACK IN ▶" : "Close";
  $("restart").hidden = !paused && !coop;
  $("restart").textContent = coop ? "Leave the crew" : restartLabel;
  $("camera-row").hidden = !paused && !coop;
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
  pausedByHelp = ["playing", "countdown"].includes(mode) && !coop;
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
      ["CLEAN DIVES ✨", st.cleanDives],
      ["BELLY FLOPS 🫃", st.flops],
      ["WIPEOUTS 💥", st.diveFails],
      ["CHICKENED OUT 🐔", st.chickens],
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
// A free-play shift is over: its stars and score, a new best for its pool and difficulty, and Play again.
function finishFree() {
  const r = sim.summary(),
    f = sim.config.free;
  const newBest = freeUi ? freeUi.record(f.pool, f.level, r.score, r.stars) : false;
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
  $("result-week").hidden = true;
  $("result-fund").hidden = true;
  $("result-chunk").hidden = true;
  $("result-eyebrow").textContent =
    `FREE PLAY · ${sim.config.place.toUpperCase()} · ${freeLevel(f.level).name.toUpperCase()} · SHIFT COMPLETE`;
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
  renderResultDetails(r, null);
  $("next-level").hidden = true;
  $("play-again").hidden = false;
  $("play-again").textContent = "Play again ↻";
  $("play-again").className = "primary";
  $("back-menu").textContent = "Back to the menu";
  $("results-dialog").showModal();
  $("play-again").focus({ preventScroll: true });
  $("results-dialog").scrollTop = 0;
  offerHighlight();
  if (r.stars > 0) world.confetti();
}
// A co-op shift is over (every machine has the same results): back to the crew's lobby for another, or leave the crew.
function finishCoop() {
  const r = sim.summary(),
    f = sim.config.free,
    crew = coop.shift.options.crew.length;
  richPresence("Looking at the results");
  $("result-week").hidden = true;
  $("result-fund").hidden = true;
  $("result-chunk").hidden = true;
  $("result-eyebrow").textContent =
    `CO-OP · ${crew} COACHES · ${sim.config.place.toUpperCase()} · ${freeLevel(f.level).name.toUpperCase()} · SHIFT COMPLETE`;
  $("result-stars").textContent = Array.from({ length: 3 }, (_, i) => (i < r.stars ? "★" : "☆")).join(" ");
  $("result-title").textContent =
    r.stars === 3
      ? "Dream team. The pool never stood a chance."
      : r.stars === 2
        ? "Great teamwork out there."
        : r.stars === 1
          ? "You kept each other's heads above water."
          : "Huddle up. Again.";
  $("result-score").innerHTML = r.score.toLocaleString() + "<small>POINTS</small>";
  $("new-best").hidden = true;
  renderResultDetails(r, null);
  $("next-level").hidden = true;
  $("play-again").hidden = false;
  $("play-again").textContent = "Back to the crew ▶";
  $("play-again").className = "primary";
  $("back-menu").textContent = "Leave the crew";
  $("results-dialog").showModal();
  $("play-again").focus({ preventScroll: true });
  offerHighlight();
  if (r.stars > 0) world.confetti();
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
    (ws.card && (ws.card.mystery || ws.card.rule !== "regular") ? " · " + ws.card.name.toUpperCase() : "") +
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
  if (coop) return finishCoop();
  if (sim.config.free) return finishFree();
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
  // (The Jumping Pool: a line-cutter, a scared diver at the edge, one waiting for the water to clear, in the air, a bored Pro.)
  if (p.status === "dive") {
    if (p.cutter && sim.dive?.cut?.id === p.id) return "😤";
    if (p.dive === "edge" && p.jump?.scared && p.hesitate > 0) return "😰";
    if (p.dive === "edge" && p.edgeWait > 1) return "⏳";
    if (p.dive === "air") return p.jump?.flail ? "😱" : p.jump?.ball ? "💣" : "🤸";
    if (
      ["walk", "line", "climb", "out", "edge"].includes(p.dive) &&
      p.board != null &&
      skillOfShown(p) > p.board % 3
    )
      return "😒";
  }
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
// What a guest says they are, as a height (a show-off says Pro until checked).
const skillOfShown = (p) => SKILL[shownType(p)] ?? 1;
function cardStatus(p) {
  // The Jumping Pool: what they say they are and where to send them, the board they are on, a show-off to check, the hot tub.
  if (sim.venue.dive && !p.stomachWarning) {
    const H = (h) => HEIGHTS[h].name;
    if (p.status === "queue")
      return p.tubOnly
        ? "Hot tub ♨️ · send them to the tub (4)"
        : p.bluff && !p.revealed
          ? "Says they're a Pro 😎 · check them (E beside them)?"
          : roofLook(p).label + " · best on " + H(SKILL[p.type]) + " (" + (SKILL[p.type] + 1) + ")";
    if (p.status === "dive") {
      const b = p.board % 3,
        word = {
          walk: "Off to",
          line: "In line for",
          climb: "Climbing",
          out: "Out on",
          edge: "On the edge of",
          bounce: "Bouncing on",
          air: "Off",
          under: "In",
          swimOut: "Swimming out",
          ladder: "Climbing out",
          down: "Climbing down",
        }[p.dive];
      return p.dive === "swimOut" || p.dive === "ladder" || p.dive === "under"
        ? word + (p.diveResult === "clean" ? " · clean dive ✨" : "")
        : word + " the " + H(b) + " board" + (p.jump?.scared && p.dive === "edge" ? " · 😰 terrified" : "");
    }
    if (p.status === "enter" && p.lane === TUB_LANE) return "Off to the hot tub ♨️";
    if (p.status === "swim" && p.lane === TUB_LANE) return "Soaking in the hot tub ♨️";
    if (p.status === "swim" && p.diveFail) return "Winded after a failed jump · ring!";
  }
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
  put($("send-home"), p?.stomachWarning ? "Send to locker ↗" : "Send home ↗");
  $("send-home").classList.toggle("urgent", !!p?.stomachWarning);
  putFlag($("queue-panel"), "hidden", !p || !["playing", "paused", "countdown", "help"].includes(mode));
  putFlag(
    $("send-home"),
    "hidden",
    !p ||
      !["queue", "enter", "swim"].includes(p.status) ||
      p.problem === "injured" ||
      !!(sim.rescue && p.status === "swim"),
  );
  if (p) {
    const profile = roofLook(p);
    putHTML(
      $("selected-detail"),
      "<b>" +
        p.name +
        " · " +
        profile.label +
        "</b><span>" +
        Math.round(p.h) +
        "% happy · " +
        (p.type === "daredevil"
          ? "Trampoline only"
          : p.type === "child"
            ? p.status === "queue"
              ? "Caught!"
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
                      : "Swimming"
                  : profile.speed
                    ? profile.speed + "× pace"
                    : "Aqua class") +
        "</span>",
    );
  }
}
// The Wave Pool's WAVES button (renderLaneControls): ON with the seconds left of the set, the calm's countdown to the next, the
// horn, a monster on its way (red, flashing), STOPPED by the coach (and for how long: the bathers grow restless), or stopped for an
// emergency. Its dots are the bathers in the water, red for the dizzy ones.
function updateWavesButton(b) {
  const board = waveBoard(sim.waves);
  if (!board) return;
  const bathers = sim.people.filter((q) => q.status === "swim"),
    dizzy = bathers.filter((q) => q.problem === "dizzy").length,
    secs = board.seconds !== undefined ? Math.max(0, Math.ceil(board.seconds)) : null;
  b.classList.toggle("danger", board.state === "monster" || dizzy > 0);
  b.classList.toggle("assignable", board.state === "stopped");
  b.classList.toggle("waves-off", board.state === "stopped" || board.state === "halted");
  put(
    part(b, ".lane-mode"),
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
              : "OFF",
  );
  // (the seconds of what it is counting: the set's, the calm's, the horn's, the monster's)
  put(
    part(b, ".lane-count"),
    secs !== null && board.state !== "stopped" && board.state !== "halted" ? secs + "s" : "",
  );
  putHTML(
    part(b, ".lane-caps"),
    bathers
      .slice(0, 12)
      .map(
        (q) => '<i style="background:' + (q.problem === "dizzy" ? "#ef5a4a" : roofLook(q).color) + '"></i>',
      )
      .join(""),
  );
  putFlag(b, "disabled", mode !== "playing");
}
function updateUI() {
  if (!sim) return;
  document.body.classList.toggle("pool-incident", !!sim.cleanup || !!sim.rescue);
  putFlag($("countdown"), "hidden", mode !== "countdown" || !!world.cinematic);
  if (mode === "countdown") put($("countdown-number"), Math.max(1, Math.ceil(sim.countdown)));
  // The two plaques at the bottom (5 November 2026, the creator: "like Overcooked… in the lower right corner… the time with a
  // progress bar and numeric… in the lower left… the points… green… when we add more points, very, very subtle. Or red"):
  // the shift's Splash Coins, with the streak's multiplier under them while it counts, and the time left with its bar (red under
  // 20 s, amber while an incident holds the clock). The venue, the pass mark and the star targets are in the pause menu.
  const remaining = sim.config.duration - (mode === "menu" ? 0 : sim.time),
    clockText = formatTime(remaining);
  put($("clock"), clockText);
  $("clock").classList.toggle("danger-pulse", remaining < 20 && mode === "playing");
  $("hud-clock").classList.toggle("danger", remaining < 20 && mode !== "menu");
  $("hud-clock").classList.toggle("held", mode === "playing" && !!sim.clockHeld?.() && remaining <= 0.05);
  const clockFill = Math.round(Math.max(0, Math.min(1, remaining / sim.config.duration)) * 1000) / 10 + "%",
    coinText = Math.round(sim.score).toLocaleString("en-US"),
    streakNow = streakTier(sim.streak),
    coinSub = streakNow.mult > 1 ? "STREAK ×" + streakNow.mult : "SPLASH COINS";
  putStyle($("clock-fill"), "width", clockFill);
  put($("coins"), coinText);
  put($("coins-sub"), coinSub);
  $("hud-coins").classList.toggle("streak", streakNow.mult > 1);
  coinChange();
  put($("clarity"), Math.round(100 - sim.contamination) + "%");
  putStyle($("water-fill"), "width", 100 - sim.contamination + "%");
  putStyle($("water-fill"), "background", sim.contamination > 55 ? "#9dba59" : "#48b3b5");
  put(
    $("water-label"),
    sim.contamination > 75
      ? "MURKY"
      : sim.contamination > 45
        ? "CLOUDY"
        : sim.contamination > 20
          ? "GOOD"
          : "SPARKLING",
  );
  put(
    $("chlorine-label"),
    Math.round(sim.chlorine) +
      (sim.chlorine > 75 ? " · Too high!" : sim.chlorine < 40 ? " · Low" : " · Balanced"),
  );
  putStyle($("chlorine-label"), "color", sim.chlorine > 75 ? "#c36340" : "");
  putStyle($("chlorine-dot"), "left", Math.min(98, sim.chlorine / 1.1) + "%");
  put(
    $("fin-count"),
    sim.venue.roof ? (sim.coach.carry === "tray" ? sim.coach.tray : CHILL.tray) : sim.finsAvailable,
  );
  put(
    $("carry"),
    sim.coach.job ? sim.coach.state : sim.coach.carry ? "Holding " + carryName(sim.coach) : "Empty hands",
  );
  putFlag($("return-item"), "hidden", !sim.coach.carry || !!sim.coach.job);
  ["fins", "chlorine", "relief"].forEach((item) => {
    $(item).classList.toggle("busy-btn", sim.coach.carry === item || sim.coach.job?.item === item);
    putFlag($(item), "disabled", mode !== "playing" || !!sim.coach.carry);
  });
  putFlag($("clean"), "disabled", mode !== "playing" || !!sim.coach.job || !!sim.coach.carry);
  $("clean").classList.toggle("busy-btn", sim.clutter.length > 0);
  // The mop (incidents/wet.mjs): how many wet spots are on the deck, and whether the coach has it.
  const wet = sim.wetSpots?.length || 0;
  putFlag(
    $("mop"),
    "disabled",
    mode !== "playing" || !!sim.coach.job || (!!sim.coach.carry && sim.coach.carry !== "mop"),
  );
  $("mop").classList.toggle("busy-btn", wet > 0 || sim.coach.carry === "mop");
  putFlag($("wet-count"), "hidden", !wet);
  put($("wet-count"), wet);
  // A calmer HUD (19 October 2026, Phase 1): a tool that is not needed right now is not on screen. Eye relief shows when someone
  // has sore eyes, Tidy deck when gear lies on the deck, the mop when there is a wet spot (or the coach holds what they need);
  // their keys (R, X, Q) always work.
  const holding = (item) => sim.coach.carry === item || sim.coach.job?.item === item;
  putFlag($("relief"), "hidden", !holding("relief") && !sim.people.some((p) => p.problem === "eyes"));
  putFlag($("clean"), "hidden", !sim.clutter.length);
  putFlag($("mop"), "hidden", !wet && !holding("mop"));
  // Only what the coach needs now (5 November 2026, the creator: "we don't need to see that chlorine always there. We just need to
  // see it when we have a problem… in hands, empty hands, there's no need for that… too much UI"). The Water Check and the
  // chlorine come when the water is a problem: cloudy enough that the guests mind it (from 35, sim.mjs; shown from 30), too much
  // chlorine (sore eyes), a cleanup, or the coach with the chlorine. The fins (the tubes, the tray) when a guest asks for them
  // (every guest at the Wave Pool wants a tube). The hand only when it holds something; the panel only with something in it.
  const waterTrouble =
    sim.contamination > 30 || sim.chlorine > 75 || !!sim.cleanup || sim.closed > 0 || holding("chlorine");
  const gearWanted =
    holding("fins") ||
    holding("tray") ||
    !!sim.venue.waves ||
    sim.people.some((q) => q.status !== "gone" && (q.problem === "fins" || q.problem === "drink"));
  putFlag($("water-check"), "hidden", !waterTrouble);
  putFlag($("chlorine"), "hidden", !waterTrouble);
  putFlag($("fins"), "hidden", !gearWanted);
  putFlag($("coach-state"), "hidden", !sim.coach.carry && !sim.coach.job);
  putFlag(
    $("care-actions"),
    "hidden",
    ["chlorine", "relief", "fins", "clean", "mop"].every((id) => $(id).hidden),
  );
  putFlag(
    $("care-panel"),
    "hidden",
    mode === "menu" || ["water-check", "care-actions", "coach-state"].every((id) => $(id).hidden),
  );
  putFlag($("assist"), "disabled", mode !== "playing");
  put(part($("assist"), ".interact-label"), sim.nearestInteraction()?.label || "Interact");
  // (No lane buttons to keep up since 13 November 2026: a lane's state is in the pool itself. The chips that are left follow.)
  const p = sim.get(sim.selected);
  // The Lazy River's one button: who is riding, who is round the loop, and whether the selected guest has a tube yet.
  // The Lazy River's two ways round (Phase 3): who is on each, the rapids' room, and what the selected guest would make of it.
  for (const riverBtn of $("lane-controls").querySelectorAll('[data-lane="river"]')) {
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
    put(
      part(riverBtn, ".lane-mode"),
      sim.closed
        ? "CLOSED"
        : sim.rescue
          ? "STOPPED"
          : packed
            ? "PACKED!"
            : riding.length
              ? "FLOWING"
              : "OPEN",
    );
    put(
      part(riverBtn, ".lane-count"),
      p?.status === "queue"
        ? p.hasFins
          ? verdict?.text || "Send " + p.name
          : "Hand " + p.name + " a tube first"
        : riding.length
          ? riding.length + " on tubes" + (away ? " · " + away + " round the bend" : "")
          : route === 1
            ? "Thrill-seekers ⚡ · " + RIVER_ROUTES.rapidsRoom + " at a time"
            : "Chillers 🐢 love it",
    );
    putHTML(
      part(riverBtn, ".lane-caps"),
      riding
        .slice(0, 10)
        .map((q) => '<i style="background:' + roofLook(q).color + '"></i>')
        .join(""),
    );
    putFlag(riverBtn, "disabled", mode !== "playing" || !!sim.rescue);
  }
  // The Rooftop Pool's one button: the bar. The orders waiting (a dot each, gold for a VIP's), what is on the tray, and the DJ's
  // next drop once the build-up has begun.
  const barBtn = laneButton("bar");
  if (barBtn) {
    const orders = sim.people.filter((q) => q.problem === "drink"),
      at = nextDrop(sim),
      building = !!sim.roof?.warned && at != null;
    // (the chip: what is on the tray, or how many are waiting for a drink; there only while one is, or the tray is in hand.
    // The DJ's drop has its own sticker.)
    put(
      part(barBtn, ".lane-mode"),
      sim.coach.carry === "tray"
        ? sim.coach.tray + "/" + CHILL.tray
        : orders.length
          ? "×" + orders.length
          : "",
    );
    putFlag(barBtn, "hidden", !orders.length && sim.coach.carry !== "tray");
    barBtn.classList.toggle("assignable", orders.length > 0 && sim.coach.carry !== "tray");
    putHTML(
      part(barBtn, ".lane-caps"),
      orders
        .slice(0, 10)
        .map((q) => '<i style="background:' + (q.vip ? "#e9a92b" : "#9fe06a") + '"></i>')
        .join(""),
    );
    barBtn.classList.toggle("danger", building || orders.some((q) => (q.orderT || 0) > CHILL.grace * 3));
    putFlag(barBtn, "disabled", mode !== "playing");
  }
  // The Rooftop Pool's seats (Phase 3): what is free, and what the selected guest would make of each.
  for (const seatBtn of $("lane-controls").querySelectorAll('[data-lane="seat"]')) {
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
    put(
      part(seatBtn, ".lane-mode"),
      seat === "pool"
        ? inWater
          ? inWater + " IN"
          : "OPEN"
        : free
          ? free + " FREE"
          : messy
            ? "MESSY"
            : "FULL",
    );
    put(
      part(seatBtn, ".lane-count"),
      verdict
        ? verdict.text
        : seat === "pool"
          ? "Chat groups"
          : seat === "bed"
            ? messy
              ? messy + " to tidy (E)"
              : "Sunbathers 🛏️"
            : "VIPs 👑 · bigger tips",
    );
    putFlag(seatBtn, "disabled", mode !== "playing");
  }
  // The Wave Pool's one button: the machine's state, the clock to the next set, the bathers in the water and how many are dizzy.
  const wavesBtn = laneButton("waves");
  if (wavesBtn) updateWavesButton(wavesBtn);
  const chaos = sim.people.filter(
    (p) => p.status === "swim" && (p.h < 50 || p.problem || p.blocked > 3),
  ).length;
  const count = sim.people.filter((p) => p.status === "queue").length;
  // (No status box since 13 November 2026: what is going on is a sticker in the column on the left, and what to do next is in
  // the world: the alert's marker, the prompt over the coach.)
  // The happy streak's badge (Phase 3): the count, its tier and multiplier, what the next tier needs, and the guest who puts it at
  // risk; for a moment after it breaks, what broke it.
  const tier = streakTier(sim.streak),
    nextTier = STREAK_TIERS.find((s) => s.at > sim.streak),
    risk = sim.streak >= 3 ? sim.streakRisk() : null,
    noted = streakNote && performance.now() < streakNote.until;
  audio.heat = STREAK_TIERS.indexOf(tier);
  putFlag($("combo"), "hidden", mode === "menu" || (!noted && (!!sim.cleanup || sim.streak < 2)));
  $("combo").classList.toggle("broken", !!noted);
  $("combo").classList.toggle("hot", !noted && tier.mult >= 2);
  $("combo").classList.toggle("at-risk", !noted && !!risk);
  put($("combo-icon"), noted ? "💔" : tier.mult >= 2.5 ? "⚡" : tier.mult >= 2 ? "🔥" : "✦");
  if (noted) {
    put($("combo-text"), streakNote.text);
    put($("combo-sub"), streakNote.sub);
  } else if (sim.streak >= 2) {
    put(
      $("combo-text"),
      sim.streak + " IN A ROW" + (tier.mult > 1 ? " · " + tier.name + " ×" + tier.mult : ""),
    );
    put(
      $("combo-sub"),
      risk
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
          : "Unstoppable. Keep it going!",
    );
  }
  renderStickers(mode === "menu" ? NO_CARDS : incidentCards(sim));
  audio.panic = mode !== "menu" && sim.chaosPanic();
  audio.urgency = Math.min(1, (chaos + count) / 10);
  if (mode !== "menu") updateQueue();
}
// ---- the incidents' stickers (13 November 2026, incident-cards.mjs) -------------------------------------------------------
// The creator: "The only thing I need to know on the HUD is that Karen is there… minimize the card into an icon… like a sticker,
// so maybe I can see there are two or three remaining incidents that need my attention. Maybe, if I hover over the sticker,
// then we display the original card with a little bit more text, but it has to be very, very minimal."
// A row of stickers at the top of the column of messages, one for each incident pending, an exclamation mark at its corner
// (red and pulsing when it presses: a rescue, a fuse nearly burnt); a fuse under it when the incident is timed. Over a sticker
// (the mouse, the keyboard's focus, a tap) its card: a name and one line. Nothing else is written about an incident.
const NO_CARDS = [];
const stickers = new Map(); // id → {el, card, leaving}
let stickerOver = null, // the sticker whose card is shown
  stickerPinned = false; // (by a tap: until the next tap)
function renderStickers(cards) {
  const row = $("stickers");
  if (!cards.length && !stickers.size) return;
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    let s = stickers.get(c.id);
    if (!s || s.sticker !== c.sticker) {
      // (new, or the same incident with another face: Carl's clean-up after the leopard man's)
      s?.el.remove();
      const el = document.createElement("button");
      el.type = "button";
      el.className = "sticker";
      el.dataset.id = c.id;
      // (a little askew, each its own way, like stickers put on by hand)
      el.style.setProperty("--tilt", (((c.id.charCodeAt(0) * 7 + c.id.length * 13) % 9) - 4) * 1.2 + "deg");
      el.append(
        stickerImage(c.sticker),
        Object.assign(document.createElement("i"), { className: "sticker-bang", textContent: "!" }),
        Object.assign(document.createElement("i"), { className: "sticker-fuse", innerHTML: "<b></b>" }),
      );
      el.lastChild.setAttribute("aria-hidden", "true");
      row.appendChild(el);
      s = { el, sticker: c.sticker };
      stickers.set(c.id, s);
    }
    if (s.leaving) {
      clearTimeout(s.leaving);
      s.leaving = 0;
      s.el.classList.remove("leaving");
    }
    s.card = c;
    s.seen = true;
    const label = c.title + ". " + c.line;
    if (s.label !== label) {
      s.label = label;
      s.el.setAttribute("aria-label", label);
    }
    s.el.classList.toggle("urgent", !!c.urgent);
    s.el.classList.toggle("timed", c.timer !== null);
    if (c.timer !== null) putStyle(part(s.el, ".sticker-fuse b"), "width", Math.round(c.timer * 100) + "%");
    // (kept in the cards' order: the most pressing first)
    if (row.children[i] !== s.el) row.insertBefore(s.el, row.children[i] || null);
  }
  for (const [id, s] of stickers) {
    if (s.seen) {
      s.seen = false;
      continue;
    }
    if (s.leaving) continue;
    // (dealt with: it peels off)
    s.el.classList.add("leaving");
    s.leaving = setTimeout(() => {
      s.el.remove();
      stickers.delete(id);
      if (stickerOver === id) showStickerCard(null);
    }, 320);
  }
  if (stickerOver) showStickerCard(stickerOver);
}
function showStickerCard(id, pinned = stickerPinned) {
  const s = id && stickers.get(id),
    box = $("sticker-card");
  stickerOver = s && !s.leaving ? id : null;
  stickerPinned = !!stickerOver && pinned;
  putFlag(box, "hidden", !stickerOver);
  for (const [key, other] of stickers) other.el.classList.toggle("open", key === stickerOver);
  if (!stickerOver) return;
  put(box.firstElementChild, s.card.title);
  put(box.lastElementChild, s.card.line);
  box.classList.toggle("urgent", !!s.card.urgent);
}
function bindStickers() {
  const row = $("stickers"),
    of = (e) => e.target.closest?.(".sticker")?.dataset.id || null;
  row.addEventListener(
    "pointerover",
    (e) => e.pointerType === "mouse" && of(e) && showStickerCard(of(e), false),
  );
  row.addEventListener(
    "pointerout",
    (e) => e.pointerType === "mouse" && !stickerPinned && showStickerCard(null),
  );
  row.addEventListener("focusin", (e) => of(e) && showStickerCard(of(e), false));
  row.addEventListener("focusout", () => !stickerPinned && showStickerCard(null));
  // (a tap, or a click: its card stays until the next one)
  row.addEventListener("click", (e) => {
    const id = of(e);
    if (!id) return;
    showStickerCard(stickerPinned && stickerOver === id ? null : id, true);
    e.target.closest(".sticker").blur();
  });
  document.addEventListener("pointerdown", (e) => {
    if (stickerPinned && !e.target.closest?.(".sticker")) showStickerCard(null, false);
  });
}
function updateContext() {
  const floater = $("scoop-target"),
    q = sim.cleanup,
    active = mode === "playing",
    near = active ? sim.nearestInteraction() : null,
    scooping = active && q?.stage === "floating" && sim.coach.carry === "skimmer";
  putFlag(floater, "hidden", !scooping);
  if (scooping) {
    const xy = world.project(q.x, 0.85, q.z),
      ready = near?.kind === "scoop";
    putStyle(floater, "left", xy.x + "px");
    putStyle(floater, "top", Math.max(scoreboardBottom() + 42, xy.y) + "px");
    put(floater, ready ? "E · SCOOP" : "GET CLOSER");
    floater.classList.toggle("in-reach", ready);
  }
  const firstPerson = world.viewMode === "coach";
  putFlag($("coach-prompt"), "hidden", !active);
  putFlag($("touch-controls"), "hidden", !active);
  putFlag($("crosshair"), "hidden", !active || !firstPerson);
  if (!active) return;
  const c = sim.coach,
    prompt = $("coach-prompt"),
    view = windowSize();
  if (firstPerson) {
    // Coach Cam: the prompt sits just above the hands; the crosshair names what a click would act on.
    putStyle(prompt, "left", view.w / 2 + "px");
    putStyle(prompt, "top", Math.round(view.h * 0.66) + "px");
    putFlag(prompt, "hidden", !near && !c.busy && !c.swimming && !c.waterTransition && !c.slipTime);
    const target = world.centerTarget(),
      crosshair = $("crosshair");
    crosshair.classList.toggle("on-target", !!target);
    put(
      part(crosshair, "span"),
      target
        ? targetLabel(target)
        : document.pointerLockElement
          ? ""
          : finePointer.matches
            ? "Click the pool to look around"
            : "Drag to look around",
    );
  } else {
    const p = world.project(c.x, (c.y || 0) + 2.2, c.z);
    putStyle(prompt, "left", Math.max(90, Math.min(view.w - 90, p.x)) + "px");
    putStyle(prompt, "top", Math.max(110, Math.min(view.h - 108, p.y)) + "px");
  }
  prompt.classList.toggle("slipped", c.slipTime > 0);
  prompt.classList.toggle("can-interact", !!near);
  put(
    part(prompt, "span"),
    near
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
                  : "COACH",
  );
  putFlag(part(prompt, "kbd"), "hidden", !near);
  // (Over the coach from above only when it says something: E and what it does, a job, a swim, a slip. Never just COACH, nor what
  // the hand panel already says: 5 November 2026, "too much UI".)
  if (!firstPerson)
    putFlag(
      prompt,
      "hidden",
      !near && !c.busy && !c.swimming && !c.waterTransition && !c.slipTime && !(c.y > 0.08),
    );
}
function clearBubbles() {
  for (const b of bubbles.values()) b.remove();
  bubbles.clear();
}
// Writing to the page only what changed (13 November 2026). The HUD's update runs eight times a second, the coach's prompt and
// the alert every frame, and a write that changes nothing still costs: a text made new is a new text node (its box laid out and
// painted again), a list written as HTML is parsed and built again, a `hidden` set again has its style worked out again. Every
// write of theirs goes through one of these.
const put = (el, text) => {
  const s = text == null ? "" : typeof text === "string" ? text : String(text);
  if (el.textContent !== s) el.textContent = s;
};
// (a list written as HTML: what was last written is kept beside it, so the page is not asked to spell its own out)
const putHTML = (el, html) => {
  if (el._html === html) return;
  el._html = html;
  el.innerHTML = html;
};
// (hidden, disabled)
const putFlag = (el, prop, on) => {
  on = !!on;
  if (el[prop] !== on) el[prop] = on;
};
// (a style: what was last written is kept beside it, since the page gives a colour or a long number back in other words; so an
// element styled through here is styled nowhere else)
const putStyle = (el, prop, value) => {
  const seen = (el._style ||= {});
  if (seen[prop] === value) return;
  seen[prop] = value;
  if (prop.startsWith("--")) el.style.setProperty(prop, value);
  else el.style[prop] = value;
};
// (a part of a button or a panel, looked up once: the lane buttons are built anew with each venue, renderLaneControls)
const part = (el, selector) => {
  const parts = (el._parts ||= {});
  return (parts[selector] ||= el.querySelector(selector));
};
// (a lane button by its key: looked for among the lane buttons, not in the whole page)
const laneButton = (key) => $("lane-controls").querySelector('[data-lane="' + key + '"]');
// A tag over a guest or a visitor is updated every frame, so nothing about it is read from the page (13 November 2026): its
// parts are found once when it is made, and what was last written to each is kept beside it (`seen`), so a write happens only
// when something changed. Until then every frame looked its parts up again (a dozen searches a tag), read its whole text to
// know whether to measure it, and measured every hidden tag every frame (a hidden tag is 0 wide, which read as "not measured
// yet"); each measure, coming after the tag before it had moved, made the browser lay the page out again. A hidden tag now gets
// nothing but its `hidden`, and the tags that changed are measured together, after every write and before any is moved.
function tagParts(b) {
  return (b._p ||= {
    marker: b.querySelector(".rescue-marker"),
    ring: b.querySelector(".ring"),
    ringText: b.querySelector(".ring b"),
    icon: b.querySelector(".type-icon"),
    label: b.querySelector(".type-label"),
    mood: b.querySelector(".mood-icon"),
    hp: b.querySelector(".hp"),
    hpFill: b.querySelector(".hp i"),
    stomach: b.querySelector(".stomach-meter"),
    stomachFill: b.querySelector(".stomach-meter i"),
    stomachText: b.querySelector(".stomach-meter b"),
    name: b.querySelector(".label-name"),
    seen: {},
    resize: true, // its text changed (or it was hidden): measure it before it is placed
  });
}
// (text: a change of it changes the tag's size)
function tagText(parts, key, el, text) {
  if (parts.seen[key] === text) return;
  parts.seen[key] = text;
  el.textContent = text;
  parts.resize = true;
}
function tagProp(parts, key, el, prop, value) {
  if (parts.seen[key] === value) return;
  parts.seen[key] = value;
  el[prop] = value;
}
function tagClass(parts, key, el, name, on) {
  if (parts.seen[key] === on) return;
  parts.seen[key] = on;
  el.classList.toggle(name, on);
}
function tagStyle(parts, key, el, prop, value) {
  if (parts.seen[key] === value) return;
  parts.seen[key] = value;
  el.style[prop] = value;
}
// Hidden or shown; a tag that comes back is measured again (it measured 0 while it was hidden).
function tagHidden(b, parts, hidden) {
  if (parts.seen.hidden === hidden) return;
  parts.seen.hidden = hidden;
  b.hidden = hidden;
  if (!hidden) parts.resize = true;
}
// The tags to place this frame (shown ones only), with where their guest is on screen.
const tagQueue = [];
function queueTag(b, screen) {
  b._sx = screen.x;
  b._sy = screen.y;
  tagQueue.push(b);
}
// Each over its person, kept on screen and below the top margin, in whole pixels: measured first (one layout for all that
// changed), then moved.
function placeTags(tagTop) {
  for (let i = 0; i < tagQueue.length; i++) {
    const b = tagQueue[i],
      parts = b._p;
    if (parts.resize || !b._w) {
      parts.resize = false;
      b._w = b.offsetWidth;
      b._h = b.offsetHeight;
    }
  }
  const width = windowSize().w;
  for (let i = 0; i < tagQueue.length; i++) {
    const b = tagQueue[i],
      left = Math.round(Math.max(b._w / 2 + 8, Math.min(width - b._w / 2 - 8, b._sx))),
      top = Math.round(Math.max(tagTop + b._h, b._sy));
    if (b._left !== left) {
      b._left = left;
      b.style.left = left + "px";
    }
    if (b._top !== top) {
      b._top = top;
      b.style.top = top + "px";
    }
  }
  tagQueue.length = 0;
}
const TAG_OUT = new Set(["exit", "enter", "evacuating", "panic", "recovering"]),
  TAG_PICKABLE = new Set(["queue", "swim", "injured"]),
  tagIds = new Set();
// The scoreboard's foot (the tags stay under it), read at most twice a second: reading it after the tags had moved made the
// browser lay the page out again in the middle of the frame (3 November 2026).
function scoreboardBottom() {
  // (nothing over the top of the pool since 5 November 2026: the tags keep only a small margin under the window's top)
  return HUD_TOP;
}
// The Splash Coins' change since the last frame, as a small +N (green) or −N (red) rising from the plaque, and the plaque tinted
// for a moment. Changes within a quarter second are summed into one, so a busy frame is one number.
function coinChange() {
  if (coinSimSeen !== sim || mode === "menu") {
    coinSimSeen = sim;
    coinSeen = sim.score;
    coinGather = 0;
    return;
  }
  const now = performance.now(),
    diff = Math.round(sim.score - coinSeen);
  coinSeen = sim.score;
  if (diff) {
    coinGather += diff;
    coinGatherAt ||= now;
  }
  if (!coinGather || now - coinGatherAt < 250) return;
  const pop = document.createElement("span"),
    up = coinGather > 0;
  pop.className = "coin-pop " + (up ? "good" : "bad");
  pop.textContent = (up ? "+" : "−") + Math.abs(coinGather).toLocaleString("en-US");
  const pops = $("coin-pops");
  while (pops.childElementCount >= 3) pops.firstElementChild.remove();
  pops.append(pop);
  setTimeout(() => pop.remove(), 1200);
  const plaque = $("hud-coins");
  plaque.classList.remove("gain", "loss");
  requestAnimationFrame(() => plaque.classList.add(up ? "gain" : "loss"));
  coinGather = 0;
  coinGatherAt = 0;
}
function updateBubbles() {
  // `notags` (the played hunt): no tag, bubble or label is drawn over the pool at all.
  if (tuning.has("notags")) {
    if (bubbles.size) clearBubbles();
    $("world-labels").hidden = true;
    return;
  }
  const ids = tagIds,
    tagTop = scoreboardBottom() + 12,
    // (the pools where where a guest goes is no choice of who they are: every guest to the same thing)
    tagFree = !!(sim.venue.class || sim.venue.waves || sim.venue.kids || sim.venue.onsen || sim.venue.river),
    guidedId = guidanceState(sim).swimmerId,
    victims = sim.rescue?.victims,
    coachView = world.viewMode === "coach",
    playing = mode === "playing";
  ids.clear();
  tagQueue.length = 0;
  for (const p of sim.people) {
    if (
      p.status === "gone" ||
      p.away || // (round the Lazy River's loop, out of sight)
      (TAG_OUT.has(p.status) && !(p.annoyedTime > 0))
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
        '<span class="rescue-marker" hidden>🛟</span><div class="ring" hidden><b></b><span class="team"></span></div><div class="face"><span class="type-icon"></span><span class="type-label"></span><span class="mood-icon"></span></div><div class="hp"><i></i></div><span class="stomach-meter" hidden><i></i><b></b></span><span class="label-name"></span>';
      $("world-labels").appendChild(b);
      bubbles.set(p.id, b);
    }
    const parts = tagParts(b),
      selected = p.id === sim.selected,
      guided = p.id === guidedId,
      rescuing =
        !!victims &&
        victims.includes(p.id) &&
        !p.rescueRecover &&
        (p.status === "swim" || p.status === "switch"),
      own = sim.personTag?.(p) || null,
      jumpWait = p.status === "trampoline" && p.jumpStage === "waiting",
      asking = !!p.ask && p.status === "swim" && !p.problem && !p.stomachWarning;
    // A tag only where it helps (5 November 2026, the creator: "for levels like the Aqua Disco… we have no lanes, so remove the
    // tags that are on top because all of them are going to the same activity. Same for the Lazy River and the Wave Pool"). Where
    // the coach chooses where a guest goes by who they are (the lanes, the boards, the trampoline, the rooftop's seats) a waiting
    // guest keeps their tag; elsewhere a guest has one only while they need the coach: a problem, a meter running, a wheel, a
    // rescue, a sore mood, or selected. (At the Lazy River a waiting guest keeps the icon alone, ⚡ or 🌴, for the way round.)
    const needsCoach =
        // (every guest at the Lazy River wants a tube: no reason for a tag of its own)
        (!!p.problem && !(sim.venue.river && p.problem === "fins")) ||
        !!p.stomachWarning ||
        asking ||
        jumpWait ||
        rescuing ||
        own?.ring !== undefined ||
        own?.patience !== undefined ||
        p.status === "injured" ||
        p.annoyedTime > 0 ||
        p.h < 45 ||
        selected ||
        guided,
      wanted = needsCoach || !tagFree || (sim.venue.river && p.status === "queue"),
      // (where they are on screen: worked out only for a tag that is wanted)
      screen = wanted
        ? world.project(
            p.x,
            p.status === "swim"
              ? p.type === "aqua"
                ? 1.15
                : 0.8
              : p.status === "injured"
                ? 1.15
                : p.status === "massage" && p.massage !== "walk"
                  ? 1.55
                  : 2 + (p.y || 0),
            p.z,
          )
        : null,
      hidden =
        !wanted || !screen.visible || (coachView && Math.hypot(p.x - sim.coach.x, p.z - sim.coach.z) > 16);
    tagHidden(b, parts, hidden);
    // (a hidden tag is not there for the player nor the keyboard: it is written again in full when it comes back)
    if (hidden) continue;
    const look = roofLook(p);
    tagProp(parts, "disabled", b, "disabled", !playing || !TAG_PICKABLE.has(p.status));
    if (parts.seen.ariaName !== p.name || parts.seen.ariaLabel !== look.label) {
      parts.seen.ariaName = p.name;
      parts.seen.ariaLabel = look.label;
      b.setAttribute("aria-label", "Select " + p.name + ", " + look.label);
    }
    if (parts.seen.pressed !== selected) {
      parts.seen.pressed = selected;
      b.setAttribute("aria-pressed", String(selected));
    }
    tagClass(parts, "cRescue", b, "rescue-victim", rescuing);
    tagProp(parts, "marker", parts.marker, "hidden", !rescuing);
    tagClass(parts, "cStomach", b, "stomach-warning", !!p.stomachWarning);
    tagClass(parts, "cInjured", b, "injured", p.status === "injured");
    // An incident's wheel on the guest's own tag (the massage table: the hold-E wheel with the coaches' faces on it, as on
    // Karen's, incidents/massage.mjs) and its patience as the countdown bar.
    const ring = parts.ring;
    tagProp(parts, "ring", ring, "hidden", own?.ring === undefined);
    if (own?.ring !== undefined) {
      const fill = Math.round(own.ring * 360),
        holding = own.ring > 0.02 || !!own.team?.length;
      if (parts.seen.fill !== fill) {
        parts.seen.fill = fill;
        ring.style.setProperty("--fill", fill + "deg");
      }
      tagClass(parts, "cHolding", ring, "holding", holding);
      tagText(parts, "ringText", parts.ringText, holding ? "✋" : "E");
      teamWheel(ring, own.team || []);
    }
    tagClass(parts, "cEdgy", b, "massage-edgy", !!own?.edgy);
    // One countdown bar: stomach trouble, a daredevil losing patience on the tower, or a guest on the massage table.
    const waiting = own?.patience !== undefined,
      stomach = parts.stomach,
      meter = !!p.stomachWarning || jumpWait || asking || waiting;
    tagProp(parts, "stomach", stomach, "hidden", !meter);
    tagClass(parts, "cJump", stomach, "jump-meter", jumpWait || waiting);
    tagClass(parts, "cTip", stomach, "tip-meter", asking);
    tagClass(parts, "cAsking", b, "asking", asking);
    if (meter) {
      const left = waiting
          ? own.left
          : jumpWait
            ? p.jumpPatience
            : asking
              ? TIPS.limit - p.ask.t
              : p.sicknessTimer,
        total = waiting
          ? own.left / Math.max(0.001, own.patience)
          : jumpWait
            ? sim.config.jumpPatience || 15
            : asking
              ? TIPS.limit
              : p.sicknessDuration;
      tagStyle(
        parts,
        "stomachW",
        parts.stomachFill,
        "width",
        Math.round(Math.max(0, (left / total) * 100)) + "%",
      );
      tagText(parts, "stomachText", parts.stomachText, Math.ceil(left) + "s");
    }
    tagClass(parts, "cSelected", b, "selected", selected);
    tagClass(parts, "cGuided", b, "guided", guided);
    // A calmer pool (Phase 1): a swimmer happily swimming, with nothing wrong, keeps a small faded tag (the icon only), so the
    // tags that stand out are the ones that need the coach. Still clickable, to move them to another lane.
    const quiet =
      (sim.venue.river && p.status === "queue" && !needsCoach) ||
      (p.status === "swim" &&
        !p.problem &&
        !p.stomachWarning &&
        !p.ask &&
        !rescuing &&
        !selected &&
        p.h >= 55 &&
        !p.vip &&
        !p.star);
    if (parts.seen.cQuiet !== quiet) {
      parts.seen.cQuiet = quiet;
      b.classList.toggle("quiet", quiet);
      parts.resize = true; // (the quiet tag is the icon alone)
    }
    tagText(parts, "icon", parts.icon, look.icon);
    tagText(parts, "label", parts.label, look.label);
    const statusIcon = problemIcon(p);
    tagText(parts, "mood", parts.mood, statusIcon !== look.icon && statusIcon !== "🙂" ? statusIcon : "");
    tagStyle(parts, "hpW", parts.hpFill, "width", Math.round(Math.max(0, p.h)) + "%");
    tagStyle(parts, "hpColor", parts.hpFill, "background", moodColor(p.h));
    tagText(parts, "name", parts.name, p.name);
    if (parts.seen.nameHidden !== !selected) {
      parts.seen.nameHidden = !selected;
      parts.name.hidden = !selected;
      parts.resize = true;
    }
    queueTag(b, screen);
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
        '<div class="ring" hidden><b></b><span class="team"></span></div><div class="face"><span class="type-icon"></span><span class="type-label"></span></div><div class="hp"><i></i></div>';
      $("world-labels").appendChild(b);
      bubbles.set(v.id, b);
    }
    const parts = tagParts(b),
      screen = world.project(v.x, v.kind === "dog" ? 1.4 : v.kind === "kid" ? 1.5 : 2.3, v.z),
      hidden = !screen.visible || mode === "menu";
    tagHidden(b, parts, hidden);
    if (hidden) continue;
    tagClass(parts, "cUrgent", b, "urgent", !!tag.urgent);
    tagText(parts, "icon", parts.icon, tag.icon);
    tagText(parts, "label", parts.label, tag.label || "");
    // The hold-E wheel (calming Karen), Overcooked style: it fills clockwise, with no numbers (E to start, a hand while it
    // fills). In a crew, each coach holding E on it has their face on the wheel in their colour, and once two are on it the
    // fill runs through their colours and a second ring goes round it, with a pop as each one joins (teamwork.mjs).
    const ring = parts.ring;
    tagProp(parts, "ring", ring, "hidden", tag.ring === undefined);
    if (tag.ring !== undefined) {
      const fill = Math.round(tag.ring * 360),
        holding = tag.ring > 0.02 || !!tag.team?.length;
      if (parts.seen.fill !== fill) {
        parts.seen.fill = fill;
        ring.style.setProperty("--fill", fill + "deg");
      }
      tagClass(parts, "cHolding", ring, "holding", holding);
      tagText(parts, "ringText", parts.ringText, holding ? "✋" : "E");
      teamWheel(ring, tag.team || []);
    }
    tagProp(parts, "meter", parts.hp, "hidden", tag.meter === undefined);
    if (tag.meter !== undefined) {
      tagStyle(parts, "hpW", parts.hpFill, "width", Math.round(tag.meter * 100) + "%");
      tagStyle(
        parts,
        "hpColor",
        parts.hpFill,
        "background",
        tag.meter > 0.7 ? "#eb7754" : tag.meter > 0.4 ? "#e6b445" : "#73b65b",
      );
    }
    queueTag(b, screen);
  }
  placeTags(tagTop);
  if (bubbles.size !== ids.size)
    for (const [id, b] of bubbles)
      if (!ids.has(id)) {
        b.remove();
        bubbles.delete(id);
      }
  for (let i = 0; i < stationLabels.length; i++) {
    const data = world.labels[i],
      el = stationLabels[i],
      // (A station's name on the floor only near the coach, 6 m: the deck is not a map of labels. 5 November 2026, "too much UI".)
      far =
        mode === "menu" ||
        Math.hypot(data.x - sim.coach.x, data.z - sim.coach.z) > STATION_LABEL_NEAR ||
        sim.level < (data.minLevel || 1) ||
        (data.when ? !data.when(sim) : false),
      screen = far ? null : world.project(data.x, data.y, data.z),
      hidden = far || !screen.visible;
    if (el._hidden !== hidden) {
      el._hidden = hidden;
      el.hidden = hidden;
    }
    if (hidden) continue;
    if (el._x !== screen.x) {
      el._x = screen.x;
      el.style.left = screen.x + "px";
    }
    if (el._y !== screen.y) {
      el._y = screen.y;
      el.style.top = screen.y + "px";
    }
  }
}
// The faces on a hold-E wheel: one per coach on the job, in their colour, the order they joined. A second coach on it turns
// the wheel into a team wheel (a second ring, the fill through their colours) and every new pair of hands pops it.
function teamWheel(ring, team) {
  // (asked every frame a wheel is on screen: nothing to do, and nothing made, while nobody is on it)
  if (!team.length && ring._team === "") return;
  const key = team.join(" ");
  if (ring._team === key) return;
  const before = ring._team ? ring._team.split(" ").length : 0;
  ring._team = key;
  const faces = ring.querySelector(".team");
  faces.replaceChildren(
    ...team.map((look) => {
      const face = document.createElement("i"),
        c = coachInfo(look);
      face.style.setProperty("--c", c.colour);
      face.style.backgroundImage = `url(./assets/coach-${c.id}.webp)`;
      face.title = c.name;
      return face;
    }),
  );
  const colours = team.map((look) => coachInfo(look).colour);
  ring.style.setProperty("--c1", colours[0] || "#ffd24d");
  ring.style.setProperty("--c2", colours[1] || colours[0] || "#ffd24d");
  ring.style.setProperty("--c3", colours[2] || colours[1] || colours[0] || "#ffd24d");
  ring.classList.toggle("team-2", team.length >= 2);
  ring.classList.toggle("team-3", team.length >= 3);
  if (team.length > before && team.length > 1) {
    ring.classList.remove("team-pop");
    void ring.offsetWidth; // (restart the animation)
    ring.classList.add("team-pop");
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
// ---- the sound of the shift (sound-mix.mjs, 4 November 2026) ------------------------------------------------------------------
// Where a place on the deck is for the ear (across the screen, and how far from the player's own coach), which coach an event
// is about, and each coach's footsteps and voice (the scene calls `onCoach` for each, every frame).
function hearWorld() {
  audio.listen = (x, z) => {
    if (!sim?.coach || mode === "menu") return null;
    const at = world.project(x, 0, z),
      { w } = world.viewSize(),
      me = sim.coaches?.[sim.actor ?? 0] || sim.coach;
    return { sx: (at.x / (w || 1)) * 2 - 1, distance: Math.hypot(x - me.x, z - me.z) };
  };
  audio.who = (e) => {
    const crew = sim?.coaches;
    if (!crew?.length) return null;
    let i = e.by ?? null;
    if (i == null && crew.length > 1 && e.x != null) {
      let best = Infinity;
      crew.forEach((c, k) => {
        const d = Math.hypot(c.x - e.x, c.z - e.z);
        if (d < best) [best, i] = [d, k];
      });
    }
    i ??= sim.actor ?? 0;
    const c = crew[i];
    return c && { index: i, look: c.look || "waters", local: i === (sim.actor ?? 0), x: c.x, z: c.z };
  };
  world.onCoach = (i, c, o) => audio.coachFrame(i, c, o);
}
// Once a frame: the mix's snapshot for what is on screen, the venue's ambience, the swimmers in the water, a swimmer stranded
// with a cramp (where they are), and a changing room's door swinging shut once its last guest is through (sim.doors).
const doorWas = {};
function soundFrame() {
  const live = mode === "playing" || mode === "countdown" || mode === "replay",
    venue = mode !== "menu" && sim?.venue ? sim.venue : null;
  let swimmers = 0,
    distress = null;
  if (live && venue) {
    for (const p of sim.people) if (p.status === "swim") swimmers++;
    const v = sim.rescue && sim.strandedVictims?.()[0];
    if (v) distress = { x: v.x, z: v.z };
    for (const side of [-1, 1]) {
      const r = sim.doors?.[side] || 0;
      if (doorWas[side] >= 0.12 && r < 0.12 && venue.arrival?.at)
        audio.effect("door-close", venue.arrival.at(side, "door"));
      doorWas[side] = r;
    }
  }
  audio.frame({ snapshot: snapshotFor(mode), venue: venue?.id ?? null, swimmers, distress });
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
  $("hud-rail").prepend(el); // (at the top of the column of messages, never over the pool)
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
  influencer: "{name} tripped over an influencer",
  massage: "{name} gave up on a massage",
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
      world.coachMoment?.(e.type); // (his face and his jolt: scene.mjs)
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
        // (co-op: a toast an input made is that player's: "walk to the mop" is for whoever pressed E)
        const theirs = e.by != null && e.by !== (sim.actor ?? 0);
        if (!(stung && e.warning) && !theirs) toast(e.text, e.warning);
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
      else if (e.type === "karen-calmed" || e.type === "massage-done" || e.type === "influencer-done")
        world.sparkle(e.x, e.z);
      else if (e.type === "influencer-trip") world.kick(0.12);
      else if (e.type === "massage-angry") world.kick(0.2);
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
      } else if (e.type === "dive-splash") {
        // (The Jumping Pool: a clean entry a neat plume, a flop or a cannonball a huge one, and the camera feels the big ones.)
        if (e.flat || e.ball || e.size > 0.9) world.bigSplash(e.x, e.z, e.size);
        else world.splash(e.x, -0.2, e.z, Math.round(10 + e.size * 14));
        world.incidentView.ripple(e.x, e.z);
        if (e.flat || e.ball) world.kick(e.h >= 2 ? 0.75 : e.h >= 1 ? 0.45 : 0.22);
      } else if (e.type === "dive-fail") {
        world.kick(0.9);
        queueKey = "";
      } else if (e.type === "dive-check") {
        world.sparkle(e.x, e.z);
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
            : e.influencer
              ? "Oof! The coach walked into the influencer. Walk up slowly and hold E to move them on."
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
      // The fun plan's moments (sim.mjs): the last call, making it up after a broken streak, a golden guest sent home happy.
      else if (e.type === "last-call") {
        $("clock").classList.add("last-call");
        toast("🔔 Last call! Everything scores ×" + e.scale);
        audio.effect("streak-tier", { mult: 2 });
      } else if (e.type === "make-up") {
        if (streakNote)
          streakNote = {
            ...streakNote,
            text: streakNote.text + " · MAKE IT UP ×2",
            until: performance.now() + 3400,
          };
      } else if (e.type === "made-up") {
        points({
          x: e.x ?? sim.coach.x,
          z: e.z ?? sim.coach.z,
          text: "🔥 Made up! Streak " + e.streak,
          tone: "good",
        });
        audio.effect("streak-tier", { mult: 1.5 });
      } else if (e.type === "golden") {
        points({ x: e.x, z: e.z, text: "✨ Golden goodbye!", tone: "good" });
        world.confetti();
      }
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
// The loader comes off only once those frames are drawn under it and the menu's 3D stage has drawn its first: the pool behind
// the warm-up must never show (the creator, 2 November 2026: "we don't ever show the old one"). 8 s at most.
let revealing = false,
  bootFrames = 0,
  menuDrawn = false;
function revealGame() {
  revealing = false;
  $("loading").hidden = true;
}
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
// The frame-rate cap: the device's (gfx.mjs, a touch WebKit) or Settings' "Limit to 60 fps" (on by default, 3 November 2026).
let frameCap = 60;
function animate(t) {
  const cap = gfx.plan.fpsCap || frameCap;
  if (cap && lastDrawn && t - lastDrawn < 1000 / cap - 3) {
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
// The yellow pulse round what asks for the coach (guidance.mjs `cuePulse`, style.css `var(--cue)`: a guided or sick or injured
// guest's tag, an urgent visitor's, the lane a picked guest may go to). It is written on the two parts of the page that can hold
// something pulsing, and only while something in them does. Until 13 November 2026 it was written on the page's root every frame,
// and since every element inherits a custom property the browser worked out the style of the whole page again, every frame
// (2,600 elements: about 5 ms a frame where it was measured, the largest single cost of a frame). The root keeps a still 0.5.
const CUE_HOSTS = [
  ["world-labels", ".guided, .stomach-warning, .urgent, .injured"],
  ["lane-controls", ".assignable"],
];
let cueHosts = null;
function cueFrame(t) {
  const value = cuePulse(t / 1000, reducedMotion.matches).toFixed(2);
  cueHosts ||= CUE_HOSTS.map(([id, pulsing]) => ({ el: $(id), pulsing, value: "" })).filter((h) => h.el);
  for (const host of cueHosts) {
    const next = host.el.querySelector(host.pulsing) ? value : "";
    if (next === host.value) continue;
    host.value = next;
    if (next) host.el.style.setProperty("--cue", next);
    else host.el.style.removeProperty("--cue");
  }
}
let logClock = 0,
  perfClock = 0;
function frame(t) {
  const began = performance.now(),
    gap = previous ? t - previous : 0;
  for (const name in stageMs) stageMs[name] = 0;
  if (revealing && ++bootFrames > 4 && (mode !== "menu" || !menuStage?.ready || menuDrawn)) revealGame();
  const covered = mode === "menu" && warmFrames-- <= 0;
  if (!covered) cueFrame(t);
  if (previous) crashlog.frame(t - previous);
  const dt = Math.min((t - previous) / 1000 || 0.016, 0.06),
    // Incident stings slow the game down and saves freeze it for a beat; menus always run at full speed.
    speed = mode === "playing" && !coop ? moments.timeScale(seconds()) : 1;
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
        // (co-op: the look is shared like an input; it never changes the shift on this machine alone)
        if (coop) coop.session.look(world.coachCam.yaw);
        else {
          sim.coach.lookAngle = world.coachCam.yaw;
          recorder?.look(sim.coach.lookAngle);
        }
      }
      const movement = replayRun ? null : moveVector();
      if (movement) sim.setMovement(movement.x, movement.z);
      if (coop?.session instanceof CoopGuest) {
        // A guest plays the host's ticks as they come (net.mjs), its own coach drawn a little ahead.
        coop.session.advance(dt);
        const n = Math.max(1, Math.hypot(movement?.x || 0, movement?.z || 0));
        world.drawAhead = coop.predictor.update(
          dt,
          { x: (movement?.x || 0) / n, z: (movement?.z || 0) / n },
          sim.coach,
          COACH_TUNING.speed * (sim.perks?.speed ?? 1),
        );
      } else {
        // (the Look tuner's "Freeze the shift": nothing moves on while the look is judged)
        // (and the intro cinematic: the shift waits for it, scene/intro-cinematic.mjs)
        accumulator = lookFreeze || world.cinematic ? 0 : Math.min(0.12, accumulator + dt * speed);
        while (accumulator >= 1 / 60) {
          if (replayRun) feedReplay();
          sim.tick(1 / 60);
          accumulator -= 1 / 60;
        }
      }
    });
    if (!ok) return snag();
    trace();
    stage("sting", () => showSting(moments.next(seconds())));
    stage("events", events);
  } else if (mode === "menu") {
    // The menu's stage, once the venue has warmed up: the Old Town Baths at five to seven (scene/menu-stage.mjs).
    // (Free play's map covers it: nothing is drawn under the map, until START, when the map steps aside for the doors.)
    const underMap = document.body.classList.contains("freeplay") && !doorsOpening;
    if (covered && menuStage?.ready && !tuning.has("norender") && !underMap) {
      // (The view slides right on a wide screen, so the doors stand beside the menu's column, not behind it.)
      const wide = windowSize().w > 900 && windowSize().w / windowSize().h > 1.25;
      menuStage.framing = wide ? 0.13 : 0;
      const drawn = stage("menu", () => {
        menuStage.update(dt);
        menuStage.render(world.renderer);
      });
      if (drawn) menuDrawn = true;
      else if (failing.menu > 30) dropMenuStage();
    }
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
  stage("sound", soundFrame);
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
    // (a walk over the whole scene to count it: between two frames, not in this one)
    whenIdle(sampleLog);
  }
  if (playtest) playtestTick(dt);
  hitchWatch(gap, performance.now() - began);
}
function bind() {
  weekUi = installWeek({
    $,
    dev: devMode,
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
  // FREE PLAY is a window of pools now (21 October 2026, free-ui.mjs), not the cloud map of levels.
  freeUi = installFreePlay({ $, save: () => weekUi.save, onPlay: startFree, dev: devMode });
  $("wk-free").onclick = () => freeUi.open();
  coopUi = installCoop({
    $,
    save: () => weekUi.save,
    dev: devMode,
    onStart: startCoop,
    sounds: { tick: () => audio.effect?.("ui-hover"), go: () => audio.effect?.("ui-click") },
  });
  $("wk-coop").onclick = () => coopUi.open();
  // A guest whose crew's host is gone: back to the menu (the shift cannot go on without its host).
  // (and a friend's invite that started the game: straight into their lobby, once the menu is up)
  pendingInvite().then((id) => id && coopUi.join(id));
  syncUnlocks();
  mapView = new LevelMap($("map"), {
    onLevel: selectLevel,
    onDrill: selectDrill,
    onStart: requestStart,
    onAct: selectAct,
  });
  $("scoop-target").onclick = () => sim.scoop();
  $("coach-cam").checked = settings.coachCam;
  $("coach-cam").onchange = () => setCoachCam($("coach-cam").checked);
  // Settings has the switch too (30 October 2026, the creator: "a settings change to coach view so I can toggle in and out").
  $("set-coachcam").onchange = () => setCoachCam($("set-coachcam").checked);
  world.canLook = () => ["playing", "countdown"].includes(mode);
  $("start").onclick = requestStart;
  $("booking-cards").onclick = (e) => {
    const b = e.target.closest("[data-booking]");
    if (!b) return;
    $("booking-dialog").close();
    start(b.dataset.booking);
  };
  $("booking-back").onclick = () => $("booking-dialog").close();
  bindStickers();
  whenIdle(warmStickers, 4000);
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
  $("pause-btn").onclick = openMenu;
  $("resume").onclick = resume;
  if (isDesktop()) {
    $("quit-game").hidden = false; // (a window needs a way out that is not the keyboard)
    $("quit-game").onclick = quitGame;
  }
  $("restart").onclick = () =>
    coop
      ? ($("pause-dialog").close(), leaveCoop(), returnMenu())
      : freeChoice
        ? startFree(freeChoice.pool, freeChoice.level)
        : start(activeBooking);
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
  $("play-again").onclick = () => {
    if (coop) {
      // (co-op: the crew's lobby again, over the menu; the host starts the next shift from there)
      coop = null;
      world.drawAhead = null;
      returnMenu();
      return coopUi.back();
    }
    freeChoice ? startFree(freeChoice.pool, freeChoice.level) : start(activeBooking);
  };
  $("back-menu").onclick = () => {
    leaveCoop();
    returnMenu();
  };
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
  $("fullscreen").onclick = toggleFullscreen;
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
      if (mode === "menu" && key === "enter" && (!title || title.loading || doorsOpening)) return;
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
        setCoachCam(!settings.coachCam);
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
    // F9: the Look tuner, in dev mode (look-tuner.mjs)
    if (e.key === "F9" && devMode() && lookTuner) {
      e.preventDefault();
      return lookTuner.toggle();
    }
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
    audio.away(document.hidden);
    if (document.hidden) {
      audio.playing = false;
      audio.menuHush(true);
      if (["playing", "countdown"].includes(mode)) pause();
    } else if (mode === "menu") {
      audio.init();
      audio.menuHush(false);
    }
  });
  const unlockMusic = () => {
    audio.init();
    audio.playing = !document.hidden && ["playing", "countdown"].includes(mode);
    // (On the menu its own recorded music plays, from the first click on: title.mjs.)
    if (mode === "menu" && title && !audio.menu && !doorsOpening && !document.hidden)
      audio.startMenu("theme", { fade: 3 });
  };
  // A click or a key while the doors open goes straight to the light.
  document.addEventListener("pointerdown", () => doorsOpening && menuStage?.hurry(), { capture: true });
  // (every event a browser counts as the player's go-ahead for sound: a touch's is its end, not its start)
  for (const type of ["pointerdown", "pointerup", "mousedown", "touchend", "click", "keydown"])
    document.addEventListener(type, unlockMusic, { capture: true });
}
// A browser holds the sound until the first click or key (no page may play it sooner), so while it does the menu's corner says
// so; the desktop app plays at once and never shows it.
function watchSoundHold() {
  const held = () =>
    document.body.classList.toggle("sound-held", !!audio.ctx && audio.ctx.state !== "running");
  audio.ctx?.addEventListener?.("statechange", held);
  held();
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
  // The swimmers load behind the menu (START says LOADING % until they are in), except for a trial or a hunt, which wait for
  // them as before so every test plays the same characters.
  const waitForSwimmers = testing || playHunt || !!huntStep;
  const swimmersLoading = activeSwimmerChoice() === "models" ? loadSwimmerModels() : null;
  // The loose dog behind the menu too (4 November 2026), so a shift's warm-up (scene.mjs warmShaders) finds him in and nothing
  // is loaded or compiled when he turns up mid-shift. (Karen is not loaded for the menu: the first shift's warm-up fetches her,
  // incident-view.mjs warmCast, and draws her once she is in, long before she can come.)
  if (!tuning.has("nomodels")) loadDog();
  if (swimmersLoading && waitForSwimmers) fetching.push(swimmersLoading);
  // The Community Pool as the Harbourside (scene/harbourside.mjs): a few MB, behind the menu like the swimmers; the classic pool
  // stands in until it is in (and for ?nomodels, the crash hunt's switch for every model). START waits for it with the swimmers.
  const harbourLoading = tuning.has("nomodels") ? null : loadHarbourside();
  let harbourSettled = !harbourLoading;
  harbourLoading?.then((model) => {
    harbourSettled = true;
    crashlog.crumb(
      "venue",
      (model ? "the Harbourside loaded in " : "the Harbourside failed after ") +
        Math.round(performance.now() - began) +
        " ms" +
        (model ? "" : ": the classic Community Pool stays"),
    );
    // (built at once when the world is behind the menu; a shift already running keeps its pool, the next one has the new)
    if (model && world && sim && mode === "menu") syncVenue(sim);
    // The other dressed venues load when a shift there is chosen (loadVenue), and the week's next pool behind the menu.
    prefetchNextPool();
  });
  if (fetching.length) {
    await Promise.race([Promise.all(fetching), new Promise((resolve) => setTimeout(resolve, 6000))]);
    const took = Math.round(performance.now() - began) + " ms";
    if (activeChoice() === "panic")
      crashlog.crumb(
        "coach",
        (coachModelReady() ? "Coach Waters loaded in " : "Coach Waters not ready after ") + took,
      );
    if (activeSwimmerChoice() === "models" && waitForSwimmers)
      crashlog.crumb(
        "swimmers",
        (swimmerModelsReady() ? "swimmer models loaded in " : "swimmer models not ready after ") + took,
      );
  }
  if (swimmersLoading && !waitForSwimmers)
    swimmersLoading.then(() =>
      crashlog.crumb(
        "swimmers",
        (swimmerModelsReady() ? "swimmer models loaded in " : "swimmer models failed after ") +
          Math.round(performance.now() - began) +
          " ms (behind the menu)",
      ),
    );
  world = new PoolWorld($("world"), pick);
  hearWorld();
  sim = makeDemo();
  bind();
  // The Look tuner (look-tuner.mjs): F9 or Settings > Developer, in dev mode; with dev mode off the game draws its own look.
  lookTuner = installLookTuner({
    storage: crashStorage,
    venue: () => world?.venue && { id: world.venue.id, name: POOLS[world.venue.id]?.name || world.venue.id },
    restart: () => setTimeout(() => location.reload(), 300),
    freeze: (on) => {
      lookFreeze = on;
      crashlog.crumb("look", on ? "the shift frozen to look" : "the shift goes on");
    },
  });
  world.lookSource = (id) => (devMode() && !testing ? lookTuner.values(id) : LOOK_DEFAULTS);
  if (devMode() && !testing) lookTuner.reopen();
  $("set-look").onclick = () => {
    document.querySelectorAll("dialog[open]").forEach((d) => d.close());
    if (mode === "paused") resume();
    lookTuner.toggle(true);
  };
  // The menu's stage (not for a trial or a hunt): a few hundred kB of pictures, and the coach's model. The loader stays up
  // while it comes (12 s at most); one that comes later still takes its place behind the menu. The old menu's picture is never
  // shown (the creator, 2 November 2026: "we don't ever show the old one"); without a stage the menu has a plain backdrop.
  const useMenuStage = (stage) => {
    menuStage = stage;
    document.body.classList.add("stage");
    if (activeSwimmerChoice() === "models")
      loadMenuGuests(swimmersLoading).catch((e) => crashlog.error("menu-guests", e));
  };
  if (!testing && !playHunt && !huntStep && world.renderer) {
    const loading = (async () => {
      const coach = activeChoice() === "panic" && coachModelReady() ? await loadCoachModel() : null;
      return new MenuStage().load(coach);
    })();
    try {
      useMenuStage(
        await Promise.race([
          loading,
          new Promise((_, fail) =>
            setTimeout(() => fail(new Error("the menu's stage took over 12 s")), 12000),
          ),
        ]),
      );
      crashlog.crumb("menu", "3D stage ready in " + Math.round(performance.now() - began) + " ms");
    } catch (e) {
      crashlog.error("menu-stage", e);
      loading
        .then((stage) => {
          if (menuStage) return stage.dispose();
          useMenuStage(stage);
          crashlog.crumb("menu", "3D stage ready late, in " + Math.round(performance.now() - began) + " ms");
        })
        .catch(() => {});
    }
  }
  title = installTitle({
    $,
    audio,
    settings,
    saveSettings,
    apply: applySettings,
    fullscreen: toggleFullscreen,
    isFullscreen: () => !!document.fullscreenElement,
    quit: isDesktop() ? quitGame : null,
    build: BUILD.commit === "dev" ? "" : "BUILD " + String(BUILD.commit).slice(0, 7).toUpperCase(),
  });
  applySettings();
  // A new player's first line under the menu says what the game is; a tip from then on.
  if (!weekUi?.save?.week && !weekUi?.save?.stars && !weekUi?.save?.known?.length)
    $("ts-tip").textContent = document.querySelector(".wk-pitch").textContent.trim().replace(/\s+/g, " ");
  // START says LOADING % while the swimmers and the Harbourside come in (at most 12 s: after that the classic ones stand in until
  // they do).
  if ((swimmersLoading && !waitForSwimmers) || !harbourSettled) {
    let gaveUp = false;
    setTimeout(() => {
      gaveUp = true;
      title.setLoading(1);
    }, 12000);
    const poll = () => {
      if (gaveUp) return;
      const share = Math.min(
        swimmersLoading && !waitForSwimmers ? swimmerLoadShare() : 1,
        harbourSettled ? 1 : 0.97,
      );
      title.setLoading(share);
      if (share < 1) setTimeout(poll, 150);
    };
    poll();
  }
  audio.init();
  audio.playing = false; // (the menu plays its own music: title.mjs)
  // The menu's music from the start (21 October 2026: no CLICK TO ENTER). The desktop app plays it at once; a browser holds the
  // sound until the first click or key, and the fade-in waits with it. (Not for a trial or a hunt.)
  if (!testing && !playHunt && !huntStep) {
    audio.preloadMenu();
    audio.startMenu("theme", { fade: 3 });
    watchSoundHold();
  }
  updateMenu();
  updateUI();
  syncVenue(sim);
  revealing = true; // (the loader comes off after the first frames: revealGame)
  prefetchNextPool();
  setTimeout(() => revealing && revealGame(), 8000);
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
      get menuStage() {
        return menuStage;
      },
      startFree,
      returnMenu,
      get crashlog() {
        return crashlog;
      },
      // (how long each stage of the last frame took, ms: `stage`)
      stageMs,
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
        setCoachCam(on);
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
