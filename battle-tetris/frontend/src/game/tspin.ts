// ============================================================
// game/tspin.ts  –  T-Spin 判定
// ============================================================

import { Board } from "./board";
import { ActivePiece } from "../../../shared/types";
import { BOARD_WIDTH, BOARD_HEIGHT } from "../../../shared/constants";

// T-Spin 判定：T ミノが最後に回転で固定されたかつ4角3つ以上埋まり
export function isTSpin(board: Board, piece: ActivePiece): boolean {
  if (piece.type !== "T") return false;
  if (!piece.lastRotateSuccess) return false;
  if (piece.lastAction !== "rotate") return false;

  // T ミノの中心セルは回転によって異なる
  // rotation=0 → 中心は (x+1, y+1)
  const cx = piece.x + 1;
  const cy = piece.y + 1;

  const corners = [
    { x: cx - 1, y: cy - 1 },
    { x: cx + 1, y: cy - 1 },
    { x: cx - 1, y: cy + 1 },
    { x: cx + 1, y: cy + 1 },
  ];

  let filledCount = 0;
  for (const c of corners) {
    if (c.x < 0 || c.x >= BOARD_WIDTH || c.y < 0 || c.y >= BOARD_HEIGHT) {
      filledCount++; // 盤面外は埋まりとみなす
    } else if (board[c.y][c.x] !== 0) {
      filledCount++;
    }
  }

  return filledCount >= 3;
}
