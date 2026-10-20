// FREE PLAY on the menu (21 October 2026): a window like the coach's locker with every pool as a card (the ones the ladder has
// opened to play, the others locked), a difficulty, and PLAY. It replaced the cloud map of levels: the creator, "we see all of the
// venues that we can choose to play in". The shift itself is the week's builder at that pool and difficulty (week.mjs
// `freePlayShift`); its best score and stars per pool and difficulty are kept here (`FREE_KEY`, a save the desktop app keeps).
import {
  POOLS,
  FREE_LEVELS,
  freeLevel,
  freeLevelOpen,
  freePools,
  FINALE_POOL,
  FINALE_WEEK,
} from "./week.mjs";

export const FREE_KEY = "pool-panic.free.v1";
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const starsText = (n) => "★".repeat(n) + "☆".repeat(3 - n);

// The saved bests: { "pool:level": { score, stars } } and the last choice.
export function readFree(storage = globalThis.localStorage) {
  try {
    const data = JSON.parse(storage?.getItem(FREE_KEY) || "{}");
    return {
      bests: data && typeof data.bests === "object" && data.bests ? data.bests : {},
      last: data?.last && POOLS[data.last.pool] ? data.last : null,
    };
  } catch {
    return { bests: {}, last: null };
  }
}
export function writeFree(state, storage = globalThis.localStorage) {
  try {
    storage?.setItem(FREE_KEY, JSON.stringify(state));
  } catch {}
}
// A shift played: its best kept. Returns whether the score is a new best.
export function recordFree(state, pool, level, score, stars) {
  const key = pool + ":" + level,
    was = state.bests[key] || { score: 0, stars: 0 };
  state.bests[key] = { score: Math.max(was.score, Math.round(score)), stars: Math.max(was.stars, stars) };
  return score > was.score;
}
// The best stars of a pool across the difficulties.
const poolStars = (state, pool) =>
  Math.max(0, ...FREE_LEVELS.map((l) => state.bests[pool + ":" + l.id]?.stars || 0));

export function installFreePlay({ $, save, storage, onPlay }) {
  const state = readFree(storage);
  let chosen = state.last || { pool: "club", level: "easy" };

  function render() {
    const s = save() || {},
      pools = freePools(s),
      unlocked = s.unlocked || 1;
    if (!pools.find((p) => p.id === chosen.pool)?.open) chosen = { ...chosen, pool: "club" };
    if (!freeLevelOpen(chosen.level, unlocked)) chosen = { ...chosen, level: "easy" };
    const openCount = pools.filter((p) => p.open).length;
    $("fp-count").textContent = `${openCount} OF ${pools.length} POOLS OPEN`;
    $("fp-pools").innerHTML = pools
      .map(({ id, open }) => {
        const p = POOLS[id],
          on = id === chosen.pool,
          best = state.bests[id + ":" + chosen.level],
          note = !open
            ? id === FINALE_POOL
              ? `Week ${FINALE_WEEK} finale`
              : "Opens with a date"
            : best
              ? starsText(best.stars) + " · " + best.score.toLocaleString()
              : poolStars(state, id)
                ? starsText(poolStars(state, id))
                : "Not played yet";
        // (each card shows its pool as it is played: a shot of the game, assets/menu/pools/; the icon if it will not load)
        return `<button class="fp-card${on ? " on" : ""}${open ? "" : " locked"}" data-pool="${id}" ${open ? "" : "disabled"} aria-pressed="${on}"><img src="assets/menu/pools/${id}.webp" alt="" loading="lazy" onerror="this.remove()"><i aria-hidden="true">${open ? p.icon : "🔒"}</i><strong>${open ? "" : "🔒 "}${esc(p.name)}</strong><span>${esc(note)}</span></button>`;
      })
      .join("");
    $("fp-levels").innerHTML = FREE_LEVELS.map((l) => {
      const open = freeLevelOpen(l.id, unlocked),
        on = l.id === chosen.level;
      return `<button class="fp-diff${on ? " on" : ""}" data-level="${l.id}" ${open ? "" : "disabled"} aria-pressed="${on}" title="${open ? "Level " + l.tier : "Pass level " + l.tier + " in a run to open it"}">${open ? "" : "🔒 "}${l.name}</button>`;
    }).join("");
    $("fp-go").innerHTML = `Play · ${esc(POOLS[chosen.pool].name)} · ${freeLevel(chosen.level).name} ▶`;
  }
  function open() {
    render();
    if (!$("freeplay-dialog").open) $("freeplay-dialog").showModal();
    $("freeplay-dialog").focus();
  }
  $("fp-pools").onclick = (e) => {
    const b = e.target.closest("[data-pool]");
    if (!b || b.disabled) return;
    chosen = { ...chosen, pool: b.dataset.pool };
    render();
  };
  $("fp-levels").onclick = (e) => {
    const b = e.target.closest("[data-level]");
    if (!b || b.disabled) return;
    chosen = { ...chosen, level: b.dataset.level };
    render();
  };
  $("fp-go").onclick = () => {
    state.last = chosen;
    writeFree(state, storage);
    $("freeplay-dialog").close();
    onPlay(chosen.pool, chosen.level);
  };
  $("fp-close").onclick = () => $("freeplay-dialog").close();
  return {
    open,
    // The end of a free-play shift: its best kept; returns whether it is a new best.
    record(pool, level, score, stars) {
      const best = recordFree(state, pool, level, score, stars);
      writeFree(state, storage);
      return best;
    },
  };
}
