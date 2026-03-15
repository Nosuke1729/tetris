// ============================================================
// game/gameState.ts  –  ゲーム状態管理・メインループロジック
// Practice 対応版
// ============================================================

import { GameState, ActivePiece, PieceType, Rotation, QueuedGarbage } from "../../../shared/types";
import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
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

export type PracticeObjectiveType =
  | "none"
  | "match_target"
  | "clear_all"
  | "line_clear"
  | "tspin_single"
  | "tspin_double"
  | "tspin_triple";

export type PracticeObjective = {
  type: PracticeObjectiveType;
  lineCount?: number;
};

export type PracticePieceState = {
  type: PieceType;
  x: number;
  y: number;
  rotation: Rotation;
};

export type PracticeLoadConfig = {
  board?: number[][];
  activePiece?: PracticePieceState | null;
  holdPiece?: PieceType | null;
  nextQueue?: PieceType[];
  usedHold?: boolean;
  level?: number;
  score?: number;
  lines?: number;
  combo?: number;
  backToBack?: boolean;
  singleLineBank?: number;
  pendingGarbageQueue?: QueuedGarbage[];
  targetMask?: boolean[][];
  objective?: PracticeObjective;
  practiceName?: string;
};

export type PracticeSuccessInfo = {
  objective: PracticeObjective;
  practiceName?: string;
};

export type GameEventCallback = {
  onLock: (data: LockEventData) => void;
  onGameOver: () => void;
  onClear: (result: ClearResult) => void;
  onPracticeSuccess?: (info: PracticeSuccessInfo) => void;
};

function cloneBoard(board: number[][]): number[][] {
  return board.map((row) => [...row]);
}

function cloneTargetMask(mask: boolean[][] | null): boolean[][] | null {
  if (!mask) return null;
  return mask.map((row) => [...row]);
}

function createEmptyTargetMask(): boolean[][] {
  return Array.from({ length: BOARD_HEIGHT }, () =>
    Array.from({ length: BOARD_WIDTH }, () => false)
  );
}

function normalizeBoardShape(board: number[][]): number[][] {
  const out = createEmptyBoard();

  for (let y = 0; y < Math.min(board.length, BOARD_HEIGHT); y++) {
    for (let x = 0; x < Math.min(board[y].length, BOARD_WIDTH); x++) {
      out[y][x] = board[y][x] ?? 0;
    }
  }

  return out;
}

function normalizeTargetMask(mask?: boolean[][] | null): boolean[][] | null {
  if (!mask) return null;

  const out = createEmptyTargetMask();
  for (let y = 0; y < Math.min(mask.length, BOARD_HEIGHT); y++) {
    for (let x = 0; x < Math.min(mask[y].length, BOARD_WIDTH); x++) {
      out[y][x] = !!mask[y][x];
    }
  }
  return out;
}

function boardMatchesTarget(board: number[][], target: boolean[][]): boolean {
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      const occupied = board[y][x] !== 0;
      if (occupied !== target[y][x]) return false;
    }
  }
  return true;
}

export class GameEngine {
  state: GameState;
  private bagManager: BagManager;
  private garbageRng: () => number;
  private lockTimer: number | null = null;
  private lastFallTime = 0;
  private softDropping = false;
  private callbacks: GameEventCallback;

  private practiceMode = false;
  private practiceObjective: PracticeObjective = { type: "none" };
  private practiceTargetMask: boolean[][] | null = null;
  private practiceName = "";
  private practiceCleared = false;

  private forcedQueue: PieceType[] = [];

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
      pendingGarbage: 0,
      pendingGarbageQueue: [],
      singleLineBank: 0,
      usedHold: false,
      isGameOver: false,
      isPaused: false,
    };

    this.updateNextQueuePreview();
    this.spawnNext();
  }

  getPracticeTargetMask(): boolean[][] | null {
    return cloneTargetMask(this.practiceTargetMask);
  }

  getPracticeObjective(): PracticeObjective {
    return { ...this.practiceObjective };
  }

  isPracticeMode(): boolean {
    return this.practiceMode;
  }

  isPracticeCleared(): boolean {
    return this.practiceCleared;
  }

  getPracticeName(): string {
    return this.practiceName;
  }

  loadPracticeState(config: PracticeLoadConfig) {
    this.practiceMode = true;
    this.practiceCleared = false;
    this.practiceObjective = config.objective ?? { type: "none" };
    this.practiceTargetMask = normalizeTargetMask(config.targetMask);
    this.practiceName = config.practiceName ?? "";

    this.cancelLockTimer();
    this.softDropping = false;
    this.lastFallTime = performance.now();

    this.state.board = normalizeBoardShape(config.board ?? createEmptyBoard());
    this.state.holdPiece = config.holdPiece ?? null;
    this.state.usedHold = config.usedHold ?? false;
    this.state.score = config.score ?? 0;
    this.state.lines = config.lines ?? 0;
    this.state.level = config.level ?? 1;
    this.state.combo = config.combo ?? 0;
    this.state.backToBack = config.backToBack ?? false;
    this.state.singleLineBank = config.singleLineBank ?? 0;
    this.state.pendingGarbageQueue = [...(config.pendingGarbageQueue ?? [])];
    this.state.pendingGarbage = sumGarbageQueue(this.state.pendingGarbageQueue);
    this.state.isGameOver = false;
    this.state.isPaused = false;

    this.forcedQueue = [...(config.nextQueue ?? [])];
    this.updateNextQueuePreview();

    if (config.activePiece) {
      this.state.activePiece = {
        type: config.activePiece.type,
        x: config.activePiece.x,
        y: config.activePiece.y,
        rotation: config.activePiece.rotation,
        lastAction: "spawn",
        lastRotateSuccess: false,
      };

      if (
        isColliding(
          this.state.board,
          this.state.activePiece.type,
          this.state.activePiece.x,
          this.state.activePiece.y,
          this.state.activePiece.rotation
        )
      ) {
        this.state.isGameOver = true;
        this.callbacks.onGameOver();
        return;
      }
    } else {
      this.spawnNext();
    }

    if (this.checkPracticeSuccess(0, false)) {
      this.practiceCleared = true;
    }
  }

  clearPracticeMode() {
    this.practiceMode = false;
    this.practiceObjective = { type: "none" };
    this.practiceTargetMask = null;
    this.practiceName = "";
    this.practiceCleared = false;
    this.forcedQueue = [];
  }

  private refreshPendingGarbagePreview() {
    this.state.pendingGarbage = sumGarbageQueue(this.state.pendingGarbageQueue);
  }

  private updateNextQueuePreview() {
    const previewNeeded = 5;
    const forcedPreview = this.forcedQueue.slice(0, previewNeeded);

    if (forcedPreview.length >= previewNeeded) {
      this.state.nextQueue = forcedPreview;
      return;
    }

    const rest = this.bagManager.peek(previewNeeded - forcedPreview.length);
    this.state.nextQueue = [...forcedPreview, ...rest];
  }

  private getNextPieceType(): PieceType {
    if (this.forcedQueue.length > 0) {
      const next = this.forcedQueue.shift()!;
      this.updateNextQueuePreview();
      return next;
    }

    const next = this.bagManager.next();
    this.updateNextQueuePreview();
    return next;
  }

  private spawnSpecific(type: PieceType) {
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

  private spawnNext() {
    const type = this.getNextPieceType();
    this.spawnSpecific(type);
  }

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
      const nextPiece: ActivePiece = {
        type: prev,
        x,
        y,
        rotation: 0,
        lastAction: "spawn",
        lastRotateSuccess: false,
      };

      if (
        isColliding(
          this.state.board,
          nextPiece.type,
          nextPiece.x,
          nextPiece.y,
          nextPiece.rotation
        )
      ) {
        this.state.isGameOver = true;
        this.callbacks.onGameOver();
        return;
      }

      this.state.activePiece = nextPiece;
      this.cancelLockTimer();
    } else {
      this.spawnNext();
    }
  }

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
    const canceled = cancelGarbage(attack, this.state.pendingGarbageQueue);
    this.state.pendingGarbageQueue = canceled.queue;

    this.state.pendingGarbageQueue = decayGarbageQueue(this.state.pendingGarbageQueue);

    const landing = popLandingGarbage(this.state.pendingGarbageQueue);
    this.state.pendingGarbageQueue = landing.queue;

    if (landing.landingAmount > 0) {
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

  private checkPracticeSuccess(linesCleared: number, spinDetected: boolean): boolean {
    if (!this.practiceMode || this.practiceCleared) return false;

    const objective = this.practiceObjective;

    switch (objective.type) {
      case "none":
        return false;

      case "match_target":
        if (!this.practiceTargetMask) return false;
        return boardMatchesTarget(this.state.board, this.practiceTargetMask);

      case "clear_all":
        return hasAllClear(this.state.board);

      case "line_clear":
        return linesCleared >= (objective.lineCount ?? 1);

      case "tspin_single":
        return !!spinDetected && linesCleared === 1;

      case "tspin_double":
        return !!spinDetected && linesCleared === 2;

      case "tspin_triple":
        return !!spinDetected && linesCleared === 3;

      default:
        return false;
    }
  }

  private triggerPracticeSuccess() {
    if (!this.practiceMode || this.practiceCleared) return;

    this.practiceCleared = true;

    if (this.callbacks.onPracticeSuccess) {
      this.callbacks.onPracticeSuccess({
        objective: { ...this.practiceObjective },
        practiceName: this.practiceName,
      });
    }
  }

  private lock() {
    this.cancelLockTimer();
    const p = this.state.activePiece!;
    const spinDetected = isTSpin(this.state.board, p);

    this.state.board = placePiece(this.state.board, p.type, p.x, p.y, p.rotation);

    const filled = getFilledRows(this.state.board);
    const linesCleared = filled.length;
    if (linesCleared > 0) {
      this.state.board = clearLines(this.state.board, filled);
    }

    const allClear = linesCleared > 0 && hasAllClear(this.state.board);

    if (linesCleared > 0) {
      this.state.combo += 1;
    } else {
      this.state.combo = 0;
    }

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
      const resolved = this.resolveIncomingGarbageAfterLock(0);
      attack = resolved.sentToOpponent;
      pendingGarbageConsumed = resolved.canceledAmount;
    }

    const lockData: LockEventData = {
      board: cloneBoard(this.state.board),
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

    if (this.checkPracticeSuccess(linesCleared, spinDetected)) {
      this.triggerPracticeSuccess();
    }

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
    return (
      !this.state.isGameOver &&
      !this.state.isPaused &&
      this.state.activePiece !== null
    );
  }
}