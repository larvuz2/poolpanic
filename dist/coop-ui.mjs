// PLAY WITH FRIENDS on the menu (22 October 2026): online co-op for up to three, the way Overcooked does it on Steam. The host
// opens a friends-only lobby and invites friends through the Steam overlay (or a friend joins from "Join Game" in the friends
// list, or starts the game from the invite); everyone in the lobby has a slot with their coach, picked with ◀ ▶ (each coach
// once: Coach Waters, Coach Brooks, Coach Rivers, crew.mjs), and READY; the host picks the pool and difficulty (any pool the
// host has opened, as in FREE PLAY) and starts once everyone is ready. The shift itself is played through net.mjs.
// Single player never comes here: one player is always Coach Waters.
//
// Without Steam (a browser, or the app with Steam off) the lobby can still be tried on one machine in two windows of the same
// browser (dev mode: the BroadcastChannel transport), which is how it is tested here.
import { COACHES, coachInfo, MAX_CREW } from "./crew.mjs";
import { CoopHost, CoopGuest, channelTransport } from "./net.mjs";
import { hostSteam, joinSteam, steamNet, onSteamNet } from "./steam-net.mjs";
import { POOLS, FREE_LEVELS, freeLevel, freeLevelOpen, freePools } from "./week.mjs";
import { BUILD } from "./version.mjs";

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const ROOMS = "pool-panic-coop-rooms";
const WHY = {
  full: "That crew is full (three coaches).",
  version: "That host plays another version of Pool Panic: update both to the same one.",
  playing: "That crew is in the middle of a shift. Try again when they are back in the lobby.",
  kicked: "The host took you out of the crew.",
};

// `onStart(shift, session)`: the game builds the shift (`shift.week`, `shift.seed`, `shift.options.crew`) and plays it.
export function installCoop({ $, save, dev = () => false, name = () => "", onStart, onClose, sounds = {} }) {
  const dialog = $("coop-dialog");
  let session = null,
    rooms = new Map(),
    roomChannel = null,
    announce = null,
    choice = { pool: "club", level: "easy" },
    note = "";

  const steam = () => !!steamNet();
  const myName = () => name() || (steam() ? globalThis.desktop?.steam?.name : "") || "Coach";

  // ---- rooms on this machine (dev: two windows) -------------------------------------------------------------------------
  function listenRooms() {
    if (roomChannel || typeof BroadcastChannel === "undefined") return;
    roomChannel = new BroadcastChannel(ROOMS);
    roomChannel.onmessage = (e) => {
      const m = e.data;
      if (m?.room && m.id !== session?.t?.id) {
        rooms.set(m.id, { ...m, seen: Date.now() });
        if (!session) render();
      }
      if (m?.gone) {
        rooms.delete(m.gone);
        if (!session) render();
      }
    };
  }

  // ---- making and joining a crew --------------------------------------------------------------------------------------------
  function wire(s) {
    session = s;
    s.on("lobby", render);
    s.on("welcome", render);
    s.on("left", (p) => {
      note = `${p.name} left the crew.`;
      render();
    });
    s.on("refused", (why) => {
      leave(WHY[why] || "Could not join that crew.");
    });
    s.on("closed", () => leave("The host closed the crew."));
    s.on("start", (shift) => onStart(shift, s));
    render();
  }
  async function host() {
    note = "";
    if (steam()) {
      note = "Opening a Steam lobby…";
      render();
      const r = await hostSteam();
      if (!r.ok) return leave("Steam could not open a lobby: " + r.error);
      wire(new CoopHost(r.transport, { name: myName(), build: BUILD.commit }));
      session.invite = r.invite;
      note = "Invite up to two friends: they join from the invite or from Join Game in Steam's friends list.";
      return render();
    }
    const t = channelTransport();
    wire(new CoopHost(t, { name: myName(), build: BUILD.commit }));
    listenRooms();
    const say = () =>
      roomChannel?.postMessage({ room: true, id: t.id, name: session?.name, count: session?.players.length });
    say();
    announce = setInterval(say, 1000);
    note = "Open the game in another window of this browser and join from there (a test on one machine).";
    render();
  }
  async function join(target) {
    note = "";
    if (steam() && /^\d+$/.test(String(target))) {
      note = "Joining the lobby…";
      open();
      render();
      const r = await joinSteam(target);
      if (!r.ok)
        return leave(
          r.error === "version" ? WHY.version : "Could not join that lobby: " + (r.error || "no answer"),
        );
      return wire(new CoopGuest(r.transport, r.host, { name: myName(), build: BUILD.commit }));
    }
    wire(new CoopGuest(channelTransport(), target, { name: myName(), build: BUILD.commit }));
  }
  function leave(message = "") {
    clearInterval(announce);
    announce = null;
    if (session) {
      if (roomChannel && session instanceof CoopHost) roomChannel.postMessage({ gone: session.t.id });
      try {
        session.close();
      } catch {}
    }
    session = null;
    note = message;
    render();
  }

  // ---- the window ------------------------------------------------------------------------------------------------------------
  const isHost = () => session instanceof CoopHost;
  const me = () => session?.me;
  function pick(step) {
    const p = me();
    if (!p || !session) return;
    const taken = new Set(session.players.filter((q) => q !== p).map((q) => q.coach));
    let i = COACHES.findIndex((c) => c.id === p.coach);
    for (let n = 0; n < COACHES.length; n++) {
      i = (i + step + COACHES.length) % COACHES.length;
      if (!taken.has(COACHES[i].id)) break;
    }
    sounds.tick?.();
    if (isHost()) session.pickMine(COACHES[i].id);
    else {
      session.pick(COACHES[i].id);
      p.coach = COACHES[i].id; // (shown at once; the host's lobby has the last word)
      p.ready = false;
      render();
    }
  }
  function ready() {
    const p = me();
    if (!p || isHost()) return;
    p.ready = !p.ready;
    session.ready(p.ready);
    sounds.tick?.();
    render();
  }
  function start() {
    if (!isHost() || !session.everyoneReady) return;
    sounds.go?.();
    const seed = (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0;
    // (what every machine builds the same shift from: the pool, the difficulty, the seed and the incidents the host has met)
    const shift = session.start({ choice, seed, known: save()?.known || [], options: {} });
    onStart(shift, session);
  }

  function slot(i) {
    const p = session?.players.find((q) => q.index === i);
    if (!p) {
      const inviting = isHost() && session.invite;
      return `<div class="coop-slot empty"><div class="coop-portrait"></div><b>${i === 0 ? "" : "Free"}</b>${
        inviting
          ? `<button class="secondary" data-act="invite">＋ Invite a friend</button>`
          : `<small>${isHost() ? "Waiting for a friend…" : "Free"}</small>`
      }</div>`;
    }
    const c = coachInfo(p.coach),
      mine = p.index === session.index,
      img = new URL(`./assets/coach-${c.id}.webp`, import.meta.url).href;
    return `<div class="coop-slot${mine ? " mine" : ""}${p.ready ? " ready" : ""}${p.away ? " away" : ""}" style="--coach:${c.colour}">
      <div class="coop-portrait"><img src="${img}" alt="${esc(c.name)}" /></div>
      <div class="coop-pick">${mine ? `<button class="coop-arrow" data-act="prev" aria-label="Previous coach">◀</button>` : ""}<b>${esc(c.name)}</b>${mine ? `<button class="coop-arrow" data-act="next" aria-label="Next coach">▶</button>` : ""}</div>
      <span class="coop-player">${esc(p.name)}${p.host ? " · HOST" : ""}${mine ? " · YOU" : ""}</span>
      <span class="coop-ready">${p.away ? "DROPPED" : p.host ? "READY" : p.ready ? "READY ✓" : "NOT READY"}</span>
      ${isHost() && !p.host ? `<button class="text-btn" data-act="kick" data-index="${p.index}">Remove</button>` : ""}
    </div>`;
  }
  function choicePanel() {
    const s = save() || {},
      all = !!dev(),
      pools = freePools(s, all),
      unlocked = s.unlocked || 1;
    if (isHost()) {
      if (!pools.find((p) => p.id === choice.pool)?.open) choice = { ...choice, pool: "club" };
      if (!freeLevelOpen(choice.level, unlocked, all)) choice = { ...choice, level: "easy" };
      if (session.choice?.pool !== choice.pool || session.choice?.level !== choice.level)
        session.choose(choice);
      return `<div class="coop-pools">${pools
        .filter((p) => p.open)
        .map(
          (p) =>
            `<button class="fp-diff${p.id === choice.pool ? " on" : ""}" data-pool="${p.id}">${esc(POOLS[p.id].name)}</button>`,
        )
        .join("")}</div><div class="coop-levels">${FREE_LEVELS.map((l) => {
        const ok = freeLevelOpen(l.id, unlocked, all);
        return `<button class="fp-diff${l.id === choice.level ? " on" : ""}" data-level="${l.id}" ${ok ? "" : "disabled"}>${ok ? "" : "🔒 "}${l.name}</button>`;
      }).join("")}</div>`;
    }
    const c = session.choice;
    return `<p class="coop-chosen">${c ? `The host picked <b>${esc(POOLS[c.pool]?.name || c.pool)}</b> · <b>${esc(freeLevel(c.level).name)}</b>` : "The host is picking the pool…"}</p>`;
  }
  function render() {
    if (!dialog) return;
    const inLobby = !!session && session.index != null;
    $("coop-start").hidden = inLobby;
    $("coop-lobby").hidden = !inLobby;
    $("coop-note").textContent = note;
    if (!inLobby) {
      const list = [...rooms.values()].filter((r) => Date.now() - r.seen < 3500);
      $("coop-intro").innerHTML = steam()
        ? "Host a shift and invite up to two friends from Steam. To join a friend, accept their invite or pick <b>Join Game</b> on them in Steam's friends list."
        : dev()
          ? "Steam is not running here: co-op plays over Steam in the desktop app. To try it on this machine, host in one window and join from another window of this browser."
          : "Co-op plays over Steam: start Pool Panic from Steam to play with friends.";
      $("coop-host").disabled = !(steam() || dev());
      $("coop-rooms").innerHTML =
        !steam() && dev()
          ? list.length
            ? list
                .map(
                  (r) =>
                    `<button class="secondary" data-act="join" data-id="${esc(r.id)}">Join ${esc(r.name || "a crew")} (${r.count || 1}/${MAX_CREW}) ▶</button>`,
                )
                .join("")
            : `<small>No crew open in another window yet.</small>`
          : "";
      return;
    }
    $("coop-slots").innerHTML = [0, 1, 2].map(slot).join("");
    $("coop-choice").innerHTML = choicePanel();
    const host = isHost(),
      everyone = host && session.everyoneReady,
      p = me();
    $("coop-go").hidden = !host;
    $("coop-go").disabled = !everyone;
    $("coop-ready").hidden = host;
    $("coop-ready").textContent = p?.ready ? "Not ready ↺" : "READY ✓";
    $("coop-status").textContent = host
      ? everyone
        ? session.players.length === 1
          ? "Ready when you are (friends can still join)."
          : "Everyone is ready."
        : "Waiting for everyone to be ready…"
      : p?.ready
        ? "Ready: waiting for the host to start."
        : "Pick your coach, then READY.";
  }

  dialog?.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const act = b.dataset.act;
    if (b.dataset.pool) {
      choice = { ...choice, pool: b.dataset.pool };
      sounds.tick?.();
      return render();
    }
    if (b.dataset.level) {
      choice = { ...choice, level: b.dataset.level };
      sounds.tick?.();
      return render();
    }
    if (act === "prev") pick(-1);
    if (act === "next") pick(1);
    if (act === "invite") session?.invite?.();
    if (act === "join") join(b.dataset.id);
    if (act === "kick") session?.kick?.(Number(b.dataset.index));
  });
  $("coop-host").onclick = host;
  $("coop-go").onclick = start;
  $("coop-ready").onclick = ready;
  $("coop-close").onclick = () => {
    leave();
    dialog.close();
    onClose?.();
  };
  dialog?.addEventListener("keydown", (e) => {
    if (!session || session.index == null) return;
    if (e.key === "ArrowLeft") (pick(-1), e.preventDefault());
    if (e.key === "ArrowRight") (pick(1), e.preventDefault());
    if (e.key === "Enter" && !e.target.closest("button")) (isHost() ? start() : ready(), e.preventDefault());
  });
  // A friend's invite accepted from Steam (while the game runs): straight into their lobby.
  onSteamNet((type, id) => {
    if (type === "join-request") {
      if (session) leave();
      join(id);
    }
  });

  function open() {
    listenRooms();
    if (!dialog.open) dialog.showModal();
    render();
  }
  return {
    open,
    join: (id) => (open(), join(id)),
    get session() {
      return session;
    },
    // Back to the lobby after a shift (everyone): the same crew, ready to go again.
    back() {
      if (session && isHost()) session.finish();
      if (session) for (const p of session.players) if (!p.host) p.ready = false;
      open();
    },
    leave,
    render,
  };
}
