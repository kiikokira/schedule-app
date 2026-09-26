# 無料枠・高精度AI（Gemini無料枠） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 調整AIの自由文相談をGemini無料枠（OpenAI互換）で使えるようにする。

**Architecture:** ハイブリッド維持。`ai.ts` のPOST形式は不変で、設定プリセットでGemini互換エンドポイント＋モデル例を自動入力する。数値決定は内蔵エンジンのみ。

**Tech Stack:** React + TypeScript + Vite、Dexie/IndexedDB、localStorage、vitest + @testing-library/react、fetch（OpenAI互換）。依存追加なし。

**Spec:** `docs/superpowers/specs/2026-09-26-gemini-free-ai-design.md`

## Global Constraints

- 依存パッケージを追加しない（すべて自前実装）。
- 数値の決定と反映は常に内蔵の決定論的エンジンが行う。LLMはアドバイス文のみ。
- 期限・開始日は一切変更しない。
- APIキーは端末内（localStorage）のみ保存。サーバー送信なし。
- 使用端末: iPhone 13（Safari）。PWA・Dexie構成は不変。
- `temperature: 0`、`max_tokens: 800`、本番60秒タイムアウト／接続テスト20秒タイムアウトを維持。

---

## File Structure

- `src/lib/ai.ts` — 送受信ロジックは不変。Gemini互換エンドポイント定数 `GEMINI_COMPAT_ENDPOINT` とモデル例定数 `GEMINI_EXAMPLE_MODEL` を追加するのみ。
- `src/lib/ai.test.ts` — 定数と送信形式維持のテスト。
- `src/screens/SettingsScreen.tsx` — 調整AI欄にプリセット選択（`ai-preset`）を追加。選択でエンドポイント・モデル例を自動入力。説明文と接続テストは既存流用。
- `src/screens/SettingsScreen.test.tsx` — プリセット選択と接続テストのテスト。
- `src/screens/ChatScreen.tsx` — ロジック変更なし。文言のみ無料枠でも通じる表現に微調整（既存testid維持）。
- `src/screens/ChatScreen.test.tsx` — Gemini設定時も既存表示が通ることのテスト。
- `docs/usage.md` — Gemini無料キー取得手順を追記。

### Task 1: `ai.ts` にGemini互換定数を追加

**Files:**
- Modify: `src/lib/ai.ts:5`
- Test: `src/lib/ai.test.ts`

**Interfaces:**
- Consumes: なし（既存 `DEFAULT_ENDPOINT` は残す）
- Produces: `GEMINI_COMPAT_ENDPOINT: string`、`GEMINI_EXAMPLE_MODEL: string`（Task 2がプリセット初期値に使用）

- [ ] **Step 1: Write the failing test**

```typescript
import { GEMINI_COMPAT_ENDPOINT, GEMINI_EXAMPLE_MODEL } from './ai'

it('exposes the Gemini OpenAI-compatible endpoint and example model', () => {
  expect(GEMINI_COMPAT_ENDPOINT).toBe(
    'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  )
  expect(typeof GEMINI_EXAMPLE_MODEL).toBe('string')
  expect(GEMINI_EXAMPLE_MODEL.length).toBeGreaterThan(0)
})
```

追加場所：`src/lib/ai.test.ts` の `describe('ai settings', ...)` の直後。

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c npx vitest run src/lib/ai.test.ts`
Expected: FAIL with "does not provide an export named 'GEMINI_COMPAT_ENDPOINT'"

- [ ] **Step 3: Write minimal implementation**

`src/lib/ai.ts` の5行目直後に追加：

```typescript
export const GEMINI_COMPAT_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
export const GEMINI_EXAMPLE_MODEL = 'gemini-2.0-flash'
```

注意：モデル名は例示。正確な名称はプロバイダ一覧で確認する旨をTask 2・Task 4の文言で補う。

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd /c npx vitest run src/lib/ai.test.ts`
Expected: PASS（10 tests + 新規1件）

- [ ] **Step 5: Commit**

```bash
cmd /c git add src/lib/ai.ts src/lib/ai.test.ts
cmd /c git commit -m "feat: Gemini無料枠の互換エンドポイント定数を追加"
```

### Task 2: 設定画面にプリセット選択を追加

**Files:**
- Modify: `src/screens/SettingsScreen.tsx:200-244`
- Test: `src/screens/SettingsScreen.test.tsx`

**Interfaces:**
- Consumes: Task 1の `GEMINI_COMPAT_ENDPOINT`、`GEMINI_EXAMPLE_MODEL`、`DEFAULT_ENDPOINT`
- Produces: プリセットUI（`ai-preset`）。Task 3・Task 4の前提。既存 `ai-test`（20秒タイムアウト）は流用し変更なし。

- [ ] **Step 1: Write the failing test**

`src/screens/SettingsScreen.test.tsx` の `describe('adjustment AI settings', ...)` 末尾に追加：

```tsx
it('fills the Gemini free-tier preset on selection', () => {
  render(<SettingsScreen onDone={() => {}} />)
  fireEvent.change(screen.getByTestId('ai-preset'), { target: { value: 'gemini' } })
  expect(screen.getByTestId('ai-endpoint')).toHaveValue(
    'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  )
  expect(screen.getByTestId('ai-model')).toHaveValue('gemini-2.0-flash')
})

it('restores the OpenAI preset on selection', () => {
  render(<SettingsScreen onDone={() => {}} />)
  fireEvent.change(screen.getByTestId('ai-preset'), { target: { value: 'gemini' } })
  fireEvent.change(screen.getByTestId('ai-preset'), { target: { value: 'openai' } })
  expect(screen.getByTestId('ai-endpoint')).toHaveValue(
    'https://api.openai.com/v1/chat/completions',
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c npx vitest run src/screens/SettingsScreen.test.tsx`
Expected: FAIL with "Unable to find an element by: [data-testid=\"ai-preset\"]"

- [ ] **Step 3: Write minimal implementation**

`src/screens/SettingsScreen.tsx` の先頭importを変更：

```tsx
import { getAiSettings, setAiSettings, chatWithModel, GEMINI_COMPAT_ENDPOINT, GEMINI_EXAMPLE_MODEL, DEFAULT_ENDPOINT } from '../lib/ai'
```

調整AIセクションの `<h2>調整AI（オンライン）</h2>` 直後に追加：

```tsx
<label htmlFor="ai-preset">プリセット</label>
<select
  id="ai-preset"
  data-testid="ai-preset"
  defaultValue={aiEndpoint === GEMINI_COMPAT_ENDPOINT ? 'gemini' : 'openai'}
  onChange={(e) => {
    if (e.target.value === 'gemini') {
      setAiEndpoint(GEMINI_COMPAT_ENDPOINT)
      if (!aiModel.trim()) setAiModel(GEMINI_EXAMPLE_MODEL)
    } else {
      setAiEndpoint(DEFAULT_ENDPOINT)
    }
  }}
>
  <option value="openai">OpenAI本家</option>
  <option value="gemini">Gemini無料枠（OpenAI互換）</option>
</select>
```

説明文（`ai-description`）末尾に1文追加（既存文言は残す）：

```tsx
無料枠はGoogle AI Studioで無料キーを作成し、モデル名は一覧で確認してください。無料枠は回数制限があります。
```

`ai-api-key` のplaceholderは `"sk-... / AIza...（無料枠はAIzaから始まるキー）"` に変更する。

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd /c npx vitest run src/screens/SettingsScreen.test.tsx`
Expected: PASS（既存14件＋新規2件）。既存の `mentions mobile data and high-accuracy models` が通ること（文言追記のみで既存語句を消さない）。

- [ ] **Step 5: Commit**

```bash
cmd /c git add src/screens/SettingsScreen.tsx src/screens/SettingsScreen.test.tsx
cmd /c git commit -m "feat: 調整AI設定にGemini無料枠プリセットを追加"
```

### Task 3: チャット画面の文言を無料枠対応に微調整

**Files:**
- Modify: `src/screens/ChatScreen.tsx`（`chat-gb-notice` の文言のみ）
- Test: `src/screens/ChatScreen.test.tsx`

**Interfaces:**
- Consumes: Task 1の定数（テスト内でGemini設定値として使用）
- Produces: 無料枠でも通じる表示。ロジック・testid変更なし。

- [ ] **Step 1: Write the failing test**

`src/screens/ChatScreen.test.tsx` 末尾に追加：

```tsx
it('shows the mobile notice when Gemini endpoint is configured', async () => {
  setAiSettings({
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    apiKey: 'AIza-test',
    model: 'gemini-2.0-flash',
  })
  await fillBook()
  await addTodaySlot()
  render(<ChatScreen onBack={() => {}} today={TODAY} />)
  await screen.findByTestId('analysis-summary')
  expect(screen.getByTestId('chat-gb-notice')).toHaveTextContent(/モバイル回線/)
  expect(screen.getByTestId('chat-gb-notice')).toHaveTextContent(/無料枠/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c npx vitest run src/screens/ChatScreen.test.tsx`
Expected: FAIL with "expected ... to have text content /無料枠/"（現行文言に無料枠の語がないため）

- [ ] **Step 3: Write minimal implementation**

`chat-gb-notice` の文言を以下に変更（`モバイル回線` の語は残す）：

```tsx
モバイル回線・無料枠でも利用できます（1回数KB〜数十KB程度の通信・GBを消費します）。無料枠は回数制限があります。高精度モデルは応答に時間がかかります。
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd /c npx vitest run src/screens/ChatScreen.test.tsx src/lib/ai.test.ts src/screens/SettingsScreen.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cmd /c git add src/screens/ChatScreen.tsx src/screens/ChatScreen.test.tsx
cmd /c git commit -m "feat: チャット注意文を無料枠対応に微調整"
```

### Task 4: 利用手順書にGemini無料キー手順を追記

**Files:**
- Modify: `docs/usage.md`

**Interfaces:**
- Consumes: Task 1〜3の確定文言（エンドポイント・プリセット名）
- Produces: ユーザー向け手順。コード変更なし。

- [ ] **Step 1: Append the usage section**

`docs/usage.md` 末尾に追加：

```markdown
# 調整AIを無料枠で使う（Gemini無料枠）

1. Google AI Studio に Google アカウントでログインし、APIキーを作成する（`AIza...`）。
2. 使いたいモデル名を一覧で確認する（例: `gemini-2.0-flash`。名称は更新されるため必ず確認）。
3. アプリの「設定」→「調整AI（オンライン）」でプリセット「Gemini無料枠」を選ぶ。
4. APIキー欄に `AIza...` を貼り付け、「設定を保存」→「接続テスト」で `接続テスト成功` を確認する。
5. 「調整AI」画面で自由文相談を使う。WiFi・モバイル回線どちらでも利用可（GBを消費）。無料枠は回数制限あり（`429` の時は時間をおく）。

> APIキーはこの端末のブラウザ内（localStorage）にのみ保存されます。サーバーには送信されません。
```

- [ ] **Step 2: Verify the docs render**

Run: `cmd /c git diff --stat docs/usage.md`
Expected: `docs/usage.md` のみ変更。目視で手順番号・URL・キー形式が正しいこと。

- [ ] **Step 3: Commit**

```bash
cmd /c git add docs/usage.md
cmd /c git commit -m "docs: Gemini無料枠の利用手順を追記"
```

### Task 5: 全体回帰確認

**Files:** なし（検証のみ）

- [ ] **Step 1: Run the full suite**

Run: `cmd /c npx vitest run`
Expected: Test Files 27 passed、Tests 384以上 passed（新規分が加算）

- [ ] **Step 2: Run the type check**

Run: `cmd /c npx tsc -b`
Expected: exit 0（出力なし）
