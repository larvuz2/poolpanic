"use strict";
// Runs in the game's window before its own scripts, with no Node in it (the window is sandboxed): it asks the main process for
// what the game may know, puts the saved progress back into localStorage before the game reads it, keeps a copy of that
// progress in a plain file (so Steam Cloud can sync it), and gives the game one small object, `window.desktop`.
const { contextBridge, ipcRenderer } = require("electron");

const boot = ipcRenderer.sendSync("desktop:boot");

// ---- the saved progress ----------------------------------------------------------------------------------------------------
const snapshot = () => {
  const values = {};
  for (const key of boot.saveKeys) {
    try {
      const value = localStorage.getItem(key);
      if (value !== null) values[key] = value;
    } catch {}
  }
  return values;
};
const same = (a, b) => boot.saveKeys.every((key) => (a[key] ?? null) === (b[key] ?? null));

// The file is the truth when there is one: a newer one may have come down from the cloud while the game was closed.
if (boot.saves) {
  for (const [key, value] of Object.entries(boot.saves)) {
    try {
      localStorage.setItem(key, value);
    } catch {}
  }
}
let saved = snapshot();
setInterval(() => {
  const now = snapshot();
  if (same(now, saved)) return;
  saved = now;
  ipcRenderer.send("desktop:save", now);
}, 2000);
// A last copy as the window goes (the game may have changed something since the last look).
window.addEventListener("pagehide", () => {
  const now = snapshot();
  if (!same(now, saved)) ipcRenderer.sendSync("desktop:save-now", now);
});

// ---- what the game sees ----------------------------------------------------------------------------------------------------
// Calls into Steam are fire and forget: the game never waits for Steam, and with no Steam they do nothing.
const steam = Object.freeze({
  available: !!boot.steam.available,
  name: boot.steam.name || null,
  onDeck: !!boot.steam.deck,
  unlock: (id) => ipcRenderer.send("steam:unlock", String(id)),
  setStat: (name, value) => ipcRenderer.send("steam:stat", String(name), Number(value)),
  richPresence: (text) => ipcRenderer.send("steam:presence", String(text)),
});

contextBridge.exposeInMainWorld(
  "desktop",
  Object.freeze({
    platform: boot.platform,
    version: boot.version,
    steam,
    // Only a tester build can post the game's log (desktop/main.cjs says where to; the page cannot choose).
    tester: !!boot.tester,
    ...(boot.tester && { sendReport: (text) => ipcRenderer.invoke("desktop:report", String(text)) }),
    toggleFullscreen: () => ipcRenderer.send("desktop:fullscreen"),
    quit: () => ipcRenderer.send("desktop:quit"),
    openExternal: (url) => ipcRenderer.send("desktop:open", String(url)),
  }),
);
