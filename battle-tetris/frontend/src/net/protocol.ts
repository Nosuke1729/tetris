// ============================================================
// net/protocol.ts  –  WebSocket メッセージのシリアライズ/デシリアライズ
// ============================================================

import { ClientMessage, ServerMessage } from "../../../shared/types";

export function serialize(msg: ClientMessage): string {
  return JSON.stringify(msg);
}

export function deserialize(raw: string): ServerMessage | null {
  try {
    return JSON.parse(raw) as ServerMessage;
  } catch {
    console.warn("[protocol] JSON parse failed:", raw);
    return null;
  }
}
