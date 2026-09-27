import { screenMovement } from "./spatial.mjs";
import { normalizeRecords, starsFor, recordResult, isUnlocked, UNLOCK_ALL } from "./progression.mjs";
import { guidanceState, cuePulse } from "./guidance.mjs";
import { PoolSimulation, TYPES, SHIFTS, loopPosition } from "./sim.mjs";
import { PoolWorld } from "./scene.mjs";
import { PoolAudio } from "./audio.mjs";
import { CoachInput } from "./input.mjs";
const $ = (id) => document.getElementById(id),
  audio = new PoolAudio();
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
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
  world.setVenue(s.venue, s.config.lighting);
  if (worldVersion !== world.version) {
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
function start() {
  audio.panic = false;
  clearTimeout(toastTimer);
  $("toast").hidden = true;
  input?.clear();
  accumulator = 0;
  document.activeElement?.blur();
  document.querySelectorAll("dialog[open]").forEach((d) => d.close());
  sim = new PoolSimulation(level);
  syncVenue(sim);
  sim.start({ countdown: true });
  mode = "countdown";
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
}
function returnMenu() {
  audio.panic = false;
  input?.clear();
  accumulator = 0;
  document.querySelectorAll("dialog[open]").forEach((d) => d.close());
  mode = "menu";
  $("countdown").hidden = true;
  audio.playing = true;
  sim = makeDemo();
  $("welcome").hidden = false;
  $("queue-panel").hidden = true;
  $("combo").hidden = true;
  $("closure").hidden = true;
  $("toast").hidden = true;
  document.body.classList.add("menu");
  clearBubbles();
  updateChoices();
  updateUI();
}
function updateChoices() {
  document.querySelectorAll("[data-level]").forEach((b) => {
    const n = Number(b.dataset.level),
      locked = !isUnlocked(records, n),
      stars = starsFor(n, records.bests[n - 1]);
    b.classList.toggle("active", n === level);
    b.classList.toggle("completed", stars > 0);
    b.disabled = locked;
    b.setAttribute("aria-pressed", String(n === level));
    b.setAttribute(
      "aria-label",
      "Level " +
        n +
        " · " +
        SHIFTS[n - 1].name +
        (locked ? " · Locked" : stars ? " · " + stars + " stars" : ""),
    );
    b.querySelector(".level-lock").hidden = !locked;
    b.querySelector(".level-stars").textContent = locked
      ? ""
      : Array.from({ length: 3 }, (_, i) => (i < stars ? "★" : "☆")).join("");
  });
  const shift = SHIFTS[level - 1];
  $("welcome").querySelector(".eyebrow>span:last-child").textContent =
    String(level).padStart(2, "0") + " / " + SHIFTS.length;
  $("welcome").querySelector(".eyebrow .mini-pill").textContent =
    shift.venue === "resort" ? "RIVIERA SPLASH RESORT" : "THE COMMUNITY SWIM CLUB";
  $("welcome").classList.toggle("resort-season", shift.venue === "resort");
  $("selected-shift-name").textContent = shift.name;
  $("selected-shift-meta").textContent =
    shift.duration +
    " SECONDS · " +
    shift.total +
    " SWIMMERS" +
    (shift.venue === "resort" ? " · 5 LANES + TRAMPOLINE" : "");
  document.querySelector(".welcome-foot>span").textContent = UNLOCK_ALL
    ? "ALL LEVELS OPEN FOR TESTING"
    : "★ UNLOCKS THE NEXT SHIFT";
  $("best-score").textContent = records.bests[level - 1]
    ? "BEST · " + records.bests[level - 1].toLocaleString()
    : "MAKE YOUR FIRST SPLASH";
}

function pause() {
  if (!["playing", "countdown"].includes(mode)) return;
  resumeState = sim.status;
  input.clear();
  sim.clearInput();
  accumulator = 0;
  sim.status = "paused";
  mode = "paused";
  audio.playing = false;
  $("pause-dialog").showModal();
}
function resume() {
  if (mode !== "paused") return;
  $("pause-dialog").close();
  sim.status = resumeState;
  mode = resumeState;
  audio.playing = mode === "playing";
}
function showHelp() {
  if ($("help-dialog").open) return;
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
  input.clear();
  sim.clearInput();
  accumulator = 0;
  mode = "results";
  audio.playing = false;
  const r = sim.summary(),
    newBest = recordResult(records, level, r.score);
  saveRecords();
  $("result-eyebrow").textContent =
    "LEVEL " + level + " / " + SHIFTS.length + " · " + sim.config.name.toUpperCase() + " · SHIFT COMPLETE";
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
  const st = sim.stats,
    extra = [
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
                ? "Three stars! Try the next shift, or beat this run with an even longer happy streak."
                : "A new arrival mix awaits. Can you keep the happy streak going just a little longer?";
  $("next-level").hidden = level >= SHIFTS.length || !isUnlocked(records, level + 1);
  $("next-level").textContent = "Next shift · Level " + (level + 1) + " →";
  $("play-again").textContent = "Replay level " + level + " ↻";
  $("play-again").className = $("next-level").hidden ? "primary" : "secondary";
  $("results-dialog").showModal();
  ($("next-level").hidden ? $("play-again") : $("next-level")).focus();
  if (r.stars > 0) world.confetti();
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
                    ? TYPES[p.type].icon
                    : "🙂";
}
function cardStatus(p) {
  if (p.status === "queue")
    return p.type === "daredevil" ? "Daredevil · wants the trampoline" : TYPES[p.type].label;
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
              `<button class="swimmer-card ${p.id === sim.selected ? "selected" : ""} ${p.id === guide.swimmerId ? "guided" : ""}" data-swimmer="${p.id}" aria-label="Select ${p.name}, ${TYPES[p.type].label}${p.problem ? ", needs help" : ""}"><span class="portrait ${p.queasy ? "queasy" : ""}" style="background:${TYPES[p.type].color}">${TYPES[p.type].icon}</span><span class="card-info"><strong>${p.name}</strong><small>${cardStatus(p)}</small><span class="patience-track"><i data-hp="${p.id}"></i></span></span><span class="need-icon" data-need="${p.id}"></span></button>`,
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
    const profile = TYPES[p.type];
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
  $("level-progress").textContent = "LEVEL " + String(level).padStart(2, "0") + " / " + SHIFTS.length;
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
      moveHere = !!moving && moving.lane !== i && !splash;
    b.classList.toggle(
      "assignable",
      mode === "playing" &&
        !sim.closed &&
        !sim.rescue &&
        !splash &&
        ((p?.status === "queue" && p.type !== "daredevil") || sim.coach.carry === "chlorine" || moveHere),
    );
    b.classList.toggle("splash-zone", splash);
    b.classList.toggle("danger", average < 50 || people.some((p) => p.blocked > 3));
    b.querySelector(".lane-mode").textContent = splash
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
    b.querySelector(".lane-count").textContent = splash
      ? count
        ? "Clear this lane!"
        : "Flip incoming"
      : count === 0
        ? "Jump on in"
        : count + " swimmer" + (count === 1 ? "" : "s");
    b.querySelector(".lane-caps").innerHTML = people
      .slice(0, 8)
      .map((p) => '<i style="background:' + TYPES[p.type].color + '"></i>')
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
  const active = mode === "playing";
  $("coach-prompt").hidden = !active;
  $("touch-controls").hidden = !active;
  if (!active) return;
  const c = sim.coach,
    near = sim.nearestInteraction(),
    p = world.project(c.x, (c.y || 0) + 2.2, c.z);
  const prompt = $("coach-prompt");
  prompt.style.left = Math.max(90, Math.min(innerWidth - 90, p.x)) + "px";
  prompt.style.top = Math.max(110, Math.min(innerHeight - 108, p.y)) + "px";
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
    b.hidden = !screen.visible;
    b.disabled = mode !== "playing" || !["queue", "swim", "injured"].includes(p.status);
    b.setAttribute("aria-label", "Select " + p.name + ", " + TYPES[p.type].label);
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
    b.querySelector(".type-icon").textContent = TYPES[p.type].icon;
    b.querySelector(".type-label").textContent = TYPES[p.type].label;
    const statusIcon = problemIcon(p);
    b.querySelector(".mood-icon").textContent =
      statusIcon !== TYPES[p.type].icon && statusIcon !== "🙂" ? statusIcon : "";
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
function events() {
  for (const e of sim.events.splice(0)) {
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
    } else if (e.type === "toast") toast(e.text, e.warning);
    else if (e.type === "points") points(e);
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
    audio.effect(e.type);
  }
}
function animate(t) {
  document.documentElement.style.setProperty("--cue", cuePulse(t / 1000, reducedMotion.matches).toFixed(3));
  const dt = Math.min((t - previous) / 1000 || 0.016, 0.06);
  previous = t;
  try {
    if (mode === "playing" || mode === "countdown") {
      // Fixed substeps keep congestion stable even on lower frame rates.
      const v = input.vector(),
        movement = screenMovement(v.x, v.z);
      sim.setMovement(movement.x, movement.z);
      accumulator = Math.min(0.12, accumulator + dt);
      while (accumulator >= 1 / 60) {
        sim.tick(1 / 60);
        accumulator -= 1 / 60;
      }
      events();
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
    world.sync(sim, t / 1000, dt);
    if (world.incidentView.consumeLightning()) audio.effect("thunder");
    world.render();
    updateBubbles();
    updateContext();
    uiClock += dt;
    if (uiClock > 0.12) {
      uiClock = 0;
      updateUI();
    }
  } catch (e) {
    console.error("Pool Panic frame error", e);
    if (mode === "playing") {
      sim.status = "paused";
      mode = "paused";
      audio.playing = false;
      toast("The pool hit a snag. Restart the shift to try again.", true);
      $("pause-dialog").showModal();
    }
  }
  requestAnimationFrame(animate);
}
function bind() {
  $("level-map").innerHTML = SHIFTS.map(
    (s, i) =>
      `<button data-level="${i + 1}" class="${s.venue === "resort" ? "resort" : ""}" aria-label="Level ${i + 1}"><span class="level-number">${String(i + 1).padStart(2, "0")}</span><i class="level-lock" aria-hidden="true">🔒</i><span class="level-stars" aria-hidden="true"></span></button>`,
  ).join("");
  $("scoop-target").onclick = () => sim.scoop();
  $("start").onclick = start;
  document.querySelectorAll("[data-level]").forEach(
    (b) =>
      (b.onclick = () => {
        level = Number(b.dataset.level);
        sim = makeDemo();
        clearBubbles();
        updateChoices();
        updateUI();
      }),
  );
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
  $("assist").onclick = () => sim.interact();
  $("sound").onclick = () => {
    audio.init();
    const on = audio.toggle();
    $("sound").classList.toggle("off", !on);
    $("sound").setAttribute("aria-label", on ? "Mute sound" : "Enable sound");
  };
  $("pause").onclick = pause;
  $("resume").onclick = resume;
  $("restart").onclick = start;
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
  $("play-again").onclick = start;
  $("back-menu").onclick = returnMenu;
  $("next-level").onclick = () => {
    level = Math.min(SHIFTS.length, level + 1);
    start();
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
      const v = input.vector();
      const m = screenMovement(v.x, v.z);
      sim.setMovement(m.x, m.z);
      sim.dash();
    },
    onInteract: () => sim.interact(),
    onPause: () => {
      if (mode === "playing" || mode === "countdown") pause();
      else if (mode === "paused") resume();
    },
    onShortcut: (e) => {
      const key = e.key.toLowerCase();
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
  document.addEventListener("keydown", (e) => input.keyDown(e));
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
      const v = input.vector();
      const m = screenMovement(v.x, v.z);
      sim.setMovement(m.x, m.z);
      sim.dash();
    }
  };
  $("touch-jump").onclick = () => {
    if (mode === "playing") sim.jump();
  };
  $("touch-interact").onclick = () => {
    if (mode === "playing") sim.interact();
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
  updateChoices();
  updateUI();
  syncVenue(sim);
  $("loading").hidden = true;
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
      play(n = level) {
        level = n;
        start();
      },
      step(seconds = 1, drive = null) {
        for (let t = 0; t < seconds; t += 1 / 60) {
          drive?.(sim);
          sim.tick(1 / 60);
          if (sim.events.length) events();
        }
        updateUI();
      },
      unlockAll() {
        records.unlocked = SHIFTS.length;
        updateChoices();
      },
    };
} catch (e) {
  console.error(e);
  $("loading").innerHTML =
    '<p>We couldn’t open the 3D pool.</p><p style="font-size:14px;font-weight:500;max-width:320px;text-align:center">Enable hardware acceleration in your browser and reload. Pool Panic needs WebGL to play.</p><button class="primary" style="width:200px" onclick="location.reload()">Try again ↻</button>';
}
