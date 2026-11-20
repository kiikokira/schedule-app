import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

  it('shows the reset button even after the train time has passed', async () => {
    setNow(18, 30)
    await addBook()
    await saveTrainSlot()
    render(<TodayPlanScreen onBack={() => {}} onSettings={() => {}} today={TODAY} />)
    fireEvent.click(await screen.findByTestId('train-start'))
    await screen.findByText('スタート時刻から割り直しました')

    setNow(19, 30)
    fireEvent.click(await screen.findByTestId('today-override-toggle'))
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

    // 18:45 まで時間が進んだ状態で押し直す。
    // nowMin は描画時の時刻なので、時計を進めた後にもう一度描画させる。
    setNow(18, 45)
    fireEvent.click(await screen.findByTestId('today-override-toggle'))
    fireEvent.click(await screen.findByTestId('train-start'))
    await waitFor(async () => {
      const all = await listAvailability()
      const train = all.find((a) => a.onTrain)
      expect(train).toMatchObject({ date: TODAY, start: '18:45', end: '19:11' })
    })
  })
})
