# The Steam page kit (4 November 2026)

Everything for Pool Panic's Steam store page, ready to upload once the Steamworks account and app exist: five capsule proposals, seventeen
staged screenshots, ten ultra-wide clips for the About section, the short and long descriptions, tags, a brand book and a launch plan.
`index.html` is the review page (open it in a browser: every picture, clip and text below in one place). No trailer yet, on purpose (the
creator: "we'll do that later").

## What is here

| Folder | What | Steam's spec |
| --- | --- | --- |
| `caps/` | Five capsule proposals, each as `-main` (1232×706), `-header` (920×430), `-small` (462×174), and the small one at 184×69 and 120×45 to judge legibility | Store Presence > Graphical Assets; only art, the title and an official subtitle on a capsule |
| `shots/` | Seventeen screenshots (`01`–`17`, numbered as they were made; the order to upload is below), 1920×1080, no interface | 16:9, ≥ 1920×1080, gameplay only, at least 4 marked all ages (all are) |
| `clips/` | Ten About-section clips, 1170×260 (the dive 1170×300), as GIF and MP4 | ≤ 5 MB each, ≤ 15 MB for the page, ≤ 12 s; GIFs become looping video |
| `store/` | `short.txt` (three short descriptions, ≤ 300 characters), `about.bbcode` (the About section, ready to paste), `tags.txt` (20 tags) | |
| `brand/` | The logo as the game ships it, and two alternate-name logos in its style (`alt-coach-waters.png`, `alt-pool-patrol.png`), references only: the game is still Pool Panic | |
| `tools/` | How every picture was made, to make more: `photo.cjs` (stage a moment in the real game and photograph it, or film it frame by frame), `shots/*.json` and `gifs/*.json` (one file a moment), `mk.sh` (frames to GIF/MP4/WEBM), `compose.py` + `concepts.json` (capsule art + the real logo at Steam's sizes), `queue.sh` (two renders at a time) | |

## The picks

- **Capsule: 1, Panic Face** (Coach Waters' panicked face, the dog, Carl and the fish kid behind him). 2, Cannonball! is the runner-up. 4, Date
  Night tells the story (good for the library hero or a seasonal capsule); 5, Co-op Crew suits a co-op push (Next Fest, a co-op update).
- **Short description: A** ("You are Coach Waters, the only lifeguard at 14 ridiculous pools…", 258 characters).
- **Screenshot order (files):** 01 Carl's cannonball, 13 three coaches closing in on the dog, 06 the cruise ship's rogue swell, 11 the whole
  cast in a row (the first four show on hover across the store), then 15 the coach chasing the dog, 16 the rescue dive with the life ring,
  17 a poo clearing the pool, 12 the VIP lineup, 14 three coaches on the rolling deck, 03 Karen, 05 the rooftop selfie, 07 the monster wave,
  10 three coaches sprinting, 08 the monkey in the hot spring, 09 the diver off the 6 m board, 04 the Gala's power cut, 02 the dog with the fins.
- **Clip order in the About section:** hero (Carl), shift, lineup, incidents (the dog), panic, co-op, venues (the cruise ship), dive, Marina,
  never.

## How the pictures were made

Every screenshot and clip is the real game (`dist/`) in Chromium, software-rendered under Xvfb: `photo.cjs` starts a free-play shift, runs a
shot's `setup` (spawn swimmers, trigger an incident), fast-forwards the simulation until its `until` is true, freezes it, places the people
and the camera by hand (`after`, `cameras`), hides the interface and the coach's rings, and photographs. The lineups (`tools/lib.js`, pasted into a shot's `after`) clear the deck, stand the cast in a row and pin each one's animation to a clip of its own. A clip (`gif`) installs Playwright's
clock before the page loads, pauses it, and steps it `step` ms a frame, so every frame is the same slice of game time however slow the
renderer is. The capsule art is GPT Image 2.5 (fal, `openai/gpt-image-2.5/flare/edit`) with the game's own character pictures as references
(Coach Waters, Carl, Karen, the dog, Marina, Coaches Rivers and Storm); `compose.py` lays the real logo on top. Nothing was checked on a
real Steam page, and the colours were judged on this machine's screen only.

To make another: serve the game (`npm start`, port 8000), then from this folder `POOL_URL=http://localhost:8000 node tools/photo.cjs
tools/shots/s01.json` (under `xvfb-run -a` on a machine without a screen; the paths in a shot's `out` are relative to where it runs).

## The brand book (short)

- **Logo:** `brand/logo.webp` as it is (only 640 wide: a 2560-wide or vector master is needed for the library logo). Clear space of an "O" all
  round; over sky, water or the deep-pool navy; never stretched, recoloured or set over a face.
- **Colour:** Panic Yellow `#fdd106`, Lifeguard Navy `#022763`, Splash Cyan `#19b1f8`, Sunburn `#b54c05`, Cap Red `#c62828` (sampled from the
  logo and Coach Waters); the game's interface tokens Deep Pool `#092b38`, Ink `#103b48`, Lane Teal `#15717b`, Mint `#a9e6db`, Cream
  `#fff4cf`, Alert `#ff5a3c`; Pool Water `#3fc6d8`.
- **Type:** Barlow Condensed 800 in capitals for headlines, DM Sans for text (both bundled with the game).
- **Voice:** deadpan about the chaos, warm about Coach Waters and Marina, specific (185 metres, lane three), short sentences, British spelling.
  The coaches never speak, in the game or in the marketing.
- **Pictures:** one joke a screenshot, the "uh-oh" second; clips 1170×260, 4–7 s, looping, no text baked in; key art in one colour family with
  the red cap as the hot spot, our characters only, room left for the logo.

## The plan (proposed; the dates are the creator's)

1. **November 2026:** the Steamworks account and app fee, the app id; this kit uploaded; the Coming Soon page submitted (English and Simplified
   Chinese store text). Wishlists start the day it is public.
2. **December – March:** two vertical clips a week from the incidents (TikTok, Shorts, Reels); the trailer; third-party festivals that fit;
   creators who play Overcooked, PlateUp! and Two Point (Keymailer). Target 5,000 wishlists by March.
3. **By 25 April 2027:** register for the June Next Fest (one per game, ever); trailer for Valve's video by 3 May; demo in review by 10 May.
4. **Late May:** the public demo (one week of the run with co-op), about three weeks before the fest.
5. **14–21 June 2027:** Steam Next Fest. Target 15,000 wishlists by its end.
6. **September 2027:** launch at $14.99 with 15% off for the first week. Target 25,000 wishlists on the day (first-month sales now run
   about 0.22 a wishlist).

What only the creator can do: the Steamworks account and fee, the app id, the price and date, written proof that every AI tool used allows
commercial use (Meshy, Tripo, fal's models, ElevenLabs), and the AI disclosure in the content survey.

The research behind all this (Steam's documentation and the pages of fifteen comparable games, read on 4 November 2026) is summarised in
`index.html`'s last section.
