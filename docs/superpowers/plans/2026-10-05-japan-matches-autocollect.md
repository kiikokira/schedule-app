# 日本代表戦・自動収集ワークフロー Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** JFA公式発表のA代表日程を毎日自動取得し、差分があれば `src/data/japanMatches.ts` を更新して自動pushする。

**Architecture:** GitHub Actionsの定期実行のみ。ブラウザの外部通信は増やさない。Node 20標準機能（`fetch`、正規表現）のみで依存追加なし。JFA英語版一覧ページは静的HTMLで取得可能であることを2026-10-05に確認済み。

**Tech Stack:** Node.js 20 (actions/setup-node), GitHub Actions, 正規表現HTML抽出（依存なし）.

**Spec:** `docs/superpowers/specs/2026-10-05-japan-match-page-design.md`（§6）

## Global Constraints

- 作業は `superpowers:using-git-worktrees` で作った分離ワークツリー（Plan Aと同じくブランチ名 `japan-match`、Plan A実装済みの上で積む）で行い、`main`を直接変更しない。
- テスト実行は `cmd /c npm test -- --run`（`cmd /c`経由必須）。
- YAGNI: Issue自動作成・Slack通知・API化などの拡張をしない。`public/llm-probe.html`・写真・動画ファイルに触れない。
- ワークフローの権限は最小限（`contents: write` のみ＋必要時は `actions: read` なし）。
- 生成データは `src/data/japanMatches.ts` の既存形式（`JapanMatch[]`＋`generatedAt`）と完全一致させる。勝手に形式を変えない。
- コミットメッセージは `japan(taskN): ...` 形式。Subagentはさらにsubagentを起動しない。

---

## File Map

- Create: `scripts/fetch-japan-matches.mjs` — 取得・抽出・ファイル生成（純粋関数をexportしテスト可能にする）
- Create: `scripts/fetch-japan-matches.test.ts` — Vitestによる抽出テスト（実JFAページの断片をフィクスチャ化）
- Create: `.github/workflows/japan-matches.yml` — 毎日定期実行＋差分自動コミット

---

### Task 1: 抽出スクリプト＋テスト

**Files:**
- Create: `scripts/fetch-japan-matches.mjs`
- Test: `scripts/fetch-japan-matches.test.ts`

**Interfaces:**
- Consumes: `JapanMatch` 型の形状（`src/data/japanMatches.ts` と同一）
- Produces: `parseListPage(html: string): RawMatch[]`, `parseDetailKickoff(html: string): string | null`, `toJapanMatch(raw, kickoff)`, `renderDataFile(matches, generatedAt): string`（Task 3の実働確認が使用）

仕様（exact）：
- 取得先：`https://www.jfa.jp/eng/international_match/`（GET、UAは `schedule-app-bot`）。
- `parseListPage` は `SAMURAI BLUE` 見出しブロックのみを対象にする（フットサル・なでしこを除外）。各ブロックから次を抜く：日付行（例 `Monday, 5 October 2026` → `2026-10-05`。月名→数値の対応表を内蔵）、大会名（大会画像の `alt`、例 `SAMURAI BLUE KIRIN CUP SOCCER 2026`）、会場行（次の非空行）、対戦相手（`vs` の次の行の `![X National Team]` alt または国旗画像ファイル名 `flag_XXX.png`。国旗のみで相手名が無い場合（4チーム大会表示等）は `null` を返し、詳細ページ側で補完する）、詳細リンク（`](/eng/samuraiblue/...` の `詳細はこちら`）。
- 対戦相手の英語→日本語対応表（exact初期値）：`{ Uruguay: 'ウルグアイ', Venezuela: 'ベネズエラ', Ecuador: 'エクアドル', 'New Zealand': 'ニュージーランド', Panama: 'パナマ', Brazil: 'ブラジル', Netherlands: 'オランダ', Sweden: 'スウェーデン', Tunisia: 'チュニジア', England: 'イングランド', Scotland: 'スコットランド', Iceland: 'アイスランド', Spain: 'スペイン', France: 'フランス', Germany: 'ドイツ', Argentina: 'アルゼンチン', Belgium: 'ベルギー', Portugal: 'ポルトガル', Italy: 'イタリア', Croatia: 'クロアチア', Morocco: 'モロッコ', Mexico: 'メキシコ', Colombia: 'コロンビア', Paraguay: 'パラグアイ', Korea: '韓国' }`。表に無い相手はエラー終了（`OPPONENT_MAP` に無い旨を明示）し、データは更新しない。
- `homeAway` 判定：会場文字列に `Singapore` 等の国外都市が含まれる、または対戦相手国と同一開催と読める場合は `'neutral'`、それ以外は `'home'`。ただし会場が欧州等の国外かつ相手国開催と読める場合は `'away'`。未知の会場は `'neutral'`＋警告出力（致命エラーにしない）。判定表はスクリプト内の `VENUE_HINTS` に集約する。
- `parseDetailKickoff` は詳細ページHTMLから `Kick Off at HH:MM`（1試合日は最初の時刻。`15:10/19:10` のように2試合併記の場合はその日の試合に対応する時刻＝日付ブロックにひもづく方）を抜く。日本開催は日本時間そのまま。シンガポール開催の `18:15（Local Time）` は `+1時間` して `19:15` にする（`LocalTime` が `Singapore` の場合のみ。判定はページ内の `Singapore` 文字列の有無）。
- `renderDataFile` は `JAPAN_MATCHES` と `generatedAt` を含む `japanMatches.ts` 全文を生成する。`id` は `YYYY-MM-DD-<slug>`（slugは大会略称の小文字英数。例 `2026-11-14-vs-brazil`）。
- メイン処理：未来（含む今日JST）の試合のみ残す。`validateJapanMatches` 相当の検査を自前で行い、不正があれば非ゼロ終了。差分が無ければファイルに触らず exit 0。
- 直接実行時のみ動作するガードを付ける：

```js
import { fileURLToPath } from 'node:url'
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main()
}
```

- [ ] **Step 1: 実ページを取得して構造を確認する**

Run: `cmd /c "node -e \"fetch('https://www.jfa.jp/eng/international_match/').then(r=>r.text()).then(t=>require('fs').writeFileSync('jfa-list.html',t))\""`（作業ツリー直下。確認後は削除する）
Expected: `jfa-list.html` に `SAMURAI BLUE` ブロックが含まれること

- [ ] **Step 2: Write the failing test**（実ページ断片をフィクスチャ化。最低限：ウルグアイ戦ブロックの抽出、詳細の `Kick Off at 19:30` 抽出、`renderDataFile` が `JAPAN_MATCHES` を含むこと）

```ts
import { describe, it, expect } from 'vitest'
import { parseListPage, parseDetailKickoff, renderDataFile } from './fetch-japan-matches.mjs'

const LIST_FIXTURE = `
#### SAMURAI BLUE
-   Monday, 5 October 2026
-   ![SAMURAI BLUE KIRIN CUP SOCCER 2026](/international_match/img/kirincupsoccer_2026.png)
-   National Stadium
-   -   SAMURAI BLUE
    -   vs
    -   ![New Zealand National Team](/common/img/flag/flag_NZL.png) New Zealand National Team
-   [![詳細はこちら](/eng/international_match/img/btn_special_site.gif)](/eng/samuraiblue/kirincupsoccer_2026/)
`

describe('fetch-japan-matches', () => {
  it('extracts a SAMURAI BLUE block', () => {
    const rows = parseListPage(LIST_FIXTURE)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ date: '2026-10-05', opponentEn: 'New Zealand', competition: 'SAMURAI BLUE KIRIN CUP SOCCER 2026', venue: 'National Stadium' })
  })
  it('extracts kickoff from a detail page', () => {
    expect(parseDetailKickoff('<div>Monday, 5 October 2026 Kick Off at 19:30</div>')).toBe('19:30')
  })
  it('renders a data file containing JAPAN_MATCHES', () => {
    const out = renderDataFile([{ id: 'x', date: '2026-10-05', kickoff: '19:30', opponent: 'ニュージーランド', competition: 'K', homeAway: 'home' }], '2026-10-05T00:00:00+09:00')
    expect(out).toContain('JAPAN_MATCHES')
    expect(out).toContain('2026-10-05')
  })
})
```

（`RawMatch` の実際のフィールド名に合わせて調整すること。テストが先にあり、実装がそれに合わせる）

- [ ] **Step 3: Run test to verify it fails**

Run: `cmd /c npm test -- --run scripts/fetch-japan-matches.test.ts`
Expected: FAIL with "Failed to resolve import"

- [ ] **Step 4: Write minimal implementation**（上記仕様の通り）

- [ ] **Step 5: Run test to verify it passes**

Run: `cmd /c npm test -- --run scripts/fetch-japan-matches.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/fetch-japan-matches.mjs scripts/fetch-japan-matches.test.ts
git commit -m "japan(task5): JFA fetch script and tests"
```

---

### Task 2: ワークフロー

**Files:**
- Create: `.github/workflows/japan-matches.yml`

**Interfaces:**
- Consumes: Task 1のスクリプト
- Produces: 毎日自動更新（Task 3が検証）

仕様（exactファイル内容）：

```yaml
name: Update Japan matches
on:
  schedule:
    - cron: '30 21 * * *'
  workflow_dispatch:
permissions:
  contents: write
jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Fetch JFA fixtures
        run: node scripts/fetch-japan-matches.mjs
      - name: Commit if changed
        run: |
          if git diff --quiet -- src/data/japanMatches.ts; then
            echo "no changes"
          else
            git config user.name "github-actions[bot]"
            git config user.email "github-actions[bot]@users.noreply.github.com"
            git add src/data/japanMatches.ts
            git commit -m "data: update Japan matches from JFA"
            git push
          fi
```

- [ ] **Step 1: Write the workflow file**（上記exact内容）
- [ ] **Step 2: Validate the YAML**

Run: `cmd /c "python3 -c \"import yaml,sys; yaml.safe_load(open('.github/workflows/japan-matches.yml'))\""`
Expected: exit 0（出力なし）。`python3` が無い環境では `node -e` で簡易パースに置き換えてよいが、その場合は方法をレポートに残すこと。
- [ ] **Step 3: Commit**

```bash
git add .github/workflows/japan-matches.yml
git commit -m "japan(task6): daily JFA auto-collect workflow"
```

---

### Task 3: 実働確認＋ビルド

**Files:** 変更は原則なし（スクリプト不備があれば Task 1 の範囲で修正し、別コミットにする）

- [ ] **Step 1: スクリプトを実ページ相手に実行する**。Run: `cmd /c node scripts/fetch-japan-matches.mjs`。Expected: exit 0。生成差分が現在の `JAPAN_MATCHES` と一致する（初回データが正確な証拠になる）。差分が出た場合は内容を精査し、JFA公式が正ならデータ側を取り込む（`git add src/data/japanMatches.ts`＋コミット `japan(task7): sync fixtures with JFA`）。
- [ ] **Step 2: フルスイートを実行する**。Run: `cmd /c npm test -- --run`。Expected: 全ファイルPASS（既知のjsdomノイズを除く）。
- [ ] **Step 3: ビルドを通す**。Run: `cmd /c npm run build`。Expected: exit 0（`tsc -b`＋`vite build`）。
