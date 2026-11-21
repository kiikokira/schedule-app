# テスト後片付け Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the last non-blocking issues from the train-start feature review: the date-dependent RankingScreen assertion, brittle train-start test targeting, a negative-only date-change test, an untested manual-save path, and the React `act(...)` warning.

**Architecture:** Test-only changes. No production behavior changes. Each task is independently reviewable and committed on its own.

**Tech Stack:** React 18 + TypeScript + Vitest + @testing-library/react + Dexie/fake-indexeddb.

**Spec:** N/A. This is test hygiene only. The behavior authority for the train-start flows is `docs/superpowers/specs/2026-11-20-train-start-design.md`; the implementation was merged at `24eedbf`.

## Global Constraints

- Change only `src/screens/RankingScreen.test.tsx` and `src/screens/TodayPlanScreen.trainStart.test.tsx`. Do not edit production code, `src/lib`, `src/data`, or the plan doc after its commit.
- Preserve every existing assertion and test name unless this plan says to replace it.
- No behavior changes: all new tests must pass against the current production code.
- Commit only the files this plan names. Never include unrelated working-tree changes.
- Run the focused suite after each task; run the full suite once in Task 2; run `npm run build` once in Task 2.
- Commit messages are fixed in the steps below.

## Review Focus

- Date independence: `RankingScreen` rivals are sampled from the full university master with a date seed; no assertion may depend on today's date.
- Async hygiene: a train-start test must wait for the initial availability load before interacting, or mount-effect state updates fire outside `act`.
- Row targeting: tests must locate rows by their displayed `plan-row-hours`, never by array position or an unguarded `find`.
- Cross-day state: changing `today` must load the new day's train-start backup while preserving the previous day's marker.
- Both manual-save paths: the notice must clear for `saveTodayOverrides` (pick-and-fix) as well as `saveDayRows` (override panel).

---

### Task 1: Make the RankingScreen rival-university assertion date-independent

**Files:**
- Modify: `src/screens/RankingScreen.test.tsx:1-6, :32-48`
- Test: `src/screens/RankingScreen.test.tsx` (same file)

**Interfaces:**
- Consumes: `ALL_UNIVERSITIES` from `src/data/universities.ts` (already exported).
- Produces: nothing used by other tasks.

Root cause: `sampleNearBoard` (`src/lib/ranking.ts:189-191`) picks rival universities from `LOCAL_UNIVERSITIES` with a date-derived seed. The test hardcodes a 15-name whitelist, so on 2026-11-22 the sampled names (愛媛, 島根, 長崎, 茨城, 龍谷) all fall outside it. The fix asserts membership in the real master instead.

- [ ] **Step 1: Confirm the test currently fails today (RED)**

Run: `npm test -- --run src/screens/RankingScreen.test.tsx -t "ライバル行に順位と志望大学を表示する"`
Expected: 1 failed with received universities such as `愛媛,島根,長崎,茨城,龍谷`.

- [ ] **Step 2: Import the master**

Add to the imports at the top of `src/screens/RankingScreen.test.tsx`:

```ts
import { ALL_UNIVERSITIES } from '../data/universities'
```

- [ ] **Step 3: Replace the hardcoded university whitelist**

Replace lines 40-47 (the `univTexts` block) with:

```ts
    const univTexts = rows
      .map((r) => within(r).queryByTestId('rival-univ')?.textContent ?? '')
      .filter((text) => text.length > 0)
    expect(univTexts.length).toBeGreaterThan(0)
    for (const name of univTexts) {
      expect(ALL_UNIVERSITIES).toContain(name)
    }
    expect(univTexts.join()).not.toMatch(/都|道|府|県/)
```

Keep the two rank assertions above it unchanged.

- [ ] **Step 4: Run the test to verify GREEN**

Run: `npm test -- --run src/screens/RankingScreen.test.tsx`
Expected: all 48 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/screens/RankingScreen.test.tsx
git commit -m "test: make rival university assertion date independent"
```

---

### Task 2: Harden the train-start tests and cover both save paths

**Files:**
- Modify: `src/screens/TodayPlanScreen.trainStart.test.tsx`
- Test: `src/screens/TodayPlanScreen.trainStart.test.tsx` (same file)

**Interfaces:**
- Consumes: existing helpers `addBook`, `saveTrainSlot`, `setNow`, `TODAY`, and the test IDs `plan-row-hours`, `slot-missed-b1`, `save-today-override`, `train-start-reset`, `train-start-notice`.
- Produces: local helpers `rowByHours` and `addSecondBook`, used only in this file.

- [ ] **Step 1: Add the second-book helper**

After `addBook`, add:

```ts
const addSecondBook = async () => {
  const now = new Date().toISOString()
  await db.books.add({
    id: 'b2',
    title: '数学問題集',
    subject: '数学',
    totalPages: 100,
    startDate: '2026-11-01',
    deadline: '2026-12-31',
    createdAt: now,
    updatedAt: now,
  } as never)
}
```

- [ ] **Step 2: Add a row locator helper**

After `saveTrainSlot`, add:

```ts
// 行は表示中の時間帯で特定する（配列順や未割当の出現順に依存しない）。
const rowByHours = (hours: string): HTMLElement => {
  const rows = screen
    .getAllByTestId(/plan-row-\d+/)
    .filter((r) => within(r).getByTestId('plan-row-hours').textContent === hours)
  expect(rows).toHaveLength(1)
  return rows[0]
}
```

- [ ] **Step 3: Remove the `act(...)` warning in the independence test**

In `'keeps the override message and the train start notice independent'`, after `render(...)` and before the first `fireEvent`, add:

```ts
    await screen.findByTestId('today-table')
```

This waits for the initial availability load; the remaining mount effects settle while Testing Library's `findBy` act scope is active.

- [ ] **Step 4: Replace positional targeting in `'keys each train slot skip by its own origin range'`**

Replace the `for (let i = 0; i < 2; i++) { ... }` block with:

```ts
    for (const hours of ['09:00-10:00', '17:45-19:11']) {
      fireEvent.change(within(rowByHours(hours)).getByRole('combobox'), {
        target: { value: 'b1' },
      })
    }
```

Then replace:

```ts
    const misses = screen.getAllByTestId('slot-missed-b1')
    expect(misses).toHaveLength(2)
    fireEvent.click(misses[1])
```

with:

```ts
    expect(screen.getAllByTestId('slot-missed-b1')).toHaveLength(2)
    fireEvent.click(within(rowByHours('17:45-19:11')).getByTestId('slot-missed-b1'))
```

After the first record is confirmed, replace:

```ts
    fireEvent.click(screen.getByTestId('slot-missed-b1'))
```

with:

```ts
    fireEvent.click(within(rowByHours('09:00-10:00')).getByTestId('slot-missed-b1'))
```

Keep the surrounding `waitFor` blocks unchanged.

- [ ] **Step 5: Replace the unguarded find in the gap-sub-row test**

In `'uses the origin key for a gap sub-row of a clipped train slot'`, replace the `rows.find(...)` block with:

```ts
    fireEvent.change(within(rowByHours('18:30-18:45')).getByRole('combobox'), {
      target: { value: 'b1' },
    })
```

Replace the following `waitFor` contents with:

```ts
    await waitFor(() => {
      expect(rowByHours('18:30-18:45')).toHaveTextContent('英文法書')
    })
```

Then replace the skip click with:

```ts
    fireEvent.click(within(rowByHours('18:30-18:45')).getByTestId('slot-missed-b1'))
```

The origin-key and `autoForfeitPastSlots` assertions stay unchanged.

- [ ] **Step 6: Make the date-change test prove the new day's backup is loaded and restorable**

Rewrite `'clears the notice and yesterday reset button when the date changes'` as:

```ts
  it('clears the notice and loads the new day backup when the date changes', async () => {
    setNow(18, 30)
    await addBook()
    await saveTrainSlot()
    const { rerender } = render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today={TODAY} />)
    fireEvent.click(await screen.findByTestId('train-start'))
    expect(await screen.findByTestId('train-start-notice')).toBeInTheDocument()
    expect(await screen.findByTestId('train-start-reset')).toBeInTheDocument()
    expect(localStorage.getItem(`schedule-app-train-start:${TODAY}`)).not.toBeNull()

    const TOMORROW = '2026-11-22'
    localStorage.setItem(
      `schedule-app-train-start:${TOMORROW}`,
      JSON.stringify({
        backup: [
          {
            id: 'tomorrow-train',
            weekday: null,
            date: TOMORROW,
            start: '10:00',
            end: '11:00',
            bookId: 'b1',
          },
        ],
      }),
    )

    rerender(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today={TOMORROW} />)
    await waitFor(() => {
      expect(screen.queryByTestId('train-start-notice')).not.toBeInTheDocument()
    })
    // 前日のマーカーは消さない
    expect(localStorage.getItem(`schedule-app-train-start:${TODAY}`)).not.toBeNull()

    // 新しい日のバックアップが読み込まれ、押すとその日だけ復元される
    fireEvent.click(await screen.findByTestId('train-start-reset'))
    await screen.findByText('曜日設定に戻しました')
    await waitFor(async () => {
      const restored = (await listAvailability()).filter((a) => a.date === TOMORROW)
      expect(restored).toHaveLength(1)
      expect(restored[0]).toMatchObject({ start: '10:00', end: '11:00', bookId: 'b1' })
    })
    expect(localStorage.getItem(`schedule-app-train-start:${TOMORROW}`)).toBeNull()
  })
```

- [ ] **Step 7: Add coverage for the pick-and-fix save path**

Add this test after the existing `'drops the reset marker when a manual today override is saved'` test:

```ts
  it('clears the notice when a manual pick is saved for today', async () => {
    setNow(18, 30)
    await addBook()
    await addSecondBook()
    await saveTrainSlot()
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today={TODAY} />)
    await screen.findByTestId('today-table')

    fireEvent.click(await screen.findByTestId('train-start'))
    expect(await screen.findByTestId('train-start-notice')).toBeInTheDocument()
    expect(await screen.findByTestId('train-start-reset')).toBeInTheDocument()

    // 2冊目があると枠が15分単位で分かれるため、時間帯ではなく先頭行の現在値から
    // 必ず別の本を選ぶ（行の分割位置に依存しない）。
    const firstSelect = within(screen.getAllByTestId(/plan-row-\d+/)[0]).getByRole('combobox') as HTMLSelectElement
    fireEvent.change(firstSelect, { target: { value: firstSelect.value === 'b1' ? 'b2' : 'b1' } })
    fireEvent.click(await screen.findByTestId('save-today-override'))

    await waitFor(() => {
      expect(screen.queryByTestId('train-start-notice')).not.toBeInTheDocument()
    })
    expect(screen.queryByTestId('train-start-reset')).not.toBeInTheDocument()
    expect(localStorage.getItem(`schedule-app-train-start:${TODAY}`)).toBeNull()
  })
```

- [ ] **Step 8: Run the focused suite**

Run: `npm test -- --run src/screens/TodayPlanScreen.trainStart.test.tsx`
Expected: 17 tests pass and no `Warning: An update ... not wrapped in act(...)` lines in stderr.

- [ ] **Step 9: Run the full suite once**

Run: `npm test -- --run`
Expected: all tests pass (previous full-suite count was 1426; Task 2 adds one test and Task 1 changes none, so 1427).

- [ ] **Step 10: Run the build once**

Run: `npm run build`
Expected: success (the existing chunk-size warning is fine).

- [ ] **Step 11: Commit**

```bash
git add src/screens/TodayPlanScreen.trainStart.test.tsx
git commit -m "test: harden train start coverage and clear act warnings"
```
