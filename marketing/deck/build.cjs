// The investor deck (19 November 2026): deck.html, ten 1920×1080 pages, printed to a PDF by the browser.
//
//   node marketing/deck/build.cjs            (writes marketing/deck/out/pool-panic-deck.pdf and a picture of every page)
//
// The game's own pictures are in the repo (img/, ../steam/, ../../dist/assets/). What is not ours (the team's photos and the
// studio's logo from its site, the comparable games' Steam headers, the Steam logo) is fetched once into .cache/, which git
// ignores: it is used in the deck, never kept in the public repo.
const { chromium } = require("playwright"); // (CommonJS, as marketing/steam/tools: the machine's own Playwright)
const { mkdirSync, existsSync, writeFileSync } = require("node:fs");
const { pathToFileURL } = require("node:url");
const { join } = require("node:path");

const HERE = __dirname;
const CACHE = join(HERE, ".cache");
const OUT = join(HERE, "out");
const MEDIA = "https://qklfhhmfwsgghxyrpeve.supabase.co/storage/v1/object/public/Media_Pics/";
const STEAM = (id) => `https://cdn.akamai.steamstatic.com/steam/apps/${id}/header.jpg`;
const REMOTE = {
  "paul.jpg": MEDIA + "/Paul.jpeg",
  "gus.jpg": MEDIA + "/gus.jpeg",
  "kali.jpg": MEDIA + "/Kali.jpeg",
  "phatty-logo.png": MEDIA + "/PhattyLOGO.png",
  "overcooked2.jpg": STEAM(728880),
  "plateup.jpg": STEAM(1599600),
  "twopoint.jpg": STEAM(535930),
  "movingout.jpg": STEAM(996770),
  "dearpassengers.jpg":
    "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/4534960/7ddef53346afe3e3d4d479dbed740cdb38cfe09a/header.jpg",
  "steam.svg": "https://cdn.jsdelivr.net/npm/simple-icons@13.21.0/icons/steam.svg",
};

(async () => {
  mkdirSync(CACHE, { recursive: true });
  mkdirSync(join(OUT, "pages"), { recursive: true });
  for (const [name, url] of Object.entries(REMOTE)) {
    const file = join(CACHE, name);
    if (existsSync(file)) continue;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${name}: ${res.status} from ${url}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    console.log("fetched", name);
  }

  // (file pages may read file pictures: they are resampled through a canvas below)
  const browser = await chromium.launch({ args: ["--allow-file-access-from-files"] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const problems = [];
  page.on("requestfailed", (r) => problems.push("failed: " + r.url()));
  page.on("pageerror", (e) => problems.push("error: " + e.message));
  await page.goto(pathToFileURL(join(HERE, "deck.html")).href, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const broken = await page.evaluate(() =>
    [...document.images].filter((i) => !i.complete || !i.naturalWidth).map((i) => i.getAttribute("src")),
  );
  if (broken.length) problems.push("images that did not load: " + broken.join(", "));
  // (every page must hold its content: nothing spilling past its 1920×1080)
  const spill = await page.evaluate(() =>
    [...document.querySelectorAll(".page")].flatMap((p, i) => {
      const box = p.getBoundingClientRect();
      return [...p.querySelectorAll("*")]
        .filter((el) => !el.closest(".bleed"))
        .filter((el) => {
          const b = el.getBoundingClientRect();
          return b.width && (b.right > box.right + 1 || b.bottom > box.bottom + 1);
        })
        .slice(0, 3)
        .map((el) => `page ${i + 1}: ${el.tagName.toLowerCase()}.${el.className}`);
    }),
  );
  problems.push(...spill.map((s) => "spills: " + s));

  // Every picture made only as big as the page shows it, twice over (a PDF to send by email, not a print master): JPEG for the
  // photographs, PNG for what has a transparent background.
  const resampled = await page.evaluate(async () => {
    let n = 0;
    for (const img of document.images) {
      const r = img.getBoundingClientRect();
      const scale = Math.min(1, 2 * Math.max(r.width / img.naturalWidth, r.height / img.naturalHeight));
      const jpeg = img.getAttribute("src").toLowerCase().endsWith(".jpg");
      if (jpeg && scale > 0.85) continue; // (a JPEG goes into the PDF as it is)
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      const g = c.getContext("2d");
      g.imageSmoothingQuality = "high";
      g.drawImage(img, 0, 0, c.width, c.height);
      // (a WebP or PNG with nothing transparent in it is a photograph too)
      const alpha = g.getImageData(0, 0, c.width, c.height).data;
      let opaque = true;
      for (let i = 3; i < alpha.length && opaque; i += 4) opaque = alpha[i] === 255;
      img.src = c.toDataURL(opaque ? "image/jpeg" : "image/png", 0.86);
      await img.decode();
      n++;
    }
    return n;
  });
  console.log(resampled, "pictures resampled to the size they are shown at");
  const pages = await page.$$(".page");
  for (const [i, el] of pages.entries())
    await el.screenshot({ path: join(OUT, "pages", String(i + 1).padStart(2, "0") + ".png") });
  const pdf = join(OUT, "pool-panic-deck.pdf");
  await page.pdf({
    path: pdf,
    width: "1920px",
    height: "1080px",
    printBackground: true,
    preferCSSPageSize: true,
  });
  await browser.close();
  console.log(`${pages.length} pages → ${pdf}`);
  if (problems.length) {
    console.log(problems.join("\n"));
    process.exitCode = 1;
  }
})();
