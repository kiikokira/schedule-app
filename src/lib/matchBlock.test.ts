import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db/database'
import { subtractWindow, watchMatch, skipMatch, restoreMatch, getWatchDecision } from './matchBlock'

const min = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

describe('subtractWindow', () => {
  it('splits a slot around the window', () => {
    expect(subtractWindow([{ startMin: min('09:00'), endMin: min('12:00') }], '10:00', '11:00')).toEqual([
      { startMin: min('09:00'), endMin: min('10:00') },
      { startMin: min('11:00'), endMin: min('12:00') },
    ])
  })
  it('drops a fully covered slot and keeps untouched ones', () => {
    expect(subtractWindow([{ startMin: min('10:00'), endMin: min('11:00') }], '09:00', '12:00')).toEqual([])
  })
  it('treats touching edges as no overlap', () => {
    expect(subtractWindow([{ startMin: min('09:00'), endMin: min('10:00') }], '10:00', '11:00')).toEqual([
      { startMin: min('09:00'), endMin: min('10:00') },
    ])
  })
})

describe('watch/skip/restore', () => {
  beforeEach(async () => {
    localStorage.clear()
    await db.availability.clear()
    await db.availability.add({ id: 'd1', weekday: null, date: '2026-11-14', start: '19:00', end: '22:00' })
  })
  it('watchMatch removes the match window and records the decision', async () => {
    const res = await watchMatch('2026-11-14-vs-brazil')
    expect(res).toEqual({ ok: true })
    expect(getWatchDecision('2026-11-14-vs-brazil')).toBe('watch')
    const day = await db.availability.where('date').equals('2026-11-14').toArray()
    expect(day.map((s) => `${s.start}-${s.end}`).sort()).toEqual(['19:00-19:05', '21:20-22:00'])
  })
  it('restoreMatch brings back the original slots', async () => {
    await watchMatch('2026-11-14-vs-brazil')
    const res = await restoreMatch('2026-11-14-vs-brazil')
    expect(res).toEqual({ ok: true })
    expect(getWatchDecision('2026-11-14-vs-brazil')).toBeNull()
    const day = await db.availability.where('date').equals('2026-11-14').toArray()
    expect(day).toMatchObject([{ id: 'd1', date: '2026-11-14', start: '19:00', end: '22:00' }])
  })
  it('skipMatch without prior watch leaves existing date-slots untouched', async () => {
    const res = await skipMatch('2026-11-14-vs-brazil')
    expect(res).toEqual({ ok: true })
    expect(getWatchDecision('2026-11-14-vs-brazil')).toBe('skip')
    const day = await db.availability.where('date').equals('2026-11-14').toArray()
    expect(day).toMatchObject([{ id: 'd1', date: '2026-11-14', start: '19:00', end: '22:00' }])
  })
  it('skipMatch after watch restores the original slots', async () => {
    await watchMatch('2026-11-14-vs-brazil')
    const res = await skipMatch('2026-11-14-vs-brazil')
    expect(res).toEqual({ ok: true })
    expect(getWatchDecision('2026-11-14-vs-brazil')).toBe('skip')
    const day = await db.availability.where('date').equals('2026-11-14').toArray()
    expect(day).toMatchObject([{ id: 'd1', date: '2026-11-14', start: '19:00', end: '22:00' }])
  })
  it('rejects unknown matches', async () => {
    expect(await watchMatch('no-such-match')).toEqual({ ok: false, error: '試合が見つかりません' })
    expect(await skipMatch('no-such-match')).toEqual({ ok: false, error: '試合が見つかりません' })
    expect(await restoreMatch('no-such-match')).toEqual({ ok: false, error: '試合が見つかりません' })
  })
})
