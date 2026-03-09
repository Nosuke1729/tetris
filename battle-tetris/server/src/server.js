import express from "express";
import http from "http";
import cors from "cors";
import { WebSocketServer } from "ws";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

const COUNTDOWN_SECONDS = 3;
const rooms = new Map(); // roomId -> room

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createEmptyRoom(roomId) {
  return {
    roomId,
    status: "waiting", // waiting | countdown | playing | finished
    players: [],       // [{ id, name, ws, ready, alive, score, lines, combo, backToBack, pendingGarbage, board }]
    rematchVotes: [],
    seed: 0
  };
}

function send(ws, msg) {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify(msg));
}

function broadcast(room, msg, excludeId = null) {
  for (const p of room.players) {
    if (excludeId && p.id === excludeId) continue;
    send(p.ws, msg);
  }
}

function findPlayerRoom(playerId) {
  for (const room of rooms.values()) {
    const p = room.players.find(x => x.id === playerId);
    if (p) return room;
  }
  return null;
}

app.get("/", (_req, res) => {
  res.send("Battle Tetris Render Server");
});

app.post("/rooms", (_req, res) => {
  const roomId = generateRoomId();
  rooms.set(roomId, createEmptyRoom(roomId));
  res.json({ roomId });
});

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const roomId = url.searchParams.get("roomId");
  const playerId = crypto.randomUUID();

  ws.playerId = playerId;
  ws.roomId = roomId || "";

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === "create_room") {
      const rid = ws.roomId;
      if (!rid) {
        send(ws, { type: "error", message: "roomId missing" });
        return;
      }

      let room = rooms.get(rid);
      if (!room) {
        room = createEmptyRoom(rid);
        rooms.set(rid, room);
      }

      if (room.players.length > 0) {
        send(ws, { type: "error", message: "Room already exists" });
        return;
      }

      const player = {
        id: playerId,
        name: msg.playerName,
        ws,
        ready: false,
        alive: true,
        score: 0,
        lines: 0,
        combo: 0,
        backToBack: false,
        pendingGarbage: 0,
        board: []
      };

      room.players.push(player);
      send(ws, { type: "room_created", roomId: rid });
      return;
    }

    if (msg.type === "join_room") {
      const rid = msg.roomId;
      const room = rooms.get(rid);
      if (!room) {
        send(ws, { type: "error", message: "Room not found" });
        return;
      }
      if (room.players.length >= 2) {
        send(ws, { type: "error", message: "Room is full" });
        return;
      }
      if (room.status !== "waiting") {
        send(ws, { type: "error", message: "Game already started" });
        return;
      }

      ws.roomId = rid;

      const player = {
        id: playerId,
        name: msg.playerName,
        ws,
        ready: false,
        alive: true,
        score: 0,
        lines: 0,
        combo: 0,
        backToBack: false,
        pendingGarbage: 0,
        board: []
      };

      room.players.push(player);

      send(ws, {
        type: "room_joined",
        roomId: rid,
        players: room.players.map(p => ({ id: p.id, name: p.name })),
        isHost: room.players[0]?.id === playerId
      });

      broadcast(room, {
        type: "player_joined",
        player: { id: playerId, name: msg.playerName }
      }, playerId);

      return;
    }

    const room = findPlayerRoom(playerId);
    if (!room) return;

    const player = room.players.find(p => p.id === playerId);
    if (!player) return;

    if (msg.type === "ready") {
      player.ready = true;
      broadcast(room, { type: "player_ready", playerId });
      return;
    }

    if (msg.type === "start_game") {
      if (room.players[0]?.id !== playerId) return;
      if (room.players.length < 2) return;
      if (room.status !== "waiting") return;

      room.status = "countdown";
      let sec = COUNTDOWN_SECONDS;

      const tick = () => {
        broadcast(room, { type: "countdown", seconds: sec });
        if (sec === 0) {
          room.seed = Math.floor(Math.random() * 0x7fffffff);
          room.status = "playing";
          for (const p of room.players) {
            p.alive = true;
            p.score = 0;
            p.lines = 0;
            p.combo = 0;
            p.backToBack = false;
            p.pendingGarbage = 0;
          }
          room.rematchVotes = [];
          broadcast(room, { type: "game_start", seed: room.seed });
          return;
        }
        sec--;
        setTimeout(tick, 1000);
      };

      tick();
      return;
    }

    if (msg.type === "piece_lock") {
      if (room.status !== "playing") return;

      player.score += msg.scoreDelta || 0;
      player.lines += msg.linesCleared || 0;
      player.combo = msg.combo || 0;
      player.backToBack = !!msg.isB2B;
      player.board = msg.board || [];

      if ((msg.attack || 0) > 0) {
        const opponent = room.players.find(p => p.id !== playerId);
        if (opponent) {
          opponent.pendingGarbage += msg.attack;
          send(opponent.ws, { type: "garbage_received", amount: msg.attack });
        }
      }

      const danger = Array.isArray(player.board)
        ? player.board.slice(0, 4).some(row => row.some(c => c !== 0))
        : false;

      broadcast(room, {
        type: "opponent_update",
        board: player.board || [],
        score: player.score,
        combo: player.combo,
        b2b: player.backToBack,
        danger
      }, playerId);

      return;
    }

    if (msg.type === "board_snapshot") {
      player.board = msg.board || [];
      player.score = msg.score || 0;

      const danger = Array.isArray(player.board)
        ? player.board.slice(0, 4).some(row => row.some(c => c !== 0))
        : false;

      broadcast(room, {
        type: "opponent_update",
        board: player.board || [],
        score: player.score,
        combo: player.combo,
        b2b: player.backToBack,
        danger
      }, playerId);

      return;
    }

    if (msg.type === "game_over") {
      if (room.status !== "playing") return;
      player.alive = false;

      const alive = room.players.filter(p => p.alive);
      if (alive.length <= 1) {
        room.status = "finished";
        const [p1, p2] = room.players;
        if (p1 && p2) {
          if (p1.alive && !p2.alive) {
            send(p1.ws, { type: "match_result", result: "win" });
            send(p2.ws, { type: "match_result", result: "lose" });
          } else if (!p1.alive && p2.alive) {
            send(p1.ws, { type: "match_result", result: "lose" });
            send(p2.ws, { type: "match_result", result: "win" });
          } else {
            broadcast(room, { type: "match_result", result: "draw" });
          }
        }
      }
      return;
    }

if (msg.type === "rematch") {
  if (!room.rematchVotes.includes(playerId)) {
    room.rematchVotes.push(playerId);
  }

  if (room.rematchVotes.length >= 2) {
    room.status = "countdown";
    room.rematchVotes = [];

    for (const p of room.players) {
      p.ready = false;
      p.alive = true;
      p.score = 0;
      p.lines = 0;
      p.combo = 0;
      p.backToBack = false;
      p.pendingGarbage = 0;
      p.board = [];
    }

    let sec = 3;
    const tick = () => {
      broadcast(room, { type: "countdown", seconds: sec });

      if (sec === 0) {
        room.seed = Math.floor(Math.random() * 0x7fffffff);
        room.status = "playing";
        broadcast(room, { type: "game_start", seed: room.seed });
        return;
      }

      sec--;
      setTimeout(tick, 1000);
    };

    tick();
  }

  return;
}

    if (msg.type === "leave_room") {
      room.players = room.players.filter(p => p.id !== playerId);
      broadcast(room, { type: "player_left", playerId });

      if (room.players.length === 0) {
        rooms.delete(room.roomId);
      }
      return;
    }
  });

  ws.on("close", () => {
    const room = findPlayerRoom(playerId);
    if (!room) return;

    room.players = room.players.filter(p => p.id !== playerId);
    broadcast(room, { type: "player_left", playerId });

    if (room.players.length === 0) {
      rooms.delete(room.roomId);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Battle Tetris server listening on port ${PORT}`);
});