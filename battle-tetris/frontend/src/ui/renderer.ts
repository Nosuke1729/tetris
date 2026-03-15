// ============================================================
// ui/renderer.ts  –  Canvas 描画エンジン
// Practice overlay 対応版
// ============================================================

import { Board } from "../game/board";
import {
  getPieceCells,
  PIECE_COLORS,
  GHOST_COLOR,
  GARBAGE_COLOR,
} from "../game/piece";
import { ActivePiece, PieceType } from "../../../shared/types";
import {
  BOARD_WIDTH,
  VISIBLE_HEIGHT,
  BOARD_HEIGHT,
} from "../../../shared/constants";

const COLORS = [
  "transparent",
  PIECE_COLORS.I,
  PIECE_COLORS.O,
  PIECE_COLORS.T,
  PIECE_COLORS.S,
  PIECE_COLORS.Z,
  PIECE_COLORS.J,
  PIECE_COLORS.L,
  GARBAGE_COLOR,
];

export type PracticeOverlayData = {
  targetCells: boolean[][];
  highlightMatched?: boolean;
  color?: string;
  matchedColor?: string;
  borderColor?: string;
};

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cellSize: number;
  private offsetX: number;
  private offsetY: number;

  private practiceOverlay: PracticeOverlayData | null = null;

  constructor(canvas: HTMLCanvasElement, cellSize: number) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.cellSize = cellSize;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  setPracticeOverlay(data: PracticeOverlayData | null) {
    this.practiceOverlay = data;
  }

  clearPracticeOverlay() {
    this.practiceOverlay = null;
  }

  drawBoard(
    board: Board,
    activePiece: ActivePiece | null,
    ghostY: number | null,
    pendingGarbage: number
  ) {
    const cs = this.cellSize;
    const ctx = this.ctx;
    const ox = this.offsetX;
    const oy = this.offsetY;
    const HIDDEN = BOARD_HEIGHT - VISIBLE_HEIGHT;

    ctx.fillStyle = "#111";
    ctx.fillRect(ox, oy, cs * BOARD_WIDTH, cs * VISIBLE_HEIGHT);

    if (this.practiceOverlay) {
      this.drawPracticeOverlay(board, HIDDEN);
    }

    ctx.strokeStyle = "#222";
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= VISIBLE_HEIGHT; r++) {
      ctx.beginPath();
      ctx.moveTo(ox, oy + r * cs);
      ctx.lineTo(ox + BOARD_WIDTH * cs, oy + r * cs);
      ctx.stroke();
    }
    for (let c = 0; c <= BOARD_WIDTH; c++) {
      ctx.beginPath();
      ctx.moveTo(ox + c * cs, oy);
      ctx.lineTo(ox + c * cs, oy + VISIBLE_HEIGHT * cs);
      ctx.stroke();
    }

    for (let row = HIDDEN; row < BOARD_HEIGHT; row++) {
      for (let col = 0; col < BOARD_WIDTH; col++) {
        const v = board[row][col];
        if (v) {
          this.drawCell(
            ctx,
            ox + col * cs,
            oy + (row - HIDDEN) * cs,
            cs,
            COLORS[v]
          );
        }
      }
    }

    if (activePiece && ghostY !== null) {
      for (const cell of getPieceCells(
        activePiece.type,
        activePiece.x,
        ghostY,
        activePiece.rotation
      )) {
        if (
          cell.x >= 0 &&
          cell.x < BOARD_WIDTH &&
          cell.y >= HIDDEN &&
          cell.y < BOARD_HEIGHT
        ) {
          ctx.fillStyle = GHOST_COLOR;
          ctx.fillRect(
            ox + cell.x * cs + 1,
            oy + (cell.y - HIDDEN) * cs + 1,
            cs - 2,
            cs - 2
          );
        }
      }
    }

    if (activePiece) {
      const color = PIECE_COLORS[activePiece.type];
      for (const cell of getPieceCells(
        activePiece.type,
        activePiece.x,
        activePiece.y,
        activePiece.rotation
      )) {
        if (
          cell.x >= 0 &&
          cell.x < BOARD_WIDTH &&
          cell.y >= HIDDEN &&
          cell.y < BOARD_HEIGHT
        ) {
          this.drawCell(
            ctx,
            ox + cell.x * cs,
            oy + (cell.y - HIDDEN) * cs,
            cs,
            color
          );
        }
      }
    }

    if (pendingGarbage > 0) {
      const barX = ox + BOARD_WIDTH * cs - 8;
      const barH = Math.min(pendingGarbage * cs, VISIBLE_HEIGHT * cs);
      ctx.fillStyle = "#ff3333";
      ctx.fillRect(barX, oy + VISIBLE_HEIGHT * cs - barH, 6, barH);
    }

    ctx.strokeStyle = "#444";
    ctx.lineWidth = 2;
    ctx.strokeRect(ox, oy, cs * BOARD_WIDTH, cs * VISIBLE_HEIGHT);
  }

  private drawPracticeOverlay(board: Board, hiddenRows: number) {
    if (!this.practiceOverlay) return;

    const ctx = this.ctx;
    const cs = this.cellSize;
    const ox = this.offsetX;
    const oy = this.offsetY;

    const target = this.practiceOverlay.targetCells;
    const overlayColor =
      this.practiceOverlay.color ?? "rgba(0, 207, 255, 0.18)";
    const matchedColor =
      this.practiceOverlay.matchedColor ?? "rgba(255, 215, 0, 0.28)";
    const borderColor =
      this.practiceOverlay.borderColor ?? "rgba(255,255,255,0.28)";
    const highlightMatched = this.practiceOverlay.highlightMatched ?? true;

    for (let row = hiddenRows; row < BOARD_HEIGHT; row++) {
      for (let col = 0; col < BOARD_WIDTH; col++) {
        const isTarget = !!target[row]?.[col];
        if (!isTarget) continue;

        const screenX = ox + col * cs;
        const screenY = oy + (row - hiddenRows) * cs;
        const occupied = board[row][col] !== 0;

        ctx.save();
        ctx.fillStyle =
          occupied && highlightMatched ? matchedColor : overlayColor;
        ctx.fillRect(screenX + 2, screenY + 2, cs - 4, cs - 4);

        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(screenX + 2.5, screenY + 2.5, cs - 5, cs - 5);

        ctx.beginPath();
        ctx.moveTo(screenX + 4, screenY + cs - 4);
        ctx.lineTo(screenX + cs - 4, screenY + 4);
        ctx.stroke();

        if (occupied && highlightMatched) {
          ctx.strokeStyle = "rgba(255,215,0,0.75)";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(screenX + 4, screenY + 4, cs - 8, cs - 8);
        }
        ctx.restore();
      }
    }
  }

  private drawCell(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    cs: number,
    color: string
  ) {
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);

    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(x + 1, y + 1, cs - 2, 3);
    ctx.fillRect(x + 1, y + 1, 3, cs - 2);

    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(x + cs - 4, y + 2, 2, cs - 4);
    ctx.fillRect(x + 2, y + cs - 4, cs - 4, 2);
  }

  drawMiniBoard(board: Board, x: number, y: number, miniCellSize: number) {
    const ctx = this.ctx;
    const HIDDEN = BOARD_HEIGHT - VISIBLE_HEIGHT;
    const w = BOARD_WIDTH * miniCellSize;
    const h = VISIBLE_HEIGHT * miniCellSize;

    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    for (let row = HIDDEN; row < BOARD_HEIGHT; row++) {
      for (let col = 0; col < BOARD_WIDTH; col++) {
        const v = board[row][col];
        if (v) {
          ctx.fillStyle = COLORS[v];
          ctx.fillRect(
            x + col * miniCellSize + 0.5,
            y + (row - HIDDEN) * miniCellSize + 0.5,
            miniCellSize - 1,
            miniCellSize - 1
          );
        }
      }
    }
  }

  drawPiecePreview(type: PieceType, x: number, y: number, cs: number) {
    const ctx = this.ctx;
    const color = PIECE_COLORS[type];

    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(x, y, cs * 4, cs * 2);

    const cells = getPieceCells(type, 0, 0, 0);
    const minX = Math.min(...cells.map((c) => c.x));
    const minY = Math.min(...cells.map((c) => c.y));
    const maxX = Math.max(...cells.map((c) => c.x));
    const maxY = Math.max(...cells.map((c) => c.y));

    const pw = (maxX - minX + 1) * cs;
    const ph = (maxY - minY + 1) * cs;
    const startX = x + (cs * 4 - pw) / 2;
    const startY = y + (cs * 2 - ph) / 2;

    for (const cell of cells) {
      this.drawCell(
        ctx,
        startX + (cell.x - minX) * cs,
        startY + (cell.y - minY) * cs,
        cs,
        color
      );
    }
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}