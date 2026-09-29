// Painted canvas art for the halls: regatta signal flags, club banners, signs. Everything is drawn from code so a
// venue always looks the same and the CPU checks stay deterministic.
import { THREE } from "./kit.mjs";

function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
function texture(c, { srgb = true, repeat = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// Twelve signal-flag designs in a 4 × 3 atlas. `flagCell(i)` names a cell for `flagGeo`.
export const FLAG_COLS = 4;
export const FLAG_ROWS = 3;
const FLAGS = [
  (c, w, h) => bands(c, w, h, ["#d7263d", "#fffaf0", "#1b4f9c"], false),
  (c, w, h) => bands(c, w, h, ["#1c8c4a", "#fffaf0", "#d7263d"], true),
  (c, w, h) => {
    c.fillStyle = "#1b4f9c";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#ffd23f";
    c.fillRect(w * 0.28, 0, w * 0.14, h);
    c.fillRect(0, h * 0.4, w, h * 0.2);
  },
  (c, w, h) => {
    c.fillStyle = "#fffaf0";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#d7263d";
    c.beginPath();
    c.arc(w / 2, h / 2, h * 0.3, 0, Math.PI * 2);
    c.fill();
  },
  (c, w, h) => {
    for (let i = 0; i < 7; i++) {
      c.fillStyle = i % 2 ? "#fffaf0" : "#d7263d";
      c.fillRect(0, (i * h) / 7, w, h / 7 + 1);
    }
    c.fillStyle = "#1b4f9c";
    c.fillRect(0, 0, w * 0.45, (h * 4) / 7);
    c.fillStyle = "#fffaf0";
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 2; j++) dot(c, w * (0.1 + i * 0.13), h * (0.14 + j * 0.2), 4);
  },
  (c, w, h) => {
    c.fillStyle = "#ffd23f";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#1c2a3a";
    c.beginPath();
    c.moveTo(w, 0);
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.closePath();
    c.fill();
  },
  (c, w, h) => {
    const cols = 6,
      rows = 4;
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        c.fillStyle = (i + j) % 2 ? "#fffaf0" : "#1c2a3a";
        c.fillRect((i * w) / cols, (j * h) / rows, w / cols + 1, h / rows + 1);
      }
  },
  (c, w, h) => {
    c.fillStyle = "#1c8c4a";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#ffd23f";
    c.beginPath();
    c.moveTo(w / 2, h * 0.12);
    c.lineTo(w * 0.86, h / 2);
    c.lineTo(w / 2, h * 0.88);
    c.lineTo(w * 0.14, h / 2);
    c.closePath();
    c.fill();
    c.fillStyle = "#1b4f9c";
    dot(c, w / 2, h / 2, h * 0.2);
  },
  (c, w, h) => {
    c.fillStyle = "#1b4f9c";
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "#fffaf0";
    c.lineWidth = h * 0.09;
    for (let k = 0; k < 3; k++) {
      c.beginPath();
      for (let x = 0; x <= w; x += 4) {
        const y = h * (0.28 + k * 0.22) + Math.sin(x * 0.11 + k) * h * 0.07;
        x ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.stroke();
    }
  },
  (c, w, h) => {
    c.fillStyle = "#d7263d";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#fffaf0";
    c.fillRect(w * 0.42, h * 0.16, w * 0.16, h * 0.68);
    c.fillRect(w * 0.26, h * 0.42, w * 0.48, h * 0.16);
  },
  (c, w, h) => {
    c.fillStyle = "#118c94";
    c.fillRect(0, 0, w / 2, h);
    c.fillStyle = "#ee8864";
    c.fillRect(w / 2, 0, w / 2, h);
    c.fillStyle = "#fffaf0";
    dot(c, w / 2, h / 2, h * 0.24);
  },
  (c, w, h) => {
    c.fillStyle = "#3593c1";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#ffd23f";
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      c.beginPath();
      c.moveTo(w / 2, h / 2);
      c.lineTo(w / 2 + Math.cos(a - 0.09) * w, h / 2 + Math.sin(a - 0.09) * w);
      c.lineTo(w / 2 + Math.cos(a + 0.09) * w, h / 2 + Math.sin(a + 0.09) * w);
      c.fill();
    }
    dot(c, w / 2, h / 2, h * 0.2);
  },
];
function bands(c, w, h, colors, vertical) {
  colors.forEach((color, i) => {
    c.fillStyle = color;
    if (vertical) c.fillRect((i * w) / colors.length, 0, w / colors.length + 1, h);
    else c.fillRect(0, (i * h) / colors.length, w, h / colors.length + 1);
  });
}
function dot(c, x, y, r) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}

export function flagAtlas() {
  const cw = 128,
    ch = 84,
    cv = canvas(cw * FLAG_COLS, ch * FLAG_ROWS),
    c = cv.getContext("2d");
  FLAGS.forEach((draw, i) => {
    c.save();
    c.translate((i % FLAG_COLS) * cw, Math.floor(i / FLAG_COLS) * ch);
    c.beginPath();
    c.rect(0, 0, cw, ch);
    c.clip();
    draw(c, cw, ch);
    c.restore();
  });
  return texture(cv);
}
export const FLAG_COUNT = FLAGS.length;
// UV window of one design: [column, row, columns, rows].
export const flagCell = (i) => [i % FLAG_COLS, Math.floor(i / FLAG_COLS) % FLAG_ROWS, FLAG_COLS, FLAG_ROWS];

// A tall club banner: a coloured field with a gold border, a wave crest and stacked lettering.
export function bannerTexture({
  color = "#118c94",
  trim = "#f4c849",
  lines = ["SWIM", "CLUB"],
  sub = "EST. 1986",
  ink = "#fff6e4",
} = {}) {
  const w = 256,
    h = 704,
    cv = canvas(w, h),
    c = cv.getContext("2d");
  c.fillStyle = color;
  c.fillRect(0, 0, w, h);
  c.strokeStyle = trim;
  c.lineWidth = 10;
  c.strokeRect(14, 14, w - 28, h - 28);
  c.lineWidth = 3;
  c.strokeRect(30, 30, w - 60, h - 60);
  // Crest: a cream disc with three rolling waves.
  c.fillStyle = ink;
  dot(c, w / 2, 150, 82);
  c.strokeStyle = color;
  c.lineWidth = 11;
  c.lineCap = "round";
  for (let k = 0; k < 3; k++) {
    c.beginPath();
    for (let x = -52; x <= 52; x += 4) {
      const y = 116 + k * 30 + Math.sin(x * 0.075 + k * 1.3) * 9;
      x === -52 ? c.moveTo(w / 2 + x, y) : c.lineTo(w / 2 + x, y);
    }
    c.stroke();
  }
  c.fillStyle = ink;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = "900 84px Arial";
  lines.forEach((t, i) => c.fillText(t, w / 2, 320 + i * 96, w - 70));
  c.fillStyle = trim;
  c.font = "900 30px Arial";
  c.fillText(sub, w / 2, 560, w - 70);
  // Tassels.
  c.fillStyle = trim;
  for (let i = 0; i < 5; i++) c.fillRect(46 + i * 40, h - 30, 14, 26);
  return texture(cv);
}

// A wall sign: coloured plate, big lettering, optional small line beneath.
export function signTexture({
  text,
  sub,
  bg = "#0f7d4b",
  fg = "#ffffff",
  w = 512,
  h = 192,
  font = 110,
  arrow = false,
}) {
  const cv = canvas(w, h),
    c = cv.getContext("2d");
  c.fillStyle = bg;
  c.fillRect(0, 0, w, h);
  c.strokeStyle = fg;
  c.lineWidth = 6;
  c.strokeRect(8, 8, w - 16, h - 16);
  c.fillStyle = fg;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = `900 ${font}px Arial`;
  c.fillText(text, arrow ? w * 0.6 : w / 2, sub ? h * 0.42 : h / 2, w * 0.7);
  if (sub) {
    c.font = "800 34px Arial";
    c.fillText(sub, w / 2, h * 0.8, w * 0.8);
  }
  if (arrow) {
    c.beginPath();
    c.moveTo(w * 0.1, h / 2);
    c.lineTo(w * 0.24, h * 0.24);
    c.lineTo(w * 0.24, h * 0.42);
    c.lineTo(w * 0.34, h * 0.42);
    c.lineTo(w * 0.34, h * 0.58);
    c.lineTo(w * 0.24, h * 0.58);
    c.lineTo(w * 0.24, h * 0.76);
    c.closePath();
    c.fill();
  }
  return texture(cv);
}

// Bright sky seen through glass: a soft vertical gradient with a few hazy clouds.
export function skylightTexture({ top = "#9fd6f0", bottom = "#fff7e0", clouds = true, stars = false } = {}) {
  const cv = canvas(128, 128),
    c = cv.getContext("2d"),
    g = c.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  c.fillStyle = g;
  c.fillRect(0, 0, 128, 128);
  if (stars) {
    c.fillStyle = "rgba(255,246,220,0.95)";
    for (const [x, y, r] of [
      [18, 22, 1.6],
      [46, 54, 1.2],
      [78, 18, 1.8],
      [104, 46, 1.3],
      [30, 88, 1.4],
      [64, 76, 1.7],
      [96, 104, 1.2],
      [116, 14, 1.1],
    ]) {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = "rgba(255,244,210,0.95)";
    c.beginPath();
    c.arc(92, 86, 9, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = top;
    c.beginPath();
    c.arc(97, 82, 8, 0, Math.PI * 2);
    c.fill();
  }
  if (clouds) {
    c.fillStyle = "rgba(255,255,255,0.55)";
    for (const [x, y, r] of [
      [30, 40, 20],
      [58, 34, 26],
      [92, 44, 18],
      [70, 84, 22],
      [28, 96, 16],
    ]) {
      c.beginPath();
      c.ellipse(x, y, r * 1.6, r * 0.8, 0, 0, Math.PI * 2);
      c.fill();
    }
  }
  return texture(cv);
}

// A scoreboard face: dark plate with a title row and lane lines.
export function timingBoardTexture({ title = "TIMING", lanes = 5 } = {}) {
  const w = 768,
    h = 256,
    cv = canvas(w, h),
    c = cv.getContext("2d");
  c.fillStyle = "#101a26";
  c.fillRect(0, 0, w, h);
  c.fillStyle = "#ffd23f";
  c.font = "900 44px Arial";
  c.textAlign = "left";
  c.textBaseline = "middle";
  c.fillText(title, 24, 34);
  c.font = "800 34px monospace";
  for (let i = 0; i < lanes; i++) {
    const y = 84 + i * 34;
    c.fillStyle = "#fff6e4";
    c.fillText(`LANE ${i + 1}`, 24, y);
    c.fillStyle = i % 2 ? "#79e0a0" : "#ffd23f";
    c.fillText(`00:${String(31 + i * 3).padStart(2, "0")}.${String(12 + i * 17).slice(-2)}`, 470, y);
  }
  return texture(cv);
}
