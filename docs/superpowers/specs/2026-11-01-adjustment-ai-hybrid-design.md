# 調整AI ハイブリッド高性能化 設計（A案）

日付: 2026-11-01
前提: PWA・GitHub Pages・サーバーレス維持、Dexie v6スキーマ変更なし、送信データは usage.md 範囲内（書籍名・残量・時間割＋自由文）に限定
方針: 正確性優先（多少の時間は許容）、無料枠内で最強、自由文ファースト

## 1. アーキテクチャ全体

既存フロー `ChatScreen → advisor.ts → ai.ts → aiOperations.ts` を残し3層追加。

```
[Dexie: books / records / availability / chatMessages]
  ↓
L1 ローカル推論 v2（オフラインでも賢く）
  advisorV2.ts + velocity.ts（純粋関数）
  ↓ AdvisorReportV2
  ↓
L2 オーケストレーター（オンライン時）
  aiOrchestrator.ts: 要約圧縮 → プロファイル選択 → chatWithModel → 操作パース
  ↓
L3 安定化・切替基盤
  aiProfiles.ts + 切替UI + 再試行
  ↓ ChatScreen（自由文入力主役＋承認カード）
```

- L1は既存 `buildAdvisorReport` を壊さず `buildAdvisorReportV2` 追加
- L2は既存 `chatWithModel` 再利用（temperature 0維持）
- 設定は localStorage のみ（`ai-settings` → `ai-profiles` 移行）

## 2. L1 賢さの中身（advisorV2 + velocity）

新設: `src/lib/velocity.ts`, `src/lib/advisorV2.ts`（純粋関数）

- 実績速度学習: records直近14日から中央値ページ/日・分/ページを本ごとに算出
- 必要量との差分: `needPerDay` と実績ペースの差から `達成確率 高/中/低` を付与
- 停滞検出: 3日以上記録なし or 計画比50%未満を `stalled` として分離（ok/behind/criticalに追加）
- 復習推奨フラグ: 英単語・熟語系のみ `前回からN日` でフラグ（自動操作なし）
- 出力 `AdvisorReportV2`: 既存 `AdvisorReport` ＋ `velocity, confidence, stalled`
- `ChatScreen.loadReport` はアダプタで切替、定型回答はフォールバック専用に格下げ

## 3. L2 最高峰（無料内）＋自律実行

新設: `src/lib/aiOrchestrator.ts`、拡張: `buildSystemPromptV2`

- 対象モデルは無料枠の flagship のみ: Gemini無料枠 / Groq無料枠 / OpenRouter `:free` 系。プリセットは無料3種＋カスタム1枠
- パラメータ: max_tokens 512→2000前後、timeout 60s→90s程度、temperature 0維持
- 2段階推論:
  1. 分析文生成（ReportV2全文＋履歴要約を添付）
  2. 操作JSON生成（対象絞った短いプロンプトで確実にパース）
- 操作拡張 4→10種: 既存 pin/unpin/add/remove ＋ `set_priority / set_ratio / focus_book / relax_book / shift_today / rebalance_week`
- すべて `aiOperations.ts` で期限・開始日変更拒否のバリデーションを通す
- 承認フロー: `pendingOp` を複数件対応に（1件ずつ適用／一括適用）、適用後は `afterApply` 再計算で改善点を報告

## 4. 自由文ファースト＋仕上がり保証

- 入力欄を主役、チップ4つは「例」として残す。新規相談はすべて `requestAi(text)` に直結
- 意図理解はモデルに一任（質問／分析／実行要求／曖昧）。曖昧時のみ1回だけ確認質問
- 実行系は順序付きプラン生成 → プレビュー（変更前後の今日配分・達成確率変化）→ 承認カードで一括適用 → 再計算報告。期待外れなら差し戻し案
- 失敗時は同条件で1回だけ自動再試行。通信エラー表示は既存 `describeAiError` 維持（429明示）
- テスト: velocity/advisorV2純粋関数テスト、orchestratorはモック応答で往復テスト、ChatScreenは自由文→承認→反映の結合テスト

## 5. 無料枠切替UX

新設: `src/lib/aiProfiles.ts`

- `ai-profiles`: `{ profiles: [{id, label, endpoint, model, apiKey}], activeId, preferredId }` を localStorage 保存
- 調整AIヘッダーに現行接続先＋状態ドット（OK／制限中／未設定）＋「モデル切替」ボタン。候補ごとに `pingEndpoint` 到達可否と最終エラー（429/401/timeout）併記
- 429時は「他の無料モデルに切替えて再試行」ボタンを出し、選択→ `activeId` 切替→ `lastFailedInput` 自動再送（再入力不要）
- 設定画面のプリセット選択・到達確認・接続テストはプロファイルごとに対応
- 旧 `ai-settings` は初回起動で既定プロファイルに移行。`isAiConfigured`・`chatWithModel` のI/Fは維持

## 6. 通常AI固定＋自動復帰

- `preferredId` を「いつも使うAI」として固定。切替えても `preferredId` は変えず `activeId` のみ一時変更
- ヘッダー表示: 「いつも：X（制限中）→ 一時使用中：Y」
- 復活検知は軽量に: 裏ポーリングなし。調整AIを開いた時と再試行押下時のみ `pingEndpoint`（`/models`）＋429からの経過時間（60分目安）で判断。チャット送信で試さない
- 復活確認が取れたら `activeId = preferredId` に戻し notice表示。制限中なら一時AI維持
- テスト: 固定→429→一時切替→復活→自動復帰の状態遷移テスト

## 非スコープ

- 有料モデル前提の最適化・課金導線なし
- サーバー・バックエンド追加なし
- 期限・開始日のAI変更は許可しない
- 裏での定期ポーリング・プッシュ通知の拡張はしない

## 成功基準

- オフラインでも ReportV2 の確度・停滞表示が出る
- 自由文の実行要求がプレビュー→承認→反映→再計算報告まで完走する
- 429時に再入力なしで他無料モデルに切替え再送できる
- いつものAI固定＋復活時自動復帰が表示通り動く
- 既存テスト＋新規テストが `npm run build` と共に通る
