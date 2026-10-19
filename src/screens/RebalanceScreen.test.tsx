import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import RebalanceScreen from './RebalanceScreen'
import { db } from '../db/database'
import { saveAvailabilitySlot, listAdjustments } from '../data/dayplanStore'
import { addDays } from '../lib/dayplan'
import { todayStr } from '../lib/progress'

beforeEach(async () => {
  await db.books.clear()
  await db.records.clear()
  await db.availability.clear()
  if (db.adjustments) await db.adjustments.clear()
})

const addBook = async (id: string, over: Record<string, unknown> = {}) => {
  const now = new Date().toISOString()
  const today = todayStr()
  await db.books.add({
    id,
    title: id,
    totalPages: 200,
    startDate: today,
    deadline: addDays(today, 90),
    minutesPerPage: 2,
    createdAt: now,
    updatedAt: now,
    ...over,
  } as any)
}

const seedDaySlot = async () => {
  // 120分の未来枠。テスト実行時刻に依存しないよう現在時刻を基準にする。
  // 再調整画面は現在時刻より前の枠を計画に入れない仕様のため。
  const n = new Date()
  const nowMin = n.getHours() * 60 + n.getMinutes()
  let startMin = nowMin + 30
  if (startMin + 120 > 1440) startMin = 1440 - 120
  await saveAvailabilitySlot(
    { id: 'a1', weekday: null, date: todayStr(), start: fmtMin(startMin), end: fmtMin(startMin + 120) },
    true,
  )
}

const fmtMin = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

const nowMinOf = () => {
  const n = new Date()
  return n.getHours() * 60 + n.getMinutes()
}

describe('RebalanceScreen', () => {
  it('shows before and after plans', async () => {
    await addBook('b1', { deadline: addDays(todayStr(), 60) })
    await addBook('b2')
    await seedDaySlot()
    render(<RebalanceScreen bookId="b2" onBack={() => {}} onSchedule={() => {}} />)
    expect(await screen.findByTestId('rebalance-before')).toBeInTheDocument()
    expect(await screen.findByTestId('rebalance-after')).toBeInTheDocument()
    expect(await screen.findByTestId('rebalance-before-row-b1')).toBeInTheDocument()
    expect(await screen.findByTestId('rebalance-after-row-b2')).toBeInTheDocument()
  })

  it('maps priority options per the design intent (優先=0, 公平均分=1, 軽視=2, スキップ=3)', async () => {
    await addBook('b1', { priority: 0 })
    await addBook('b2')
    await seedDaySlot()
    render(<RebalanceScreen bookId="b1" onBack={() => {}} onSchedule={() => {}} />)
    const select = (await screen.findByTestId('priority-select-b1')) as HTMLSelectElement
    expect(select.selectedOptions[0].textContent).toBe('優先')
    expect(screen.getByRole('option', { name: '優先' })).toHaveValue('0')
    expect(screen.getByRole('option', { name: '公平均分' })).toHaveValue('1')
    expect(screen.getByRole('option', { name: '軽視' })).toHaveValue('2')
    expect(screen.getByRole('option', { name: 'スキップ' })).toHaveValue('3')
  })

  it('shows no-change when the added book gets no time today', async () => {
    await addBook('b1', { priority: 2, deadline: todayStr() })
    await addBook('b2', { deadline: addDays(todayStr(), 1) })
    await addBook('b3')
    await seedDaySlot()
    render(<RebalanceScreen bookId="b3" onBack={() => {}} onSchedule={() => {}} />)
    expect(await screen.findByTestId('rebalance-no-change')).toBeInTheDocument()
    expect(screen.getByTestId('rebalance-summary')).toHaveTextContent('0分')
  })

  it('favors 優先(0) over 未設定 and places 公平均分(1) below 未設定', async () => {
    await addBook('b1', { deadline: todayStr() })
    await addBook('b2', { deadline: addDays(todayStr(), 1) })
    await seedDaySlot()
    render(<RebalanceScreen bookId="b1" onBack={() => {}} onSchedule={() => {}} />)
    fireEvent.change(await screen.findByTestId('priority-select-b1'), {
      target: { value: '0' },
    })
    fireEvent.click(screen.getByTestId('rebalance-apply'))
    const after = within(screen.getByTestId('rebalance-after'))
    expect(after.getByTestId('rebalance-after-row-b1')).toHaveTextContent('60ページ')
    expect(after.queryByTestId('rebalance-after-row-b2')).not.toBeInTheDocument()

    fireEvent.change(await screen.findByTestId('priority-select-b1'), {
      target: { value: '1' },
    })
    expect(await screen.findByTestId('rebalance-no-change')).toBeInTheDocument()
  })

  it('frees time for another book when the target book is skipped', async () => {
    await addBook('b1', { deadline: addDays(todayStr(), 1) })
    await addBook('b2', { totalPages: 30, deadline: todayStr() })
    await seedDaySlot()
    render(<RebalanceScreen bookId="b2" onBack={() => {}} onSchedule={() => {}} />)
    const after = within(await screen.findByTestId('rebalance-after'))
    expect(await after.findByTestId('rebalance-after-row-b2')).toHaveTextContent('30ページ')
    expect(after.getByTestId('rebalance-after-row-b1')).toHaveTextContent('30ページ')
    fireEvent.change(await screen.findByTestId('priority-select-b2'), {
      target: { value: '3' },
    })
    expect(await screen.findByTestId('rebalance-no-change')).toBeInTheDocument()
  })

  it('applies the new ratio and recomputes the plan', async () => {
    await addBook('b1')
    await addBook('b2', { totalPages: 3000 })
    await seedDaySlot()
    render(<RebalanceScreen bookId="b2" onBack={() => {}} onSchedule={() => {}} />)
    fireEvent.change(await screen.findByTestId('ratio-input-b2'), {
      target: { value: '5' },
    })
    fireEvent.click(screen.getByTestId('rebalance-apply'))
    expect((screen.getByTestId('ratio-input-b2') as HTMLInputElement).value).toBe('5')
    const after = within(screen.getByTestId('rebalance-after'))
    expect(after.getByTestId('rebalance-after-row-b2')).toHaveTextContent('60分')
  })

  it('saves the ratio and records an adjustment when reporting to the plan', async () => {
    const onSchedule = vi.fn()
    await addBook('b1')
    await addBook('b2')
    await seedDaySlot()
    render(<RebalanceScreen bookId="b2" onBack={() => {}} onSchedule={onSchedule} />)
    fireEvent.change(await screen.findByTestId('ratio-input-b2'), {
      target: { value: '5' },
    })
    fireEvent.click(screen.getByTestId('rebalance-report'))
    await waitFor(async () => {
      const book = await db.books.get('b2')
      expect(book?.allottedRatio).toBe(0.5)
      const adjustments = await listAdjustments()
      expect(adjustments.length).toBeGreaterThan(0)
      expect(adjustments[0].kind).toBe('ratio')
    })
    expect(onSchedule).toHaveBeenCalled()
  })

  it('shows a saved decimal ratio as a 1-10 value', async () => {
    await addBook('b1', { allottedRatio: 0.5 })
    await seedDaySlot()
    render(<RebalanceScreen bookId="b1" onBack={() => {}} onSchedule={() => {}} />)
    expect((await screen.findByTestId('ratio-input-b1') as HTMLInputElement).value).toBe('5')
  })

  it('labels the ratio input with its meaning and an example', async () => {
    await addBook('b1')
    await seedDaySlot()
    render(<RebalanceScreen bookId="b1" onBack={() => {}} onSchedule={() => {}} />)
    expect(await screen.findByTestId('ratio-label-b1')).toHaveTextContent('配分比率')
    expect(screen.getByTestId('ratio-label-b1')).toHaveTextContent('1〜10')
    expect(screen.getByTestId('ratio-hint-b1')).toHaveTextContent('5で5割')
    expect(screen.getByTestId('ratio-input-b1')).toHaveAttribute('placeholder', '例: 5')
  })

  it('shows 未設定 for an unset priority', async () => {
    await addBook('b1')
    await seedDaySlot()
    render(<RebalanceScreen bookId="b1" onBack={() => {}} onSchedule={() => {}} />)
    const select = (await screen.findByTestId('priority-select-b1')) as HTMLSelectElement
    expect(select.value).toBe('')
    expect(screen.getByRole('option', { name: '未設定' })).toHaveValue('')
  })

  it('clearing back to 未設定 does not write priority or emit an adjustment', async () => {
    const onSchedule = vi.fn()
    await addBook('b1')
    await seedDaySlot()
    render(<RebalanceScreen bookId="b1" onBack={() => {}} onSchedule={onSchedule} />)
    fireEvent.change(await screen.findByTestId('priority-select-b1'), {
      target: { value: '2' },
    })
    fireEvent.change(await screen.findByTestId('priority-select-b1'), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByTestId('rebalance-report'))
    await waitFor(() => expect(onSchedule).toHaveBeenCalled())
    const book = await db.books.get('b1')
    expect(book?.priority).toBeUndefined()
    const adjustments = await listAdjustments()
    expect(adjustments.length).toBe(0)
  })

  it('saves a priority change and records an adjustment when reporting to the plan', async () => {
    const onSchedule = vi.fn()
    await addBook('b1')
    await addBook('b2')
    await seedDaySlot()
    render(<RebalanceScreen bookId="b2" onBack={() => {}} onSchedule={onSchedule} />)
    fireEvent.change(await screen.findByTestId('priority-select-b2'), {
      target: { value: '2' },
    })
    fireEvent.click(screen.getByTestId('rebalance-report'))
    await waitFor(async () => {
      const book = await db.books.get('b2')
      expect(book?.priority).toBe(2)
      const adjustments = await listAdjustments()
      expect(adjustments.some((a) => a.kind === 'priority')).toBe(true)
    })
    expect(onSchedule).toHaveBeenCalled()
  })

  it('keeps home books out of train slots in the after plan', async () => {
    const today = todayStr()
    await addBook('bHome', { trainFit: 'home', totalPages: 200, minutesPerPage: 2, deadline: addDays(today, 90) })
    await addBook('bTrain', { trainFit: 'train', totalPages: 200, minutesPerPage: 2, deadline: addDays(today, 90) })
    // 75分の汽車枠＋60分の自宅枠を未来に確保（深夜帯は前にずらす）
    const base = Math.min(nowMinOf() + 60, 1440 - 225)
    const tStart = base
    const tEnd = tStart + 75
    const hStart = tEnd + 30
    const hEnd = hStart + 60
    await saveAvailabilitySlot(
      { id: 't1', weekday: null, date: today, start: fmtMin(tStart), end: fmtMin(tEnd), onTrain: true },
      true,
    )
    await saveAvailabilitySlot(
      { id: 'h1', weekday: null, date: today, start: fmtMin(hStart), end: fmtMin(hEnd) },
      true,
    )
    render(<RebalanceScreen bookId="bTrain" onBack={() => {}} onSchedule={() => {}} />)
    const after = within(await screen.findByTestId('rebalance-after'))
    const homeRows = after.getAllByTestId('rebalance-after-row-bHome')
    expect(homeRows.length).toBeGreaterThan(0)
    for (const row of homeRows) {
      expect(row).not.toHaveTextContent(fmtMin(tStart))
    }
  })

  it('previews with recorded progress instead of from scratch', async () => {
    const today = todayStr()
    await addBook('b1', { totalPages: 800, minutesPerPage: 2, deadline: addDays(today, 90) })
    await db.records.add({ id: 'r1', bookId: 'b1', date: today, pages: 700 })
    const nowMin = nowMinOf()
    let startMin = nowMin + 30
    if (startMin + 120 > 1440) startMin = 1440 - 120
    await saveAvailabilitySlot(
      { id: 't1', weekday: null, date: today, start: fmtMin(startMin), end: fmtMin(startMin + 120) },
      true,
    )
    render(<RebalanceScreen bookId="b1" onBack={() => {}} onSchedule={() => {}} />)
    const after = within(await screen.findByTestId('rebalance-after'))
    expect(after.getByTestId('rebalance-after-row-b1')).toHaveTextContent(
      `${fmtMin(startMin)}-${fmtMin(startMin + 15)}`,
    )
  })

  it('tells that nothing changes without priority or ratio edits', async () => {
    await addBook('b1')
    await addBook('b2')
    await seedDaySlot()
    render(<RebalanceScreen bookId="b1" onBack={() => {}} onSchedule={() => {}} />)
    expect(await screen.findByTestId('rebalance-no-change-hint')).toHaveTextContent(
      '優先度・配分比率に変更がないため、このまま反映しても計画は変わりません',
    )
    fireEvent.change(screen.getByTestId('priority-select-b1'), { target: { value: '0' } })
    expect(screen.queryByTestId('rebalance-no-change-hint')).not.toBeInTheDocument()
  })

  it('excludes past slots from the after plan', async () => {
    const today = todayStr()
    const nowMin = nowMinOf()
    // 120分の過去枠（60分以上前に終了）＋未来枠（30分後に開始、日またぎは丸める）
    const pastEnd = nowMin - 60
    const pastStart = pastEnd - 120
    const futStart = nowMin + 30
    const futEnd = Math.min(futStart + 120, 1440)
    await addBook('b1', { totalPages: 3000, minutesPerPage: 2, deadline: addDays(today, 60) })
    await saveAvailabilitySlot(
      { id: 'past', weekday: null, date: today, start: fmtMin(pastStart), end: fmtMin(pastEnd) },
      true,
    )
    await saveAvailabilitySlot(
      { id: 'fut', weekday: null, date: today, start: fmtMin(futStart), end: fmtMin(futEnd) },
      true,
    )
    render(<RebalanceScreen bookId="b1" onBack={() => {}} onSchedule={() => {}} />)
    const section = await screen.findByTestId('rebalance-after')
    const after = within(section)
    expect(await after.findByTestId('rebalance-after-row-b1')).toBeInTheDocument()
    expect(section).not.toHaveTextContent(fmtMin(pastStart))
    expect(section).toHaveTextContent(fmtMin(futStart))
  })

  it('clips an in-progress slot to the remaining time in the after plan', async () => {
    const today = todayStr()
    const nowMin = nowMinOf()
    const startMin = nowMin - 15
    const endMin = nowMin + 45
    await addBook('b1', { totalPages: 3000, minutesPerPage: 2, deadline: addDays(today, 60) })
    await saveAvailabilitySlot(
      { id: 'cur', weekday: null, date: today, start: fmtMin(startMin), end: fmtMin(endMin) },
      true,
    )
    render(<RebalanceScreen bookId="b1" onBack={() => {}} onSchedule={() => {}} />)
    const after = within(await screen.findByTestId('rebalance-after'))
    const row = await after.findByTestId('rebalance-after-row-b1')
    // 開始済みの部分は切り詰められ、残り時間が割当表示になる
    expect(row).not.toHaveTextContent(`${fmtMin(startMin)}-`)
    expect(row).toHaveTextContent(fmtMin(endMin))
  })

  it('shows the next 3 days of the after plan', async () => {
    const today = todayStr()
    await addBook('b1', { totalPages: 3000, minutesPerPage: 2, deadline: addDays(today, 60) })
    await seedDaySlot()
    for (let i = 1; i <= 3; i++) {
      await saveAvailabilitySlot(
        { id: `up${i}`, weekday: null, date: addDays(today, i), start: '21:00', end: '22:00' },
        true,
      )
    }
    render(<RebalanceScreen bookId="b1" onBack={() => {}} onSchedule={() => {}} />)
    const upcoming = await screen.findByTestId('rebalance-upcoming')
    for (let i = 1; i <= 3; i++) {
      expect(
        within(upcoming).getByTestId(`rebalance-upcoming-${addDays(today, i)}`),
      ).toHaveTextContent('b1')
    }
  })

  it('no-changeでも調整UIと今後3日を表示する（夜間など今日枠なしの死角対策）', async () => {
    await addBook('b1')
    await addBook('b2')
    // 今日の空きなし → before/afterとも今日0件で hasDiff=false になる
    render(<RebalanceScreen bookId="b2" onBack={() => {}} onSchedule={() => {}} />)
    expect(await screen.findByTestId('rebalance-no-change')).toBeInTheDocument()
    // 死角: 現状はここで早期リターンして調整UIが出ない
    expect(await screen.findByTestId('priority-select-b2')).toBeInTheDocument()
    expect(await screen.findByTestId('rebalance-upcoming')).toBeInTheDocument()
    expect(await screen.findByTestId('rebalance-report')).toBeInTheDocument()
  })
})