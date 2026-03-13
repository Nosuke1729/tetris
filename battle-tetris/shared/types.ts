// ============================================================
// shared/types.ts  –  共通型定義
// ============================================================

export type PieceType = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
export type Rotation = 0 | 1 | 2 | 3;

export interface ActivePiece {
  type: PieceType;
  x: number;
  y: number;
  rotation: Rotation;
  lastAction: "spawn" | "move" | "rotate" | "softDrop" | "hardDrop";
  lastRotateSuccess: boolean;
}

export type QueuedGarbage = {
  amount: number;
  turnsLeft: number;
};

export interface GameState {
  board: number[][];
  activePiece: ActivePiece | null;
  holdPiece: PieceType | null;
  nextQueue: PieceType[];
  bag: PieceType[];
  score: number;
  lines: number;
  level: number;
  combo: number;
  backToBack: boolean;
  pendingGarbage: number;
  pendingGarbageQueue: QueuedGarbage[];
  singleLineBank: number;
  usedHold: boolean;
  isGameOver: boolean;
  isPaused: boolean;
}

export type RoomStatus = "waiting" | "countdown" | "playing" | "finished";

export interface PlayerState {
  id: string;
  name: string;
  connected: boolean;
  ready: boolean;
  alive: boolean;
  score: number;
  lines: number;
  combo: number;
  backToBack: boolean;
  pendingGarbage: number;
  board?: number[][];
}

export interface RoomState {
  roomId: string;
  status: RoomStatus;
  players: PlayerState[];
  seed: number;
  createdAt: number;
  rematchVotes: string[];
}

// Client -> Server
export interface MsgCreateRoom { type: "create_room"; playerName: string; }
export interface MsgJoinRoom { type: "join_room"; roomId: string; playerName: string; }
export interface MsgReady { type: "ready"; }
export interface MsgStartGame { type: "start_game"; }
export interface MsgPieceLock {
  type: "piece_lock";
  board: number[][];
  linesCleared: number;
  isTSpin: boolean;
  isB2B: boolean;
  combo: number;
  attack: number;
  scoreDelta: number;
  pendingGarbageConsumed: number;
}
export interface MsgBoardSnapshot {
  type: "board_snapshot";
  board: number[][];
  activePiece: { type: PieceType; x: number; y: number; rotation: number } | null;
  ghostY: number;
  score: number;
}
export interface MsgGameOver { type: "game_over"; }
export interface MsgRematch { type: "rematch"; }
export interface MsgLeaveRoom { type: "leave_room"; }

export type ClientMessage =
  | MsgCreateRoom
  | MsgJoinRoom
  | MsgReady
  | MsgStartGame
  | MsgPieceLock
  | MsgBoardSnapshot
  | MsgGameOver
  | MsgRematch
  | MsgLeaveRoom;

// Server -> Client
export interface MsgRoomCreated { type: "room_created"; roomId: string; }
export interface MsgRoomJoined {
  type: "room_joined";
  roomId: string;
  players: { id: string; name: string }[];
  isHost: boolean;
}
export interface MsgPlayerJoined { type: "player_joined"; player: { id: string; name: string }; }
export interface MsgPlayerLeft { type: "player_left"; playerId: string; }
export interface MsgCountdown { type: "countdown"; seconds: number; }
export interface MsgGameStart { type: "game_start"; seed: number; }
export interface MsgGarbageReceived { type: "garbage_received"; amount: number; }
export interface MsgOpponentUpdate {
  type: "opponent_update";
  board: number[][];
  score: number;
  combo: number;
  b2b: boolean;
  danger: boolean;
}
export interface MsgMatchResult { type: "match_result"; result: "win" | "lose" | "draw"; }
export interface MsgError { type: "error"; message: string; }
export interface MsgPlayerReady { type: "player_ready"; playerId: string; }

export type ServerMessage =
  | MsgRoomCreated
  | MsgRoomJoined
  | MsgPlayerJoined
  | MsgPlayerLeft
  | MsgCountdown
  | MsgGameStart
  | MsgGarbageReceived
  | MsgOpponentUpdate
  | MsgMatchResult
  | MsgError
  | MsgPlayerReady;