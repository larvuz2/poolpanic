// The week on screen (the rules are week.mjs): the card on the menu, the shift picker with Marina's wishes, the shop, the
// week's part of the results, and the coach's locker (what lasts across runs: the pools, the gear, the dates album). The app
// hands over what it owns (starting a shift, the cinematics, the toast, the log).
import {
  WEEK_KEY,
  DAYS,
  DATE_DAY,
  SHIFTS_PER_WEEK,
  PERKS,
  GEAR,
  GEAR_IDS,
  LADDER,
  FINALE_WEEK,
  FINALE_POOL,
  ALL_DATES,
  INCIDENTS,
  INCIDENT_ORDER,
  chapterFor,
  chapterOfDate,
  normalizeWeekSave,
  newWeek,
  buildShift,
  POOLS,
  weekPools,
  openPools,
  finishShift,
  outlook,
  shopOffer,
  perkPrice,
  rerollPrice,
  buyPerk,
  reroll,
  textsPassed,
  TUTORIAL_SECONDS,
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
}) {
  let save = load();
  let shift = null; // the shift being played (or picked)
  let result = null; // the last shift's result, until the player moves on
  let pickedCard = null;
  let inFreePlay = false; // the menu shows the level map (free play) instead of the week
  // `?pool=aquatic` (a test): every shift of the week at that pool.
  const forcedPool = POOLS[new URLSearchParams(globalThis.location?.search || "").get("pool")]
    ? new URLSearchParams(globalThis.location.search).get("pool")
    : null;
  const itinerary = (w) =>
    forcedPool
      ? Array(SHIFTS_PER_WEEK).fill(forcedPool)
      : w.pools || weekPools(w.chapter, w.seed, openPools(save.ladder, w.chapter));
  // The week as buildShift reads it: its pools, and the gear the coach wears now.
  const planned = (w) => ({ ...w, pools: itinerary(w), gear: save.gear });

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
    const pools = week ? itinerary(week) : null;
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
      ? `${DAYS[w.shift]} · shift ${w.shift + 1} of ${SHIFTS_PER_WEEK} · the date is on ${DATE_DAY}`
      : `Six shifts, Monday to Saturday. Save ${money(ch.goal)} for ${DATE_DAY}, or it's game over.`;
    $("wk-go").innerHTML = w ? "CONTINUE <span>▶</span>" : "START <span>▶</span>";
    $("wk-money").textContent = money(w ? w.fund : 0) + " / " + money(ch.goal);
    $("wk-fill").style.width = share(w ? w.fund : 0, ch.goal) + "%";
    $("wk-days").innerHTML = daysHtml(w);
    const met = INCIDENT_ORDER.filter((k) => save.known.includes(k));
    $("wk-note").textContent =
      `Pools open: ${openCount()} of ${LADDER.length} · ` +
      (save.dates.length ? "Dates this run: " + save.dates.length + " 💖 · " : "") +
      `Incidents met: ${met.map((k) => INCIDENTS[k].icon).join(" ") || "none yet"} (${met.length}/${INCIDENT_ORDER.length})`;
    $("wk-locker").textContent =
      `🏅 Coach's locker · ${save.stars}★${GEAR[save.gear] ? " · " + GEAR[save.gear].icon : ""}`;
    $("wk-free").textContent = `🗺️ Free play · ${save.unlocked} level${save.unlocked > 1 ? "s" : ""} open`;
  }
  function hideMenu() {
    $("week-card").hidden = true;
  }

  // ---- starting, and the picker before each shift --------------------------------------------------------------------
  function go() {
    if (save.week) return openPicker();
    const fresh = !save.invited?.includes(save.chapter);
    save.week = newWeek(save, Date.now());
    persist();
    crumb(
      "week",
      "week " + save.chapter + " starts · seed " + save.week.seed + " · pools " + save.week.pools.join(","),
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
  function openPicker() {
    const w = save.week;
    if (!w) return menu();
    const ch = chapterNow();
    shift = buildShift(planned(w), null, save.known, save.seen);
    const o = outlook(w);
    $("wd-title").textContent =
      "WEEK " +
      ch.id +
      " · " +
      upper(shift.day) +
      " · " +
      shift.icon +
      " " +
      upper(shift.place) +
      (shift.finale ? " · SEASON FINALE" : "");
    $("wd-count").textContent = `SHIFT ${w.shift + 1} OF ${SHIFTS_PER_WEEK}`;
    $("wd-date").textContent = ch.date.icon;
    $("wd-money").textContent = money(w.fund) + " / " + money(ch.goal);
    $("wd-fill").style.width = share(w.fund, ch.goal) + "%";
    $("wd-pace").textContent = o.reached
      ? "The date is paid for! Everything more is a bonus 💖"
      : `${money(o.need)} to go for ${ch.date.name.toLowerCase()} · about ${money(o.perShift)} a shift`;
    $("wd-pace").classList.toggle("behind", !o.onTrack);
    $("wd-days").innerHTML = daysHtml(w);
    $("wd-pass").textContent = "PASS: " + shift.pass.toLocaleString() + " POINTS";
    const gear = GEAR[shift.gear];
    $("wd-gear").hidden = !gear;
    $("wd-gear").textContent = gear ? gear.icon + " " + upper(gear.name) : "";
    $("wd-gear").title = gear ? gear.text : "";
    $("wd-perks").textContent = w.perks.map((p) => PERKS[p].icon).join("");
    $("wd-perks").title = w.perks.map((p) => PERKS[p].name).join(", ");
    $("wd-wishes").innerHTML = shift.wishes
      .map((x) => `<li><span>${x.icon} ${esc(x.text)}</span><b>+${money(x.pay)}</b></li>`)
      .join("");
    // A pool's first visit: its card (one rule, one action), and the shift is a little easier (week.mjs POOL_INTROS). The season
    // finale shows the arena's card every time.
    $("wd-intro").hidden = !shift.intro;
    if (shift.intro) {
      $("wd-intro-icon").textContent = shift.icon;
      $("wd-intro-name").textContent = shift.finale
        ? "THE SEASON FINALE · " + upper(shift.place)
        : "NEW POOL · " + upper(shift.place) + " · A LITTLE EASIER THE FIRST TIME";
      $("wd-intro-rule").textContent = shift.intro.rule;
      $("wd-intro-action").textContent = shift.intro.action;
    }
    // One card is not a choice (Monday and Tuesday, the finale): a plain start button instead of a gig to pick.
    const single = shift.cards.length === 1;
    $("wd-cards-note").hidden = single;
    $("wd-cards").innerHTML = single
      ? `<button class="primary wd-start" data-card="${shift.cards[0].id}">${shift.finale ? "Start the finale 🏆" : "Start the shift ▶"}</button>`
      : shift.cards
          .map(
            (c) =>
              `<button class="booking-card${c.id === "regular" ? " regular" : ""}" data-card="${c.id}"><span class="b-icon" aria-hidden="true">${c.icon}</span><strong>${esc(c.name)}</strong><span class="b-pay">×${c.payout}<small>PAY</small></span><span class="b-note">${esc(c.note)}</span><span class="b-danger" aria-label="danger ${c.danger} of 3">${"🔥".repeat(c.danger)}</span></button>`,
          )
          .join("");
    presence(`Week ${ch.id} · ${shift.day} · ${shift.place}`);
    $("week-dialog").showModal();
    $("wd-cards").firstElementChild?.focus();
  }
  function pick(cardId) {
    pickedCard = cardId;
    shift = buildShift(planned(save.week), cardId, save.known, save.seen);
    // The guided first shift (Phase 1, tutorial.mjs): the first shift of a player's first run teaches the job, a little longer
    // than the gentle minute. Played or skipped once, never again (`save.tutorial`, set by finishShift or by skipTutorial).
    if (!save.tutorial && shift.step === 0)
      shift = { ...shift, config: { ...shift.config, tutorial: true, duration: TUTORIAL_SECONDS } };
    $("week-dialog").close();
    hideMenu();
    crumb(
      "week",
      `shift ${shift.index + 1} · ${shift.day} · ${shift.pool} · step ${shift.step} · ${cardId} · tier ${shift.tier} · ` +
        `incidents ${shift.plan.incidents.join(",") || "none"}${shift.plan.surprise ? " · surprise " + shift.plan.surprise : ""} · pass ${shift.pass}` +
        (shift.gear ? " · gear " + shift.gear : "") +
        (shift.finale ? " · FINALE" : ""),
    );
    startShift(shift);
  }

  // ---- the end of a shift ---------------------------------------------------------------------------------------------
  // Fills the week's part of the results and sets the buttons. Returns what happened.
  function finish(summary, stats) {
    if (!shift || !save.week) return null;
    const ch = chapterNow(),
      before = save.week.fund;
    result = finishShift(save, shift, summary, stats);
    persist();
    crumb(
      "week",
      `shift ${shift.index + 1} done · ${result.passed ? "passed" : "FAILED"} · +${result.gained} → ${result.fund}/${result.goal}` +
        (result.won ? " · DATE" : result.over ? " · GAME OVER" : "") +
        (result.newPool ? " · new pool " + result.newPool : "") +
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
    for (const id of result.newGear)
      lines.push(
        `<li class="unlock"><span>🔓 New gear in the locker: ${GEAR[id].icon} ${esc(GEAR[id].name)}</span><b>${save.stars}★</b></li>`,
      );
    $("rw-lines").innerHTML = lines.join("");
    const banner = $("rw-banner");
    banner.hidden = !(result.failed || result.won || result.over || result.unlocked);
    banner.classList.toggle("good", result.won || (!result.failed && !result.over));
    banner.textContent = result.won
      ? `💖 DATE FUND FULL! ${upper(ch.date.name)} ON ${upper(DATE_DAY)}` +
        (result.newPool ? ` · 🔓 NEW POOL: ${upper(POOLS[result.newPool].name)}` : "")
      : result.over
        ? `SATURDAY NIGHT, ${money(result.goal - result.fund)} SHORT · GAME OVER`
        : result.failed
          ? `NOT PASSED · ${Math.round(summary.score).toLocaleString()} OF ${result.pass.toLocaleString()} · NO PAY${result.insured ? " (THE SAFETY NET PAID HALF)" : ""}, BUT THE WEEK GOES ON`
          : `🔓 LEVEL ${result.unlocked} IS OPEN IN FREE PLAY`;
    $("rw-date").textContent = ch.date.icon;
    $("rw-money").textContent = money(result.fund) + " / " + money(result.goal);
    fill($("rw-fill"), share(before, result.goal), share(result.fund, result.goal));
    // Marina's texts come once each, on the way up (the shop can take the fund down again).
    const texts = textsPassed(result.peakBefore, result.fund, result.goal);
    $("rw-text").textContent = texts.length
      ? `Marina: “${texts[texts.length - 1].text}”`
      : result.surprise && result.passed
        ? `New: ${INCIDENTS[result.surprise].icon} ${INCIDENTS[result.surprise].name}. It can turn up in any shift now.`
        : !result.last
          ? `${money(Math.max(0, result.goal - result.fund))} to go · ${SHIFTS_PER_WEEK - save.week.shift} shift${SHIFTS_PER_WEEK - save.week.shift > 1 ? "s" : ""} left before ${DATE_DAY}`
          : "";
    $("result-week").hidden = false;
    if (result.won) celebrate();
    return result;
  }
  // The results' main button, and its label.
  function nextLabel() {
    if (!result) return "";
    if (result.won) return `${DATE_DAY} with Marina 💖`;
    if (result.over) return `${DATE_DAY}… 💌`;
    return "To the shop 🛍️";
  }
  function next() {
    const r = result;
    result = null;
    shift = null;
    if (!r) return returnMenu();
    if (r.over)
      return playScene(
        scene("raincheck", r.chapter, "short").panels,
        () => {
          returnMenu();
          toast(
            "Game over. Press START for a new run: week 1, Monday 🔁 What you opened in the locker stays yours.",
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
    openShop();
  }

  // ---- the shop (one money: perks out of the Date Fund) ----------------------------------------------------------------
  function openShop() {
    const w = save.week;
    if (!w) return menu();
    const ch = chapterNow(),
      o = outlook(w),
      reroll$ = rerollPrice(ch);
    $("shop-count").textContent = `BEFORE ${upper(DAYS[w.shift])}'S SHIFT`;
    $("shop-date").textContent = ch.date.icon;
    $("shop-money").textContent = money(w.fund) + " / " + money(ch.goal);
    $("shop-fill").style.width = share(w.fund, ch.goal) + "%";
    $("shop-pace").textContent = o.reached
      ? "The date is paid for: spend what's over it freely 💖"
      : `${money(o.need)} to go · about ${money(o.perShift)} a shift for the ${o.left} shift${o.left > 1 ? "s" : ""} left`;
    $("shop-pace").classList.toggle("behind", !o.onTrack);
    const offer = shopOffer(w, w.rolls, save.known);
    $("shop-cards").innerHTML = offer.length
      ? offer
          .map((id) => {
            const p = PERKS[id],
              price = perkPrice(id, ch),
              afford = w.fund >= price;
            return `<button class="booking-card" data-perk="${id}" ${afford ? "" : "disabled"}><span class="b-icon" aria-hidden="true">${p.icon}</span><strong>${esc(p.name)}</strong><span class="b-pay">${money(price)}</span><span class="b-note">${esc(p.text)}</span><span class="b-note">${afford ? "Leaves " + money(w.fund - price) + " in the fund" : "Not enough in the fund"}</span></button>`;
          })
          .join("")
      : `<p class="booking-note">You own every perk this week. Big spender!</p>`;
    $("shop-perks").textContent = w.perks.length
      ? "This week: " + w.perks.map((p) => PERKS[p].icon + " " + PERKS[p].name).join(" · ")
      : "No perks yet this week.";
    $("shop-reroll").disabled = w.fund < reroll$ || !offer.length;
    $("shop-reroll").textContent = `🎲 New stock · ${money(reroll$)}`;
    if (!$("shop-dialog").open) $("shop-dialog").showModal();
    $("shop-next").focus();
  }
  function buy(id) {
    if (!save.week) return;
    const price = perkPrice(id, chapterNow());
    if (!buyPerk(save.week, id)) return;
    persist();
    crumb("week", "bought " + id + " · -" + price + " → " + save.week.fund);
    toast(`${PERKS[id].icon} ${PERKS[id].name}: ${PERKS[id].text} (−${money(price)} from the Date Fund)`);
    openShop();
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
      return `<button class="locker-item" data-date="${d.id}" ${have ? "" : "disabled"}>${have && art ? `<img src="${art}" alt="" loading="lazy">` : `<i aria-hidden="true">${have ? d.icon : "❔"}</i>`}<strong>${esc(have ? d.name : "Week " + ch.id + "'s date")}</strong><span>${have ? "▶ Watch again" : "Not yet"}</span></button>`;
    });
    if (save.finale)
      items.push(
        `<button class="locker-item" data-date="ending"><img src="${ART.date.ocean}" alt="" loading="lazy"><strong>The ending</strong><span>▶ Watch again</span></button>`,
      );
    $("locker-album").innerHTML = items.join("");
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
    const b = e.target.closest("[data-perk]");
    if (b && !b.disabled) buy(b.dataset.perk);
  };
  $("shop-reroll").onclick = () => {
    if (save.week && reroll(save.week)) {
      persist();
      crumb("week", "new stock · fund " + save.week.fund);
      openShop();
    }
  };
  $("shop-next").onclick = () => {
    $("shop-dialog").close();
    openPicker();
  };
  $("shop-dialog").addEventListener("cancel", (e) => {
    e.preventDefault();
    $("shop-dialog").close();
    openPicker();
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
    if (save.tutorial) return;
    save.tutorial = true;
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
    openShop,
    openLocker,
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
