import { beforeEach, describe, it, expect } from 'vitest'
import { db } from '../db/database'
import {
  parseOperationReply,
  describeOperation,
  applyOperation,
} from './aiOperations'
import type { AvailabilitySlot } from '../data/dayplanStore'

beforeEach(async () => {
  await db.books.clear()
  await db.availability.clear()
})

const book = {
  id: 'b-leap',
  title: 'LEAP',
  subject: '英単語',
  totalPages: 100,
  startDate: '2026-09-01',
  deadline: '2026-09-28',
  createdAt: 'x',
  updatedAt: 'x',
} as never

const slot: AvailabilitySlot = {
  id: 's1',
  weekday: 1,
  date: null,
  start: '06:30',
  end: '07:00',
}

describe('parseOperationReply', () => {
  it('parses a fenced pin_book operation', () => {
    const text = '了解です。\n```json\n{"op":"pin_book","slotId":"s1","bookId":"b-leap"}\n```'
    expect(parseOperationReply(text)).toEqual({
      ok: true,
      op: { kind: 'pin_book', slotId: 's1', bookId: 'b-leap' },
    })
  })

  it('parses a raw add_availability operation', () => {
    const text = '{"op":"add_availability","weekday":6,"date":null,"start":"17:45","end":"19:00"}'
    const res = parseOperationReply(text)
    expect(res.ok).toBe(true)
  })

  it('rejects unknown operations', () => {
    expect(parseOperationReply('{"op":"delete_everything"}').ok).toBe(false)
  })

  it('rejects pin_book with missing fields', () => {
    expect(parseOperationReply('{"op":"pin_book","slotId":"s1"}').ok).toBe(false)
  })

  it('returns none when there is no operation', () => {
    expect(parseOperationReply('今日は頑張りましょう')).toEqual({ ok: true, op: null })
  })
})

describe('describeOperation', () => {
  it('describes pin_book in plain words', () => {
    const books = new Map([['b-leap', 'LEAP']])
    const slots = new Map([['s1', '月曜 06:30-07:00']])
    expect(
      describeOperation({ kind: 'pin_book', slotId: 's1', bookId: 'b-leap' }, { books, slots }),
    ).toContain('LEAP')
  })
})

describe('applyOperation', () => {
  it('pins a book to a slot', async () => {
    await db.books.add(book as never)
    await db.availability.add({ ...slot })
    const res = await applyOperation({ kind: 'pin_book', slotId: 's1', bookId: 'b-leap' })
    expect(res.ok).toBe(true)
    expect((await db.availability.get('s1'))?.bookId).toBe('b-leap')
  })

  it('rejects pinning to a missing slot or book', async () => {
    expect((await applyOperation({ kind: 'pin_book', slotId: 'nope', bookId: 'b-leap' })).ok).toBe(false)
    await db.books.add(book as never)
    expect((await applyOperation({ kind: 'pin_book', slotId: 's1', bookId: 'nope' })).ok).toBe(false)
  })

  it('adds an availability slot with valid times', async () => {
    const res = await applyOperation({
      kind: 'add_availability',
      weekday: 6,
      date: null,
      start: '17:45',
      end: '19:00',
    })
    expect(res.ok).toBe(true)
    expect(await db.availability.count()).toBe(1)
  })

  it('rejects invalid time ranges', async () => {
    expect(
      (
        await applyOperation({ kind: 'add_availability', weekday: 1, date: null, start: '19:00', end: '17:45' })
      ).ok,
    ).toBe(false)
    expect(
      (await applyOperation({ kind: 'add_availability', weekday: 1, date: null, start: 'xx', end: '19:00' })).ok,
    ).toBe(false)
  })

  it('removes an availability slot', async () => {
    await db.availability.add({ ...slot })
    const res = await applyOperation({ kind: 'remove_availability', slotId: 's1' })
    expect(res.ok).toBe(true)
    expect(await db.availability.get('s1')).toBeUndefined()
  })
})
