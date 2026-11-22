# The investor deck (19 November 2026)

16:9 pages for investors who look the game up, in the poster's style (the creator's "What if your friends controlled a
pool?" poster: paper, heavy condensed capitals, yellow brush highlights) with the brand book's colours and the game's two
typefaces. Asked for "very visual and clear… they won't spend a lot of time reading": one idea a page, the game's own pictures,
the incident stickers, as few words as will do.

    node marketing/deck/build.cjs      (writes out/pool-panic-deck.pdf and out/pages/NN.png; about 30 s)

| Page | What it says | Pictures |
| --- | --- | --- |
| 1 | What if your friends controlled a pool? 💀 Up to 3 players, perfect for friend groups | the logo, the C1 "panic" key art |
| 2 | You are the only lifeguard: sort, rescue, handle, survive | four Steam screenshots, five intro-cinematic freak-outs |
| 3 | One more shift: the loop (a door, the shift, the pay, a perk, the Sunday date) | a venue, a freak-out, the coin, Marina's dinner |
| 4 | *(private)* The funding: what it buys and what comes first | |
| 5 | Bring two friends: what a crew plays today, what the full game adds | the six coaches |
| 6 | Win Next Fest: the campaign, and what success looks like (our targets) | key art, a freak-out, a screenshot |
| 7 | March 2027 on Steam: the timeline, the work left, the price | the Steam logo, the C3 key art |
| 8 | Why we believe in it | a screenshot, the stickers, four venues |
| 9 | Not a one-prompt game: the work in numbers | |
| 10 | *(private)* The team's track record: past projects, revenue, events | from the creator's own slides |
| 11 | A team of three: Gustavo Garza, Paul Limon, Manuel R. Kali; Phatty Acid | their photos, the studio's logo |
| 12 | Co-op chaos sells: Overcooked! 2, Two Point Hospital, PlateUp!, Moving Out, Dear Passengers | their Steam headers, ours |
| 13 | Meet the regulars: 30+ characters, 6 coaches, the guests | the cast poster, the coaches, stickers |
| 14 | 25 ways to panic: every incident in a few words | the 25 stickers |
| 15 | 14 pools, 14 rule books | each venue's intro-cinematic sweep |

Pages 4 to 8 answer, in order, what an interested investor asked on 22 November 2026: how the funding is used and what comes
first, what a group can play now and what the full game adds, the Next Fest campaign and what success looks like, the work left,
the date and the price, and what gives us confidence; page 10 is the past projects they asked for. The build numbers the pages
(each kicker's section number and each folio) as it prints, so a page added or left out renumbers the rest.

- **The private pages.** The funding ask and the team's past projects (their revenue, their clients, photos of people) are not for
  a public repo: they live in `private/pages.html` and `private/img/`, which git ignores, and the build puts each of its
  `<section data-slot>` into the `<template data-private>` of the same name in `deck.html`. Without that folder the deck prints
  without those two pages.
- **What is in the repo and what is not.** `deck.html` reads the game's own pictures where they are (`../../dist/assets/`,
  `../steam/`) and `img/` (the intro cinematic's frames, cropped out of its letterbox: every venue's sweep and freak-out, and
  Marina's face from her story picture). The team's photos and the studio's logo (the creator's links), the comparable games'
  Steam headers and the Steam logo (Simple Icons) are fetched by the build into `.cache/`, which git ignores: they go into the
  PDF, never into the public repo. `out/` is ignored too: the PDF is sent, not committed.
- **The PDF is for email** (about 10 MB): the build resamples every picture to twice the size the page shows it (JPEG for anything
  opaque, PNG for the stickers and the coaches), and no picture has a CSS filter (Chromium prints a filtered picture as a big
  bitmap). It also fails on a picture that did not load or anything spilling off its page.
- **The numbers** (page 8) were counted on 19 November 2026: commits, pull requests, lines of code, checks, models, images and
  sounds from the repository (`git ls-files`); the tokens, agent actions and the creator's messages from the AI sessions' own
  logs added to the counts in the credits (README, "The main menu"), so they are at least. The review counts and prices (page 4)
  are the Steam store's that day; the Next Fest dates (page 10) are Valve's
  ([Steamworks: Next Fest, February 2027](https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/feb_2027)).
  The price, $14.99, is the brand book's proposal (`../steam/README.md`); the launch month is the creator's plan.
