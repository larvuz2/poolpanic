// Achievements (achievements.mjs) and the shell bridge (platform.mjs): what earns each one, that each is earned once, that the list a
// build knows is the one Steamworks is told about, and that the bridge does nothing in a browser and passes calls on in the desktop app.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ACHIEVEMENTS, Achievements } from "./dist/achievements.mjs";
import {
  isDesktop,
  isSteam,
  platformName,
  quitGame,
  richPresence,
  setStat,
  unlockAchievement,
} from "./dist/platform.mjs";
import { SAVES } from "./dist/moments.mjs";

const make = (unlocked = []) => {
  const log = { kept: [], shown: [] };
  const a = new Achievements({
    unlocked,
    remember: (list) => log.kept.push(list),
    announce: (x) => log.shown.push(x.id),
  });
  return { a, log };
};

// ---- the list ---------------------------------------------------------------------------------------------------------------
{
  const ids = ACHIEVEMENTS.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length, "every id once");
  for (const a of ACHIEVEMENTS) {
    assert.match(a.id, /^[A-Z][A-Z0-9_]{2,40}$/, `${a.id}: an API name Steamworks takes`);
    assert.ok(
      a.name.length > 2 && a.name.length <= 40 && a.text.length > 10 && a.text.length <= 100,
      `${a.id}: a short name and text`,
    );
  }
  assert.ok(ACHIEVEMENTS.length >= 10, "enough for a store page to say 'achievements'");
  // The text Steamworks is typed from lists exactly these (desktop/steam/achievements.md).
  const doc = readFileSync("desktop/steam/achievements.md", "utf8");
  for (const a of ACHIEVEMENTS) {
    assert.ok(doc.includes("`" + a.id + "`"), `${a.id} is in desktop/steam/achievements.md`);
    assert.ok(doc.includes(a.name), `${a.id}'s name is too`);
  }
  assert.equal(
    [...doc.matchAll(/^\| `([A-Z0-9_]+)`/gm)].length,
    ACHIEVEMENTS.length,
    "and the document has no achievement the game does not",
  );
}

// ---- saves ---------------------------------------------------------------------------------------------------------------------
{
  const { a, log } = make();
  assert.equal(a.save("fish-stopped"), true, "stopping the fish kid earns one");
  assert.equal(a.save("fish-stopped"), false, "once");
  assert.deepEqual(log.shown, ["FISH_STOPPED"], "and it is announced once");
  assert.deepEqual(log.kept.at(-1), ["FISH_STOPPED"], "and kept");
  for (const [kind, id] of [
    ["rescue", "RESCUE"],
    ["cleanup", "CLEANUP"],
    ["fish-caught", "FISH_CAUGHT"],
    ["dog-out", "DOG_OUT"],
    ["red-card", "RED_CARD"],
    ["karen", "KAREN_CALMED"],
    ["breaker", "BREAKER"],
    ["healed", "HEALED"],
  ]) {
    assert.ok(SAVES[kind], `${kind} is a save the game reports`);
    assert.equal(a.save(kind), true, `${kind} earns ${id}`);
    assert.ok(a.has(id));
  }
  assert.equal(a.save("fish-returned"), false, "a lighter save earns nothing");
  assert.equal(a.save("nonsense"), false, "nor does one that is not a save");
}

// ---- shifts ----------------------------------------------------------------------------------------------------------------------
{
  const stars = new Map();
  const levelStars = (n) => stars.get(n) || 0;
  const { a } = make();
  a.shift({ stars: 0, levelStars });
  assert.ok(a.has("FIRST_SHIFT") && !a.has("FIRST_STAR"), "a shift finished, no star yet");
  stars.set(1, 1);
  a.shift({ stars: 1, levelStars });
  assert.ok(a.has("FIRST_STAR") && !a.has("THREE_STARS"));
  a.shift({ stars: 3, levelStars });
  assert.ok(a.has("THREE_STARS"));
  assert.ok(!a.has("CLUB_CLEARED"), "nine levels short");
  for (let n = 1; n <= 10; n++) stars.set(n, 1);
  a.shift({ stars: 1, levelStars });
  assert.ok(a.has("CLUB_CLEARED") && !a.has("ALL_LEVELS"), "the ten Community Pools");
  for (let n = 11; n <= 19; n++) stars.set(n, 2);
  a.shift({ stars: 1, levelStars });
  assert.ok(!a.has("ALL_LEVELS"), "one level short");
  stars.set(20, 1);
  a.shift({ stars: 1, levelStars });
  assert.ok(a.has("ALL_LEVELS"), "every level");
  // A drill is a shift finished, but not a level's star.
  const drill = make();
  drill.a.shift({ stars: 3, drill: true, levelStars });
  assert.deepEqual([...drill.a.done], ["FIRST_SHIFT"], "a drill earns no star");
  const fund = make();
  fund.a.fund();
  assert.ok(fund.a.has("OCEAN_FUND"));
}

// ---- keeping them --------------------------------------------------------------------------------------------------------------------
{
  const { a, log } = make(["RESCUE", "FROM_A_NEWER_BUILD", 7]);
  assert.deepEqual([...a.done], ["RESCUE"], "an id this build does not know is dropped");
  assert.equal(a.unlock("NOT_A_THING"), false, "and one cannot be earned");
  assert.equal(log.kept.length, 0, "nothing is written for nothing");
  assert.deepEqual(
    new Achievements({ unlocked: "garbage" }).list().filter((x) => x.done),
    [],
    "a damaged save is no achievements",
  );
  const told = [];
  a.replay((id) => told.push(id));
  assert.deepEqual(
    told,
    ["RESCUE"],
    "those already earned are told to the platform again, for Steam to keep",
  );
  assert.equal(a.list().length, ACHIEVEMENTS.length);
  assert.equal(a.list().filter((x) => x.done).length, 1);
}

// ---- the shell ---------------------------------------------------------------------------------------------------------------------
{
  assert.ok(!isDesktop() && !isSteam() && platformName() === "web", "in a browser there is no shell");
  for (const fn of [() => unlockAchievement("X"), () => setStat("n", 3), () => richPresence("hi"), quitGame])
    assert.doesNotThrow(fn, "and its calls do nothing");

  const calls = [];
  globalThis.desktop = {
    platform: "win32",
    steam: {
      available: true,
      unlock: (id) => calls.push(["unlock", id]),
      setStat: (name, value) => calls.push(["stat", name, value]),
      richPresence: (text) => calls.push(["presence", text]),
    },
    quit: () => calls.push(["quit"]),
  };
  assert.ok(isDesktop() && isSteam() && platformName() === "win32");
  unlockAchievement("RESCUE");
  setStat("shifts", 3.6);
  richPresence("Level 4");
  quitGame();
  assert.deepEqual(
    calls,
    [["unlock", "RESCUE"], ["stat", "shifts", 4], ["presence", "Level 4"], ["quit"]],
    "calls reach the app, stats as whole numbers",
  );

  globalThis.desktop = { steam: { available: false }, platform: "linux" };
  assert.ok(isDesktop() && !isSteam(), "a desktop app with no Steam running");
  assert.doesNotThrow(() => unlockAchievement("RESCUE"), "plays on without it");
  globalThis.desktop = {
    steam: {
      available: true,
      unlock() {
        throw new Error("steam is gone");
      },
    },
  };
  assert.doesNotThrow(() => unlockAchievement("RESCUE"), "even if the call throws");
  delete globalThis.desktop;
}

console.log(
  "Achievement checks passed: the list is unique and matches the Steamworks document, saves earn theirs once, shifts and stars, a damaged or newer save, and the shell bridge doing nothing in a browser and passing calls on in the desktop app.",
);
