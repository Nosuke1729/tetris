# Battle Tetris Web

ブラウザで動くシングルプレイ・1vs1 対戦テトリス。  
フロントエンド: GitHub Pages  
バックエンド: Cloudflare Workers + Durable Objects

## ディレクトリ構成

```
battle-tetris/
  frontend/           # HTML / CSS / TypeScript (Vite)
    index.html
    style.css
    src/
      main.ts         # エントリポイント・アプリ制御
      game/
        board.ts      # 盤面操作(純関数)
        piece.ts      # ミノ定義・形状・色
        bag.ts        # 7-bag + シード乱数
        rotation.ts   # SRS 壁蹴り
        tspin.ts      # T-Spin 判定
        scoring.ts    # スコア・攻撃量計算
        garbage.ts    # ゴミ相殺ロジック
        gameState.ts  # ゲームエンジン本体
      net/
        wsClient.ts   # WebSocket クライアント
        protocol.ts   # シリアライズ
      ui/
        renderer.ts   # Canvas 描画
        input.ts      # キー入力 (DAS/ARR)
        screens.ts    # 画面切り替え
  worker/             # Cloudflare Workers
    src/
      index.ts        # Worker エントリ
      room.ts         # BattleRoom Durable Object
      protocol.ts     # メッセージパース
      validation.ts   # 簡易チート検証
    wrangler.toml
  shared/
    types.ts          # 共通型定義
    constants.ts      # 共通定数
```

## ローカル開発

### フロントエンド

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### バックエンド (Cloudflare Workers)

```bash
cd worker
npm install
npm run dev
# → http://localhost:8787
```

フロントは `.env.local` で Worker URL を指定できます:

```
VITE_WS_URL=ws://localhost:8787/ws
```

## デプロイ

### フロントエンド → GitHub Pages

```bash
cd frontend
npm run build
# dist/ を GitHub Pages に push
```

`.env.production` に本番 Worker URL を設定:

```
VITE_WS_URL=wss://your-worker.your-subdomain.workers.dev/ws
```

### バックエンド → Cloudflare Workers

```bash
cd worker
npx wrangler login
npm run deploy
```

## 実装済み機能

- ✅ シングルプレイ (Phase 1)
- ✅ 7-bag ランダム / シード乱数
- ✅ SRS 回転 + 壁蹴り
- ✅ T-Spin 判定
- ✅ Hold / Next 5
- ✅ ゴーストミノ
- ✅ Lock Delay (500ms)
- ✅ ライン消去 1-4
- ✅ スコア (Single/Double/Triple/Tetris/T-Spin)
- ✅ Combo ボーナス
- ✅ Back-to-Back ボーナス
- ✅ ハードドロップ / ソフトドロップ加点
- ✅ レベルアップ (10ライン毎)
- ✅ 対戦ルーム (Phase 2)
- ✅ WebSocket 通信
- ✅ ゴミライン送信・相殺
- ✅ 勝敗判定
- ✅ Rematch

## 操作

| キー | アクション |
|------|-----------|
| ← → | 左右移動 |
| ↓ | ソフトドロップ |
| Space | ハードドロップ |
| ↑ / X | 右回転 |
| Z | 左回転 |
| C | ホールド |
| P | ポーズ/再開 |
| Esc | 退出 |
