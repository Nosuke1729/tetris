// ============================================================
// practice/catalog.ts
// 見える・分かることを優先した Practice データ
// ============================================================

import { BOARD_HEIGHT, BOARD_WIDTH } from "../../../shared/constants";
import { PieceType, Rotation } from "../../../shared/types";
import { getPieceCells } from "../game/piece";

export type PracticeCategory =
  | "Openers"
  | "T-Spin"
  | "Stacking"
  | "Downstack"
  | "Combo"
  | "All Clear"
  | "Defense";

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

export type Placement = {
  type: PieceType;
  x: number;
  y: number;
  rotation: Rotation;
};

export type PracticePuzzle = {
  id: string;
  name: string;
  category: PracticeCategory;
  description: string;
  hint: string;
  board: number[][];
  overlayBoard: number[][];
  targetMask: boolean[][];
  activePiece: PracticePieceState | null;
  holdPiece: PieceType | null;
  nextQueue: PieceType[];
  objective: PracticeObjective;
};

const PIECE_TO_ID: Record<PieceType, number> = {
  I: 1,
  O: 2,
  T: 3,
  S: 4,
  Z: 5,
  J: 6,
  L: 7,
};

function emptyBoard(): number[][] {
  return Array.from({ length: BOARD_HEIGHT }, () =>
    Array.from({ length: BOARD_WIDTH }, () => 0)
  );
}

function cloneBoard(board: number[][]): number[][] {
  return board.map((row) => [...row]);
}

function maskFromBoard(board: number[][]): boolean[][] {
  return board.map((row) => row.map((v) => v !== 0));
}

function boardFromVisibleRows(visibleRows: string[]): number[][] {
  const board = emptyBoard();
  const startRow = BOARD_HEIGHT - visibleRows.length;

  for (let r = 0; r < visibleRows.length; r++) {
    const rowStr = visibleRows[r];
    for (let c = 0; c < Math.min(rowStr.length, BOARD_WIDTH); c++) {
      if (rowStr[c] === "#") {
        board[startRow + r][c] = 8;
      }
    }
  }

  return board;
}

function overlayFromPlacements(placements: Placement[]): number[][] {
  const board = emptyBoard();

  for (const p of placements) {
    const id = PIECE_TO_ID[p.type];
    for (const cell of getPieceCells(p.type, p.x, p.y, p.rotation)) {
      if (
        cell.x >= 0 &&
        cell.x < BOARD_WIDTH &&
        cell.y >= 0 &&
        cell.y < BOARD_HEIGHT
      ) {
        board[cell.y][cell.x] = id;
      }
    }
  }

  return board;
}

function visibleSpawnPiece(type: PieceType): PracticePieceState {
  // 隠し2行より下に確実に見える位置
  return {
    type,
    x: 3,
    y: 2,
    rotation: 0,
  };
}

function makeSequencePuzzle(args: {
  id: string;
  name: string;
  category: PracticeCategory;
  description: string;
  hint: string;
  placements: Placement[];
  nextQueue: PieceType[];
  holdPiece?: PieceType | null;
}): PracticePuzzle {
  const overlayBoard = overlayFromPlacements(args.placements);
  const firstType = args.nextQueue[0];

  return {
    id: args.id,
    name: args.name,
    category: args.category,
    description: args.description,
    hint: args.hint,
    board: emptyBoard(),
    overlayBoard,
    targetMask: maskFromBoard(overlayBoard),
    activePiece: firstType ? visibleSpawnPiece(firstType) : null,
    holdPiece: args.holdPiece ?? null,
    nextQueue: firstType ? args.nextQueue.slice(1) : [],
    objective: { type: "match_target" },
  };
}

function makeSpinPuzzle(args: {
  id: string;
  name: string;
  category: PracticeCategory;
  description: string;
  hint: string;
  boardRows: string[];
  targetPlacement: Placement;
  objective: PracticeObjective;
}): PracticePuzzle {
  const board = boardFromVisibleRows(args.boardRows);
  const overlayBoard = overlayFromPlacements([args.targetPlacement]);

  return {
    id: args.id,
    name: args.name,
    category: args.category,
    description: args.description,
    hint: args.hint,
    board,
    overlayBoard,
    targetMask: maskFromBoard(overlayBoard),
    activePiece: visibleSpawnPiece(args.targetPlacement.type),
    holdPiece: null,
    nextQueue: [],
    objective: args.objective,
  };
}

// ------------------------------
// Openers / Stacking
// ------------------------------

const dt_cannon = makeSequencePuzzle({
  id: "dt_cannon",
  name: "DT砲 導入",
  category: "Openers",
  description: "まずは完成形の見た目を覚える練習。",
  hint: "今のミノと同じ色の影の場所へ置いてください。",
  placements: [
    { type: "Z", x: 0, y: 18, rotation: 0 },
    { type: "L", x: 3, y: 17, rotation: 0 },
    { type: "O", x: 6, y: 18, rotation: 0 },
    { type: "T", x: 4, y: 15, rotation: 0 },
  ],
  nextQueue: ["Z", "L", "O", "T"],
  holdPiece: "I",
});

const hachimitsu = makeSequencePuzzle({
  id: "hachimitsu",
  name: "ハチミツ砲 導入",
  category: "Openers",
  description: "ハチミツ砲の入り口を作る練習。",
  hint: "色のついた影に順番に置いてください。",
  placements: [
    { type: "O", x: 0, y: 18, rotation: 0 },
    { type: "L", x: 2, y: 17, rotation: 0 },
    { type: "J", x: 5, y: 17, rotation: 0 },
    { type: "T", x: 4, y: 15, rotation: 0 },
  ],
  nextQueue: ["O", "L", "J", "T"],
});

const tki = makeSequencePuzzle({
  id: "tki",
  name: "TKI 導入",
  category: "Openers",
  description: "TKI の基本形を作る練習。",
  hint: "今のミノと同じ色の影を目印にしてください。",
  placements: [
    { type: "J", x: 0, y: 17, rotation: 0 },
    { type: "Z", x: 3, y: 18, rotation: 0 },
    { type: "O", x: 6, y: 18, rotation: 0 },
    { type: "T", x: 4, y: 15, rotation: 0 },
  ],
  nextQueue: ["J", "Z", "O", "T"],
});

const mountain = makeSequencePuzzle({
  id: "mountain",
  name: "山岳積み 基礎",
  category: "Stacking",
  description: "山型の基本を作る練習。",
  hint: "左右を高くする見た目を色で覚えてください。",
  placements: [
    { type: "J", x: 0, y: 17, rotation: 0 },
    { type: "L", x: 7, y: 17, rotation: 0 },
    { type: "O", x: 3, y: 18, rotation: 0 },
    { type: "T", x: 4, y: 15, rotation: 0 },
  ],
  nextQueue: ["J", "L", "O", "T"],
});

const lst = makeSequencePuzzle({
  id: "lst",
  name: "LST stacking 基礎",
  category: "Stacking",
  description: "LST の入口を色で覚える練習。",
  hint: "今は土台の見た目を覚えるのを優先してください。",
  placements: [
    { type: "L", x: 0, y: 17, rotation: 0 },
    { type: "S", x: 3, y: 18, rotation: 0 },
    { type: "J", x: 6, y: 17, rotation: 0 },
    { type: "T", x: 4, y: 15, rotation: 0 },
  ],
  nextQueue: ["L", "S", "J", "T"],
});

const six_three = makeSequencePuzzle({
  id: "six_three",
  name: "6-3 stacking 基礎",
  category: "Stacking",
  description: "6-3 の左右差を理解する練習。",
  hint: "左6列と右3列の高さ差を意識してください。",
  placements: [
    { type: "J", x: 0, y: 17, rotation: 0 },
    { type: "O", x: 3, y: 18, rotation: 0 },
    { type: "L", x: 6, y: 17, rotation: 0 },
  ],
  nextQueue: ["J", "O", "L"],
});

// ------------------------------
// T-Spin
// ------------------------------

const tss = makeSpinPuzzle({
  id: "tss",
  name: "T-Spin Single 基礎",
  category: "T-Spin",
  description: "TSS の置き場所を覚える練習。",
  hint: "紫の影に T ミノを回し入れてください。",
  boardRows: [
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "....#.....",
    "...##.....",
    "##########",
  ],
  targetPlacement: { type: "T", x: 3, y: 16, rotation: 0 },
  objective: { type: "tspin_single" },
});

const tsd = makeSpinPuzzle({
  id: "tsd",
  name: "T-Spin Double 基礎",
  category: "T-Spin",
  description: "TSD の置き場所を覚える練習。",
  hint: "紫の影に T ミノを回し入れてください。",
  boardRows: [
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "....#.....",
    "...##.....",
    "...#.##...",
    "##########",
  ],
  targetPlacement: { type: "T", x: 3, y: 16, rotation: 0 },
  objective: { type: "tspin_double" },
});

const tst = makeSpinPuzzle({
  id: "tst",
  name: "T-Spin Triple 基礎",
  category: "T-Spin",
  description: "TST の入口を覚える練習。",
  hint: "まずは紫の影に T を入れる感覚を掴んでください。",
  boardRows: [
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    ".....#....",
    "....##....",
    "....#.#...",
    "...##.##..",
    "##########",
  ],
  targetPlacement: { type: "T", x: 4, y: 15, rotation: 0 },
  objective: { type: "tspin_triple" },
});

const mini_tspin = makeSpinPuzzle({
  id: "mini_tspin",
  name: "Mini T-Spin 基礎",
  category: "T-Spin",
  description: "Mini T-Spin の感覚を掴む練習。",
  hint: "紫の影に T を入れて Mini の形を確認してください。",
  boardRows: [
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "....#.....",
    "....##....",
    "...##.....",
    "##########",
  ],
  targetPlacement: { type: "T", x: 3, y: 16, rotation: 1 },
  objective: { type: "match_target" },
});

// ------------------------------
// Utility
// ------------------------------

const cheese_race = makeSpinPuzzle({
  id: "cheese_race",
  name: "Cheese Race 基礎",
  category: "Downstack",
  description: "まずは縦 I で穴を掘る基本。",
  hint: "水色の影に I ミノを縦で落としてください。",
  boardRows: [
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    ".#########",
    ".#########",
    ".#########",
    ".#########",
    "##########",
    "##########",
    "##########",
    "##########",
  ],
  targetPlacement: { type: "I", x: 0, y: 12, rotation: 1 },
  objective: { type: "line_clear", lineCount: 1 },
});

const combo_basic = makeSequencePuzzle({
  id: "combo_basic",
  name: "Combo 基礎",
  category: "Combo",
  description: "コンボ土台の見た目を覚える練習。",
  hint: "今は形の理解を優先してください。",
  placements: [
    { type: "O", x: 0, y: 18, rotation: 0 },
    { type: "O", x: 2, y: 18, rotation: 0 },
    { type: "I", x: 4, y: 19, rotation: 0 },
  ],
  nextQueue: ["O", "O", "I"],
});

const b2b_keep = makeSpinPuzzle({
  id: "b2b_keep",
  name: "B2B 維持",
  category: "Defense",
  description: "B2B を繋ぐ TSD の置き場所を覚える練習。",
  hint: "紫の影に T を入れて B2B 維持を意識してください。",
  boardRows: [
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "....#.....",
    "...##.....",
    "...#.##...",
    "######.###",
  ],
  targetPlacement: { type: "T", x: 3, y: 16, rotation: 0 },
  objective: { type: "tspin_double" },
});

const pc1 = makeSequencePuzzle({
  id: "pc1",
  name: "Perfect Clear 導入",
  category: "All Clear",
  description: "まずは形の感覚を覚える簡易版。",
  hint: "今はオールクリアの完成形の見た目を覚える練習です。",
  placements: [
    { type: "O", x: 0, y: 18, rotation: 0 },
    { type: "O", x: 2, y: 18, rotation: 0 },
    { type: "I", x: 4, y: 19, rotation: 0 },
  ],
  nextQueue: ["O", "O", "I"],
});

export const PRACTICE_PUZZLES: Record<string, PracticePuzzle> = {
  dt_cannon,
  hachimitsu,
  tki,
  pc1,
  tsd,
  tst,
  tss,
  mini_tspin,
  mountain,
  lst,
  six_three,
  cheese_race,
  combo_basic,
  b2b_keep,
};

export function getPracticePuzzle(id: string): PracticePuzzle | null {
  return PRACTICE_PUZZLES[id] ?? null;
}

export function clonePracticePuzzle(puzzle: PracticePuzzle): PracticePuzzle {
  return {
    ...puzzle,
    board: cloneBoard(puzzle.board),
    overlayBoard: cloneBoard(puzzle.overlayBoard),
    targetMask: puzzle.targetMask.map((row) => [...row]),
    activePiece: puzzle.activePiece ? { ...puzzle.activePiece } : null,
    nextQueue: [...puzzle.nextQueue],
  };
}