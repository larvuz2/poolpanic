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
    // Online co-op (dist/net.mjs, dist/steam-net.mjs): a friends-only lobby of up to three, invites through the overlay, and the
    // game's messages over Steam's relayed P2P. `emit(type, data)` tells the game's window what happens.
    net: (emit) => createNet({ getClient: () => client, emit, log }),
  };
}

// Steam ids cross to the window as strings (a 64-bit number does not fit in a double).
const MAX_PACKET = 512 * 1024;
function createNet({ getClient, emit, log }) {
  let lobby = null,
    poll = null,
    handles = [];
  const client = () => getClient();
  const self = () => {
    try {
      return String(client().localplayer.getSteamId().steamId64);
    } catch {
      return null;
    }
  };
  const members = () => {
    try {
      return lobby ? lobby.getMembers().map((m) => String(m.steamId64)) : [];
    } catch {
      return [];
    }
  };
  const inLobby = (id) => members().includes(String(id));
  function listen() {
    const c = client();
    if (!c || handles.length) return;
    const SC = c.callback.SteamCallback;
    const on = (kind, fn) => {
      try {
        handles.push(c.callback.register(kind, fn));
      } catch (error) {
        log("Steam callback " + kind + " could not be registered: " + (error?.message || error));
      }
    };
    // Only someone in our lobby may open a P2P session with us.
    on(SC.P2PSessionRequest, ({ remote }) => {
      if (inLobby(remote)) c.networking.acceptP2PSession(remote);
    });
    // A friend's invite accepted from the overlay or the friends list while the game runs.
    on(SC.GameLobbyJoinRequested, ({ lobby_steam_id }) => emit("join-request", String(lobby_steam_id)));
    on(SC.LobbyChatUpdate, ({ lobby: id, user_changed, member_state_change }) => {
      if (!lobby || String(id) !== String(lobby.id)) return;
      emit(member_state_change === 0 ? "joined" : "left", String(user_changed));
    });
    on(SC.P2PSessionConnectFail, ({ remote, error }) => emit("left", String(remote), error));
  }
  function pump() {
    const c = client();
    if (!c) return;
    try {
      for (let n = 0; n < 200; n++) {
        const size = c.networking.isP2PPacketAvailable();
        if (!size) break;
        const packet = c.networking.readP2PPacket(size);
        const from = String(packet.steamId.steamId64);
        if (!inLobby(from) || packet.size > MAX_PACKET) continue;
        let msg = null;
        try {
          msg = JSON.parse(packet.data.toString("utf8"));
        } catch {}
        if (msg && typeof msg === "object") emit("message", from, msg);
      }
    } catch (error) {
      log("Steam P2P read failed: " + (error?.message || error));
    }
  }
  const started = () => {
    listen();
    if (!poll) poll = setInterval(pump, 4);
  };
  const info = () => ({
    lobby: lobby ? String(lobby.id) : null,
    self: self(),
    owner: lobby ? safeOwner() : null,
    members: members(),
  });
  const safeOwner = () => {
    try {
      return String(lobby.getOwner().steamId64);
    } catch {
      return null;
    }
  };
  return {
    available: () => !!client(),
    async host(data = {}) {
      const c = client();
      if (!c) return { ok: false, error: "Steam is not running" };
      try {
        started();
        if (lobby) lobby.leave();
        lobby = await c.matchmaking.createLobby(1 /* friends only */, 3);
        for (const [k, v] of Object.entries(data)) lobby.setData(String(k), String(v));
        return { ok: true, ...info() };
      } catch (error) {
        lobby = null;
        return { ok: false, error: String(error?.message || error).slice(0, 200) };
      }
    },
    async join(id) {
      const c = client();
      if (!c) return { ok: false, error: "Steam is not running" };
      try {
        started();
        if (lobby) lobby.leave();
        lobby = await c.matchmaking.joinLobby(BigInt(String(id)));
        const data = (() => {
          try {
            return lobby.getFullData();
          } catch {
            return {};
          }
        })();
        return { ok: true, ...info(), data };
      } catch (error) {
        lobby = null;
        return { ok: false, error: String(error?.message || error).slice(0, 200) };
      }
    },
    leave() {
      try {
        lobby?.leave();
      } catch {}
      lobby = null;
      return true;
    },
    invite() {
      try {
        lobby?.openInviteDialog();
        return !!lobby;
      } catch {
        return false;
      }
    },
    setJoinable(on) {
      try {
        return !!lobby?.setJoinable(!!on);
      } catch {
        return false;
      }
    },
    send(to, msg) {
      const c = client();
      if (!c || !inLobby(to)) return false;
      try {
        const data = Buffer.from(JSON.stringify(msg), "utf8");
        if (data.length > MAX_PACKET) return false;
        return c.networking.sendP2PPacket(BigInt(String(to)), 2 /* reliable */, data);
      } catch {
        return false;
      }
    },
    info,
  };
}

// A friend's invite accepted while the game was closed: Steam starts it with `+connect_lobby <id>`.
function launchLobby(argv = process.argv) {
  const i = argv.indexOf("+connect_lobby");
  const id = i >= 0 ? argv[i + 1] : null;
  return id && /^\d{5,20}$/.test(id) ? id : null;
}

module.exports = { NAME, TEST_APP_ID, createSteam, readConfig, launchLobby };
