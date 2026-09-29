// The level map: the menu's way of choosing a shift. One isometric island per act (see map-art.mjs for the picture),
// with a real button for every level on top of it: the levels of a chunk sit on their platform with a small "1/3"
// progress row, a coach stands on the level you are up to, cleared levels turn yellow with their stars, a drill
// hangs beside each chunk, and clouds cover what is still locked or not built yet. When a chunk is cleared the
// clouds lift off the next one. All state comes from the campaign module; this file only draws it.
import { actSvg, layoutAct, LAYOUTS } from "./map-art.mjs";
import { CAMPAIGN, ACT_LENGTH, zoneStatus, levelState, drillStatus, currentLevel } from "./campaign.mjs";
import { starsFor, starsForDrill } from "./progression.mjs";

const two = (n) => String(n).padStart(2, "0");
const stars = (n) => "★".repeat(n) + "☆".repeat(3 - n);
const pct = (v, total) => ((v / total) * 100).toFixed(3) + "%";

const TROPHY = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v6a5 5 0 0 1-10 0z" fill="currentColor"/><path d="M7 5H3.5c0 3 1.4 5 3.6 5.3M17 5h3.5c0 3-1.4 5-3.6 5.3" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="10.6" y="13" width="2.8" height="4" fill="currentColor"/><rect x="7.5" y="17" width="9" height="3" rx="1.2" fill="currentColor"/></svg>`;
const LOCK = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2.4" fill="currentColor"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>`;
const COACH = `<svg viewBox="0 0 30 40" aria-hidden="true"><ellipse cx="15" cy="37" rx="10" ry="2.8" fill="#062832" opacity=".3"/><rect x="7" y="18" width="16" height="17" rx="6.5" fill="#ffdc52" stroke="#103b48" stroke-width="2.2"/><rect x="13" y="20" width="4" height="12" rx="2" fill="#173f4f"/><circle cx="15" cy="12" r="8" fill="#f2c9a0" stroke="#103b48" stroke-width="2.2"/><path d="M7 11.5A8 8 0 0 1 23 11.5Z" fill="#173f4f"/><rect x="14" y="2.4" width="13" height="3.6" rx="1.8" fill="#173f4f" transform="rotate(8 14 4)"/></svg>`;

export class LevelMap {
  // `handlers`: { onLevel(n), onDrill(id), onStart(), onAct(n) }. Choosing the shift that is already selected starts it.
  constructor(root, handlers = {}) {
    this.root = root;
    this.h = handlers;
    this.act = 1;
    this.portrait = null;
    this.state = null;
    this.revealTimers = new Set();
    root.innerHTML = '<div class="map-scroll"></div><nav class="map-acts" aria-label="Acts"></nav>';
    this.scroll = root.querySelector(".map-scroll");
    this.tabs = root.querySelector(".map-acts");
    this.tabs.innerHTML = CAMPAIGN.map(
      (a) => `<button data-act="${a.id}"><b>ACT ${a.id}</b><small>${a.name}</small><i></i></button>`,
    ).join("");
    this.tabs.onclick = (e) => {
      const b = e.target.closest("button[data-act]");
      if (b) this.showAct(Number(b.dataset.act), true);
    };
    this.scroll.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b || b.disabled) return;
      if (b.classList.contains("selected")) this.h.onStart?.();
      else if (b.dataset.level) this.h.onLevel?.(Number(b.dataset.level));
      else if (b.dataset.drill) this.h.onDrill?.(b.dataset.drill);
    });
    // Arrow keys walk the route.
    this.scroll.addEventListener("keydown", (e) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step || !e.target.matches?.(".node, .drill")) return;
      const list = [
          ...this.scroll.querySelectorAll(".map-stage:not([hidden]) :is(.node, .drill):not(:disabled)"),
        ],
        at = list.indexOf(e.target);
      if (at < 0) return;
      e.preventDefault();
      list[Math.max(0, Math.min(list.length - 1, at + step))].focus();
    });
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => this.layout()).observe(this.scroll);
  }

  // ------------------------------------------------------------------------------------------------------------
  // Structure: one stage (the picture plus its buttons and labels) per act, rebuilt when the orientation flips.
  build() {
    const orientation = this.portrait ? "portrait" : "landscape",
      layout = layoutAct(orientation),
      [W, H] = layout.box;
    // A fresh drawing shows its state at once: no clouds lifting or coach walking on page load or a rotation.
    this.root.classList.add("instant");
    requestAnimationFrame(() => requestAnimationFrame(() => this.root.classList.remove("instant")));
    this.scroll.replaceChildren();
    this.stages = CAMPAIGN.map((act) => {
      const stage = document.createElement("div");
      stage.className = "map-stage";
      stage.dataset.act = act.id;
      stage.innerHTML =
        actSvg(
          {
            id: act.id,
            theme: act.venue === "resort" ? "park" : "club",
            art: act.zones.map((z) => z.art),
            night: act.zones.map((z) => !!z.night),
          },
          orientation,
        ) +
        '<div class="here-glow" hidden></div><div class="map-labels"></div><div class="map-nodes"></div><div class="map-marker" hidden></div>';
      const labels = stage.querySelector(".map-labels"),
        nodes = stage.querySelector(".map-nodes");
      const at = (p) => `left:${pct(p.x, W)};top:${pct(p.y, H)}`;
      act.zones.forEach((zone, zi) => {
        const spot = layout.zones[zi];
        labels.insertAdjacentHTML(
          "beforeend",
          `<div class="zone-label" data-zone="${zi}" style="${at(spot.label)}"><b>${zone.name.toUpperCase()}</b><span class="pips">${zone.nodes.map(() => "<i></i>").join("")}</span></div>`,
        );
        zone.nodes.forEach((node, ni) => {
          nodes.insertAdjacentHTML(
            "beforeend",
            `<button class="node${zone.kind === "finale" ? " finale" : ""}" data-level="${node.level}" data-zone="${zi}" data-index="${ni}" style="${at(spot.nodes[ni])}"><span class="num">${two(node.level)}</span><span class="glyph">${zone.kind === "finale" ? TROPHY : ""}</span><span class="lock">${LOCK}</span><span class="stars"></span></button>`,
          );
        });
        if (zone.drill)
          nodes.insertAdjacentHTML(
            "beforeend",
            `<button class="drill" data-drill="${zone.drill.id}" data-zone="${zi}" style="${at(spot.drill)}"><span class="icon">${zone.drill.icon}</span><span class="lock">${LOCK}</span></button>`,
          );
      });
      this.scroll.appendChild(stage);
      return stage;
    });
    this.W = W;
    this.H = H;
    this.layoutData = layout;
  }

  // Fit the stage: the whole island on a wide screen, the full height (scrolling) on a phone.
  layout() {
    const box = this.scroll.getBoundingClientRect();
    if (!box.width || !box.height) return;
    // The wide island needs room: on a phone, a tall window or a short one, the tall scrolling drawing is used.
    const [wide, high] = LAYOUTS.landscape.box,
      portrait = box.width <= 640 || box.width / box.height < 1.1 || (box.height * wide) / high < 560;
    if (portrait !== this.portrait) {
      this.portrait = portrait;
      this.build();
      if (this.state) this.update(this.state, { keepAct: true });
    }
    const width = portrait ? Math.min(box.width, 520) : Math.min(box.width, (box.height * this.W) / this.H),
      height = (width * this.H) / this.W;
    for (const stage of this.stages) {
      stage.style.width = width + "px";
      stage.style.height = height + "px";
    }
    this.root.style.setProperty("--map-scale", (width / this.W).toFixed(4));
    this.root.classList.toggle("portrait", portrait);
  }

  showAct(n, announce = false) {
    this.act = n;
    this.stages?.forEach((s) => {
      const on = Number(s.dataset.act) === n,
        was = !s.hidden;
      s.hidden = !on;
      if (on && !was) {
        s.classList.remove("enter");
        void s.offsetWidth;
        s.classList.add("enter");
      }
    });
    this.root.dataset.act = String(n);
    this.tabs.querySelectorAll("button").forEach((b) => {
      const on = Number(b.dataset.act) === n;
      b.setAttribute("aria-current", String(on));
    });
    if (announce) this.h.onAct?.(n);
    this.centerOn(this.state?.selected);
  }

  // Bring a level (or the coach) into view on a phone, where the map scrolls.
  centerOn(selected) {
    if (!this.portrait) return;
    const stage = this.stages.find((s) => Number(s.dataset.act) === this.act),
      target =
        (selected?.kind === "level" && stage.querySelector(`.node[data-level="${selected.level}"]`)) ||
        stage.querySelector(".node.current");
    if (!target || stage.hidden) return;
    const top = stage.offsetTop + target.offsetTop - this.scroll.clientHeight * 0.55;
    this.scroll.scrollTo({ top: Math.max(0, top), behavior: "auto" });
  }

  // ------------------------------------------------------------------------------------------------------------
  // State. `records` and `flags` come from progression; `selected` is { kind: "level", level } or
  // { kind: "drill", id }; `reveal` lists zone orders to celebrate (a chunk was just cleared).
  update(state, { keepAct = false } = {}) {
    this.state = state;
    const { records, flags, selected, reveal = [] } = state,
      here = currentLevel(records);
    this.root.toggleAttribute("data-testing", !!flags.unlockAll); // every level is open for playtesting
    if (this.portrait === null) this.layout();
    if (!this.stages) return;
    if (reveal.length) {
      // Something just woke up: show the act it is in.
      this.act = CAMPAIGN.find((a) => a.zones.some((z) => z.order === reveal[0]))?.id || this.act;
      this.actChosen = true;
    } else if (!keepAct && !this.actChosen) {
      // First time on the map: open the act the coach is in.
      this.act = CAMPAIGN.find((a) => a.zones.some((z) => z.nodes.some((n) => n.level === here)))?.id || 1;
      this.actChosen = true;
    }
    CAMPAIGN.forEach((act, ai) => {
      const stage = this.stages[ai],
        layout = this.layoutData;
      act.zones.forEach((zone, zi) => {
        const status = zoneStatus(records, zone, flags),
          unbuilt = status.built === 0,
          fogged = unbuilt || !status.open,
          label = stage.querySelector(`.zone-label[data-zone="${zi}"]`);
        stage.querySelector(`.fog[data-zone="${zi}"]`)?.classList.toggle("lifted", !fogged);
        label.classList.toggle("done", status.complete);
        label.classList.toggle("dim", fogged);
        label.classList.toggle("soon", unbuilt);
        label.querySelector("b").textContent = unbuilt ? "SOON" : zone.name.toUpperCase();
        label.querySelectorAll(".pips i").forEach((pip, k) => pip.classList.toggle("on", k < status.cleared));
        label.setAttribute(
          "aria-label",
          unbuilt ? "Coming soon" : `${zone.name}: ${status.cleared} of ${status.total} cleared`,
        );
        zone.nodes.forEach((node) => {
          const el = stage.querySelector(`.node[data-level="${node.level}"]`),
            st = levelState(records, node, flags),
            earned = node.built ? starsFor(node.level, records.bests[node.level - 1] || 0) : 0;
          el.className = `node ${st}${zone.kind === "finale" ? " finale" : ""}${selected?.kind === "level" && selected.level === node.level ? " selected" : ""}`;
          el.disabled = st === "locked" || st === "soon";
          el.setAttribute("aria-current", st === "current" ? "step" : "false");
          el.setAttribute("aria-pressed", String(el.classList.contains("selected")));
          el.setAttribute(
            "aria-label",
            st === "soon"
              ? `Level ${node.level}, coming soon`
              : `Level ${node.level}, ${node.name}${st === "locked" ? ", locked" : earned ? `, ${earned} stars` : ""}${node.twist ? ", mid-shift twist" : ""}`,
          );
          el.querySelector(".stars").textContent = st === "cleared" || earned ? stars(earned) : "";
        });
        if (zone.drill) {
          const el = stage.querySelector(`.drill[data-drill="${zone.drill.id}"]`),
            d = drillStatus(records, zone, flags),
            got = starsForDrill(zone.drill.id, d.best);
          el.className = `drill ${d.unlocked ? (d.best ? "done" : "open") : "locked"}${selected?.kind === "drill" && selected.id === zone.drill.id ? " selected" : ""}${fogged ? " dim" : ""}`;
          el.disabled = !d.unlocked;
          el.setAttribute(
            "aria-label",
            `Drill: ${zone.drill.name}${d.unlocked ? (d.best ? `, ${got} stars` : "") : `, locked: earn ${d.need} stars in ${zone.name} (${d.have} so far)`}`,
          );
          el.title = zone.drill.name;
        }
      });
      // The route glows yellow behind cleared levels.
      const all = act.zones.flatMap((z) => z.nodes);
      stage.querySelectorAll(".seg").forEach((seg, k) => {
        const route = layout.route[k],
          from = all[route.from],
          to = all[route.to];
        seg.classList.toggle(
          "done",
          from.built && to.built && levelState(records, from, flags) === "cleared",
        );
        seg.classList.toggle("ahead", !from.built || !to.built);
      });
      // The coach stands on the level you are up to, and its island wears a soft glow.
      const marker = stage.querySelector(".map-marker"),
        node = stage.querySelector(`.node[data-level="${here}"]`),
        glow = stage.querySelector(".here-glow"),
        hereZone = act.zones.findIndex((z) => z.nodes.some((n) => n.level === here));
      marker.hidden = !node;
      if (node) {
        marker.innerHTML = COACH;
        marker.style.left = node.style.left;
        marker.style.top = node.style.top;
      }
      glow.hidden = hereZone < 0;
      if (hereZone >= 0) {
        const { pad } = layout.zones[hereZone];
        glow.style.left = pct(pad.cx, this.W);
        glow.style.top = pct(pad.cy + pad.depth * 0.5, this.H);
        glow.style.width = pct(pad.rx * 2.8, this.W);
        glow.style.height = pct((pad.ry + pad.depth) * 2.7, this.H);
      }
    });
    // Each act tab carries a thin bar: how many of its ten levels are cleared.
    this.tabs.querySelectorAll("button").forEach((b, ai) => {
      const done = CAMPAIGN[ai].zones.reduce((sum, z) => sum + zoneStatus(records, z, flags).cleared, 0);
      b.style.setProperty("--p", (done / ACT_LENGTH).toFixed(3));
      b.setAttribute(
        "aria-label",
        `Act ${CAMPAIGN[ai].id}, ${CAMPAIGN[ai].name}: ${done} of ${ACT_LENGTH} cleared`,
      );
    });
    this.showAct(this.act);
    this.layout();
    this.celebrate(reveal);
  }

  // A chunk was just cleared: its neighbour wakes up (the clouds lift by themselves through the `lifted` class).
  celebrate(zoneOrders) {
    if (!zoneOrders.length) return;
    for (const order of zoneOrders) {
      const act = CAMPAIGN.find((a) => a.zones.some((z) => z.order === order)),
        ai = CAMPAIGN.indexOf(act),
        zi = act.zones.findIndex((z) => z.order === order),
        stage = this.stages[ai];
      const els = stage.querySelectorAll(`[data-zone="${zi}"]`);
      // Wait for the map to fade in and the clouds to lift, then pop the area's pieces in one after another.
      els.forEach((el, k) => {
        el.style.setProperty("--pop", `${500 + k * 90}ms`);
        el.classList.add("reveal");
      });
      const timer = setTimeout(() => {
        els.forEach((el) => el.classList.remove("reveal"));
        this.revealTimers.delete(timer);
      }, 3400);
      this.revealTimers.add(timer);
    }
  }
}
