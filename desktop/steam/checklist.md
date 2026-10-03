# The road to a Steam release

Pool Panic's goal is a release on Steam, single player first. This is the whole road: what only you can do on Valve's side, what the game
and the desktop app already have, and what is still to build. Sizes and rules below are Valve's as of writing: Steamworks' own pages
(and https://partner.steamgames.com/doc/store/releasing) are the truth, so check a number there before you make art for it.

## Where the game stands

| Stage | What it is | State |
| --- | --- | --- |
| **1. The game** | Systems, mechanics, characters, incidents, the loop that makes people play "one more shift" | **Now.** This is where the time goes: it has to work perfectly before anything is polished |
| **2. Steam readiness** | The desktop app, Steam calls, achievements, cloud saves, controller support, settings, a build pipeline | Started: the app, the bridge, 15 achievements, cloud-ready saves, SteamPipe scripts, bundled fonts. Left: controller, settings screen, Deck |
| **3. Look** | Lighting, textures, the art pass ("pimping out") | Last, on purpose: nothing here should change how it plays |
| **4. Launch** | Store page, wishlists, demo, review, release | The store page can start long before stage 3 |

## A. Things only you can do (no code can do these)

1. **Steamworks account.** https://partner.steamgames.com/ . A person or a company; Valve checks identity, a bank account and tax forms (a W-9 in the
   US, a W-8BEN elsewhere). Allow a week or two: it is the slowest step, so start it now.
2. **Pay the app fee: $100 per app** ("Steam Direct"). It comes back once the game has earned $1,000.
3. **Create the app** in Steamworks. That gives the **app id** (put it in `desktop/steam.config.json`, and set `restartIfNeeded` to true) and the
   **depot ids** (one per system: Windows, Linux, macOS; put them in `desktop/steam/app_build.vdf`).
4. **Decide the name and the price.** Check the name is free (Steam search, the trademark office of your country). Games of this size usually
   cost a few dollars up to about fifteen; it is easy to change before and after release.
5. **Rights to your own art.** Valve asks, and a publisher or a platform will too:
   - Steam makes you **disclose AI-generated content** in the store page's content survey: the Meshy models, the Nano Banana pictures, the promo
     art. Say so honestly; it does not stop a release, hiding it can.
   - Check in writing that the plans you used (Meshy, fal.ai, the image models) allow **commercial use with no attribution**. A free tier often
     does not. Keep the invoices and the licence pages with the project.
   - The fonts (Barlow Condensed, DM Sans: SIL Open Font License) and three.js (MIT) are fine to ship; their licences are in `dist/assets/`.

## B. The store page (start it early: wishlists are the biggest thing a launch has)

A page can be public as **Coming soon** for months before the game is done; people wishlist it, and Steam tells them at release. The page must be
live at least two weeks before release, and Valve reviews it first (a few working days).

- **Capsule art** (Steamworks > Store Presence > Graphical Assets): header 920 x 430, small 462 x 174, main 1232 x 706, vertical 748 x 896, library
  capsule 600 x 900, library hero 3840 x 1240, library logo (transparent PNG), plus a page background if you like.
- **At least five screenshots** at 1920 x 1080 from the real game (nothing mocked up), and a **trailer** (the incidents are the hook: a fish
  kid dumping a fish, Carl's cannonball, Karen, a blackout, in the first ten seconds).
- Short description (300 characters), long description, tags (management, comedy, casual, 3D, family-friendly...), languages, system requirements.
- The **content survey** (age ratings), the **AI disclosure**, and the price.
- A **demo** is its own free app in Steamworks and the best tool for wishlists: levels 1 to 5 would do. Steam Next Fest (a few times a year) puts
  demos in front of a lot of people; you apply for a slot months ahead.

## C. Builds

1. `desktop/README.md` : `npm run pack:win` (on Windows), `pack:mac`, `pack:linux`; upload with SteamCMD (`app_build.vdf`).
2. Put the build on a private branch (`beta`), install it from your own library, and play it through on each system.
3. **Steam Cloud** settings (a table in `desktop/README.md`) and the **achievements** (`desktop/steam/achievements.md`, with 256 x 256 pictures).
4. Submit the build for **review** (Valve checks it starts and matches the page): about three working days. A release needs the page approved, the build approved,
   and a date at least two weeks away from when the page went public.

## D. What the game itself still needs for a paid release (Stage 2)

Roughly in the order that costs a player the most if it is missing:

| Need | Why | State |
| --- | --- | --- |
| A game that does not crash, ever | Reviews decide the launch; the crash log and the hunt exist for this | The crash log is in; the iPad crash is not understood; the desktop app is Chromium, which has not shown it |
| **Controller support** (and the Steam Deck) | Many players use a pad; "Deck Verified" needs it, text readable at 1280 x 800, and a Steam Input layout | Not started: keyboard and touch only. Steam Input can map a pad to the keys meanwhile |
| A **settings screen**: volume (music and effects apart), graphics (shadows, antialiasing, resolution scale), full screen, key rebinding | Every PC player looks for one; the switches already exist in `dist/tuning.mjs` | Not started |
| **Quit** in the main menu, and the pause menu | A window needs one | Quit is in the pause menu |
| More **achievements**, and a list of them in the game | They keep people playing; 15 is the start | 15 are in |
| **Saves** that cannot be lost | Players are furious about lost progress | Saved to a file, backed up (`progress.previous.json`); Auto-Cloud settings are in `desktop/README.md` |
| Accessibility: colour-blind safe tags, text size, reduced motion | Valve and players ask; reduced motion is in | Partly |
| **Localisation** | The first translations (French, German, Spanish, Portuguese, Chinese, Russian) buy a lot of sales | Not started; all text is in a few modules |
| Real **icon**, window title art, a proper **logo** | `desktop/build/icon.png` is a placeholder | Placeholder |

## E. Launch

- Release date set in Steamworks; **launch discount** and the price; announce to the wishlists.
- Watch the first reviews and the crash reports (`crashlog` in the game's own log; Steam also shows crashes by version).
- Plan a **first patch** in the first week: there will be one.

## Money, honestly

Valve keeps 30 % of every sale (less above $10 million). A first indie game on Steam sells modestly unless wishlists are high before launch: tens
of thousands of wishlists is a strong launch, a few thousand is normal. That is why the store page, the trailer and a demo come early, and why
the game loop (stage 1) matters more than the lighting (stage 3): people who play one shift and want another are the ones who tell their friends.
