// ============================================================
// game/gameState.ts  –  ゲーム状態管理・メインループロジック
// ============================================================

import { GameState, ActivePiece, PieceType, Rotation } from "../../../shared/types";
import { BOARD_WIDTH, BOARD_HEIGHT, LOCK_DELAY_MS, FALL_INTERVALS } from "../../../shared/constants";
import {
  createEmptyBoard, cloneBoard, isColliding, placePiece,
  getFilledRows, clearLines, getGhostY, addGarbageLines, canSpawn, Board
} from "./board";
import { BagManager } from "./bag";
import { tryRotate, RotateDirection } from "./rotation";
import { isTSpin } from "./tspin";
import { calcClearResult, ClearResult } from "./scoring";
import { cancelGarbage } from "./garbage";
import { getSpawnPosition } from "./piece";

export interface LockEventData {
  board: number[][];
  linesCleared: number;
  isTSpin: boolean;
  isB2B: boolean;
  combo: number;
  attack: number;
  scoreDelta: number;
  pendingGarbageConsumed: number;
  clearResult: ClearResult | null;
}

export type GameEventCallback = {
  onLock: (data: LockEventData) => void;
  onGameOver: () => void;
  onClear: (result: ClearResult) => void;
};

export class GameEngine {
  state: GameState;
  private bagManager: BagManager;
  private garbageRng: () => number;
  private lockTimer: number | null = null;
  private lastFallTime = 0;
  private softDropping = false;
  private callbacks: GameEventCallback;

  constructor(seed: number, callbacks: GameEventCallback) {
    this.callbacks = callbacks;
    this.bagManager = new BagManager(seed);
    // ゴミ穴用乱数（seedから派生）
    const { createRng } = require("./bag");
    this.garbageRng = createRng(seed ^ 0xdeadbeef);

    this.state = {
      board: createEmptyBoard(),
      activePiece: null,
      holdPiece: null,
      nextQueue: [],
      bag: [],
      score: 0,
      lines: 0,
      level: 1,
      combo: 0,
      backToBack: false,
      pendingGarbage: 0,
      usedHold: false,
      isGameOver: false,
      isPaused: false,
    };

    // next を5つ補充
    this.state.nextQueue = this.bagManager.peek(5);
    this.spawnNext();
  }

  private spawnNext() {
    const type = this.bagManager.next();
    // nextQueue 更新
    this.state.nextQueue = this.bagManager.peek(5);

    const { x, y } = getSpawnPosition(type);
    const piece: ActivePiece = {
      type,
      x,
      y,
      rotation: 0,
      lastAction: "spawn",
      lastRotateSuccess: false,
    };

    if (!canSpawn(this.state.board, type, x, y, 0)) {
      this.state.isGameOver = true;
      this.callbacks.onGameOver();
      return;
    }
    this.state.activePiece = piece;
    this.state.usedHold = false;
    this.cancelLockTimer();
  }

  // ---- 入力処理 ----

  moveLeft() {
    if (!this.canAct()) return;
    const p = this.state.activePiece!;
    if (!isColliding(this.state.board, p.type, p.x - 1, p.y, p.rotation)) {
      p.x--;
      p.lastAction = "move";
      this.resetLockTimerOnMove();
    }
  }

  moveRight() {
    if (!this.canAct()) return;
    const p = this.state.activePiece!;
    if (!isColliding(this.state.board, p.type, p.x + 1, p.y, p.rotation)) {
      p.x++;
      p.lastAction = "move";
      this.resetLockTimerOnMove();
    }
  }

  rotate(dir: RotateDirection) {
    if (!this.canAct()) return;
    const p = this.state.activePiece!;
    const result = tryRotate(this.state.board, p.type, p.x, p.y, p.rotation, dir);
    if (result) {
      p.x = result.x;
      p.y = result.y;
      p.rotation = result.rotation;
      p.lastAction = "rotate";
      p.lastRotateSuccess = true;
      this.resetLockTimerOnMove();
    } else {
      p.lastRotateSuccess = false;
    }
  }

  setSoftDrop(active: boolean) {
    this.softDropping = active;
  }

  hardDrop() {
    if (!this.canAct()) return;
    const p = this.state.activePiece!;
    const ghostY = getGhostY(this.state.board, p.type, p.x, p.y, p.rotation);
    const dropped = ghostY - p.y;
    p.y = ghostY;
    p.lastAction = "hardDrop";
    this.state.score += dropped * 2;
    this.lock();
  }

  hold() {
    if (!this.canAct()) return;
    if (this.state.usedHold) return;
    const p = this.state.activePiece!;
    const prev = this.state.holdPiece;
    this.state.holdPiece = p.type;
    this.state.usedHold = true;
    if (prev) {
      const { x, y } = getSpawnPosition(prev);
      this.state.activePiece = {
        type: prev, x, y, rotation: 0,
        lastAction: "spawn", lastRotateSuccess: false,
      };
    } else {
      this.spawnNext();
    }
    this.cancelLockTimer();
  }

  // ---- ゲームティック (requestAnimationFrame から呼ぶ) ----

  tick(now: number) {
    if (this.state.isGameOver || this.state.isPaused) return;
    if (!this.state.activePiece) return;

    const interval = this.softDropping
      ? 50
      : (FALL_INTERVALS[Math.min(this.state.level - 1, FALL_INTERVALS.length - 1)]);

    if (now - this.lastFallTime >= interval) {
      this.fallDown();
      this.lastFallTime = now;
    }
  }

  private fallDown() {
    const p = this.state.activePiece!;
    if (!isColliding(this.state.board, p.type, p.x, p.y + 1, p.rotation)) {
      p.y++;
      if (this.softDropping) this.state.score += 1;
      p.lastAction = this.softDropping ? "softDrop" : "move";
      this.cancelLockTimer(); // 着地していないのでリセット
    } else {
      // 着地
      if (this.lockTimer === null) {
        this.lockTimer = window.setTimeout(() => this.lock(), LOCK_DELAY_MS);
      }
    }
  }

  private resetLockTimerOnMove() {
    if (this.lockTimer !== null) {
      clearTimeout(this.lockTimer);
      this.lockTimer = window.setTimeout(() => this.lock(), LOCK_DELAY_MS);
    }
  }

  private cancelLockTimer() {
    if (this.lockTimer !== null) {
      clearTimeout(this.lockTimer);
      this.lockTimer = null;
    }
  }

  private lock() {
    this.cancelLockTimer();
    const p = this.state.activePiece!;

    // T-Spin チェック
    const spinDetected = isTSpin(this.state.board, p);

    // ゴミライン着弾
    let pendingConsumed = 0;
    if (this.state.pendingGarbage > 0) {
      this.state.board = addGarbageLines(
        this.state.board, this.state.pendingGarbage, this.garbageRng
      );
      pendingConsumed = this.state.pendingGarbage;
      this.state.pendingGarbage = 0;
    }

    // ミノを固定
    this.state.board = placePiece(this.state.board, p.type, p.x, p.y, p.rotation);

    // ライン消去
    const filled = getFilledRows(this.state.board);
    const linesCleared = filled.length;
    if (linesCleared > 0) {
      this.state.board = clearLines(this.state.board, filled);
    }

    // スコア・攻撃計算
    const clearResult = linesCleared > 0 || spinDetected
      ? calcClearResult(linesCleared, spinDetected, this.state.combo, this.state.backToBack)
      : null;

    let attack = 0;
    if (clearResult) {
      this.state.score += clearResult.scoreDelta;
      this.state.lines += linesCleared;
      this.state.combo = clearResult.newCombo;
      this.state.backToBack = clearResult.newB2B;
      this.state.level = Math.floor(this.state.lines / 10) + 1;
      attack = clearResult.attack;

      // ゴミ相殺
      const { newPending, sentToOpponent } = cancelGarbage(attack, 0);
      attack = sentToOpponent;

      this.callbacks.onClear(clearResult);
    } else {
      this.state.combo = 0;
    }

    const lockData: LockEventData = {
      board: this.state.board.map(r => [...r]),
      linesCleared,
      isTSpin: spinDetected,
      isB2B: clearResult?.label?.startsWith("B2B") ?? false,
      combo: this.state.combo,
      attack,
      scoreDelta: clearResult?.scoreDelta ?? 0,
      pendingGarbageConsumed: pendingConsumed,
      clearResult,
    };
    this.callbacks.onLock(lockData);

    this.state.activePiece = null;
    this.spawnNext();
  }

  addPendingGarbage(amount: number) {
    this.state.pendingGarbage += amount;
  }

  getGhostY(): number {
    const p = this.state.activePiece;
    if (!p) return 0;
    return getGhostY(this.state.board, p.type, p.x, p.y, p.rotation);
  }

  pause() { this.state.isPaused = true; }
  resume() { this.state.isPaused = false; this.lastFallTime = performance.now(); }

  private canAct(): boolean {
    return !this.state.isGameOver && !this.state.isPaused && this.state.activePiece !== null;
  }
}
