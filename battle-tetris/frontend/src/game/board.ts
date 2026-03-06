// ============================================================
// game/board.ts  –  盤面操作の純関数群
// ============================================================

import { BOARD_WIDTH, BOARD_HEIGHT, GARBAGE_HOLE_COLOR } from "../../../shared/constants";
import { PieceType, Rotation } from "../../../shared/types";
import { getPieceCells } from "./piece";

export type Board = number[][];

// 空盤面を生成
export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0));
}

// 盤面をディープコピー
export function cloneBoard(board: Board): Board {
  return board.map(row => [...row]);
}

// 衝突チェック (trueなら衝突あり)
export function isColliding(
  board: Board,
  type: PieceType,
  x: number,
  y: number,
  rotation: Rotation
): boolean {
  for (const cell of getPieceCells(type, x, y, rotation)) {
    if (cell.x < 0 || cell.x >= BOARD_WIDTH) return true;
    if (cell.y >= BOARD_HEIGHT) return true;
    if (cell.y >= 0 && board[cell.y][cell.x] !== 0) return true;
  }
  return false;
}

// ミノをボードに固定（色IDを使う: 1-7 = piece, 8 = garbage）
// 色IDはPieceTypeの順番に対応
const PIECE_ID: Record<PieceType, number> = { I:1, O:2, T:3, S:4, Z:5, J:6, L:7 };

export function placePiece(
  board: Board,
  type: PieceType,
  x: number,
  y: number,
  rotation: Rotation
): Board {
  const newBoard = cloneBoard(board);
  const id = PIECE_ID[type];
  for (const cell of getPieceCells(type, x, y, rotation)) {
    if (cell.y >= 0) {
      newBoard[cell.y][cell.x] = id;
    }
  }
  return newBoard;
}

// 埋まった行を検出
export function getFilledRows(board: Board): number[] {
  return board
    .map((row, i) => (row.every(c => c !== 0) ? i : -1))
    .filter(i => i >= 0);
}

// 指定行を消去して上から空行を追加
export function clearLines(board: Board, rows: number[]): Board {
  const newBoard = board.filter((_, i) => !rows.includes(i));
  while (newBoard.length < BOARD_HEIGHT) {
    newBoard.unshift(Array(BOARD_WIDTH).fill(0));
  }
  return newBoard;
}

// ゴーストY座標を計算
export function getGhostY(
  board: Board,
  type: PieceType,
  x: number,
  y: number,
  rotation: Rotation
): number {
  let ghostY = y;
  while (!isColliding(board, type, x, ghostY + 1, rotation)) {
    ghostY++;
  }
  return ghostY;
}

// ゴミライン追加 (穴をランダムに1箇所あける)
export function addGarbageLines(board: Board, count: number, rng: () => number): Board {
  const newBoard = cloneBoard(board);
  const holeX = Math.floor(rng() * BOARD_WIDTH);
  const garbageRow = () => {
    const row = Array(BOARD_WIDTH).fill(GARBAGE_HOLE_COLOR);
    row[holeX] = 0;
    return row;
  };
  for (let i = 0; i < count; i++) {
    newBoard.shift();
    newBoard.push(garbageRow());
  }
  return newBoard;
}

// スポーン可否チェック (一番上2行に既存ブロックがあればゲームオーバー)
export function canSpawn(
  board: Board,
  type: PieceType,
  x: number,
  y: number,
  rotation: Rotation
): boolean {
  return !isColliding(board, type, x, y, rotation);
}
