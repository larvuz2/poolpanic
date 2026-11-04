// node photo.cjs shot.json  — stage a moment in the real game and photograph it.
// shot: { venue, level?, out, setup: "js run in page (s = sim, w = world, P = __pool)", until?: "js condition", wait?: ms,
//         freeze?: true, camera?: { pos:[x,y,z], at:[x,y,z], fov }, hud?: false, size?: [1920,1080], after?: "js" }
const { chromium } = require("playwright");
const fs = require("fs");
const shot = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
(async () => {
  const [W, H] = shot.size || [1920, 1080];
  const b = await chromium.launch({
    headless: false,
    args: ["--use-angle=gl", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"],
  });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => m.type() === "log" && m.text().startsWith("SHOT") && console.log(m.text()));
  if (shot.gif) await p.clock.install();
  await p.goto((process.env.POOL_URL || "http://localhost:8011") + "/?debug&dev=1" + (shot.query || ""));
  await p.waitForFunction(() => document.getElementById("loading")?.hidden, null, { timeout: 120000 });
  await p.mouse.click(W / 2, H / 2);
  await p.waitForTimeout(1500);
  await p.evaluate(([v, l]) => window.__pool.startFree(v, l || "hard"), [shot.venue, shot.level]);
  await p.waitForFunction(() => window.__pool.mode === "playing", null, { timeout: 240000 });
  await p.waitForTimeout(shot.settle ?? 2500);
  const lib = `
    const fill = (per = 2, types = ["intermediate", "beginner", "advanced"]) => {
      const out = [];
      s.lanes.forEach((x, lane) => { for (let k = 0; k < per; k++) {
        const q = s.spawn({ type: types[(lane + k) % types.length], sick: false });
        Object.assign(q, { status: "swim", lane, p: 3 + k * 13 + lane * 4, workTime: 5, traveled: 9, workTarget: 999, needsFins: false, crampAt: Infinity, h: 95 });
        out.push(q);
      } });
      return out;
    };`;
  const run = (code) =>
    p.evaluate(
      ([lib, code]) => {
        const P = window.__pool,
          s = P.sim,
          w = P.world;
        const AF = Object.getPrototypeOf(async function () {}).constructor;
        return new AF("P", "s", "w", lib + code)(P, s, w);
      },
      [lib, code],
    );
  if (shot.setup) console.log("setup:", JSON.stringify(await run(shot.setup)));
  if (shot.until) {
    const t0 = Date.now();
    while (Date.now() - t0 < (shot.untilMs || 120000)) {
      if (await run("return !!(" + shot.until + ")")) break;
      // (fast-forward: the software renderer is slow, so the simulation is ticked here as well, `ff` game seconds a check)
      if (shot.ff)
        await run(
          `for (let i = 0; i < ${Math.round(shot.ff * 60)}; i++) { s.tick(1 / 60); if (${shot.until}) break; } return true`,
        );
      await p.waitForTimeout(150);
    }
  }
  if (shot.wait) await p.waitForTimeout(shot.wait);
  if (shot.freeze) await run("s.__tick = s.tick; s.tick = () => {}; return true");
  let focus = [0, 0, 0];
  if (shot.after) {
    const r = await run(shot.after);
    console.log("after:", JSON.stringify(r));
    if (r && r.focus) focus = r.focus;
    if (r && r.cams) shot.cameras = r.cams;
  }
  if (shot.hud === false)
    await run(
      "for (const h of [w.coachHalo, w.actionHalo, w.dashTrail]) if (h) h.traverse((o) => { if (o.material) o.material.visible = false; }); return true;",
    );
  const rel = (c) =>
    c.rel ? { ...c, pos: c.pos.map((v, i) => v + focus[i]), at: c.at.map((v, i) => v + focus[i]) } : c;
  if (shot.cameras) shot.cameras = shot.cameras.map(rel);
  for (const [i, cam] of (shot.cameras || []).entries()) {
    await run(`const c = ${JSON.stringify(cam)};
      w.placeCamera = function () { this.camera.clearViewOffset(); this.camera.fov = c.fov || 42; this.camera.aspect = ${W}/${H};
        this.camera.near = c.near || 0.3; this.camera.updateProjectionMatrix();
        this.camera.position.set(...c.pos); this.camera.lookAt(...c.at); this.camera.updateMatrixWorld(true); };
      w.placeCamera(); return true;`);
    if (shot.hud === false && i === 0)
      await p.addStyleTag({
        content: "body * { visibility: hidden !important; } canvas { visibility: visible !important; }",
      });
    await p.waitForTimeout(shot.render ?? 2500);
    const f = shot.out.replace(/\.(jpg|png)$/, `-${i}.$1`);
    await p.screenshot({ path: f, type: "jpeg", quality: 92 });
  }
  if (shot.cameras) {
    console.log("errors", errs.slice(0, 3));
    await b.close();
    return;
  }
  if (shot.camera) {
    await run(`const c = ${JSON.stringify(shot.camera)};
      w.placeCamera = function () { this.camera.clearViewOffset(); this.camera.fov = c.fov || 42; this.camera.aspect = ${W}/${H};
        this.camera.near = c.near || 0.3; this.camera.updateProjectionMatrix();
        this.camera.position.set(...c.pos); this.camera.lookAt(...c.at); this.camera.updateMatrixWorld(true); };
      w.placeCamera(); return true;`);
  }
  if (shot.hud === false)
    await p.addStyleTag({
      content: "body * { visibility: hidden !important; } canvas { visibility: visible !important; }",
    });
  if (shot.gif) {
    // A clip: the game runs again under a fake clock, each frame `step` ms of game time, a screenshot each.
    const g = shot.gif,
      dir = g.dir;
    fs.mkdirSync(dir, { recursive: true });
    await p.waitForTimeout(1500);
    if (shot.freeze && !g.frozen) await run("s.tick = s.__tick; return true");
    if (g.start) console.log("start:", JSON.stringify(await run(g.start)));
    await p.clock.pauseAt(Math.max(Date.now(), await p.evaluate(() => Date.now())) + 5000);
    await p.clock.runFor(100);
    for (let i = 0; i < g.frames; i++) {
      if (g.every) await run(`const i = ${i}; ` + g.every);
      await p.clock.runFor(g.step || 50);
      await p.screenshot({ path: `${dir}/f${String(i).padStart(3, "0")}.png` });
    }
    if (shot.report) console.log("report:", JSON.stringify(await run(shot.report)));
    console.log("errors", errs.slice(0, 3));
    await b.close();
    return;
  }
  await p.waitForTimeout(shot.render ?? 2500);
  await p.screenshot({
    path: shot.out,
    type: shot.out.endsWith(".jpg") ? "jpeg" : "png",
    quality: shot.out.endsWith(".jpg") ? 92 : undefined,
  });
  if (shot.report) console.log("report:", JSON.stringify(await run(shot.report)));
  console.log("errors", errs.slice(0, 3));
  await b.close();
})();
