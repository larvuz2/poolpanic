// The level map's picture and layout: pure strings and numbers, so they can be checked without a browser. Every act
// has four islands (three chunks and a finale) with ten level buttons and a drill badge on each chunk; in both the wide
// drawing and the tall phone drawing the buttons must never overlap at any size the map is drawn at, and the
// generated SVG must be well formed, with its own ids (both acts sit in one page).
import assert from "node:assert/strict";
import { LAYOUTS, LANDMARK_KEYS, layoutAct, actSvg, cloud, shade } from "./dist/map-art.mjs";
import { CAMPAIGN, shiftHighlights } from "./dist/campaign.mjs";
import { SHIFTS } from "./dist/sim.mjs";

// The size of a level button in px, as style.css sets it (--node), and the drill badge relative to it.
const nodePx = (scale) => Math.max(34, Math.min(52, scale * 56));
const DRILL_RATIO = 0.74;
const FINALE_RATIO = 1.32;
// The scales each drawing is used at: the wide one needs 560px of width (map.mjs falls back to the tall one below
// that); the tall one runs from a 320px phone (scale 0.615) up to its natural size.
const SCALES = { landscape: [560 / 1200, 1.6], portrait: [320 / 520, 1.0] };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

for (const orientation of ["landscape", "portrait"]) {
  const layout = layoutAct(orientation),
    [W, H] = layout.box,
    [lo, hi] = SCALES[orientation];
  assert.deepEqual(layout.box, LAYOUTS[orientation].box);
  assert.equal(layout.zones.length, 4, "Three chunks and a finale");
  assert.deepEqual(
    layout.zones.map((z) => z.nodes.length),
    [3, 3, 3, 1],
  );
  assert.equal(layout.zones[3].drill, null, "A finale has no drill");
  assert.ok(layout.zones.slice(0, 3).every((z) => z.drill));
  const nodes = layout.zones.flatMap((z) => z.nodes);
  assert.equal(nodes.length, 10, "Ten levels an act");
  // The route walks every level in order.
  assert.equal(layout.route.length, 9);
  layout.route.forEach((r, i) => {
    assert.deepEqual([r.from, r.to], [i, i + 1], "Route segment " + i + " joins consecutive levels");
    assert.match(r.d, /^M[\d.,-]+ [QC]/, "A path");
    assert.ok(!/NaN|undefined/.test(r.d));
  });
  // Everything lies inside the drawing, and the level buttons sit on their island's top.
  for (const [i, z] of layout.zones.entries()) {
    const { pad } = z;
    for (const p of [...z.nodes, z.drill, z.label].filter(Boolean)) {
      assert.ok(
        p.x > 8 && p.x < W - 8 && p.y > 8 && p.y < H - 8,
        `${orientation}: zone ${i} point in the box`,
      );
    }
    for (const n of z.nodes)
      assert.ok(
        ((n.x - pad.cx) / pad.rx) ** 2 + ((n.y - pad.cy) / pad.ry) ** 2 < 0.8,
        `${orientation}: zone ${i} level buttons stand on the island`,
      );
    if (z.drill)
      assert.ok(
        ((z.drill.x - pad.cx) / pad.rx) ** 2 + ((z.drill.y - pad.cy) / pad.ry) ** 2 < 1.05,
        `${orientation}: zone ${i} drill badge sits at the island's edge`,
      );
  }
  // Islands rise up the drawing in play order, and none covers another's buttons.
  for (let i = 1; i < 4; i++) assert.ok(layout.zones[i].pad.cy < layout.zones[i - 1].pad.cy);
  // No two buttons overlap, at the smallest and the largest scale the drawing is used at (and everything between).
  for (let scale = lo; scale <= hi + 1e-9; scale += (hi - lo) / 24) {
    const size = (kind) =>
      (nodePx(scale) * (kind === "finale" ? FINALE_RATIO : kind === "drill" ? DRILL_RATIO : 1)) / scale;
    const buttons = layout.zones.flatMap((z, zi) => [
      ...z.nodes.map((p) => ({ ...p, size: size(zi === 3 ? "finale" : "node") })),
      ...(z.drill ? [{ ...z.drill, size: size("drill") }] : []),
    ]);
    for (let a = 0; a < buttons.length; a++)
      for (let b = a + 1; b < buttons.length; b++)
        assert.ok(
          dist(buttons[a], buttons[b]) >= (buttons[a].size + buttons[b].size) / 2,
          `${orientation} at ${scale.toFixed(2)}×: buttons ${a} and ${b} do not overlap`,
        );
  }
}

// The picture: one drawing per act, built from the campaign the way map.mjs does.
const ids = new Set();
for (const act of CAMPAIGN)
  for (const orientation of ["landscape", "portrait"]) {
    const svg = actSvg(
      {
        id: act.id,
        theme: act.venue === "resort" ? "park" : "club",
        art: act.zones.map((z) => z.art),
        night: act.zones.map((z) => !!z.night),
      },
      orientation,
    );
    for (const z of act.zones)
      assert.ok(LANDMARK_KEYS.includes(z.art), `Act ${act.id}: landmark "${z.art}" exists`);
    assert.ok(!/NaN|undefined|Infinity/.test(svg), "No broken numbers in the drawing");
    // Well formed: every tag closes, attribute values are quoted, nothing stray.
    const stack = [];
    let tags = 0;
    for (const m of svg.matchAll(/<(\/?)([a-zA-Z][\w-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g)) {
      tags++;
      const [, closing, name, , selfClosing] = m;
      if (selfClosing) continue;
      if (closing) assert.equal(stack.pop(), name, "Tags nest properly");
      else stack.push(name);
    }
    assert.equal(stack.length, 0, "Every tag is closed");
    assert.equal(tags, (svg.match(/</g) || []).length, "Every < starts a tag");
    // Three drifting sky drawings behind one drawing of the islands.
    assert.equal((svg.match(/<svg /g) || []).length, 4);
    assert.equal((svg.match(/class="map-sky d[012]"/g) || []).length, 3);
    for (const [cls, n] of [
      ["zone-ground", 4],
      ["zone-art", 4],
      ["fog", 4],
      ["seg", 9],
    ])
      assert.equal(
        (svg.match(new RegExp(`class="${cls}"`, "g")) || []).length,
        n,
        `Act ${act.id}: ${n} × ${cls}`,
      );
    // Ids are unique within a drawing and never shared between acts (both are in one page), and every reference
    // points at something defined in the same drawing.
    const defined = [...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(defined).size, defined.length, "Ids are unique inside a drawing");
    if (orientation === "landscape")
      for (const id of defined) {
        assert.ok(!ids.has(id), `Id ${id} belongs to one act only`);
        ids.add(id);
      }
    for (const [, ref] of svg.matchAll(/url\(#([^)]+)\)/g))
      assert.ok(defined.includes(ref), `#${ref} is defined`);
    assert.equal((svg.match(/<svg /g) || []).length, (svg.match(/<\/svg>/g) || []).length);
  }
// Night chunks (Moonlight) get a moon.
assert.match(
  actSvg({
    id: 2,
    theme: "park",
    art: ["tower", "cabana", "sunset", "trophy"],
    night: [false, true, false, false],
  }),
  /#123a66/,
);
assert.doesNotMatch(actSvg({ id: 1, theme: "club", art: ["club", "deck", "stadium", "trophy"] }), /#123a66/);

// Colour helpers.
assert.equal(shade("#808080", 0), "#808080");
assert.equal(shade("#808080", 1), "#ffffff");
assert.equal(shade("#808080", -1), "#000000");
assert.match(cloud(200), /<ellipse/);

// The panel's icons: what each shift has in store, once each, in the order it can happen.
{
  const level = (n) => shiftHighlights(SHIFTS[n - 1]);
  assert.deepEqual(level(1), [], "The first shift has nothing in store");
  assert.deepEqual(
    level(2).map((h) => h.icon),
    ["🚌"],
    "Lunch rush: a crowd arrives",
  );
  assert.deepEqual(
    level(4).map((h) => h.icon),
    ["🐶", "😡"],
  );
  for (let n = 1; n <= SHIFTS.length; n++) {
    const list = level(n);
    assert.equal(new Set(list.map((h) => h.icon + h.label)).size, list.length, `Level ${n}: nothing repeats`);
    for (const h of list) assert.ok(h.icon && h.label, `Level ${n}: every icon has a label`);
  }
  assert.ok(
    level(12).some((h) => h.icon === "🤸"),
    "Splash Park has daredevils",
  );
  assert.ok(level(10).length >= 5, "The finale has a lot in store");
  // The cannonball incident is named for the man the level has (Carl on the even levels, the leopard man on the odd ones).
  const carlLabel = (n) => shiftHighlights(SHIFTS[n - 1], n).find((h) => h.icon === "💣")?.label;
  assert.equal(carlLabel(6), "Cannonball Carl");
  assert.equal(carlLabel(9), "Cannonball Leopard Man");
  assert.equal(
    level(9).find((h) => h.icon === "💣").label,
    "Cannonball Carl",
    "(Carl, when the level is not given)",
  );
}
console.log(
  "Map checks passed: two acts of ten levels drawn on four islands each, wide and tall; no two buttons overlap at any scale the map is drawn at; the SVG is well formed with per-act ids and a drifting sky; night chunks get a moon; and every shift previews what is in store.",
);
