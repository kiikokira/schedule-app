import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { db } from '../db/database'
import BookDetailScreen from './BookDetailScreen'

const pad = (n: number) => String(n).padStart(2, '0')
const localDateStr = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const daysFromNow = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return localDateStr(d)
}

const book = {
  id: 'b1',
  title: '英単語1000',
  totalPages: 100,
  startDate: daysFromNow(0),
  deadline: daysFromNow(10),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

beforeEach(async () => {
  await db.books.clear()
  await db.records.clear()
  await db.cycleRecords.clear()
  vi.restoreAllMocks()
})

describe('BookDetailScreen', () => {
  it('shows today target and remaining pages', async () => {
    await db.books.add({ ...book, startDate: daysFromNow(0), deadline: daysFromNow(6) })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    expect(await screen.findByTestId('book-title')).toHaveTextContent('英単語1000')
    // 100ページ / 期限まで6日 = 17ページ（切り上げ）
    expect(screen.getByTestId('today-target')).toHaveTextContent('17')
  })

  it('records today progress and shows updated total', async () => {
    await db.books.add({ ...book, startDate: daysFromNow(0), deadline: daysFromNow(6) })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    fireEvent.change(await screen.findByTestId('progress-input'), { target: { value: '10' } })
    fireEvent.click(screen.getByTestId('record-progress'))
    await waitFor(() => expect(screen.getByTestId('done-count')).toHaveTextContent('10'))
  })

  it('overwrites same-day record', async () => {
    await db.books.add({ ...book, startDate: daysFromNow(0), deadline: daysFromNow(6) })
    await db.records.add({ id: 'r1', bookId: 'b1', date: localDateStr(new Date()), pages: 4 })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    fireEvent.change(await screen.findByTestId('progress-input'), { target: { value: '7' } })
    fireEvent.click(screen.getByTestId('record-progress'))
    await waitFor(() => expect(screen.getByTestId('done-count')).toHaveTextContent('7'))
  })

  it('shows required pages per day, updating live as the input changes', async () => {
    await db.books.add({ ...book, startDate: daysFromNow(0), deadline: daysFromNow(6) })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    const line = await screen.findByTestId('required-per-day')
    // 100ページ / 今日を除く5日 = 1日20ページ
    expect(line).toHaveTextContent('今日 0 ページを進める場合、期限まで1日あたり 20 ページ')
    fireEvent.change(await screen.findByTestId('progress-input'), { target: { value: '10' } })
    // (100 - 10) / 5日 = 1日18ページ
    expect(screen.getByTestId('required-per-day')).toHaveTextContent(
      '今日 10 ページを進める場合、期限まで1日あたり 18 ページ',
    )
  })

  it('reflects today record in the required pages per day', async () => {
    await db.books.add({ ...book, startDate: daysFromNow(0), deadline: daysFromNow(6) })
    await db.records.add({
      id: 'r1',
      bookId: 'b1',
      date: localDateStr(new Date()),
      pages: 40,
    })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    // (100 - 40) / 5日 = 1日12ページ
    expect(await screen.findByTestId('required-per-day')).toHaveTextContent(
      '今日 40 ページを進める場合、期限まで1日あたり 12 ページ',
    )
  })

  it('lists each record with its date and pages', async () => {
    await db.books.add({ ...book, startDate: daysFromNow(-2), deadline: daysFromNow(10) })
    await db.records.add({ id: 'r1', bookId: 'b1', date: daysFromNow(-2), pages: 10 })
    await db.records.add({ id: 'r2', bookId: 'b1', date: daysFromNow(-1), pages: 20 })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    expect(await screen.findByText('記録一覧')).toBeInTheDocument()
    const row1 = screen.getByTestId('record-row-r1')
    expect(row1).toHaveTextContent('10 ページ')
    const row2 = screen.getByTestId('record-row-r2')
    expect(row2).toHaveTextContent('20 ページ')
    for (const id of ['r1', 'r2']) {
      expect(screen.getByTestId(`record-edit-${id}`)).toBeInTheDocument()
      expect(screen.getByTestId(`record-delete-${id}`)).toBeInTheDocument()
    }
  })

  it('updates the pages of a record from the list', async () => {
    await db.books.add({ ...book, startDate: daysFromNow(-2), deadline: daysFromNow(10) })
    await db.records.add({ id: 'r1', bookId: 'b1', date: localDateStr(new Date()), pages: 10 })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    fireEvent.click(await screen.findByTestId('record-edit-r1'))
    fireEvent.change(screen.getByTestId('record-edit-pages-r1'), { target: { value: '25' } })
    fireEvent.click(screen.getByTestId('record-save-r1'))
    await waitFor(() => expect(screen.getByTestId('done-count')).toHaveTextContent('25'))
    expect(screen.getByTestId('record-row-r1')).toHaveTextContent('25 ページ')
  })

  it('updates the date of a record from the list', async () => {
    await db.books.add({ ...book, startDate: daysFromNow(-2), deadline: daysFromNow(10) })
    await db.records.add({ id: 'r1', bookId: 'b1', date: localDateStr(new Date()), pages: 10 })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    const newDate = daysFromNow(2)
    fireEvent.click(await screen.findByTestId('record-edit-r1'))
    fireEvent.change(screen.getByTestId('record-edit-date-r1'), { target: { value: newDate } })
    fireEvent.click(screen.getByTestId('record-save-r1'))
    await waitFor(async () => {
      const stored = await db.records.get('r1')
      expect(stored?.date).toBe(newDate)
    })
  })

  it('deletes a record after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await db.books.add({ ...book, startDate: daysFromNow(-2), deadline: daysFromNow(10) })
    await db.records.add({ id: 'r1', bookId: 'b1', date: localDateStr(new Date()), pages: 10 })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    fireEvent.click(await screen.findByTestId('record-delete-r1'))
    await waitFor(async () => {
      expect(screen.queryByTestId('record-row-r1')).not.toBeInTheDocument()
      const stored = await db.records.get('r1')
      expect(stored).toBeUndefined()
    })
  })

  it('keeps a record when deletion is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    await db.books.add({ ...book, startDate: daysFromNow(-2), deadline: daysFromNow(10) })
    await db.records.add({ id: 'r1', bookId: 'b1', date: localDateStr(new Date()), pages: 10 })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    fireEvent.click(await screen.findByTestId('record-delete-r1'))
    expect(await db.records.get('r1')).toBeDefined()
    expect(screen.getByTestId('record-row-r1')).toBeInTheDocument()
  })

  it('includes already-done pages in total and daily target', async () => {
    await db.books.add({
      ...book,
      totalPages: 300,
      initialDonePages: 120,
      startDate: daysFromNow(0),
      deadline: daysFromNow(6),
    })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    // 完了 120 / 300、残り180 / 6日 = 30ページ
    expect(await screen.findByTestId('done-count')).toHaveTextContent('120')
    expect(screen.getByTestId('today-target')).toHaveTextContent('30')
  })

  it('反復の進捗を表示し範囲＋周回を記録できる', async () => {
    await db.books.add({
      ...book,
      totalPages: 576,
      studyMode: 'cycles',
      totalUnits: 20,
      targetRounds: 3,
      startDate: daysFromNow(0),
      deadline: daysFromNow(6),
    })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    // 総量 60、残り 60 / 6日 = 10区画/日
    expect(await screen.findByTestId('cycle-round-badge')).toHaveTextContent('今1周目')
    expect(screen.getByTestId('cycle-summary')).not.toHaveTextContent('今1周目')
    expect(screen.getByTestId('today-target')).toHaveTextContent('10')
    fireEvent.change(screen.getByTestId('cycle-from'), { target: { value: '1' } })
    fireEvent.change(screen.getByTestId('cycle-to'), { target: { value: '4' } })
    fireEvent.change(screen.getByTestId('cycle-round'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('cycle-record'))
    await waitFor(() => expect(screen.getByTestId('cycle-summary')).toHaveTextContent('4 / 60'))
  })

  it('反復の記録フォームに入力欄の説明を表示する', async () => {
    await db.books.add({
      ...book,
      studyMode: 'cycles',
      totalUnits: 20,
      targetRounds: 3,
      startDate: daysFromNow(0),
      deadline: daysFromNow(6),
    })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    await screen.findByTestId('cycle-record')
    expect(screen.getByText('開始区画')).toBeInTheDocument()
    expect(screen.getByText('終了区画')).toBeInTheDocument()
    expect(screen.getByText('周回')).toBeInTheDocument()
    expect(screen.getByText('日付')).toBeInTheDocument()
    expect(screen.getByTestId('cycle-from')).toHaveAttribute('placeholder', '例: 1')
  })

  it('From＞To の範囲は拒否する', async () => {
    await db.books.add({
      ...book,
      studyMode: 'cycles',
      totalUnits: 20,
      targetRounds: 3,
      startDate: daysFromNow(0),
      deadline: daysFromNow(6),
    })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    fireEvent.change(await screen.findByTestId('cycle-from'), { target: { value: '5' } })
    fireEvent.change(screen.getByTestId('cycle-to'), { target: { value: '2' } })
    fireEvent.click(screen.getByTestId('cycle-record'))
    expect(screen.getByTestId('cycle-error')).toHaveTextContent(/範囲/)
  })

  it('周回別の完了区画数を表示する', async () => {
    await db.books.add({
      ...book,
      totalPages: 576,
      studyMode: 'cycles',
      totalUnits: 20,
      targetRounds: 3,
      startDate: daysFromNow(0),
      deadline: daysFromNow(6),
    })
    await db.cycleRecords.add({ id: 'c1', bookId: 'b1', date: daysFromNow(0), unitFrom: 1, unitTo: 20, round: 1 })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    expect(await screen.findByTestId('cycle-round-coverage')).toHaveTextContent('1周目: 20/20区画')
  })

  it('反復記録の削除失敗時はcycle-errorに表示する', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(db.cycleRecords, 'delete').mockRejectedValueOnce(new Error('fail'))
    await db.books.add({
      ...book,
      totalPages: 576,
      studyMode: 'cycles',
      totalUnits: 20,
      targetRounds: 3,
      startDate: daysFromNow(0),
      deadline: daysFromNow(6),
    })
    await db.cycleRecords.add({ id: 'c1', bookId: 'b1', date: daysFromNow(0), unitFrom: 1, unitTo: 2, round: 1 })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    fireEvent.click(await screen.findByTestId('cycle-list-toggle'))
    fireEvent.click(await screen.findByTestId('cycle-delete-c1'))
    expect(await screen.findByTestId('cycle-error')).toHaveTextContent(/削除に失敗/)
  })

  it('日付範囲外の警告にtestidが付く', async () => {
    await db.books.add({
      ...book,
      totalPages: 576,
      studyMode: 'cycles',
      totalUnits: 20,
      targetRounds: 3,
      startDate: daysFromNow(1),
      deadline: daysFromNow(10),
    })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    expect(await screen.findByTestId('cycle-date-warning')).toHaveTextContent(/範囲外/)
  })

  it('反復記録フォーム付近に加算の注記を表示する', async () => {
    await db.books.add({
      ...book,
      totalPages: 576,
      studyMode: 'cycles',
      totalUnits: 20,
      targetRounds: 3,
      startDate: daysFromNow(0),
      deadline: daysFromNow(6),
    })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    expect(await screen.findByText('記録するごとに進捗に加算されます（同じ範囲の繰り返しも含む）')).toBeInTheDocument()
  })

  it('同じ範囲の再記録でも完了パスが増える', async () => {
    await db.books.add({
      ...book,
      studyMode: 'cycles',
      totalUnits: 20,
      targetRounds: 3,
      startDate: daysFromNow(0),
      deadline: daysFromNow(6),
    })
    await db.cycleRecords.add({ id: 'c1', bookId: 'b1', date: daysFromNow(0), unitFrom: 1, unitTo: 2, round: 1 })
    await db.cycleRecords.add({ id: 'c2', bookId: 'b1', date: daysFromNow(0), unitFrom: 1, unitTo: 2, round: 1 })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    expect(await screen.findByTestId('cycle-summary')).toHaveTextContent('4 / 60')
  })

  it('LEAPは語単位で表示し5つの範囲プリセットを出す', async () => {
    await db.books.add({
      ...book,
      title: '改訂版 必携 英単語 LEAP',
      catalogId: 'leap',
      totalPages: 576,
      studyMode: 'cycles',
      totalUnits: 2300,
      targetRounds: 3,
      startDate: daysFromNow(0),
      deadline: daysFromNow(6),
    })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    expect(await screen.findByTestId('cycle-summary')).toHaveTextContent('全2300語×3周')
    expect(screen.getByTestId('leap-preset-1-400')).toBeInTheDocument()
    expect(screen.getByTestId('leap-preset-401-1000')).toBeInTheDocument()
    expect(screen.getByTestId('leap-preset-1001-1400')).toBeInTheDocument()
    expect(screen.getByTestId('leap-preset-1401-2000')).toBeInTheDocument()
    expect(screen.getByTestId('leap-preset-2001-2300')).toBeInTheDocument()
  })

  it('LEAPブロック選択は入力を空のまま選択だけ表示する', async () => {
    await db.books.add({
      ...book,
      title: '改訂版 必携 英単語 LEAP',
      catalogId: 'leap',
      totalPages: 576,
      studyMode: 'cycles',
      totalUnits: 2300,
      targetRounds: 3,
      startDate: daysFromNow(0),
      deadline: daysFromNow(6),
    })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    fireEvent.click(await screen.findByTestId('leap-preset-401-1000'))
    expect((screen.getByTestId('cycle-from') as HTMLInputElement).value).toBe('')
    expect((screen.getByTestId('cycle-to') as HTMLInputElement).value).toBe('')
    expect(screen.getByTestId('leap-preset-401-1000')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/選択中：401〜1000語/)).toBeInTheDocument()
  })

  it('LEAPは選択ブロック内の部分範囲を記録できる', async () => {
    await db.books.add({
      ...book,
      title: '改訂版 必携 英単語 LEAP',
      catalogId: 'leap',
      totalPages: 576,
      studyMode: 'cycles',
      totalUnits: 2300,
      targetRounds: 3,
      startDate: daysFromNow(0),
      deadline: daysFromNow(6),
    })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    fireEvent.click(await screen.findByTestId('leap-preset-401-1000'))
    fireEvent.change(screen.getByTestId('cycle-from'), { target: { value: '401' } })
    fireEvent.change(screen.getByTestId('cycle-to'), { target: { value: '500' } })
    fireEvent.click(screen.getByTestId('cycle-record'))
    await waitFor(() => expect(screen.getByTestId('cycle-summary')).toHaveTextContent('100 / 6900'))
  })

  it('LEAPは選択ブロック外の範囲を拒否する', async () => {
    await db.books.add({
      ...book,
      title: '改訂版 必携 英単語 LEAP',
      catalogId: 'leap',
      totalPages: 576,
      studyMode: 'cycles',
      totalUnits: 2300,
      targetRounds: 3,
      startDate: daysFromNow(0),
      deadline: daysFromNow(6),
    })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    fireEvent.click(await screen.findByTestId('leap-preset-1-400'))
    fireEvent.change(screen.getByTestId('cycle-from'), { target: { value: '401' } })
    fireEvent.change(screen.getByTestId('cycle-to'), { target: { value: '500' } })
    fireEvent.click(screen.getByTestId('cycle-record'))
    expect(screen.getByTestId('cycle-error')).toHaveTextContent(/選択中の範囲/)
  })

  it('LEAPは日付欄なし・目標周回に今の周回が入った状態で記録できる', async () => {
    await db.books.add({
      ...book,
      title: '改訂版 必携 英単語 LEAP',
      catalogId: 'leap',
      totalPages: 576,
      studyMode: 'cycles',
      totalUnits: 2300,
      targetRounds: 3,
      startDate: daysFromNow(0),
      deadline: daysFromNow(6),
    })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    expect(await screen.findByTestId('cycle-record')).toBeInTheDocument()
    expect(screen.queryByTestId('cycle-date')).not.toBeInTheDocument()
    expect(screen.getByTestId('cycle-round')).toHaveValue(1)
    fireEvent.click(screen.getByTestId('leap-preset-1-400'))
    fireEvent.change(screen.getByTestId('cycle-from'), { target: { value: '12' } })
    fireEvent.change(screen.getByTestId('cycle-to'), { target: { value: '13' } })
    fireEvent.click(screen.getByTestId('cycle-record'))
    await waitFor(() => expect(screen.getByTestId('cycle-summary')).toHaveTextContent('2 / 6900'))
    const recs = await db.cycleRecords.toArray()
    expect(recs).toHaveLength(1)
    expect(recs[0].round).toBe(1)
    expect(recs[0].date).toBe(localDateStr(new Date()))
  })

  it('LEAPは今の周回を見やすいバッジで表示する', async () => {
    await db.books.add({
      ...book,
      title: '改訂版 必携 英単語 LEAP',
      catalogId: 'leap',
      totalPages: 576,
      studyMode: 'cycles',
      totalUnits: 2300,
      targetRounds: 3,
      startDate: daysFromNow(0),
      deadline: daysFromNow(6),
    })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    expect(await screen.findByTestId('cycle-round-badge')).toHaveTextContent('今1周目')
  })

  it('反復の今日の目標は当日分を差し引いて表示する', async () => {
    await db.books.add({
      ...book,
      totalPages: 576,
      studyMode: 'cycles',
      totalUnits: 2300,
      targetRounds: 3,
      startDate: daysFromNow(0),
      deadline: daysFromNow(6),
    })
    await db.cycleRecords.add({ id: 'c1', bookId: 'b1', date: localDateStr(new Date()), unitFrom: 1, unitTo: 100, round: 1 })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    // 日割り 1150 - 当日 100 = 1050
    expect(await screen.findByTestId('today-target')).toHaveTextContent('1050')
  })

  it('反復の今日の目標はやり過ぎるとマイナスになる', async () => {
    await db.books.add({
      ...book,
      totalPages: 576,
      studyMode: 'cycles',
      totalUnits: 2300,
      targetRounds: 3,
      startDate: daysFromNow(0),
      deadline: daysFromNow(6),
    })
    await db.cycleRecords.add({ id: 'c1', bookId: 'b1', date: localDateStr(new Date()), unitFrom: 1, unitTo: 1200, round: 1 })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    // 日割り 1150 - 当日 1200 = -50
    expect(await screen.findByTestId('today-target')).toHaveTextContent('-50')
  })

  it('通常ページの今日の目標も当日分を差し引いて表示する', async () => {
    await db.books.add({ ...book, startDate: daysFromNow(0), deadline: daysFromNow(6) })
    await db.records.add({ id: 'r1', bookId: 'b1', date: localDateStr(new Date()), pages: 40 })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    // 日割り 17 - 当日 40 = -23
    expect(await screen.findByTestId('today-target')).toHaveTextContent('-23')
  })

  it('周回記録一覧はボタンで展開するまでは表示されない', async () => {
    await db.books.add({
      ...book,
      studyMode: 'cycles',
      totalUnits: 20,
      targetRounds: 3,
      startDate: daysFromNow(0),
      deadline: daysFromNow(6),
    })
    await db.cycleRecords.add({ id: 'c1', bookId: 'b1', date: daysFromNow(0), unitFrom: 1, unitTo: 2, round: 1 })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    const toggle = await screen.findByTestId('cycle-list-toggle')
    expect(toggle).toHaveTextContent(/記録一覧/)
    expect(screen.queryByTestId('cycle-row-c1')).not.toBeInTheDocument()
    fireEvent.click(toggle)
    expect(await screen.findByTestId('cycle-row-c1')).toBeInTheDocument()
  })

  it('同じ日付の記録は日付を重複表示しない', async () => {
    const sameDate = daysFromNow(0)
    await db.books.add({
      ...book,
      studyMode: 'cycles',
      totalUnits: 20,
      targetRounds: 3,
      startDate: daysFromNow(-1),
      deadline: daysFromNow(6),
    })
    await db.cycleRecords.add({ id: 'c1', bookId: 'b1', date: sameDate, unitFrom: 1, unitTo: 2, round: 1 })
    await db.cycleRecords.add({ id: 'c2', bookId: 'b1', date: sameDate, unitFrom: 3, unitTo: 4, round: 1 })
    render(<BookDetailScreen bookId="b1" onBack={() => {}} onEdit={() => {}} />)
    fireEvent.click(await screen.findByTestId('cycle-list-toggle'))
    await screen.findByTestId('cycle-row-c1')
    await screen.findByTestId('cycle-row-c2')
    const { formatJaDate } = await import('../lib/progress')
    const dateText = formatJaDate(sameDate)
    const matches = screen.getAllByText(dateText)
    expect(matches).toHaveLength(1)
  })
})
