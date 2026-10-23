# League Div Badges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Div1/Div2/Div3到達バッジ（毎シーズン付与・コレクション収納・最大3つ装着）をマイページに実装する。

**Architecture:** 新規localStorageストア（`lib/leagueBadges.ts`）＋表示コンポーネント（`components/LeagueBadge.tsx`・`components/LeagueBadgeShelf.tsx`）＋付与配線（`data/seasonStore.ts`・表示時補完）。既存seasonStore/profileStoreの形式は変えない。見た目はCSS/SVGのオリジナル描画（外部画像・商標なし）。

**Tech Stack:** React + TypeScript + Vite + Vitest (jsdom, fake-indexeddb, Testing Library)

**Spec:** docs/superpowers/specs/2026-10-23-league-badges-design.md

## Global Constraints

- 完全オフライン（GitHub Pages + localStorage）を維持する。
- 新規ルート・フッター追加なし。
- バッジ表示はマイページのみ。リーグ画面の報酬欄は変更しない。
- 一度に表示（装着）できるバッジは最大3つまで。
- 付与条件は「そのDivでシーズンを迎えること」（昇格・降格の区別なし）。
- 期ラベルはシーズン開始日の下2桁年-月（例：`26-09`）。
- 画像素材・商標（eFootball™等）は流用しない。バッジはCSS/SVGのオリジナル描画とする。
- 既存のRanking/Home/MyPageテストを壊さない。

---

## File Structure

- Create: `src/lib/leagueBadges.ts` — バッジ定義・localStorageストア・付与/装着ロジック（Task 1）
- Create: `src/lib/leagueBadges.test.ts` — Task 1のテスト
- Create: `src/components/LeagueBadge.tsx` — 円形バッジ単体表示（Task 2）
- Create: `src/components/LeagueBadge.test.tsx` — Task 2のテスト
- Create: `src/components/LeagueBadgeShelf.tsx` — 装着3枠＋コレクション棚（Task 3）
- Modify: `src/screens/MyPageScreen.tsx` — 棚の設置（Task 3、mypage-goalセクション直後）
- Test: `src/screens/MyPageScreen.test.tsx` に追記（Task 3）
- Modify: `src/data/seasonStore.ts` — ロールオーバー時・昇格適用時の付与（Task 4、try/catch内）
- Test: `src/data/seasonStore.test.ts` に追記（Task 4）
- Modify: `src/screens/RankingScreen.tsx` — リーグ表示時の補完付与useEffect（Task 4）

---

### Task 1: バッジストア（定義・保存・付与・装着）

**Files:**
- Create: `src/lib/leagueBadges.ts`
- Test: `src/lib/leagueBadges.test.ts`

**Interfaces:**
- Consumes: なし（新規・依存なし）
- Produces: `LEAGUE_BADGE_DEFS`、`badgeIdForDiv(div)`、`seasonLabel(seasonId)`、`loadLeagueBadges()`、`saveLeagueBadges(s)`、`ensureLeagueBadgeForSeason(seasonId, div)`、`toggleBadgeEquipped(uid)`、`MAX_EQUIPPED_BADGES`（Task 2〜4が使用。シグネチャ厳守）

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/leagueBadges.test.ts
import { describe, expect, it, beforeEach } from 'vitest'
import {
  MAX_EQUIPPED_BADGES,
  badgeIdForDiv,
  ensureLeagueBadgeForSeason,
  loadLeagueBadges,
  seasonLabel,
  toggleBadgeEquipped,
} from './leagueBadges'

describe('leagueBadges', () => {
  beforeEach(() => localStorage.clear())
  it('Div1〜3到達で当季バッジを付与し二重付与しない', () => {
    expect(ensureLeagueBadgeForSeason('2026-09-29', 2)).toEqual(['2026-09-29:div2'])
    expect(ensureLeagueBadgeForSeason('2026-09-29', 2)).toEqual([])
    expect(loadLeagueBadges().awards).toHaveLength(1)
  })
  it('Div4以下・不正入力では付与しない', () => {
    expect(ensureLeagueBadgeForSeason('2026-09-29', 4)).toEqual([])
    expect(ensureLeagueBadgeForSeason('xxx', 1)).toEqual([])
    expect(loadLeagueBadges().awards).toHaveLength(0)
  })
  it('別シーズンは別バッジとして付与する', () => {
    ensureLeagueBadgeForSeason('2026-09-01', 1)
    ensureLeagueBadgeForSeason('2026-09-29', 1)
    expect(loadLeagueBadges().awards).toHaveLength(2)
  })
  it('装着は3つまで・4つ目はfullで拒否', () => {
    expect(MAX_EQUIPPED_BADGES).toBe(3)
    const uids = ['2026-09-01:div1', '2026-09-01:div2', '2026-09-01:div3', '2026-09-29:div1']
    for (const [i, s] of ['2026-09-01', '2026-09-01', '2026-09-01', '2026-09-29'].entries()) {
      ensureLeagueBadgeForSeason(s, (i % 3) + 1)
    }
    expect(toggleBadgeEquipped(uids[0]).ok).toBe(true)
    expect(toggleBadgeEquipped(uids[1]).ok).toBe(true)
    expect(toggleBadgeEquipped(uids[2]).ok).toBe(true)
    const r = toggleBadgeEquipped(uids[3])
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('full')
    expect(loadLeagueBadges().equipped).toHaveLength(3)
  })
  it('装着済みの再タップで外せる・未所持はmissing', () => {
    ensureLeagueBadgeForSeason('2026-09-01', 1)
    expect(toggleBadgeEquipped('2026-09-01:div1').ok).toBe(true)
    expect(toggleBadgeEquipped('2026-09-01:div1').ok).toBe(true)
    expect(loadLeagueBadges().equipped).toHaveLength(0)
    expect(toggleBadgeEquipped('2099-01-01:div1').reason).toBe('missing')
  })
  it('破損JSONは空コレクションとして扱う', () => {
    localStorage.setItem('schedule-app-league-badges-v1', 'not-json')
    expect(loadLeagueBadges()).toEqual({ awards: [], equipped: [] })
  })
  it('期ラベルは下2桁年-月・不正は―', () => {
    expect(seasonLabel('2026-09-29')).toBe('26-09')
    expect(badgeIdForDiv(1)).toBe('div1')
    expect(badgeIdForDiv(4)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/leagueBadges.test.ts`
Expected: FAIL with "Failed to resolve import"（ファイル未作成のため）

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/leagueBadges.ts
export type LeagueBadgeDiv = 1 | 2 | 3
export type LeagueBadgeId = 'div1' | 'div2' | 'div3'
export type LeagueBadgeAward = { uid: string; badgeId: LeagueBadgeId; div: LeagueBadgeDiv; seasonId: string; awardedAt: string }
export type LeagueBadgeState = { awards: LeagueBadgeAward[]; equipped: string[] }

export const MAX_EQUIPPED_BADGES = 3
const KEY = 'schedule-app-league-badges-v1'
const SEASON_RE = /^\d{4}-\d{2}-\d{2}$/

export const LEAGUE_BADGE_DEFS: Record<LeagueBadgeDiv, { badgeId: LeagueBadgeId; name: string; from: string; to: string; rim: string }> = {
  1: { badgeId: 'div1', name: 'Div1到達', from: '#ff5a52', to: '#b81f1f', rim: '#e8c47a' },
  2: { badgeId: 'div2', name: 'Div2到達', from: '#ffb020', to: '#c96a00', rim: '#e8c47a' },
  3: { badgeId: 'div3', name: 'Div3到達', from: '#3ddc74', to: '#0f8a3d', rim: '#c0c0c0' },
}

export function badgeIdForDiv(div: number): LeagueBadgeId | null {
  if (div === 1) return 'div1'
  if (div === 2) return 'div2'
  if (div === 3) return 'div3'
  return null
}

export function seasonLabel(seasonId: string): string {
  if (typeof seasonId !== 'string' || !SEASON_RE.test(seasonId)) return '―'
  return seasonId.slice(2, 4) + '-' + seasonId.slice(5, 7)
}

function emptyState(): LeagueBadgeState {
  return { awards: [], equipped: [] }
}

export function loadLeagueBadges(): LeagueBadgeState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw == null) return emptyState()
    const p = JSON.parse(raw) as Partial<LeagueBadgeState>
    const awards = Array.isArray(p.awards)
      ? p.awards.filter((a) => a && typeof a.uid === 'string' && (a.div === 1 || a.div === 2 || a.div === 3) && typeof a.seasonId === 'string')
      : []
    const owned = new Set(awards.map((a) => a.uid))
    const equipped = Array.isArray(p.equipped) ? p.equipped.filter((u) => typeof u === 'string' && owned.has(u)).slice(0, MAX_EQUIPPED_BADGES) : []
    return { awards, equipped }
  } catch {
    return emptyState()
  }
}

export function saveLeagueBadges(s: LeagueBadgeState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch { /* ignore */ }
}

// 条件を満たすシーズンにバッジを付与（冪等）。新規付与したuidを返す。
export function ensureLeagueBadgeForSeason(seasonId: string, div: number): string[] {
  try {
    if (typeof seasonId !== 'string' || !SEASON_RE.test(seasonId)) return []
    if (div !== 1 && div !== 2 && div !== 3) return []
    const uid = `${seasonId}:div${div}`
    const s = loadLeagueBadges()
    if (s.awards.some((a) => a.uid === uid)) return []
    s.awards.push({ uid, badgeId: `div${div}` as LeagueBadgeId, div, seasonId, awardedAt: new Date().toISOString() })
    saveLeagueBadges(s)
    return [uid]
  } catch {
    return []
  }
}

export function toggleBadgeEquipped(uid: string): { ok: boolean; reason?: 'missing' | 'full'; equipped: string[] } {
  try {
    const s = loadLeagueBadges()
    if (!s.awards.some((a) => a.uid === uid)) return { ok: false, reason: 'missing', equipped: s.equipped }
    if (s.equipped.includes(uid)) {
      const equipped = s.equipped.filter((u) => u !== uid)
      saveLeagueBadges({ ...s, equipped })
      return { ok: true, equipped }
    }
    if (s.equipped.length >= MAX_EQUIPPED_BADGES) return { ok: false, reason: 'full', equipped: s.equipped }
    const equipped = [...s.equipped, uid]
    saveLeagueBadges({ ...s, equipped })
    return { ok: true, equipped }
  } catch {
    return { ok: false, reason: 'missing', equipped: [] }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/leagueBadges.test.ts`
Expected: PASS（9 tests）

- [ ] **Step 5: Commit**

```bash
git add src/lib/leagueBadges.ts src/lib/leagueBadges.test.ts
git commit -m "feat: add league badge store"
```

### Task 2: バッジ単体表示コンポーネント

**Files:**
- Create: `src/components/LeagueBadge.tsx`
- Test: `src/components/LeagueBadge.test.tsx`

**Interfaces:**
- Consumes: Task 1の`LEAGUE_BADGE_DEFS`・`LeagueBadgeDiv`型
- Produces: 既定export`LeagueBadge({ div, seasonLabel, equipped?, slotNumber?, isNew?, onClick? })`（Task 3の棚が使用）

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/LeagueBadge.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import LeagueBadge from './LeagueBadge'

it('Div数字と期ラベルを表示する', () => {
  render(<LeagueBadge div={1} seasonLabel="26-09" />)
  const badge = screen.getByTestId('league-badge')
  expect(badge).toHaveTextContent('1')
  expect(badge).toHaveTextContent('26-09')
  expect(badge.getAttribute('data-div')).toBe('1')
})

it('装着中はスロット番号・新規はドット・クリックでonClick', () => {
  const onClick = vi.fn()
  render(<LeagueBadge div={2} seasonLabel="26-09" equipped slotNumber={2} isNew onClick={onClick} />)
  expect(screen.getByTestId('league-badge-slot')).toHaveTextContent('2')
  expect(screen.getByTestId('league-badge-new')).toBeInTheDocument()
  fireEvent.click(screen.getByTestId('league-badge'))
  expect(onClick).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/LeagueBadge.test.tsx`
Expected: FAIL with "Failed to resolve import"

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/LeagueBadge.tsx
import { LEAGUE_BADGE_DEFS, type LeagueBadgeDiv } from '../lib/leagueBadges'

type Props = {
  div: LeagueBadgeDiv
  seasonLabel: string
  equipped?: boolean
  slotNumber?: number
  isNew?: boolean
  size?: number
  onClick?: () => void
}

export default function LeagueBadge({ div, seasonLabel, equipped, slotNumber, isNew, size = 64, onClick }: Props) {
  const def = LEAGUE_BADGE_DEFS[div]
  return (
    <button
      type="button"
      data-testid="league-badge"
      data-div={String(div)}
      onClick={onClick}
      aria-label={`${def.name} ${seasonLabel}`}
      style={{
        position: 'relative',
        width: size,
        height: size + 16,
        padding: 0,
        background: 'transparent',
        border: 'none',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <span
        style={{
          display: 'block',
          width: size,
          height: size,
          borderRadius: '50%',
          padding: 3,
          background: `conic-gradient(from 210deg, ${def.rim}, #fff8, ${def.rim})`,
          outline: equipped ? '3px solid #29b6ff' : 'none',
          outlineOffset: 1,
        }}
      >
        <span
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: `radial-gradient(circle at 35% 30%, ${def.from}, ${def.to})`,
          }}
        >
          <svg viewBox="0 0 64 64" width={size * 0.52} height={size * 0.52} aria-hidden="true">
            <path
              d="M32 8 L49 15 V32 C49 44 41 51 32 54 C23 51 15 44 15 32 V15 Z"
              fill="none"
              stroke="#fff"
              strokeWidth={4}
              strokeLinejoin="round"
            />
            <text x={32} y={41} textAnchor="middle" fontSize={26} fontWeight={900} fill="#fff">
              {div}
            </text>
          </svg>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{seasonLabel}</span>
        </span>
      </span>
      {equipped && slotNumber != null && (
        <span
          data-testid="league-badge-slot"
          style={{
            position: 'absolute',
            right: 0,
            bottom: 12,
            minWidth: 20,
            height: 20,
            padding: '0 4px',
            background: '#29b6ff',
            color: '#fff',
            fontSize: 12,
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {slotNumber}
        </span>
      )}
      {isNew && (
        <span
          data-testid="league-badge-new"
          style={{
            position: 'absolute',
            left: 2,
            top: 2,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#29b6ff',
          }}
        />
      )}
    </button>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/LeagueBadge.test.tsx`
Expected: PASS（2 tests）

- [ ] **Step 5: Commit**

```bash
git add src/components/LeagueBadge.tsx src/components/LeagueBadge.test.tsx
git commit -m "feat: add league badge visual"
```

### Task 3: マイページのバッジ棚（装着3枠＋一覧＋付け外し）

**Files:**
- Create: `src/components/LeagueBadgeShelf.tsx`
- Modify: `src/screens/MyPageScreen.tsx`（mypage-goalセクションの直後＝連続日数セクションの直前に`<LeagueBadgeShelf seasonId={season.seasonId} div={season.div} />`を1行追加。`season`は既存const（loadSeasonStateの結果）を流用し新規取得しない）
- Test: `src/screens/MyPageScreen.test.tsx`に追記

**Interfaces:**
- Consumes: Task 1の`loadLeagueBadges`・`ensureLeagueBadgeForSeason`・`toggleBadgeEquipped`・`seasonLabel`、Task 2の`LeagueBadge`
- Produces: 既定export`LeagueBadgeShelf({ seasonId, div })`。表示時補完の付与もこのコンポーネントのuseEffectで行う

- [ ] **Step 1: Write the failing test**

```tsx
// src/screens/MyPageScreen.test.tsx に追記
it('リーグバッジ棚に装着と一覧が出る', async () => {
  const { saveLeagueBadges } = await import('../lib/leagueBadges')
  saveLeagueBadges({
    awards: [
      { uid: '2026-09-01:div2', badgeId: 'div2', div: 2, seasonId: '2026-09-01', awardedAt: '2026-09-02T00:00:00.000Z' },
      { uid: '2026-09-29:div1', badgeId: 'div1', div: 1, seasonId: '2026-09-29', awardedAt: '2026-09-30T00:00:00.000Z' },
    ],
    equipped: ['2026-09-29:div1'],
  })
  render(<MyPageScreen onBack={() => {}} onRanking={() => {}} today="2026-09-29" />)
  const shelf = await screen.findByTestId('league-badge-shelf')
  expect(shelf).toHaveTextContent('Div2到達')
  expect(screen.getAllByTestId('league-badge-cell')).toHaveLength(2)
  expect(screen.getByTestId('league-badge-slot')).toHaveTextContent('1')
})

it('4つ目の装着はブロック文が出る', async () => {
  const { saveLeagueBadges } = await import('../lib/leagueBadges')
  saveLeagueBadges({
    awards: [
      { uid: 'a:div1', badgeId: 'div1', div: 1, seasonId: '2026-09-01', awardedAt: '2026-09-02T00:00:00.000Z' },
      { uid: 'b:div1', badgeId: 'div1', div: 1, seasonId: '2026-09-29', awardedAt: '2026-09-30T00:00:00.000Z' },
      { uid: 'c:div2', badgeId: 'div2', div: 2, seasonId: '2026-09-01', awardedAt: '2026-09-02T00:00:00.000Z' },
      { uid: 'd:div3', badgeId: 'div3', div: 3, seasonId: '2026-09-01', awardedAt: '2026-09-02T00:00:00.000Z' },
    ],
    equipped: ['a:div1', 'b:div1', 'c:div2'],
  })
  render(<MyPageScreen onBack={() => {}} onRanking={() => {}} today="2026-09-29" />)
  await screen.findByTestId('league-badge-shelf')
  const cells = screen.getAllByTestId('league-badge-cell')
  fireEvent.click(cells[3])
  expect(await screen.findByTestId('league-badge-limit')).toHaveTextContent('3つまで')
})

it('未獲得時は案内文が出る', async () => {
  render(<MyPageScreen onBack={() => {}} onRanking={() => {}} today="2026-09-29" />)
  expect(await screen.findByTestId('league-badge-empty')).toHaveTextContent('Div3')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/screens/MyPageScreen.test.tsx -t "リーグバッジ"`
Expected: FAIL（`league-badge-shelf`が見つからない）

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/LeagueBadgeShelf.tsx
import { useEffect, useState } from 'react'
import {
  LEAGUE_BADGE_DEFS,
  ensureLeagueBadgeForSeason,
  loadLeagueBadges,
  seasonLabel,
  toggleBadgeEquipped,
  type LeagueBadgeState,
} from '../lib/leagueBadges'
import LeagueBadge from './LeagueBadge'

type Props = { seasonId: string; div: number }

const cardStyle = {
  marginTop: 8,
  marginBottom: 8,
  padding: '10px 12px',
  borderRadius: 8,
  background: '#151a30',
  border: '1px solid #2a3358',
  color: '#fff',
} as const

export default function LeagueBadgeShelf({ seasonId, div }: Props) {
  const [state, setState] = useState<LeagueBadgeState>({ awards: [], equipped: [] })
  const [justGranted, setJustGranted] = useState<string[]>([])
  const [limited, setLimited] = useState(false)
  useEffect(() => {
    try {
      const granted = ensureLeagueBadgeForSeason(seasonId, div)
      setJustGranted(granted)
      setState(loadLeagueBadges())
    } catch { /* ignore */ }
  }, [seasonId, div])
  const byUid = new Map(state.awards.map((a) => [a.uid, a]))
  const onToggle = (uid: string) => {
    try {
      const r = toggleBadgeEquipped(uid)
      setState(loadLeagueBadges())
      setLimited(!r.ok && r.reason === 'full')
    } catch { /* ignore */ }
  }
  return (
    <section data-testid="league-badge-shelf" style={cardStyle}>
      <div style={{ fontWeight: 800, fontSize: 16 }}>リーグバッジ</div>
      <div style={{ fontSize: 12, color: '#9aa3c0' }}>Div3/Div2/Div1到達で毎シーズン獲得・最大3つまで表示</div>
      <div data-testid="league-badge-equipped" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {[0, 1, 2].map((i) => {
          const uid = state.equipped[i]
          const a = uid ? byUid.get(uid) : undefined
          return a ? (
            <LeagueBadge
              key={uid}
              div={a.div}
              seasonLabel={seasonLabel(a.seasonId)}
              equipped
              slotNumber={i + 1}
              isNew={justGranted.includes(uid)}
              size={56}
              onClick={() => onToggle(uid)}
            />
          ) : (
            <div
              key={`empty-${i}`}
              data-testid="league-badge-empty-slot"
              style={{ width: 56, height: 72, borderRadius: 12, border: '2px dashed #2a3358' }}
            />
          )
        })}
      </div>
      {state.awards.length === 0 ? (
        <div data-testid="league-badge-empty" style={{ fontSize: 13, color: '#9aa3c0', marginTop: 8 }}>
          まだバッジなし。Div3以上でシーズンを迎えると獲得できるよ
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 8, marginTop: 8 }}>
          {state.awards.map((a) => {
            const def = LEAGUE_BADGE_DEFS[a.div]
            const idx = state.equipped.indexOf(a.uid)
            return (
              <div key={a.uid} data-testid="league-badge-cell" data-uid={a.uid} title={`${def.name} ${seasonLabel(a.seasonId)}`}>
                <LeagueBadge
                  div={a.div}
                  seasonLabel={seasonLabel(a.seasonId)}
                  equipped={idx !== -1}
                  slotNumber={idx !== -1 ? idx + 1 : undefined}
                  isNew={justGranted.includes(a.uid)}
                  onClick={() => onToggle(a.uid)}
                />
              </div>
            )
          })}
        </div>
      )}
      {limited && (
        <div data-testid="league-badge-limit" style={{ fontSize: 13, color: '#ffb020', marginTop: 8 }}>
          表示は3つまでだよ。外してから付けてね
        </div>
      )}
    </section>
  )
}
```

MyPageScreen.tsxの変更（1行追加。`season`は既存constを流用）：

```tsx
import LeagueBadgeShelf from '../components/LeagueBadgeShelf'
```

```tsx
      </section>
      <LeagueBadgeShelf seasonId={season.seasonId} div={season.div} />
      <section style={cardStyle}>
        <div data-testid="mypage-streak"
```

※ 挿入位置：`mypage-goal`セクションの閉じ`</section>`直後、連続日数セクションの直前。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/screens/MyPageScreen.test.tsx`
Expected: PASS（全件。 league-badge系3件を含む）

- [ ] **Step 5: Commit**

```bash
git add src/components/LeagueBadgeShelf.tsx src/screens/MyPageScreen.tsx src/screens/MyPageScreen.test.tsx
git commit -m "feat: add league badge shelf to mypage"
```

### Task 4: 付与配線（シーズン切替・昇格・リーグ表示補完）

**Files:**
- Modify: `src/data/seasonStore.ts`（2箇所。`ensureLeagueBadgeForSeason`のimport＋呼出を追加。既存ロジックは変えない）
- Modify: `src/screens/RankingScreen.tsx`（リーグ表示時の補完useEffectを1つ追加）
- Test: `src/data/seasonStore.test.ts`に追記

**Interfaces:**
- Consumes: Task 1の`ensureLeagueBadgeForSeason`
- Produces: 付与タイミングの完成（Task 3の表示時補完と合わせてspec §6の3点を満たす）

- [ ] **Step 1: Write the failing test**

```ts
// src/data/seasonStore.test.ts に追記
it('シーズン切替で新Div1〜3ならバッジ付与・Div4以下はなし', () => {
  const { loadLeagueBadges } = require('../lib/leagueBadges') as typeof import('../lib/leagueBadges')
  const s0 = loadSeasonState('2026-09-01')
  saveSeasonState({ ...s0, div: 2, exp: 0, days: { '2026-09-01': 10, '2026-09-02': 10, '2026-09-03': 10 } })
  const s1 = loadSeasonState('2026-09-29')
  expect(s1.div).toBe(2)
  expect(loadLeagueBadges().awards.map((a) => a.uid)).toContain('2026-09-29:div2')
})

it('昇格適用でDiv2に入ったら当季バッジ付与・Div4は付与なし', () => {
  const { loadLeagueBadges } = require('../lib/leagueBadges') as typeof import('../lib/leagueBadges')
  const base = loadSeasonState('2026-09-01')
  saveSeasonState({ ...base, div: 3, exp: 0, days: {} })
  const p = applyPromotionIfNeeded('2026-09-28', ['me', 'r2', 'r3', 'r4', 'r5'], 'me')
  expect(p.div).toBe(2)
  expect(loadLeagueBadges().awards.map((a) => a.uid)).toContain('2026-09-01:div2')
  localStorage.clear()
  const b2 = loadSeasonState('2026-09-01')
  saveSeasonState({ ...b2, div: 5, exp: 0, days: {} })
  const q = applyPromotionIfNeeded('2026-09-28', ['me', 'r2', 'r3', 'r4', 'r5'], 'me')
  expect(q.div).toBe(4)
  expect(loadLeagueBadges().awards).toHaveLength(0)
})
```

※ `require`ではなく既存ファイル先頭のimport形式に合わせ、追記テストでは`import { loadLeagueBadges } from '../lib/leagueBadges'`をファイル先頭に追加すること。

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/data/seasonStore.test.ts -t "バッジ"`
Expected: FAIL（`awards`が空。配線未実装のため）

- [ ] **Step 3: Write minimal implementation**

seasonStore.tsの変更1（import追加）：

```ts
import { ensureLeagueBadgeForSeason } from '../lib/leagueBadges'
```

変更2（ロールオーバー時。`rolled`保存直前に追加）：

```ts
        const pending = resolvePendingDiv(prevId, div, days, applied)
        const rolled: SeasonState = { seasonId: currentId, div: pending.div, exp: 0, days: {} }
        if (pending.applied) rolled.appliedSeasonId = pending.applied
        try {
          ensureLeagueBadgeForSeason(currentId, pending.div)
        } catch { /* ignore */ }
        try {
          localStorage.setItem(KEY, JSON.stringify(rolled))
        } catch { /* ignore */ }
```

変更3（昇格適用時。`div`確定後・`next`保存前に追加）：

```ts
    let div = s.div
    if (promote.includes(myId)) div = Math.max(1, div - 1)
    else if (demote.includes(myId)) div = Math.min(10, div + 1)
    try {
      ensureLeagueBadgeForSeason(s.seasonId, div)
    } catch { /* ignore */ }
    const next: SeasonState = { seasonId: s.seasonId, div, exp: s.exp, days: s.days, appliedSeasonId: s.seasonId }
```

RankingScreen.tsxの変更（`seasonState`useMemoの直後に追加。表示時の補完。既存の集計ロジックは変えない）：

```tsx
  useEffect(() => {
    try {
      ensureLeagueBadgeForSeason(seasonIdForDate(today), seasonState.div)
    } catch { /* ignore */ }
  }, [today, seasonState.div])
```

```tsx
import { ensureLeagueBadgeForSeason } from '../lib/leagueBadges'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/data/seasonStore.test.ts src/screens/RankingScreen.test.tsx src/screens/MyPageScreen.test.tsx src/lib/leagueBadges.test.ts src/components/LeagueBadge.test.tsx`
Expected: PASS（全件）

- [ ] **Step 5: Commit**

```bash
git add src/data/seasonStore.ts src/screens/RankingScreen.tsx src/data/seasonStore.test.ts
git commit -m "feat: grant league badges on rollover and promotion"
```

## Self-Review

- Spec coverage: §3定義→Task 1、§4見た目→Task 2＋Task 3、§5データ→Task 1、§6付与→Task 4＋Task 3のuseEffect、§7画面→Task 3、§8エラー→各try/catch＋Task 1破損テスト、§9テスト→各Task、§10対象外→Task になし。ギャップなし。
- Placeholder scan: TBD/TODO/「適切に」等の曖昧表現なし。数値（3枠・色・キー名・testid）はすべて具体値。
- Type consistency: `LeagueBadgeDiv`・`LeagueBadgeId`・`LeagueBadgeAward(uid/div/seasonId)`・`ensureLeagueBadgeForSeason(seasonId: string, div: number): string[]`・`toggleBadgeEquipped(uid): { ok, reason?, equipped }`・`MAX_EQUIPPED_BADGES = 3`は全Taskで同一。`LeagueBadge`のprops（div/seasonLabel/equipped/slotNumber/isNew/onClick）とShelfの使用箇所は一致。
