// The week on screen (the rules are week.mjs): the card on the menu, the doors before each shift with Marina's wishes, the pick
// of a perk on the results, the week's part of the results, and the coach's locker (what lasts across runs: the pools, the gear,
// the dates album, the challenges, the scrapbook). The app hands over what it owns (starting a shift, the cinematics, the toast,
// the log).
import {
  WEEK_KEY,
  DAYS,
  DATE_DAY,
  SHIFTS_PER_WEEK,
  PERKS,
  RULES,
  GEAR,
  GEAR_IDS,
  LADDER,
  FINALE_WEEK,
  FINALE_POOL,
  ALL_DATES,
  INCIDENTS,
  INCIDENT_ORDER,
  BUILD_SLOTS,
  CHALLENGES,
  CHALLENGE_IDS,
  challengeOpens,
  SCRAP,
  SCRAP_IDS,
  HEAT_RULES,
  HEAT_PAY,
  VETERAN_RUNS,
  heatOpen,
  setHeat,
  chapterFor,
  chapterOfDate,
  normalizeWeekSave,
  newWeek,
  buildShift,
  dayDoors,
  POOLS,
  weekPools,
  openPools,
  finishShift,
  outlook,
  pickOffer,
  takePick,
  skipPick,
  rerollPick,
  rerollPrice,
  textsPassed,
  TUTORIAL_SECONDS,
  LESSON_POOL,
  LESSON_EXTRA,
  lessonDue,
} from "./week.mjs";
import { scene, money } from "./marina.mjs";
import { ART } from "./story.mjs";

const esc = (text) =>
  String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const upper = (s) => String(s).toUpperCase();
const stars = (n) => "★".repeat(n) + "☆".repeat(Math.max(0, 3 - n));

export function installWeek({
  $,
  storage = null,
  startShift,
  returnMenu,
  playScene,
  toast = () => {},
  crumb = () => {},
  presence = () => {},
  celebrate = () => {},
  dev = () => false, // dev mode (dev.mjs): FREE PLAY shows every pool open
}) {
  let save = load();
  let shift = null; // the shift being played (or picked)
  let result = null; // the last shift's result, until the player moves on
  let pickedCard = null;
  let options = []; // the day's doors, each as the shift it would be
  let dropFor = null; // the perk picked while the build is full: which one makes room?
  let inFreePlay = false; // the menu shows the level map (free play) instead of the week
  // `?pool=aquatic` (a test): every shift of the week at that pool.
  const forcedPool = POOLS[new URLSearchParams(globalThis.location?.search || "").get("pool")]
    ? new URLSearchParams(globalThis.location.search).get("pool")
    : null;
  const itinerary = (w) =>
    forcedPool
      ? Array(SHIFTS_PER_WEEK).fill(forcedPool)
      : w.pools || weekPools(w.chapter, w.seed, openPools(save.ladder, w.chapter));
  // The week as buildShift reads it: its pools, the gear the coach wears now, and the challenges done (the day rules open).
  // (the second guided shift is at the Community Pool, whatever the week drew for the day: week.mjs lessonDue; one door)
  const planned = (w) => {
    const pools = [...itinerary(w)],
      lesson = w === save.week && lessonDue(save);
    if (lesson) pools[w.shift] = LESSON_POOL;
    return { ...w, pools, gear: save.gear, done: save.done, ...(lesson && { lesson: true }) };
  };

  function load() {
    try {
      return normalizeWeekSave(JSON.parse(storage?.getItem(WEEK_KEY) || "{}"));
    } catch {
      return normalizeWeekSave({});
    }
  }
  function persist() {
    try {
      storage?.setItem(WEEK_KEY, JSON.stringify(save));
    } catch {}
  }
  const chapterNow = () => chapterFor(save.week ? save.week.chapter : save.chapter);

  // The six shifts, one a day, each with its stars once played (✗ for one not passed), and Sunday's date.
  function daysHtml(week) {
    const pools = week ? planned(week).pools : null;
    const days = DAYS.map((d, i) => {
      const h = week?.history[i],
        now = week && i === week.shift && !h,
        pool = pools && POOLS[pools[i]],
        mark = h ? (h.passed === false ? "✗" : "★".repeat(h.stars) || "✓") : pool ? pool.icon : "";
      return `<div class="wk-day${now ? " today" : ""}"${pool ? ` title="${esc(pool.name)}"` : ""}><span><i class="${h ? (h.passed === false ? "miss" : "done") : pool ? "pool" : ""}${now ? " now" : ""}">${mark}</i></span>${upper(d.slice(0, 3))}</div>`;
    });
    days.push(
      `<div class="wk-day date"><span><i>${chapterNow().date.icon}</i></span>${upper(DATE_DAY.slice(0, 3))}</div>`,
    );
    return days.join("");
  }
  function fill(el, from, to) {
    el.style.transition = "none";
    el.style.width = from + "%";
    void el.offsetWidth;
    el.style.transition = "";
    el.style.width = to + "%";
  }
  const share = (fund, goal) => Math.min(100, (fund / goal) * 100);
  const openCount = () => Math.min(save.ladder, LADDER.length);
  const buildIcons = (perks) => perks.map((p) => PERKS[p].icon).join(" ");

  // ---- the menu's card ------------------------------------------------------------------------------------------------
  function menu() {
    const ch = chapterNow(),
      w = save.week;
    $("week-card").hidden = inFreePlay;
    $("wk-date-icon").textContent = ch.date.icon;
    $("wk-eyebrow").textContent =
      "WEEK " +
      ch.id +
      (ch.id === FINALE_WEEK ? " · THE SEASON FINALE" : ch.id > FINALE_WEEK ? " · ENDLESS" : "") +
      (save.bestWeek > 1 ? " · BEST: WEEK " + save.bestWeek : "");
    $("wk-title").textContent = ch.date.name + " with Marina";
    $("wk-sub").textContent = w
      ? w.overtime
        ? `Saturday night · overtime · one last shift for the date`
        : `${DAYS[w.shift]} · shift ${w.shift + 1} of ${SHIFTS_PER_WEEK} · the date is on ${DATE_DAY}`
      : `Six shifts, Monday to Saturday. Save ${money(ch.goal)} for ${DATE_DAY}, or it's game over.`;
    // (The menu's column, 20 October 2026: a word for each button and a small line beside it.)
    // (START either way: the creator, 21 October 2026, "rename the Continue option to just Start".)
    $("wk-go").innerHTML = `<span class="ts-label">START</span>`;
    $("wk-money").textContent = money(w ? w.fund : save.carry || 0) + " / " + money(ch.goal);
    $("wk-fill").style.width = share(w ? w.fund : save.carry || 0, ch.goal) + "%";
    $("wk-days").innerHTML = daysHtml(w);
    const met = INCIDENT_ORDER.filter((k) => save.known.includes(k)),
      build = w ? w.perks : save.build;
    $("wk-note").textContent =
      `Pools open: ${openCount()} of ${LADDER.length} · ` +
      (save.dates.length ? "Dates this run: " + save.dates.length + " 💖 · " : "") +
      (build.length ? `Build: ${buildIcons(build)} · ` : "") +
      `Incidents met: ${met.map((k) => INCIDENTS[k].icon).join(" ") || "none yet"} (${met.length}/${INCIDENT_ORDER.length})`;
    $("wk-locker").innerHTML =
      `<span class="ts-label">COACH'S LOCKER</span><small>${save.stars}★${GEAR[save.gear] ? " · " + GEAR[save.gear].icon : ""}</small>`;
    $("wk-free").innerHTML =
      `<span class="ts-label">FREE PLAY</span><small>` +
      (dev() ? `${LADDER.length + 1} pools · dev` : `${openCount()} pools`) +
      `</small>`;
  }
  function hideMenu() {
    $("week-card").hidden = true;
  }

  // ---- starting, and the doors before each shift ---------------------------------------------------------------------
  function go() {
    if (save.week) return openPicker();
    const fresh = !save.invited?.includes(save.chapter);
    save.week = newWeek(save, Date.now());
    persist();
    crumb(
      "week",
      "week " +
        save.chapter +
        " starts · seed " +
        save.week.seed +
        " · pools " +
        save.week.pools.join(",") +
        (save.week.fund ? " · carried " + save.week.fund : "") +
        (save.week.veteran ? " · veteran" : "") +
        (save.week.pick ? " · a gift" : ""),
    );
    if (fresh) {
      save.invited = [...(save.invited || []), save.chapter];
      persist();
      playScene(scene("invite", chapterNow()).panels, openPicker);
    } else {
      toast(
        `Week ${chapterNow().id}! Save ${money(chapterNow().goal)} by ${DATE_DAY} for ${chapterNow().date.name.toLowerCase()} 💌`,
      );
      openPicker();
    }
  }
  // What a door's shift asks and offers, under the doors: the pass mark, Marina's wishes, a new pool's card.
  function showDoor(sh) {
    if (!sh) return;
    $("wd-pass").textContent = "PASS: " + sh.pass.toLocaleString() + " POINTS";
    $("wd-wishes").innerHTML = sh.wishes
      .map((x) => `<li><span>${x.icon} ${esc(x.text)}</span><b>+${money(x.pay)}</b></li>`)
      .join("");
    // A pool's first visit: its card (one rule, one action), and the shift is a little easier (week.mjs POOL_INTROS). The season
    // finale shows the arena's card every time, and the overtime says what is at stake.
    const intro = sh.overtime
      ? {
          name: "OVERTIME · ONE LAST SHIFT FOR THE DATE",
          rule: "It pays double, at the top of the week's levels.",
          action: "Fill the Date Fund with it, or the run is over.",
          icon: "⏰",
        }
      : sh.intro
        ? {
            name: sh.finale
              ? "THE SEASON FINALE · " + upper(sh.place)
              : "NEW POOL · " + upper(sh.place) + " · A LITTLE EASIER THE FIRST TIME",
            rule: sh.intro.rule,
            action: sh.intro.action,
            icon: sh.icon,
          }
        : null;
    $("wd-intro").hidden = !intro;
    if (intro) {
      $("wd-intro-icon").textContent = intro.icon;
      $("wd-intro-name").textContent = intro.name;
      $("wd-intro-rule").textContent = intro.rule;
      $("wd-intro-action").textContent = intro.action;
    }
  }
  function openPicker() {
    const w = save.week;
    if (!w) return menu();
    // A gift comes first: a veteran's Monday, or Marina's after a deluxe date (three perks, one to take, for nothing).
    if (w.pick?.gift && pickOffer(save).length) return openGift();
    const ch = chapterNow();
    shift = buildShift(planned(w), null, save.known, save.seen);
    options = shift.cards.map((c) => buildShift(planned(w), c.id, save.known, save.seen));
    const o = outlook(w),
      single = shift.cards.length === 1,
      first = options[0] || shift;
    $("wd-title").textContent =
      "WEEK " +
      ch.id +
      " · " +
      (w.overtime ? "SATURDAY NIGHT · OVERTIME" : upper(shift.day)) +
      (single ? " · " + first.icon + " " + upper(first.place) : "") +
      (first.finale ? " · SEASON FINALE" : "");
    $("wd-count").textContent = w.overtime ? "THE LAST CHANCE" : `SHIFT ${w.shift + 1} OF ${SHIFTS_PER_WEEK}`;
    $("wd-date").textContent = ch.date.icon;
    $("wd-money").textContent = money(w.fund) + " / " + money(ch.goal);
    $("wd-fill").style.width = share(w.fund, ch.goal) + "%";
    $("wd-pace").textContent = o.reached
      ? o.deluxeNeed > 0
        ? `The date is paid for 💖 ${money(o.deluxeNeed)} more makes it a deluxe date 💎, and half of what's over goes to next week`
        : "A deluxe date 💎! Half of what's over the goal goes to next week"
      : `${money(o.need)} to go for ${ch.date.name.toLowerCase()} · about ${money(o.perShift)} a shift`;
    $("wd-pace").classList.toggle("behind", !o.onTrack);
    $("wd-days").innerHTML = daysHtml(w);
    const gear = GEAR[shift.gear];
    $("wd-gear").hidden = !gear;
    $("wd-gear").textContent = gear ? gear.icon + " " + upper(gear.name) : "";
    $("wd-gear").title = gear ? gear.text : "";
    $("wd-perks").textContent = w.perks.map((p) => PERKS[p].icon).join("");
    $("wd-perks").title = w.perks.map((p) => PERKS[p].name + ": " + PERKS[p].text).join("\n");
    // An endless week's conditions (after the story's ending), to take on before Monday's shift: harder, and better paid.
    const heat = heatOpen(save);
    $("wd-heat").hidden = !heat;
    if (heat)
      $("wd-heat").innerHTML =
        `<small>🔥 CONDITIONS FOR THIS WEEK · +${Math.round(HEAT_PAY * 100)}% PAY EACH · TWO MAKE A GOLD DATE</small>` +
        Object.entries(HEAT_RULES)
          .map(
            ([id, h]) =>
              `<button class="heat-chip" data-heat="${id}" aria-pressed="${w.heat.includes(id)}" title="${esc(h.text)}">${h.icon} ${esc(h.name)}</button>`,
          )
          .join("");
    showDoor(first);
    // One door is not a choice (the first shifts of a first run, the finale, a lesson, the overtime): a plain start button.
    $("wd-cards-note").hidden = single;
    $("wd-cards").classList.toggle("doors", !single);
    $("wd-cards").innerHTML = single
      ? `<button class="primary wd-start" data-card="${shift.cards[0].id}">${first.finale ? "Start the finale 🏆" : w.overtime ? "Start the overtime ⏰" : "Start the shift ▶"}</button>`
      : shift.cards
          .map((c, i) => {
            const sh = options[i],
              pool = POOLS[c.pool];
            return (
              `<button class="booking-card door${c.rule === "regular" && !c.mystery ? " regular" : ""}" data-card="${c.id}" data-door="${i}">` +
              `<span class="d-pool"><i aria-hidden="true">${pool.icon}</i>${esc(pool.name)}${sh.firstVisit ? " <b>NEW</b>" : ""}</span>` +
              `<span class="b-icon" aria-hidden="true">${c.icon}</span><strong>${esc(c.name)}</strong>` +
              `<span class="b-pay">×${c.payout}<small>PAY</small></span><span class="b-note">${esc(c.note)}</span>` +
              `<span class="b-danger" aria-label="danger ${c.danger} of 3">${"🔥".repeat(c.danger)}</span>` +
              `<span class="d-wishes" title="${esc(sh.wishes.map((x) => x.text).join(" · "))}">💌 ${sh.wishes.map((x) => x.icon).join(" ")}</span>` +
              (Number.isInteger(c.swap) ? `<span class="d-swap">instead of ${DAYS[c.swap]}</span>` : "") +
              `</button>`
            );
          })
          .join("");
    presence(`Week ${ch.id} · ${shift.day} · ${single ? first.place : "picking a door"}`);
    if (!$("week-dialog").open) $("week-dialog").showModal();
    $("wd-cards").firstElementChild?.focus();
  }
  function pick(cardId) {
    pickedCard = cardId;
    shift = buildShift(planned(save.week), cardId, save.known, save.seen);
    // The guided first shift (Phase 1, tutorial.mjs): the first shift of a player's first run teaches the job, a little longer
    // than the gentle minute. Played or skipped once, never again (`save.tutorial`, set by finishShift or by skipTutorial).
    if (!save.tutorial && shift.step === 0 && !save.week.veteran)
      shift = { ...shift, config: { ...shift.config, tutorial: 1, duration: TUTORIAL_SECONDS } };
    // The second (5 November 2026): fins and a cramp, from the third shift, until it is done (`save.lesson2`). No big moment.
    else if (lessonDue(save)) {
      const { big, ...config } = shift.config;
      shift = { ...shift, config: { ...config, tutorial: 2, duration: config.duration + LESSON_EXTRA } };
    }
    $("week-dialog").close();
    hideMenu();
    crumb(
      "week",
      `shift ${shift.index + 1} · ${shift.day} · ${shift.pool} · step ${shift.step} · ${cardId} · tier ${shift.tier} · ` +
        `incidents ${shift.plan.incidents.join(",") || "none"}${shift.plan.surprise ? " · surprise " + shift.plan.surprise : ""} · pass ${shift.pass}` +
        (shift.rule !== "regular" ? " · rule " + shift.rule : "") +
        (save.week.perks.length ? " · build " + save.week.perks.join(",") : "") +
        (shift.gear ? " · gear " + shift.gear : "") +
        (shift.overtime ? " · OVERTIME" : "") +
        (shift.finale ? " · FINALE" : ""),
    );
    startShift(shift);
  }
  // A pool's intro cinematic plays the first time the pool comes in a run, not before every shift (the fun plan: "the reward's
  // feel"). The app asks when a week's shift starts; the answer is remembered until the run is over.
  function cinematicDue(pool) {
    if (!POOLS[pool] || save.shown.includes(pool)) return false;
    save.shown.push(pool);
    persist();
    return true;
  }

  // ---- the end of a shift ---------------------------------------------------------------------------------------------
  // The pick on the results: three perks, one to take (two out of the Date Fund, one with a catch for nothing), or none.
  function renderPick() {
    const w = save.week,
      offer = w ? pickOffer(save) : [];
    $("rw-pick").hidden = !offer.length && !dropFor;
    if (!w || (!offer.length && !dropFor)) return;
    const price = rerollPrice(chapterNow());
    if (dropFor) {
      // The build is full: which perk makes room for the new one?
      $("rw-pick-title").textContent =
        `YOUR BUILD IS FULL · WHICH ONE MAKES ROOM FOR ${upper(PERKS[dropFor].name)}?`;
      $("rw-pick-cards").innerHTML =
        w.perks
          .map(
            (id) =>
              `<button class="booking-card pick" data-drop="${id}"><span class="b-icon" aria-hidden="true">${PERKS[id].icon}</span><strong>${esc(PERKS[id].name)}</strong><span class="b-note">${esc(PERKS[id].text)}</span></button>`,
          )
          .join("") +
        `<button class="booking-card pick regular" data-drop=""><strong>Keep my build</strong></button>`;
    } else {
      $("rw-pick-title").textContent = "PICK ONE · IT STAYS FOR THE RUN";
      $("rw-pick-cards").innerHTML = offer
        .map((o) => {
          const p = PERKS[o.id],
            afford = w.fund >= o.price;
          return `<button class="booking-card pick${o.free ? " free" : ""}" data-pick="${o.id}" ${afford ? "" : "disabled"}><span class="b-icon" aria-hidden="true">${p.icon}</span><strong>${esc(p.name)}</strong><span class="b-pay">${o.free ? "FREE" : money(o.price)}</span><span class="b-note">${esc(p.text)}</span></button>`;
        })
        .join("");
    }
    $("rw-build").textContent = w.perks.length
      ? `Build ${w.perks.length}/${BUILD_SLOTS}: ${buildIcons(w.perks)}`
      : `Build 0/${BUILD_SLOTS}`;
    $("rw-build").title = w.perks.map((p) => PERKS[p].name + ": " + PERKS[p].text).join("\n");
    $("rw-reroll").hidden = !!dropFor;
    $("rw-reroll").disabled = w.fund < price;
    $("rw-reroll").textContent = `↻ Three others · ${money(price)}`;
  }
  function take(id, drop = null) {
    const w = save.week;
    if (!w) return;
    if (w.perks.length >= BUILD_SLOTS && !drop) {
      dropFor = id;
      return $("shop-dialog").open ? openGift() : renderPick();
    }
    const offer = pickOffer(save).find((o) => o.id === id);
    dropFor = null;
    if (!offer || !takePick(save, id, drop)) return renderPick();
    persist();
    crumb("week", "picked " + id + (drop ? " for " + drop : "") + " · -" + offer.price + " → " + w.fund);
    $("rw-pick-title").textContent = `✓ ${PERKS[id].icon} ${upper(PERKS[id].name)} · ${PERKS[id].text}`;
    $("rw-pick-cards").innerHTML = "";
    $("rw-build").textContent = `Build ${w.perks.length}/${BUILD_SLOTS}: ${buildIcons(w.perks)}`;
    $("rw-reroll").hidden = true;
    $("rw-pick").hidden = false;
    if (result) $("rw-money").textContent = money(w.fund) + " / " + money(result.goal);
    if (result && offer.price)
      fill($("rw-fill"), share(w.fund + offer.price, result.goal), share(w.fund, result.goal));
    // (the same pick in the gift's window)
    if ($("shop-dialog").open) {
      $("shop-dialog").close();
      toast(`${PERKS[id].icon} ${PERKS[id].name}: ${PERKS[id].text}`);
      openPicker();
    }
  }
  // Fills the week's part of the results and sets the buttons. Returns what happened.
  function finish(summary, stats) {
    if (!shift || !save.week) return null;
    const ch = chapterNow(),
      before = save.week.fund;
    dropFor = null;
    result = finishShift(save, shift, summary, stats);
    persist();
    crumb(
      "week",
      `shift ${shift.index + 1} done · ${result.passed ? "passed" : "FAILED"} · +${result.gained} → ${result.fund}/${result.goal}` +
        (result.won ? " · DATE" : result.over ? " · GAME OVER" : result.overtime ? " · OVERTIME" : "") +
        (result.carry ? " · carries " + result.carry : "") +
        (result.deluxeDate ? " · DELUXE" : "") +
        (result.newPool ? " · new pool " + result.newPool : "") +
        (result.challenges.length ? " · challenges " + result.challenges.join(",") : "") +
        (result.finds.length ? " · finds " + result.finds.join(",") : "") +
        (result.newGear.length ? " · new gear " + result.newGear.join(",") : ""),
    );
    const lines = [];
    if (result.passed)
      lines.push(`<li><span>Shift pay ${stars(result.stars)}</span><b>+${money(result.pay)}</b></li>`);
    for (const x of result.wishes)
      lines.push(
        `<li class="${x.met && !result.failed ? "" : "miss"}"><span>${x.met && !result.failed ? "💌" : "✗"} ${esc(x.text)}</span><b>${x.met && !result.failed ? "+" + money(x.pay) : ""}</b></li>`,
      );
    if (result.sponsor) lines.push(`<li><span>🤝 Sponsors</span><b>+${money(result.sponsor)}</b></li>`);
    if (result.vipTips) lines.push(`<li><span>🫙 VIP tips</span><b>+${money(result.vipTips)}</b></li>`);
    if (result.tips) lines.push(`<li><span>💵 Tips for the trouble</span><b>+${money(result.tips)}</b></li>`);
    if (result.golden) lines.push(`<li><span>✨ The golden guest</span><b>+${money(result.golden)}</b></li>`);
    if (result.inspector)
      lines.push(`<li><span>🕵️ A clean pool for the inspector</span><b>+${money(result.inspector)}</b></li>`);
    for (const id of result.newGear)
      lines.push(
        `<li class="unlock"><span>🔓 New gear in the locker: ${GEAR[id].icon} ${esc(GEAR[id].name)}</span><b>${save.stars}★</b></li>`,
      );
    for (const id of result.challenges) {
      const opens = challengeOpens(id)
        .map((o) => o.icon + " " + o.name)
        .join(", ");
      lines.push(
        `<li class="unlock"><span>🏆 ${esc(CHALLENGES[id].name)}: ${esc(CHALLENGES[id].text.toLowerCase())}${opens ? " · new in the game: " + esc(opens) : ""}</span><b>✓</b></li>`,
      );
    }
    for (const id of result.finds.filter((f) => !f.startsWith("perk:")))
      lines.push(
        `<li class="unlock"><span>📒 In the scrapbook: ${SCRAP[id].icon} ${esc(SCRAP[id].name)}</span><b>${save.scrap.length}/${SCRAP_IDS.length}</b></li>`,
      );
    $("rw-lines").innerHTML = lines.join("");
    const banner = $("rw-banner");
    banner.hidden = !(result.failed || result.won || result.over || result.overtime || result.unlocked);
    banner.classList.toggle("good", result.won || (!result.failed && !result.over && !result.overtime));
    banner.textContent = result.won
      ? `💖 ${result.wasOvertime ? "IN OVERTIME! " : ""}DATE FUND FULL! ${result.deluxeDate ? "A DELUXE " : ""}${upper(ch.date.name)} ON ${upper(DATE_DAY)}` +
        (result.newPool ? ` · 🔓 NEW POOL: ${upper(POOLS[result.newPool].name)}` : "")
      : result.overtime
        ? `SATURDAY NIGHT, ${money(result.goal - result.fund)} SHORT · MARINA WAITS FOR ONE LAST SHIFT ⏰`
        : result.over
          ? `${result.wasOvertime ? "OVERTIME" : "SATURDAY NIGHT"}, ${money(result.goal - result.fund)} SHORT · GAME OVER`
          : result.failed
            ? `NOT PASSED · ${Math.round(summary.score).toLocaleString()} OF ${result.pass.toLocaleString()} · NO PAY${result.insured ? " (THE SAFETY NET PAID HALF)" : ""}, BUT THE WEEK GOES ON`
            : `🔓 LEVEL ${result.unlocked} IS OPEN IN FREE PLAY`;
    $("rw-date").textContent = ch.date.icon;
    $("rw-money").textContent = money(result.fund) + " / " + money(result.goal);
    fill($("rw-fill"), share(before, result.goal), share(result.fund, result.goal));
    // Marina's texts come once each, on the way up (the picks can take the fund down again).
    const texts = textsPassed(result.peakBefore, result.fund, result.goal);
    $("rw-text").textContent = result.won
      ? (result.carry ? `${money(result.carry)} of what's over the goal starts next week's fund. ` : "") +
        (result.deluxeDate ? "A deluxe date 💎: Marina has a gift for you on Monday." : "")
      : texts.length
        ? `Marina: “${texts[texts.length - 1].text}”`
        : result.surprise && result.passed
          ? `New: ${INCIDENTS[result.surprise].icon} ${INCIDENTS[result.surprise].name}. It can turn up in any shift now.`
          : !result.last
            ? result.fund >= result.goal
              ? result.fund >= result.deluxe
                ? "A deluxe date 💎! Half of everything over the goal goes to next week."
                : `The date is paid for 💖 ${money(result.deluxe - result.fund)} more makes it deluxe 💎`
              : `${money(Math.max(0, result.goal - result.fund))} to go · ${SHIFTS_PER_WEEK - save.week.shift} shift${SHIFTS_PER_WEEK - save.week.shift > 1 ? "s" : ""} left before ${DATE_DAY}`
            : "";
    // How close the next star was: the reason to play the next one better.
    const near = result.passed && result.nextStar;
    $("rw-star").hidden = !near;
    if (near)
      $("rw-star").textContent =
        `${result.nextStar.short.toLocaleString()} short of ${"★".repeat(result.nextStar.stars)}`;
    renderPick();
    // Tomorrow's doors, under it: what is behind each.
    const doors = !result.last && save.week ? dayDoors(planned(save.week), save.known, save.seen) : [];
    $("rw-doors").hidden = !doors.length;
    if (doors.length)
      $("rw-doors").innerHTML =
        `<small>${upper(DAYS[save.week.shift])}</small>` +
        doors
          .map(
            (d) =>
              `<span>${POOLS[d.pool].icon} ${d.mystery ? "🎲 Mystery" : d.icon + " " + esc(d.name)} <b>×${d.payout}</b></span>`,
          )
          .join("");
    $("result-week").hidden = false;
    if (result.won) celebrate();
    return result;
  }
  // The results' main button, and its label.
  function nextLabel() {
    if (!result) return "";
    if (result.won) return `${DATE_DAY} with Marina 💖`;
    if (result.overtime) return "One last shift ⏰";
    if (result.over) return `${DATE_DAY}… 💌`;
    return `${save.week ? DAYS[save.week.shift] : "The next shift"} ▶`;
  }
  function next() {
    const r = result;
    result = null;
    shift = null;
    dropFor = null;
    if (!r) return returnMenu();
    if (r.over)
      return playScene(
        scene("raincheck", r.chapter, "short").panels,
        () => {
          returnMenu();
          toast(
            save.runs >= VETERAN_RUNS
              ? "Game over. Press START for a new run 🔁 You're a veteran now: no warm-up on Monday, and a perk on the house."
              : "Game over. Press START for a new run: week 1, Monday 🔁 What you opened in the locker stays yours.",
          );
        },
        "Back to the menu ▶",
      );
    if (r.won) {
      const pool = r.newPool && POOLS[r.newPool];
      return playScene(
        scene("date", r.chapter, {
          newPool: pool ? { icon: pool.icon, name: pool.name } : null,
          ending: r.ending,
          seasonDone: r.chapter.id === FINALE_WEEK && !r.ending,
        }).panels,
        () => {
          returnMenu();
          toast(
            r.chapter.id === FINALE_WEEK
              ? `The season is over! Week ${chapterNow().id}: endless, every week harder. The next date: ${chapterNow().date.name} ${chapterNow().date.icon}`
              : `Week ${chapterNow().id}: harder pools. The next date: ${chapterNow().date.name} ${chapterNow().date.icon}`,
          );
        },
        r.ending ? "Keep playing ▶" : undefined,
      );
    }
    // On to the next day's doors (a pick left on the table is passed up).
    if (save.week?.pick && !save.week.pick.gift) {
      skipPick(save);
      persist();
    }
    openPicker();
  }

  // ---- a gift: three perks for nothing, one to take (a veteran's Monday, Marina's after a deluxe date) -------------------
  function openGift() {
    const w = save.week;
    if (!w) return menu();
    const ch = chapterNow(),
      offer = pickOffer(save);
    $("shop-title").textContent =
      w.veteran && !w.history.length ? "A VETERAN'S MONDAY" : "A GIFT FROM MARINA";
    $("shop-count").textContent = `BEFORE ${upper(DAYS[w.shift])}'S SHIFT`;
    $("shop-note").textContent =
      w.veteran && !w.history.length
        ? "You know the job: no warm-up today. Take one, on the house. It stays for the whole run."
        : "For the deluxe date 💎 Take one. It stays for the whole run.";
    $("shop-date").textContent = ch.date.icon;
    $("shop-money").textContent = money(w.fund) + " / " + money(ch.goal);
    $("shop-fill").style.width = share(w.fund, ch.goal) + "%";
    $("shop-pace").textContent = "";
    $("shop-cards").innerHTML = dropFor
      ? w.perks
          .map(
            (id) =>
              `<button class="booking-card" data-drop="${id}"><span class="b-icon" aria-hidden="true">${PERKS[id].icon}</span><strong>${esc(PERKS[id].name)}</strong><span class="b-note">Makes room: ${esc(PERKS[id].text)}</span></button>`,
          )
          .join("")
      : offer
          .map((o) => {
            const p = PERKS[o.id];
            return `<button class="booking-card" data-pick="${o.id}"><span class="b-icon" aria-hidden="true">${p.icon}</span><strong>${esc(p.name)}</strong><span class="b-pay">FREE</span><span class="b-note">${esc(p.text)}</span></button>`;
          })
          .join("");
    $("shop-perks").textContent = w.perks.length
      ? `Build ${w.perks.length}/${BUILD_SLOTS}: ` +
        w.perks.map((p) => PERKS[p].icon + " " + PERKS[p].name).join(" · ")
      : "Your build is empty.";
    $("shop-reroll").hidden = true;
    $("shop-next").textContent = "No, thanks ▶";
    if (!$("shop-dialog").open) $("shop-dialog").showModal();
    $("shop-cards").firstElementChild?.focus();
  }
  function closeGift() {
    dropFor = null;
    skipPick(save);
    persist();
    $("shop-dialog").close();
    openPicker();
  }

  // ---- the coach's locker: what lasts across runs (Phase 2) ----------------------------------------------------------------
  function openLocker() {
    const open = openCount();
    $("locker-stars").textContent = `${save.stars}★ EARNED IN ALL RUNS`;
    // The pools: the ladder, opened by dates; each with its best stars.
    $("locker-pools-note").textContent =
      open < LADDER.length
        ? `${open} of ${LADDER.length} open. Every date with Marina opens the next one, for good.`
        : "Every pool is open. The Grand Gala Arena is the finale of week 4.";
    $("locker-pools").innerHTML = [...LADDER, FINALE_POOL]
      .map((id, i) => {
        const p = POOLS[id],
          finale = id === FINALE_POOL,
          isOpen = finale ? save.finale || save.seen.includes(id) : i < open,
          best = save.best[id];
        const note = finale
          ? isOpen
            ? stars(best || 0)
            : "WEEK 4 FINALE"
          : isOpen
            ? save.seen.includes(id)
              ? stars(best || 0)
              : "NEW"
            : i === open
              ? "NEXT DATE"
              : "🔒";
        return `<div class="locker-pool${isOpen ? "" : i === open && !finale ? " next" : " locked"}" title="${esc(p.name)}"><i aria-hidden="true">${isOpen || i === open ? p.icon : "❔"}</i>${esc(isOpen || i === open ? p.name : "A pool to open")}<b>${note}</b></div>`;
      })
      .join("");
    // The gear: kept for good once the stars reach its mark; the coach wears one piece.
    $("locker-gear").innerHTML = GEAR_IDS.map((id) => {
      const g = GEAR[id],
        have = save.stars >= g.stars,
        worn = save.gear === id;
      return `<button class="locker-item${worn ? " worn" : ""}" data-gear="${id}" ${have ? "" : "disabled"} aria-pressed="${worn}"><i aria-hidden="true">${have ? g.icon : "🔒"}</i><strong>${esc(have ? g.name : `At ${g.stars}★`)}</strong><span>${esc(have ? (worn ? "Worn · " : "") + g.text : `${g.stars - save.stars}★ to go: ${g.text.toLowerCase()}`)}</span></button>`;
    }).join("");
    // The album: every date ever had, to watch again; the story's ending once seen.
    const had = ALL_DATES.filter((d) => save.album.includes(d.id)).length;
    $("locker-album-note").textContent = had
      ? `${had} of ${ALL_DATES.length} dates. Pick one to watch it again.`
      : "Your dates with Marina will be kept here.";
    const items = ALL_DATES.map((d) => {
      const have = save.album.includes(d.id),
        ch = chapterOfDate(d.id),
        art = ART.date[d.id];
      const gold = have && save.gold.includes(d.id);
      return `<button class="locker-item${gold ? " gold" : ""}" data-date="${d.id}" ${have ? "" : "disabled"}>${have && art ? `<img src="${art}" alt="" loading="lazy">` : `<i aria-hidden="true">${have ? d.icon : "❔"}</i>`}<strong>${esc(have ? d.name : "Week " + ch.id + "'s date")}${gold ? " 💎" : ""}</strong><span>${have ? "▶ Watch again" : "Not yet"}</span></button>`;
    });
    if (save.finale)
      items.push(
        `<button class="locker-item" data-date="ending"><img src="${ART.date.ocean}" alt="" loading="lazy"><strong>The ending</strong><span>▶ Watch again</span></button>`,
      );
    $("locker-album").innerHTML = items.join("");
    // The challenges: counted over every run; each one done adds perks and day rules to the game.
    $("locker-challenges").innerHTML = CHALLENGE_IDS.map((id) => {
      const c = CHALLENGES[id],
        n = Math.min(c.goal, save.tally[id] || 0),
        done = save.done.includes(id),
        opens = challengeOpens(id)
          .map((o) => o.icon + " " + o.name)
          .join(", ");
      return `<div class="locker-item challenge${done ? " worn" : ""}"><i aria-hidden="true">${done ? "✅" : c.icon}</i><strong>${esc(c.name)}</strong><span>${esc(c.text)} · ${n}/${c.goal}</span><span class="ch-bar"><b style="width:${Math.round((n / c.goal) * 100)}%"></b></span><span>${done ? "In the game: " : "Adds: "}${esc(opens)}</span></div>`;
    }).join("");
    // The scrapbook: every day rule played, perk taken and crossover seen, with what is still to find left blank.
    $("locker-scrap-note").textContent =
      `${save.scrap.length} of ${SCRAP_IDS.length} found: day rules played, perks taken, and the things that only happen now and then.`;
    $("locker-scrap").innerHTML = SCRAP_IDS.map((id) => {
      const have = save.scrap.includes(id),
        e = SCRAP[id];
      return `<span class="scrap${have ? " have" : ""}" title="${have ? esc(e.name + ": " + e.text) : "Not found yet"}">${have ? e.icon : "?"}</span>`;
    }).join("");
    if (!$("locker-dialog").open) $("locker-dialog").showModal();
  }
  function wear(id) {
    if (!GEAR[id] || save.stars < GEAR[id].stars) return;
    save.gear = save.gear === id ? null : id;
    persist();
    crumb("week", "gear " + (save.gear || "off"));
    toast(save.gear ? `${GEAR[id].icon} ${GEAR[id].name}: ${GEAR[id].text}` : "No gear worn.");
    openLocker();
    menu();
  }
  function watchDate(id) {
    $("locker-dialog").close();
    if (id === "ending") return playScene(scene("ending").panels, openLocker, "Back to the locker ▶");
    const ch = chapterOfDate(id);
    if (!ch || !save.album.includes(id)) return openLocker();
    playScene(scene("date", ch).panels, openLocker, "Back to the locker ▶");
  }

  // ---- free play: the levels the run has opened, one at a time, on the map ----------------------------------------------
  let onFreePlay = () => {};
  function freePlay(on) {
    inFreePlay = !!on;
    $("week-card").hidden = inFreePlay;
    onFreePlay(inFreePlay);
  }

  // ---- what the HUD and the top bar show ----------------------------------------------------------------------------
  function hudTag(config) {
    const w = config?.week;
    if (!w) return null;
    return `WEEK ${w.chapter} · ${upper(DAYS[w.shift].slice(0, 3))} · ${w.shift + 1}/${SHIFTS_PER_WEEK}`;
  }
  function pill() {
    const ch = chapterNow();
    return { icon: ch.date.icon, now: save.week ? save.week.fund : 0, goal: ch.goal };
  }

  // ---- the buttons ----------------------------------------------------------------------------------------------------
  $("wk-go").onclick = go;
  $("wk-free").onclick = () => freePlay(true);
  $("wk-locker").onclick = openLocker;
  $("wd-cards").onclick = (e) => {
    const b = e.target.closest("[data-card]");
    if (b) pick(b.dataset.card);
  };
  // (a door under the mouse, or in focus, shows its own pass mark and wishes)
  const peek = (e) => {
    const b = e.target.closest?.("[data-door]");
    if (b) showDoor(options[Number(b.dataset.door)]);
  };
  $("wd-cards").addEventListener("pointerover", peek);
  $("wd-cards").addEventListener("focusin", peek);
  $("wd-heat").onclick = (e) => {
    const b = e.target.closest("[data-heat]");
    if (!b || !save.week) return;
    const on = save.week.heat.includes(b.dataset.heat);
    if (
      setHeat(
        save,
        on ? save.week.heat.filter((h) => h !== b.dataset.heat) : [...save.week.heat, b.dataset.heat],
      )
    ) {
      persist();
      crumb("week", "conditions " + (save.week.heat.join(",") || "none"));
      openPicker();
    }
  };
  $("rw-pick-cards").onclick = (e) => {
    const b = e.target.closest("[data-pick],[data-drop]");
    if (!b || b.disabled) return;
    if (b.dataset.pick) return take(b.dataset.pick);
    if (b.dataset.drop && dropFor) return take(dropFor, b.dataset.drop);
    dropFor = null;
    renderPick();
  };
  $("rw-reroll").onclick = () => {
    if (rerollPick(save)) {
      persist();
      crumb("week", "three others · fund " + save.week.fund);
      if (result) $("rw-money").textContent = money(save.week.fund) + " / " + money(result.goal);
      renderPick();
    }
  };
  $("wd-back").onclick = () => {
    $("week-dialog").close();
    returnMenu();
  };
  $("week-dialog").addEventListener("cancel", (e) => {
    e.preventDefault();
    $("week-dialog").close();
    returnMenu();
  });
  $("shop-cards").onclick = (e) => {
    const b = e.target.closest("[data-pick],[data-drop]");
    if (!b || b.disabled) return;
    if (b.dataset.pick) return take(b.dataset.pick);
    if (b.dataset.drop && dropFor) return take(dropFor, b.dataset.drop);
  };
  $("shop-next").onclick = closeGift;
  $("shop-dialog").addEventListener("cancel", (e) => {
    e.preventDefault();
    closeGift();
  });
  $("locker-gear").onclick = (e) => {
    const b = e.target.closest("[data-gear]");
    if (b && !b.disabled) wear(b.dataset.gear);
  };
  $("locker-album").onclick = (e) => {
    const b = e.target.closest("[data-date]");
    if (b && !b.disabled) watchDate(b.dataset.date);
  };
  $("locker-close").onclick = () => $("locker-dialog").close();

  // The results were left another way (Esc, Back to the menu): what the shift did is saved already.
  function dismiss() {
    result = null;
    shift = null;
  }
  // The player skipped the guided first shift's tips: never again.
  function skipTutorial() {
    if (shift?.config?.tutorial === 2) save.lesson2 = true;
    else save.tutorial = true;
    persist();
  }
  return {
    skipTutorial,
    dismiss,
    freePlay,
    set onFreePlay(fn) {
      onFreePlay = fn;
    },
    menu,
    hideMenu,
    go,
    finish,
    next,
    nextLabel,
    hudTag,
    pill,
    openPicker,
    openGift,
    openLocker,
    cinematicDue,
    get shift() {
      return shift;
    },
    get pending() {
      return !!result;
    },
    get save() {
      return save;
    },
    get card() {
      return pickedCard;
    },
  };
}
