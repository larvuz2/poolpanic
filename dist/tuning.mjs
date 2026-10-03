// URL switches that take one suspect out of the game at a time, for isolating a crash on a device (see the README).
// The crash hunt (bisect.mjs) supplies the same switches itself, one test at a time. Pure: no DOM, no globals.
//
//   nosound      the audio never starts            noparticles  no splashes, sparkles, bursts or confetti
//   dpr=N        cap the pixel ratio at N          nohands      no first-person hands layer (Coach Cam)
//   noshadow     no shadow maps                    nohall       the indoor hall and roof stay hidden
//   nolights     no point or spot lights           nopoints     no glow points (lamp halos, dust, fireflies)
//   noaa         no antialiasing                   overview     the overview camera, whatever the setting
//   nomodels     the classic coach, swimmers, kid, Carl, fish and Karen: no character model is fetched or drawn (for this page
//                only: unlike ?coach=classic and ?swimmers=classic it is not remembered)
//   safe         all of the above off at once (except dpr and overview)
//
// The hands layer crashed an iPad's Safari (see the README), so Safari's engine leaves it off unless `hands` is
// given. The rest look inside it: handsnodepth (no depth clear before it), handsnoenv (no shared reflections),
// handsnotorch (no lights of its own), handsbasic (unlit colours), handsinline (drawn in the room's own pass).

export const SAFE = [
  "nosound",
  "noshadow",
  "noparticles",
  "nohands",
  "nohall",
  "nolights",
  "nopoints",
  "noaa",
  "nomodels",
];
const HANDS = ["hands", "handsnodepth", "handsnoenv", "handsnotorch", "handsbasic", "handsinline"];
const KNOWN = new Set([...SAFE, ...HANDS, "safe", "overview", "dpr"]);

// Safari and every other browser that draws with Apple's WebKit (all browsers on an iPhone or iPad), which is
// where the hands layer crashed.
export function isWebKit(userAgent = "") {
  const ua = String(userAgent);
  return /AppleWebKit/.test(ua) && (!/Chrome|Chromium|Edg|Android/.test(ua) || /CriOS|FxiOS|EdgiOS/.test(ua));
}

export function readTuning(search = "", extra = []) {
  const query = new URLSearchParams(search),
    flags = new Set(extra);
  for (const key of query.keys()) flags.add(key);
  if (flags.has("safe")) for (const key of SAFE) flags.add(key);
  return {
    has: (name) => flags.has(name),
    // A number from the address (`dpr=1`), or the fallback when it is missing or not a number.
    number: (name, fallback) => {
      const n = Number(query.get(name));
      return query.has(name) && Number.isFinite(n) && n > 0 ? n : fallback;
    },
    // The switches in force (not the other things an address may carry, like ?trial).
    list: () => [...flags].filter((name) => KNOWN.has(name)),
  };
}
