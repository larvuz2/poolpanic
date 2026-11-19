# The investor deck (19 November 2026)

Ten 16:9 pages for investors who look the game up, in the poster's style (the creator's "What if your friends controlled a
pool?" poster: paper, heavy condensed capitals, yellow brush highlights) with the brand book's colours and the game's two
typefaces. Asked for "very visual and clear… they won't spend a lot of time reading": one idea a page, the game's own pictures,
the incident stickers, as few words as will do.

    node marketing/deck/build.cjs      (writes out/pool-panic-deck.pdf and out/pages/01..10.png; about 20 s)

| Page | What it says | Pictures |
| --- | --- | --- |
| 1 | What if your friends controlled a pool? 💀 Up to 3 players, perfect for friend groups | the logo, the C1 "panic" key art |
| 2 | You are the only lifeguard: sort, rescue, handle, survive | four Steam screenshots, five intro-cinematic freak-outs |
| 3 | One more shift: the loop (a door, the shift, the pay, a perk, the Sunday date) | a venue, a freak-out, the coin, Marina's dinner |
| 4 | Co-op chaos sells: Overcooked! 2, Two Point Hospital, PlateUp!, Moving Out, Dear Passengers | their Steam headers, ours |
| 5 | Meet the regulars: 30+ characters, 6 coaches, the guests | the cast poster, the coaches, stickers |
| 6 | 25 ways to panic: every incident in a few words | the 25 stickers |
| 7 | 14 pools, 14 rule books | each venue's intro-cinematic sweep |
| 8 | Not a one-prompt game: the work in numbers | |
| 9 | A team of three: Gustavo Garza, Paul Limon, Manuel R. Kali; Phatty Acid | their photos, the studio's logo |
| 10 | Coming to Steam: the Next Fest timeline, the price, co-op, after launch | the Steam logo, the C5 "crew" key art |

- **What is in the repo and what is not.** `deck.html` reads the game's own pictures where they are (`../../dist/assets/`,
  `../steam/`) and `img/` (the intro cinematic's frames, cropped out of its letterbox: every venue's sweep and freak-out, and
  Marina's face from her story picture). The team's photos and the studio's logo (the creator's links), the comparable games'
  Steam headers and the Steam logo (Simple Icons) are fetched by the build into `.cache/`, which git ignores: they go into the
  PDF, never into the public repo. `out/` is ignored too: the PDF is sent, not committed.
- **The PDF is for email** (8.4 MB): the build resamples every picture to twice the size the page shows it (JPEG for anything
  opaque, PNG for the stickers and the coaches), and no picture has a CSS filter (Chromium prints a filtered picture as a big
  bitmap). It also fails on a picture that did not load or anything spilling off its page.
- **The numbers** (page 8) were counted on 19 November 2026: commits, pull requests, lines of code, checks, models, images and
  sounds from the repository (`git ls-files`); the tokens, agent actions and the creator's messages from the AI sessions' own
  logs added to the counts in the credits (README, "The main menu"), so they are at least. The review counts and prices (page 4)
  are the Steam store's that day; the Next Fest dates (page 10) are Valve's
  ([Steamworks: Next Fest, February 2027](https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/feb_2027)).
  The price, $14.99, is the brand book's proposal (`../steam/README.md`); the launch month is the creator's plan.
