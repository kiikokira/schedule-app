import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db/database'
import { appendGhostSnapshot, listGhostLogs } from './ghostLogStore'

beforeEach(async () => {
  await db.ghostLogs?.clear().catch(() => {})
})

describe('ghostLogStore', () => {
  it('appends snapshots in order', async () => {
    await appendGhostSnapshot('2026-10-23', 10, Date.parse('2026-10-23T09:00:00+09:00'))
    await appendGhostSnapshot('2026-10-23', 25, Date.parse('2026-10-23T10:00:00+09:00'))
    const rows = await listGhostLogs('2026-10-23')
    expect(rows.map((r) => r.total)).toEqual([10, 25])
  })
  it('ignores invalid total', async () => {
    await appendGhostSnapshot('2026-10-23', NaN)
    expect(await listGhostLogs('2026-10-23')).toHaveLength(0)
  })
})
