# 無料枠・高精度AI（Gemini無料枠・OpenAI互換）設計書

- 日付: 2026-09-26
- 状態: 設計合意済み（§1〜§5承認済み）
- 前提: 無料キー取得OK・スマホGB通信OK・精度優先・提供元はおまかせ→A案（Gemini無料枠）で進行

## 1. 目的と背景

調整AIの自由文相談を、有料契約なしで高精度に使えるようにする。現行はOpenAI本家エンドポイント既定のため、キー料金が障壁になる。OpenAI互換の枠を維持したまま、Gemini無料枠へ切替可能にする。

要件（ユーザー指定）:

- 無料で高精度AIを使う（無料キー取得・GB消費は許容）
- iPhone単体・WiFi→モバイル切替でも使える
- 期限を動かさない（従来制約を維持）
- 依存パッケージを追加しない

## 2. アーキテクチャ

現行ハイブリッドを維持する。

```
[ChatScreen] ── 内蔵プランナー(advisor.ts) ──> 分析・提案（無料・オフライン・ブレなし）
      └─ 自由文 ──> ai.ts ──> Gemini無料枠のOpenAI互換エンドポイント
                    https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
```

- `ai.ts` のOpenAI互換POST（Bearer認証・`temperature: 0`・`max_tokens: 800`・60秒タイムアウト）は変更しない。Gemini側のOpenAI互換パスを使うため送受信形式はそのまま。
- 数値の決定・反映は常に内蔵エンジン（`priority`／`allottedRatio`＋`adjustments`記録のみ、期限・開始日は不変）。LLMはアドバイス文のみ。
- PWA・Dexie・localStorage構成は不変。OpenRouter等への将来切替はエンドポイント＋モデル名変更だけで可能。

## 3. コンポーネント変更

- `src/lib/ai.ts`：ロジック変更なし。Gemini互換エンドポイントの定数（例：`GEMINI_COMPAT_ENDPOINT`）を追加。既存 `DEFAULT_ENDPOINT` は残す。
- `src/screens/SettingsScreen.tsx`：調整AI欄にプリセット選択（OpenAI本家／Gemini無料枠）を追加。選択でエンドポイント・モデル例を自動入力（キーは手入力維持）。説明文（`ai-description`）に無料キー取得手順・回数制限・GB消費を追記。既存の接続テスト（`ai-test`、20秒タイムアウト）を流用。
- `src/screens/ChatScreen.tsx`：ロジック変更なし。文言のみ無料枠でも通じる表現に微調整。接続状態（`chat-connection`）・GB注意（`chat-gb-notice`）・理由別エラー＋再試行（`chat-error`／`chat-retry`）は流用。
- `docs/usage.md`：Gemini無料キー取得手順（AI Studioでの作成〜アプリへの貼り付け）を追記。

スコープ外：Anthropic／GeminiネイティブAPIアダプタ、ストリーミング表示、ローカルLLM同梱、履歴永続化、期限変更。

## 4. データフロー

1. 設定画面でプリセット「Gemini無料枠」を選択 → エンドポイント・モデル例が自動入力 → ユーザーが無料キー（`AIza...`）を貼って保存（localStorageのみ）。
2. 「接続テスト」→ `chatWithModel` で最小リクエスト（system＋`接続テスト`）を20秒タイムアウトで送信 → 成功／失敗理由を表示。
3. 調整AI画面で自由文送信 → `buildAdvisorReport` の要約・内訳・提案を同梱したsystemプロンプト＋履歴をGemini互換エンドポイントへ送信 → 返答をプレーンテキスト表示。
4. 反映は従来通り「今日の配分を反映」「ペース目標を反映」ボタンのみ。LLMの数値は採用しない。

## 5. 異常系とエッジケース

- 未設定・キー空：入力欄無効＋オフラインAI案内（従来通り）。
- `401/404`：キー・モデル名ミスの案内（設定画面・チャット双方）。
- `429`：無料枠の回数制限として「時間をおいて再試行」の案内。
- `timeout`（本番60秒／テスト20秒）：無料枠混雑・高精度モデルの遅延として再試行案内。
- `network`：WiFi・モバイル回線確認の案内。定型文・内蔵提案は継続利用可。
- 本が0冊／今日の空き時間なし：従来通り分析メッセージで案内し提案カードは出さない。

## 6. テスト方針

- `src/lib/ai.test.ts`：Gemini互換エンドポイント定数・送信形式（Bearer・`max_tokens`・`temperature`）の維持確認。既存network／http／timeoutテストはそのまま。
- `src/screens/SettingsScreen.test.tsx`：プリセット選択でエンドポイント・モデル例が入ること、無料キーでの接続テスト成功／401・429等の失敗表示。
- `src/screens/ChatScreen.test.tsx`：既存の接続状態・GB注意・理由別エラー・再試行テストがGemini設定時も通ること。
- フルスイート（`npx vitest run`）＋`npx tsc -b`で回帰確認。期限不変の既存テストも維持。
