// ============================================================
// shared/constants.ts  –  共通定数
// ============================================================

export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 22;   // 内部管理（上2行は非表示）
export const VISIBLE_HEIGHT = 20; // 表示行数
export const SPAWN_ROW = 0;       // スポーン開始行

export const LOCK_DELAY_MS = 500;
export const SOFT_DROP_INTERVAL_MS = 50;
export const SNAPSHOT_INTERVAL_MS = 200; // 200ms毎に相手盤面送信

// 落下間隔 (ms) レベル別
export const FALL_INTERVALS: number[] = [
  800, 720, 630, 550, 470, 380, 300, 220, 130, 100,
  80,  80,  80,  70,  70,  70,  50,  50,  50,  30,
];

export const GARBAGE_HOLE_COLOR = 8; // ゴミラインの色ID

// スコア
export const SCORE_TABLE = {
  single: 100, double: 300, triple: 500, tetris: 800,
  tspin0: 400, tspinSingle: 800, tspinDouble: 1200, tspinTriple: 1600,
};

// 攻撃量
export const ATTACK_TABLE = {
  single: 0, double: 1, triple: 2, tetris: 4,
  tspin0: 0, tspinSingle: 2, tspinDouble: 4, tspinTriple: 6,
};

export const COMBO_BONUS_SCORE = 50; // コンボ1あたり
export const B2B_SCORE_MULT = 1.5;
export const B2B_ATTACK_BONUS = 1;

export const GARBAGE_CANCEL = true; // ゴミ相殺あり
