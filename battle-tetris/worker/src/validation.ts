// ============================================================
// worker/src/validation.ts  –  簡易チート検証
// ============================================================

import { MsgPieceLock } from "../../shared/types";
import { ATTACK_TABLE, BOARD_WIDTH } from "../../shared/constants";

export function validatePieceLock(msg: MsgPieceLock): boolean {
  const { linesCleared, isTSpin, attack } = msg;

  // ライン数の範囲チェック
  if (linesCleared < 0 || linesCleared > 4) return false;

  // 期待される最大攻撃量を計算
  let maxAttack = 0;
  if (isTSpin) {
    maxAttack = [0, 2, 4, 6][linesCleared] ?? 0;
  } else {
    maxAttack = [0, 0, 1, 2, 4][linesCleared] ?? 0;
  }
  // B2B +1, Combo +3 最大
  maxAttack += 1 + 3;

  if (attack < 0 || attack > maxAttack) return false;

  // 盤面サイズチェック (省略可: 全行チェックはコスト高)
  if (!Array.isArray(msg.board)) return false;

  return true;
}
