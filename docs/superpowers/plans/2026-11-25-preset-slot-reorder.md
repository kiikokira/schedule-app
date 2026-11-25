# プリセット時間帯の並べ替え Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** プリセット制作の時間帯カードを「↑」「↓」で隣と丸ごと入れ替えられるようにする。

**Architecture:** PlanScreen のローカル状態 `presetRows` に隣接要素を交換する `movePresetRow` を追加し、各カードの2行目右端にボタンを置く。保存処理は表示順をそのまま保存する既存実装を変更しない。

**Tech Stack:** React 18 + TypeScript + Vitest + Testing Library

**Spec:** `docs/superpowers/specs/2026-11-25-preset-slot-reorder-design.md`

## Global Constraints

- UI 文言は日本語。既存のインラインスタイルと `data-testid` 命名（`plan-preset-*`）に合わせる。
- 新しい依存パッケージを追加しない。
- 入れ替え対象はプリセット制作のカードのみ。曜日ごと・当日上書き・今日だけ上書きの行は変更しない。
- `src/スケジュール管理アプリ/` 配下の複製には触れない。
- 完了時に `npm run build` が成功すること。
- コミットは変更した対象ファイルのみ。完了後 `main` へプッシュする。

## Review Focus

- 開始・終了が未入力の空行が混ざっていても、入れ替えでクラッシュせず他の行の値も壊れない。
- 保存前の未保存編集（本・汽車を含む）が、入れ替え後も同じ行に付いて移動する。
- 先頭の「↑」と末尾の「↓」は無効で、押しても並びが変わらない。
- 入れ替えた順序がそのままプリセットに保存される。

---

### Task 1: プリセット時間帯カードの上下入れ替え

**Files:**
- Modify: `src/screens/PlanScreen.tsx`（`updatePresetRow` の近く、プリセットカードの JSX）
- Test: `src/screens/PlanScreen.test.tsx`（プリセット関連テストの末尾）

**Interfaces:**
- Consumes: `presetRows: SlotRow[]`、`setPresetRows`、`savePreset`、`loadOverridePresets`
- Produces: `movePresetRow(i: number, dir: -1 | 1): void`、`data-testid="plan-preset-up-${i}"` / `plan-preset-down-${i}`

- [x] **Step 1: Write the failing tests**

`src/screens/PlanScreen.test.tsx` のプリセット削除テスト群の後に追加する。

```tsx
  it('プリセットの時間帯を下へ入れ替えると中身ごと移動する', async () => {
    render(<PlanScreen onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('availability-toggle'))
    fireEvent.click(await screen.findByTestId('slot-preset-toggle'))
    fireEvent.click(screen.getByTestId('plan-preset-row-add'))
    fireEvent.change(screen.getByTestId('plan-preset-start-0'), { target: { value: '06:30' } })
    fireEvent.change(screen.getByTestId('plan-preset-end-0'), { target: { value: '07:00' } })
    fireEvent.click(screen.getByTestId('plan-preset-train-0'))
    fireEvent.change(screen.getByTestId('plan-preset-start-1'), { target: { value: '15:30' } })
    fireEvent.change(screen.getByTestId('plan-preset-end-1'), { target: { value: '18:00' } })

    fireEvent.click(screen.getByTestId('plan-preset-down-0'))

    expect(screen.getByTestId('plan-preset-start-0')).toHaveValue('15:30')
    expect(screen.getByTestId('plan-preset-end-0')).toHaveValue('18:00')
    expect(screen.getByTestId('plan-preset-train-0')).not.toBeChecked()
    expect(screen.getByTestId('plan-preset-start-1')).toHaveValue('06:30')
    expect(screen.getByTestId('plan-preset-end-1')).toHaveValue('07:00')
    expect(screen.getByTestId('plan-preset-train-1')).toBeChecked()

    // 空行が混ざっていても、空行だけが移動して他の行の値は壊れない。
    fireEvent.click(screen.getByTestId('plan-preset-row-add'))
    fireEvent.click(screen.getByTestId('plan-preset-up-2'))
    expect(screen.getByTestId('plan-preset-start-1')).toHaveValue('')
    expect(screen.getByTestId('plan-preset-start-2')).toHaveValue('06:30')
  })

  it('プリセットの先頭は上へ、末尾は下へ移動できない', async () => {
    render(<PlanScreen onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('availability-toggle'))
    fireEvent.click(await screen.findByTestId('slot-preset-toggle'))
    expect(screen.getByTestId('plan-preset-up-0')).toBeDisabled()
    expect(screen.getByTestId('plan-preset-down-0')).toBeDisabled()
    fireEvent.click(screen.getByTestId('plan-preset-row-add'))
    expect(screen.getByTestId('plan-preset-up-0')).toBeDisabled()
    expect(screen.getByTestId('plan-preset-down-0')).not.toBeDisabled()
    expect(screen.getByTestId('plan-preset-up-1')).not.toBeDisabled()
    expect(screen.getByTestId('plan-preset-down-1')).toBeDisabled()
  })

  it('プリセットは入れ替えた順で保存される', async () => {
    render(<PlanScreen onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('availability-toggle'))
    fireEvent.click(await screen.findByTestId('slot-preset-toggle'))
    fireEvent.change(screen.getByTestId('plan-preset-name'), { target: { value: '夜勉' } })
    fireEvent.click(screen.getByTestId('plan-preset-row-add'))
    fireEvent.change(screen.getByTestId('plan-preset-start-0'), { target: { value: '06:30' } })
    fireEvent.change(screen.getByTestId('plan-preset-end-0'), { target: { value: '07:00' } })
    fireEvent.change(screen.getByTestId('plan-preset-start-1'), { target: { value: '15:30' } })
    fireEvent.change(screen.getByTestId('plan-preset-end-1'), { target: { value: '18:00' } })

    fireEvent.click(screen.getByTestId('plan-preset-down-0'))
    fireEvent.click(screen.getByTestId('plan-preset-save'))

    await waitFor(() => expect(loadOverridePresets()).toHaveLength(1))
    expect(loadOverridePresets()[0].rows.map((r) => r.start)).toEqual(['15:30', '06:30'])
  })
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/screens/PlanScreen.test.tsx -t プリセット`
Expected: FAIL。`plan-preset-down-0` などが存在しない。

- [x] **Step 3: Implement `movePresetRow` and the buttons**

`updatePresetRow` の直後に追加する。

```tsx
  const movePresetRow = (i: number, dir: -1 | 1) =>
    setPresetRows((rows) => {
      const j = i + dir
      if (j < 0 || j >= rows.length) return rows
      const next = [...rows]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
```

プリセットカードの2行目（`plan-preset-book-${i}` と汽車チェックを含む `div`）の末尾に追加する。

```tsx
                  <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                    <button
                      data-testid={`plan-preset-up-${i}`}
                      type="button"
                      aria-label={`${i + 1}番目の時間帯を上へ`}
                      disabled={i === 0}
                      onClick={() => movePresetRow(i, -1)}
                    >
                      ↑
                    </button>
                    <button
                      data-testid={`plan-preset-down-${i}`}
                      type="button"
                      aria-label={`${i + 1}番目の時間帯を下へ`}
                      disabled={i === presetRows.length - 1}
                      onClick={() => movePresetRow(i, 1)}
                    >
                      ↓
                    </button>
                  </div>
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/screens/PlanScreen.test.tsx`
Expected: PASS（既存テスト含む）。

- [x] **Step 5: Verify build**

Run: `npm run build`
Expected: 成功。

- [x] **Step 6: Commit**

```bash
git add src/screens/PlanScreen.tsx src/screens/PlanScreen.test.tsx
git commit -m "feat(plan): reorder preset time slots with up/down buttons"
```
