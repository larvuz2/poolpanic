// The engine choice (27 October 2026, the creator: "a previous screen, choosing which one do we want to load, either the full
// game as it is right now with the three.js, or the new level with the new game engine for the web"). On the web site only,
// when its build put the Godot test at ./godot/ (GODOT_WEB, written by tools/fetch-godot-web.mjs): before the game starts, two
// cards, the game and the Godot test. Never in the desktop app, never with anything after the ? (?playtest, ?dev=1, ?bisect…
// go straight into the game) and never on a reload once this tab chose the game. app.mjs imports this first and waits for it.
import { GODOT_WEB } from "./godot-web.mjs";
import { BUILD } from "./version.mjs";

const CHOSEN = "pool-panic.engine"; // sessionStorage, this tab only: "three" once the game was chosen

export function shouldAsk({
  godot = GODOT_WEB,
  desktop = globalThis.desktop,
  search = "",
  reloaded = false,
  chosen = "",
} = {}) {
  if (!godot || desktop) return false;
  if (search && search !== "?") return false;
  return !(reloaded && chosen === "three");
}

function context() {
  let reloaded = false,
    chosen = "";
  try {
    reloaded = performance.getEntriesByType("navigation")[0]?.type === "reload";
    chosen = sessionStorage.getItem(CHOSEN) || "";
  } catch {}
  return { search: location.search, reloaded, chosen };
}

const CARDS = [
  {
    engine: "three",
    art: "assets/brand/pick-three.webp",
    tag: "The game · three.js",
    name: "Pool Panic",
    what: "Every pool, the week and its shifts, Marina, the story, co-op. The game as it is today.",
    go: "Play",
  },
  {
    engine: "godot",
    art: "assets/brand/pick-godot.webp",
    tag: "Godot test · one venue",
    name: "Harbourside Community Pool",
    what: "The Community Pool rebuilt in Godot: Coach Waters walks it, no menu and no shift yet. A look test, with a big first download. Needs a keyboard.",
    go: "Open",
  },
];

function ask() {
  return new Promise((resolve) => {
    globalThis.__boot && (globalThis.__boot.picking = true);
    const box = document.createElement("div");
    box.className = "engine-pick";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "Choose how to play");
    const built = [
      `Game ${BUILD.commit}`,
      `Godot test ${GODOT_WEB.commit}${GODOT_WEB.fresh ? "" : " (an older build)"}`,
    ];
    box.innerHTML = `
      <img class="ep-logo" src="assets/brand/logo.webp" alt="Pool Panic" width="640" height="371" />
      <p class="ep-eyebrow">Two ways in</p>
      <div class="ep-cards">${CARDS.map(
        (c, i) => `
        <button class="ep-card" data-engine="${c.engine}">
          <span class="ep-art" style="background-image:url(${c.art})"><kbd>${i + 1}</kbd></span>
          <span class="ep-body">
            <small class="ep-tag">${c.tag}</small>
            <b class="ep-name">${c.name}</b>
            <span class="ep-what">${c.what}</span>
            <span class="ep-go">${c.go} →</span>
          </span>
        </button>`,
      ).join("")}
      </div>
      <small class="ep-builds">${built.join(" · ")}</small>`;
    const choose = (engine) => {
      try {
        sessionStorage.setItem(CHOSEN, engine);
      } catch {}
      if (engine === "godot") {
        box.classList.add("leaving");
        location.href = "godot/";
        return;
      }
      removeEventListener("keydown", onKey);
      box.remove();
      globalThis.__boot && (globalThis.__boot.picking = false);
      resolve("three");
    };
    const onKey = (e) => {
      if (e.key === "1") choose("three");
      else if (e.key === "2") choose("godot");
    };
    box.addEventListener("click", (e) => {
      const card = e.target.closest?.(".ep-card");
      if (card) choose(card.dataset.engine);
    });
    addEventListener("keydown", onKey);
    document.body.append(box);
    box.querySelector(".ep-card")?.focus();
  });
}

if (typeof document !== "undefined" && shouldAsk({ ...context() })) await ask();
