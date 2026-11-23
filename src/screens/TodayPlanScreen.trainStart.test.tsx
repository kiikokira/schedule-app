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

const addSecondBook = async () => {
  const now = new Date().toISOString()
  await db.books.add({
    id: 'b2',
    title: '数学問題集',
    subject: '数学',
    totalPages: 100,
    startDate: '2026-11-01',
    deadline: '2026-12-31',
    createdAt: now,
    updatedAt: now,
  } as never)
}

const addCycleBook = async () => {
  const now = new Date().toISOString()
  await db.books.add({
    id: 'c1',
    title: '反復本',
    subject: '英語',
    totalPages: 100,
    studyMode: 'cycles',
    totalUnits: 20,
    targetRounds: 3,
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

// 行は表示中の時間帯で特定する（配列順や未割当の出現順に依存しない）。
const rowByHours = (hours: string): HTMLElement => {
  const rows = screen
    .getAllByTestId(/plan-row-\d+/)
    .filter((r) => within(r).getByTestId('plan-row-hours').textContent === hours)
  expect(rows).toHaveLength(1)
  return rows[0]
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

  it('clears the notice when a manual pick is saved for today', async () => {
    setNow(18, 30)
    await addBook()
    await addSecondBook()
    await saveTrainSlot()
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today={TODAY} />)
    await screen.findByTestId('today-table')

    fireEvent.click(await screen.findByTestId('train-start'))
    expect(await screen.findByTestId('train-start-notice')).toBeInTheDocument()
    expect(await screen.findByTestId('train-start-reset')).toBeInTheDocument()

    // 2冊目があると枠が15分単位で分かれるため、時間帯ではなく先頭行の現在値から
    // 必ず別の本を選ぶ（行の分割位置に依存しない）。
    const firstSelect = within(screen.getAllByTestId(/plan-row-\d+/)[0]).getByRole('combobox') as HTMLSelectElement
    fireEvent.change(firstSelect, { target: { value: firstSelect.value === 'b1' ? 'b2' : 'b1' } })
    fireEvent.click(await screen.findByTestId('save-today-override'))

    await waitFor(() => {
      expect(screen.queryByTestId('train-start-notice')).not.toBeInTheDocument()
    })
    expect(screen.queryByTestId('train-start-reset')).not.toBeInTheDocument()
    expect(localStorage.getItem(`schedule-app-train-start:${TODAY}`)).toBeNull()
  })

  it('clears the notice and loads the new day backup when the date changes', async () => {
    setNow(18, 30)
    await addBook()
    await saveTrainSlot()
    const { rerender } = render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today={TODAY} />)
    fireEvent.click(await screen.findByTestId('train-start'))
    expect(await screen.findByTestId('train-start-notice')).toBeInTheDocument()
    expect(await screen.findByTestId('train-start-reset')).toBeInTheDocument()
    expect(localStorage.getItem(`schedule-app-train-start:${TODAY}`)).not.toBeNull()

    const TOMORROW = '2026-11-22'
    localStorage.setItem(
      `schedule-app-train-start:${TOMORROW}`,
      JSON.stringify({
        backup: [
          {
            id: 'tomorrow-train',
            weekday: null,
            date: TOMORROW,
            start: '10:00',
            end: '11:00',
            bookId: 'b1',
          },
        ],
      }),
    )

    rerender(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today={TOMORROW} />)
    await waitFor(() => {
      expect(screen.queryByTestId('train-start-notice')).not.toBeInTheDocument()
    })
    // 前日のマーカーは消さない
    expect(localStorage.getItem(`schedule-app-train-start:${TODAY}`)).not.toBeNull()

    // 新しい日のバックアップが読み込まれ、押すとその日だけ復元される
    fireEvent.click(await screen.findByTestId('train-start-reset'))
    await screen.findByText('曜日設定に戻しました')
    await waitFor(async () => {
      const restored = (await listAvailability()).filter((a) => a.date === TOMORROW)
      expect(restored).toHaveLength(1)
      expect(restored[0]).toMatchObject({ start: '10:00', end: '11:00', bookId: 'b1' })
    })
    expect(localStorage.getItem(`schedule-app-train-start:${TOMORROW}`)).toBeNull()
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
    for (const hours of ['09:00-10:00', '17:45-19:11']) {
      fireEvent.change(within(rowByHours(hours)).getByRole('combobox'), {
        target: { value: 'b1' },
      })
    }
    await waitFor(() => expect(screen.queryByText(/未割当/)).not.toBeInTheDocument())

    const { loadSeasonState } = await import('../data/seasonStore')
    // 2行目（17:45-19:11）をスキップ：元キーは 17:33-19:11
    expect(screen.getAllByTestId('slot-missed-b1')).toHaveLength(2)
    fireEvent.click(within(rowByHours('17:45-19:11')).getByTestId('slot-missed-b1'))
    fireEvent.click(await screen.findByTestId('record-confirm-yes'))
    await waitFor(() => {
      const matches = loadSeasonState(TODAY).slotMatches
      expect(matches['2026-11-21#1053-1151']).toBeDefined()
      expect(matches['2026-11-21#1065-1151']).toBeUndefined()
    })

    // 続けて1行目（09:00-10:00）をスキップ：元キーは 08:30-10:00
    await waitFor(() => expect(screen.getAllByTestId('slot-missed-b1')).toHaveLength(1))
    fireEvent.click(within(rowByHours('09:00-10:00')).getByTestId('slot-missed-b1'))
    fireEvent.click(await screen.findByTestId('record-confirm-yes'))
    await waitFor(() => {
      expect(loadSeasonState(TODAY).slotMatches['2026-11-21#510-600']).toBeDefined()
    })
  })

  it('uses the origin key for a gap sub-row of a clipped train slot', async () => {
    setNow(20, 0)
    await addBook()
    await addCycleBook()
    await saveAvailabilitySlot(
      { id: 'train', weekday: null, date: TODAY, start: '18:30', end: '19:11', onTrain: true, originStart: '17:33', originEnd: '19:11' },
      true,
    )
    await saveAvailabilitySlot(
      { id: 'pin', weekday: null, date: TODAY, start: '18:45', end: '18:55', bookId: 'c1' },
      true,
    )
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today={TODAY} />)
    await screen.findByTestId('today-table')
    // 18:30-18:45 の未割当ギャップ行に本を付ける
    fireEvent.change(within(rowByHours('18:30-18:45')).getByRole('combobox'), {
      target: { value: 'b1' },
    })
    await waitFor(() => {
      expect(rowByHours('18:30-18:45')).toHaveTextContent('英文法書')
    })

    fireEvent.click(within(rowByHours('18:30-18:45')).getByTestId('slot-missed-b1'))
    fireEvent.click(await screen.findByTestId('record-confirm-yes'))
    const { loadSeasonState, autoForfeitPastSlots } = await import('../data/seasonStore')
    await waitFor(() => {
      const matches = loadSeasonState(TODAY).slotMatches
      expect(matches['2026-11-21#1053-1151']).toBeDefined()
      expect(matches['2026-11-21#1110-1125']).toBeUndefined()
    })

    // 翌日の自動敗戦が同じ元キーを二重に確定させない
    const withBook = (await listAvailability()).map((a) =>
      a.id === 'train' ? { ...a, bookId: 'b1' } : a,
    )
    const forfeited = autoForfeitPastSlots('2026-11-22', withBook, await db.books.toArray())
    expect(forfeited).not.toContain('2026-11-21#1053-1151')
  })

  it('keeps the override message and the train start notice independent', async () => {
    setNow(18, 30)
    await addBook()
    await saveTrainSlot()
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today={TODAY} />)
    await screen.findByTestId('today-table')
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
