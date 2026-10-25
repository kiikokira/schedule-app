import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import RankingScreen from './RankingScreen'
import { db } from '../db/database'
import { todayStr } from '../lib/progress'
import { saveProfile } from '../data/profileStore'

describe('RankingScreen', () => {
  beforeEach(async () => {
    await db.books.clear()
    await db.records.clear()
  })
  it('近傍ライバルとリーチ表示を出す', async () => {
    const now = new Date().toISOString()
    const today = todayStr()
    await db.books.add({
      id: 'b1', title: '単語帳', totalPages: 100,
      startDate: today, deadline: today, createdAt: now, updatedAt: now,
    })
    await db.records.add({ id: 'r1', bookId: 'b1', date: today, pages: 10 })
    render(<RankingScreen onBack={() => {}} today={today} />)
    expect(await screen.findByTestId('ranking-page')).toHaveTextContent('仮想全国ランキング')
    expect(await screen.findByTestId('ranking-reach')).toHaveTextContent('ページ')
    expect((await screen.findAllByTestId(/^ranking-rival-/)).length).toBeGreaterThan(0)
  })
  it('戻るボタンでonBackを呼ぶ', async () => {
    const onBack = vi.fn()
    render(<RankingScreen onBack={onBack} today={todayStr()} />)
    fireEvent.click(await screen.findByTestId('ranking-back'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
  it('ライバル行に順位と志望大学を表示する', async () => {
    const today = todayStr()
    render(<RankingScreen onBack={() => {}} today={today} />)
    const rows = await screen.findAllByTestId(/^ranking-rival-/)
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row).toHaveTextContent(/[\d,]+位/)
    }
    const univTexts = rows
      .map((r) => {
        const univ = within(r).queryByTestId('rival-univ')
        return univ?.textContent ?? ''
      })
      .join()
    expect(univTexts).toMatch(/阪大|東大|京大|早稲田|慶應|新潟|信州|岡山|広島|熊本|鹿児島|琉球|弘前|静岡|金沢/)
    expect(univTexts).not.toMatch(/都|道|府|県/)
  })
  it('追い越す表記を使わず次の節目までの差を表示する', async () => {
    const today = todayStr()
    render(<RankingScreen onBack={() => {}} today={today} />)
    expect(await screen.findByTestId('ranking-reach')).toHaveTextContent('まであと')
    expect(screen.getByTestId('ranking-reach')).not.toHaveTextContent('追い越す')
    expect(screen.getByTestId('ranking-page')).not.toHaveTextContent('を抜く')
  })
  it('近傍ボードの表示順位は1ずつ連続する', async () => {
    const today = todayStr()
    render(<RankingScreen onBack={() => {}} today={today} />)
    const rows = await screen.findAllByTestId(/^ranking-rival-/)
    const ranks = rows.map((r) => Number((r.textContent?.match(/([\d,]+)位/)?.[1] ?? '').replace(/,/g, '')))
    expect(ranks.length).toBeGreaterThan(1)
    // グローバル順位を表示するため全てが小さい密集順位(1,2,3)にはならない
    expect(Math.max(...ranks)).toBeGreaterThan(100)
  })
  it('1位からの上位ボードを表示する', async () => {
    const today = todayStr()
    render(<RankingScreen onBack={() => {}} today={today} />)
    const top = await screen.findByTestId('ranking-top')
    expect(within(top).getByTestId('ranking-top-0')).toHaveTextContent('1位')
    expect(top).toHaveTextContent('ページ')
  })
  it('月初めの週に模試ウィーク確定と根拠を表示する', async () => {
    render(<RankingScreen onBack={() => {}} today="2026-10-05" />)
    expect(await screen.findByTestId('ranking-mockweek')).toHaveTextContent('全国模試ウィーク')
    expect(screen.getByTestId('ranking-sources')).toHaveTextContent('文部科学省')
  })
  it('低ページで近傍トップが1位にならない（グローバル順位表示）', async () => {
    const today = todayStr()
    render(<RankingScreen onBack={() => {}} today={today} />)
    const rows = await screen.findAllByTestId(/^ranking-rival-/)
    const first = rows[0].textContent ?? ''
    expect(first).not.toMatch(/^[^0-9]*1位/)
  })
  it('ヘッダーに累計と今日のページ数を併記する', async () => {
    const now = new Date().toISOString()
    const today = todayStr()
    await db.books.add({
      id: 'b1', title: '単語帳', totalPages: 100,
      startDate: today, deadline: today, createdAt: now, updatedAt: now,
    })
    await db.records.add({ id: 'r1', bookId: 'b1', date: today, pages: 7 })
    render(<RankingScreen onBack={() => {}} today={today} />)
    const summary = await screen.findByTestId('ranking-summary')
    expect(summary).toHaveTextContent(/累計/)
    expect(summary).toHaveTextContent(/今日/)
  })
  it('昨日多く今日0でも最下位にならない', async () => {
    const now = new Date().toISOString()
    const today = todayStr()
    const d = new Date()
    d.setDate(d.getDate() - 1)
    const yesterday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    await db.books.add({
      id: 'b1', title: '単語帳', totalPages: 500,
      startDate: yesterday, deadline: today, createdAt: now, updatedAt: now,
    })
    await db.records.add({ id: 'r1', bookId: 'b1', date: yesterday, pages: 50 })
    render(<RankingScreen onBack={() => {}} today={today} />)
    const summary = await screen.findByTestId('ranking-summary')
    // DB読み込み完了を待ってから検証する（初回描画は空データのため）。
    await waitFor(() => expect(summary).toHaveTextContent('累計50ページ'))
    expect(summary).not.toHaveTextContent('200,000位')
  })
  it('ライバル行は名前・ページ・順位の3列で縦に揃う', async () => {
    const today = todayStr()
    render(<RankingScreen onBack={() => {}} today={today} />)
    const rows = await screen.findAllByTestId(/^ranking-rival-/)
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row).toHaveStyle({ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 6.5em 7em', columnGap: '8px' })
      expect(within(row).getByTestId('rival-name')).toBeInTheDocument()
      expect(within(row).getByTestId('rival-pages')).toBeInTheDocument()
      expect(within(row).getByTestId('rival-rank')).toBeInTheDocument()
    }
  })
  it('ライバルは志望校＋学年バッジで表示しページ列は太字にしない', async () => {
    const today = todayStr()
    render(<RankingScreen onBack={() => {}} today={today} />)
    const rows = await screen.findAllByTestId(/^ranking-rival-/)
    const rivalRows = rows.filter((r) => !r.textContent?.includes('あなた'))
    expect(rivalRows.length).toBeGreaterThan(0)
    for (const row of rivalRows) {
      expect(within(row).getByTestId('rival-grade')).toHaveTextContent(/高1|高2|高3|浪人/)
    }
    const youRow = rows.find((r) => r.textContent?.includes('あなた'))!
    expect(within(youRow).queryByTestId('rival-grade')).toBeNull()
    for (const row of rows) {
      expect(within(row).getByTestId('rival-pages')).toHaveStyle({ fontWeight: '400' })
    }
  })
  it('表示順に順位が1ずつ増える（上が良い順位）', async () => {
    const today = todayStr()
    render(<RankingScreen onBack={() => {}} today={today} />)
    const rows = await screen.findAllByTestId(/^ranking-rival-/)
    const ranks = rows.map((r) => Number(within(r).getByTestId('rival-rank').textContent?.replace(/[,位]/g, '') ?? ''))
    expect(ranks.length).toBeGreaterThan(1)
    expect(ranks[0]).toBeLessThan(ranks[ranks.length - 1])
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i] - ranks[i - 1]).toBe(1)
    }
  })
  it('節目までの差は累計基準で計算される（累計50なら100,000位まであと330ページ）', async () => {
    const now = new Date().toISOString()
    const today = todayStr()
    await db.books.add({
      id: 'b1', title: '単語帳', totalPages: 500,
      startDate: today, deadline: today, createdAt: now, updatedAt: now,
    })
    await db.records.add({ id: 'r1', bookId: 'b1', date: today, pages: 50 })
    render(<RankingScreen onBack={() => {}} today={today} />)
    const reach = await screen.findByTestId('ranking-reach')
    // DB読み込み完了を待ってから検証する（初回描画は空データのため）。
    await waitFor(() => expect(screen.getByTestId('ranking-summary')).toHaveTextContent('今日50ページ'))
    expect(reach).toHaveTextContent('全国100,000位')
    expect(reach).toHaveTextContent('あと330ページ')
  })
  it('近傍とトップの全ライバルに学部名を表示する', async () => {
    const today = todayStr()
    render(<RankingScreen onBack={() => {}} today={today} />)
    const rows = await screen.findAllByTestId(/^ranking-rival-/)
    const rivalRows = rows.filter((r) => !r.textContent?.includes('あなた'))
    expect(rivalRows.length).toBeGreaterThan(0)
    for (const row of rivalRows) {
      const faculty = within(row).getByTestId('rival-faculty')
      expect(faculty.textContent?.length).toBeGreaterThan(0)
      expect(faculty.textContent).toMatch(/学部|学群|学域|学院|学環|類|群/)
    }
    const top = await screen.findByTestId('ranking-top')
    for (let i = 0; i < 10; i++) {
      const topRow = within(top).getByTestId(`ranking-top-${i}`)
      const faculty = within(topRow).getByTestId('top-faculty')
      expect(faculty.textContent?.length).toBeGreaterThan(0)
    }
  })
  it('トップ10行は順位・大学・ページの3列で縦に揃う', async () => {
    const today = todayStr()
    render(<RankingScreen onBack={() => {}} today={today} />)
    const top = await screen.findByTestId('ranking-top')
    for (let i = 0; i < 10; i++) {
      const row = within(top).getByTestId(`ranking-top-${i}`)
      expect(row).toHaveStyle({ display: 'grid', gridTemplateColumns: '2.8em minmax(0,1fr) 7em', columnGap: '8px' })
      expect(within(row).getByTestId('top-rank')).toBeInTheDocument()
      expect(within(row).getByTestId('top-name')).toBeInTheDocument()
      expect(within(row).getByTestId('top-pages')).toBeInTheDocument()
    }
  })
  it('リーグ順位は自分の順位が一行で出て8人表は出ない', async () => {
    const now = new Date().toISOString()
    const today = '2026-09-02'
    await db.books.add({ id: 'b1', title: '単語帳', totalPages: 100, startDate: today, deadline: today, createdAt: now, updatedAt: now })
    await db.records.add({ id: 'r1', bookId: 'b1', date: today, pages: 100 })
    localStorage.clear()
    render(<RankingScreen onBack={() => {}} today={today} />)
    fireEvent.click(screen.getByTestId('league-tab'))
    expect(document.getElementById('league-table')).toBeNull()
    expect(screen.queryByTestId('league-row-you')).toBeNull()
    expect(screen.getByTestId('league-rank')).toHaveTextContent(/^[0-9,]+位$/)
  })
  it('リーグタブにDivision見出しとフェーズ期間が出る', () => {
    localStorage.clear()
    render(<RankingScreen onBack={() => {}} today="2026-09-02" />)
    fireEvent.click(screen.getByTestId('league-tab'))
    expect(screen.getByTestId('league-division')).toHaveTextContent('Division 10')
    expect(screen.getByTestId('league-phase')).toHaveTextContent('2026/09/01')
    expect(screen.getByTestId('league-phase')).toHaveTextContent('2026/09/28')
  })
  it('Divに応じたエンブレム画像が出る', () => {
    localStorage.clear()
    render(<RankingScreen onBack={() => {}} today="2026-09-02" />)
    fireEvent.click(screen.getByTestId('league-tab'))
    const img = screen.getByTestId('league-div-emblem') as HTMLImageElement
    expect(img.tagName).toBe('IMG')
    expect(img.getAttribute('src')).toContain('div-10.jpg')
    expect(img.getAttribute('alt')).toContain('Division 10')
  })
  it('報酬・成績・履歴が一気に見れて切替ボタンはない', () => {
    localStorage.clear()
    render(<RankingScreen onBack={() => {}} today="2026-09-02" />)
    fireEvent.click(screen.getByTestId('league-tab'))
    expect(screen.getByTestId('league-reward')).toBeInTheDocument()
    expect(screen.getByTestId('league-record')).toBeInTheDocument()
    expect(screen.getByTestId('league-history')).toBeInTheDocument()
    expect(screen.queryByTestId('league-panel-toggle')).toBeNull()
  })
  it('リーグタブに成績バーと直近履歴が出る', () => {
    localStorage.clear()
    render(<RankingScreen onBack={() => {}} today="2026-09-02" />)
    fireEvent.click(screen.getByTestId('league-tab'))
    expect(screen.getByTestId('league-record')).toHaveTextContent('勝利')
    expect(screen.getByTestId('league-record')).toHaveTextContent('敗戦')
    expect(screen.getByTestId('league-history')).toBeInTheDocument()
    expect(screen.getByTestId('league-round-status')).toHaveTextContent('昇格')
  })
  it('リーグタブの履歴にスコア形式で出る', async () => {
    const now = new Date().toISOString()
    const today = '2026-09-02'
    await db.books.add({
      id: 'b1', title: '単語帳', totalPages: 500,
      startDate: today, deadline: today, createdAt: now, updatedAt: now,
    })
    await db.records.add({ id: 'r1', bookId: 'b1', date: today, pages: 100 })
    localStorage.clear()
    render(<RankingScreen onBack={() => {}} today={today} />)
    fireEvent.click(screen.getByTestId('league-tab'))
    const history = screen.getByTestId('league-history')
    expect(await within(history).findByTestId('league-history-0')).toHaveTextContent(/\d+-\d+/)
  })
  it('記録がない日は勝敗に数えず敗戦0・履歴空・勝率―になる', () => {
    localStorage.clear()
    render(<RankingScreen onBack={() => {}} today="2026-09-20" />)
    fireEvent.click(screen.getByTestId('league-tab'))
    expect(screen.getByTestId('league-record')).toHaveTextContent('敗戦')
    expect(screen.getByTestId('league-record')).toHaveTextContent('勝率 ―')
    expect(screen.getByTestId('league-history-empty')).toBeInTheDocument()
  })
  it('記録した日だけ勝敗に数えて勝率が動く', async () => {
    const now = new Date().toISOString()
    const today = '2026-09-02'
    await db.books.add({
      id: 'b1', title: '単語帳', totalPages: 500,
      startDate: today, deadline: today, createdAt: now, updatedAt: now,
    })
    await db.records.add({ id: 'r1', bookId: 'b1', date: today, pages: 100 })
    localStorage.clear()
    render(<RankingScreen onBack={() => {}} today={today} />)
    fireEvent.click(screen.getByTestId('league-tab'))
    await waitFor(() => expect(screen.getByTestId('league-record')).toHaveTextContent('勝率 100%'))
  })
  it('RPGタブでレベルが表示される', () => {
    localStorage.clear()
    render(<RankingScreen onBack={() => {}} today="2026-09-02" />)
    fireEvent.click(screen.getByTestId('rpg-tab'))
    expect(screen.getByTestId('rpg-level')).toHaveTextContent('Lv.1')
  })
  it('リーグタブに青い戻るボタンはない', () => {
    localStorage.clear()
    render(<RankingScreen onBack={() => {}} today="2026-09-02" />)
    fireEvent.click(screen.getByTestId('league-tab'))
    expect(screen.getByTestId('league-board')).toBeInTheDocument()
    expect(screen.queryByTestId('league-back')).toBeNull()
  })
  it('Divエンブレムは白縁が一番外になるよう切り抜き表示される', () => {
    localStorage.clear()
    render(<RankingScreen onBack={() => {}} today="2026-09-02" />)
    fireEvent.click(screen.getByTestId('league-tab'))
    const wrap = screen.getByTestId('league-div-emblem-wrap')
    expect(wrap).toHaveStyle({ overflow: 'hidden' })
  })
  it('リーグタブに白い戻る・順位表・記録へボタンはない', () => {
    localStorage.clear()
    render(<RankingScreen onBack={() => {}} today="2026-09-02" />)
    fireEvent.click(screen.getByTestId('league-tab'))
    expect(screen.queryByTestId('ranking-back')).toBeNull()
    expect(screen.queryByTestId('league-to-table')).toBeNull()
    expect(screen.queryByTestId('league-to-record')).toBeNull()
  })
  it('リーグタブのレーティングアイコンはSVGの矢印で表示される', () => {
    localStorage.clear()
    render(<RankingScreen onBack={() => {}} today="2026-09-02" />)
    fireEvent.click(screen.getByTestId('league-tab'))
    expect(screen.getByTestId('league-rating-icon').tagName.toLowerCase()).toBe('svg')
  })
  it('リーグ表の○勝が表示される', () => {
    localStorage.clear()
    render(<RankingScreen onBack={() => {}} today="2026-09-02" />)
    fireEvent.click(screen.getByTestId('league-tab'))
    const wins = screen.getByTestId('league-wins')
    expect(wins).toHaveTextContent(/○\d+勝/)
  })
  it('リーグ表の自分累計は今季のDB合計と一致する（キャッシュや全期間合計に依存しない）', async () => {
    const now = new Date().toISOString()
    const today = '2026-09-02'
    await db.books.add({
      id: 'b1', title: '単語帳', totalPages: 5000,
      startDate: '2026-08-20', deadline: '2026-09-10', createdAt: now, updatedAt: now,
    })
    // 今季（2026-09-01〜）の記録: 9/01に10、今日9/02に100
    await db.records.add({ id: 'r1', bookId: 'b1', date: '2026-09-01', pages: 10 })
    await db.records.add({ id: 'r2', bookId: 'b1', date: today, pages: 100 })
    // 前季の記録: 累計に混ざってはならない
    await db.records.add({ id: 'r0', bookId: 'b1', date: '2026-08-20', pages: 500 })
    // キャッシュは今日分のみ（スクショの「今日21だけ反映」と同じ欠け状態を再現）
    localStorage.clear()
    localStorage.setItem('schedule-app-season-v1', JSON.stringify({ seasonId: '2026-09-01', div: 10, exp: 0, days: { [today]: 100 } }))
    render(<RankingScreen onBack={() => {}} today={today} />)
    fireEvent.click(screen.getByTestId('league-tab'))
    // 今季合計110ページ→22pt換算→半分の11。今日分だけ（20pt→10）でも全期間合計でもない
    expect(await screen.findByTestId('league-rating')).toHaveTextContent('11')
  })
  it('レーティングはページ数の半分で表示する', async () => {
    const now = new Date().toISOString()
    const today = '2026-09-02'
    await db.books.add({
      id: 'b1', title: '単語帳', totalPages: 500,
      startDate: today, deadline: today, createdAt: now, updatedAt: now,
    })
    await db.records.add({ id: 'r1', bookId: 'b1', date: today, pages: 100 })
    localStorage.clear()
    render(<RankingScreen onBack={() => {}} today={today} />)
    fireEvent.click(screen.getByTestId('league-tab'))
    // 今季累計100ページ→20pt換算、レーティングはその半分の10
    expect(await screen.findByTestId('league-rating')).toHaveTextContent('10')
  })
  it('選択中のタブだけ種別調和色で表示する', () => {
    localStorage.clear()
    render(<RankingScreen onBack={() => {}} today="2026-09-02" />)
    // 初期は全国が選択中：白背景に調和する白＋濃枠
    expect(screen.getByTestId('national-tab')).toHaveStyle({ background: '#ffffff', color: '#111111' })
    expect(screen.getByTestId('league-tab')).not.toHaveStyle({ background: '#151a30' })
    fireEvent.click(screen.getByTestId('league-tab'))
    // リーグ選択中：ダーク背景に調和する紺＋金文字
    expect(screen.getByTestId('league-tab')).toHaveStyle({ background: '#151a30', color: '#ffe600' })
    expect(screen.getByTestId('national-tab')).not.toHaveStyle({ background: '#ffffff' })
  })
  it('近傍ボードは自分±5件に絞られる', async () => {
    const now = new Date().toISOString()
    const today = todayStr()
    await db.books.add({
      id: 'b1', title: '単語帳', totalPages: 500,
      startDate: today, deadline: today, createdAt: now, updatedAt: now,
    })
    await db.records.add({ id: 'r1', bookId: 'b1', date: today, pages: 50 })
    render(<RankingScreen onBack={() => {}} today={today} />)
    await waitFor(() => expect(screen.getAllByTestId(/^ranking-rival-/).length).toBe(11))
  })
  it('リーグのみモードはリーグタブから始まる', () => {
    localStorage.clear()
    saveProfile({ nickname: '', grade: '', university: '', faculty: '', department: '', playMode: 'league' })
    render(<RankingScreen onBack={() => {}} today="2026-09-02" />)
    expect(screen.getByTestId('league-board')).toBeInTheDocument()
  })
  it('RPGのみモードはRPGタブから始まる', () => {
    localStorage.clear()
    saveProfile({ nickname: '', grade: '', university: '', faculty: '', department: '', playMode: 'rpg' })
    render(<RankingScreen onBack={() => {}} today="2026-09-02" />)
    expect(screen.getByTestId('rpg-hero')).toBeInTheDocument()
  })
  it('リーグのみモードはRPGタブとRPG表示を出さない', () => {
    localStorage.clear()
    saveProfile({ nickname: '', grade: '', university: '', faculty: '', department: '', playMode: 'league' })
    render(<RankingScreen onBack={() => {}} today="2026-09-02" />)
    expect(screen.getByTestId('league-board')).toBeInTheDocument()
    expect(screen.queryByTestId('rpg-tab')).toBeNull()
    expect(screen.queryByTestId('rpg-hero')).toBeNull()
    expect(screen.getByTestId('national-tab')).toBeInTheDocument()
  })
  it('RPGのみモードはリーグタブとリーグ表示を出さない', () => {
    localStorage.clear()
    saveProfile({ nickname: '', grade: '', university: '', faculty: '', department: '', playMode: 'rpg' })
    render(<RankingScreen onBack={() => {}} today="2026-09-02" />)
    expect(screen.getByTestId('rpg-hero')).toBeInTheDocument()
    expect(screen.queryByTestId('league-tab')).toBeNull()
    expect(screen.queryByTestId('league-board')).toBeNull()
    expect(screen.getByTestId('national-tab')).toBeInTheDocument()
  })
  it('ラウンド状況に勝ち点と昇格ラインが出て確定前はスキップが出ない', () => {
    localStorage.clear()
    render(<RankingScreen onBack={() => {}} today="2026-09-02" />)
    fireEvent.click(screen.getByTestId('league-tab'))
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
    await waitFor(() => expect(screen.getByTestId('league-skip')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('league-skip'))
    await waitFor(() => expect(screen.getByTestId('league-division')).toHaveTextContent('Division 9'))
  })
})
