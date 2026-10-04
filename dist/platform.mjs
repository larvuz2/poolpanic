// The shell the game runs in. In the desktop app (desktop/: Electron, with Steam when the Steam client is there) the preload gives the
// page `window.desktop`; in a browser there is no such thing and every call here does nothing. The game never waits for any of it.
const shell = () => globalThis.desktop || null;

export const isDesktop = () => !!shell();
export const isSteam = () => !!shell()?.steam?.available;
export const platformName = () => shell()?.platform || "web";

// Tell Steam an achievement is done (its API name, as typed into Steamworks). Safe to repeat: Steam keeps the first time.
export function unlockAchievement(id) {
  try {
    shell()?.steam?.unlock?.(String(id));
  } catch {}
}

// A whole-number stat for Steamworks (levels cleared, saves made).
export function setStat(name, value) {
  try {
    shell()?.steam?.setStat?.(String(name), Math.round(Number(value) || 0));
  } catch {}
}

// What the friends list says the player is doing ("Level 7 · The relay").
export function richPresence(text) {
  try {
    shell()?.steam?.richPresence?.(String(text));
  } catch {}
}

export function quitGame() {
  try {
    shell()?.quit?.();
  } catch {}
}
