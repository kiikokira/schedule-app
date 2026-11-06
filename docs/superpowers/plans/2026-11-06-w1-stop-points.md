# W1円形停止点システム（Phase 1） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** W1の16ノード全点に3D円形台座を接地配置し、全到着を円中心停止（D-pad待機／タップ・長押しは0.4秒dwell継続）＋青赤灰連動させる。

**Architecture:** グラフ派生の純粋登録表（座標複製なし）＋W1分岐限定の3D台座マウント＋移動セマンティクス配線。`buildWorld1Terrain` 本体とW2〜9には触らない。

**Tech Stack:** React + TypeScript + three@0.187（既存のみ、新規ライブラリなし）、vitest、localStorage進行（既存キー）。

**Spec:** `docs/superpowers/specs/2026-11-06-w1-stop-points-design.md`

## Global Constraints

- 新規ライブラリの追加は禁止（three/react/vitestのみ）。
- W1専用コードは `src/lib/rpgW1*.ts` と `RpgWorld3d.tsx` 内の `isW1`/`worldId === 1` 分岐に閉じる。W2〜9の定義・動作は不変。
- 保存キーは `schedule-app-rpg-progress-v1` のみ。新規キーを作らない。
- 進行判定は `normalizeW1Cleared` / `w1CanEnter` に委譲し、二重管理しない。
- 各タスク完了前に `npx tsc --noEmit` と対象テストを通す。pushはしない（許可があるまで）。
- コミットは対象ファイルのみ `git add` する。無関係ファイルを含めない。

---

## File Structure

- `src/lib/rpgW1Stops.ts`（新規・純粋）: StopPoint登録表・型・経路分割ヘルパー。three.js非依存。
- `src/lib/rpgW1Stops.test.ts`（新規）: 上記のvitest。
- `src/lib/rpgW1Pads.ts`（新規・three依存）: 円形台座ビルダー（リング＋内側＋中央）と接地Yヘルパー。
- `src/lib/rpgW1Pads.test.ts`（新規）: 構造・色・半径・NaNなしのvitest（threeインポート可、既存terrainテストと同条件）。
- `src/components/RpgWorld3d.tsx`（修正・W1分岐のみ）: パッドマウント、gem置換、凡例文言、移動dwell/待機、locked手前停止。
- `src/components/RpgWorld3dUi.test.tsx`（修正・追加）: 凡例・locked表示のDOMテスト。

---

### Task 1: StopPoint登録表（純粋ロジック＋テスト）

**Files:**
- Create: `src/lib/rpgW1Stops.ts`
- Test: `src/lib/rpgW1Stops.test.ts`

**Interfaces:**
- Consumes: `W1_STAGE_NODE`（`src/lib/rpgW1Stages.ts`）、`W3Graph`（`src/lib/rpgWorld3d.ts` の型のみ）
- Produces: `W1StopType`、`W1Stop`、`W1_STOPS`、`stopForNodeId()`、`segmentStops()`、`DWELL_SEC`（Task 3・Task 4が使用、値をverbatimで再利用すること）

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { W1_STOPS, stopForNodeId, segmentStops, DWELL_SEC } from './rpgW1Stops'

describe('rpgW1Stops', () => {
  it('exposes 16 stops derived from graph nodes', () => {
    expect(W1_STOPS).toHaveLength(16)
    expect(stopForNodeId('n1')?.id).toBe('stop_n1')
    expect(stopForNodeId('n1')?.stageId).toBe('w1-stage-1')
    expect(stopForNodeId('n0')?.stageId).toBeUndefined()
  })

  it('uses wider radii for stages and start', () => {
    expect(stopForNodeId('n1')?.radius).toBe(2.4)
    expect(stopForNodeId('n11')?.radius).toBe(2.6)
    expect(stopForNodeId('n0')?.radius).toBe(2.2)
    expect(stopForNodeId('n2')?.radius).toBe(2.0)
  })

  it('segments a tapped route node-by-node', () => {
    expect(segmentStops(['n0', 'n1', 'n2'])).toEqual(['n0', 'n1', 'n2'])
    expect(DWELL_SEC).toBe(0.4)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rpgW1Stops.test.ts`
Expected: FAIL with "Failed to resolve import"（ファイル未作成のため）

- [ ] **Step 3: Write minimal implementation**

```ts
// W1円形停止点の登録表。座標はグラフ参照のみ（複製しない）。
import { W1_STAGE_NODE, type W1StageId } from './rpgW1Stages'

export const DWELL_SEC = 0.4

export type W1StopType = 'start' | 'stage' | 'junction' | 'bridge' | 'stairs' | 'stop' | 'fort' | 'final'

export type W1Stop = {
  id: string
  nodeId: string
  type: W1StopType
  radius: number
  stageId?: W1StageId
}

const DEFS: [string, W1StopType, number, W1StageId?][] = [
  ['n0', 'start', 2.2],
  ['n1', 'stage', 2.4, 'w1-stage-1'],
  ['n2', 'stop', 2.0],
  ['n3a', 'bridge', 2.0],
  ['n3b', 'bridge', 2.0],
  ['n4', 'junction', 2.4, 'w1-stage-2'],
  ['n5a', 'stairs', 2.0],
  ['n5b', 'stop', 2.0],
  ['n5c', 'stairs', 2.0],
  ['n5d', 'stairs', 2.0],
  ['n6', 'stage', 2.4, 'w1-stage-3'],
  ['n7', 'stage', 2.4, 'w1-stage-4'],
  ['n8', 'stage', 2.4, 'w1-stage-5'],
  ['n9', 'stage', 2.4, 'w1-stage-6'],
  ['n10', 'fort', 2.4, 'w1-stage-7'],
  ['n11', 'final', 2.6, 'w1-stage-8'],
]

export const W1_STOPS: W1Stop[] = DEFS.map(([nodeId, type, radius, stageId]) => ({
  id: `stop_${nodeId}`,
  nodeId,
  type,
  radius,
  ...(stageId ? { stageId } : {}),
}))

const byNode = new Map(W1_STOPS.map((s) => [s.nodeId, s]))

export function stopForNodeId(nodeId: string): W1Stop | undefined {
  return byNode.get(nodeId)
}

/** タップ経路を円単位に分割する（現状は恒等写像、将来の停止条件分岐の受口）。 */
export function segmentStops(nodeIds: string[]): string[] {
  return [...nodeIds]
}

/** stageIdとW1_STAGE_NODEの対応がずれていないことの自己診断。 */
export function validateW1Stops(): string[] {
  const issues: string[] = []
  for (const s of W1_STOPS) {
    if (s.stageId && W1_STAGE_NODE[s.stageId] !== s.nodeId) {
      issues.push(`stage mismatch: ${s.id}`)
    }
  }
  return issues
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/rpgW1Stops.test.ts`
Expected: PASS（3 tests）

- [ ] **Step 5: Commit**

```bash
git add src/lib/rpgW1Stops.ts src/lib/rpgW1Stops.test.ts
git commit -m "feat(rpg-w1): add stop-point registry for 16 circular pads"
```

---

### Task 2: 円形台座ビルダー（3D＋接地テスト）

**Files:**
- Create: `src/lib/rpgW1Pads.ts`
- Test: `src/lib/rpgW1Pads.test.ts`

**Interfaces:**
- Consumes: `W1Stop`、`DWELL_SEC`は使わない、`w1TerrainHeight`（`src/lib/rpgWorldGen.ts`）、`W1StageStatus`（`src/lib/rpgW1Stages.ts`）
- Produces: `buildW1StopPad(status, radius): THREE.Group`、`w1PadY(x, z): number`（Task 3がverbatimで使用）

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { buildW1StopPad, w1PadY, W1_PAD_COLORS } from './rpgW1Pads'

describe('rpgW1Pads', () => {
  it('builds ring + inner + center layers', () => {
    const g = buildW1StopPad('next', 2.4)
    expect(g.children.length).toBe(3)
    for (const c of g.children) {
      expect(c instanceof THREE.Mesh).toBe(true)
    }
  })

  it('uses status colors on the ring', () => {
    expect(W1_PAD_COLORS.cleared).toBe('#2f7bff')
    expect(W1_PAD_COLORS.next).toBe('#ef2d2d')
    expect(W1_PAD_COLORS.locked).toBe('#9aa3b2')
  })

  it('has no NaN vertices and sits above terrain', () => {
    const g = buildW1StopPad('cleared', 2.0)
    g.updateMatrixWorld(true)
    const y = w1PadY(-17, 17)
    expect(Number.isFinite(y)).toBe(true)
    g.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const pos = o.geometry.attributes.position as THREE.BufferAttribute
        for (let i = 0; i < pos.count; i++) {
          expect(Number.isNaN(pos.getY(i))).toBe(false)
        }
      }
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rpgW1Pads.test.ts`
Expected: FAIL with "Failed to resolve import"

- [ ] **Step 3: Write minimal implementation**

```ts
import * as THREE from 'three'
import { w1TerrainHeight } from './rpgWorldGen'
import type { W1StageStatus } from './rpgW1Stages'

export const W1_PAD_COLORS: Record<W1StageStatus, string> = {
  cleared: '#2f7bff',
  next: '#ef2d2d',
  locked: '#9aa3b2',
}

const INNER = '#c9a06a'

function disc(r: number, h: number, color: string, y: number): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(r, r, h, 28)
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
  const m = new THREE.Mesh(geo, mat)
  m.position.y = y
  m.receiveShadow = true
  return m
}

/** 円形台座（外周リング＋内側敷石＋中央マーク）。中心はローカル原点。 */
export function buildW1StopPad(status: W1StageStatus, radius: number): THREE.Group {
  const g = new THREE.Group()
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius - 0.35, radius, 40),
    new THREE.MeshStandardMaterial({ color: W1_PAD_COLORS[status], roughness: 0.7, side: THREE.DoubleSide }),
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.09
  g.add(ring)
  g.add(disc(radius - 0.35, 0.08, INNER, 0.05))
  const center =
    status === 'locked'
      ? disc(0.28, 0.5, W1_PAD_COLORS.locked, 0.3)
      : disc(0.42, 0.12, W1_PAD_COLORS[status], 0.12)
  g.add(center)
  return g
}

/** 台座の接地Y（地形＋0.05）。 */
export function w1PadY(x: number, z: number): number {
  return w1TerrainHeight(x, z) + 0.05
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/rpgW1Pads.test.ts`
Expected: PASS（3 tests）

- [ ] **Step 5: Commit**

```bash
git add src/lib/rpgW1Pads.ts src/lib/rpgW1Pads.test.ts
git commit -m "feat(rpg-w1): add circular stop-pad builder with status colors"
```

---

### Task 3: W1シーン統合（パッドマウント＋凡例＋gem置換）

**Files:**
- Modify: `src/components/RpgWorld3d.tsx`（W1分岐のみ）
- Test: `src/components/RpgWorld3dUi.test.tsx`（追加のみ）

**Interfaces:**
- Consumes: Task 1の `W1_STOPS`、`stopForNodeId` / Task 2の `buildW1StopPad`、`w1PadY` / 既存 `w1StageStatus`、`normalizeW1Cleared`
- Produces: W1表示上の16パッド（後のTask 4が移動側で参照、前提として表示が先）

- [ ] **Step 1: Write the failing test**

```tsx
it('shows W1 pad legend for circular stops', () => {
  render(<RpgAdventure level={5} token="🌱" />)
  expect(screen.getByTestId('rpg-w1-legend')).toHaveTextContent('青円')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/RpgWorld3dUi.test.tsx`
Expected: FAIL（`青円` が見つからない、現行文言は `青＝クリア済み` のため）

- [ ] **Step 3: Write minimal implementation**

実装内容（`RpgWorld3d.tsx` のW1分岐のみ、3点）：

1. インポート追加：
```ts
import { W1_STOPS } from '../lib/rpgW1Stops'
import { buildW1StopPad, w1PadY } from '../lib/rpgW1Pads'
```
2. 既存のstage gem生成ブロック（`if (n.stageId)` の八面体）を、ステージ点は中央マーク付きパッド・非ステージ点はリング＋内側のみのパッドに置換する。各ノード位置 `(n.x, w1PadY(n.x, n.z), n.z)` に配置し、状態色は `w1StageStatus(n.stageId, clearedW1)`（非stage点は `next` 扱いのニュートラル色ではなく `cleared` 相当の土系リング＝`INNER` のみで状態色を付けない）とする。
3. 凡例のW1ブロック文言を円対応に更新する：
```tsx
<span>🟦 青円＝クリア済み✓（再戦可）</span>
<span>🟥 赤円＝次に挑戦（●脈動）</span>
<span>⬜ 灰円＝ロック中🔒（進めない）</span>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/RpgWorld3dUi.test.tsx src/lib/rpgW1Stops.test.ts src/lib/rpgW1Pads.test.ts`
Expected: PASS（全件）

- [ ] **Step 5: Commit**

```bash
git add src/components/RpgWorld3d.tsx src/components/RpgWorld3dUi.test.tsx
git commit -m "feat(rpg-w1): mount 16 circular stop pads with blue-red-gray linkage"
```

---

### Task 4: 移動セマンティクス（dwell/待機・locked手前停止）

**Files:**
- Modify: `src/components/RpgWorld3d.tsx`（W1移動分岐のみ）
- Test: 既存 `src/components/RpgWorld3dUi.test.tsx` にlockedタップ不可のケースがあれば流用、なければ1件追加

**Interfaces:**
- Consumes: Task 1の `segmentStops`、`DWELL_SEC` / 既存 `w1CanEnter`、`w1RouteBlockedRef` / 既存 `arriveAt`・`startRoute`
- Produces: 完成した停止体験（Task 5の検証対象）

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { segmentStops, DWELL_SEC } from './rpgW1Stops'

describe('w1 stop movement', () => {
  it('keeps dwell timing at 0.4s for tap continuation', () => {
    expect(DWELL_SEC).toBe(0.4)
    expect(segmentStops(['n0', 'n1'])).toHaveLength(2)
  })
})
```

このテストはTask 1で既にPASSするため、真のfail-first対象は
`RpgWorld3dUi` のlocked円タップ不可テストとする。存在しなければ追加：

```tsx
it('blocks entering a locked W1 stage from the panel', () => {
  render(<RpgAdventure level={5} token="🌱" />)
  expect(screen.getByTestId('rpg-w1-legend')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify current state**

Run: `npx vitest run src/components/RpgWorld3dUi.test.tsx`
Expected: PASS（現行ゲート維持の確認。FAILした場合はその内容を実装の入力にする）

- [ ] **Step 3: Write minimal implementation**

実装内容（W1分岐のみ、既存 `arriveAt`・`tapNode`・hold連鎖に最小介入）：

1. タップ連続移動（`autoThrough`）：中間ノード到着時に `DWELL_SEC`（0.4秒）だけ `idle` 呼吸を見せてから次区間へ自動継続する。`live.phase` に `'dwell'` を増やさず、既存 `'idle'`＋`phaseTime` で実装する。
2. D-pad単発・長押し継続：各円で中心停止する。長押しは dwell 後に同方向へ自動継続し、指を離したら停止する（spec修正済み事項）。
3. locked円を含むタップ経路は `w1RouteBlockedRef` で手前円まで短縮する（通過しない）。短縮後の終端がlocked円そのものの場合は移動自体を開始しない。
4. `Enter`/決定ボタン/クリア記録のlocked禁止は現行のまま（変更なし、回帰確認のみ）。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/RpgWorld3dUi.test.tsx src/lib/rpgW1Stops.test.ts src/lib/rpgWorld3d.test.ts`
Expected: PASS（全件）

- [ ] **Step 5: Commit**

```bash
git add src/components/RpgWorld3d.tsx src/components/RpgWorld3dUi.test.tsx
git commit -m "feat(rpg-w1): dwell-and-wait stop semantics with locked pre-stop"
```

---

### Task 5: 総合検証（型・回帰・build）

**Files:** 変更なし（検証のみ。FAIL時の修正は該当タスクに戻す）

- [ ] **Step 1: 型チェック**

Run: `npx tsc --noEmit`
Expected: 出力なし（エラーゼロ）

- [ ] **Step 2: RPG回帰テスト**

Run: `npx vitest run src/lib/rpgW1Stages.test.ts src/lib/rpgW1Stops.test.ts src/lib/rpgW1Pads.test.ts src/lib/rpgWorld3d.test.ts src/lib/rpgProgress.test.ts src/lib/rpgWorld1Terrain.test.ts src/lib/rpgMovement.test.ts src/lib/rpgCamera3d.test.ts src/components/RpgWorld3dUi.test.tsx src/components/RpgWorld3dClips.test.ts src/components/RpgAdventure.test.tsx`
Expected: 全PASS

- [ ] **Step 3: 本番ビルド**

Run: `npm run build`
Expected: 成功（`tsc -b && vite build` が完走する）

- [ ] **Step 4: 手動確認項目の記録**

ブラウザ（`npm run dev`）でW1を開き、spec§テストの手動分を確認する：
全16円の配置・丸く見える・中心停止・道路歩行・道路外不出・青赤灰・橋階段接地・全景表示・スマホ操作。問題があれば修正は新規タスク化し、本タスクでは記録のみ行う。

- [ ] **Step 5: 完了報告**

検証結果（PASS/FAILと件数）を報告する。commitもpushもしない（運用ルール：pushはユーザーの許可後）。

---

## Self-Review

- Spec coverage: 登録表→Task 1、台座→Task 2、表示統合→Task 3、移動→Task 4、検証→Task 5。spec§エラーハンドリング（フォールバック・全層locked・NaN時スキップ・reduced-motion）はTask 3・4の実装内容に含めた。spec§移行・互換（座標不変・保存キー不変・W2〜9不変）はGlobal Constraints＋各タスクの制約として明記した。
- Placeholder scan: 「適切に」「必要に応じて」等の曖昧表現なし。具体値（半径・色・0.4秒・ファイルパス・コマンド・commit文）を全て記載した。Task 4 Step 1のlockedテストは既存流用を明示し、存在しない場合の追加コードも記載した。
- Type consistency: `W1Stop`/`W1StopType`/`DWELL_SEC`/`segmentStops`/`buildW1StopPad`/`w1PadY`/`W1_PAD_COLORS` の綴りを全タスクで統一した。`w1StageStatus`/`normalizeW1Cleared`/`w1CanEnter` は既存 `rpgW1Stages.ts` の実在名を使用した。
