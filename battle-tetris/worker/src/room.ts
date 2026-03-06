// ============================================================
// worker/src/room.ts  –  Durable Object: ルーム管理
// ============================================================

import { DurableObject } from "cloudflare:workers";
import { RoomState, PlayerState, ServerMessage, ClientMessage } from "../../shared/types";
import { parseMessage } from "./protocol";
import { validatePieceLock } from "./validation";

const RECONNECT_TIMEOUT_MS = 15000;
const COUNTDOWN_SECONDS = 3;

interface ConnectedPlayer {
  id: string;
  name: string;
  ws: WebSocket;
  disconnectTimer?: ReturnType<typeof setTimeout>;
}

export class BattleRoom extends DurableObject {
  private connections = new Map<string, ConnectedPlayer>();
  private room: RoomState = {
    roomId: "",
    status: "waiting",
    players: [],
    seed: 0,
    createdAt: 0,
    rematchVotes: [],
  };

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
  }

async fetch(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const roomId = url.searchParams.get("roomId") || this.generateRoomId();
  const playerId = crypto.randomUUID();

  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];

  this.handleWebSocket(server, playerId, roomId);

  return new Response(null, { status: 101, webSocket: client });
}

  private handleWebSocket(ws: WebSocket, playerId: string, roomId: string) {
  ws.accept();

  ws.addEventListener("message", (event) => {
    const msg = parseMessage(event.data as string);
    if (!msg) return;
    this.handleMessage(playerId, ws, msg, roomId);
  });

  ws.addEventListener("close", () => {
    this.handleDisconnect(playerId);
  });

  ws.addEventListener("error", () => {
    this.handleDisconnect(playerId);
  });
}

  private handleMessage(
    playerId: string,
    ws: WebSocket,
    msg: ClientMessage,
    roomId: string
  ) {
    switch (msg.type) {
      case "create_room":
        this.handleCreateRoom(playerId, ws, msg.playerName, roomId);
        break;
      case "join_room":
        this.handleJoinRoom(playerId, ws, msg.playerName, msg.roomId);
        break;
      case "ready":
        this.handleReady(playerId);
        break;
      case "start_game":
        this.handleStartGame(playerId);
        break;
      case "piece_lock":
        this.handlePieceLock(playerId, msg);
        break;
      case "board_snapshot":
        this.handleBoardSnapshot(playerId, msg);
        break;
      case "game_over":
        this.handleGameOver(playerId);
        break;
      case "rematch":
        this.handleRematch(playerId);
        break;
      case "leave_room":
        this.handleLeaveRoom(playerId);
        break;
    }
  }

  private handleCreateRoom(playerId: string, ws: WebSocket, playerName: string, roomId: string) {
    if (this.room.players.length > 0) {
      this.sendTo(ws, { type: "error", message: "Room already exists" });
      return;
    }
    this.room.roomId = roomId;
    this.room.status = "waiting";
    this.room.createdAt = Date.now();

    const player: PlayerState = {
      id: playerId, name: playerName,
      connected: true, ready: false, alive: true,
      score: 0, lines: 0, combo: 0, backToBack: false, pendingGarbage: 0,
    };
    this.room.players.push(player);
    this.connections.set(playerId, { id: playerId, name: playerName, ws });

    this.sendTo(ws, { type: "room_created", roomId });
  }

  private handleJoinRoom(playerId: string, ws: WebSocket, playerName: string, roomId: string) {
    if (this.room.roomId && this.room.roomId !== roomId) {
      this.sendTo(ws, { type: "error", message: "Room not found" });
      return;
    }
    if (this.room.players.length >= 2) {
      this.sendTo(ws, { type: "error", message: "Room is full" });
      return;
    }
    if (this.room.status !== "waiting") {
      this.sendTo(ws, { type: "error", message: "Game already started" });
      return;
    }

    const player: PlayerState = {
      id: playerId, name: playerName,
      connected: true, ready: false, alive: true,
      score: 0, lines: 0, combo: 0, backToBack: false, pendingGarbage: 0,
    };
    this.room.players.push(player);
    this.connections.set(playerId, { id: playerId, name: playerName, ws });

    const isHost = this.room.players[0]?.id === playerId;

    this.sendTo(ws, {
      type: "room_joined",
      roomId: this.room.roomId,
      players: this.room.players.map(p => ({ id: p.id, name: p.name })),
      isHost,
    });

    // 既存プレイヤーに通知
    this.broadcast({ type: "player_joined", player: { id: playerId, name: playerName } }, playerId);
  }

  private handleReady(playerId: string) {
    const player = this.room.players.find(p => p.id === playerId);
    if (player) {
      player.ready = true;
      this.broadcast({ type: "player_ready", playerId });
    }
  }

  private handleStartGame(playerId: string) {
    // ホスト（最初に入ったプレイヤー）のみ開始可能
    if (this.room.players[0]?.id !== playerId) return;
    if (this.room.players.length < 2) return;
    if (this.room.status !== "waiting") return;

    this.room.status = "countdown";
    this.startCountdown();
  }

  private startCountdown() {
    let sec = COUNTDOWN_SECONDS;
    const tick = () => {
      this.broadcast({ type: "countdown", seconds: sec });
      if (sec === 0) {
        this.startGameNow();
        return;
      }
      sec--;
      setTimeout(tick, 1000);
    };
    tick();
  }

  private startGameNow() {
    this.room.seed = Math.floor(Math.random() * 0x7fffffff);
    this.room.status = "playing";
    for (const p of this.room.players) {
      p.alive = true; p.score = 0; p.lines = 0;
      p.combo = 0; p.backToBack = false; p.pendingGarbage = 0;
    }
    this.room.rematchVotes = [];
    this.broadcast({ type: "game_start", seed: this.room.seed });
  }

  private handlePieceLock(playerId: string, msg: any) {
    if (!validatePieceLock(msg)) return;
    if (this.room.status !== "playing") return;

    const player = this.room.players.find(p => p.id === playerId);
    if (!player) return;

    player.score += msg.scoreDelta;
    player.lines += msg.linesCleared;
    player.combo = msg.combo;
    player.backToBack = msg.isB2B;
    player.board = msg.board;

    // ゴミ送信
    if (msg.attack > 0) {
      const opponent = this.room.players.find(p => p.id !== playerId);
      if (opponent) {
        opponent.pendingGarbage += msg.attack;
        const opponentConn = this.connections.get(opponent.id);
        if (opponentConn) {
          this.sendTo(opponentConn.ws, { type: "garbage_received", amount: msg.attack });
        }
      }
    }

    // 相手に盤面更新を通知
    this.broadcastOpponentUpdate(playerId, player);
  }

  private handleBoardSnapshot(playerId: string, msg: any) {
    const player = this.room.players.find(p => p.id === playerId);
    if (!player) return;
    player.board = msg.board;
    player.score = msg.score;
    this.broadcastOpponentUpdate(playerId, player);
  }

  private broadcastOpponentUpdate(fromId: string, from: PlayerState) {
    const danger = from.board
      ? from.board.slice(0, 4).some(row => row.some(c => c !== 0))
      : false;

    this.broadcast({
      type: "opponent_update",
      board: from.board ?? [],
      score: from.score,
      combo: from.combo,
      b2b: from.backToBack,
      danger,
    }, fromId);
  }

  private handleGameOver(playerId: string) {
    if (this.room.status !== "playing") return;
    const player = this.room.players.find(p => p.id === playerId);
    if (!player) return;
    player.alive = false;

    const alive = this.room.players.filter(p => p.alive);
    if (alive.length <= 1) {
      this.room.status = "finished";
      this.resolveMatch();
    }
  }

  private resolveMatch() {
    const [p1, p2] = this.room.players;
    if (!p1 || !p2) return;

    if (p1.alive && !p2.alive) {
      this.sendToPlayer(p1.id, { type: "match_result", result: "win" });
      this.sendToPlayer(p2.id, { type: "match_result", result: "lose" });
    } else if (!p1.alive && p2.alive) {
      this.sendToPlayer(p1.id, { type: "match_result", result: "lose" });
      this.sendToPlayer(p2.id, { type: "match_result", result: "win" });
    } else {
      this.broadcast({ type: "match_result", result: "draw" });
    }
  }

  private handleRematch(playerId: string) {
    if (!this.room.rematchVotes.includes(playerId)) {
      this.room.rematchVotes.push(playerId);
    }
    if (this.room.rematchVotes.length >= 2) {
      this.room.status = "waiting";
      this.room.rematchVotes = [];
      for (const p of this.room.players) {
        p.ready = false; p.alive = true;
      }
      this.startCountdown();
    }
  }

  private handleLeaveRoom(playerId: string) {
    this.cleanupPlayer(playerId);
  }

  private handleDisconnect(playerId: string) {
    const conn = this.connections.get(playerId);
    if (!conn) return;

    if (this.room.status === "playing") {
      // 再接続待ち
      conn.disconnectTimer = setTimeout(() => {
        this.cleanupPlayer(playerId);
        if (this.room.status === "playing") {
          this.room.status = "finished";
          this.resolveMatch();
        }
      }, RECONNECT_TIMEOUT_MS);
    } else {
      this.cleanupPlayer(playerId);
    }
  }

  private cleanupPlayer(playerId: string) {
    const conn = this.connections.get(playerId);
    if (conn?.disconnectTimer) clearTimeout(conn.disconnectTimer);
    this.connections.delete(playerId);
    this.room.players = this.room.players.filter(p => p.id !== playerId);
    if (this.room.players.length === 0) {
      this.room.status = "waiting";
      this.room.roomId = "";
    }
    this.broadcast({ type: "player_left", playerId });
  }

  private sendTo(ws: WebSocket, msg: ServerMessage) {
    try { ws.send(JSON.stringify(msg)); } catch {}
  }

  private sendToPlayer(playerId: string, msg: ServerMessage) {
    const conn = this.connections.get(playerId);
    if (conn) this.sendTo(conn.ws, msg);
  }

  private broadcast(msg: ServerMessage, excludeId?: string) {
    for (const [id, conn] of this.connections) {
      if (id !== excludeId) this.sendTo(conn.ws, msg);
    }
  }

  private generateRoomId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}
