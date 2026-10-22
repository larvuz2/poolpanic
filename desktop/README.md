# Pool Panic for Steam: the desktop app

The game (`../dist`) in a window of its own, with Steam when the Steam client is running. It is the same game: nothing in the
simulation or the scenes knows about it. What the desktop app adds is a window that works like a game's (full screen on F11, a quit
button, remembered size and place), the game served from files on the player's disk (no network, no browser quirks: it is
Chromium inside), the player's progress copied to a plain file that Steam Cloud can sync, and the Steam calls (the overlay,
achievements, rich presence). With no Steam it plays exactly the same, so the same build also serves an itch.io page or a friend.

## Test it on your Mac or Windows PC

Steam players run this app, not a web page, so this is how the game is tested. Two routes.

### 1. Download a test build (nothing to install)

Every push that changes the game or the app makes a **test build** for Windows, macOS (Apple chip and Intel) and Linux, and puts them on one
page that is replaced each time:

**https://github.com/larvuz2/poolpanic/releases/tag/desktop-latest**

| You have | Download | Then |
| --- | --- | --- |
| Windows | `PoolPanic-windows-x64.zip` | Unzip it (right-click, Extract All) and open `PoolPanic.exe` in the folder. Windows asks once ("Windows protected your PC"): **More info**, then **Run anyway**. |
| A Mac with an Apple chip (2020 or later) | `PoolPanic-mac-apple-silicon.zip` | Needs macOS 13 or newer. Unzip, move **PoolPanic** to Applications, open it. macOS says it cannot check the app: **System Settings, Privacy & Security, Open Anyway** (if that does not show, in Terminal: `xattr -dr com.apple.quarantine /Applications/PoolPanic.app`, then open it again). |
| An older Mac with an Intel chip | `PoolPanic-mac-intel.zip` | The same. |
| Linux, or a Steam Deck | `PoolPanic-linux-x64.zip` | Unzip, and in the folder run `./PoolPanic --no-sandbox`. |

The builds are not signed (there is no Apple or Microsoft certificate yet), which is why each system asks once. The release's notes name the
commit the build was made from, and the game's own reports name it too. A newer push replaces the page, so download again to test the newest.

A test build is **not the Steam build**: it starts in **playtest mode** (the 🐞 button flags a problem, and the panel shows the **device code** to
read out once), and as you play the game posts its log to the report service, as a web playtest does, so the developer can read what happened
and what came before a crash. The Steam build has no `tester.json` (the file that makes a test build) and never sends anything.

### Try co-op over Steam (PLAY WITH FRIENDS, two machines)

Online co-op (the main README, "Online co-op") goes over Steam, so it needs **two Steam accounts on two machines** (a free account is
enough; the app still uses Valve's test app 480, which every account has). On the Mac and the Windows PC:

1. Install Steam on both, and sign in with a **different account on each**. Make the two accounts **Steam friends**.
2. Download and unzip the test build on both (above), and **start Steam first**, then the game (a test build started outside Steam
   still finds the running Steam client).
3. On one machine: **PLAY WITH FRIENDS**, **Host a shift**, then **＋ Invite a friend**: Steam's overlay opens, pick the other account.
   (Shift+Tab also opens the overlay.)
4. On the other: accept the invite in Steam (or right-click the host in the friends list, **Join Game**). The game opens the host's
   lobby: pick a coach with ◀ ▶, then **READY**.
5. The host picks a pool and a difficulty and presses **Start the shift**. Play it through, then **Back to the crew** for another.

Worth trying: both coaches doing the same job (one fetches fins while the other mops), one machine leaving mid-shift and coming back
(PLAY WITH FRIENDS, then join again: the coach waits), and the Coach Cam on the guest. Ask for both device codes (the 🐞 panel) after:
both logs say what each machine saw, and a line `out of step with the host` would be a bug to fix.

Without Steam the same lobby can be tried in **two windows of one browser** (dev mode on, `npm start`, open the game twice: host in one,
join in the other), which is how it was tested here; Electron's single window cannot do that.

### On an iPad: stream it from the Mac with Steam Link

There is no Pool Panic app for an iPad (an Electron app runs on Windows, macOS and Linux only), and the game is tested as the desktop app, not
in Safari. An iPad plays it by **streaming the Mac's app** with Valve's free **Steam Link** app, which is also how a Steam player would play it
on a tablet:

1. On the Mac: install Steam (https://store.steampowered.com/about), sign in (a free account is enough), and install the test build above.
2. In Steam on the Mac: **Games** menu, **Add a Non-Steam Game to My Library…**, **Browse…**, pick `/Applications/PoolPanic.app`, then
   **Add Selected Programs**. Pool Panic is now in the Steam library.
3. On the iPad: install **Steam Link** from the App Store. With the iPad on the same Wi-Fi as the Mac (and Steam open on the Mac), open it,
   choose the Mac, and type the code it shows into Steam on the Mac.
4. On the iPad: **Start Playing**, then in the library **Pool Panic**, **Play**. The game runs on the Mac and its picture is streamed.
5. In the game: Help (**?**), **On-screen controls: On**. Steam Link sends a touch as a mouse click, so the walk pad and the Dash, Jump and
   Interact buttons only show when this is On (Auto shows them on touch screens only). A Bluetooth keyboard or a controller set up in
   Steam Link works too.

The crash reports come from the Mac's app, so they name the Mac, not the iPad. Not tried here: there is no Steam or iPad where the game is
developed.

### 2. Run it from the source (a terminal; set up once)

Needs Node 22 and git. Once: `git clone https://github.com/larvuz2/poolpanic`, then `cd poolpanic/desktop && npm install`. After that
`npm run start:tester` is the same as a download, from the files on your disk, and for a newer version `git pull` and `npm run start:tester`
again (`git checkout <branch>` first for a branch that is not `main`). `npm start` is the game with no playtest mode and no sending. On Windows
use PowerShell or Command Prompt; the commands are the same.

## Run it

Needs Node 22 or newer. Once:

```sh
cd desktop
npm install          # Electron, electron-builder and steamworks.js (about 250 MB, Electron's own download included)
```

Then, from `desktop/`:

| Command | What it does |
| --- | --- |
| `npm start` | Opens the game from `../dist` in a window (developer tools on: Ctrl+Shift+I) |
| `npm run start:tester` | The same as a test build: playtest mode on, and the game's log posted to the report service (`POOLPANIC_REPORTS=<address>` posts to a fake service of your own instead, for trying it) |
| `npm run start:software-gl` | The same with software drawing, for a machine with no graphics card (a server, a VM) |
| `POOLPANIC_QUERY="debug&dpr=1" npm start` | Adds an address query: the game's `?debug` hook, `?bisect`, any of its switches (`dist/tuning.mjs`) |
| `POOLPANIC_FULLSCREEN=1 npm start` | Starts full screen |
| `POOLPANIC_STEAM=0 npm start` | Leaves Steam out even if it is running |
| `POOLPANIC_DATA=/tmp/pp npm start` | Keeps the player's data (saves, window, Chromium's profile) in another folder: a fresh player |

F11 or Alt+Enter toggles full screen. Esc is the game's pause, which has a **Quit to desktop** button in the desktop app.

## Try the Steam side (before the game has an app of its own)

1. Start the Steam client and sign in.
2. `cd desktop && npm start`. The window title bar does not say so, but the terminal does: `[pool-panic] Steam is running: <your name>`.
   Shift+Tab should open the Steam overlay over the game.
3. `desktop/steam.config.json` holds `"appId": 480`, Valve's own test app (Spacewar), which every account has, so Steam accepts the game as
   running without any set-up. Achievements cannot be tried on it (they would have to exist in Spacewar): see `steam/achievements.md`.

No Steam? The terminal says `Steam did not start (...): playing without it` and everything else works.

## Build it for Steam

Build each system on that system (the native Steam module and the packager both prefer it), or on a CI machine of that kind:

```sh
npm run pack:win       # on Windows  -> out/win-unpacked/PoolPanic.exe
npm run pack:mac       # on a Mac    -> out/mac-arm64/Pool Panic.app and out/mac/Pool Panic.app (Intel)
npm run pack:linux     # on Linux    -> out/linux-unpacked/PoolPanic
```

(`npm run pack:tester:win|mac|linux` make the **test builds** the same way, with a `tester.json` beside the game: CI does that on every push, `.github/workflows/desktop-test-build.yml`, and the Steam upload below never uses them.)

Each first copies the game into `desktop/game` (`scripts/prepare-game.mjs`, which also stamps the build so a crash report names its commit),
then packs a **folder**, not an installer: Steam wants the files, and sends players only the ones that changed in an update. Nothing is
compressed into an archive for the same reason (`asar: false`). A build is about 300 MB on disk (Electron is 290 of it; the game is 14).

## Upload it (SteamPipe)

After Steamworks has given the app its ids (`steam/checklist.md`, steps 1 to 3):

1. Fill in `YOUR_APP_ID` and the three `YOUR_DEPOT_ID_*` in `steam/app_build.vdf`.
2. Install SteamCMD (https://developer.valvesoftware.com/wiki/SteamCMD) and sign in with a build account (a Steamworks user with only the
   "Edit App Metadata" and "Publish App Changes To Steam" permissions is enough: not your own login).
3. `steamcmd +login <build account> +run_app_build "<full path>/desktop/steam/app_build.vdf" +quit`
4. In Steamworks, **SteamPipe > Builds**, put the build on a branch (`beta`, with a password) and install it from your Steam library to try it.
   `"SetLive" ""` in the script means an upload never goes live by itself; going live on `default` is a button in Steamworks, after the game
   is released or approved.

Launch options (Steamworks > **Installation > General**): Windows `PoolPanic.exe`; Linux `PoolPanic` with the argument `--no-sandbox` (Steam's
runtime on Linux and the Steam Deck does not give Chromium the privileged helper it would use otherwise); macOS `Pool Panic.app`.

## Steam Cloud

The game keeps its progress in the browser's storage, which no cloud can sync. The desktop app copies the player's keys (levels, stars, the
fund, settings, achievements; never the crash log) to one file, `saves/progress.json`, whenever they change, and puts them back before the game
starts (the file wins: a newer one may have come down from the cloud). In Steamworks > **Application > Cloud**, set a byte quota of 1 MB and 10
files, and add **Auto-Cloud** paths (root, subdirectory, pattern), one per system:

| Root | Subdirectory | Pattern |
| --- | --- | --- |
| `WinAppDataRoaming` | `PoolPanic/saves` | `*.json` |
| `MacAppSupport` | `PoolPanic/saves` | `*.json` |
| `LinuxXdgConfigHome` | `PoolPanic/saves` | `*.json` |

(`progress.previous.json` beside it is the file before the last write, kept so a crash in the middle of a write loses nothing.)

## How it fits together

| File | What it is |
| --- | --- |
| `main.cjs` | The Electron main process: the `app://game/` address (the game's files, nothing outside them), the window, F11, Steam, and the messages from the page |
| `preload.cjs` | Runs in the page before the game: restores the saved progress, keeps the copy, and gives the page `window.desktop` (platform, Steam calls, quit, full screen) |
| `lib.cjs` | The pure parts (which file an address means, file types, what the save file may hold, which links may leave, where a window may reappear) |
| `steam.cjs` | steamworks.js behind a wrapper that cannot throw: no Steam, no module, an unknown achievement all end in "no" |
| `steam.config.json` | The Steam app id (480, Valve's test app, until the game has its own) and whether Steam may relaunch the game |
| `electron-builder.yml`, `scripts/prepare-game.mjs` | Packing |
| `steam/` | `app_build.vdf` (SteamPipe), `achievements.md` (what to enter in Steamworks), `checklist.md` (the road to a release) |
| `../dist/platform.mjs`, `../dist/achievements.mjs` | The game's side: a bridge that does nothing in a browser, and the list of achievements |
| `../desktop-check.mjs`, `../achievements-check.mjs` | The checks (`npm test` in the repository root runs them; no Electron needed) |

The window is locked down the way Electron's own guidance asks: the page has no Node (`sandbox`, `contextIsolation`), it can only reach
`app://game/`, links leave only to GitHub and Steam over https, only full screen and copying are ever allowed as permissions, and the page's
Content-Security-Policy allows nothing from the network.

## What was tried here, and what was not

Tried (a Linux machine with no graphics card, software drawing, a virtual screen): the packaged Linux app starts, shows the game with its own
fonts, plays a shift, writes the progress file, and after the browser's own storage is deleted, restores the progress from the file; the real
steamworks.js loads and, with no Steam client, falls back to "playing without it"; the wrapper against a fake steamworks.js; every other check in
the repository.

**Not tried**, because it needs a machine with Steam on it: the overlay, a real achievement unlock, Cloud, the Steam Deck, the Windows and macOS
builds, and the launch options on each system. Expect to spend a session on those once there is a Steamworks app and a Windows PC.
