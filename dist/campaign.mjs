// The campaign: how the shifts are grouped. A CHUNK is three levels in one place, so a player always knows the next
// new experience is at most three shifts away. An ACT is three chunks plus a finale (ten levels). Only the layout
// lives here (pure data and pure functions of the saved records, no DOM); the level map draws it.
//
// Level numbers never move: saved records are keyed by level number. Acts and chunks are a view over the season.
// Slots the season has not built yet stay on the map as "soon" so the shape of the whole campaign is visible.
import { SHIFTS } from "./sim.mjs";
import { drillForChunk } from "./drills.mjs";
import { TWISTS } from "./incidents/twist.mjs";
import { isUnlocked, starsFor, progressFlags } from "./progression.mjs";

export const ACT_LENGTH = 10;
export const CHUNK_LENGTH = 3;
export const DRILL_STARS = 5; // stars earned in a chunk before its drill opens

const ACT_DEFS = [
  { id: 1, name: "Community Pools", venue: "club", finale: "Pool legend" },
  { id: 2, name: "Splash Park", venue: "resort", finale: "Grand gala" },
];
// Names are for the map's small labels; `art` picks the landmark drawn on the chunk's platform.
const CHUNK_DEFS = [
  { name: "Warm-up", art: "club" },
  { name: "Mischief", art: "deck" },
  { name: "Showtime", art: "stadium" },
  { name: "Trampoline", art: "tower" },
  { name: "Moonlight", art: "cabana", night: true },
  { name: "Sunset", art: "sunset" },
];

// The zones of the campaign in play order: chunks of three levels, then each act's one-level finale.
export function buildCampaign(built = SHIFTS.length) {
  const node = (level, slot) => ({
    level,
    slot, // "learn" | "twist" | "rush" | "finale": the job the level is designed for (see the README)
    built: level <= built,
    name: level <= built ? SHIFTS[level - 1].name : null,
    venue: level <= built ? SHIFTS[level - 1].venue || "club" : null,
    twist: level <= built && !!SHIFTS[level - 1].twist,
  });
  let order = 0;
  return ACT_DEFS.map((act, a) => {
    const first = a * ACT_LENGTH + 1,
      chunks = [0, 1, 2].map((c) => {
        const id = a * 3 + c + 1;
        return {
          id,
          act: act.id,
          index: c + 1,
          order: order++,
          kind: "chunk",
          ...CHUNK_DEFS[id - 1],
          nodes: [0, 1, 2].map((k) => node(first + c * CHUNK_LENGTH + k, ["learn", "twist", "rush"][k])),
          drill: drillForChunk(id),
        };
      }),
      finale = {
        id: 100 + act.id,
        act: act.id,
        index: 4,
        order: order++,
        kind: "finale",
        name: act.finale,
        art: "trophy",
        nodes: [node(first + ACT_LENGTH - 1, "finale")],
        drill: null,
      };
    return { ...act, first, zones: [...chunks, finale] };
  });
}
export const CAMPAIGN = buildCampaign();
export const ZONES = CAMPAIGN.flatMap((a) => a.zones);
export const zoneOfLevel = (level) => ZONES.find((z) => z.nodes.some((n) => n.level === level)) || null;

const cleared = (records, level) =>
  level <= SHIFTS.length && starsFor(level, records.bests[level - 1] || 0) > 0;

// Progress through one zone: how many of its levels are cleared, stars earned, whether it can be entered, and
// whether it has been reached by real progress (the zone before it is complete, whatever the unlock switch says).
export function zoneStatus(records, zone, flags = progressFlags) {
  const built = zone.nodes.filter((n) => n.built),
    done = built.filter((n) => cleared(records, n.level)),
    stars = built.reduce((sum, n) => sum + starsFor(n.level, records.bests[n.level - 1] || 0), 0),
    previous = ZONES[zone.order - 1],
    complete = built.length === zone.nodes.length && done.length === zone.nodes.length;
  return {
    total: zone.nodes.length,
    built: built.length,
    cleared: done.length,
    stars,
    complete,
    open: built.length > 0 && isUnlocked(records, built[0].level, flags.unlockAll),
    reached: !previous || zoneStatus(records, previous, flags).complete,
  };
}

// "You are here": the first built level not yet cleared, or the last built level when everything is.
export function currentLevel(records) {
  for (let n = 1; n <= SHIFTS.length; n++) if (!cleared(records, n)) return n;
  return SHIFTS.length;
}

// One level's state on the map.
export function levelState(records, node, flags = progressFlags) {
  if (!node.built) return "soon";
  if (!isUnlocked(records, node.level, flags.unlockAll)) return "locked";
  if (cleared(records, node.level)) return "cleared";
  return node.level === currentLevel(records) ? "current" : "open";
}

// A chunk's drill: open once the chunk is cleared with enough stars (or while everything is open for testing).
export function drillStatus(records, zone, flags = progressFlags) {
  const drill = zone.drill;
  if (!drill) return null;
  const status = zoneStatus(records, zone, flags);
  return {
    drill,
    unlocked: flags.unlockAll || (status.complete && status.stars >= DRILL_STARS),
    best: records.drills?.[drill.id] || 0,
    need: DRILL_STARS,
    have: status.stars,
  };
}

export const totalStars = (records) =>
  SHIFTS.reduce((sum, _, i) => sum + starsFor(i + 1, records.bests[i] || 0), 0);

// What a shift has in store, as small icons for the map's selection panel: the incidents it can throw at you, the
// mid-shift twist, and the daredevils. Icons repeat nothing, in the order they can happen.
const INCIDENT_ICONS = {
  fish: { icon: "🐟", label: "Fish Kid" },
  dog: { icon: "🐶", label: "Loose Dog" },
  carl: { icon: "💣", label: "Cannonball Carl" },
  outage: { icon: "⚡", label: "Power outage" },
};
const TWIST_LABELS = {
  rush: "A crowd arrives",
  closure: "A lane closes",
  team: "A swim team arrives",
  class: "An aqua class arrives",
};
export function shiftHighlights(config) {
  const seen = new Set(),
    list = [];
  const add = (key, icon, label) => {
    if (seen.has(key)) return;
    seen.add(key);
    list.push({ icon, label });
  };
  for (const entry of config.chaos || [])
    for (const kind of entry.kinds)
      if (INCIDENT_ICONS[kind]) add(kind, INCIDENT_ICONS[kind].icon, INCIDENT_ICONS[kind].label);
  for (const t of [].concat(config.twist || []))
    if (TWISTS[t.kind]) add("twist-" + t.kind, TWISTS[t.kind].icon, TWIST_LABELS[t.kind] || t.kind);
  if (config.daredevilAt?.length) add("daredevil", "🤸", "Daredevils");
  return list;
}
