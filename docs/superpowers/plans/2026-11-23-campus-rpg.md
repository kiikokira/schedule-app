# Campus RPG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 歩けるSFCキャンパス（worldId 10）を追加し、今日の枠4件を看板クエストとしてToday/Bookへ飛ばす。

**Architecture:** 既存W3グラフ・stage・adapter・カメラを流用し、campusは純粋ビューとして追加する。独自EXP加算なし、未解放は減光ブロック、掲示板は固定文、建物はプレースホルダー納品。

**Tech Stack:** React 18 + Vite 5 + TypeScript 5.5 + three 0.187 + Dexie既存store + vitest

**Spec:** docs/superpowers/specs/2026-11-23-campus-rpg-design.md

## Global Constraints

- campus独自EXP加算はしない。`seasonStore`と`rpgProgressV2`/recordsを唯一の原資とし、campusは純粋ビュー＋解放表示に留める。二重計上禁止。
- 未解放ノードは見学可だが立ち入り不可（減光＋解放条件表示、移動ブロック）。
- 歩き方はノードをタップ→自動で進む。自由移動スティックは作らない。
- 建物はKenney Nature Kit＋箱合成のローポリ。Poly Haven/ambientCGリアル系PBR混入禁止。
- GLB優先、テクスチャ1K/2K、8K禁止。GLB合計<8MB目安、モバイル30fps目標、重い場合はoverview優先・影OFF。
- graphは`validateWorld3dGraph`が通ること。`normalizeW3Graph`形式（stage→stageId）に準拠。
- `npm run build`成功必須。対象ファイルのみ`git add`し`main`へプッシュ前提（AGENTS.md）。
- 自動配置で本番アセットを置かない。Blender確認前の本番化はしない。

## Review Focus

- 不正なcampusグラフは`validateWorld3dGraph`で検出され、build前に弾かれる → Task 1のgraph検証テストで固定。
- 今日の枠ゼロ・全完了・5件以上のとき看板が崩れず、規定の遷移（自習/祝い/先頭4件）になる → Task 3のテストで固定。
- 未解放タップで移動せず、解放条件だけ表示される → Task 2のテストで固定。
- 旧セーブ（grass-stage-*混在）がcampus追加後も壊れず、既存stageが従来通り動く → Task 2のテストで固定。
- プレースホルダーGLB参照で合計<8MBを保ち、モバイルでもDOM看板は操作可能 → Task 4のサイズ確認＋Task 3のDOMテストで固定。

---

### Task 1: Campusグラフ＋ドメイン

**Files:**
- Create: `public/rpg/campus_graph.json`
- Create: `src/lib/rpgCampus.ts`
- Test: `src/lib/rpgCampus.test.ts`

**Interfaces:**
- Consumes: `W3Graph, W3Node, W3Path, validateWorld3dGraph, normalizeW3Graph` from `src/lib/rpgWorld3d.ts`
- Produces: `CAMPUS_STAGE_ORDER: readonly string[]`, `CAMPUS_STAGE_NODE: Record<string,string>`, `CAMPUS_STAGE_TITLES: Record<string,string>`, `CAMPUS_INITIAL_PATHS: string[]`, `CAMPUS_UNLOCKS: Record<string,string[]>`, `campusGraph: W3Graph`, `campusNextStage(cleared: readonly string[]) => string | null`, `campusStageStatus(cleared: readonly string[], stageId: string) => 'cleared'|'next'|'locked'`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/rpgCampus.test.ts
import { describe, it, expect } from 'vitest'
import { CAMPUS_STAGE_ORDER, campusNextStage, campusStageStatus } from './rpgCampus'
import { validateWorld3dGraph } from './rpgWorld3d'
import graph from '../../public/rpg/campus_graph.json'

describe('campus domain', () => {
  it('graph validates with zero issues', () => {
    expect(validateWorld3dGraph(graph as any)).toEqual([])
  })
  it('first stage is next when cleared is empty', () => {
    expect(campusNextStage([])).toBe(CAMPUS_STAGE_ORDER[0])
  })
  it('status transitions cleared/next/locked', () => {
    expect(campusStageStatus([], CAMPUS_STAGE_ORDER[0])).toBe('next')
    expect(campusStageStatus([CAMPUS_STAGE_ORDER[0]], CAMPUS_STAGE_ORDER[0])).toBe('cleared')
    expect(campusStageStatus([], CAMPUS_STAGE_ORDER[2])).toBe('locked')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rpgCampus.test.ts`
Expected: FAIL with "No such file" / "cannot find module './rpgCampus'"

- [ ] **Step 3: Implement `src/lib/rpgCampus.ts`＋`public/rpg/campus_graph.json`**

`rpgCampus.ts`に上記4定数＋2関数を定義。値はspec固定（R1 ruling 2026-11-23で到達可能性のため最小拡張済み）：8ノード `n0正門→n1並木道→n2図書館→n3教室棟→n4食堂→n5グラウンド→n6研究棟→n7展望デッキ`の線形チェーン（c_i=n_i→n_{i+1}）、stageは`campus-stage-1..4`を`n2,n3,n5,n7`に対応、残りはstop。`CAMPUS_INITIAL_PATHS=['c0','c1']`、`CAMPUS_UNLOCKS`はstage-1で`[c2]`、stage-2で`[c3,c4]`、stage-3で`[c5,c6]`、stage-4で`[]`。`campus_graph.json`はnodes 8・paths 7（c0..c6、walk/runのみ、speed>0、jumpなし、座標はworld1_v3形式のx/y/z数値）で`validateWorld3dGraph`が`[]`になるもの。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/rpgCampus.test.ts`
Expected: PASS（3 tests）

- [ ] **Step 5: Commit**

```bash
git add public/rpg/campus_graph.json src/lib/rpgCampus.ts src/lib/rpgCampus.test.ts
git commit -m "feat: add campus graph and domain"
```

### Task 2: Stage adapterとunlock配線

**Files:**
- Modify: `src/lib/rpgStageAdapter.ts`
- Test: `src/lib/rpgStageAdapter.test.ts`
- Modify: `src/lib/rpgCampus.ts`（必要ならlegacy正規化追加）

**Interfaces:**
- Consumes: `CAMPUS_STAGE_ORDER, CAMPUS_STAGE_TITLES` from Task 1; `StageAction, StageContext, stageActionFor, stageAppRoute`既存 signature維持
- Produces: `stageActionFor('campus-stage-N', ctx)`がtoday/book/rankingを返す（1→today、2→book/fallback today、3→ranking、4→today祝い）。旧`grass-stage-*`互換は壊さない。

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/rpgStageAdapter.test.ts に追加
import { describe, it, expect } from 'vitest'
import { stageActionFor } from './rpgStageAdapter'

describe('campus adapter', () => {
  it('campus-stage-1 goes to today', () => {
    const a = stageActionFor('campus-stage-1', { hasBooks: true, firstBookId: 'b1', todayPages: 0, totalPages: 0 })
    expect(a?.target).toBe('today')
  })
  it('campus-stage-2 goes to book when book exists', () => {
    const a = stageActionFor('campus-stage-2', { hasBooks: true, firstBookId: 'b1', todayPages: 1, totalPages: 10 })
    expect(a?.target).toBe('book')
    expect(a?.bookId).toBe('b1')
  })
  it('locked tap does not move (null when unknown)', () => {
    expect(stageActionFor('campus-stage-99', { hasBooks: false, firstBookId: null, todayPages: 0, totalPages: 0 })).toBeNull()
  })
  it('existing grass stages still work after campus add', () => {
    const a = stageActionFor('grass-stage-1', { hasBooks: false, firstBookId: null, todayPages: 0, totalPages: 0 })
    expect(a?.target).toBe('today')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rpgStageAdapter.test.ts -t "campus adapter"`
Expected: FAIL（`a`がnull、`a?.target`がundefined）

- [ ] **Step 3: Implement `stageActionFor`拡張 in `src/lib/rpgStageAdapter.ts`**

`STAGE_TITLES`に`campus-stage-1:図書館、campus-stage-2:教室棟、campus-stage-3:研究棟、campus-stage-4:展望デッキ`を追加。既存の`-stage-1/-2/-3`分岐をcampusにも適用し、`campus-stage-4`はtoday祝い（target today、hint「全完了！展望デッキで祝おう」）。他分岐・既存9ワールド分岐は変更しない。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/rpgStageAdapter.test.ts`
Expected: PASS（既存＋3件）

- [ ] **Step 5: Commit**

```bash
git add src/lib/rpgStageAdapter.ts src/lib/rpgStageAdapter.test.ts src/lib/rpgCampus.ts
git commit -m "feat: wire campus stages to adapter"
```

### Task 3: 3D表示＋看板クエスト＋掲示板

**Files:**
- Modify: `src/components/RpgWorld3d.tsx`
- Modify: `src/components/RpgAdventure.tsx`
- Modify: `src/screens/RankingScreen.tsx`（RPGタブ配線のみ）
- Create: `src/components/CampusQuestBoard.tsx`
- Test: `src/components/CampusQuestBoard.test.tsx`

**Interfaces:**
- Consumes: Task 1の`campusGraph, CAMPUS_*`、Task 2の`stageActionFor, stageAppRoute`、`slotsForDate`相当の今日枠（呼び側から`slots: {title, bookId|null}[]`としてpropsで受ける）
- Produces: `CampusQuestBoard({slots, slotsDone?, todayLabel, onOpenToday, onOpenBook})`、RpgAdventureでcampus選択可、RpgWorld3dのWORLD3D_CONFIGに`10: campus`追加（glbは`public/rpg/island_base.glb`をプレースホルダー参照、graphは`campus_graph.json`）

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/CampusQuestBoard.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CampusQuestBoard from './CampusQuestBoard'

describe('CampusQuestBoard', () => {
  it('shows up to 4 slots', () => {
    render(<CampusQuestBoard slots={[{title:'A',bookId:'b1'},{title:'B',bookId:null},{title:'C',bookId:'b3'},{title:'D',bookId:null},{title:'E',bookId:null}]} onOpenToday={()=>{}} onOpenBook={()=>{}} todayLabel="今日" />)
    expect(screen.getByTestId('campus-slots').children.length).toBe(4)
  })
  it('empty shows library self-study', () => {
    render(<CampusQuestBoard slots={[]} onOpenToday={()=>{}} onOpenBook={()=>{}} todayLabel="今日" />)
    expect(screen.getByTestId('campus-empty')).toBeTruthy()
  })
  it('done shows observatory celebration and fixed bulletin', () => {
    render(<CampusQuestBoard slots={[{title:'A',bookId:'b1'}]} slotsDone={true} onOpenToday={()=>{}} onOpenBook={()=>{}} todayLabel="今日" bulletin="入試まで439日・模試締切11/30・連続12日" />)
    expect(screen.getByTestId('campus-done')).toBeTruthy()
    expect(screen.getByTestId('campus-bulletin')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/CampusQuestBoard.test.tsx`
Expected: FAIL with "cannot find module './CampusQuestBoard'"

- [ ] **Step 3: Implement `CampusQuestBoard.tsx`＋3D配線**

Boardは最大4件表示（`campus-slots`）、空は`campus-empty`で図書館自習文言、`slotsDone=true`で`campus-done`の展望デッキ祝い表示、固定掲示板`campus-bulletin`（props `bulletin`の固定文を表示）。RpgWorld3dはconfigにcampus追加のみ（terrain/decor/camera流用、新規threeロジックなし、未解放は減光＋移動ブロック）。RpgAdventureのworld選択にcampus追加、Ranking RPGタブから`worldId=10`で開ける。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/CampusQuestBoard.test.tsx src/lib/rpgCampus.test.ts src/lib/rpgStageAdapter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/RpgWorld3d.tsx src/components/RpgAdventure.tsx src/screens/RankingScreen.tsx src/components/CampusQuestBoard.tsx src/components/CampusQuestBoard.test.tsx
git commit -m "feat: show campus world with quest boards"
```

### Task 4: 回帰と仕上げ

**Files:**
- Modify: なし（不具合があれば該当ファイルのみ）
- Test: 既存回帰

**Interfaces:**
- Consumes: Task 1〜3の成果
- Produces: `npm run build`成功、`vitest run`全成功、GLB<8MB確認

- [ ] **Step 1: Run full tests**

Run: `npx vitest run`
Expected: PASS（失敗があれば該当Task範囲のみ修正し、無関係ファイルは触らない）

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: 成功（tsc＋vite、エラーなし）

- [ ] **Step 3: Verify campus fallback**

Run: `npx vitest run src/lib/rpgWorld3d.test.ts src/lib/rpgCampus.test.ts`
Expected: PASS（graph検証が`[]`、既存9ワールドに影響なし）

- [ ] **Step 4: Verify placeholder size**

Run: `node -e "const fs=require('fs');const s=fs.statSync('public/rpg/campus_graph.json').size;console.log(s);if(s>100*1024)process.exit(1)"`
Expected: サイズ表示のみで成功（campus_graph.json<100KB、GLBは既存island_base.glb参照のため追加<8MBを維持）

- [ ] **Step 4: Commit (if fixes)**

```bash
git add -A
git commit -m "fix: campus regression fixes" || echo "no fixes needed"
```
（AGENTS.mdの「対象ファイルのみ」と矛盾するため、実際は修正があったファイルのみaddすること。空ならコミットなし）
