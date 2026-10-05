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
| A Mac with an Apple chip (2020 or later) | `PoolPanic-mac-apple-silicon.zip` | Unzip, move **Pool Panic** to Applications, open it. macOS says it cannot check the app: **System Settings, Privacy & Security, Open Anyway** (on an older macOS: right-click the app, Open). |
| An older Mac with an Intel chip | `PoolPanic-mac-intel.zip` | The same. |
| Linux, or a Steam Deck | `PoolPanic-linux-x64.zip` | Unzip, and in the folder run `./PoolPanic --no-sandbox`. |

The builds are not signed (there is no Apple or Microsoft certificate yet), which is why each system asks once. The release's notes name the
commit the build was made from, and the game's own reports name it too. A newer push replaces the page, so download again to test the newest.

A test build is **not the Steam build**: it starts in **playtest mode** (the 🐞 button flags a problem, and the panel shows the **device code** to
read out once), and as you play the game posts its log to the report service, as a web playtest does, so the developer can read what happened
and what came before a crash. The Steam build has no `tester.json` (the file that makes a test build) and never sends anything.

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
