// Co-op over Steam (the desktop app only: desktop/steam.cjs createNet, through the preload's `desktop.steam.net`): the host
// makes a friends-only lobby of three and invites friends through the Steam overlay; a friend joins from the invite, from
// "Join Game" in the friends list, or by starting the game from the invite (+connect_lobby). Once in, the lobby's owner is
// the host and every message goes over Steam's relayed P2P (no address is ever shown, no port opened). In a browser, or with
// no Steam, none of this is there and `steamNet()` is null.
import { PROTOCOL } from "./net.mjs";
import { BUILD } from "./version.mjs";

export const steamNet = () =>
  globalThis.desktop?.steam?.available && globalThis.desktop.steam.net ? globalThis.desktop.steam.net : null;

// One listener on the window for everything the main process says; the transports and the menu subscribe here.
const listeners = new Set();
let wired = false;
function wire(api) {
  if (wired) return;
  wired = true;
  api.onEvent((type, ...args) => {
    for (const fn of listeners) fn(type, ...args);
  });
}
export function onSteamNet(fn) {
  const api = steamNet();
  if (!api) return () => {};
  wire(api);
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// A transport (net.mjs) on top of the lobby: peers are Steam ids.
function transport(api, self) {
  const handlers = { message: [], leave: [] };
  const off = onSteamNet((type, from, msg) => {
    if (type === "message") handlers.message.forEach((fn) => fn(from, msg));
    if (type === "left") handlers.leave.forEach((fn) => fn(from));
  });
  return {
    id: self,
    send(to, msg) {
      api.send(to, msg);
      return true;
    },
    onMessage: (fn) => handlers.message.push(fn),
    onLeave: (fn) => handlers.leave.push(fn),
    close() {
      off();
      api.leave();
    },
  };
}

// Host: a new lobby (its data says which build it is for, so the overlay's Join of another version is refused at once).
export async function hostSteam() {
  const api = steamNet();
  if (!api) return { ok: false, error: "Steam is not running" };
  wire(api);
  const r = await api.host({ game: "pool-panic", protocol: PROTOCOL, build: BUILD.commit });
  if (!r.ok) return r;
  return { ok: true, lobby: r.lobby, transport: transport(api, r.self), invite: () => api.invite(), api };
}

// Guest: into a friend's lobby; its owner is the host.
export async function joinSteam(lobby) {
  const api = steamNet();
  if (!api) return { ok: false, error: "Steam is not running" };
  wire(api);
  const r = await api.join(lobby);
  if (!r.ok) return r;
  if (r.data?.game && r.data.game !== "pool-panic")
    return (api.leave(), { ok: false, error: "not a Pool Panic lobby" });
  if (r.data?.protocol && Number(r.data.protocol) !== PROTOCOL)
    return (api.leave(), { ok: false, error: "version", build: r.data.build });
  if (!r.owner || r.owner === r.self) return (api.leave(), { ok: false, error: "no host in that lobby" });
  return { ok: true, lobby: r.lobby, host: r.owner, transport: transport(api, r.self), api };
}

// The lobby a friend's invite asked for when the game was started from it (once), else null.
export async function pendingInvite() {
  const api = steamNet();
  if (!api) return null;
  try {
    return await api.pending();
  } catch {
    return null;
  }
}
