// ============================================================
// game/garbage.ts  –  ゴミライン送受信ロジック
// ============================================================

// ゴミ相殺: 自分のpending から引いて余りを返す
export function cancelGarbage(
  incoming: number,
  pendingGarbage: number
): { newPending: number; sentToOpponent: number } {
  if (incoming <= pendingGarbage) {
    return { newPending: pendingGarbage - incoming, sentToOpponent: 0 };
  }
  return { newPending: 0, sentToOpponent: incoming - pendingGarbage };
}

// ゴミ受信: pendingGarbage に加算
export function receiveGarbage(current: number, amount: number): number {
  return current + amount;
}
