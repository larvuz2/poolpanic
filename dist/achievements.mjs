// Achievements: what the player has done, as one list that the game and Steam share. The ids are the achievements' API names in Steamworks
// (desktop/steam/achievements.md says what to type there). Pure logic with no DOM: the app tells it what happened (a save, a finished
// shift, the fund filled); it says what is newly done and remembers it, and the app shows it and tells the platform (platform.mjs).
// An achievement that is not in this list is ignored, so a saved file from a newer build cannot break an older one.

export const ACHIEVEMENTS = [
  // Shifts and stars
  { id: "FIRST_SHIFT", icon: "🏁", name: "Clocked in", text: "Finish your first shift." },
  { id: "FIRST_STAR", icon: "⭐", name: "Rising star", text: "Earn a star on a shift." },
  { id: "THREE_STARS", icon: "🌟", name: "Pool legend", text: "Earn all three stars on one shift." },
  {
    id: "CLUB_CLEARED",
    icon: "🏊",
    name: "Community hero",
    text: "Earn a star on all ten levels of the Community Pools.",
  },
  { id: "ALL_LEVELS", icon: "🏆", name: "Season ticket", text: "Earn a star on every level." },
  {
    id: "OCEAN_FUND",
    icon: "🌊",
    name: "Beach bound",
    text: "Fill the Ocean Fund and take Marina to the sea.",
  },
  // Incidents (the save the simulation reports when one is stopped or solved)
  { id: "RESCUE", icon: "🛟", name: "Lifeguard", text: "Rescue a swimmer with a cramp." },
  { id: "CLEANUP", icon: "🧽", name: "Spotless", text: "Clean up after an accident in the pool." },
  {
    id: "FISH_STOPPED",
    icon: "🪣",
    name: "Not on my watch",
    text: "Stop the fish kid before he reaches the edge.",
  },
  { id: "FISH_CAUGHT", icon: "🐟", name: "Gone fishing", text: "Net the fish that got loose in the pool." },
  { id: "DOG_OUT", icon: "🐶", name: "Good dog", text: "Lead the loose dog out of a door." },
  {
    id: "RED_CARD",
    icon: "🟥",
    name: "Red card",
    text: "Red-card a cannonball man before he reaches the edge.",
  },
  { id: "KAREN_CALMED", icon: "😌", name: "Customer service", text: "Calm Karen down." },
  { id: "BREAKER", icon: "⚡", name: "Lights on", text: "Reset the breaker before the lights go out." },
  { id: "HEALED", icon: "🩹", name: "Patched up", text: "Patch up a swimmer hurt in a trampoline crash." },
];

// The simulation's `save` kinds that earn one.
const SAVES = {
  rescue: "RESCUE",
  cleanup: "CLEANUP",
  "fish-stopped": "FISH_STOPPED",
  "fish-caught": "FISH_CAUGHT",
  "dog-out": "DOG_OUT",
  "red-card": "RED_CARD",
  karen: "KAREN_CALMED",
  breaker: "BREAKER",
  healed: "HEALED",
};

const KNOWN = new Set(ACHIEVEMENTS.map((a) => a.id));

export class Achievements {
  // `unlocked`: the ids kept from before. `remember(list)` keeps the new list. `announce(achievement)` shows a new one to the player and
  // hands it to the platform.
  constructor({ unlocked = [], remember = () => {}, announce = () => {} } = {}) {
    this.done = new Set((Array.isArray(unlocked) ? unlocked : []).filter((id) => KNOWN.has(id)));
    this.remember = remember;
    this.announce = announce;
  }
  has(id) {
    return this.done.has(id);
  }
  // Returns whether it is new.
  unlock(id) {
    if (!KNOWN.has(id) || this.done.has(id)) return false;
    this.done.add(id);
    this.remember([...this.done]);
    this.announce(ACHIEVEMENTS.find((a) => a.id === id));
    return true;
  }
  // The simulation reported a save of this kind.
  save(kind) {
    return SAVES[kind] ? this.unlock(SAVES[kind]) : false;
  }
  // A shift (or a drill) just ended with `stars` stars. `levelStars(n)` is the stars the records now hold for level n; `levels` how many
  // levels there are; `clubLevels` how many of them are the Community Pools.
  shift({ stars = 0, drill = false, levelStars = () => 0, levels = 20, clubLevels = 10 } = {}) {
    this.unlock("FIRST_SHIFT");
    if (drill) return;
    if (stars >= 1) this.unlock("FIRST_STAR");
    if (stars >= 3) this.unlock("THREE_STARS");
    const cleared = (from, to) =>
      Array.from({ length: to - from + 1 }, (_, i) => from + i).every((n) => levelStars(n) >= 1);
    if (cleared(1, clubLevels)) this.unlock("CLUB_CLEARED");
    if (cleared(1, levels)) this.unlock("ALL_LEVELS");
  }
  fund() {
    this.unlock("OCEAN_FUND");
  }
  // Every achievement with whether it is done, for a list in the game.
  list() {
    return ACHIEVEMENTS.map((a) => ({ ...a, done: this.done.has(a.id) }));
  }
  // Tell the platform about all of them again (Steam keeps the first time): a player who earned some before the game was on Steam, or
  // while Steam was not running, has them there from now on.
  replay(announceToPlatform) {
    for (const id of this.done) announceToPlatform(id);
  }
}
