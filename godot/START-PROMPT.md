# The message to start the Godot test in a new session

Open a new Claude Code session on `larvuz2/poolpanic` and paste the text below as its first message.

---

We're testing how Pool Panic feels and looks in **Godot** instead of three.js. Everything is ready in `godot/`: read
`godot/README.md` first (it's your brief), then the notes in `godot/docs/`.

Scope:
- **One venue only, the Community Pool.**
- **Coach Waters**, the same model as the real game.
- **One shift, no menu.** It opens straight into the pool.
- **Work only in `godot/`.** Never change `dist/`, which is the real game.

Start by running `godot/tools/install-godot.sh` and `godot/tools/check.sh`. Then follow the README's plan:
1. The coach's feel and his face.
2. The shift's loop: guests arrive, wait, get a lane with 1–3, swim and leave. Score, streak, stars and clock, with the HUD.
3. Fins, the mop and chlorine.
4. The cramp rescue.
5. The look, compared against `godot/reference/`.

After each step:
- Render a picture and send it to me next to the three.js reference.
- Push, so the download page `godot-latest` updates.
- Tell me the commit, and merge as usual.
