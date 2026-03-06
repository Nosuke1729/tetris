// ============================================================
// ui/input.ts  –  キーボード入力管理
// ============================================================

export type InputAction =
  | "moveLeft" | "moveRight" | "softDropStart" | "softDropEnd"
  | "hardDrop" | "rotateCW" | "rotateCCW" | "hold" | "pause" | "exit";

type ActionHandler = (action: InputAction) => void;

const KEY_MAP: Record<string, InputAction> = {
  ArrowLeft:  "moveLeft",
  ArrowRight: "moveRight",
  ArrowDown:  "softDropStart",
  Space:      "hardDrop",
  KeyZ:       "rotateCCW",
  ArrowUp:    "rotateCW",
  KeyX:       "rotateCW",
  KeyC:       "hold",
  KeyP:       "pause",
  Escape:     "exit",
};

// DAS/ARR 設定
const DAS_MS = 120; // Delayed Auto Shift
const ARR_MS = 40;  // Auto Repeat Rate

export class InputManager {
  private handler: ActionHandler;
  private dasTimers: Map<string, number> = new Map();
  private arrTimers: Map<string, number> = new Map();
  private keyDown: Set<string> = new Set();

  constructor(handler: ActionHandler) {
    this.handler = handler;
    this.bindEvents();
  }

  private bindEvents() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const action = KEY_MAP[e.code];
    if (!action) return;
    e.preventDefault();
    this.keyDown.add(e.code);

    this.handler(action);

    // DAS/ARR for move
    if (action === "moveLeft" || action === "moveRight") {
      const das = window.setTimeout(() => {
        const arr = window.setInterval(() => {
          if (this.keyDown.has(e.code)) this.handler(action);
          else clearInterval(arr);
        }, ARR_MS);
        this.arrTimers.set(e.code, arr);
      }, DAS_MS);
      this.dasTimers.set(e.code, das);
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const action = KEY_MAP[e.code];
    if (!action) return;
    this.keyDown.delete(e.code);

    if (this.dasTimers.has(e.code)) {
      clearTimeout(this.dasTimers.get(e.code)!);
      this.dasTimers.delete(e.code);
    }
    if (this.arrTimers.has(e.code)) {
      clearInterval(this.arrTimers.get(e.code)!);
      this.arrTimers.delete(e.code);
    }
    if (action === "softDropStart") this.handler("softDropEnd");
  };

  destroy() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.dasTimers.forEach(clearTimeout);
    this.arrTimers.forEach(clearInterval);
  }
}
