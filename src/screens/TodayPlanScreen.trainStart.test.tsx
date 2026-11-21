import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TodayPlanScreen from './TodayPlanScreen'
import { db } from '../db/database'
import { saveAvailabilitySlot, listAvailability } from '../data/dayplanStore'

// 2026-11-21 は土曜日（getDay() = 6）。汽車枠は曜日設定で持つので 6 を指定する。
const TODAY = '2026-11-21'
const TRAIN_WEEKDAY = 6

beforeEach(async () => {
  localStorage.clear()
  await db.books.clear()
  await db.records.clear()
  await db.cycleRecords.clear()
  await db.availability.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

const addBook = async () => {
  const now = new Date().toISOString()
  await db.books.add({
    id: 'b1',
    title: '英文法書',
    subject: '英語',
    totalPages: 100,
    startDate: '2026-11-01',
    deadline: '2026-12-31',
    createdAt: now,
    updatedAt: now,
  } as never)
}

const saveTrainSlot = async () => {
  await saveAvailabilitySlot(
    { id: 'w-train', weekday: TRAIN_WEEKDAY, date: null, start: '17:33', end: '19:11', onTrain: true },
    true,
  )
}

// 時計だけ固定する（タイマーは進める）ので非同期DBとwaitForが動く。
const setNow = (h: number, m: number) => {
  vi.useFakeTimers({ shouldAdvanceTime: true } as never)
  vi.setSystemTime(new Date(2026, 10, 21, h, m, 0))
}

describe('train start button', () => {
  it('shows start button for train slot and truncates on click', async () => {
    setNow(18, 30)
    await addBook()
    await saveTrainSlot()
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today={TODAY} />)
    const btn = await screen.findByTestId('train-start')
    expect(btn).toHaveTextContent('スタート')
    fireEvent.click(btn)
    const saved = await screen.findByText('スタート時刻から割り直しました')
    expect(saved).toBeInTheDocument()
  })

  it('does not show the start button before the train time', async () => {
    setNow(17, 32)
    await addBook()
    await saveTrainSlot()
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today={TODAY} />)
    expect(await screen.findByTestId('today-table')).toBeInTheDocument()
    expect(screen.queryByTestId('train-start')).not.toBeInTheDocument()
  })

  it('advances the clock without interaction and shows the start button when train time begins', async () => {
    setNow(17, 32)
    await addBook()
    await saveTrainSlot()
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today={TODAY} />)
    expect(await screen.findByTestId('today-table')).toBeInTheDocument()
    expect(screen.queryByTestId('train-start')).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(await screen.findByTestId('train-start')).toBeInTheDocument()
  })

  it('does not show the start button after the train time', async () => {
    setNow(19, 12)
    await addBook()
    await saveTrainSlot()
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today={TODAY} />)
    expect(await screen.findByTestId('today-table')).toBeInTheDocument()
    expect(screen.queryByTestId('train-start')).not.toBeInTheDocument()
  })

  it('truncates the train slot to the pressed time without touching the weekday setting', async () => {
    setNow(18, 30)
    await addBook()
    await saveTrainSlot()
    await saveAvailabilitySlot(
      { id: 'w-home', weekday: TRAIN_WEEKDAY, date: null, start: '21:00', end: '22:00' },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today={TODAY} />)
    fireEvent.click(await screen.findByTestId('train-start'))
    await screen.findByText('スタート時刻から割り直しました')

    const all = await listAvailability()
    const train = all.find((a) => a.onTrain)
    const home = all.find((a) => !a.onTrain && a.weekday === TRAIN_WEEKDAY)
    expect(train).toMatchObject({ date: TODAY, weekday: null, start: '18:30', end: '19:11' })
    // 曜日設定の汽車枠は書き換えない
    expect(all.find((a) => a.id === 'w-train')).toMatchObject({
      weekday: TRAIN_WEEKDAY,
      date: null,
      start: '17:33',
      end: '19:11',
    })
    // 自宅枠も1分もずれない
    expect(home).toMatchObject({ weekday: TRAIN_WEEKDAY, date: null, start: '21:00', end: '22:00' })
  })

  it('shows the reset button once today overrides exist and restores the weekday setting', async () => {
    setNow(18, 30)
    await addBook()
    await saveTrainSlot()
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today={TODAY} />)
    fireEvent.click(await screen.findByTestId('train-start'))
    await screen.findByText('スタート時刻から割り直しました')

    const reset = await screen.findByTestId('train-start-reset')
    fireEvent.click(reset)
    await screen.findByText('曜日設定に戻しました')

    const all = await listAvailability()
    expect(all.filter((a) => a.date === TODAY)).toHaveLength(0)
    expect(all.find((a) => a.id === 'w-train')).toMatchObject({
      weekday: TRAIN_WEEKDAY,
      date: null,
      start: '17:33',
      end: '19:11',
    })
  })

  it('does not show the reset button before any today override exists', async () => {
    setNow(18, 30)
    await addBook()
    await saveTrainSlot()
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today={TODAY} />)
    expect(await screen.findByTestId('train-start')).toBeInTheDocument()
    expect(screen.queryByTestId('train-start-reset')).not.toBeInTheDocument()
  })

  it('does not show the reset button for a manual today override alone', async () => {
    setNow(18, 30)
    await addBook()
    await saveTrainSlot()
    await saveAvailabilitySlot(
      { id: 'manual', weekday: null, date: TODAY, start: '09:00', end: '10:00', bookId: 'b1' },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today={TODAY} />)
    expect(await screen.findByTestId('today-table')).toBeInTheDocument()
    expect(screen.queryByTestId('train-start-reset')).not.toBeInTheDocument()
    expect(localStorage.getItem(`schedule-app-train-start:${TODAY}`)).toBeNull()
  })

  it('restores a manual today override on reset without changing the weekday setting', async () => {
    setNow(18, 30)
    await addBook()
    await saveTrainSlot()
    await saveAvailabilitySlot(
      { id: 'manual-train', weekday: null, date: TODAY, start: '17:33', end: '19:11', bookId: 'b1', onTrain: true },
      true,
    )
    await saveAvailabilitySlot(
      { id: 'manual-home', weekday: null, date: TODAY, start: '10:00', end: '11:00', bookId: 'b1' },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today={TODAY} />)
    fireEvent.click(await screen.findByTestId('train-start'))
    await screen.findByTestId('train-start-notice')
    expect(localStorage.getItem(`schedule-app-train-start:${TODAY}`)).not.toBeNull()

    fireEvent.click(await screen.findByTestId('train-start-reset'))
    await waitFor(() => {
      expect(screen.getByTestId('train-start-notice')).toHaveTextContent('曜日設定に戻しました')
    })

    const all = await listAvailability()
    expect(all.filter((a) => a.date === TODAY)).toHaveLength(2)
    expect(all.find((a) => a.id === 'manual-train')).toMatchObject({
      date: TODAY, start: '17:33', end: '19:11', bookId: 'b1', onTrain: true,
    })
    expect(all.find((a) => a.id === 'manual-home')).toMatchObject({
      date: TODAY, start: '10:00', end: '11:00', bookId: 'b1',
    })
    expect(all.find((a) => a.id === 'w-train')).toMatchObject({
      weekday: TRAIN_WEEKDAY, date: null, start: '17:33', end: '19:11',
    })
    expect(localStorage.getItem(`schedule-app-train-start:${TODAY}`)).toBeNull()
  })

  it('drops the reset marker when a manual today override is saved', async () => {
    setNow(18, 30)
    await addBook()
    await saveTrainSlot()
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today={TODAY} />)
    fireEvent.click(await screen.findByTestId('train-start'))
    await screen.findByTestId('train-start-notice')
    expect(await screen.findByTestId('train-start-reset')).toBeInTheDocument()

    fireEvent.click(await screen.findByTestId('today-override-toggle'))
    fireEvent.click(await screen.findByTestId('today-override-save'))
    expect(await screen.findByTestId('today-override-message')).toHaveTextContent('今日だけの時間と本を上書きしました')
    await waitFor(() => {
      expect(localStorage.getItem(`schedule-app-train-start:${TODAY}`)).toBeNull()
    })
    expect(screen.queryByTestId('train-start-reset')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByTestId('train-start-notice')).not.toBeInTheDocument()
    })
  })

  it('clears the notice and yesterday reset button when the date changes', async () => {
    setNow(18, 30)
    await addBook()
    await saveTrainSlot()
    const { rerender } = render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today={TODAY} />)
    fireEvent.click(await screen.findByTestId('train-start'))
    expect(await screen.findByTestId('train-start-notice')).toBeInTheDocument()
    expect(await screen.findByTestId('train-start-reset')).toBeInTheDocument()
    expect(localStorage.getItem(`schedule-app-train-start:${TODAY}`)).not.toBeNull()

    rerender(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today="2026-11-22" />)
    await waitFor(() => {
      expect(screen.queryByTestId('train-start-notice')).not.toBeInTheDocument()
      expect(screen.queryByTestId('train-start-reset')).not.toBeInTheDocument()
    })
    // 日付が変わっても前日のデータは消さない
    expect(localStorage.getItem(`schedule-app-train-start:${TODAY}`)).not.toBeNull()
  })

  it('keys each train slot skip by its own origin range', async () => {
    setNow(20, 0)
    await addBook()
    await saveAvailabilitySlot(
      { id: 'train-am', weekday: null, date: TODAY, start: '09:00', end: '10:00', onTrain: true, originStart: '08:30', originEnd: '10:00' },
      true,
    )
    await saveAvailabilitySlot(
      { id: 'train-pm', weekday: null, date: TODAY, start: '17:45', end: '19:11', onTrain: true, originStart: '17:33', originEnd: '19:11' },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today={TODAY} />)
    await screen.findByTestId('today-table')
    // 未割当のまま描画してからUIで本を選ぶ（自動敗戦で確定させない）
    for (let i = 0; i < 2; i++) {
      const rows = screen.getAllByTestId(/plan-row-\d+/)
      const target = rows.find((r) => r.textContent?.includes('未割当'))
      fireEvent.change(within(target as HTMLElement).getByRole('combobox'), {
        target: { value: 'b1' },
      })
    }
    await waitFor(() => expect(screen.queryByText(/未割当/)).not.toBeInTheDocument())

    const { loadSeasonState } = await import('../data/seasonStore')
    // 2行目（17:45-19:11）をスキップ：元キーは 17:33-19:11
    const misses = screen.getAllByTestId('slot-missed-b1')
    expect(misses).toHaveLength(2)
    fireEvent.click(misses[1])
    fireEvent.click(await screen.findByTestId('record-confirm-yes'))
    await waitFor(() => {
      const matches = loadSeasonState(TODAY).slotMatches
      expect(matches['2026-11-21#1053-1151']).toBeDefined()
      expect(matches['2026-11-21#1065-1151']).toBeUndefined()
    })

    // 続けて1行目（09:00-10:00）をスキップ：元キーは 08:30-10:00
    await waitFor(() => expect(screen.getAllByTestId('slot-missed-b1')).toHaveLength(1))
    fireEvent.click(screen.getByTestId('slot-missed-b1'))
    fireEvent.click(await screen.findByTestId('record-confirm-yes'))
    await waitFor(() => {
      expect(loadSeasonState(TODAY).slotMatches['2026-11-21#510-600']).toBeDefined()
    })
  })

  it('keeps the override message and the train start notice independent', async () => {
    setNow(18, 30)
    await addBook()
    await saveTrainSlot()
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today={TODAY} />)
    fireEvent.click(await screen.findByTestId('today-override-toggle'))
    fireEvent.change(await screen.findByTestId('today-override-start-0'), { target: { value: '12:00' } })
    fireEvent.change(await screen.findByTestId('today-override-end-0'), { target: { value: '12:00' } })
    fireEvent.click(await screen.findByTestId('today-override-save'))
    expect(await screen.findByTestId('today-override-message')).toHaveTextContent('終了時刻は開始時刻より後にしてください')

    fireEvent.click(await screen.findByTestId('train-start'))
    expect(await screen.findByText('スタート時刻から割り直しました')).toBeInTheDocument()
    expect(screen.getByTestId('today-override-message')).toHaveTextContent('終了時刻は開始時刻より後にしてください')
    expect(screen.queryByTestId('train-start-message')).not.toBeInTheDocument()
  })

  it('shows the reset button even after the train time has passed', async () => {
    setNow(18, 30)
    await addBook()
    await saveTrainSlot()
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today={TODAY} />)
    fireEvent.click(await screen.findByTestId('train-start'))
    await screen.findByText('スタート時刻から割り直しました')

    // 画面の時計は30秒ごとの更新で進む（F1）。描画だけでは古い時刻のままなので時間を進める。
    act(() => {
      vi.advanceTimersByTime(60 * 60 * 1000)
    })
    expect(screen.queryByTestId('train-start')).not.toBeInTheDocument()
    expect(await screen.findByTestId('train-start-reset')).toBeInTheDocument()
  })

  it('truncates further on a second press instead of going back to the weekday setting', async () => {
    setNow(18, 30)
    await addBook()
    await saveTrainSlot()
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today={TODAY} />)
    fireEvent.click(await screen.findByTestId('train-start'))
    await screen.findByText('スタート時刻から割り直しました')

    // 18:45 まで時間を進めてから押し直す（時計はタイマー更新で追従する）。
    act(() => {
      vi.advanceTimersByTime(15 * 60 * 1000)
    })
    fireEvent.click(await screen.findByTestId('train-start'))
    await waitFor(async () => {
      const all = await listAvailability()
      const train = all.find((a) => a.onTrain)
      expect(train).toMatchObject({ date: TODAY, start: '18:45', end: '19:11' })
    })
  })
})
