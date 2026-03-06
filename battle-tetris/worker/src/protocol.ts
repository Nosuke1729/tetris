// ============================================================
// worker/src/protocol.ts  –  メッセージパース
// ============================================================

import { ClientMessage } from "../../shared/types";

export function parseMessage(raw: string): ClientMessage | null {
  try {
    const obj = JSON.parse(raw);
    if (typeof obj.type !== "string") return null;
    return obj as ClientMessage;
  } catch {
    return null;
  }
}
