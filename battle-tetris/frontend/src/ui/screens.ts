// ============================================================
// ui/screens.ts  –  画面切り替え管理
// ============================================================

export type Screen = "title" | "room" | "game" | "result";

export class ScreenManager {
  private current: Screen = "title";
  private elements: Map<Screen, HTMLElement> = new Map();

  register(screen: Screen, el: HTMLElement) {
    this.elements.set(screen, el);
  }

  show(screen: Screen) {
    this.elements.forEach((el, key) => {
      el.style.display = key === screen ? "" : "none";
    });
    this.current = screen;
  }

  getCurrent(): Screen { return this.current; }
}
