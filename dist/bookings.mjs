// Bookings: before a shift from Act 2 on, the club offers three bookings. A bigger payout always means more trouble
// (the risk dial). A booking is pure data: `applyBooking` folds it into a copy of the shift's config, so the
// simulation needs no special cases. Times are fractions of the shift so a booking scales with any level length.
// No imports: the simulation depends on this module, so it must not depend on the simulation.

export const BOOKINGS_FROM_LEVEL = 11;

export const BOOKINGS = {
  regular: {
    id: "regular",
    icon: "🏊",
    name: "Regular",
    note: "Just a normal day",
    payout: 1,
    trouble: [],
  },
  tour: {
    id: "tour",
    icon: "🚌",
    name: "Tour group",
    note: "A whole coach party arrives at once",
    payout: 1.25,
    // Everyone arrives at once, a quarter of the way in.
    twist: [{ kind: "rush", at: 0.25 }],
    trouble: ["🚌"],
  },
  stag: {
    id: "stag",
    icon: "🎉",
    name: "Stag party",
    note: "Cannonball Carl comes with them",
    payout: 1.35,
    chaos: [{ kinds: ["carl"], window: [0.18, 0.4] }],
    trouble: ["💣"],
  },
  kids: {
    id: "kids",
    icon: "🎈",
    name: "Kids' party",
    note: "A fish kid, then a loose dog",
    payout: 1.45,
    chaos: [
      { kinds: ["fish"], window: [0.12, 0.3] },
      { kinds: ["dog"], window: [0.55, 0.75] },
    ],
    trouble: ["🐟", "🐶"],
  },
  night: {
    id: "night",
    icon: "🌙",
    name: "Night swim",
    note: "After dark, with a power cut",
    payout: 1.4,
    lighting: "night",
    chaos: [{ kinds: ["outage"], window: [0.3, 0.5] }],
    trouble: ["⚡"],
  },
};

// The three bookings on offer for a shift: Regular first, then two others drawn from a seeded shuffle so the same
// shift offers the same choices. A night booking is not offered for a shift that is already at night.
export function offerBookings(level, seed = 0, config = {}) {
  if (level < BOOKINGS_FROM_LEVEL) return [];
  const pool = Object.values(BOOKINGS).filter(
    (b) => b.id !== "regular" && !(b.lighting && b.lighting === config.lighting),
  );
  let state = (Math.imul((level + 1) * 2654435761, 1) ^ seed) >>> 0 || 1;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return [BOOKINGS.regular, ...pool.slice(0, 2)];
}

// A copy of `config` with the booking's extra trouble folded in. The original is never touched.
export function applyBooking(config, booking) {
  if (!booking || booking.id === "regular") return { ...config, booking: booking?.id ?? null };
  const seconds = (w) => w.map((f) => Math.round(f * config.duration * 10) / 10);
  return {
    ...config,
    booking: booking.id,
    payout: booking.payout ?? 1,
    lighting: booking.lighting ?? config.lighting,
    chaos: [
      ...(config.chaos || []),
      ...(booking.chaos || []).map((c) => ({ kinds: [...c.kinds], window: seconds(c.window) })),
    ],
    twist: [...(config.twist || []), ...(booking.twist || [])],
  };
}
