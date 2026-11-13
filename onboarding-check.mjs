// Phase 1, the first ten minutes (19 October 2026): the guided first shift, a pool's first visit (its card, a little easier), the
// lane choice judged at once, one meaning per key, the main screen without the old map, and a calmer HUD.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PoolSimulation } from "./dist/sim.mjs";
import { Tutor, LESSONS, FINALE_SECONDS } from "./dist/tutorial.mjs";
import { laneVerdict } from "./dist/guidance.mjs";
import {
  POOLS,
  POOL_IDS,
  POOL_INTROS,
  FIRST_VISIT_EASE,
  TUTORIAL_SECONDS,
  buildShift,
  newWeek,
  normalizeWeekSave,
  finishShift,
  INCIDENT_ORDER,
  bandOf,
  LESSON_STEP,
  LESSON_POOL,
  LESSON_EXTRA,
  lessonDue,
  FINALE_WEEK,
  SHIFTS_PER_WEEK,
} from "./dist/week.mjs";
import { tick, go } from "./check-helpers.mjs";

const app = readFileSync("dist/app.mjs", "utf8"),
  html = readFileSync("dist/index.html", "utf8"),
  css = readFileSync("dist/style.css", "utf8"),
  weekUi = readFileSync("dist/week-ui.mjs", "utf8");

// 1) A pool's first visit: every pool has its card (one rule, one action); the shift is FIRST_VISIT_EASE levels easier (never
// below the week's band, Phase 2), only when the player has not played that pool, and never for the gentle first minute.
{
  for (const id of POOL_IDS) {
    const intro = POOL_INTROS[id];
    assert.ok(intro && intro.rule.length > 20 && intro.action.length > 10, id + " has its card");
  }
  let eased = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const save = normalizeWeekSave({ v: 2, chapter: 2, known: INCIDENT_ORDER });
    const week = { ...newWeek(save, seed * 97), shift: seed % 6 };
    assert.equal(week.chapter, 2);
    const plain = buildShift(week, null, INCIDENT_ORDER),
      fresh = buildShift(week, null, INCIDENT_ORDER, []),
      known = buildShift(week, null, INCIDENT_ORDER, [plain.pool]);
    assert.equal(plain.firstVisit, false, "no `seen`, no first visit (checks and old replays)");
    assert.equal(known.firstVisit, false);
    assert.equal(known.tier, plain.tier, "a pool already played is played at the drawn level");
    assert.equal(known.intro, null);
    assert.ok(fresh.firstVisit && fresh.intro === POOL_INTROS[fresh.pool], "a new pool shows its card");
    const foot = bandOf(week.chapter)[0];
    assert.ok(fresh.tier >= Math.min(foot, plain.tier) && fresh.tier <= plain.tier, "and is no harder");
    if (plain.tier > foot) {
      assert.equal(
        fresh.tier,
        Math.max(foot, plain.tier - FIRST_VISIT_EASE),
        "two levels easier, not below the week's band",
      );
      eased++;
    }
  }
  assert.ok(eased > 5, "some first visits were eased (" + eased + ")");
  // The gentle first minute is never a "first visit".
  const save = normalizeWeekSave({});
  const monday = buildShift(newWeek(save, 7), null, [], []);
  assert.equal(monday.firstVisit, false);
  // The save keeps the pools played and the tutorial flag; a finished shift adds its pool and, if it was the tutorial, sets it.
  const kept = normalizeWeekSave({ v: 2, seen: ["club", "nowhere", "kids", "club"], tutorial: 1 });
  assert.deepEqual(kept.seen, ["club", "kids"]);
  assert.equal(kept.tutorial, true);
  assert.deepEqual(normalizeWeekSave({}).seen, []);
  const s = normalizeWeekSave({});
  s.week = newWeek(s, 11);
  const sh = buildShift(s.week, null, s.known, s.seen);
  finishShift(
    s,
    { ...sh, config: { ...sh.config, tutorial: true } },
    { score: 900, stars: 3, served: 5 },
    {},
  );
  assert.ok(s.seen.includes(sh.pool) && s.tutorial, "played: seen, and the tutorial done");
}

// 2) The guided shifts (5 November 2026), played through by a script. The first is lanes and nothing else: select, lane, a few more,
// then the finale for a few seconds and nothing more; no fins guest, no wet spot. The second (the third shift, at the Community
// Pool): fins from the rack by the line, the guest to a lane, then a cramp, the ring, the dive, the swim, the climb out and the ring
// back on its hook; its incidents wait until then.
{
  const save = normalizeWeekSave({});
  save.week = newWeek(save, 2026);
  const sh = buildShift(save.week, "regular", [], []);
  assert.equal(sh.step, 0);
  const s = new PoolSimulation(sh.tier, 4242, {
    config: { ...sh.config, tutorial: 1, duration: TUTORIAL_SECONDS },
  });
  s.start();
  const tutor = new Tutor(1);
  const tip = () => tutor.update(s, s.events.splice(0));
  const until = (sim, fn, seconds = 30, each = () => {}) => {
    for (let f = 0; f < seconds * 60 && !fn(); f++) {
      tick(sim);
      each();
    }
    return fn();
  };
  assert.ok(
    until(s, () => tip()?.id === "select"),
    "first: select the waiting swimmer",
  );
  assert.ok(!s.people.some((p) => p.finsFirst), "nobody asks for fins in the first");
  const first = s.people.find((p) => p.status === "queue");
  s.select(first.id);
  assert.equal(tip().id, "lane", "then: a lane");
  assert.ok(s.assign(0), "sent to lane 1");
  assert.ok(
    until(s, () => tip()?.id === "more", 40, tip),
    "then: keep sending them",
  );
  let sent = 1;
  const done = until(
    s,
    () => tutor.finishedAt !== null,
    60,
    () => {
      const q = s.people.find((p) => p.status === "queue");
      if (q && s.select(q.id) !== false && s.assign(sent % 4)) sent++;
      tip();
    },
  );
  assert.ok(done && sent >= 3, "three sent: the lessons are done");
  assert.equal(tip()?.id, "finale", "then the well done");
  assert.equal(tip().step, LESSONS.length);
  tick(s, (FINALE_SECONDS + 1) * 60);
  assert.equal(tip(), null, "and then nothing more");
  tick(s, 60 * 60);
  assert.ok(!s.people.some((p) => p.finsFirst), "no fins guest all shift");
  assert.equal(s.wetSpots?.length || 0, 0, "and no wet spot: the first is lanes only");
  assert.equal(s.loudestAlert()?.kind === "fins", false);
  // Skipping says nothing more.
  const skipping = new Tutor(1);
  skipping.skip();
  assert.equal(skipping.update(s, []), null);
}
{
  // The second, at the Community Pool: the fin rack stands a few steps from the waiting line and the MEN's door.
  const save = normalizeWeekSave({ tutorial: true });
  save.week = { ...newWeek(save, 31), shift: LESSON_STEP };
  const sh = buildShift({ ...save.week, pools: Array(6).fill(LESSON_POOL) }, null, INCIDENT_ORDER, []);
  const { big, ...config } = sh.config;
  assert.ok(sh.tier >= 2, "a level with cramps");
  const s = new PoolSimulation(sh.tier, 77, {
    config: { ...config, tutorial: 2, duration: config.duration + LESSON_EXTRA },
  });
  assert.equal(s.venue.id, "club");
  s.start();
  const rack = s.venue.stations.fins;
  const spots = [0, 1, 2, 3, 4, 5, 6, 7].map((slot) => s.venue.queuePosition(-1, slot));
  const nearest = Math.min(...spots.map((q) => Math.hypot(q.x - rack.x, q.z - rack.z)));
  assert.ok(nearest < 4, "the rack is by the line (" + nearest.toFixed(1) + " m)");
  const tutor = new Tutor(2);
  const tip = () => tutor.update(s, s.events.splice(0));
  const until = (fn, seconds = 30, each = () => {}) => {
    for (let f = 0; f < seconds * 60 && !fn(); f++) {
      tick(s);
      tip();
      each();
    }
    return fn();
  };
  const guest = () => s.people.find((p) => p.finsFirst);
  // Send everyone but the fins guest, so the pool has swimmers in it.
  const sendOthers = () => {
    for (const q of s.people.filter((p) => p.status === "queue" && !p.finsFirst)) {
      s.select(q.id);
      s.assign(q.type === "beginner" ? 0 : 1 + (q.id % 3));
    }
  };
  assert.ok(
    until(() => tip()?.id === "fins", 40, sendOthers),
    "the guest who wants fins",
  );
  assert.ok(guest().needsFins && guest().problem === "fins" && guest().status === "queue");
  assert.equal(guest().side, -1, "on the rack's side of the line");
  assert.ok(
    Math.hypot(guest().x - rack.x, guest().z - rack.z) < 5,
    "a few steps from the rack (" + Math.hypot(guest().x - rack.x, guest().z - rack.z).toFixed(1) + " m)",
  );
  assert.match(tip().text, new RegExp(guest().name + " won't swim without fins"));
  assert.match(tip().text, /right by the line/);
  // Like the life ring's, the fins have a marker with metres (only in this lesson): the rack first, then the guest.
  const finsAlert = () => s.loudestAlert();
  assert.equal(finsAlert()?.kind, "fins");
  assert.equal(finsAlert().label, "Fin rack");
  assert.deepEqual([finsAlert().x, finsAlert().z], [rack.x, rack.z]);
  assert.equal(finsAlert().near, 1, "its metres show from 1 m away");
  // An easy, fast walk: from the guest to the rack in a few seconds.
  go(s, rack.x, rack.z);
  until(() => s.fetch("fins") || s.coach.carry === "fins", 5);
  assert.equal(s.coach.carry, "fins");
  assert.match(tip().text, /Walk up to/);
  assert.equal(finsAlert().label, guest().name, "with the fins, the marker is on the guest");
  const t1 = s.time;
  for (let k = 0; k < 6 && !guest().hasFins; k++) {
    const point = s.servicePoint(guest());
    go(s, point.x, point.z);
    until(() => s.deliver(guest().id) || guest().hasFins, 3);
  }
  assert.ok(guest().hasFins, "fins handed over");
  assert.ok(s.time - t1 < 6, "the guest is a few steps from the rack (" + (s.time - t1).toFixed(1) + " s)");
  assert.equal(tip().id, "fins-lane");
  assert.notEqual(finsAlert()?.kind, "fins", "handed over: no fins marker");
  s.select(guest().id);
  assert.ok(s.assign(1), "the fins guest sent to lane 2");
  tip();
  assert.equal(s.lessonsDone(), false, "the cramp is still to come");
  // Then the cramp: the swimmer longest in the water, a few seconds later.
  assert.ok(
    until(() => tip()?.id === "ring", 30, sendOthers),
    "a cramp: fetch a ring",
  );
  assert.equal(s.rescue.kind, "cramp");
  assert.equal(s.rescue.victim, s.lessonCramp);
  assert.match(tip().text, /has a cramp/);
  const p = s.get(s.rescue.victim);
  // The ring from the wall, then the edge: the coach dives in by himself.
  go(s, -6.6, -13.7);
  go(s, -4, -14.5);
  assert.ok(s.interact());
  assert.equal(s.coach.carry, "lifering");
  assert.equal(tip().id, "dive");
  go(s, -4, -10.5);
  go(s, -7.2, -10.5);
  go(s, -7.2, 0);
  s.setMovement(1, 0);
  for (let f = 0; f < 120 && !s.coach.waterTransition; f++) s.tick(1 / 60);
  s.clearInput();
  assert.ok(
    until(() => tip()?.id === "swim", 3),
    "in the water: swim to them",
  );
  tick(s, 40);
  assert.ok(
    until(
      () => s.rescue?.stage !== "stranded",
      15,
      () => {
        const dx = p.x - s.coach.x,
          dz = p.z - s.coach.z,
          d = Math.hypot(dx, dz) || 1;
        s.setMovement(dx / d, dz / d);
      },
    ),
    "swum to them: they grab the ring",
  );
  s.clearInput();
  assert.equal(tip().id, "climb", "then climb out");
  s.setMovement(-1, 0);
  for (let f = 0; f < 400 && (s.coach.swimming || s.coach.waterTransition); f++) s.tick(1 / 60);
  s.clearInput();
  assert.ok(!s.coach.swimming && !s.coach.waterTransition, "out of the water");
  assert.ok(
    until(() => !s.rescue, 60, sendOthers),
    "the swimmer is safe on the deck",
  );
  const ring = s.lifeRings.find((r) => r.state !== "wall");
  assert.notEqual(tip()?.id, "hang", "(not while the swimmer still holds the ring)");
  assert.ok(
    until(() => ring.state === "deck", 30, sendOthers),
    "on the bench, they let go of it",
  );
  assert.equal(tip().id, "hang", "then: the ring back on its hook");
  assert.match(tip().text, /Pick up the life ring by the bench/);
  go(s, ring.x, ring.z);
  assert.ok(s.interact());
  assert.equal(s.coach.carry, "lifering");
  assert.match(tip().text, /Hang the life ring back/);
  go(s, ring.mount.x, ring.mount.z);
  until(() => s.returnItem() || ring.state === "wall", 5);
  assert.equal(ring.state, "wall");
  assert.equal(tip()?.id, "finale", "then the well done");
  assert.match(tip().text, /real lifeguard/);
  assert.ok(s.lessonsDone() && s.summary().lessons, "the lessons done: the summary says so");
  // The incidents waited for it, and come after.
  const metBefore = (s.met || []).length;
  assert.equal(metBefore, 0, "no incident during the lessons");
  tick(s, (FINALE_SECONDS + 1) * 60);
  assert.equal(tip(), null, "and then nothing more");
  // Outside the lessons a guest who asks for fins has no marker of the kind.
  const later = new PoolSimulation(6, 2, {});
  later.start();
  let finsMarked = false,
    finsAsked = false;
  for (let f = 0; f < 40 * 60; f++) {
    tick(later);
    finsAsked ||= later.people.some((p) => p.finsFirst && p.status === "queue");
    finsMarked ||= later.loudestAlert()?.kind === "fins";
  }
  assert.ok(finsAsked, "(a guest asked for fins first)");
  assert.ok(!finsMarked, "no fins marker in a shift that is not the lesson");
  assert.match(app, /far > \(a\.near \?\? 4\)/, "the alert's metres: from `near` m, else 4");
}
{
  // In the week: the first shift of a first run is the first lesson; the third (and every shift after, until it is done or
  // skipped) the second, at the Community Pool, with no big moment. The finale Saturday is never a lesson.
  const save = normalizeWeekSave({});
  save.week = newWeek(save, 31);
  assert.equal(lessonDue(save), false, "not before the first lesson");
  save.tutorial = true;
  for (const [shift, due] of [
    [0, false],
    [1, false],
    [LESSON_STEP, true],
    [LESSON_STEP + 1, true],
  ]) {
    save.week.shift = shift;
    assert.equal(lessonDue(save), due, "shift " + shift);
  }
  const sh = buildShift({ ...save.week, pools: Array(6).fill(LESSON_POOL) }, null, INCIDENT_ORDER, []);
  finishShift(
    save,
    { ...sh, config: { ...sh.config, tutorial: 2 } },
    { score: 10, stars: 0, lessons: false },
    {},
  );
  assert.equal(save.lesson2, false, "not finished: it comes back");
  save.week.shift = LESSON_STEP + 1;
  assert.equal(lessonDue(save), true);
  finishShift(
    save,
    { ...sh, config: { ...sh.config, tutorial: 2 } },
    { score: 900, stars: 3, lessons: true },
    {},
  );
  assert.equal(save.lesson2, true, "finished: never again");
  assert.equal(lessonDue(save), false);
  assert.equal(normalizeWeekSave({ lesson2: 1 }).lesson2, true, "the save keeps it");
  const finale = normalizeWeekSave({ tutorial: true });
  finale.week = { ...newWeek(finale, 5), chapter: FINALE_WEEK, shift: SHIFTS_PER_WEEK - 1 };
  assert.equal(lessonDue(finale), false, "never on the finale Saturday");
  assert.match(weekUi, /if \(!save\.tutorial && shift\.step === 0\)/);
  assert.match(weekUi, /tutorial: 1, duration: TUTORIAL_SECONDS/);
  assert.match(weekUi, /else if \(lessonDue\(save\)\) \{\s*const \{ big, \.\.\.config \} = shift\.config;/);
  assert.match(weekUi, /tutorial: 2, duration: config\.duration \+ LESSON_EXTRA/);
  assert.match(weekUi, /if \(w === save\.week && lessonDue\(save\)\) pools\[w\.shift\] = LESSON_POOL/);
  assert.match(
    weekUi,
    /if \(shift\?\.config\?\.tutorial === 2\) save\.lesson2 = true;\s*else save\.tutorial = true;/,
  );
  assert.match(app, /tutor = sim\.config\.tutorial \? new Tutor\(sim\.config\.tutorial\) : null/);
  assert.match(app, /if \(tutor\) renderTutor\(tutor\.update\(sim, batch\)\)/);
  for (const id of ["tutor", "tutor-step", "tutor-text", "tutor-skip"])
    assert.ok(html.includes(`id="${id}"`), id);
}

// 3) The lane choice judged the moment a swimmer is sent: own lane, a good match, sharing, a mix that will jam, aqua in the way;
// nothing in a pool without lap lanes.
{
  const s = new PoolSimulation(5, 3);
  s.start();
  const put = (type, lane, status = "swim") => {
    const p = s.spawn({ type, sick: false });
    Object.assign(p, { status, lane });
    return p;
  };
  const pro = put("advanced", null, "queue");
  assert.deepEqual(laneVerdict(s, pro, 0), { good: true, text: "Own lane 👍" });
  put("advanced", 0);
  assert.equal(laneVerdict(s, pro, 0).text, "Good match 👍");
  put("beginner", 1);
  assert.equal(laneVerdict(s, pro, 1).text, "Sharing 👍", "two to a lane split it");
  put("beginner", 1);
  assert.deepEqual(laneVerdict(s, pro, 1), { good: false, text: "Stuck behind slower swimmers 😬" });
  put("aqua", 2);
  assert.equal(laneVerdict(s, pro, 2).good, false, "aqua in the way");
  const slow = put("beginner", null, "queue");
  put("advanced", 0);
  assert.equal(laneVerdict(s, slow, 0).text, "Too slow for this lane 😬");
  const kids = new PoolSimulation(5, 3, { venue: "kids" });
  kids.start();
  assert.equal(laneVerdict(kids, kids.spawn({ type: "child" }), 0), null, "no verdict without lap lanes");
  assert.match(app, /verdict = e\.verdict \|\| laneVerdict\(sim, sent, e\.lane\)/);
}

// 4) One meaning per key: the numbers only send someone to a place; the wave machine is Z, the bar B; the texts say so.
{
  assert.match(app, /key === "z" && sim\.venue\.waves\) sim\.toggleWaves\(\)/);
  assert.match(app, /key === "b" && \(sim\.venue\.roof \|\| sim\.venue\.cruise\)\) sim\.fetch\("bar"\)/);
  assert.ok(!/sim\.venue\.waves && key === "1"/.test(app) && !/sim\.venue\.roof && key === "1"/.test(app));
  assert.ok(!/sim\.venue\.cruise && key === "3"/.test(app));
  assert.ok(app.includes('"press Z to start"') && app.includes('"No orders · press B for a tray"'));
  assert.ok(!/1 stops|press 1 to start|press " \+ \(sim\.venue\.cruise/.test(app));
}

// 5) The main screen: the week over the menu's 3D stage (title-check.mjs; a plain backdrop behind it when the stage
// cannot load), a line saying what you do (the tip line's first words for a new player), and the old level map only in free play.
{
  assert.ok(html.includes('id="menu-art"') && html.includes('class="wk-pitch"'));
  assert.match(readFileSync("dist/app.mjs", "utf8"), /querySelector\(".wk-pitch"\)\.textContent/);
  assert.match(css, /body\.menu:not\(\.freeplay\) #map \{\s*display: none;/);
  // (Never the old menu's picture behind it, 2 November 2026: the 3D stage, or a plain backdrop when it cannot load.)
  assert.doesNotMatch(css, /url\("assets\/story\/coach-pool\.webp"\)/);
  // One card is no choice: a plain start button.
  assert.match(weekUi, /const single = shift\.cards\.length === 1/);
  assert.match(weekUi, /Start the shift ▶/);
  for (const id of [
    "wd-intro",
    "wd-intro-icon",
    "wd-intro-name",
    "wd-intro-rule",
    "wd-intro-action",
    "wd-cards-note",
  ])
    assert.ok(html.includes(`id="${id}"`), id);
}

// 6) A calmer HUD: tools that are not needed now are not on screen; happy swimmers wear quiet tags; the deck heading and the
// status line are readable on any floor.
{
  assert.match(
    app,
    /putFlag\(\$\("relief"\), "hidden", !holding\("relief"\) && !sim\.people\.some\(\(p\) => p\.problem === "eyes"\)\)/,
  );
  assert.match(app, /putFlag\(\$\("clean"\), "hidden", !sim\.clutter\.length\)/);
  assert.match(app, /putFlag\(\$\("mop"\), "hidden", !wet && !holding\("mop"\)\)/);
  assert.match(app, /b\.classList\.toggle\(\s*"quiet"/);
  assert.match(css, /\.bubble\.quiet \{/);
  assert.match(css, /\.pool-status > div \{\s*background: #fff4cfe8/);
  assert.ok(POOLS.club && POOL_IDS.length === Object.keys(POOL_INTROS).length);
  // (The HUD's writes go through putFlag since 13 November 2026: only what changed is written to the page, perf-check.mjs.)
  // Less UI (5 November 2026): the Water Check and the chlorine only when the water is a problem, the fins when a guest asks, the
  // hand only when it holds something, the panel only with something in it; no Interact button; the status box only with news;
  // the floor's station names only near the coach; nothing over the coach when it has nothing to say.
  assert.match(
    app,
    /const waterTrouble =\s*sim\.contamination > 30 \|\| sim\.chlorine > 75 \|\| !!sim\.cleanup \|\| sim\.closed > 0 \|\| holding\("chlorine"\)/,
  );
  assert.match(
    app,
    /putFlag\(\$\("water-check"\), "hidden", !waterTrouble\);\s*putFlag\(\$\("chlorine"\), "hidden", !waterTrouble\);/,
  );
  assert.match(app, /putFlag\(\$\("fins"\), "hidden", !gearWanted\)/);
  assert.match(app, /putFlag\(\$\("coach-state"\), "hidden", !sim\.coach\.carry && !sim\.coach\.job\)/);
  assert.match(app, /\["water-check", "care-actions", "coach-state"\]\.every\(\(id\) => \$\(id\)\.hidden\)/);
  assert.match(html, /<button id="assist"[^>]*hidden>/);
  assert.match(app, /putFlag\(\$\("pool-status-box"\), "hidden", calmStatus && calmHint/);
  assert.match(app, /data\.z - sim\.coach\.z\) > STATION_LABEL_NEAR/);
  assert.match(app, /if \(!firstPerson\)\s*putFlag\(\s*prompt,\s*"hidden",\s*!near && !c\.busy/);
  // The HUD the Overcooked way (5 November 2026): no scoreboard and no ⚙ over the pool in a shift; the Splash Coins at the bottom
  // left (a coin icon, the streak's multiplier under them, a small green +N or red −N on a change), the time at the bottom right
  // (a stopwatch icon, a bar, the pause button); the venue, the pass mark and the star targets in the pause menu.
  assert.ok(!html.includes('id="scoreboard"'), "no scoreboard");
  for (const id of [
    "hud-coins",
    "coins",
    "coins-sub",
    "coin-pops",
    "hud-clock",
    "clock",
    "clock-fill",
    "pause-btn",
  ])
    assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(html.includes('src="assets/hud/coin.webp"') && html.includes('src="assets/hud/stopwatch.webp"'));
  for (const f of ["coin", "stopwatch"])
    assert.ok(readFileSync(`dist/assets/hud/${f}.webp`).length < 40000, f);
  assert.match(css, /body:not\(\.menu\) \.top-actions #settings,/);
  assert.match(css, /\.hud-coins \{\s*left: var\(--edge\);/);
  assert.match(css, /\.hud-clock \{\s*right: var\(--edge\);/);
  assert.match(app, /streakNow\.mult > 1 \? "STREAK ×" \+ streakNow\.mult : "SPLASH COINS"/);
  assert.match(app, /pop\.className = "coin-pop " \+ \(up \? "good" : "bad"\)/);
  assert.match(css, /\.coin-pop\.good \{/);
  assert.match(css, /\.coin-pop\.bad \{/);
  assert.match(app, /\$\("pause-btn"\)\.onclick = openMenu/);
  assert.match(app, /function fillPauseShift\(\)/);
  assert.match(
    app,
    /sim\.config\.thresholds\.map\(\(at, i\) => \(\{ label: "★"\.repeat\(i \+ 1\), at \}\)\)/,
  );
  // Tags only where they help: where every guest goes to the same thing, a guest has one only while they need the coach.
  assert.match(
    app,
    /tagFree = !!\(sim\.venue\.class \|\| sim\.venue\.waves \|\| sim\.venue\.kids \|\| sim\.venue\.onsen \|\| sim\.venue\.river\)/,
  );
  assert.match(app, /wanted = needsCoach \|\| !tagFree \|\| \(sim\.venue\.river && p\.status === "queue"\)/);
  // With no tags to click, a zone or a spring with nobody selected takes the guest who has waited longest; not the Kids Pool's
  // POOL (a kid is caught first), and never a lane pool's lane (who goes where is the choice there).
  for (const [venue, takes] of [
    ["disco", true],
    ["onsen", true],
    ["club", false],
  ]) {
    const s = new PoolSimulation(5, 3, { venue });
    s.schedule = [];
    s.start();
    const a = s.spawn({ type: venue === "onsen" ? "intermediate" : "aqua", sick: false }),
      b = s.spawn({ type: venue === "onsen" ? "intermediate" : "aqua", sick: false });
    Object.assign(a, { wait: 3, needsFins: false, finsFirst: false, problem: null });
    Object.assign(b, { wait: 9, needsFins: false, finsFirst: false, problem: null });
    s.selected = null;
    assert.equal(s.assign(0), takes, venue);
    if (takes)
      assert.ok(b.status !== "queue" && a.status === "queue", venue + ": the one who waited longest");
  }
}

// 7) The middle of the view is the pool's (21 October 2026): every message stands in the column on the left, where the guests'
// cards were, inside the strip the follow camera keeps clear; nothing of it is centred under the scoreboard any more.
{
  const rail = html.slice(html.indexOf('<div id="hud-rail"'), html.indexOf('<div id="map"'));
  const order = ["sting", "closure", "tutor", "combo", "toast", "queue-panel"].map((id) =>
    rail.indexOf(`id="${id}"`),
  );
  assert.ok(
    order.every((i) => i > 0) && order.every((i, k) => !k || i > order[k - 1]),
    "the sting, the banner, the tip, the streak, the toasts and the selected guest, one under the other",
  );
  for (const id of ["sting", "closure", "tutor", "combo", "toast", "queue-panel"])
    assert.equal(html.split(`id="${id}"`).length, 2, id + " only in the column");
  assert.match(
    css,
    /\.hud-rail \{[^}]*left: var\(--edge\);[^}]*width: calc\(min\(22vw, 300px\) - var\(--edge\) - 10px\);/,
  );
  assert.match(css, /\.hud-rail > \.toast,[\s\S]*?\{\s*position: relative;[^}]*transform: none;/);
  assert.ok(
    !/body:has\(#(tutor|closure):not\(\[hidden\]\)\) \.combo/.test(css),
    "nothing stacked by hand under a centred tip",
  );
  // The camera keeps the coach out of the column's strip: the column ends 10 px short of the strip's edge.
  const scene = readFileSync("dist/scene.mjs", "utf8");
  assert.match(scene, /left: portrait \? 24 : Math\.min\(300, w \* 0\.22\)/);
  // The sting slams in at the top of the column (no centring), and the big moment's result lands there too.
  const sting = app.slice(app.indexOf("function showSting("), app.indexOf("function hideMoments("));
  assert.ok(!sting.includes("-50%") && sting.includes("translateX(${x}px)"), "the sting is not centred");
  assert.match(app, /\$\("hud-rail"\)\.prepend\(el\)/);
  assert.ok(!/tutorBox/.test(app), "no arrow pushed under a centred tip");
}

console.log(
  "Onboarding checks passed: a card and an easier first visit for every new pool; the guided shifts played through (the first lanes only; the second at the Community Pool: fins from the rack by the line, then a cramp rescue, its incidents held until then, again until done); the lane choice judged at once; one meaning per key (numbers for places, Z waves, B bar); the main screen without the old map; a calmer HUD; every message in the column on the left, the middle of the view the pool's.",
);
