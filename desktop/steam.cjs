"use strict";
// The Steam side of the desktop shell (steamworks.js), written so that nothing in it can stop the game: no Steam client running,
// no steamworks.js installed, an achievement Steamworks does not know yet: every one of these ends in `available: false` or a
// `false` answer, never a throw. The game plays the same without Steam (a build for itch.io, or `npm start` on a laptop).
const fs = require("node:fs");

// 480 is Valve's own test app (Spacewar), which every Steam account has: it lets the overlay, the name and the achievements calls
// be tried before the game has an app of its own. Put the real id in steam.config.json when Steamworks gives it.
const TEST_APP_ID = 480;
const NAME = /^[A-Za-z0-9_.-]{1,64}$/; // an achievement or stat's API name, as typed into Steamworks

// desktop/steam.config.json, with the environment on top: POOLPANIC_STEAM=0 leaves Steam out, POOLPANIC_STEAM_APPID=N another app.
function readConfig(file, env = process.env) {
  let data = {};
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {}
  const id = Number(env.POOLPANIC_STEAM_APPID || data.appId);
  return {
    enabled: env.POOLPANIC_STEAM !== "0" && data.enabled !== false,
    appId: Number.isInteger(id) && id > 0 ? id : TEST_APP_ID,
    // Steam relaunches a game that was started outside it (double-clicking the exe): on once the game has its real app id.
    restartIfNeeded: !!data.restartIfNeeded,
  };
}

function createSteam({ load = () => require("steamworks.js"), config, log = () => {} }) {
  let lib = null;
  let client = null;
  let info = {
    available: false,
    appId: config.appId,
    name: null,
    deck: false,
    language: null,
    reason: "not started",
  };
  const safe = (fn, fallback) => {
    try {
      return fn();
    } catch {
      return fallback;
    }
  };

  // Start Steam. Returns {restart: true} when Steam is going to relaunch the game (quit now), else the status.
  function start() {
    if (!config.enabled) return (info = { ...info, reason: "turned off" });
    try {
      lib = load();
    } catch (error) {
      log("steamworks.js is not installed: playing without Steam");
      return (info = { ...info, reason: "steamworks.js is not installed" });
    }
    try {
      if (config.restartIfNeeded && lib.restartAppIfNecessary(config.appId)) return { restart: true };
      client = lib.init(config.appId);
      info = {
        available: true,
        appId: config.appId,
        name: safe(() => client.localplayer.getName(), null),
        deck: safe(() => client.utils.isSteamRunningOnSteamDeck(), false),
        language: safe(() => client.apps.currentGameLanguage(), null),
        reason: "",
      };
    } catch (error) {
      client = null;
      info = { ...info, available: false, reason: String(error?.message || error).slice(0, 200) };
      log("Steam did not start (" + info.reason + "): playing without it");
    }
    return info;
  }

  // The overlay in an Electron window needs two command-line switches and a repaint nudge, and the switches must be set before
  // the app is ready: call this right after a successful start().
  function enableOverlay() {
    if (!client) return false;
    try {
      lib.electronEnableSteamOverlay();
      return true;
    } catch (error) {
      log("The Steam overlay could not be enabled: " + (error?.message || error));
      return false;
    }
  }

  return {
    start,
    enableOverlay,
    status: () => info,
    unlock: (id) =>
      !!client && NAME.test(String(id)) && safe(() => client.achievement.activate(String(id)), false),
    isUnlocked: (id) =>
      !!client && NAME.test(String(id)) && safe(() => client.achievement.isActivated(String(id)), false),
    // A whole-number stat (Steamworks keeps them and shows them on the profile); stored right away, which Steam allows a few times a minute.
    setStat: (name, value) =>
      !!client &&
      NAME.test(String(name)) &&
      Number.isFinite(Number(value)) &&
      safe(() => client.stats.setInt(String(name), Math.round(Number(value))) && client.stats.store(), false),
    // What the friends list says the player is doing.
    richPresence: (text) =>
      !!client &&
      safe(() => (client.localplayer.setRichPresence("status", String(text).slice(0, 120)), true), false),
    openStore: () => !!client && safe(() => (client.overlay.activateToStore(info.appId, 0), true), false),
  };
}

module.exports = { NAME, TEST_APP_ID, createSteam, readConfig };
