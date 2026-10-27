// Exports the numbers the Godot test needs from the real game (dist/), so the two agree: the Community Pool's layout, the tuning of
// the coach and the chores, and one Free Play shift's guest list. Run from the repo root: `node godot/tools/export-data.mjs`
// (optionally a venue id, a difficulty and a seed: `node godot/tools/export-data.mjs club normal 7`). It writes godot/data/*.json.
// The JSON is the contract between the two games: re-run it when the JavaScript game changes, never edit the JSON by hand.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { VENUES, COACH_TUNING, RESCUE, ENTRY } from "../../dist/spatial.mjs";
import { PoolSimulation, SHIFTS, TYPES, STREAK_TIERS, STREAK_RISK } from "../../dist/sim.mjs";
import { HOLD_LIMIT } from "../../dist/chaos.mjs";
import { WET_TUNING } from "../../dist/incidents/wet.mjs";
import { freePlayShift } from "../../dist/week.mjs";

const [venueId = "club", level = "normal", seedArg = "7"] = process.argv.slice(2);
const seed = Number(seedArg);
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
mkdirSync(out, { recursive: true });
const round = (v) =>
  typeof v === "number"
    ? Math.round(v * 1000) / 1000
    : Array.isArray(v)
      ? v.map(round)
      : v && typeof v === "object"
        ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, round(x)]))
        : v;
const write = (name, data) => {
  writeFileSync(join(out, name), JSON.stringify(round(data), null, 1) + "\n");
  console.log("wrote godot/data/" + name);
};

const venue = VENUES[venueId] || Object.values(VENUES).find((v) => v.id === venueId);
if (!venue) throw new Error("no venue " + venueId);

// The plain data of the venue (its functions sampled below).
const plain = Object.fromEntries(Object.entries(venue).filter(([, v]) => typeof v !== "function"));

// Where the coach may stand: the deck's walkable cells, a row per z (north to south), a column per x, 0.25 m apart, for a coach of the
// game's radius (isDeck: the deck bounds, the pool, the blocks, the furniture). "1" walkable, "0" not.
const cell = 0.25,
  D = venue.deck,
  walk = [];
for (let z = D.minZ; z <= D.maxZ + 1e-6; z += cell) {
  let row = "";
  for (let x = D.minX; x <= D.maxX + 1e-6; x += cell) row += venue.isDeck(x, z, 9) ? "1" : "0";
  walk.push(row);
}

// The waiting rows: slot k on each side (side -1 and +1), as queuePosition gives them.
const queueSlots = {};
for (const side of [-1, 1])
  queueSlots[side] = Array.from({ length: 16 }, (_, k) => venue.queuePosition(side, k));

write(venueId + "-venue.json", {
  _about:
    "Exported from dist/spatial.mjs by godot/tools/export-data.mjs. Metres; y is up; the same axes as the three.js game (x across the lanes, z along them). Angles in radians: 0 faces +z, an angle a faces (sin a, 0, cos a).",
  ...plain,
  walkGrid: { cell, minX: D.minX, minZ: D.minZ, rows: walk },
  queueSlots,
  edgeSpots: venue.edgeSpots?.() ?? null,
});

// The coach, the rescue and the chores.
write("tuning.json", {
  _about: "Exported from dist/ by godot/tools/export-data.mjs (the file each block comes from is named).",
  coach: { from: "dist/spatial.mjs COACH_TUNING", ...COACH_TUNING },
  rescue: { from: "dist/spatial.mjs RESCUE", ...RESCUE },
  entry: { from: "dist/spatial.mjs ENTRY", ...ENTRY },
  wet: { from: "dist/incidents/wet.mjs WET_TUNING", ...WET_TUNING },
  types: { from: "dist/sim.mjs TYPES", ...TYPES },
  streak: { from: "dist/sim.mjs STREAK_TIERS, STREAK_RISK", tiers: STREAK_TIERS, risk: STREAK_RISK },
  holdLimit: { from: "dist/chaos.mjs HOLD_LIMIT", seconds: HOLD_LIMIT },
});

// One Free Play shift at this pool: its level's settings, its star targets and the guests as the real simulation schedules them.
const sh = freePlayShift(venueId, level, seed);
const sim = new PoolSimulation(sh.tier, seed, { config: sh.config });
write(venueId + "-shift.json", {
  _about: `Free Play, ${venueId}, ${level}, seed ${seed} (dist/week.mjs freePlayShift; dist/sim.mjs PoolSimulation). 'schedule' is every guest in arrival order: 'at' is seconds after the start.`,
  level: sh.tier,
  seed,
  levelSettings: SHIFTS[sh.tier - 1],
  config: sh.config,
  schedule: sim.schedule,
});
