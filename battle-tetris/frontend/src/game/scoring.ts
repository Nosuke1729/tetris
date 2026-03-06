// ============================================================
// game/scoring.ts  –  スコア・攻撃量計算
// ============================================================
import { FALL_INTERVALS } from "@shared/constants";

import {
  SCORE_TABLE, ATTACK_TABLE, COMBO_BONUS_SCORE,
  B2B_SCORE_MULT, B2B_ATTACK_BONUS
} from "../../../shared/constants";

export interface ClearResult {
  scoreDelta: number;
  attack: number;
  newCombo: number;
  newB2B: boolean;
  isTSpin: boolean;
  label: string;
}

export function calcClearResult(
  linesCleared: number,
  isTSpin: boolean,
  prevCombo: number,
  prevB2B: boolean
): ClearResult {
  let baseScore = 0;
  let baseAttack = 0;
  let label = "";
  let isB2BEligible = false;

  if (isTSpin) {
    switch (linesCleared) {
      case 0: baseScore = SCORE_TABLE.tspin0;    baseAttack = ATTACK_TABLE.tspin0;    label = "T-Spin"; break;
      case 1: baseScore = SCORE_TABLE.tspinSingle; baseAttack = ATTACK_TABLE.tspinSingle; label = "T-Spin Single"; isB2BEligible = true; break;
      case 2: baseScore = SCORE_TABLE.tspinDouble; baseAttack = ATTACK_TABLE.tspinDouble; label = "T-Spin Double"; isB2BEligible = true; break;
      case 3: baseScore = SCORE_TABLE.tspinTriple; baseAttack = ATTACK_TABLE.tspinTriple; label = "T-Spin Triple"; isB2BEligible = true; break;
    }
  } else {
    switch (linesCleared) {
      case 1: baseScore = SCORE_TABLE.single; baseAttack = ATTACK_TABLE.single; label = "Single"; break;
      case 2: baseScore = SCORE_TABLE.double; baseAttack = ATTACK_TABLE.double; label = "Double"; break;
      case 3: baseScore = SCORE_TABLE.triple; baseAttack = ATTACK_TABLE.triple; label = "Triple"; break;
      case 4: baseScore = SCORE_TABLE.tetris; baseAttack = ATTACK_TABLE.tetris; label = "Tetris!"; isB2BEligible = true; break;
    }
  }

  // B2B ボーナス
  const isB2B = isB2BEligible && prevB2B;
  if (isB2B && linesCleared > 0) {
    baseScore = Math.floor(baseScore * B2B_SCORE_MULT);
    baseAttack += B2B_ATTACK_BONUS;
    label = "B2B " + label;
  }

  // Combo ボーナス
  const newCombo = linesCleared > 0 ? prevCombo + 1 : 0;
  const comboBonus = newCombo > 0 ? newCombo * COMBO_BONUS_SCORE : 0;
  const comboAttack = calcComboAttack(newCombo);

  return {
    scoreDelta: baseScore + comboBonus,
    attack: baseAttack + comboAttack,
    newCombo,
    newB2B: isB2BEligible ? true : (linesCleared === 0 ? prevB2B : false),
    isTSpin,
    label,
  };
}

function calcComboAttack(combo: number): number {
  if (combo <= 2) return 0;
  if (combo <= 4) return 1;
  if (combo <= 6) return 2;
  return 3;
}

// レベルからの落下間隔計算
export function getFallInterval(level: number): number {
  const idx = Math.min(level - 1, FALL_INTERVALS.length - 1);
  return FALL_INTERVALS[idx];
}
