# Steam achievements

The game knows 15 achievements (`dist/achievements.mjs`). Steamworks has to be told about the same ones, by hand, before the game is
released: **Steamworks > your app > Stats & Achievements > Achievements > Edit**, then **Add** for each row below. `dist/achievements.mjs` and this table are
kept in step by `achievements-check.mjs`, which fails if one has an achievement the other does not.

- **API Name** is the first column, exactly as written (capital letters and underscores). The game calls Steam with it.
- **Display Name** and **Description** are the next two columns (what a player sees in Steam; the game shows the same words).
- **Hidden** can stay off. (Hiding the incident ones is a design choice: a hidden achievement shows as "?" until it is earned.)
- Each needs two pictures, **256 x 256**, JPG or PNG: the achievement as earned, and a greyed-out one for before. The last column is only a
  suggestion of the picture (the emoji the game shows on its toast); real art replaces it.
- After saving, open the **Publish** tab of the app in Steamworks and publish the changes: until then the game's unlock calls are ignored.

| API Name | Display Name | Description | Idea for the picture |
| --- | --- | --- | --- |
| `FIRST_SHIFT` | Clocked in | Finish your first shift. | 🏁 |
| `FIRST_STAR` | Rising star | Earn a star on a shift. | ⭐ |
| `THREE_STARS` | Pool legend | Earn all three stars on one shift. | 🌟 |
| `CLUB_CLEARED` | Community hero | Earn a star on all ten levels of the Community Pools. | 🏊 |
| `ALL_LEVELS` | Season ticket | Earn a star on every level. | 🏆 |
| `OCEAN_FUND` | Beach bound | Fill the Ocean Fund and take Marina to the sea. | 🌊 |
| `RESCUE` | Lifeguard | Rescue a swimmer with a cramp. | 🛟 |
| `CLEANUP` | Spotless | Clean up after an accident in the pool. | 🧽 |
| `FISH_STOPPED` | Not on my watch | Stop the fish kid before he reaches the edge. | 🪣 |
| `FISH_CAUGHT` | Gone fishing | Net the fish that got loose in the pool. | 🐟 |
| `DOG_OUT` | Good dog | Lead the loose dog out of a door. | 🐶 |
| `RED_CARD` | Red card | Red-card a cannonball man before he reaches the edge. | 🟥 |
| `KAREN_CALMED` | Customer service | Calm Karen down. | 😌 |
| `BREAKER` | Lights on | Reset the breaker before the lights go out. | ⚡ |
| `HEALED` | Patched up | Patch up a swimmer hurt in a trampoline crash. | 🩹 |

## Trying them before the game has its own app

Valve's test app, **Spacewar (480)**, has its own achievements, so unlocking these ids there does nothing visible. To see a real unlock: create the
achievements on your own app first, put its app id in `desktop/steam.config.json`, run the Steam client, and start the desktop app (`desktop/README.md`).
Steam shows its own "achievement unlocked" pop-up over the game, and the achievement is listed on your profile. To try one again, the Steam
client's own console (open `steam://open/console` in a browser) has `achievement_clear <appid> <API name>` and `reset_all_stats <appid>`, which clear
achievements for your own account (check Valve's documentation if they have changed).
