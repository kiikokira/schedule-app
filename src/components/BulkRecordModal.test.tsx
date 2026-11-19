import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { db } from '../db/database'
import BulkRecordModal, { buildBulkDefaultDates } from './BulkRecordModal'
import type { BookData, ProgressRecordData, CycleRecordData } from '../lib/progress'

const pad = (n: number) => String(n).padStart(2, '0')
const localDateStr = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const daysFromNow = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return localDateStr(d)
}

const book: BookData = {
  id: 'b1',
  title: '英単語1000',
  totalPages: 100,
  startDate: daysFromNow(-30),
  deadline: daysFromNow(10),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

function renderModal(props: Partial<Parameters<typeof BulkRecordModal>[0]> = {}) {
  return render(
    <BulkRecordModal
      book={book}
      mode="pages"
      existingPages={[]}
      existingCycles={[]}
      books={[book]}
      onClose={vi.fn()}
      onSaved={vi.fn()}
      {...props}
    />,
  )
}

beforeEach(async () => {
  await db.books.clear()
  await db.records.clear()
  await db.cycleRecords.clear()
  await db.ghostLogs.clear()
  vi.restoreAllMocks()
})

describe('buildBulkDefaultDates', () => {
  it('returns count days ending yesterday, newest first', () => {
    expect(buildBulkDefaultDates('2026-11-19')).toEqual([
      '2026-11-18',
      '2026-11-17',
      '2026-11-16',
      '2026-11-15',
      '2026-11-14',
      '2026-11-13',
      '2026-11-12',
    ])
    expect(buildBulkDefaultDates('2026-03-02', 3)).toEqual([
      '2026-03-01',
      '2026-02-28',
      '2026-02-27',
    ])
  })
})

describe('BulkRecordModal (pages)', () => {
  it('opens with 7 rows ending yesterday and saves only filled rows', async () => {
    renderModal()
    const dates = screen.getAllByTestId(/^bulk-date-/)
    expect(dates).toHaveLength(7)
    expect(dates[0]).toHaveValue(daysFromNow(-1))
    expect(dates[6]).toHaveValue(daysFromNow(-7))
    fireEvent.change(screen.getByTestId('bulk-pages-0'), { target: { value: '20' } })
    fireEvent.change(screen.getByTestId('bulk-pages-2'), { target: { value: '15' } })
    fireEvent.click(screen.getByTestId('bulk-save'))
    await waitFor(async () => {
      expect(await db.records.count()).toBe(2)
    })
    const saved = await db.records.toArray()
    expect(saved.find((r) => r.date === daysFromNow(-1))?.pages).toBe(20)
    expect(saved.find((r) => r.date === daysFromNow(-3))?.pages).toBe(15)
    // ゴーストスナップショットが保存日ごとに追記される
    await waitFor(async () => {
      expect(await db.ghostLogs.count()).toBe(2)
    })
  })

  it('collapses duplicate dates to the last valid value', async () => {
    renderModal()
    fireEvent.click(screen.getByTestId('bulk-add-row'))
    fireEvent.change(screen.getByTestId('bulk-date-0'), { target: { value: '2026-11-18' } })
    fireEvent.change(screen.getByTestId('bulk-pages-0'), { target: { value: '20' } })
    fireEvent.change(screen.getByTestId('bulk-date-7'), { target: { value: '2026-11-18' } })
    fireEvent.change(screen.getByTestId('bulk-pages-7'), { target: { value: '30' } })
    fireEvent.click(screen.getByTestId('bulk-save'))
    await waitFor(async () => {
      const rows = await db.records.where('[bookId+date]').equals(['b1', '2026-11-18']).toArray()
      expect(rows).toHaveLength(1)
      expect(rows[0].pages).toBe(30)
    })
  })

  it('prefills existing records and rejects invalid input without saving', async () => {
    const yesterday = daysFromNow(-1)
    const existing: ProgressRecordData[] = [
      { id: 'r1', bookId: 'b1', date: yesterday, pages: 5 },
    ]
    renderModal({ existingPages: existing })
    expect(screen.getByTestId('bulk-pages-0')).toHaveValue('5')
    fireEvent.change(screen.getByTestId('bulk-pages-1'), { target: { value: '0' } })
    fireEvent.click(screen.getByTestId('bulk-save'))
    expect(screen.getByTestId('bulk-error')).toBeInTheDocument()
    expect(await db.records.count()).toBe(0)
  })

  it('warns on out-of-range dates but still saves', async () => {
    renderModal()
    expect(screen.queryByTestId('bulk-range-warning')).not.toBeInTheDocument()
    fireEvent.change(screen.getByTestId('bulk-date-0'), { target: { value: daysFromNow(-60) } })
    fireEvent.change(screen.getByTestId('bulk-pages-0'), { target: { value: '8' } })
    expect(screen.getByTestId('bulk-date-warning-0')).toBeInTheDocument()
    expect(screen.getByTestId('bulk-range-warning')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('bulk-save'))
    await waitFor(async () => {
      expect(await db.records.count()).toBe(1)
    })
  })

  it('saves full-width digits as half-width numbers', async () => {
    renderModal()
    fireEvent.change(screen.getByTestId('bulk-pages-0'), { target: { value: '１２' } })
    expect(screen.getByTestId('bulk-pages-0')).toHaveValue('12')
    fireEvent.click(screen.getByTestId('bulk-save'))
    await waitFor(async () => {
      expect(await db.records.count()).toBe(1)
    })
    expect((await db.records.toArray())[0].pages).toBe(12)
  })

  it('overwrites an already persisted record for the same bookId+date', async () => {
    const yesterday = daysFromNow(-1)
    const existing: ProgressRecordData = { id: 'r1', bookId: 'b1', date: yesterday, pages: 5 }
    await db.records.add(existing)
    renderModal({ existingPages: [existing] })
    expect(screen.getByTestId('bulk-pages-0')).toHaveValue('5')
    fireEvent.change(screen.getByTestId('bulk-pages-0'), { target: { value: '9' } })
    fireEvent.click(screen.getByTestId('bulk-save'))
    await waitFor(async () => {
      const rows = await db.records.where('[bookId+date]').equals(['b1', yesterday]).toArray()
      expect(rows).toHaveLength(1)
      expect(rows[0].id).toBe('r1')
      expect(rows[0].pages).toBe(9)
    })
  })

  it('saves records without recordedAt', async () => {
    renderModal()
    fireEvent.change(screen.getByTestId('bulk-pages-0'), { target: { value: '7' } })
    fireEvent.click(screen.getByTestId('bulk-save'))
    await waitFor(async () => {
      expect(await db.records.count()).toBe(1)
    })
    expect((await db.records.toArray())[0]).not.toHaveProperty('recordedAt')
  })

  it('reports partial save when a later upsert fails, keeping earlier record and ghost', async () => {
    const firstDate = daysFromNow(-2) // 日付昇順で先に保存される
    const secondDate = daysFromNow(-1)
    const originalAdd = db.records.add.bind(db.records)
    const addSpy = vi.spyOn(db.records, 'add').mockImplementation((rec, key) => {
      if ((rec as ProgressRecordData).date === secondDate) throw new Error('boom')
      return originalAdd(rec as ProgressRecordData, key)
    })
    renderModal()
    fireEvent.change(screen.getByTestId('bulk-pages-0'), { target: { value: '20' } }) // secondDate
    fireEvent.change(screen.getByTestId('bulk-pages-1'), { target: { value: '10' } }) // firstDate
    fireEvent.click(screen.getByTestId('bulk-save'))
    await waitFor(() => {
      expect(screen.getByTestId('bulk-error')).toBeInTheDocument()
    })
    expect(screen.getByTestId('bulk-error')).toHaveTextContent(firstDate)
    expect(screen.getByTestId('bulk-error')).toHaveTextContent(secondDate)
    const recs = await db.records.toArray()
    expect(recs).toHaveLength(1)
    expect(recs[0].date).toBe(firstDate)
    expect(recs[0].pages).toBe(10)
    const ghosts = await db.ghostLogs.where('date').equals(firstDate).toArray()
    expect(ghosts).toHaveLength(1)
    expect(ghosts[0].total).toBe(10)
    addSpy.mockRestore()
  })

  it('deletes a row and closes via bulk-close', () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    expect(screen.getAllByTestId(/^bulk-row-/)).toHaveLength(7)
    fireEvent.click(screen.getByTestId('bulk-delete-0'))
    expect(screen.getAllByTestId(/^bulk-row-/)).toHaveLength(6)
    fireEvent.click(screen.getByTestId('bulk-close'))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('BulkRecordModal (cycles)', () => {
  const cycleBook: BookData = {
    ...book,
    id: 'c1',
    title: '周回問題集',
    studyMode: 'cycles',
    totalUnits: 20,
    targetRounds: 3,
  }

  const leapBook: BookData = {
    ...book,
    id: 'l1',
    title: 'LEAP英単語',
    catalogId: 'leap',
    studyMode: 'cycles',
    totalUnits: 2300,
    targetRounds: 3,
  }

  it('renders the shell without crashing in cycles mode', () => {
    renderModal({ mode: 'cycles' })
    expect(screen.getByTestId('bulk-modal')).toBeInTheDocument()
    expect(screen.getByTestId('bulk-close')).toBeInTheDocument()
    expect(screen.getByTestId('bulk-save')).toBeInTheDocument()
  })

  it('saves multiple cycle rows with per-row round', async () => {
    renderModal({ book: cycleBook, mode: 'cycles', books: [cycleBook] })
    expect(screen.getAllByTestId(/^bulk-from-/)).toHaveLength(7)
    fireEvent.change(screen.getByTestId('bulk-from-0'), { target: { value: '1' } })
    fireEvent.change(screen.getByTestId('bulk-to-0'), { target: { value: '10' } })
    fireEvent.change(screen.getByTestId('bulk-round-0'), { target: { value: '1' } })
    fireEvent.change(screen.getByTestId('bulk-from-1'), { target: { value: '11' } })
    fireEvent.change(screen.getByTestId('bulk-to-1'), { target: { value: '20' } })
    fireEvent.click(screen.getByTestId('bulk-save'))
    await waitFor(async () => {
      expect(await db.cycleRecords.count()).toBe(2)
    })
    const recs = await db.cycleRecords.toArray()
    expect(recs.every((r) => r.bookId === 'c1')).toBe(true)
    const r0 = recs.find((r) => r.unitFrom === 1)
    expect(r0?.unitTo).toBe(10)
    expect(r0?.round).toBe(1)
    expect(r0?.date).toBe(daysFromNow(-1))
    const r1 = recs.find((r) => r.unitFrom === 11)
    expect(r1?.unitTo).toBe(20)
    expect(r1?.date).toBe(daysFromNow(-2))
    // 周回が空の行は今の周回（既存記録なしなら1）で補完される
    expect(r1?.round).toBe(1)
    // recordedAt は付けない
    expect(recs.every((r) => !('recordedAt' in r))).toBe(true)
    // 保存日ごとにゴーストスナップショットが追記される
    await waitFor(async () => {
      expect(await db.ghostLogs.count()).toBe(2)
    })
  })

  it('rejects only invalid cycle rows', async () => {
    renderModal({ book: leapBook, mode: 'cycles', books: [leapBook] })
    // row0: to=9999 は 1..totalUnits(2300) の範囲外で無効
    fireEvent.change(screen.getByTestId('bulk-from-0'), { target: { value: '1' } })
    fireEvent.change(screen.getByTestId('bulk-to-0'), { target: { value: '9999' } })
    // row1: 有効
    fireEvent.change(screen.getByTestId('bulk-from-1'), { target: { value: '1' } })
    fireEvent.change(screen.getByTestId('bulk-to-1'), { target: { value: '10' } })
    fireEvent.click(screen.getByTestId('bulk-save'))
    expect(screen.getByTestId('bulk-error')).toBeInTheDocument()
    // 無効行があれば1件も保存しない（all-or-nothing）
    expect(await db.cycleRecords.count()).toBe(0)
  })

  it('completes empty round from existing records', async () => {
    const existing: CycleRecordData[] = []
    for (let u = 1; u <= 20; u += 5) {
      existing.push({ id: `x${u}`, bookId: 'c1', date: daysFromNow(-10), unitFrom: u, unitTo: u + 4, round: 1 })
    }
    renderModal({ book: cycleBook, mode: 'cycles', books: [cycleBook], existingCycles: existing })
    fireEvent.change(screen.getByTestId('bulk-from-0'), { target: { value: '1' } })
    fireEvent.change(screen.getByTestId('bulk-to-0'), { target: { value: '10' } })
    fireEvent.click(screen.getByTestId('bulk-save'))
    await waitFor(async () => {
      expect(await db.cycleRecords.count()).toBe(1)
    })
    // 1周目が全区画記録済みなので空欄の周回は2で補完される
    expect((await db.cycleRecords.toArray())[0].round).toBe(2)
  })
})
