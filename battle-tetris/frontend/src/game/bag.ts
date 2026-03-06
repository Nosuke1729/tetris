// ============================================================
// game/bag.ts  –  7-bag ランダム生成
// ============================================================

import { PieceType } from "../../../shared/types";

const ALL_PIECES: PieceType[] = ["I", "O", "T", "S", "Z", "J", "L"];

// シード付き疑似乱数 (mulberry32)
export function createRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 7-bag をシャッフルして返す
export function generateBag(rng: () => number): PieceType[] {
  const bag = [...ALL_PIECES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

// BagManager – 無限にミノを取り出せる
export class BagManager {
  private rng: () => number;
  private bag: PieceType[] = [];

  constructor(seed: number) {
    this.rng = createRng(seed);
    this.refill();
  }

  private refill() {
    this.bag = generateBag(this.rng);
  }

  next(): PieceType {
    if (this.bag.length === 0) this.refill();
    return this.bag.shift()!;
  }

  peek(count: number): PieceType[] {
    while (this.bag.length < count) {
      this.bag.push(...generateBag(this.rng));
    }
    return this.bag.slice(0, count);
  }
}
