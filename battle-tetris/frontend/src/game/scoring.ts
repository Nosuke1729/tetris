// ============================================================
// game/scoring.ts
// ============================================================

import { FALL_INTERVALS } from "../../../shared/constants";

export interface ClearResult {
  label: string;
  scoreDelta: number;
  attack: number;
  newCombo: number;
  newB2B: boolean;
  nextSingleLineBank: number;
  isAllClear: boolean;
}

export function getFallInterval(level: number): number {
  const idx = Math.max(0, Math.min(FALL_INTERVALS.length - 1, level - 1));
  return FALL_INTERVALS[idx];
}

export function calcClearResult(
  linesCleared: number,
  isTSpinClear: boolean,
  combo: number,
  backToBack: boolean,
  singleLineBank = 0,
  isAllClear = false
): ClearResult | null {
  // 完全に何も起きなかった場合
  if (linesCleared === 0 && !isTSpinClear && !isAllClear) {
    return null;
  }

  let scoreDelta = 0;
  let attack = 0;
  let label = "";
  let newB2B = false;
  let nextSingleLineBank = singleLineBank;

  // ---- T-Spin 系 ----
  if (isTSpinClear) {
    if (linesCleared === 0) {
      scoreDelta += 400;
      label = "T-SPIN";
      newB2B = backToBack;
    } else if (linesCleared === 1) {
      scoreDelta += 800;
      attack += 2;
      label = "T-SPIN SINGLE";
      newB2B = true;
    } else if (linesCleared === 2) {
      scoreDelta += 1200;
      attack += 4;
      label = "T-SPIN DOUBLE";
      newB2B = true;
    } else if (linesCleared === 3) {
      scoreDelta += 1600;
      attack += 6;
      label = "T-SPIN TRIPLE";
      newB2B = true;
    }
  } else {
    // ---- 通常消し ----
    if (linesCleared === 1) {
      scoreDelta += 100;
      label = "SINGLE";

      // 1行消しは蓄積して 2回で1攻撃
      nextSingleLineBank += 1;
      if (nextSingleLineBank >= 2) {
        attack += Math.floor(nextSingleLineBank / 2);
        nextSingleLineBank %= 2;
      }

      newB2B = false;
    } else if (linesCleared === 2) {
      scoreDelta += 300;
      attack += 1;
      label = "DOUBLE";
      newB2B = false;
    } else if (linesCleared === 3) {
      scoreDelta += 500;
      attack += 2;
      label = "TRIPLE";
      newB2B = false;
    } else if (linesCleared === 4) {
      scoreDelta += 800;
      attack += 4;
      label = "TETRIS";
      newB2B = true;
    }
  }

  // ---- B2B bonus ----
  if ((isTSpinClear && linesCleared > 0) || linesCleared === 4) {
    if (backToBack) {
      attack += 1;
      scoreDelta = Math.floor(scoreDelta * 1.5);
      label = `B2B ${label}`;
    }
  }

  // ---- REN / combo ----
  // combo は「今回すでに更新済み」の値を受け取る想定
  if (linesCleared > 0 && combo >= 2) {
    if (combo <= 3) attack += 1;
    else if (combo <= 5) attack += 2;
    else if (combo <= 7) attack += 3;
    else attack += 4;
  }

  // ---- All Clear ----
  if (isAllClear) {
    attack += 6;
    scoreDelta += 1000;
    label = label ? `${label} / ALL CLEAR!` : "ALL CLEAR!";
  }

  return {
    label,
    scoreDelta,
    attack,
    newCombo: linesCleared > 0 ? combo : 0,
    newB2B,
    nextSingleLineBank,
    isAllClear,
  };
}