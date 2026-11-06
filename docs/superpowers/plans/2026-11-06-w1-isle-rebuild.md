# W1浮遊島フルリビルド Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 画像準拠の自然形浮遊島にW1を一から作り直し、青黄/赤黄/黒黄＋先道半透明で進行が分かる固定視点W1にする

**Architecture:** Blenderで自然形2段テラス島を新規生成してGLB化し、`world1_v3_graph.json`を単一座標源にランタイム（Stops/Pads/カメラ/UI）を順に置換する。TS地形は廃止ではなく参照切替で残置する

**Tech Stack:** React 18 + Vite 5 + TS + Vitest + three 0.187 + Blender 4.x (background `--background --python`) + Kenney Nature Kit GLB

**Spec:** `docs/superpowers/specs/2026-11-06-w1-isle-rebuild-design.md` — the plan argues from the spec, so the spec travels with it; executors read both

## Global Constraints

- W2〜W9の定義・表示・動作は不変とする（`WORLD3D_CONFIG`の2〜9、`world2_graph.json`〜`world9_graph.json`に触れない）
- 新規ライブラリ追加なし（three 0.187・Blender同梱bpy/bmeshのみ）
- テクスチャは1K以下、GLBは2MB以下目標、Dracoなし
- 1世界1アートスタイル（リアル系PBRとKenney混植なし、W1はKenney＋オリジナル低ポリのみ）
- 保存キーは`schedule-app-rpg-progress-v2`新設、旧v1は初回のみ吸収移行
- カメラはW1のみ斜め俯瞰固定（ドラッグ旋回・ピンチ拡縮はW1で無効、追従＋全体表示は維持）
- 台座色は青黄/赤黄/黒黄の3状態＋先道半透明とし、色＋形＋透過の3重表現を維持する
- `npm run build`成功が必須、対象別`vitest run`でPASSすること

---

## File Structure

- Create: `public/rpg/world1_v3_graph.json` — 新16ノード/17パス前後の画像準拠グラフ（yはBlender Hから焼き付け）
- Create: `scripts/blender/build_world1_isle.py` — 自然形浮遊島生成・GLB出力・graph検証・Cycles撮影
- Create: `src/lib/rpgW1Visual.ts` — 4状態型＋黄環色＋半透明判定の純粋関数（Pads/StopsとRpgWorld3dの共有源）
- Create: `src/lib/rpgW1Visual.test.ts` — 4状態・黄環・先道半透明の純粋テスト
- Create: `src/lib/rpgProgressV2.ts` + `src/lib/rpgProgressV2.test.ts` — v2キー・旧v1吸収移行
- Modify: `src/lib/rpgW1Stages.ts` — タイトル8件を新島地名に更新（IDは`w1-stage-1..8`維持）
- Modify: `src/lib/rpgW1Stops.ts` — 新v3ノードID対応・半径・stage対応の更新
- Modify: `src/lib/rpgW1Pads.ts` — 黄外環＋黒状態＋中央マーク3色化
- Modify: `src/components/RpgWorld3d.tsx` — W1のみ新GLB/graph参照・固定カメラ・先道半透明・凡例更新
- Modify: `public/rpg/world1_isle.glb` + `public/rpg/thumb-w1.jpg` — 生成物（Blender出力）
- Keep (no touch): `public/rpg/world1_v2_graph.json`, `public/rpg/world1_graph.json`, `src/lib/rpgWorld1Terrain.ts`（フォールバック残置、参照のみ切替）

**Interfaces:**
- Consumes: `W3Graph` (`src/lib/rpgWorld3d.ts:23`), `W1_STAGE_ORDER/W1_STAGE_NODE` (`src/lib/rpgW1Stages.ts:6-28`), `W1_STOPS` (`src/lib/rpgW1Stops.ts:35`)
- Produces: `W1VisualStatus = 'cleared' | 'next' | 'future'` (`src/lib/rpgW1Visual.ts`), `w1VisualFor(cleared, stageId)` → status, `isBeyondNext(pathFrom, pathTo, nextNodeId)` → boolean, `RPG_PROGRESS_V2_KEY = 'schedule-app-rpg-progress-v2'`, `migrateV1toV2(v1: RpgProgressState)` → v2 state

---

### Task 1: v3グラフ＋ステージ地名＋Stops登録更新

**Files:**
- Create: `public/rpg/world1_v3_graph.json`
- Modify: `src/lib/rpgW1Stages.ts:30-39`
- Modify: `src/lib/rpgW1Stops.ts:16-33`
- Test: `src/lib/rpgW1Stops.test.ts` (extend, no new file)

**Interfaces:**
- Consumes: `W1_STAGE_ORDER`, `W1_STAGE_NODE` (existing IDs kept)
- Produces: v3 node ids `n0..n11` reused (coords changed only), `W1_STAGE_NODE` mapping unchanged in keys, titles updated

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/rpgW1Stops.test.ts に追加
import { W1_STOPS } from './rpgW1Stops'
import { W1_STAGE_ORDER } from './rpgW1Stages'
it('v3 has 16 stops with stage linkage intact', () => {
  expect(W1_STOPS).toHaveLength(16)
  const stageStops = W1_STOPS.filter((s) => s.stageId)
  expect(stageStops.map((s) => s.stageId)).toEqual([...W1_STAGE_ORDER])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rpgW1Stops.test.ts -t "v3 has 16"`
Expected: FAIL（現行タイトル・旧座標のままなので新graph未参照で失敗扱い、または新graph欠落で後続接地テストが失敗）

- [ ] **Step 3: Write v3 graph JSON**

```json
{
  "nodes": [
    { "id": "n0", "x": -20, "z": 16, "y": 3.1 },
    { "id": "n1", "x": -14, "z": 14, "y": 3.3, "stage": "w1-stage-1", "kind": "stage" },
    { "id": "n2", "x": -9, "z": 10, "y": 3.7 },
    { "id": "n3a", "x": -6, "z": 6, "y": 4.9 },
    { "id": "n3b", "x": 2, "z": 3, "y": 5.4 },
    { "id": "n4", "x": 7, "z": 0, "y": 6.0, "stage": "w1-stage-2", "kind": "stage" },
    { "id": "n5a", "x": 9, "z": -6, "y": 8.0 },
    { "id": "n5b", "x": 8, "z": -13, "y": 9.1 },
    { "id": "n5c", "x": 12, "z": -2, "y": 5.2, "kind": "ladder_bottom" },
    { "id": "n5d", "x": 11, "z": -9, "y": 10.0, "kind": "ladder_top" },
    { "id": "n6", "x": 6, "z": -17, "y": 6.3, "stage": "w1-stage-3", "kind": "stage" },
    { "id": "n7", "x": 11, "z": -19, "y": 4.4, "stage": "w1-stage-4", "kind": "stage" },
    { "id": "n8", "x": 15, "z": -18, "y": 2.9, "stage": "w1-stage-5", "kind": "stage" },
    { "id": "n9", "x": 10, "z": -23, "y": 3.2, "stage": "w1-stage-6", "kind": "stage" },
    { "id": "n10", "x": 2, "z": -24, "y": 3.5, "stage": "w1-stage-7", "kind": "stage" },
    { "id": "n11", "x": -7, "z": -22, "y": 3.1, "stage": "w1-stage-8", "kind": "stage" }
  ],
  "paths": [
    { "id": "p0", "from": "n0", "to": "n1", "kind": "walk", "speed": 2.2 },
    { "id": "p1", "from": "n1", "to": "n2", "kind": "walk", "speed": 2.2 },
    { "id": "p2", "from": "n2", "to": "n3a", "kind": "walk", "speed": 2.2 },
    { "id": "p3", "from": "n3a", "to": "n3b", "kind": "bridge", "speed": 2, "arcHeight": 0.65 },
    { "id": "p4", "from": "n3b", "to": "n4", "kind": "walk", "speed": 2.2 },
    { "id": "p5", "from": "n4", "to": "n5a", "kind": "walk", "speed": 2.2 },
    { "id": "p6", "from": "n5a", "to": "n5b", "kind": "stairs_up", "speed": 1.3 },
    { "id": "p7", "from": "n4", "to": "n5c", "kind": "walk", "speed": 2.2 },
    { "id": "p8", "from": "n5c", "to": "n5d", "kind": "ladder_up", "speed": 1 },
    { "id": "p9", "from": "n5d", "to": "n6", "kind": "walk", "speed": 2.2 },
    { "id": "p10", "from": "n5b", "to": "n6", "kind": "walk", "speed": 2.2 },
    { "id": "p11", "from": "n6", "to": "n7", "kind": "run", "speed": 3.6 },
    { "id": "p12", "from": "n7", "to": "n8", "kind": "jump", "speed": 3.2, "oneWay": true, "jumpHeight": 1.6 },
    { "id": "p13", "from": "n8", "to": "n9", "kind": "slope_down", "speed": 1.8 },
    { "id": "p14", "from": "n9", "to": "n10", "kind": "walk", "speed": 2.2 },
    { "id": "p15", "from": "n10", "to": "n11", "kind": "walk", "speed": 2.2 },
    { "id": "p16", "from": "n5b", "to": "n5d", "kind": "walk", "speed": 2.2 }
  ]
}
```

- [ ] **Step 4: Write minimal implementation (stages titles)**

```ts
// src/lib/rpgW1Stages.ts:30-39 を置換
export const W1_STAGE_TITLES: Record<W1StageId, string> = {
  'w1-stage-1': '村入口の広場',
  'w1-stage-2': '井戸の丘',
  'w1-stage-3': '石橋のたもと',
  'w1-stage-4': '上段牧場',
  'w1-stage-5': '守護像の丘',
  'w1-stage-6': '滝裏の道',
  'w1-stage-7': '赤橋のたもと',
  'w1-stage-8': '桟橋の守護',
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/rpgW1Stops.test.ts src/lib/rpgW1Stages.test.ts`
Expected: PASS（16点・ID規則・stage対応）

- [ ] **Step 6: Commit**

```bash
git add public/rpg/world1_v3_graph.json src/lib/rpgW1Stages.ts src/lib/rpgW1Stops.test.ts
git commit -m "feat(rpg-w1): v3 graph skeleton with new island titles"
```

---

### Task 2: 進行v2＋旧セーブ吸収移行

**Files:**
- Create: `src/lib/rpgProgressV2.ts`
- Create: `src/lib/rpgProgressV2.test.ts`
- Modify: none (wiring is Task 6)

**Interfaces:**
- Consumes: `RpgProgressState` from `src/lib/rpgProgress.ts:5-15`, `normalizeW1Cleared` from `src/lib/rpgW1Stages.ts:66`
- Produces: `RPG_PROGRESS_V2_KEY = 'schedule-app-rpg-progress-v2'`, `migrateV1toV2(v1: RpgProgressState): RpgProgressState`, `loadRpgProgressV2(): RpgProgressState`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/rpgProgressV2.test.ts
import { describe, it, expect } from 'vitest'
import { migrateV1toV2, RPG_PROGRESS_V2_KEY } from './rpgProgressV2'
import { DEFAULT_RPG_PROGRESS } from './rpgProgress'
describe('rpgProgressV2', () => {
  it('migrates v1 cleared stages and resets node to v3 start', () => {
    const v1 = { ...DEFAULT_RPG_PROGRESS, clearedStageIds: ['w1-stage-1', 'grass-stage-1'], lastKnownNodeId: { '3d-1': 'n5b' } }
    const v2 = migrateV1toV2(v1)
    expect(RPG_PROGRESS_V2_KEY).toBe('schedule-app-rpg-progress-v2')
    expect(v2.clearedStageIds).toContain('w1-stage-1')
    expect(v2.lastKnownNodeId['3d-1']).toBe('n0')
  })
  it('corrupt v1 falls back to defaults', () => {
    const v2 = migrateV1toV2(null as unknown as never)
    expect(v2.clearedStageIds).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rpgProgressV2.test.ts`
Expected: FAIL with "Cannot find module './rpgProgressV2'"

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/rpgProgressV2.ts
import { DEFAULT_RPG_PROGRESS, type RpgProgressState } from './rpgProgress'
import { normalizeW1Cleared } from './rpgW1Stages'
export const RPG_PROGRESS_V2_KEY = 'schedule-app-rpg-progress-v2'
export const RPG_PROGRESS_V2_BACKUP_KEY = 'schedule-app-rpg-progress-v2.bak'
export function migrateV1toV2(v1: unknown): RpgProgressState {
  if (v1 == null || typeof v1 !== 'object') return { ...DEFAULT_RPG_PROGRESS, lastKnownNodeId: { ...DEFAULT_RPG_PROGRESS.lastKnownNodeId, '3d-1': 'n0' } }
  const o = v1 as RpgProgressState
  const cleared = normalizeW1Cleared([...(o.clearedStageIds ?? [])])
  return {
    ...DEFAULT_RPG_PROGRESS,
    currentWorldId: 1,
    clearedStageIds: [...cleared],
    unlockedStageIds: [...DEFAULT_RPG_PROGRESS.unlockedStageIds],
    unlockedPathIds: [...DEFAULT_RPG_PROGRESS.unlockedPathIds],
    lastKnownNodeId: { ...(o.lastKnownNodeId ?? {}), '3d-1': 'n0' },
    settings: { reducedMotion: false },
  }
}
export function loadRpgProgressV2(): RpgProgressState {
  try {
    const raw = localStorage.getItem(RPG_PROGRESS_V2_KEY)
    if (raw) return { ...DEFAULT_RPG_PROGRESS, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  try {
    const old = localStorage.getItem('schedule-app-rpg-progress-v1')
    if (old) {
      const v2 = migrateV1toV2(JSON.parse(old))
      try { localStorage.setItem(RPG_PROGRESS_V2_KEY, JSON.stringify(v2)) } catch { /* ignore */ }
      return v2
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_RPG_PROGRESS, lastKnownNodeId: { ...DEFAULT_RPG_PROGRESS.lastKnownNodeId, '3d-1': 'n0' } }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/rpgProgressV2.test.ts`
Expected: PASS (2/2)

- [ ] **Step 5: Commit**

```bash
git add src/lib/rpgProgressV2.ts src/lib/rpgProgressV2.test.ts
git commit -m "feat(rpg-w1): progress v2 key with v1 migration"
```

---

### Task 3: 4状態台座（青黄/赤黄/黒黄＋黄外環）

**Files:**
- Create: `src/lib/rpgW1Visual.ts`
- Create: `src/lib/rpgW1Visual.test.ts`
- Modify: `src/lib/rpgW1Pads.ts:1-44`
- Test: `src/lib/rpgW1Visual.test.ts`

**Interfaces:**
- Consumes: `w1StageStatus`, `w1NextStage`, `normalizeW1Cleared` from `src/lib/rpgW1Stages.ts`
- Produces: `export type W1VisualStatus = 'cleared' | 'next' | 'future'`, `export const W1_YELLOW_RING = '#ffd233'`, `export function w1VisualFor(stageId | undefined, cleared): W1VisualStatus`, `export function isPathBeyondNext(fromId, toId, cleared): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/rpgW1Visual.test.ts
import { describe, it, expect } from 'vitest'
import { w1VisualFor, isPathBeyondNext, W1_YELLOW_RING } from './rpgW1Visual'
describe('rpgW1Visual', () => {
  it('maps cleared/next/future correctly', () => {
    expect(w1VisualFor('w1-stage-1', ['w1-stage-1'])).toBe('cleared')
    expect(w1VisualFor('w1-stage-2', ['w1-stage-1'])).toBe('next')
    expect(w1VisualFor('w1-stage-3', ['w1-stage-1'])).toBe('future')
  })
  it('non-stage nodes are cleared (no yellow dims)', () => {
    expect(w1VisualFor(undefined, [])).toBe('cleared')
  })
  it('yellow ring constant exists', () => {
    expect(W1_YELLOW_RING).toBe('#ffd233')
  })
  it('paths beyond next are marked translucent', () => {
    expect(isPathBeyondNext('n6', 'n7', ['w1-stage-1'])).toBe(true)
    expect(isPathBeyondNext('n0', 'n1', [])).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rpgW1Visual.test.ts`
Expected: FAIL with "Cannot find module './rpgW1Visual'"

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/rpgW1Visual.ts
import { w1StageStatus, w1NextStage, normalizeW1Cleared, W1_STAGE_NODE, type W1StageId } from './rpgW1Stages'
export type W1VisualStatus = 'cleared' | 'next' | 'future'
export const W1_YELLOW_RING = '#ffd233'
export const W1_FUTURE_CENTER = '#20242c'
export function w1VisualFor(stageId: string | undefined, cleared: readonly string[]): W1VisualStatus {
  if (!stageId) return 'cleared'
  const s = w1StageStatus(stageId, cleared)
  if (s === 'cleared') return 'cleared'
  if (s === 'next') return 'next'
  return 'future'
}
export function isPathBeyondNext(fromId: string, toId: string, cleared: readonly string[]): boolean {
  const norm = normalizeW1Cleared([...cleared])
  const next = w1NextStage(norm)
  if (!next) return false
  const nextNode = (W1_STAGE_NODE as Record<string, string>)[next as W1StageId]
  const order = ['n0','n1','n2','n3a','n3b','n4','n5a','n5b','n5c','n5d','n6','n7','n8','n9','n10','n11']
  const ni = order.indexOf(nextNode)
  const fi = order.indexOf(fromId)
  const ti = order.indexOf(toId)
  return Math.min(fi, ti) >= ni
}
```

- [ ] **Step 4: Update pads to 3-layer with yellow ring**

```ts
// src/lib/rpgW1Pads.ts に追加（buildW1StopPad を拡張）
import { W1_YELLOW_RING, W1_FUTURE_CENTER, type W1VisualStatus } from './rpgW1Visual'
// W1_PAD_COLORS は残し、future 用に '#20242c' を追加:
export const W1_PAD_COLORS_EXT: Record<W1VisualStatus, string> = {
  cleared: '#2f7bff',
  next: '#ef2d2d',
  future: '#20242c',
}
// buildW1StopPad(status: W1StageStatus...) は残し、新関数を追加:
export function buildW1StopPadV3(status: W1VisualStatus, radius: number): THREE.Group {
  const g = buildW1StopPad(status === 'future' ? 'locked' : status, radius)
  const outer = new THREE.Mesh(
    new THREE.RingGeometry(radius, radius + 0.28, 48),
    new THREE.MeshStandardMaterial({ color: W1_YELLOW_RING, roughness: 0.6, side: THREE.DoubleSide }),
  )
  outer.rotation.x = -Math.PI / 2
  outer.position.y = 0.09
  g.add(outer)
  if (status === 'future') {
    for (const m of g.children) {
      if (m instanceof THREE.Mesh && m.material instanceof THREE.MeshStandardMaterial) {
        if (m.material.color.getStyle() === 'rgb(154,163,178)') m.material.color.set(W1_FUTURE_CENTER)
      }
    }
  }
  return g
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/rpgW1Visual.test.ts src/lib/rpgW1Pads.test.ts src/lib/rpgW1Stops.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/rpgW1Visual.ts src/lib/rpgW1Visual.test.ts src/lib/rpgW1Pads.ts
git commit -m "feat(rpg-w1): 4-state pads with yellow rings"
```

---

### Task 4: W1固定カメラ＋凡例・先道半透明

**Files:**
- Modify: `src/components/RpgWorld3d.tsx:750-780, 1115-1130, 1290-1300`
- Modify: `src/components/RpgWorld3dUi.test.tsx` (legend test extend)
- Test: `src/lib/rpgCamera3d.test.ts` (existing fixed-view helper check)

**Interfaces:**
- Consumes: `w1VisualFor`, `isPathBeyondNext` from Task 3, `orbitView`, `TAP_MAX_MOVE_PX` from `src/lib/rpgCamera3d.ts:18`
- Produces: W1 `live.orbit` locked, road material opacity 0.35 beyond next, legend copy updated

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/RpgWorld3dUi.test.tsx に追加
it('shows yellow-ring legend for W1 v3', () => {
  render(<RpgWorld3d worldId={1} />)
  expect(screen.getByTestId('w1-legend')).toHaveTextContent('青黄')
  expect(screen.getByTestId('w1-legend')).toHaveTextContent('赤黄')
  expect(screen.getByTestId('w1-legend')).toHaveTextContent('黒黄')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/RpgWorld3dUi.test.tsx -t "yellow-ring"`
Expected: FAIL with "Unable to find testid w1-legend"

- [ ] **Step 3: Write minimal implementation (W1 orbit lock)**

```tsx
// src/components/RpgWorld3d.tsx pointer handlers付近
const isW1Fixed = worldId === 1
const onPointerMove = (dx: number, dy: number) => {
  if (isW1Fixed) return // W1は固定視点：ドラッグ旋回無効
  const yaw = live.orbit.yaw - dx * 0.0055
  live.orbit.yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw))
}
// pinch/wheel も同様に isW1Fixed なら return
// 道路半透明（既存islandグループ走査で透過付与）:
import { isPathBeyondNext } from '../lib/rpgW1Visual'
island.traverse((o) => {
  const pid = (o.userData as { pathId?: string }).pathId
  if (!pid || worldId !== 1) return
  const p = graph.paths.find((q) => q.id === pid)
  if (!p) return
  if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
    if (isPathBeyondNext(p.from, p.to, w1Cleared)) {
      o.material.transparent = true
      o.material.opacity = 0.35
    }
  }
})
```

- [ ] **Step 4: Update legend copy**

```tsx
// RpgWorld3d.tsx W1凡例分岐
{isW1 && <div data-testid="w1-legend">青黄クリア・赤黄つぎ・黒黄この先・先道は半透明</div>}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/RpgWorld3dUi.test.tsx src/lib/rpgCamera3d.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/RpgWorld3d.tsx src/components/RpgWorld3dUi.test.tsx
git commit -m "feat(rpg-w1): fixed camera with translucent future roads"
```

---

### Task 5: Blender自然形浮遊島生成（土台→道→川→建物）

**Files:**
- Create: `scripts/blender/build_world1_isle.py`
- Create: `public/rpg/world1_isle.glb` (generated)
- Create: `public/rpg/thumb-w1.jpg` (regenerated)
- Modify: `public/rpg/world1_v3_graph.json` (y焼き付け更新のみ)
- Test: script内assert＋`npx vitest run src/lib/rpgWorld1Terrain.test.ts`相当の接地テストはTask 6

**Interfaces:**
- Consumes: `scripts/blender/wkit.py` (`fresh_scene`, `ribbon`, `build_island`, `import_glb`, `write_graph`, `export_verify`), Kenney `Models/GLTF format/*.glb`, v3 graph xz
- Produces: `world1_isle.glb` (>=300KB, >=40 meshes), `world1_v3_graph.json` (y filled), Cycles thumb 640x360

- [ ] **Step 1: Write the failing check (dry-run assert)**

Run: `blender --background --python scripts/blender/build_world1_isle.py -- --dry-run`
Expected: FAIL with "FileNotFoundError: public/rpg/world1_isle.glb not found"（未生成のため）

- [ ] **Step 2: Write minimal script skeleton**

```python
# scripts/blender/build_world1_isle.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
import wkit, math
PROJ = r"C:\anki\スケジュール管理アプリ"
OUT_GLB = PROJ + r"\public\rpg\world1_isle.glb"
OUT_GRAPH = PROJ + r"\public\rpg\world1_v3_graph.json"
def H(x, z):
    r = math.hypot(x, z)
    base = 6.0 * max(0.0, 1 - (r / 34) ** 2) - 4.0 * wkit.sstep(30, 40, r)
    upper = 4.2 * math.exp(-((x - 4) ** 2 + (z - 8) ** 2) / 90)
    return base + upper
wkit.fresh_scene("W1I", sky=(0.55, 0.80, 1.0))
```

- [ ] **Step 3: Implement full island (append to same file)**

```python
# 土台：自然形2段テラス（上段北・下段南、幾何形なし・有機海岸線）
# - 上段 top_y=6.2 r_top=13 r_bot=5 thick=7 at (2, 6)
# - 下段 top_y=3.1 r_top=17 r_bot=7 thick=6 at (-2, -12)
# - 崖材は横縞 rock、上面は grass tint
# 道：v3 waypointsで wkit.ribbon(H, ..., width=1.4, lift=0.06)
# 川：洞窟(-6,8)→(2,0)→(-2,-10)→海(-4,-24)、bed=-1.7、滝は白泡box
# 橋：stone arch 1＋red wood 2 を wkit.fit_bridge で両端接地
# 建物：hobbit 3・well 1・statue・hay・fence・trees を import_glb＋scatter（道2m・川2m退避）
# graph y を H(x,z)+0.05 で焼き直し、write_graph、export_verify(out, ['Grass'])
```

- [ ] **Step 4: Run build to verify it passes**

Run: `blender --background --python scripts/blender/build_world1_isle.py`
Expected: `BUILD_OK bytes=... meshes>=40`＋`world1_v3_graph.json`更新、Cycles thumb保存

- [ ] **Step 5: Commit generated graph + script (GLBはLFSなしでもadd)**

```bash
git add scripts/blender/build_world1_isle.py public/rpg/world1_v3_graph.json public/rpg/world1_isle.glb
git commit -m "feat(rpg-w1): blender natural floating island with bridges"
```

---

### Task 6: ランタイムW1配線＋接地検証＋回帰

**Files:**
- Modify: `src/components/RpgWorld3d.tsx:82-93` (W1 config → isle GLB/graph)
- Modify: `src/lib/rpgWorld1Terrain.test.ts` (v3接地条件追加)
- Test: `src/lib/rpgWorld1Terrain.test.ts`, `src/lib/rpgW1Stops.test.ts`, `src/lib/rpgW1Visual.test.ts`, `src/lib/rpgProgressV2.test.ts`, `src/components/RpgWorld3dUi.test.tsx`

**Interfaces:**
- Consumes: all Tasks 1-5 outputs
- Produces: W1 playable with fixed camera, 16 pads grounded, no road-outside walking

- [ ] **Step 1: Write the failing grounding test**

```ts
// src/lib/rpgWorld1Terrain.test.ts に追加
import v3 from '../../public/rpg/world1_v3_graph.json'
import { w1TerrainHeight } from './rpgWorldGen'
it('v3 all nodes sit on terrain (no burial/float)', () => {
  for (const n of (v3 as { nodes: { id: string; x: number; y: number; z: number }[] }).nodes) {
    const h = w1TerrainHeight(n.x, n.z)
    expect(Math.abs(n.y - (h + 0.05))).toBeLessThan(0.6)
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rpgWorld1Terrain.test.ts -t "v3 all nodes"`
Expected: FAIL（旧Hとv3 yの差が0.6超過、またはgraph未更新）

- [ ] **Step 3: Write minimal wiring**

```tsx
// src/components/RpgWorld3d.tsx WORLD3D_CONFIG[1] を置換
1: {
  glb: `${BASE}rpg/world1_isle.glb`,
  graph: `${BASE}rpg/world1_v3_graph.json`,
  fallbackGraph: `${BASE}rpg/world1_graph.json`,
  title: 'ワールド1・浮遊島の冒険',
  progressKey: '3d-1',
  nodeLabels: N('はじまりの門','村入口の広場','西の道','橋のたもと','橋のむこう','井戸の丘','階段下','丘の上','はしご下','はしご上','石橋のたもと','上段牧場','守護像の丘','滝裏の道','赤橋のたもと','桟橋の守護'),
  stageTitles: { ...(W1_STAGE_TITLES as Record<string, string>) },
  stageOrder: [...W1_STAGE_ORDER],
  sky: { bg: '#8fc7f5', horizon: '#d8efff', top: '#4f9df0', fog: '#cfe4f5' },
},
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/rpgW1Stops.test.ts src/lib/rpgW1Visual.test.ts src/lib/rpgProgressV2.test.ts src/lib/rpgWorld1Terrain.test.ts src/components/RpgWorld3dUi.test.tsx`
Expected: PASS

- [ ] **Step 5: Add error guards (GLB missing + NaN + reduced-motion)**

```tsx
// src/components/RpgWorld3d.tsx W1分岐先頭
if (worldId === 1 && glbError) return <div data-testid="w1-missing">ワールド1を読めませんでした</div>
// 台座生成ループ内
if (!Number.isFinite(n.x) || !Number.isFinite(n.y) || !Number.isFinite(n.z)) continue
// 黄環パルスは reduced-motion 時無効
const pulse = progress.settings.reducedMotion ? 0 : Math.sin(t * 3) * 0.06
outer.scale.setScalar(1 + pulse)
```

- [ ] **Step 6: Run build to verify it passes**

Run: `npm run build`
Expected: success (`tsc -b && vite build`)

- [ ] **Step 7: Commit**

```bash
git add src/components/RpgWorld3d.tsx src/lib/rpgWorld1Terrain.test.ts
git commit -m "feat(rpg-w1): wire isle GLB with fixed view"
```

