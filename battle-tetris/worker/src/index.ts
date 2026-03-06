// ============================================================
// worker/src/index.ts  –  Cloudflare Workers エントリポイント
// ============================================================

export { BattleRoom } from "./room";

interface Env {
  BATTLE_ROOM: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS ヘッダー
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Upgrade, Connection",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // ルーム作成: POST /rooms
    if (url.pathname === "/rooms" && request.method === "POST") {
      const roomId = generateRoomId();
      const stub = env.BATTLE_ROOM.get(env.BATTLE_ROOM.idFromName(roomId));
      const wsUrl = new URL(request.url);
      wsUrl.pathname = "/ws";
      wsUrl.searchParams.set("roomId", roomId);
      // ルームIDだけ返す
      return new Response(JSON.stringify({ roomId }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // WebSocket 接続: GET /ws?roomId=XXXX
    if (url.pathname === "/ws") {
      let roomId = url.searchParams.get("roomId");
      if (!roomId) {
        roomId = generateRoomId();
      }
      const id = env.BATTLE_ROOM.idFromName(roomId);
      const stub = env.BATTLE_ROOM.get(id);
      const modifiedRequest = new Request(request.url, request);
      return stub.fetch(modifiedRequest);
    }

    return new Response("Battle Tetris Worker", {
      headers: { "Content-Type": "text/plain", ...corsHeaders },
    });
  },
};

function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
