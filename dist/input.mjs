const directions = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};
export class CoachInput {
  constructor({ onJump, onDash, onInteract, onPause, onShortcut, isPlaying }) {
    this.held = new Set();
    this.touch = new Map();
    // Coach Cam: ← / → turn the view instead of strafing (A / D still strafe).
    this.lookMode = false;
    this.handlers = { onJump, onDash, onInteract, onPause, onShortcut, isPlaying };
  }
  keyDown(event) {
    const { isPlaying, onJump, onDash, onInteract, onPause, onShortcut } = this.handlers;
    const code = event.code;
    if (event.target?.matches?.('input,textarea,select,[contenteditable="true"]')) return;
    if (directions[code]) {
      if (isPlaying()) {
        event.preventDefault();
        this.held.add(code);
      }
      return;
    }
    if (code === "Space") {
      if (isPlaying()) {
        event.preventDefault();
        if (!event.repeat) onJump();
      }
      return;
    }
    if (code === "ShiftLeft" || code === "ShiftRight") {
      if (isPlaying()) {
        event.preventDefault();
        if (!event.repeat) onDash?.();
      }
      return;
    }
    if (event.repeat) return;
    if (code === "KeyP") {
      event.preventDefault();
      onPause();
      return;
    }
    if (code === "KeyE" && isPlaying()) {
      event.preventDefault();
      onInteract();
      return;
    }
    onShortcut(event);
  }
  keyUp(event) {
    this.held.delete(event.code);
  }
  vector() {
    let x = 0,
      z = 0;
    for (const code of this.held) {
      if (this.lookMode && (code === "ArrowLeft" || code === "ArrowRight")) continue;
      const d = directions[code];
      if (d) {
        x += d[0];
        z += d[1];
      }
    }
    for (const d of this.touch.values()) {
      x += d[0];
      z += d[1];
    }
    const length = Math.max(1, Math.hypot(x, z));
    return { x: x / length, z: z / length };
  }
  // Coach Cam turning from the arrow keys: −1 left, +1 right.
  turn() {
    if (!this.lookMode) return 0;
    return (this.held.has("ArrowRight") ? 1 : 0) - (this.held.has("ArrowLeft") ? 1 : 0);
  }
  clear() {
    this.held.clear();
    this.touch.clear();
  }
  bindTouch(button, x, z) {
    const stop = (e) => {
      this.touch.delete(e.pointerId);
      button.classList.remove("held");
    };
    button.addEventListener("pointerdown", (e) => {
      if (!this.handlers.isPlaying()) return;
      e.preventDefault();
      button.setPointerCapture(e.pointerId);
      this.touch.set(e.pointerId, [x, z]);
      button.classList.add("held");
    });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
      button.addEventListener(name, stop);
  }
}
