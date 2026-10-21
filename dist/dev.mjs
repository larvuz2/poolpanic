// Dev mode (21 October 2026, the creator: "I need a dev mode so I can test out all of the venues"). While it is on, FREE PLAY
// opens every pool (the Grand Gala Arena too) at every difficulty, whatever the runs have opened; the run itself, the ladder and
// the coach's locker keep the player's real progress. It is a switch in Settings (Developer), and `?dev=1` or `?dev=0` in the
// address turns it on or off for one page without saving.
//
// DEV_DEFAULT is what a player who never touched the switch gets. It is on while the creator tests the venues: turn it off
// before the Steam release (desktop/steam/checklist.md says so).
export const DEV_DEFAULT = true;

// The switch as it stands: the address's word first, then the saved setting, then the default.
export function devOn(settings = {}, params = null) {
  const word = params?.get?.("dev");
  if (word === "1" || word === "") return true;
  if (word === "0") return false;
  return typeof settings.dev === "boolean" ? settings.dev : DEV_DEFAULT;
}
