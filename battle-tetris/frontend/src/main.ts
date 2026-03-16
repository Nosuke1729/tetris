// ============================================================
// main.ts  –  アプリケーションエントリポイント
// 対戦切断時に試合を止める安全版
// ============================================================

import { GameEngine, LockEventData } from "./game/gameState";
import { Renderer } from "./ui/renderer";
import { InputManager, InputAction } from "./ui/input";
import { ScreenManager } from "./ui/screens";
import { WsClient } from "./net/wsClient";
import { ServerMessage } from "../../shared/types";
import { BOARD_WIDTH, VISIBLE_HEIGHT, SNAPSHOT_INTERVAL_MS } from "../../shared/constants";
import { createEmptyBoard } from "./game/board";
import { ClearResult } from "./game/scoring";

const CELL_SIZE = 30;
const MINI_CELL = 14;
const NEXT_CELL = 24;
const API_BASE = "https://battle-tetris-server.onrender.com";

function el(id: string) {
  return document.getElementById(id) as HTMLElement;
}
function inp(id: string) {
  return document.getElementById(id) as HTMLInputElement;
}

const screenMgr = new ScreenManager();

let engine: GameEngine | null = null;
let renderer: Renderer | null = null;
let inputMgr: InputManager | null = null;
let ws: WsClient | null = null;
let rafId: number | null = null;
let snapshotTimer: number | null = null;

let playerName = "Player";
let roomId = "";
let isHost = false;
let opponentBoard = createEmptyBoard();
let opponentScore = 0;
let opponentCombo = 0;
let opponentB2B = false;
let opponentDanger = false;
let clearLabel = "";
let clearLabelTimer: number | null = null;
let countdownNum = 0;
let gameMode: "single" | "battle" = "single";
let roomJoined = false;
let battleConnectionLost = false;

window.addEventListener("DOMContentLoaded", () => {
  setupScreens();
  setupTitleScreen();
  setupRoomButtons();
  screenMgr.show("title");
});

function setupScreens() {
  screenMgr.register("title", el("screen-title"));
  screenMgr.register("room", el("screen-room"));
  screenMgr.register("game", el("screen-game"));
  screenMgr.register("result", el("screen-result"));
}

function setupTitleScreen() {
  el("btn-single").onclick = () => startSingle();
  el("btn-battle").onclick = () => showRoomSetup();
}

function startSingle() {
  playerName = inp("input-name").value.trim() || "Player";
  gameMode = "single";
  battleConnectionLost = false;

  const seed = Math.floor(Math.random() * 0x7fffffff);
  startGame(seed);
}

function showRoomSetup() {
  playerName = inp("input-name").value.trim() || "Player";
  gameMode = "battle";
  battleConnectionLost = false;
  roomId = "";
  roomJoined = false;

  screenMgr.show("room");
  setRoomStatus("部屋に参加するか、新しく作成してください。");
  el("room-info").style.display = "none";
  el("btn-start").style.display = "none";
  el("btn-ready").style.display = "none";
  el("btn-ready").textContent = "準備完了！";
  (el("btn-ready") as HTMLButtonElement).disabled = false;

  enableRoomButtons();

  if (ws) {
    ws.disconnect();
    ws = null;
  }

  el("ws-status").textContent = "● 未接続";
  el("ws-status").style.color = "#888";
}

function setRoomStatus(text: string) {
  const status = document.getElementById("room-status");
  if (status) status.textContent = text;
}

function getWsUrl(targetRoomId?: string): string {
  const base = __WS_URL__ || `ws://${location.hostname}:8787`;
  if (!targetRoomId) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}roomId=${encodeURIComponent(targetRoomId)}`;
}

function handleWsUnexpectedClose() {
  el("ws-status").textContent = "● 切断";
  el("ws-status").style.color = "#f44";

  if (gameMode !== "battle") return;

  battleConnectionLost = true;

  if (screenMgr.getCurrent() === "game") {
    stopGame();
    endGame("disconnect");
    return;
  }

  if (screenMgr.getCurrent() === "room") {
    setRoomStatus("接続が切れました。タイトルへ戻って再接続してください。");
    roomJoined = false;
    roomId = "";
    enableRoomButtons();
  }
}

function setupWs(targetRoomId?: string, onOpen?: () => void) {
  if (ws) {
    ws.disconnect();
    ws = null;
  }

  ws = new WsClient(getWsUrl(targetRoomId));

  ws.onOpen(() => {
    el("ws-status").textContent = "● 接続中";
    el("ws-status").style.color = "#4f4";
  });

  ws.onClose(() => {
    handleWsUnexpectedClose();
  });

  ws.onError(() => {
    el("ws-status").textContent = "● エラー";
    el("ws-status").style.color = "#f44";
  });

  ws.onMessage(handleServerMsg);

  ws.connect(() => {
    if (onOpen) onOpen();
  });
}

function handleServerMsg(msg: ServerMessage) {
  switch (msg.type) {
    case "room_created":
      roomId = msg.roomId;
      isHost = true;
      roomJoined = true;
      disableRoomButtons();

      el("room-id-display").textContent = msg.roomId;
      el("room-info").style.display = "";
      setRoomStatus("部屋を作成しました。対戦相手を待っています…");
      el("btn-ready").style.display = "";
      break;

    case "room_joined":
      roomId = msg.roomId;
      isHost = msg.isHost;
      roomJoined = true;
      disableRoomButtons();

      el("room-id-display").textContent = msg.roomId;
      el("room-info").style.display = "";
      setRoomStatus(`参加しました (${msg.players.length}/2)`);
      el("player-list").innerHTML = msg.players.map((p) => `<div>${p.name}</div>`).join("");
      el("btn-ready").style.display = "";
      if (isHost && msg.players.length === 2) {
        el("btn-start").style.display = "";
      }
      break;

    case "player_joined":
      setRoomStatus("対戦相手が参加しました！");
      el("player-list").innerHTML += `<div>${msg.player.name}</div>`;
      if (isHost) {
        el("btn-start").style.display = "";
      }
      break;

    case "player_left":
      if (screenMgr.getCurrent() === "game" && gameMode === "battle") {
        endGame("opponent_left");
        return;
      }

      setRoomStatus("対戦相手が退出しました。");
      el("btn-start").style.display = "none";
      break;

    case "countdown":
      countdownNum = msg.seconds;
      el("countdown-overlay").textContent = msg.seconds > 0 ? `${msg.seconds}` : "GO!";
      el("countdown-overlay").style.display = "";
      if (msg.seconds === 0) {
        setTimeout(() => {
          el("countdown-overlay").style.display = "none";
        }, 700);
      }
      break;

    case "game_start":
      battleConnectionLost = false;
      startGame(msg.seed);
      break;

    case "garbage_received":
      engine?.addPendingGarbage(msg.amount);
      break;

    case "opponent_update":
      opponentBoard = msg.board;
      opponentScore = msg.score;
      opponentCombo = msg.combo;
      opponentB2B = msg.b2b;
      opponentDanger = msg.danger;
      break;

    case "match_result":
      endGame(msg.result);
      break;

    case "error":
      alert(`エラー: ${msg.message}`);
      break;

    case "player_ready":
      break;
  }
}

function disableRoomButtons() {
  (el("btn-create-room") as HTMLButtonElement).disabled = true;
  (el("btn-join-room") as HTMLButtonElement).disabled = true;
}

function enableRoomButtons() {
  (el("btn-create-room") as HTMLButtonElement).disabled = false;
  (el("btn-join-room") as HTMLButtonElement).disabled = false;
}

function setupRoomButtons() {
  el("btn-create-room").onclick = async () => {
    if (roomJoined) return;

    try {
      disableRoomButtons();

      const res = await fetch(`${API_BASE}/rooms`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("部屋作成に失敗しました");
      }

      const data = await res.json();
      roomId = data.roomId;

      setupWs(roomId, () => {
        ws?.send({ type: "create_room", playerName });
      });
    } catch (err) {
      console.error(err);
      alert("部屋作成に失敗しました");
      enableRoomButtons();
    }
  };

  el("btn-join-room").onclick = () => {
    if (roomJoined) return;

    const rid = inp("input-room-id").value.trim().toUpperCase();
    if (!rid) {
      alert("部屋IDを入力してください");
      return;
    }

    disableRoomButtons();
    roomId = rid;

    setupWs(roomId, () => {
      ws?.send({ type: "join_room", roomId: rid, playerName });
    });
  };

  el("btn-ready").onclick = () => {
    ws?.send({ type: "ready" });
    el("btn-ready").textContent = "準備完了！";
    (el("btn-ready") as HTMLButtonElement).disabled = true;
  };

  el("btn-start").onclick = () => {
    ws?.send({ type: "start_game" });
  };

  el("btn-copy-room").onclick = () => {
    navigator.clipboard.writeText(roomId).then(() => {
      alert("コピーしました: " + roomId);
    });
  };

  el("btn-back-title").onclick = () => {
    ws?.send({ type: "leave_room" });
    if (ws) {
      ws.disconnect();
      ws = null;
    }

    roomJoined = false;
    roomId = "";
    enableRoomButtons();
    screenMgr.show("title");
  };
}

function startGame(seed: number) {
  screenMgr.show("game");
  opponentBoard = createEmptyBoard();
  clearLabel = "";
  countdownNum = 0;
  battleConnectionLost = false;

  const rematchBtn = el("btn-rematch") as HTMLButtonElement;
  rematchBtn.textContent = "再戦";
  rematchBtn.disabled = false;

  const canvas = el("game-canvas") as HTMLCanvasElement;
  const LEFT_PANEL_W = 150;
  const RIGHT_PANEL_W = 150;
  const BOARD_PX = CELL_SIZE * BOARD_WIDTH;
  const OPPONENT_GAP = 10;
  const OPPONENT_W = MINI_CELL * BOARD_WIDTH + 60;

  const canvasW =
    gameMode === "battle"
      ? LEFT_PANEL_W + BOARD_PX + RIGHT_PANEL_W + OPPONENT_GAP + OPPONENT_W
      : LEFT_PANEL_W + BOARD_PX + RIGHT_PANEL_W;

  const canvasH = CELL_SIZE * VISIBLE_HEIGHT;

  canvas.width = canvasW;
  canvas.height = canvasH;
  renderer = new Renderer(canvas, CELL_SIZE);

  engine = new GameEngine(seed, {
    onLock: handleLock,
    onGameOver: handleGameOver,
    onClear: handleClear,
  });

  if (inputMgr) inputMgr.destroy();
  inputMgr = new InputManager(handleInput);

  setupGameUI();

  if (rafId) cancelAnimationFrame(rafId);
  const loop = (now: number) => {
    if (!engine) return;
    engine.tick(now);
    renderFrame();
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);

  if (snapshotTimer) {
    clearInterval(snapshotTimer);
    snapshotTimer = null;
  }

  if (gameMode === "battle") {
    snapshotTimer = window.setInterval(sendSnapshot, SNAPSHOT_INTERVAL_MS);
  }
}

function setupGameUI() {
  el("btn-pause").onclick = togglePause;
  el("btn-exit-game").onclick = exitGame;
  el("countdown-overlay").style.display = "none";
  el("opponent-area").style.display = gameMode === "battle" ? "" : "none";
}

function handleInput(action: InputAction) {
  if (!engine) return;

  switch (action) {
    case "moveLeft":
      engine.moveLeft();
      break;
    case "moveRight":
      engine.moveRight();
      break;
    case "softDropStart":
      engine.setSoftDrop(true);
      break;
    case "softDropEnd":
      engine.setSoftDrop(false);
      break;
    case "hardDrop":
      engine.hardDrop();
      break;
    case "rotateCW":
      engine.rotate("cw");
      break;
    case "rotateCCW":
      engine.rotate("ccw");
      break;
    case "hold":
      engine.hold();
      break;
    case "pause":
      togglePause();
      break;
    case "exit":
      exitGame();
      break;
  }
}

function handleLock(data: LockEventData) {
  if (gameMode === "battle" && ws && ws.connected) {
    ws.send({
      type: "piece_lock",
      board: data.board,
      linesCleared: data.linesCleared,
      isTSpin: data.isTSpin,
      isB2B: data.isB2B,
      combo: data.combo,
      attack: data.attack,
      scoreDelta: data.scoreDelta,
      pendingGarbageConsumed: data.pendingGarbageConsumed,
    });
  }
}

function handleClear(result: ClearResult) {
  showClearLabel(result.label);
}

function handleGameOver() {
  if (gameMode === "single") {
    endGame("single");
    return;
  }

  if (gameMode === "battle") {
    if (!battleConnectionLost) {
      ws?.send({ type: "game_over" });
    }
    return;
  }
}

function sendSnapshot() {
  if (!engine || !ws || !ws.connected) return;

  const s = engine.state;
  const p = s.activePiece;
  ws.send({
    type: "board_snapshot",
    board: s.board,
    activePiece: p ? { type: p.type, x: p.x, y: p.y, rotation: p.rotation } : null,
    ghostY: engine.getGhostY(),
    score: s.score,
  });
}

function renderFrame() {
  if (!engine || !renderer) return;
  const s = engine.state;
  const canvas = el("game-canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;

  renderer.clear();

  const PANEL_W = 150;
  const BOARD_PX = CELL_SIZE * BOARD_WIDTH;

  drawLeftPanel(ctx, s, PANEL_W);

  (renderer as any).offsetX = PANEL_W;
  (renderer as any).offsetY = 0;
  renderer.drawBoard(s.board, s.activePiece, engine.getGhostY(), s.pendingGarbage);

  drawRightPanel(ctx, s, PANEL_W + BOARD_PX);

  if (gameMode === "battle") {
    const oppX = PANEL_W + BOARD_PX + PANEL_W + 10;
    drawOpponentPanel(ctx, oppX);
  }

  if (clearLabel) {
    ctx.save();
    ctx.font = "bold 22px 'Courier New', monospace";
    ctx.fillStyle = "#ffd700";
    ctx.textAlign = "center";
    ctx.shadowColor = "#ff8800";
    ctx.shadowBlur = 10;
    ctx.fillText(clearLabel, PANEL_W + BOARD_PX / 2, CELL_SIZE * VISIBLE_HEIGHT / 2);
    ctx.restore();
  }

  if (s.isPaused) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(PANEL_W, 0, BOARD_PX, CELL_SIZE * VISIBLE_HEIGHT);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 32px monospace";
    ctx.textAlign = "center";
    ctx.fillText("PAUSED", PANEL_W + BOARD_PX / 2, CELL_SIZE * VISIBLE_HEIGHT / 2);
  }

  if (s.isGameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(PANEL_W, 0, BOARD_PX, CELL_SIZE * VISIBLE_HEIGHT);
    ctx.fillStyle = "#ff4444";
    ctx.font = "bold 28px monospace";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", PANEL_W + BOARD_PX / 2, CELL_SIZE * VISIBLE_HEIGHT / 2);
  }
}

function drawLeftPanel(ctx: CanvasRenderingContext2D, s: any, panelW: number) {
  ctx.fillStyle = "#0d0d0d";
  ctx.fillRect(0, 0, panelW, CELL_SIZE * VISIBLE_HEIGHT);
  ctx.fillStyle = "#555";
  ctx.font = "12px monospace";
  ctx.textAlign = "left";
  ctx.fillText("HOLD", 10, 20);

  if (s.holdPiece) {
    renderer!.drawPiecePreview(s.holdPiece, 10, 28, 22);
  }

  ctx.fillStyle = s.usedHold ? "#444" : "#888";
  ctx.font = "10px monospace";
  ctx.fillText(s.usedHold ? "(使用済)" : "(可)", 10, 85);

  ctx.fillStyle = "#555";
  ctx.font = "12px monospace";
  ctx.fillText("LEVEL", 10, 110);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 28px monospace";
  ctx.fillText(String(s.level), 10, 140);

  if (s.combo > 1) {
    ctx.fillStyle = "#ff8800";
    ctx.font = "bold 14px monospace";
    ctx.fillText(`${s.combo} COMBO`, 10, 170);
  }

  if (s.backToBack) {
    ctx.fillStyle = "#00cfff";
    ctx.font = "bold 12px monospace";
    ctx.fillText("B2B", 10, 190);
  }

  if (s.pendingGarbage > 0) {
    ctx.fillStyle = "#ff3333";
    ctx.font = "bold 12px monospace";
    ctx.fillText(`GARBAGE: ${s.pendingGarbage}`, 6, 220);
  }
}

function drawRightPanel(ctx: CanvasRenderingContext2D, s: any, startX: number) {
  ctx.fillStyle = "#0d0d0d";
  ctx.fillRect(startX, 0, 150, CELL_SIZE * VISIBLE_HEIGHT);
  ctx.fillStyle = "#555";
  ctx.font = "12px monospace";
  ctx.textAlign = "left";
  ctx.fillText("NEXT", startX + 8, 20);

  for (let i = 0; i < Math.min(5, s.nextQueue.length); i++) {
    renderer!.drawPiecePreview(s.nextQueue[i], startX + 8, 28 + i * 55, NEXT_CELL);
  }

  ctx.fillStyle = "#555";
  ctx.font = "12px monospace";
  ctx.fillText("SCORE", startX + 8, CELL_SIZE * VISIBLE_HEIGHT - 100);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 18px monospace";
  ctx.fillText(String(s.score), startX + 8, CELL_SIZE * VISIBLE_HEIGHT - 78);

  ctx.fillStyle = "#555";
  ctx.font = "12px monospace";
  ctx.fillText("LINES", startX + 8, CELL_SIZE * VISIBLE_HEIGHT - 55);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 18px monospace";
  ctx.fillText(String(s.lines), startX + 8, CELL_SIZE * VISIBLE_HEIGHT - 33);
}

function drawOpponentPanel(ctx: CanvasRenderingContext2D, startX: number) {
  ctx.fillStyle = "#0d0d0d";
  ctx.fillRect(startX, 0, MINI_CELL * BOARD_WIDTH + 60, CELL_SIZE * VISIBLE_HEIGHT);
  ctx.fillStyle = opponentDanger ? "#ff4444" : "#555";
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "left";
  ctx.fillText("OPPONENT", startX + 4, 16);

  renderer!.drawMiniBoard(opponentBoard, startX + 4, 22, MINI_CELL);

  ctx.fillStyle = "#888";
  ctx.font = "11px monospace";
  ctx.fillText(`Score: ${opponentScore}`, startX + 4, 22 + MINI_CELL * VISIBLE_HEIGHT + 18);
  if (opponentCombo > 1) {
    ctx.fillStyle = "#ff8800";
    ctx.fillText(`${opponentCombo} Combo`, startX + 4, 22 + MINI_CELL * VISIBLE_HEIGHT + 34);
  }
  if (opponentB2B) {
    ctx.fillStyle = "#00cfff";
    ctx.fillText("B2B", startX + 4, 22 + MINI_CELL * VISIBLE_HEIGHT + 50);
  }
}

function showClearLabel(label: string) {
  clearLabel = label;
  if (clearLabelTimer) clearTimeout(clearLabelTimer);
  clearLabelTimer = window.setTimeout(() => {
    clearLabel = "";
  }, 1200);
}

function togglePause() {
  if (!engine) return;
  if (engine.state.isPaused) {
    engine.resume();
    el("btn-pause").textContent = "一時停止";
  } else {
    engine.pause();
    el("btn-pause").textContent = "再開";
  }
}

function exitGame() {
  stopGame();

  if (gameMode === "battle") {
    ws?.send({ type: "leave_room" });
  }

  screenMgr.show("title");
}

function stopGame() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (snapshotTimer) {
    clearInterval(snapshotTimer);
    snapshotTimer = null;
  }
  inputMgr?.destroy();
  inputMgr = null;
}

function endGame(result: string) {
  stopGame();
  screenMgr.show("result");

  const s = engine?.state;

  let label = "GAME OVER";
  let color = "#aaa";

  if (result === "win") {
    label = "🏆 YOU WIN!";
    color = "#ffd700";
  } else if (result === "lose") {
    label = "💀 YOU LOSE";
    color = "#ff4444";
  } else if (result === "draw") {
    label = "🤝 DRAW";
    color = "#aaa";
  } else if (result === "disconnect") {
    label = "⚠ CONNECTION LOST";
    color = "#ff8800";
  } else if (result === "opponent_left") {
    label = "🏆 OPPONENT LEFT";
    color = "#ffd700";
  }

  el("result-label").textContent = label;
  el("result-label").style.color = color;

  el("result-score").textContent = `Score: ${s?.score ?? 0}`;
  el("result-lines").textContent = `Lines: ${s?.lines ?? 0}`;
  el("result-level").textContent = `Level: ${s?.level ?? 1}`;

  const rematchBtn = el("btn-rematch") as HTMLButtonElement;
  rematchBtn.style.display = gameMode === "battle" && result !== "disconnect" && result !== "opponent_left" ? "" : "none";
  rematchBtn.textContent = "再戦";
  rematchBtn.disabled = false;

  rematchBtn.onclick = () => {
    ws?.send({ type: "rematch" });
    rematchBtn.textContent = "再戦申請中…";
    rematchBtn.disabled = true;
  };

  el("btn-back-title2").onclick = () => {
    ws?.send({ type: "leave_room" });
    if (ws) {
      ws.disconnect();
      ws = null;
    }
    roomJoined = false;
    roomId = "";
    screenMgr.show("title");
  };

  el("btn-play-again").onclick = () => startSingle();
  el("btn-play-again").style.display = gameMode === "single" ? "" : "none";
}

declare const __WS_URL__: string | undefined;