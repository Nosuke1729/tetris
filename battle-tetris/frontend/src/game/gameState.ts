// ============================================================
// game/gameState.ts  –  ゲーム状態管理・メインループロジック
// ============================================================

import { GameState, ActivePiece } from "../../../shared/types";
import {
  BOARD_WIDTH,
  LOCK_DELAY_MS,
  FALL_INTERVALS,
} from "../../../shared/constants";
import {
  createEmptyBoard,
  isColliding,
  placePiece,
  getFilledRows,
  clearLines,
  getGhostY,
  canSpawn,
} from "./board";
import { BagManager, createRng } from "./bag";
import { tryRotate, RotateDirection } from "./rotation";
import { isTSpin } from "./tspin";
import { calcClearResult, ClearResult } from "./scoring";
import {
  enqueueGarbage,
  cancelGarbage,
  decayGarbageQueue,
  popLandingGarbage,
  applyGarbageLines,
  hasAllClear,
  sumGarbageQueue,
} from "./garbage";
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
      pendingGarbage: 0,      // UI表示用合計
      pendingGarbageQueue: [],// 実際の遅延お邪魔
      singleLineBank: 0,      // SINGLE蓄積
      usedHold: false,
      isGameOver: false,
      isPaused: false,
    };

    this.state.nextQueue = this.bagManager.peek(5);
    this.spawnNext();
  }

  private refreshPendingGarbagePreview() {
    this.state.pendingGarbage = sumGarbageQueue(this.state.pendingGarbageQueue);
  }

  private spawnNext() {
    const type = this.bagManager.next();
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
        type: prev,
        x,
        y,
        rotation: 0,
        lastAction: "spawn",
        lastRotateSuccess: false,
      };
    } else {
      this.spawnNext();
    }

    this.cancelLockTimer();
  }

  // ---- ゲームティック ----

  tick(now: number) {
    if (this.state.isGameOver || this.state.isPaused) return;
    if (!this.state.activePiece) return;

    const interval = this.softDropping
      ? 50
      : FALL_INTERVALS[Math.min(this.state.level - 1, FALL_INTERVALS.length - 1)];

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
      this.cancelLockTimer();
    } else {
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

  private resolveIncomingGarbageAfterLock(attack: number): {
    sentToOpponent: number;
    canceledAmount: number;
  } {
    // 先に相殺
    const canceled = cancelGarbage(attack, this.state.pendingGarbageQueue);
    this.state.pendingGarbageQueue = canceled.queue;

    // 自分が1ターン終えたので、全キューを1進める
    this.state.pendingGarbageQueue = decayGarbageQueue(this.state.pendingGarbageQueue);

    // 着弾する分だけ落とす
    const landing = popLandingGarbage(this.state.pendingGarbageQueue);
    this.state.pendingGarbageQueue = landing.queue;

    if (landing.landingAmount > 0) {
      // ここで着弾。ロック後なのでアクティブミノに埋まらない
      this.state.board = applyGarbageLines(
        this.state.board,
        landing.landingAmount,
        this.garbageRng
      );
    }

    this.refreshPendingGarbagePreview();

    return {
      sentToOpponent: canceled.sentToOpponent,
      canceledAmount: canceled.canceledAmount,
    };
  }

  private lock() {
    this.cancelLockTimer();
    const p = this.state.activePiece!;
    const spinDetected = isTSpin(this.state.board, p);

    // 1. まず固定
    this.state.board = placePiece(this.state.board, p.type, p.x, p.y, p.rotation);

    // 2. ライン消去
    const filled = getFilledRows(this.state.board);
    const linesCleared = filled.length;
    if (linesCleared > 0) {
      this.state.board = clearLines(this.state.board, filled);
    }

    // 3. 全消し判定（消した後）
    const allClear = linesCleared > 0 && hasAllClear(this.state.board);

    // 4. combo 更新
    if (linesCleared > 0) {
      this.state.combo += 1;
    } else {
      this.state.combo = 0;
    }

    // 5. スコア・攻撃計算
    const clearResult = calcClearResult(
      linesCleared,
      spinDetected,
      this.state.combo,
      this.state.backToBack,
      this.state.singleLineBank,
      allClear
    );

    let attack = 0;
    let pendingGarbageConsumed = 0;

    if (clearResult) {
      this.state.score += clearResult.scoreDelta;
      this.state.lines += linesCleared;
      this.state.combo = clearResult.newCombo;
      this.state.backToBack = clearResult.newB2B;
      this.state.singleLineBank = clearResult.nextSingleLineBank;
      this.state.level = Math.floor(this.state.lines / 10) + 1;

      const resolved = this.resolveIncomingGarbageAfterLock(clearResult.attack);
      attack = resolved.sentToOpponent;
      pendingGarbageConsumed = resolved.canceledAmount;

      this.callbacks.onClear(clearResult);
    } else {
      // 消去がないターンでも、お邪魔ターンは進む
      const resolved = this.resolveIncomingGarbageAfterLock(0);
      attack = resolved.sentToOpponent;
      pendingGarbageConsumed = resolved.canceledAmount;
    }

    const lockData: LockEventData = {
      board: this.state.board.map((r) => [...r]),
      linesCleared,
      isTSpin: spinDetected,
      isB2B: this.state.backToBack,
      combo: this.state.combo,
      attack,
      scoreDelta: clearResult?.scoreDelta ?? 0,
      pendingGarbageConsumed,
      clearResult,
    };

    this.callbacks.onLock(lockData);

    this.state.activePiece = null;
    this.spawnNext();
  }

  addPendingGarbage(amount: number) {
    this.state.pendingGarbageQueue = enqueueGarbage(
      this.state.pendingGarbageQueue,
      amount,
      3
    );
    this.refreshPendingGarbagePreview();
  }

  getGhostY(): number {
    const p = this.state.activePiece;
    if (!p) return 0;
    return getGhostY(this.state.board, p.type, p.x, p.y, p.rotation);
  }

  pause() {
    this.state.isPaused = true;
  }

  resume() {
    this.state.isPaused = false;
    this.lastFallTime = performance.now();
  }

  private canAct(): boolean {
    return !this.state.isGameOver && !this.state.isPaused && this.state.activePiece !== null;
  }
}