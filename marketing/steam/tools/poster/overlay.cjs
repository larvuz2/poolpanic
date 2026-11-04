// node overlay.cjs in.jpg out.png '{"karen":[x,y],"marco":[x,y],"waters":[x,y],"burst":[x,y]}'
// Karen's shout (a comic burst), Marco's anger mark and Waters' sweat, drawn over a poster in the brand's type and colours.
const { chromium } = require("playwright");
const fs = require("fs");
const [inp, out, js] = process.argv.slice(2);
const P = JSON.parse(js);
const font = "data:font/woff2;base64," + fs.readFileSync("/home/user/poolpanic/dist/assets/fonts/barlow-condensed-900.woff2").toString("base64");
const img = "data:image/jpeg;base64," + fs.readFileSync(inp).toString("base64");
const star = (cx, cy, r1, r2, n, rot) => {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n, r = i % 2 ? r2 * (0.88 + 0.12 * Math.sin(i * 7.3)) : r1 * (0.92 + 0.08 * Math.cos(i * 3.1));
    pts.push([cx + Math.cos(a) * r * 1.45, cy + Math.sin(a) * r]);
  }
  return pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ");
};
const [kx, ky] = P.karen, [bx, by] = P.burst, [mx, my] = P.marco, [wx, wy] = P.waters;
// the tail: from the burst's edge toward Karen's mouth
const ang = Math.atan2(ky - by, kx - bx), nx = -Math.sin(ang), ny = Math.cos(ang);
const tx0 = bx + Math.cos(ang) * 110, ty0 = by + Math.sin(ang) * 70;
const tail = `${(tx0 + nx * 26).toFixed(1)},${(ty0 + ny * 26).toFixed(1)} ${(kx - Math.cos(ang) * 40).toFixed(1)},${(ky - Math.sin(ang) * 40).toFixed(1)} ${(tx0 - nx * 26).toFixed(1)},${(ty0 - ny * 26).toFixed(1)}`;
const vein = (x, y, s) => [0, 1, 2, 3].map((k) => {
  const a = (k * Math.PI) / 2 + Math.PI / 4, cx = x + Math.cos(a) * 15 * s, cy = y + Math.sin(a) * 15 * s;
  return `<path d="M ${cx - Math.cos(a + Math.PI / 2) * 13 * s} ${cy - Math.sin(a + Math.PI / 2) * 13 * s} Q ${x + Math.cos(a) * 4 * s} ${y + Math.sin(a) * 4 * s} ${cx + Math.cos(a + Math.PI / 2) * 13 * s} ${cy + Math.sin(a + Math.PI / 2) * 13 * s}" />`;
}).join("");
const drop = (x, y, s, r) => `<path transform="translate(${x} ${y}) rotate(${r}) scale(${s})" d="M0,-22 C8,-8 14,0 14,8 A14,14 0 1 1 -14,8 C-14,0 -8,-8 0,-22 Z" />`;
const html = `<!doctype html><html><head><style>
@font-face { font-family: B; src: url(${font}); font-weight: 900; }
body { margin: 0; } .w { position: relative; width: 1920px; height: 1080px; }
img { position: absolute; inset: 0; width: 1920px; height: 1080px; } svg { position: absolute; inset: 0; }
</style></head><body><div class="w"><img src="${img}"><svg width="1920" height="1080" viewBox="0 0 1920 1080">
<g fill="#022763"><polygon points="${tail}" transform="translate(5 6)"/><polygon points="${star(bx, by, 112, 80, 13, 0.2)}" transform="translate(6 7)"/></g>
<polygon points="${tail}" fill="#fdd106" stroke="#022763" stroke-width="6" stroke-linejoin="round"/>
<polygon points="${star(bx, by, 112, 80, 13, 0.2)}" fill="#fdd106" stroke="#022763" stroke-width="6" stroke-linejoin="round"/>
<g transform="rotate(-8 ${bx} ${by})" font-family="B" font-weight="900" text-anchor="middle" fill="#022763">
  <text x="${bx}" y="${by - 4}" font-size="46" letter-spacing="1">BLAH BLAH</text>
  <text x="${bx}" y="${by + 46}" font-size="56" fill="#c62828" stroke="#022763" stroke-width="2" letter-spacing="2">BLAH!!</text>
</g>
<g fill="none" stroke="#c62828" stroke-width="9" stroke-linecap="round">${vein(mx + P.vein[0], my + P.vein[1], 1.0)}</g>
<g fill="#7fd3ff" stroke="#022763" stroke-width="3.5">${drop(wx - 72, wy + 22, 1.0, -25)}${drop(wx - 92, wy + 62, 0.7, -35)}${drop(wx + 66, wy + 8, 0.85, 20)}</g>
</svg></div></body></html>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.setContent(html, { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  await p.screenshot({ path: out });
  await b.close();
})();
