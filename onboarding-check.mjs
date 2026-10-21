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

// 2) The guided first shift, played through by a script: select, lane, fins to the guest who asks first, lane, mop the wet spot,
// then the finale for a few seconds and nothing more. The simulation sets the stage only when `config.tutorial` is on.
{
  const save = normalizeWeekSave({});
  save.week = newWeek(save, 2026);
  const sh = buildShift(save.week, "regular", [], []);
  assert.equal(sh.step, 0);
  const s = new PoolSimulation(sh.tier, 4242, {
    config: { ...sh.config, tutorial: true, duration: TUTORIAL_SECONDS },
  });
  s.start();
  const tutor = new Tutor();
  const tip = () => tutor.update(s, s.events.splice(0));
  const until = (fn, seconds = 30) => {
    for (let f = 0; f < seconds * 60 && !fn(); f++) {
      tick(s);
      tip();
    }
    return fn();
  };
  assert.ok(
    until(() => tip()?.id === "select"),
    "first: select the waiting swimmer",
  );
  const first = s.people.find((p) => p.status === "queue" && !p.finsFirst);
  s.select(first.id);
  assert.equal(tip().id, "lane", "then: a lane");
  assert.ok(s.assign(0), "sent to lane 1");
  const guest = () => s.people.find((p) => p.finsFirst);
  assert.ok(
    until(() => tip()?.id === "fins", 40),
    "then: the guest who wants fins",
  );
  assert.ok(guest().needsFins && guest().problem === "fins" && guest().status === "queue");
  assert.match(tip().text, new RegExp(guest().name + " won't swim without fins"));
  const rack = s.venue.stations.fins;
  // Like the life ring's, the fins have a marker with metres (only in the tutorial): the rack first, then the guest.
  const finsAlert = () => s.loudestAlert();
  assert.equal(finsAlert()?.kind, "fins");
  assert.equal(finsAlert().label, "Fin rack");
  assert.deepEqual([finsAlert().x, finsAlert().z], [rack.x, rack.z]);
  assert.equal(finsAlert().near, 1, "its metres show from 1 m away");
  go(s, rack.x, rack.z);
  until(() => s.fetch("fins") || s.coach.carry === "fins", 5);
  assert.equal(s.coach.carry, "fins");
  assert.match(tip().text, /Walk up to/);
  assert.equal(finsAlert()?.kind, "fins");
  assert.equal(finsAlert().label, guest().name, "with the fins, the marker is on the guest");
  for (let k = 0; k < 6 && !guest().hasFins; k++) {
    const point = s.servicePoint(guest());
    go(s, point.x, point.z);
    until(() => s.deliver(guest().id) || guest().hasFins, 3);
  }
  assert.ok(guest().hasFins, "fins handed over");
  assert.equal(tip().id, "fins-lane");
  assert.notEqual(finsAlert()?.kind, "fins", "handed over: no fins marker");
  s.select(guest().id);
  assert.ok(s.assign(1), "the fins guest sent to lane 2");
  tip();
  assert.ok(
    until(() => (s.wetSpots?.length || 0) > 0, 60),
    "the first swimmer out drips a wet spot",
  );
  assert.equal(tip().id, "mop");
  const bucket = s.venue.fixtures.mop;
  go(s, bucket.x, bucket.z);
  until(() => s.mop() || s.coach.carry === "mop", 5);
  assert.equal(s.coach.carry, "mop");
  assert.match(tip().text, /Walk onto the wet spot/);
  const spot = s.wetSpots[0];
  go(s, spot.x, spot.z);
  assert.ok(
    until(() => (s.mop(), tutor.done.has("mop")), 8),
    "mopped",
  );
  const done = tip();
  assert.equal(done?.id, "finale", "then the well done");
  assert.equal(done.step, LESSONS.length);
  tick(s, (FINALE_SECONDS + 1) * 60);
  assert.equal(tip(), null, "and then nothing more");
  // A guest who asks for fins first and the wet spot come only with the tutorial on.
  const plain = new PoolSimulation(sh.tier, 4242, { config: sh.config });
  plain.start();
  tick(plain, 30 * 60);
  assert.ok(!plain.people.some((p) => p.finsFirst), "no fins guest in the plain gentle minute");
  // Outside the tutorial a guest who asks for fins has no marker of the kind.
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
  assert.ok(!finsMarked, "no fins marker in a shift that is not the tutorial");
  assert.match(app, /far > \(a\.near \?\? 4\)/, "the alert's metres: from `near` m, else 4");
  // Skipping says nothing more.
  const skipping = new Tutor();
  skipping.skip();
  assert.equal(skipping.update(s, []), null);
  // In the week: the first shift of a first run is the tutorial, a little longer; played or skipped once, never again.
  assert.match(weekUi, /if \(!save\.tutorial && shift\.step === 0\)/);
  assert.match(weekUi, /tutorial: true, duration: TUTORIAL_SECONDS/);
  assert.match(app, /tutor = sim\.config\.tutorial \? new Tutor\(\) : null/);
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

// 5) The main screen: the week over the menu's 3D stage (title-check.mjs; the painted coach at his pool behind it when the stage
// cannot load), a line saying what you do (the tip line's first words for a new player), and the old level map only in free play.
{
  assert.ok(html.includes('id="menu-art"') && html.includes('class="wk-pitch"'));
  assert.match(readFileSync("dist/app.mjs", "utf8"), /querySelector\(".wk-pitch"\)\.textContent/);
  assert.match(css, /body\.menu:not\(\.freeplay\) #map \{\s*display: none;/);
  assert.match(css, /url\("assets\/story\/coach-pool\.webp"\)/);
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
    /\$\("relief"\)\.hidden = !holding\("relief"\) && !sim\.people\.some\(\(p\) => p\.problem === "eyes"\)/,
  );
  assert.match(app, /\$\("clean"\)\.hidden = !sim\.clutter\.length/);
  assert.match(app, /\$\("mop"\)\.hidden = !wet && !holding\("mop"\)/);
  assert.match(app, /b\.classList\.toggle\(\s*"quiet"/);
  assert.match(css, /\.bubble\.quiet \{/);
  assert.match(css, /\.pool-status > div \{\s*background: #fff4cfe8/);
  assert.ok(POOLS.club && POOL_IDS.length === Object.keys(POOL_INTROS).length);
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
  "Onboarding checks passed: a card and an easier first visit for every new pool; the guided first shift played through (select, lane, fins, lane, mop, well done) and only when asked for; the lane choice judged at once; one meaning per key (numbers for places, Z waves, B bar); the main screen without the old map; a calmer HUD; every message in the column on the left, the middle of the view the pool's.",
);
