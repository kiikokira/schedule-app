import { db } from '../db/database'
import {
  listAvailability,
  saveAvailabilitySlot,
  deleteAvailabilitySlot,
  type AvailabilitySlot,
} from '../data/dayplanStore'

export type AiOperation =
  | { kind: 'pin_book'; slotId: string; bookId: string }
  | { kind: 'unpin_book'; slotId: string }
  | { kind: 'add_availability'; weekday: number | null; date: string | null; start: string; end: string; bookId?: string }
  | { kind: 'remove_availability'; slotId: string }

export type ParseResult =
  | { ok: true; op: AiOperation | null }
  | { ok: false; error: string }

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function extractJson(text: string): string | null {
  const fenced = text.match(/```json\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  const trimmed = text.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed
  return null
}

export function parseOperationReply(text: string): ParseResult {
  const raw = extractJson(text)
  if (!raw) return { ok: true, op: null }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: '操作JSONを読み取れませんでした' }
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: '操作の形式が正しくありません' }
  }
  const o = parsed as Record<string, unknown>
  switch (o.op) {
    case 'pin_book':
      if (typeof o.slotId === 'string' && typeof o.bookId === 'string') {
        return { ok: true, op: { kind: 'pin_book', slotId: o.slotId, bookId: o.bookId } }
      }
      return { ok: false, error: 'pin_bookにはslotIdとbookIdが必要です' }
    case 'unpin_book':
      if (typeof o.slotId === 'string') {
        return { ok: true, op: { kind: 'unpin_book', slotId: o.slotId } }
      }
      return { ok: false, error: 'unpin_bookにはslotIdが必要です' }
    case 'add_availability':
      if (
        (typeof o.weekday === 'number' || o.weekday === null) &&
        (typeof o.date === 'string' || o.date === null) &&
        typeof o.start === 'string' &&
        typeof o.end === 'string' &&
        (o.bookId === undefined || typeof o.bookId === 'string')
      ) {
        return {
          ok: true,
          op: { kind: 'add_availability', weekday: o.weekday, date: o.date, start: o.start, end: o.end, bookId: o.bookId },
        }
      }
      return { ok: false, error: 'add_availabilityにはweekday・date・start・endが必要です' }
    case 'remove_availability':
      if (typeof o.slotId === 'string') {
        return { ok: true, op: { kind: 'remove_availability', slotId: o.slotId } }
      }
      return { ok: false, error: 'remove_availabilityにはslotIdが必要です' }
    default:
      return { ok: false, error: '未対応の操作です' }
  }
}

export type OpContext = {
  books: Map<string, string>
  slots: Map<string, string>
}

export function slotLabel(s: AvailabilitySlot): string {
  const when =
    s.date !== null
      ? s.date
      : s.weekday !== null
        ? ['日曜', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜'][s.weekday]
        : '毎日'
  return `${when} ${s.start}-${s.end}`
}

export function describeOperation(op: AiOperation, ctx: OpContext): string {
  switch (op.kind) {
    case 'pin_book': {
      const book = ctx.books.get(op.bookId) ?? op.bookId
      const slot = ctx.slots.get(op.slotId) ?? op.slotId
      return `${slot}の学習内容を「${book}」に変更します。`
    }
    case 'unpin_book': {
      const slot = ctx.slots.get(op.slotId) ?? op.slotId
      return `${slot}の本の固定を外し、自動割り当てに戻します。`
    }
    case 'add_availability': {
      const when = op.date !== null ? op.date : op.weekday !== null ? ['日曜', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜'][op.weekday] : '毎日'
      const book = op.bookId ? `「${ctx.books.get(op.bookId) ?? op.bookId}」` : ''
      return `${when} ${op.start}-${op.end}の時間帯${book ? `（${book}）` : ''}を追加します。`
    }
    case 'remove_availability': {
      const slot = ctx.slots.get(op.slotId) ?? op.slotId
      return `${slot}の時間帯を削除します。`
    }
  }
}

export type ApplyResult = { ok: true; message: string } | { ok: false; error: string }

export async function applyOperation(op: AiOperation): Promise<ApplyResult> {
  switch (op.kind) {
    case 'pin_book': {
      const slot = await db.availability.get(op.slotId)
      if (!slot) return { ok: false, error: '指定の時間帯が見つかりません' }
      const book = await db.books.get(op.bookId)
      if (!book) return { ok: false, error: '指定の参考書が見つかりません' }
      await saveAvailabilitySlot({ ...slot, bookId: op.bookId }, false)
      return { ok: true, message: '時間帯の学習内容を変更しました' }
    }
    case 'unpin_book': {
      const slot = await db.availability.get(op.slotId)
      if (!slot) return { ok: false, error: '指定の時間帯が見つかりません' }
      const next = { ...slot }
      delete next.bookId
      await saveAvailabilitySlot(next, false)
      return { ok: true, message: '時間帯の固定を外しました' }
    }
    case 'add_availability': {
      if (!TIME_RE.test(op.start) || !TIME_RE.test(op.end) || !(op.start < op.end)) {
        return { ok: false, error: '時刻の形式または範囲が正しくありません' }
      }
      if (op.bookId) {
        const book = await db.books.get(op.bookId)
        if (!book) return { ok: false, error: '指定の参考書が見つかりません' }
      }
      await saveAvailabilitySlot(
        {
          id: crypto.randomUUID(),
          weekday: op.weekday,
          date: op.date,
          start: op.start,
          end: op.end,
          ...(op.bookId ? { bookId: op.bookId } : {}),
        },
        true,
      )
      return { ok: true, message: '時間帯を追加しました' }
    }
    case 'remove_availability': {
      const slot = await db.availability.get(op.slotId)
      if (!slot) return { ok: false, error: '指定の時間帯が見つかりません' }
      await deleteAvailabilitySlot(op.slotId)
      return { ok: true, message: '時間帯を削除しました' }
    }
  }
}

export async function buildOpContext(): Promise<OpContext> {
  const [books, slots] = await Promise.all([db.books.toArray(), listAvailability()])
  return {
    books: new Map(books.map((b) => [b.id, b.title])),
    slots: new Map(slots.map((s) => [s.id, slotLabel(s)])),
  }
}
