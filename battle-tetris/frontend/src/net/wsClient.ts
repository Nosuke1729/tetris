// ============================================================
// net/wsClient.ts  –  WebSocket クライアント
// ============================================================

import { ClientMessage, ServerMessage } from "../../../shared/types";
import { serialize, deserialize } from "./protocol";

type MessageHandler = (msg: ServerMessage) => void;

export class WsClient {
  private ws: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private reconnectTimer: number | null = null;
  private url: string;
  private maxReconnectMs = 15000;
  private reconnectStart = 0;
  public connected = false;

  constructor(url: string) {
    this.url = url;
  }

  connect(onOpen?: () => void) {
    if (this.ws) this.ws.close();
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.connected = true;
      this.reconnectStart = 0;
      onOpen?.();
    };

    this.ws.onmessage = (e) => {
      const msg = deserialize(e.data);
      if (msg) this.handlers.forEach(h => h(msg));
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.scheduleReconnect();
    };

    this.ws.onerror = (e) => {
      console.error("[wsClient] WebSocket error", e);
    };
  }

  private scheduleReconnect() {
    if (this.reconnectStart === 0) this.reconnectStart = Date.now();
    if (Date.now() - this.reconnectStart > this.maxReconnectMs) {
      console.warn("[wsClient] Reconnect timeout");
      return;
    }
    this.reconnectTimer = window.setTimeout(() => this.connect(), 2000);
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(serialize(msg));
    } else {
      console.warn("[wsClient] send failed: not connected");
    }
  }

  onMessage(handler: MessageHandler) {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler);
    };
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  }
}
