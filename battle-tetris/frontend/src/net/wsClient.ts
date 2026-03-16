// ============================================================
// net/wsClient.ts  –  WebSocket クライアント
// 自動再接続を廃止し、切断を明示的に通知する版
// ============================================================

import { ClientMessage, ServerMessage } from "../../../shared/types";
import { serialize, deserialize } from "./protocol";

type MessageHandler = (msg: ServerMessage) => void;
type VoidHandler = () => void;
type ErrorHandler = (ev: Event) => void;
type CloseHandler = (ev: CloseEvent) => void;

export class WsClient {
  private ws: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private openHandlers: VoidHandler[] = [];
  private closeHandlers: CloseHandler[] = [];
  private errorHandlers: ErrorHandler[] = [];

  private url: string;
  private manualClose = false;

  public connected = false;

  constructor(url: string) {
    this.url = url;
  }

  connect(onOpen?: () => void) {
    this.disconnect();

    this.manualClose = false;
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.connected = true;
      if (onOpen) onOpen();
      this.openHandlers.forEach((h) => h());
    };

    this.ws.onmessage = (e) => {
      const msg = deserialize(e.data);
      if (msg) {
        this.handlers.forEach((h) => h(msg));
      }
    };

    this.ws.onerror = (e) => {
      console.error("[wsClient] WebSocket error", e);
      this.errorHandlers.forEach((h) => h(e));
    };

    this.ws.onclose = (e) => {
      this.connected = false;
      const wasManual = this.manualClose;

      this.ws = null;

      if (!wasManual) {
        console.warn("[wsClient] WebSocket closed unexpectedly", {
          code: e.code,
          reason: e.reason,
          wasClean: e.wasClean,
        });
      }

      this.closeHandlers.forEach((h) => h(e));
    };
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(serialize(msg));
    } else {
      console.warn("[wsClient] send failed: not connected", msg);
    }
  }

  onMessage(handler: MessageHandler) {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  onOpen(handler: VoidHandler) {
    this.openHandlers.push(handler);
    return () => {
      this.openHandlers = this.openHandlers.filter((h) => h !== handler);
    };
  }

  onClose(handler: CloseHandler) {
    this.closeHandlers.push(handler);
    return () => {
      this.closeHandlers = this.closeHandlers.filter((h) => h !== handler);
    };
  }

  onError(handler: ErrorHandler) {
    this.errorHandlers.push(handler);
    return () => {
      this.errorHandlers = this.errorHandlers.filter((h) => h !== handler);
    };
  }

  disconnect() {
    this.manualClose = true;

    if (this.ws) {
      try {
        this.ws.close();
      } catch (err) {
        console.error("[wsClient] close failed", err);
      }
    }

    this.ws = null;
    this.connected = false;
  }
}