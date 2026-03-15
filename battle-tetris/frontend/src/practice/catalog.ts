// ============================================================
// practice/catalog.ts
// ============================================================

import { BOARD_HEIGHT, BOARD_WIDTH } from "../../../shared/constants";
import { PieceType, Rotation } from "../../../shared/types";

export type PracticeCategory =
  | "Openers"
  | "T-Spin"
  | "Stacking"
  | "Downstack"
  | "Combo"
  | "All Clear"
  | "Defense"
  | "Finesse";

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

export type PracticePuzzle = {
  id: string;
  name: string;
  category: PracticeCategory;
  description: string;
  board: number[][];
  targetMask: boolean[][];
  activePiece: PracticePieceState | null;
  holdPiece: PieceType | null;
  nextQueue: PieceType[];
  objective: PracticeObjective;
};

function emptyBoard(): number[][] {
  return Array.from({ length: BOARD_HEIGHT }, () =>
    Array.from({ length: BOARD_WIDTH }, () => 0)
  );
}

function emptyMask(): boolean[][] {
  return Array.from({ length: BOARD_HEIGHT }, () =>
    Array.from({ length: BOARD_WIDTH }, () => false)
  );
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

function maskFromVisibleRows(visibleRows: string[]): boolean[][] {
  const mask = emptyMask();
  const startRow = BOARD_HEIGHT - visibleRows.length;

  for (let r = 0; r < visibleRows.length; r++) {
    const rowStr = visibleRows[r];
    for (let c = 0; c < Math.min(rowStr.length, BOARD_WIDTH); c++) {
      if (rowStr[c] === "#") {
        mask[startRow + r][c] = true;
      }
    }
  }

  return mask;
}

function cloneBoard(board: number[][]): number[][] {
  return board.map((row) => [...row]);
}

function cloneMask(mask: boolean[][]): boolean[][] {
  return mask.map((row) => [...row]);
}

function makePuzzle(args: {
  id: string;
  name: string;
  category: PracticeCategory;
  description: string;
  boardRows: string[];
  targetRows?: string[];
  activePiece: PracticePieceState | null;
  holdPiece?: PieceType | null;
  nextQueue?: PieceType[];
  objective: PracticeObjective;
}): PracticePuzzle {
  const board = boardFromVisibleRows(args.boardRows);
  const targetMask = maskFromVisibleRows(args.targetRows ?? args.boardRows);

  return {
    id: args.id,
    name: args.name,
    category: args.category,
    description: args.description,
    board,
    targetMask,
    activePiece: args.activePiece,
    holdPiece: args.holdPiece ?? null,
    nextQueue: args.nextQueue ?? [],
    objective: args.objective,
  };
}

const tsd = makePuzzle({
  id: "tsd",
  name: "T-Spin Double 基礎",
  category: "T-Spin",
  description: "TSD の典型形。影に合わせて完成させる練習。",
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
  targetRows: [
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
    "...###....",
    "...####...",
    "...#.##...",
    "##########",
  ],
  activePiece: { type: "T", x: 4, y: 17, rotation: 0 },
  nextQueue: ["I", "O", "L", "J", "S"],
  objective: { type: "tspin_double" },
});

const tss = makePuzzle({
  id: "tss",
  name: "T-Spin Single 基礎",
  category: "T-Spin",
  description: "TSS の基本。浅いくぼみへの回し入れ。",
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
  targetRows: [
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
    "...###....",
    "...##.....",
    "##########",
  ],
  activePiece: { type: "T", x: 4, y: 17, rotation: 0 },
  nextQueue: ["I", "O", "L", "J", "S"],
  objective: { type: "tspin_single" },
});

const tst = makePuzzle({
  id: "tst",
  name: "T-Spin Triple 基礎",
  category: "T-Spin",
  description: "TST の地形理解用。",
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
  targetRows: [
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
    "....###...",
    "....###...",
    "....#.#...",
    "...##.##..",
    "##########",
  ],
  activePiece: { type: "T", x: 5, y: 16, rotation: 0 },
  nextQueue: ["I", "L", "J", "O", "S"],
  objective: { type: "tspin_triple" },
});

const mini_tspin = makePuzzle({
  id: "mini_tspin",
  name: "Mini T-Spin 基礎",
  category: "T-Spin",
  description: "Mini の回し感覚を掴む練習。",
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
  targetRows: [
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
    "...###....",
    "...##.....",
    "##########",
  ],
  activePiece: { type: "T", x: 4, y: 16, rotation: 1 },
  nextQueue: ["I", "O", "L", "J", "S"],
  objective: { type: "match_target" },
});

const dt_cannon = makePuzzle({
  id: "dt_cannon",
  name: "DT砲 導入",
  category: "Openers",
  description: "まずは形を作る練習。",
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
    "...#......",
    "...##.....",
    "..###.....",
    "########..",
  ],
  targetRows: [
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
    "...#......",
    "...###....",
    "..####....",
    "..###.....",
    "########..",
  ],
  activePiece: { type: "T", x: 5, y: 15, rotation: 0 },
  holdPiece: "I",
  nextQueue: ["Z", "L", "O", "S", "J"],
  objective: { type: "match_target" },
});

const hachimitsu = makePuzzle({
  id: "hachimitsu",
  name: "ハチミツ砲 導入",
  category: "Openers",
  description: "ハチミツ砲の基本形を覚える練習。",
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
    "...##.#...",
    "#######...",
  ],
  targetRows: [
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
    "...###....",
    "...##.#...",
    "...##.##..",
    "#######...",
  ],
  activePiece: { type: "T", x: 4, y: 16, rotation: 0 },
  nextQueue: ["L", "J", "O", "I", "S"],
  objective: { type: "match_target" },
});

const tki = makePuzzle({
  id: "tki",
  name: "TKI 導入",
  category: "Openers",
  description: "TKI の基本の見た目を作る練習。",
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
    "....##....",
    "...###....",
    "...##.....",
    "########..",
  ],
  targetRows: [
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
    "....##....",
    "...####...",
    "...###....",
    "...##.....",
    "########..",
  ],
  activePiece: { type: "J", x: 5, y: 15, rotation: 1 },
  nextQueue: ["T", "I", "O", "S", "Z"],
  objective: { type: "match_target" },
});

const mountain = makePuzzle({
  id: "mountain",
  name: "山岳積み 基礎",
  category: "Stacking",
  description: "左右を高くして中央を活かす。",
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
    "#........#",
    "##......##",
    "###....###",
    "###....###",
    "####..####",
    "##########",
  ],
  targetRows: [
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
    "#........#",
    "##......##",
    "###....###",
    "###....###",
    "####..####",
    "####..####",
    "####..####",
    "##########",
  ],
  activePiece: { type: "O", x: 4, y: 13, rotation: 0 },
  nextQueue: ["T", "I", "L", "J", "S"],
  objective: { type: "match_target" },
});

const lst = makePuzzle({
  id: "lst",
  name: "LST stacking 基礎",
  category: "Stacking",
  description: "LST の入り口を作る練習。",
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
    "...##.....",
    "...##.....",
    "..####....",
    "..####....",
    "##########",
  ],
  targetRows: [
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
    "...##.....",
    "...###....",
    "...###....",
    "..####....",
    "..####....",
    "##########",
  ],
  activePiece: { type: "T", x: 5, y: 14, rotation: 1 },
  nextQueue: ["L", "S", "J", "I", "O"],
  objective: { type: "match_target" },
});

const six_three = makePuzzle({
  id: "six_three",
  name: "6-3 stacking 基礎",
  category: "Stacking",
  description: "6-3 の左右バランスを作る練習。",
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
    "###.......",
    "###.......",
    "######....",
    "##########",
  ],
  targetRows: [
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
    "###.......",
    "###...##..",
    "########..",
    "########..",
    "##########",
  ],
  activePiece: { type: "O", x: 7, y: 16, rotation: 0 },
  nextQueue: ["T", "I", "L", "J", "S"],
  objective: { type: "match_target" },
});

const pc1 = makePuzzle({
  id: "pc1",
  name: "Perfect Clear 1巡目 導入",
  category: "All Clear",
  description: "少ないミノでオールクリアの感覚を掴む。",
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
    "..........",
    "....##....",
    "....##....",
  ],
  activePiece: { type: "I", x: 3, y: 16, rotation: 0 },
  nextQueue: ["I", "L", "J", "T", "S"],
  objective: { type: "clear_all" },
});

const cheese_race = makePuzzle({
  id: "cheese_race",
  name: "Cheese Race 基礎",
  category: "Downstack",
  description: "穴を追って下掘りする練習。",
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
    "##.#######",
    "###.######",
    "####.#####",
    "#####.####",
    "######.###",
    "#######.##",
    "########.#",
  ],
  activePiece: { type: "I", x: 3, y: 10, rotation: 1 },
  nextQueue: ["J", "L", "T", "S", "Z"],
  objective: { type: "line_clear", lineCount: 1 },
});

const combo_basic = makePuzzle({
  id: "combo_basic",
  name: "Combo 基礎",
  category: "Combo",
  description: "途切れずに消すための地形認識を練習。",
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
    "##..##....",
    "##..##....",
    "######....",
    "##########",
  ],
  activePiece: { type: "I", x: 6, y: 15, rotation: 1 },
  nextQueue: ["O", "T", "L", "J", "S"],
  objective: { type: "line_clear", lineCount: 1 },
});

const b2b_keep = makePuzzle({
  id: "b2b_keep",
  name: "B2B 維持",
  category: "Defense",
  description: "B2B を切らさずに火力を継続する練習。",
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
    "....#.....",
    "...##.....",
    "...#.##...",
    "######.###",
    "##########",
  ],
  targetRows: [
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
    "...###....",
    "...####...",
    "...#.##...",
    "######.###",
    "##########",
  ],
  activePiece: { type: "T", x: 4, y: 16, rotation: 0 },
  nextQueue: ["I", "O", "L", "J", "S"],
  objective: { type: "tspin_double" },
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

export const PRACTICE_LIST: PracticePuzzle[] = Object.values(PRACTICE_PUZZLES);

export function getPracticePuzzle(id: string): PracticePuzzle | null {
  return PRACTICE_PUZZLES[id] ?? null;
}

export function clonePracticePuzzle(puzzle: PracticePuzzle): PracticePuzzle {
  return {
    ...puzzle,
    board: cloneBoard(puzzle.board),
    targetMask: cloneMask(puzzle.targetMask),
    activePiece: puzzle.activePiece ? { ...puzzle.activePiece } : null,
    nextQueue: [...puzzle.nextQueue],
  };
}