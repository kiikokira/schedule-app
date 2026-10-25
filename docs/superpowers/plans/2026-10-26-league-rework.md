# リーグ制度改修 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 写真のリーグ仕様（10試合ラウンド制・勝ち点・Div3以上レーティング・画像バッジ6種・自分の情報のみ表示）に入れ替える。

**Architecture:** ルール系は `seasonLeague.ts`（ラウンド・順位・母集団）と新 `leagueRating.ts`（レーティング）に純粋関数として集約し、進行状態（最高Div・レーティング・ラウンドタリー・フェーズ最良Div）は `seasonStore.ts` に永続化する。画面は `RankingScreen.tsx` のリーグタブを差し替え、バッジは画像参照に置換する。

**Tech Stack:** React 18 + TypeScript + vitest + Testing Library + Dexie (IndexedDB) + localStorage (season/badge stores)。

**Spec:** docs/superpowers/specs/2026-10-26-league-rework-design.md（§1〜§7。写真の数値・§6§7の合意改訂を含む）

## Global Constraints

- 1試合＝記録のある1日1節。ラウンド＝連続10試合。勝ち点は勝ち3／引分1／負け0。
- 昇格ライン Div10:3／Div9:6／Div8:9／Div7:12／Div6:15／Div5:18／Div4:22（→Div3）。残留ライン Div8:6／Div7:9／Div5:15／Div4:19。Div10・9・6に残留ラインなし。
- Div3到達時レーティング1200スタート。Div2＝1500以上。Div1＝1800以上。下限0。レート差±100以内が同等。
- レート変動幅：格上{勝+20〜+30／負−15〜−5／分0〜+5}、同等{勝+10〜+20／負−20〜−10／分0}、格下{勝+5〜+10／負−25〜−15／分−5〜0}。決定的乱数（シード＝日付）。
- フェーズ開始Div：最高1→3、2→4、3→5、4→6、5→7、6→8、最高7以下→10。
- スキップボタンは昇格確定時・Div10〜4のみ。残留・降格の確定は表示のみ。
- バッジ画像 6件は `public/badges/badge-div3.jpg`・`badge-div2.jpg`・`badge-div1.jpg`・`badge-top1000.jpg`・`badge-top100.jpg`・`badge-top10.jpg` をそのまま `<img>` 参照し、独自描画しない。
- バッジはそのフェーズの最高グレード1個のみ・1試合以上必須。最終順位＝フェーズ終了時のリーグ順位。グレード順序 top10 > top100 > top1000 > div1 > div2 > div3。
- リーグpt換算率 `LEAGUE_PT_RATE = 0.2`（自分・ライバル共通）は不変。順位・勝敗・前日比の正負は変えない。
- テストは `cmd /c npx.cmd vitest run <file> --reporter=basic`。型は `cmd /c npx.cmd tsc -b --pretty false`。TDD厳守（先に失敗テスト）。
- `noUnusedLocals`・`noUnusedParameters` が有効のため、不要になった import・変数は必ず削除する。

---

## File Structure

- 変更なし：`src/lib/ranking.ts`。
- 既存拡張：`src/lib/leagueBadges.ts`（Task 1）、`src/lib/seasonLeague.ts`（Task 2・4）、`src/lib/leagueRating.ts`（Task 3 で新規。`seasonRivals.ts` から `hashSeed`・`mulberry32` を import）、`src/data/seasonStore.ts` + `seasonStore.test.ts` + `src/screens/HomeScreen.tsx`（Task 5）、`src/screens/RankingScreen.tsx` + `RankingScreen.test.tsx`（Task 6・7）。
- 削除：`src/components/LeagueBadge.tsx`、`src/components/LeagueBadge.test.tsx`（Task 1）。
- 新規：`src/lib/leagueRating.ts`、`src/lib/leagueRating.test.ts`（Task 3）。

---

### Task 1: バッジ6種（画像参照・最高グレードのみ・1試合条件）

**Files:**
- Modify: `src/lib/leagueBadges.ts`（定義・付与ロジック書換。`MAX_EQUIPPED_BADGES = 3`・`loadLeagueBadges`・`saveLeagueBadges`・`toggleBadgeEquipped`・`seasonLabel` の枠組み維持）
- Modify: `src/components/LeagueBadgeShelf.tsx`（`<img>` 参照化・文言更新）
- Delete: `src/components/LeagueBadge.tsx`、`src/components/LeagueBadge.test.tsx`
- Test: `src/lib/leagueBadges.test.ts`（全面書換）

**Interfaces:**
- Consumes: なし（独立）。
- Produces: `LEAGUE_BADGE_DEFS`（6件・画像パス付き）・`awardPhaseBadge(seasonId, {bestDiv, finalRank, played}): string[]`・新 uid 形式 `${seasonId}:${badgeId}`（Task 5 のロールオーバーが使用）。

新 uid 形式は `${seasonId}:${badgeId}`（例：`2026-09-01:top100`）。旧 `div1/2/3` uid とは互換性なし（移行なし・旧データは `loadLeagueBadges` の filter で自然に除外される。グレード順序：`top10 > top100 > top1000 > div1 > div2 > div3`）。

- [ ] **Step 1: Write the failing test**（`src/lib/leagueBadges.test.ts` を全面置換）

```ts
import { describe, expect, it, beforeEach } from 'vitest'
import { LEAGUE_BADGE_DEFS, awardPhaseBadge, loadLeagueBadges } from './leagueBadges'

describe('leagueBadges', () => {
  beforeEach(() => localStorage.clear())
  it('6種の定義があり画像パスを持つ', () => {
    expect(Object.keys(LEAGUE_BADGE_DEFS)).toEqual(['div3', 'div2', 'div1', 'top1000', 'top100', 'top10'])
    for (const def of Object.values(LEAGUE_BADGE_DEFS)) {
      expect(def.img).toMatch(/^(\.\/)?badges\/badge-.+\.jpg$/)
      expect(def.name.length).toBeGreaterThan(0)
    }
  })
  it('最高到達Div3でdiv3を1個だけ付与する', () => {
    const got = awardPhaseBadge('2026-09-01', { bestDiv: 3, finalRank: 500000, played: 5 })
    expect(got).toHaveLength(1)
    expect(loadLeagueBadges().awards.map((a) => a.badgeId)).toEqual(['div3'])
  })
  it('複数条件を満たしても最高グレード1個のみ', () => {
    const got = awardPhaseBadge('2026-09-01', { bestDiv: 1, finalRank: 5, played: 10 })
    expect(got).toHaveLength(1)
    expect(loadLeagueBadges().awards[0].badgeId).toBe('top10')
  })
  it('1試合未満では付与しない', () => {
    expect(awardPhaseBadge('2026-09-01', { bestDiv: 1, finalRank: 1, played: 0 })).toEqual([])
    expect(loadLeagueBadges().awards).toEqual([])
  })
  it('最終順位Top1000でtop1000を付与する', () => {
    const got = awardPhaseBadge('2026-09-01', { bestDiv: 9, finalRank: 1000, played: 3 })
    expect(got).toEqual(['2026-09-01:top1000'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c npx.cmd vitest run src/lib/leagueBadges.test.ts --reporter=basic`
Expected: FAIL（`LEAGUE_BADGE_DEFS` のキー不一致・`awardPhaseBadge` 未定義）

- [ ] **Step 3: Write minimal implementation**

`src/lib/leagueBadges.ts` を以下方針で書き換える（`loadLeagueBadges`・`saveLeagueBadges`・`toggleBadgeEquipped`・`seasonLabel`・`MAX_EQUIPPED_BADGES` の枠組みは維持し、uid 検証だけ新形式に合わせる。旧 `div1/2/3` 型・旧判定・旧 CSS 用 `from/to/rim` は削除する）：

```ts
export type LeagueBadgeId = 'div3' | 'div2' | 'div1' | 'top1000' | 'top100' | 'top10'
export type LeagueBadgeAward = { uid: string; badgeId: LeagueBadgeId; seasonId: string; awardedAt: string }
const GRADE_ORDER: LeagueBadgeId[] = ['div3', 'div2', 'div1', 'top1000', 'top100', 'top10']
export const LEAGUE_BADGE_DEFS: Record<LeagueBadgeId, { badgeId: LeagueBadgeId; name: string; img: string }> = {
  div3: { badgeId: 'div3', name: 'Division 3に到達する', img: './badges/badge-div3.jpg' },
  div2: { badgeId: 'div2', name: 'Division 2に到達する', img: './badges/badge-div2.jpg' },
  div1: { badgeId: 'div1', name: 'Division 1に到達する', img: './badges/badge-div1.jpg' },
  top1000: { badgeId: 'top1000', name: '最終順位 Top 1,000に入賞する', img: './badges/badge-top1000.jpg' },
  top100: { badgeId: 'top100', name: '最終順位 Top 100に入賞する', img: './badges/badge-top100.jpg' },
  top10: { badgeId: 'top10', name: '最終順位 Top 10に入賞する', img: './badges/badge-top10.jpg' },
}
export function awardPhaseBadge(seasonId: string, info: { bestDiv: number; finalRank: number; played: number }): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(seasonId)) return []
  if (!Number.isInteger(info.played) || info.played < 1) return []
  const earned: LeagueBadgeId[] = []
  if (info.bestDiv <= 3) earned.push('div3')
  if (info.bestDiv <= 2) earned.push('div2')
  if (info.bestDiv <= 1) earned.push('div1')
  if (info.finalRank <= 1000) earned.push('top1000')
  if (info.finalRank <= 100) earned.push('top100')
  if (info.finalRank <= 10) earned.push('top10')
  if (earned.length === 0) return []
  const top = earned[earned.length - 1]
  const uid = `${seasonId}:${top}`
  const s = loadLeagueBadges()
  if (s.awards.some((a) => a.uid === uid)) return []
  s.awards.push({ uid, badgeId: top, seasonId, awardedAt: new Date().toISOString() })
  saveLeagueBadges(s)
  return [uid]
}
```

`LeagueBadgeShelf.tsx` は `LeagueBadge`（CSS描画）の使用をやめ、各バッジを `<img src={def.img} alt={def.name} width={56} height={56} data-testid={`league-badge-img-${a.badgeId}`} />` で描画し、見出し下の説明文を「今フェーズの最高グレードを1個獲得（1試合以上が条件）。最大3つまで表示」に変更する。`LeagueBadge.tsx` は削除し import を消す（`noUnusedLocals` 対応）。`MyPageScreen.tsx` の変更は不要（バッジ文言は棚側にある）。

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd /c npx.cmd vitest run src/lib/leagueBadges.test.ts src/screens/MyPageScreen.test.tsx --reporter=basic`
Expected: PASS。ただし `MyPageScreen.test.tsx` の棚テスト3件（「リーグバッジ棚に装着と一覧が出る」「リーグバッジ4つ目の装着はブロックされ警告が出る」「リーグバッジ未獲得時は案内が出る」）は新マークアップに合わせて期待値を更新する。置換ルールは機械的で以下通り：`getByTitle(/Div2到達/)` 系 → `getByAltText('Division 2に到達する')` 系（名称は `LEAGUE_BADGE_DEFS` の `name` と同一文字列）。空棚文言の `'Div3'` 含有検証 → 新文言「1試合以上が条件」を検証に変更。旧 uid 形式（`2026-09-01:div2` 等）の fixture は新形式でも有効（`div2` は有効な badgeId のため）なので uid 自体の書換は不要。`src/components/LeagueBadge.test.tsx` ファイルは削除する（`git rm` 相当：削除して commit に含める）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/leagueBadges.ts src/lib/leagueBadges.test.ts src/components/LeagueBadgeShelf.tsx src/screens/MyPageScreen.test.tsx
git rm src/components/LeagueBadge.tsx src/components/LeagueBadge.test.tsx
git commit -m "feat: photo badges with highest-grade award"
```

### Task 2: ラウンド判定の純粋関数（勝ち点・昇格・残留・確定）

**Files:**
- Modify: `src/lib/seasonLeague.ts`（末尾に追記）
- Test: `src/lib/seasonLeague.test.ts`（末尾に追記）

**Interfaces:**
- Consumes: `LeagueDayResult`（同ファイル既存）。
- Produces: `ROUND_SIZE`・`ROUND_WIN_POINTS`・`PROMOTION_LINES`・`STAY_LINES`・`RoundOutcome`・`roundPoints`・`tallyToResults`・`decideRoundOutcome`（Task 5 が使用）。

- [ ] **Step 1: Write the failing test**（`src/lib/seasonLeague.test.ts` 末尾に追記。先頭の import 行に `, type LeagueDayResult` を追記する）

```ts
it('ラウンド勝ち点は勝ち3引分1負け0', async () => {
  const { roundPoints } = await import('./seasonLeague')
  expect(roundPoints(['win', 'win', 'draw', 'loss'])).toBe(7)
})
it('Div10は勝ち点3で即昇格確定', async () => {
  const { decideRoundOutcome } = await import('./seasonLeague')
  expect(decideRoundOutcome(10, ['win'])).toBe('promote')
})
it('Div8は残り試合の全勝敗パターンで覆らない時だけ確定する', async () => {
  const { decideRoundOutcome } = await import('./seasonLeague')
  expect(decideRoundOutcome(8, ['win', 'win', 'win'])).toBe('promote')
  expect(decideRoundOutcome(8, ['loss', 'loss', 'loss', 'loss', 'loss', 'loss', 'loss'])).toBe('undecided')
  const stay: LeagueDayResult[] = ['win', 'win', 'draw', 'loss', 'loss', 'loss', 'loss', 'loss', 'loss', 'loss']
  expect(decideRoundOutcome(8, [...stay])).toBe('stay')
})
it('Div4は22点で昇格・19点以下で残留判定', async () => {
  const { decideRoundOutcome } = await import('./seasonLeague')
  const wins7: Array<'win'> = ['win', 'win', 'win', 'win', 'win', 'win', 'win']
  expect(decideRoundOutcome(4, wins7)).toBe('undecided')
  expect(decideRoundOutcome(4, [...wins7, 'win'])).toBe('promote')
  const stay: LeagueDayResult[] = ['win', 'win', 'win', 'win', 'win', 'win', 'draw', 'loss', 'loss', 'loss']
  expect(decideRoundOutcome(4, [...stay])).toBe('stay')
  const drop: LeagueDayResult[] = ['win', 'win', 'win', 'draw', 'loss', 'loss', 'loss', 'loss', 'loss', 'loss']
  expect(decideRoundOutcome(4, [...drop])).toBe('relegate')
})
it('残留ラインのないDivは降格しない', async () => {
  const { decideRoundOutcome } = await import('./seasonLeague')
  expect(decideRoundOutcome(10, Array<LeagueDayResult>(10).fill('loss'))).toBe('stay')
  expect(decideRoundOutcome(9, Array<LeagueDayResult>(10).fill('loss'))).toBe('stay')
  expect(decideRoundOutcome(6, Array<LeagueDayResult>(10).fill('loss'))).toBe('stay')
})
it('タリーから結果配列に復元できる', async () => {
  const { tallyToResults } = await import('./seasonLeague')
  expect(tallyToResults({ w: 2, d: 1, l: 0 })).toEqual(['win', 'win', 'draw'])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c npx.cmd vitest run src/lib/seasonLeague.test.ts -t "ラウンド勝ち点" --reporter=verbose`
Expected: FAIL（`roundPoints` 未定義の import エラー）

- [ ] **Step 3: Write minimal implementation**（`src/lib/seasonLeague.ts` 末尾に追記）

```ts
export const ROUND_SIZE = 10
export const ROUND_WIN_POINTS = { win: 3, draw: 1, loss: 0 } as const
export const PROMOTION_LINES: Record<number, number> = { 10: 3, 9: 6, 8: 9, 7: 12, 6: 15, 5: 18, 4: 22 }
export const STAY_LINES: Partial<Record<number, number>> = { 8: 6, 7: 9, 5: 15, 4: 19 }
export type RoundOutcome = 'promote' | 'stay' | 'relegate' | 'undecided'
export function roundPoints(results: LeagueDayResult[]): number {
  return results.reduce((s, r) => s + ROUND_WIN_POINTS[r], 0)
}
export function tallyToResults(tally: { w: number; d: number; l: number }): LeagueDayResult[] {
  return [...Array(tally.w).fill('win'), ...Array(tally.d).fill('draw'), ...Array(tally.l).fill('loss')] as LeagueDayResult[]
}
export function decideRoundOutcome(div: number, results: LeagueDayResult[]): RoundOutcome {
  const promo = PROMOTION_LINES[div]
  if (promo === undefined) return 'undecided'
  const played = results.slice(0, ROUND_SIZE)
  const pts = roundPoints(played)
  const remaining = Math.max(0, ROUND_SIZE - played.length)
  const minFinal = pts
  const maxFinal = pts + 3 * remaining
  if (minFinal >= promo) return 'promote'
  const stay = STAY_LINES[div]
  if (stay === undefined) return played.length >= ROUND_SIZE || maxFinal < promo ? 'stay' : 'undecided'
  if (maxFinal < stay) return 'relegate'
  if (minFinal >= stay && maxFinal < promo) return 'stay'
  if (played.length >= ROUND_SIZE) return pts >= promo ? 'promote' : pts < stay ? 'relegate' : 'stay'
  return 'undecided'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd /c npx.cmd vitest run src/lib/seasonLeague.test.ts --reporter=basic`
Expected: PASS（全件）

- [ ] **Step 5: Commit**

```bash
git add src/lib/seasonLeague.ts src/lib/seasonLeague.test.ts
git commit -m "feat: round points and promotion lines"
```

### Task 3: レーティングエンジン（相手差・変動幅・相手レート）

**Files:**
- Modify: `src/lib/seasonRivals.ts`（`hashSeed` と `mulberry32` の `export` 化のみ。本文不変）
- Create: `src/lib/leagueRating.ts`
- Test: `src/lib/leagueRating.test.ts`

**Interfaces:**
- Consumes: `hashSeed`・`mulberry32`（seasonRivals から）、`LeagueDayResult`（seasonLeague から。一方向依存のみ）。
- Produces: `RATING_START`・`RATING_DIV2`・`RATING_DIV1`・`ratingBandForDiff`・`leagueRatingDelta`・`rivalRatingFor`（Task 5 が使用）。

- [ ] **Step 1: Write the failing test**（`src/lib/leagueRating.test.ts` を新規作成）

```ts
import { describe, expect, it } from 'vitest'
import { RATING_START, RATING_DIV2, RATING_DIV1, ratingBandForDiff, leagueRatingDelta, rivalRatingFor } from './leagueRating'

describe('leagueRating', () => {
  it('定数は開始1200・Div2は1500・Div1は1800', () => {
    expect(RATING_START).toBe(1200)
    expect(RATING_DIV2).toBe(1500)
    expect(RATING_DIV1).toBe(1800)
  })
  it('レート差±100以内が同等', () => {
    expect(ratingBandForDiff(0)).toBe('even')
    expect(ratingBandForDiff(99)).toBe('even')
    expect(ratingBandForDiff(-99)).toBe('even')
    expect(ratingBandForDiff(100)).toBe('above')
    expect(ratingBandForDiff(-100)).toBe('below')
  })
  it('変動幅は写真の表の範囲内で決定的', () => {
    for (const seed of ['2026-09-01', '2026-09-02', 's']) {
      expect(leagueRatingDelta('above', 'win', seed)).toBeGreaterThanOrEqual(20)
      expect(leagueRatingDelta('above', 'win', seed)).toBeLessThanOrEqual(30)
      expect(leagueRatingDelta('above', 'loss', seed)).toBeGreaterThanOrEqual(-15)
      expect(leagueRatingDelta('above', 'loss', seed)).toBeLessThanOrEqual(-5)
      const d = leagueRatingDelta('above', 'draw', seed)
      expect(d).toBeGreaterThanOrEqual(0)
      expect(d).toBeLessThanOrEqual(5)
      expect(leagueRatingDelta('even', 'win', seed)).toBeGreaterThanOrEqual(10)
      expect(leagueRatingDelta('even', 'win', seed)).toBeLessThanOrEqual(20)
      expect(leagueRatingDelta('even', 'loss', seed)).toBeGreaterThanOrEqual(-20)
      expect(leagueRatingDelta('even', 'loss', seed)).toBeLessThanOrEqual(-10)
      expect(leagueRatingDelta('even', 'draw', seed)).toBe(0)
      expect(leagueRatingDelta('below', 'win', seed)).toBeGreaterThanOrEqual(5)
      expect(leagueRatingDelta('below', 'win', seed)).toBeLessThanOrEqual(10)
      expect(leagueRatingDelta('below', 'loss', seed)).toBeGreaterThanOrEqual(-25)
      expect(leagueRatingDelta('below', 'loss', seed)).toBeLessThanOrEqual(-15)
      const dd = leagueRatingDelta('below', 'draw', seed)
      expect(dd).toBeGreaterThanOrEqual(-5)
      expect(dd).toBeLessThanOrEqual(0)
      expect(leagueRatingDelta('above', 'win', seed)).toBe(leagueRatingDelta('above', 'win', seed))
    }
  })
  it('相手レートは1000〜1400で決定的', () => {
    const a = rivalRatingFor('r10-0', 10)
    expect(a).toBeGreaterThanOrEqual(1000)
    expect(a).toBeLessThanOrEqual(1400)
    expect(rivalRatingFor('r10-0', 10)).toBe(a)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c npx.cmd vitest run src/lib/leagueRating.test.ts --reporter=basic`
Expected: FAIL（ファイル不存在の import エラー）

- [ ] **Step 3: Write minimal implementation**

`src/lib/seasonRivals.ts` の `hashSeed`・`mulberry32` 宣言に `export` を付ける（本文不変）。`src/lib/leagueRating.ts` を新規作成：

```ts
import { hashSeed, mulberry32 } from './seasonRivals'
import type { LeagueDayResult } from './seasonLeague'

export const RATING_START = 1200
export const RATING_DIV2 = 1500
export const RATING_DIV1 = 1800
export const RATING_FLOOR = 0

export type RatingBand = 'above' | 'even' | 'below'

export function ratingBandForDiff(diff: number): RatingBand {
  if (diff >= 100) return 'above'
  if (diff <= -100) return 'below'
  return 'even'
}

function intIn(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1))
}

export function leagueRatingDelta(band: RatingBand, result: LeagueDayResult, seed: string): number {
  const rand = mulberry32(hashSeed(`league-rating-${seed}`))
  if (band === 'above') {
    if (result === 'win') return intIn(rand, 20, 30)
    if (result === 'loss') return -intIn(rand, 5, 15)
    return intIn(rand, 0, 5)
  }
  if (band === 'below') {
    if (result === 'win') return intIn(rand, 5, 10)
    if (result === 'loss') return -intIn(rand, 15, 25)
    return -intIn(rand, 0, 5)
  }
  if (result === 'win') return intIn(rand, 10, 20)
  if (result === 'loss') return -intIn(rand, 10, 20)
  return 0
}

export function rivalRatingFor(rivalId: string, div: number): number {
  const rand = mulberry32(hashSeed(`rival-rating-${div}-${rivalId}`))
  return 1000 + Math.floor(rand() * 401)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd /c npx.cmd vitest run src/lib/leagueRating.test.ts src/lib/seasonRivals.test.ts --reporter=basic`
Expected: PASS（両ファイル）

- [ ] **Step 5: Commit**

```bash
git add src/lib/leagueRating.ts src/lib/leagueRating.test.ts src/lib/seasonRivals.ts
git commit -m "feat: rating engine with opponent bands"
```

### Task 4: リーグ順位（母集団変動＋対数正規マッピング）

**Files:**
- Modify: `src/lib/seasonLeague.ts`（末尾に追記。`hashSeed`・`mulberry32` の import を先頭に追加）
- Test: `src/lib/seasonLeague.test.ts`（末尾に追記）

**Interfaces:**
- Consumes: なし（新規純粋関数）。
- Produces: `leaguePopulationFor`・`leagueRankForPages`（Task 5・7 が使用）。

- [ ] **Step 1: Write the failing test**（末尾に追記）

```ts
it('リーグ母集団はフェーズごとに200万〜500万で同フェーズ内一定', async () => {
  const { leaguePopulationFor } = await import('./seasonLeague')
  const p = leaguePopulationFor('2026-09-01')
  expect(p).toBeGreaterThanOrEqual(2000000)
  expect(p).toBeLessThanOrEqual(5000000)
  expect(leaguePopulationFor('2026-09-01')).toBe(p)
  expect(leaguePopulationFor('2026-09-28')).toBe(p)
})
it('リーグ順位は累計ページが多いほど上位で母集団以内', async () => {
  const { leagueRankForPages, leaguePopulationFor } = await import('./seasonLeague')
  const pop = leaguePopulationFor('2026-09-01')
  const r600 = leagueRankForPages(600, pop)
  expect(r600).toBeGreaterThanOrEqual(1)
  expect(r600).toBeLessThanOrEqual(pop)
  expect(leagueRankForPages(6000, pop)).toBeLessThan(r600)
  expect(leagueRankForPages(0, pop)).toBe(pop)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c npx.cmd vitest run src/lib/seasonLeague.test.ts -t "リーグ母集団" --reporter=verbose`
Expected: FAIL（未定義 export の import エラー）

- [ ] **Step 3: Write minimal implementation**（末尾に追記。`hashSeed`・`mulberry32` の import を先頭の seasonRivals import 行に追加）

```ts
export function leaguePopulationFor(seasonId: string): number {
  let key = seasonId
  try {
    key = seasonIdForDate(seasonId)
  } catch {
    key = seasonId
  }
  const rand = mulberry32(hashSeed(`league-pop-${key}`))
  return 2000000 + Math.floor(rand() * 3000001)
}

function lognormalCdf(pages: number, median: number, sigma: number): number {
  if (pages <= 0) return 0
  const z = (Math.log(pages) - Math.log(median)) / sigma
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp((-z * z) / 2)
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  if (z > 0) p = 1 - p
  return Math.min(Math.max(p, 0), 1)
}

export function leagueRankForPages(pages: number, population: number): number {
  const pop = Math.max(1, Math.round(population))
  if (pages <= 0) return pop
  const rank = Math.round(pop * (1 - lognormalCdf(pages, 300, 0.9)))
  return Math.min(Math.max(rank, 1), pop)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd /c npx.cmd vitest run src/lib/seasonLeague.test.ts --reporter=basic`
Expected: PASS（全件）

- [ ] **Step 5: Commit**

```bash
git add src/lib/seasonLeague.ts src/lib/seasonLeague.test.ts
git commit -m "feat: league population and rank mapping"
```

### Task 5: シーズン進行の改修（最高Div・レーティング・ラウンドタリー・切替・付与）

**Files:**
- Modify: `src/data/seasonStore.ts`（状態拡張＋`startDivForHighest`＋`appendRoundMatches`＋`finalizeRoundEarly`＋`applyMatchRatings`＋`syncLeagueDay`＋ロールオーバー置換＋旧昇格経路削除）
- Modify: `src/data/seasonStore.test.ts`（旧5テスト置換＋新規追加。下記 Step 1 の3件のみにする）
- Modify: `src/screens/HomeScreen.tsx`（最終日昇格ブロック置換＋import 整理）

**Interfaces:**
- Consumes: Task 2（`decideRoundOutcome`・`tallyToResults`・`ROUND_SIZE`）、Task 3（`leagueRatingDelta`・`ratingBandForDiff`・`rivalRatingFor`・`RATING_START`）、Task 4（`leaguePopulationFor`・`leagueRankForPages`）、Task 1（`awardPhaseBadge`）、既存 `generateRivals`・`rivalPagesForDay`・`leagueDayInfo`・`seasonIdForDate`・`seasonDayIndex`。
- Produces: 拡張 `SeasonState`（`highestDiv`・`rating`・`ratedUpTo`・`round: {w,d,l,lastDate}`・`phaseBestDiv`）、`startDivForHighest`・`appendRoundMatches`・`finalizeRoundEarly`・`applyMatchRatings`・`syncLeagueDay`（Task 6 が `finalizeRoundEarly`・state 形状を使用）。

旧 `applyPromotionIfNeeded`・`resolvePendingDiv` は削除する（`decidePromotion` の export とそのテストは残す）。旧経路を参照する `seasonStore.test.ts` の 5 テスト（「シーズン切替でdivを引き継ぐ(初回のみDiv10)」「最終日に昇格し、繰り返し適用は冪等」「降格・クランプ(Div1昇格維持・Div10降格維持)」「シーズン切替で新Div2ならバッジ付与」「昇格適用でDiv2に入ったら当季バッジ付与、Div4は付与なし」）は削除し下記 Step 1 の 3 テストに置換する（他の既存テスト「初回はDiv10、記録でexp加算」「同日再記録は二重加算しない」「破損入力ガード」は変更せず残す。新規フィールドは `loadSeasonState` の正規化で既定値が入るため通る）。

- [ ] **Step 1: Write the failing test**（上記 5 テストを削除し以下 4 テストを追加）

```ts
it('開始Divは過去最高Divで決まる', async () => {
  const { startDivForHighest } = await import('./seasonStore')
  expect(startDivForHighest(1)).toBe(3)
  expect(startDivForHighest(2)).toBe(4)
  expect(startDivForHighest(3)).toBe(5)
  expect(startDivForHighest(4)).toBe(6)
  expect(startDivForHighest(5)).toBe(7)
  expect(startDivForHighest(6)).toBe(8)
  expect(startDivForHighest(7)).toBe(10)
  expect(startDivForHighest(10)).toBe(10)
})
it('10試合でラウンド確定しDiv4からDiv3へ昇格する', async () => {
  const { loadSeasonState, saveSeasonState, syncLeagueDay } = await import('./seasonStore')
  localStorage.clear()
  const s0 = loadSeasonState('2026-09-01')
  saveSeasonState({ ...s0, div: 4, highestDiv: 4, phaseBestDiv: 4, rating: 0, ratedUpTo: null, round: { w: 0, d: 0, l: 0, lastDate: null }, exp: 0, days: {} })
  const days: Record<string, number> = {}
  for (let d = 1; d <= 10; d++) days[`2026-09-${String(d).padStart(2, '0')}`] = 150
  const s1 = syncLeagueDay('2026-09-10', days, 4, '2026-09-01')
  expect(s1.div).toBe(3)
  expect(s1.highestDiv).toBe(3)
  expect(s1.phaseBestDiv).toBe(3)
  expect(s1.round.w + s1.round.d + s1.round.l).toBe(0)
  expect(s1.rating).toBe(1200)
})
it('昇格確定前にスキップすると即昇格し新ラウンドになる', async () => {
  const { loadSeasonState, saveSeasonState, syncLeagueDay, finalizeRoundEarly } = await import('./seasonStore')
  localStorage.clear()
  const s0 = loadSeasonState('2026-09-01')
  saveSeasonState({ ...s0, div: 10, highestDiv: 10, phaseBestDiv: 10, rating: 0, ratedUpTo: null, round: { w: 0, d: 0, l: 0, lastDate: null }, exp: 0, days: {} })
  const s1 = syncLeagueDay('2026-09-01', { '2026-09-01': 100 }, 10, '2026-09-01')
  expect(s1.div).toBe(10)
  expect(s1.round.w + s1.round.d + s1.round.l).toBe(1)
  const s2 = finalizeRoundEarly(s1, '2026-09-01')
  expect(s2.div).toBe(9)
})
it('シーズン切替で開始Divとバッジが決まる', async () => {
  const { loadSeasonState, saveSeasonState } = await import('./seasonStore')
  const { loadLeagueBadges } = await import('../lib/leagueBadges')
  localStorage.clear()
  const s0 = loadSeasonState('2026-09-01')
  saveSeasonState({ ...s0, div: 2, highestDiv: 1, phaseBestDiv: 1, rating: 1300, ratedUpTo: '2026-09-28', round: { w: 0, d: 0, l: 0, lastDate: null }, exp: 0, days: { '2026-09-01': 10 } })
  const s1 = loadSeasonState('2026-09-29')
  expect(s1.div).toBe(3)
  expect(s1.highestDiv).toBe(1)
  expect(loadLeagueBadges().awards.map((a) => a.badgeId)).toEqual(['div1'])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c npx.cmd vitest run src/data/seasonStore.test.ts -t "開始Divは過去最高Divで決まる" --reporter=verbose`
Expected: FAIL（未定義 export の import エラー）

- [ ] **Step 3: Write minimal implementation**

`src/data/seasonStore.ts` の変更点。まず先頭の import 4行を以下に置換する（旧 `decidePromotion`・`isSeasonFinalDay`・`ensureLeagueBadgeForSeason` の import は削除。`pagesToExp` は `recordSeasonDay` が使うため残す）：

```ts
import { seasonIdForDate, seasonDayIndex, tallyToResults, decideRoundOutcome, leagueRankForPages, leaguePopulationFor, leagueDayInfo, ROUND_SIZE, type LeagueDayResult } from '../lib/seasonLeague'
import { generateRivals, rivalPagesForDay } from '../lib/seasonRivals'
import { pagesToExp } from '../lib/seasonExp'
import { leagueRatingDelta, ratingBandForDiff, rivalRatingFor, RATING_START } from '../lib/leagueRating'
import { awardPhaseBadge } from '../lib/leagueBadges'
```

`SeasonState` 型に `highestDiv: number; rating: number; ratedUpTo: string | null; round: RoundTally; phaseBestDiv: number` を追加し、以下も追加する：

```ts
export type RoundTally = { w: number; d: number; l: number; lastDate: string | null }

function normalizeHighestDiv(v: unknown, fallbackDiv: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.min(10, Math.max(1, Math.round(v)))
  return fallbackDiv
}
function normalizeRating(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0
}
function normalizeRatedUpTo(v: unknown): string | null {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}
function normalizeRound(v: unknown): RoundTally {
  if (v == null || typeof v !== 'object') return { w: 0, d: 0, l: 0, lastDate: null }
  const o = v as Record<string, unknown>
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0)
  const lastDate = normalizeRatedUpTo(o['lastDate'])
  return { w: num(o['w']), d: num(o['d']), l: num(o['l']), lastDate }
}
```

`loadSeasonState` の復元パスでは：`highestDiv`・`phaseBestDiv` は `normalizeHighestDiv(raw値, div)`（既存セーブに無い場合は読込中の `div`）、`rating` は `normalizeRating`、`ratedUpTo` は `normalizeRatedUpTo`、`round` は `normalizeRound` を通す。`saveSeasonState` は型変更のみでロジic変更なし。

```ts
export function startDivForHighest(h: number): number {
  if (!Number.isFinite(h)) return 10
  if (h <= 1) return 3
  if (h === 2) return 4
  if (h === 3) return 5
  if (h === 4) return 6
  if (h === 5) return 7
  if (h === 6) return 8
  return 10
}

function roundPlayed(t: RoundTally): number {
  return t.w + t.d + t.l
}

function resultOfDay(seasonId: string, div: number, dayIndex: number, myPages: number): LeagueDayResult {
  try {
    return leagueDayInfo(seasonId, div, dayIndex, myPages).result
  } catch {
    return 'draw'
  }
}

function oppRatingOf(seasonId: string, div: number, dayIndex: number, myPages: number): number {
  try {
    const rivals = generateRivals(seasonId, div)
    const pages = rivals.map((r) => ({ name: r.name, pages: rivalPagesForDay(r, dayIndex) }))
    let best = pages[0]
    for (const p of pages) {
      if (Math.abs(p.pages - myPages) < Math.abs(best.pages - myPages)) best = p
    }
    const hit = rivals.find((r) => r.name === best.name) ?? rivals[0]
    return rivalRatingFor(hit.id, div)
  } catch {
    return RATING_START
  }
}

export function appendRoundMatches(s: SeasonState, div: number, matches: { date: string; result: LeagueDayResult }[]): SeasonState {
  const t = { ...s.round }
  const ordered = [...matches]
    .filter((m) => typeof m.date === 'string' && (t.lastDate == null || m.date > t.lastDate))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
  let next: SeasonState = { ...s, round: t }
  for (const m of ordered) {
    const nt = { ...next.round }
    if (m.result === 'win') nt.w += 1
    else if (m.result === 'draw') nt.d += 1
    else nt.l += 1
    nt.lastDate = m.date
    next = { ...next, round: nt }
    if (roundPlayed(nt) >= ROUND_SIZE) {
      next = applyRoundOutcome(next, div)
    }
  }
  return next
}

function applyRoundOutcome(s: SeasonState, div: number): SeasonState {
  const outcome = decideRoundOutcome(div, tallyToResults(s.round))
  let nextDiv = div
  if (outcome === 'promote') nextDiv = Math.max(1, div - 1)
  else if (outcome === 'relegate') nextDiv = Math.min(10, div + 1)
  const highestDiv = Math.min(s.highestDiv, nextDiv)
  const phaseBestDiv = Math.min(s.phaseBestDiv, nextDiv)
  const rating = nextDiv <= 3 && div > 3 ? RATING_START : s.rating
  return { ...s, div: nextDiv, highestDiv, phaseBestDiv, rating, round: { w: 0, d: 0, l: 0, lastDate: s.round.lastDate } }
}

export function finalizeRoundEarly(s: SeasonState, today: string): SeasonState {
  if (s.div < 4 || s.div > 10) return s
  if (roundPlayed(s.round) >= ROUND_SIZE) return s
  if (decideRoundOutcome(s.div, tallyToResults(s.round)) !== 'promote') return s
  const lastDate = typeof today === 'string' && today.length === 10 && (s.round.lastDate == null || today > s.round.lastDate) ? today : s.round.lastDate
  return applyRoundOutcome({ ...s, round: { ...s.round, lastDate } }, s.div)
}

export function applyMatchRatings(s: SeasonState, div: number, entries: { date: string; result: LeagueDayResult; oppRating: number }[]): SeasonState {
  if (div < 1 || div > 3) return s
  let rating = s.rating
  let ratedUpTo = s.ratedUpTo
  const ordered = [...entries]
    .filter((e) => typeof e.date === 'string' && (ratedUpTo == null || e.date > ratedUpTo))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
  for (const e of ordered) {
    const band = ratingBandForDiff(e.oppRating - rating)
    rating = Math.max(0, rating + leagueRatingDelta(band, e.result, e.date))
    ratedUpTo = e.date
  }
  return { ...s, rating, ratedUpTo }
}

export function syncLeagueDay(today: string, days: Record<string, number>, div: number, seasonId: string): SeasonState {
  let s = loadSeasonState(today)
  if (typeof today !== 'string' || today.length !== 10) return s
  s = { ...s, div, highestDiv: Math.min(s.highestDiv, div), phaseBestDiv: Math.min(s.phaseBestDiv, div) }
  const playedDates = Object.keys(days ?? {}).filter((d) => (days[d] ?? 0) > 0).sort()
  const matches = playedDates.map((date) => {
    const dayIndex = Math.max(0, seasonDayIndex(date))
    const myPages = days[date] ?? 0
    const sid = seasonIdForDate(date)
    return { date, result: resultOfDay(sid, div, dayIndex, myPages), opp: oppRatingOf(sid, div, dayIndex, myPages) }
  })
  s = applyMatchRatings(s, div, matches.map((m) => ({ date: m.date, result: m.result, oppRating: m.opp })))
  s = appendRoundMatches(s, div, matches.map((m) => ({ date: m.date, result: m.result })))
  saveSeasonState(s)
  return s
}
```

ロールオーバー置換（`loadSeasonState` の切替分岐。旧 `resolvePendingDiv` 呼び出しと旧 `ensureLeagueBadgeForSeason` 呼び出しを削除し以下にする。`resolvePendingDiv`・`applyPromotionIfNeeded` の定義自体も削除する。`prevDiv`・`prevHighest`・`prevPhaseBestDiv` は復元済み値（正規化済み）の別名。新規作成時は `phaseBestDiv: div` で初期化する）：

```ts
const prevDiv = clampDiv((p as unknown as Record<string, unknown>)['div'])
const prevHighest = normalizeHighestDiv((p as unknown as Record<string, unknown>)['highestDiv'], prevDiv)
const prevPhaseBest = normalizeHighestDiv((p as unknown as Record<string, unknown>)['phaseBestDiv'], prevDiv)
const prevDays = days
const playedCount = Object.keys(prevDays).filter((d) => (prevDays[d] ?? 0) > 0).length
const prevCum = Object.values(prevDays).reduce((a, b) => a + b, 0)
const prevPop = leaguePopulationFor(prevId)
const finalRank = leagueRankForPages(prevCum, prevPop)
awardPhaseBadge(prevId, { bestDiv: prevPhaseBest, finalRank, played: playedCount })
const highestDiv = Math.min(prevHighest, prevDiv)
const div = startDivForHighest(highestDiv)
const rolled: SeasonState = { seasonId: currentId, div, highestDiv, phaseBestDiv: div, rating: div <= 3 ? RATING_START : 0, ratedUpTo: null, round: { w: 0, d: 0, l: 0, lastDate: null }, exp: 0, days: {}, appliedSeasonId: prevId }
```

`HomeScreen.tsx` の最終日昇格ブロック（`if (isSeasonFinalDay(today)) {` から対応する閉じ括弧まで。rivals cum 比較＋`applyPromotionIfNeeded` 呼び出し部分）を削除し、`recordSeasonDay` の直後に以下を1行追加する：

```ts
try {
  const st = loadSeasonState(today)
  syncLeagueDay(today, { ...(st.days ?? {}), [today]: pages }, st.div, seasonIdForDate(today))
} catch { /* national-only fallback */ }
```

import 整理（`noUnusedLocals` 対応）：`applyPromotionIfNeeded`・`isSeasonFinalDay`・`generateRivals`・`rivalPagesForDay` の import を削除（`seasonIdForDate`・`seasonDayIndex`・`loadSeasonState` は他で使うため残す）。該当行は `import { loadSeasonState, recordSeasonDay, syncLeagueDay } from '../data/seasonStore'` と `import { seasonDayIndex, seasonIdForDate } from '../lib/seasonLeague'` にする。

- [ ] **Step 4: Run tests to verify they pass**

Run: `cmd /c npx.cmd vitest run src/data/seasonStore.test.ts src/lib/seasonLeague.test.ts src/lib/leagueRating.test.ts --reporter=basic`
Expected: PASS。続けて `cmd /c npx.cmd vitest run src/screens/HomeScreen.test.tsx --reporter=basic` を実行し、通ることを確認する（HomeScreen.test.ts に旧昇格フロー依存のテストは無いため修正不要のはず。失敗があれば新仕様に合わせて期待値を更新する）

- [ ] **Step 5: Commit**

```bash
git add src/data/seasonStore.ts src/data/seasonStore.test.ts src/screens/HomeScreen.tsx src/screens/HomeScreen.test.tsx
git commit -m "feat: round and rating progression in season store"
```

### Task 6: ラウンドUI（進捗・スキップ・レーティング配線）

**Files:**
- Modify: `src/screens/RankingScreen.tsx`（旧昇格文言→ラウンド状況＋スキップボタン、レーティング表示切替）
- Test: `src/screens/RankingScreen.test.tsx`

**Interfaces:**
- Consumes: Task 2 の `decideRoundOutcome`・`tallyToResults`・`PROMOTION_LINES`・`STAY_LINES`、Task 5 の `SeasonState.round`（`loadSeasonState` 経由）・`finalizeRoundEarly`・`saveSeasonState`。
- Produces: `data-testid="league-round-status"`・`data-testid="league-skip"`（表示条件つき）。

- [ ] **Step 1: Write the failing test**

```tsx
it('ラウンド状況に勝ち点と昇格ラインが出て確定前はスキップが出ない', () => {
  localStorage.clear()
  render(<RankingScreen onBack={() => {}} today="2026-09-02" />)
  fireEvent.click(screen.getByTestId('league-tab'))
  fireEvent.click(screen.getByTestId('league-panel-toggle'))
  expect(screen.getByTestId('league-round-status')).toHaveTextContent(/勝ち点/)
  expect(screen.getByTestId('league-round-status')).toHaveTextContent('昇格3')
  expect(screen.queryByTestId('league-skip')).toBeNull()
})
it('昇格確定でスキップボタンが出て押すと即昇格する', async () => {
  const now = new Date().toISOString()
  const today = '2026-09-02'
  await db.books.add({ id: 'b1', title: '単語帳', totalPages: 500, startDate: today, deadline: today, createdAt: now, updatedAt: now })
  await db.records.add({ id: 'r1', bookId: 'b1', date: '2026-09-01', pages: 100 })
  await db.records.add({ id: 'r2', bookId: 'b1', date: today, pages: 100 })
  localStorage.clear()
  const { loadSeasonState, saveSeasonState, syncLeagueDay } = await import('../data/seasonStore')
  const s0 = loadSeasonState('2026-09-01')
  saveSeasonState({ ...s0, div: 10, highestDiv: 10, phaseBestDiv: 10, rating: 0, ratedUpTo: null, round: { w: 0, d: 0, l: 0, lastDate: null }, exp: 0, days: {} })
  syncLeagueDay('2026-09-02', { '2026-09-01': 100, '2026-09-02': 100 }, 10, '2026-09-01')
  render(<RankingScreen onBack={() => {}} today={today} />)
  fireEvent.click(screen.getByTestId('league-tab'))
  fireEvent.click(screen.getByTestId('league-panel-toggle'))
  await waitFor(() => expect(screen.getByTestId('league-skip')).toBeInTheDocument())
  fireEvent.click(screen.getByTestId('league-skip'))
  await waitFor(() => expect(screen.getByTestId('league-division')).toHaveTextContent('Division 9'))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c npx.cmd vitest run src/screens/RankingScreen.test.tsx -t "ラウンド状況" --reporter=verbose`
Expected: FAIL（`league-round-status` 不存在）

- [ ] **Step 3: Write minimal implementation**

`seasonState` を `useState` 化する（スキップ押下後に再読込するため）。`const seasonState = useMemo(...)` を以下に置換する：

```tsx
const [seasonTick, setSeasonTick] = useState(0)
const seasonState = useMemo(() => {
  try {
    return loadSeasonState(today)
  } catch {
    return { seasonId: '2026-09-01', div: 10, exp: 0, days: {} as Record<string, number> }
  }
}, [today, seasonTick])
```

ヘッダーの旧昇格文言ブロック（`data-testid="league-promotion"` の div 全体）を以下に置換する：

```tsx
<div data-testid="league-round-status" style={{ fontSize: 13, color: '#9aa3c0', marginTop: 8 }}>
  {(() => {
    const t = seasonState.round ?? { w: 0, d: 0, l: 0, lastDate: null }
    const played = t.w + t.d + t.l
    const pts = t.w * 3 + t.d
    const promo = PROMOTION_LINES[seasonState.div]
    const stay = STAY_LINES[seasonState.div]
    if (promo === undefined) return `レーティング勝負中（現在${seasonState.rating}）`
    return `ラウンド${played + 1}試合目 勝ち点${pts}（昇格${promo}${stay == null ? '' : `・残留${stay}`}）`
  })()}
</div>
{(() => {
  const t = seasonState.round ?? { w: 0, d: 0, l: 0, lastDate: null }
  const played = t.w + t.d + t.l
  const outcome = decideRoundOutcome(seasonState.div, tallyToResults(t))
  if (outcome !== 'promote' || played >= 10 || seasonState.div < 4 || seasonState.div > 10) return null
  return (
    <button data-testid="league-skip" type="button" onClick={() => { try { saveSeasonState(finalizeRoundEarly(loadSeasonState(today), today)); setSeasonTick((v) => v + 1) } catch { /* ignore */ } }} style={{ flex: 1, background: '#ffe600', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, padding: '10px 0' }}>
      スキップして昇格
    </button>
  )
})()}
```

必要な import 追加：7行目の seasonLeague import 行に `decideRoundOutcome, tallyToResults, PROMOTION_LINES, STAY_LINES` を追記し、9行目を `import { loadSeasonState, saveSeasonState, finalizeRoundEarly } from '../data/seasonStore'` に変える。レーティング表示はこのタスクでは触らない（Task 7 で `seasonState.rating` に差し替える）。旧昇格文言テスト（`it('リーグタブに成績バーと直近履歴が出る')` 内の `expect(screen.getByTestId('league-promotion')).toHaveTextContent('昇格')`）は `expect(screen.getByTestId('league-round-status')).toHaveTextContent('昇格')` に書き換える（Div10既定で `ラウンド1試合目 勝ち点0（昇格3）` が出るため通る）。

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd /c npx.cmd vitest run src/screens/RankingScreen.test.tsx --reporter=basic`
Expected: PASS（全件）

- [ ] **Step 5: Commit**

```bash
git add src/screens/RankingScreen.tsx src/screens/RankingScreen.test.tsx
git commit -m "feat: round status and promotion skip"
```

### Task 7: 順位表撤去＋自分の情報＋リーグ順位表示

**Files:**
- Modify: `src/screens/RankingScreen.tsx`（`league-table` 削除・`league-rank` 変更・`league-wins` 簡素化・旧バッジフック削除）
- Test: `src/screens/RankingScreen.test.tsx`

**Interfaces:**
- Consumes: Task 4 の `leaguePopulationFor`・`leagueRankForPages`、Task 5 の `SeasonState`（`days`・`rating`）。
- Produces: 8人表なしのリーグタブ。`league-rank` は `○○万人中 ○位` 形式。

- [ ] **Step 1: Write the failing test**

```tsx
it('リーグ順位は母集団つきの自分の順位で8人表は出ない', async () => {
  const now = new Date().toISOString()
  const today = '2026-09-02'
  await db.books.add({ id: 'b1', title: '単語帳', totalPages: 100, startDate: today, deadline: today, createdAt: now, updatedAt: now })
  await db.records.add({ id: 'r1', bookId: 'b1', date: today, pages: 100 })
  localStorage.clear()
  render(<RankingScreen onBack={() => {}} today={today} />)
  fireEvent.click(screen.getByTestId('league-tab'))
  expect(document.getElementById('league-table')).toBeNull()
  expect(screen.queryByTestId('league-row-you')).toBeNull()
  expect(screen.getByTestId('league-rank')).toHaveTextContent(/万人中/)
  expect(screen.getByTestId('league-rank')).toHaveTextContent(/位/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c npx.cmd vitest run src/screens/RankingScreen.test.tsx -t "8人表は出ない" --reporter=verbose`
Expected: FAIL（`league-table` が存在する）

- [ ] **Step 3: Write minimal implementation**

`id="league-table"` の `<section>...</section>` 全体を削除する。同時に `leagueRows`・`myLeagueRank`・`myLeagueCum`・`displayRating`（残っていれば）・`ensureLeagueBadgeForSeason` の `useEffect`・`generateRivals`・`rivalPagesForDay` の import（全国タブで使っていなければ削除。`seasonIdForDate` は leagueDaily で使うため残す）。

`league-rank` の表示を以下に変更する（`pop` は Task 4 の `leaguePopulationFor(seasonId)`、`seasonCum` は `loadSeasonState(today).days` の合計。既に手元にある `seasonState` から取る）：

```tsx
<span data-testid="league-rank" style={{ fontSize: 22, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
  {`${Math.round(pop / 10000)}万人中 ${leagueRankForPages(seasonCum, pop).toLocaleString()}位`}
</span>
```

`league-wins` の `（{leagueRows.length}人中{myLeagueRank}位）` 部分を削除し `○{leagueWins}勝` のみにする（`leagueWins` の算出は `leagueRows` 由来からラウンドタリー由来 `seasonState.round.w` に変更する。`league-wins` を参照する既存テスト「リーグ表の○勝に順位と人数を併記する」はタイトルを「リーグ表の○勝が表示される」に変え `○\d+勝` のみ検証する）。

8人表に依存する既存テストは削除または新仕様に更新する。対象は `getByTestId('league-table')`・`getByTestId('league-row-you')`・`8人中`・`近傍ライバル` を参照するリーグタブ側テスト（全国タブの `ranking-rival` 系は対象外で触らない）。該当テスト名：「リーグタブでDiv10順位表が出る」（削除。代わりは本タスク Step 1 のテスト）、「リーグ表の自分累計は今季のDB合計と一致する」（`league-row-you` の `110pt` 検証をやめ、`league-rating` が `11` であることに変える。110ページ→22pt換算→半分の11）、「リーグ表の変動列は記号と数値が分かれて縦に揃う」「リーグ表の変動矢印は上下で色分けされ見やすい」「リーグ表の全行と列幅が統一されている」「リーグ表の自分の行は他行より太く大きい」「リーグ表の変動マークの幅は統一されている」（`league-mark-sym/val` 系：「変動矢印は上下で色分け」「変動マークの幅は統一」「記号と数値が分かれて縦に揃う」は前日比マークが残るため維持。「自分の行」「列幅が統一」は8人表前提のため削除）。

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd /c npx.cmd vitest run src/screens/RankingScreen.test.tsx src/screens/MyPageScreen.test.tsx src/App.test.tsx --reporter=basic`
Expected: PASS。`tsc` も `cmd /c npx.cmd tsc -b --pretty false` で clean

- [ ] **Step 5: Commit**

```bash
git add src/screens/RankingScreen.tsx src/screens/RankingScreen.test.tsx
git commit -m "feat: own-info league board without 8-person table"
```

## Self-Review

（作成後に以下を確認すること）
