// ============================================================
// game/rotation.ts  –  SRS 回転・壁蹴りテーブル
// ============================================================

import { PieceType, Rotation } from "../../../shared/types";
import { Board, isColliding } from "./board";

// SRS Wall Kick Data  [fromRotation][kickIndex] = [dx, dy]
// I ミノとそれ以外で分ける
const WALL_KICKS_DEFAULT: Record<string, [number, number][]> = {
  "0->1": [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  "1->0": [[0,0],[1,0],[1,-1],[0,2],[1,2]],
  "1->2": [[0,0],[1,0],[1,-1],[0,2],[1,2]],
  "2->1": [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  "2->3": [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  "3->2": [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  "3->0": [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  "0->3": [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
};

const WALL_KICKS_I: Record<string, [number, number][]> = {
  "0->1": [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
  "1->0": [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
  "1->2": [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
  "2->1": [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
  "2->3": [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
  "3->2": [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
  "3->0": [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
  "0->3": [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
};

export type RotateDirection = "cw" | "ccw";

export function tryRotate(
  board: Board,
  type: PieceType,
  x: number,
  y: number,
  rotation: Rotation,
  dir: RotateDirection
): { x: number; y: number; rotation: Rotation } | null {
  const newRotation: Rotation = dir === "cw"
    ? ((rotation + 1) % 4) as Rotation
    : ((rotation + 3) % 4) as Rotation;

  const key = `${rotation}->${newRotation}`;
  const kicks = type === "I" ? WALL_KICKS_I[key] : WALL_KICKS_DEFAULT[key];

  if (!kicks) return null;

  for (const [dx, dy] of kicks) {
    const nx = x + dx;
    const ny = y - dy; // SRS の y は上が正なので反転
    if (!isColliding(board, type, nx, ny, newRotation)) {
      return { x: nx, y: ny, rotation: newRotation };
    }
  }
  return null;
}
