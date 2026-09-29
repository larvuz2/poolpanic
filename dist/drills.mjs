// Drills: short bonus shifts, one per chunk, that repeat the chunk's hardest idea with nothing else going on.
// A drill is a shift config plus the `tier` of game features it plays with (the same number a level uses to gate
// cramps, stomach trouble and so on). Each unlocks when its chunk is cleared with enough stars (see campaign.mjs).
// No imports: pure data, shared by the simulation, the campaign map and the checks.

export const DRILLS = {
  lunch: {
    id: "lunch",
    chunk: 1,
    icon: "🥪",
    name: "Lunch line",
    tier: 3,
    config: { name: "Lunch line", duration: 75, total: 12, thresholds: [1000, 1800, 2500], finChance: 0.3 },
  },
  fish: {
    id: "fish",
    chunk: 2,
    icon: "🐟",
    name: "Fish frenzy",
    tier: 5,
    config: {
      name: "Fish frenzy",
      duration: 75,
      total: 9,
      thresholds: [1100, 1900, 2700],
      chaos: [
        { kinds: ["fish"], window: [6, 12] },
        { kinds: ["fish"], window: [36, 44] },
      ],
    },
  },
  blackout: {
    id: "blackout",
    chunk: 3,
    icon: "⚡",
    name: "Blackout drill",
    tier: 7,
    config: {
      name: "Blackout drill",
      duration: 75,
      total: 9,
      thresholds: [1100, 1900, 2700],
      chaos: [
        { kinds: ["outage"], window: [8, 14] },
        { kinds: ["outage"], window: [38, 46] },
      ],
    },
  },
  daredevil: {
    id: "daredevil",
    chunk: 4,
    icon: "🤸",
    name: "Daredevil hour",
    tier: 12,
    config: {
      name: "Daredevil hour",
      venue: "resort",
      lighting: "day",
      duration: 75,
      total: 10,
      thresholds: [1600, 2600, 3500],
      daredevilAt: [0.08, 0.28, 0.48, 0.68, 0.88],
      jumpPatience: 12,
    },
  },
  cannonball: {
    id: "cannonball",
    chunk: 5,
    icon: "💣",
    name: "Cannonball club",
    tier: 14,
    config: {
      name: "Cannonball club",
      venue: "resort",
      lighting: "night",
      duration: 75,
      total: 9,
      thresholds: [2000, 3400, 4600],
      chaos: [
        { kinds: ["carl"], window: [5, 10] },
        { kinds: ["carl"], window: [36, 44] },
      ],
    },
  },
  storm: {
    id: "storm",
    chunk: 6,
    icon: "⛈️",
    name: "Storm drill",
    tier: 18,
    config: {
      name: "Storm drill",
      venue: "lagoon",
      lighting: "dusk",
      daylight: [0.8, 0.9],
      duration: 80,
      total: 11,
      thresholds: [2100, 3500, 4700],
      vipAt: [0.3, 0.7],
      twist: [{ kind: "storm", at: 0.12 }],
    },
  },
};
export const DRILL_LIST = Object.values(DRILLS);
export const drillForChunk = (chunk) => DRILL_LIST.find((d) => d.chunk === chunk) || null;
