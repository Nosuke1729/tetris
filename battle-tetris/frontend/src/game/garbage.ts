// ============================================================
// game/garbage.ts
// ============================================================

import { BOARD_WIDTH } from "../../../shared/constants";
import type { QueuedGarbage } from "../../../shared/types";

export function sumGarbageQueue(queue: QueuedGarbage[]): number {
  return queue.reduce((sum, item) => sum + item.amount, 0);
}

export function enqueueGarbage(
  queue: QueuedGarbage[],
  amount: number,
  turnsLeft = 3
): QueuedGarbage[] {
  if (amount <= 0) return [...queue];
  return [...queue, { amount, turnsLeft }];
}

export function cancelGarbage(
  attack: number,
  queue: QueuedGarbage[]
): {
  queue: QueuedGarbage[];
  sentToOpponent: number;
  canceledAmount: number;
} {
  let remain = attack;
  let canceledAmount = 0;
  const next: QueuedGarbage[] = [];

  for (const item of queue) {
    if (remain <= 0) {
      next.push({ ...item });
      continue;
    }

    if (remain >= item.amount) {
      remain -= item.amount;
      canceledAmount += item.amount;
    } else {
      canceledAmount += remain;
      next.push({
        ...item,
        amount: item.amount - remain,
      });
      remain = 0;
    }
  }

  return {
    queue: next,
    sentToOpponent: remain,
    canceledAmount,
  };
}

export function decayGarbageQueue(queue: QueuedGarbage[]): QueuedGarbage[] {
  return queue.map((item) => ({
    ...item,
    turnsLeft: item.turnsLeft - 1,
  }));
}

export function popLandingGarbage(queue: QueuedGarbage[]): {
  queue: QueuedGarbage[];
  landingAmount: number;
} {
  let landingAmount = 0;
  const next: QueuedGarbage[] = [];

  for (const item of queue) {
    if (item.turnsLeft <= 0) {
      landingAmount += item.amount;
    } else {
      next.push(item);
    }
  }

  return { queue: next, landingAmount };
}

export function applyGarbageLines(
  board: number[][],
  amount: number,
  rng: () => number,
  garbageValue = 8
): number[][] {
  const next = board.map((row) => [...row]);

  for (let i = 0; i < amount; i++) {
    const hole = Math.floor(rng() * BOARD_WIDTH);

    next.shift();

    const row = Array(BOARD_WIDTH).fill(garbageValue);
    row[hole] = 0;
    next.push(row);
  }

  return next;
}

export function hasAllClear(board: number[][]): boolean {
  for (const row of board) {
    for (const cell of row) {
      if (cell !== 0) return false;
    }
  }
  return true;
}