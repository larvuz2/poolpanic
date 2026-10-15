// The week on screen (the rules are week.mjs): the card on the menu, the shift picker with Marina's wishes, the shop, and
// the week's part of the results. The app hands over what it owns (starting a shift, the cinematics, the toast, the log).
import {
  WEEK_KEY,
  DAYS,
  DATE_DAY,
  SHIFTS_PER_WEEK,
  PERKS,
  REROLL_PRICE,
  INCIDENTS,
  INCIDENT_ORDER,
  chapterFor,
  normalizeWeekSave,
  newWeek,
  buildShift,
  finishShift,
  outlook,
  shopOffer,
  buyPerk,
  reroll,
  textsPassed,
} from "./week.mjs";
import { scene, money } from "./marina.mjs";

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
    const days = DAYS.map((d, i) => {
      const h = week?.history[i],
        now = week && i === week.shift && !h,
        mark = h ? (h.passed === false ? "✗" : "★".repeat(h.stars) || "✓") : "";
      return `<div class="wk-day${now ? " today" : ""}"><span><i class="${h ? (h.passed === false ? "miss" : "done") : ""}${now ? " now" : ""}">${mark}</i></span>${upper(d.slice(0, 3))}</div>`;
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

  // ---- the menu's card ------------------------------------------------------------------------------------------------
  function menu() {
    const ch = chapterNow(),
      w = save.week;
    $("week-card").hidden = inFreePlay;
    $("wk-date-icon").textContent = ch.date.icon;
    $("wk-eyebrow").textContent =
      "WEEK " + ch.id + (save.bestWeek > 1 ? " · BEST: WEEK " + save.bestWeek : "");
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
      (save.dates.length ? "Dates this run: " + save.dates.length + " 💖 · " : "") +
      `Incidents met: ${met.map((k) => INCIDENTS[k].icon).join(" ") || "none yet"} (${met.length}/${INCIDENT_ORDER.length})`;
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
    crumb("week", "week " + save.chapter + " starts · seed " + save.week.seed);
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
    shift = buildShift(w, null, save.known);
    const o = outlook(w);
    $("wd-title").textContent = "WEEK " + ch.id + " · " + upper(shift.day);
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
    $("wd-tips").textContent = "🪙 " + w.tips + " TIPS";
    $("wd-perks").textContent = w.perks.map((p) => PERKS[p].icon).join("");
    $("wd-perks").title = w.perks.map((p) => PERKS[p].name).join(", ");
    $("wd-wishes").innerHTML = shift.wishes
      .map((x) => `<li><span>${x.icon} ${esc(x.text)}</span><b>+${money(x.pay)}</b></li>`)
      .join("");
    $("wd-cards").innerHTML = shift.cards
      .map(
        (c) =>
          `<button class="booking-card${c.id === "regular" ? " regular" : ""}" data-card="${c.id}"><span class="b-icon" aria-hidden="true">${c.icon}</span><strong>${esc(c.name)}</strong><span class="b-pay">×${c.payout}<small>PAY</small></span><span class="b-note">${esc(c.note)}</span><span class="b-danger" aria-label="danger ${c.danger} of 3">${"🔥".repeat(c.danger)}</span></button>`,
      )
      .join("");
    presence(`Week ${ch.id} · ${shift.day}`);
    $("week-dialog").showModal();
    $("wd-cards").firstElementChild?.focus();
  }
  function pick(cardId) {
    pickedCard = cardId;
    shift = buildShift(save.week, cardId, save.known);
    $("week-dialog").close();
    hideMenu();
    crumb(
      "week",
      `shift ${shift.index + 1} · ${shift.day} · step ${shift.step} · ${cardId} · tier ${shift.tier} · ` +
        `incidents ${shift.plan.incidents.join(",") || "none"}${shift.plan.surprise ? " · surprise " + shift.plan.surprise : ""} · pass ${shift.pass}`,
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
        (result.won ? " · DATE" : result.over ? " · GAME OVER" : ""),
    );
    const lines = [];
    if (result.passed)
      lines.push(`<li><span>Shift pay ${stars(result.stars)}</span><b>+${money(result.pay)}</b></li>`);
    for (const x of result.wishes)
      lines.push(
        `<li class="${x.met && !result.failed ? "" : "miss"}"><span>${x.met && !result.failed ? "💌" : "✗"} ${esc(x.text)}</span><b>${x.met && !result.failed ? "+" + money(x.pay) : ""}</b></li>`,
      );
    if (result.sponsor) lines.push(`<li><span>🤝 Sponsor</span><b>+${money(result.sponsor)}</b></li>`);
    if (result.tips) lines.push(`<li><span>🪙 Tips for the shop</span><b>+${result.tips}</b></li>`);
    $("rw-lines").innerHTML = lines.join("");
    const banner = $("rw-banner");
    banner.hidden = !(result.failed || result.won || result.over || result.unlocked);
    banner.classList.toggle("good", result.won || (!result.failed && !result.over));
    banner.textContent = result.won
      ? `💖 DATE FUND FULL! ${upper(ch.date.name)} ON ${upper(DATE_DAY)}`
      : result.over
        ? `SATURDAY NIGHT, ${money(result.goal - result.fund)} SHORT · GAME OVER`
        : result.failed
          ? `NOT PASSED · ${Math.round(summary.score).toLocaleString()} OF ${result.pass.toLocaleString()} · NO PAY${result.insured ? " (THE SAFETY NET PAID HALF)" : ""}, BUT THE WEEK GOES ON`
          : `🔓 LEVEL ${result.unlocked} IS OPEN IN FREE PLAY`;
    $("rw-date").textContent = ch.date.icon;
    $("rw-money").textContent = money(result.fund) + " / " + money(result.goal);
    fill($("rw-fill"), share(before, result.goal), share(result.fund, result.goal));
    const texts = textsPassed(before, result.fund, result.goal);
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
      return playScene(scene("raincheck", r.chapter, "short").panels, () => {
        returnMenu();
        toast("Game over. Press START for a new run: week 1, Monday 🔁");
      });
    if (r.won)
      return playScene(scene("date", r.chapter).panels, () => {
        returnMenu();
        toast(
          `Week ${chapterNow().id}: harder pools. The next date: ${chapterNow().date.name} ${chapterNow().date.icon}`,
        );
      });
    openShop();
  }

  // ---- the shop -------------------------------------------------------------------------------------------------------
  function openShop() {
    const w = save.week;
    if (!w) return menu();
    $("shop-tips").textContent = "🪙 " + w.tips + " TIPS";
    const offer = shopOffer(w, w.rolls);
    $("shop-cards").innerHTML = offer.length
      ? offer
          .map((id) => {
            const p = PERKS[id],
              afford = w.tips >= p.price;
            return `<button class="booking-card" data-perk="${id}" ${afford ? "" : "disabled"}><span class="b-icon" aria-hidden="true">${p.icon}</span><strong>${esc(p.name)}</strong><span class="b-pay">🪙 ${p.price}</span><span class="b-note">${esc(p.text)}</span></button>`;
          })
          .join("")
      : `<p class="booking-note">You own every perk this week. Big spender!</p>`;
    $("shop-perks").textContent = w.perks.length
      ? "This week: " + w.perks.map((p) => PERKS[p].icon + " " + PERKS[p].name).join(" · ")
      : "No perks yet this week.";
    $("shop-reroll").disabled = w.tips < REROLL_PRICE || !offer.length;
    $("shop-reroll").textContent = `🎲 New stock · 🪙 ${REROLL_PRICE}`;
    if (!$("shop-dialog").open) $("shop-dialog").showModal();
    $("shop-next").focus();
  }
  function buy(id) {
    if (!save.week || !buyPerk(save.week, id)) return;
    persist();
    crumb("week", "bought " + id);
    toast(`${PERKS[id].icon} ${PERKS[id].name}: ${PERKS[id].text}`);
    openShop();
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

  // The results were left another way (Esc, Back to the menu): what the shift did is saved already.
  function dismiss() {
    result = null;
    shift = null;
  }
  return {
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
