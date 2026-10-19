// A very small cinematic player: a full-screen dialog that steps through panels (a painted backdrop, a few emoji
// layers, one caption). Click, Space, Enter or → for the next panel; Skip or Esc leaves at once; every panel but the
// last moves on by itself after its `hold` (milliseconds; 0 waits for the player). The art is placeholder data (see
// story.mjs), so it can be swapped without touching this player.

const esc = (text) =>
  String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// The stage for one panel: the backdrop class, then each layer absolutely placed by percent of the stage. A panel with an
// `img` (a still under dist/assets/story/, generated from the characters' own pictures) shows it instead of the emoji, with
// only the speech bubbles over it. A panel with a `video` (a file under dist/, see marina.mjs) plays it full screen on top;
// the still or the layers stay behind it as the fallback.
export function panelHtml(panel) {
  // A credits panel (the story's ending, marina.mjs): the cast rolls up the stage.
  if (Array.isArray(panel.credits))
    return `<div class="cine-scene bg-${esc(panel.bg || "night")}"><div class="cine-credits"><div class="cine-roll">${panel.credits
      .map((c) => `<p><b>${esc(c.role)}</b><span>${esc(c.name)}</span></p>`)
      .join("")}<p class="cine-thanks">Thanks for playing 💖</p></div></div></div>`;
  const art = panel.img
    ? `<img class="cine-art" src="${esc(panel.img)}" alt="" decoding="async">${layersHtml(panel, true)}`
    : layersHtml(panel);
  const video = panel.video
    ? `<video class="cine-video" src="${esc(panel.video)}" autoplay playsinline preload="auto"></video>`
    : "";
  return `<div class="cine-scene bg-${esc(panel.bg || "pool")}${panel.img ? " has-art" : ""}">${art}${video}</div>`;
}
function layersHtml(panel, bubblesOnly = false) {
  const layers = (panel.layers || [])
    .filter((l) => !bubblesOnly || l.b)
    .map((l) => {
      const at = `left:${+l.x || 0}%;top:${+l.y || 0}%`;
      if (l.b) return `<span class="cine-bubble" style="${at}">${esc(l.b)}</span>`;
      return `<span class="cine-layer ${l.a ? "a-" + esc(l.a) : ""}" style="${at};--s:${+l.s || 10}" aria-hidden="true">${esc(l.e)}</span>`;
    })
    .join("");
  return layers;
}

// Play `panels` in the dialog `el`. Returns { skip, next } (mostly for checks). `done(skipped)` runs once, after the
// dialog has closed.
export function playCinematic(el, panels, { done = () => {}, labels = {} } = {}) {
  const stage = el.querySelector(".cine-stage"),
    caption = el.querySelector(".cine-text"),
    dots = el.querySelector(".cine-dots"),
    nextButton = el.querySelector(".cine-next"),
    skipButton = el.querySelector(".cine-skip");
  let index = -1,
    timer = 0,
    finished = false;
  dots.innerHTML = panels.map(() => "<i></i>").join("");
  const show = (i) => {
    clearTimeout(timer);
    index = i;
    const panel = panels[i],
      last = i === panels.length - 1;
    stage.innerHTML = panelHtml(panel);
    caption.textContent = panel.text;
    // A video moves on by itself when it ends; one that cannot play is taken away and the drawn panel shows instead.
    const video = panel.video ? stage.querySelector?.("video") : null;
    if (video) {
      video.addEventListener("ended", () => index === i && next());
      video.addEventListener("error", () => video.remove());
      video.play?.()?.catch?.(() => {});
    }
    [...dots.children].forEach((d, n) => d.classList.toggle("on", n <= i));
    nextButton.textContent = last ? labels.last || "Let's go! ▶" : "Next ▶";
    skipButton.hidden = last;
    // Restart the caption's fade-in.
    caption.classList.remove("in");
    void caption.offsetWidth;
    caption.classList.add("in");
    if (!last && panel.hold > 0) timer = setTimeout(next, panel.hold);
  };
  function next() {
    if (finished) return;
    if (index >= panels.length - 1) return finish(false);
    show(index + 1);
  }
  function finish(skipped) {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    el.removeEventListener("click", onClick);
    el.removeEventListener("keydown", onKey, true);
    el.removeEventListener("keyup", onKeyUp, true);
    el.removeEventListener("cancel", onCancel);
    if (el.open) el.close();
    stage.innerHTML = "";
    done(skipped);
  }
  const onClick = (e) => {
    if (e.target.closest(".cine-skip")) finish(true);
    else next();
  };
  const onKey = (e) => {
    if (["Enter", " ", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      // Enter or Space on a focused button would also click it: the key alone moves on.
      next();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      finish(true);
    }
  };
  const onKeyUp = (e) => {
    if (e.key === " ") e.preventDefault(); // Space would click the focused button a second time
  };
  const onCancel = (e) => {
    e.preventDefault();
    finish(true);
  };
  el.addEventListener("click", onClick);
  el.addEventListener("keydown", onKey, true);
  el.addEventListener("keyup", onKeyUp, true);
  el.addEventListener("cancel", onCancel);
  if (!el.open) el.showModal();
  show(0);
  nextButton.focus();
  return {
    next,
    skip: () => finish(true),
    get index() {
      return index;
    },
  };
}
