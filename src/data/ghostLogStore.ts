import { db } from '../db/database'

export type GhostLog = { id: string; date: string; atMs: number; total: number }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function appendGhostSnapshot(date: string, total: number, atMs?: number): Promise<void> {
  if (!DATE_RE.test(date)) return
  if (!Number.isFinite(total) || total < 0) return
  const at = atMs === undefined ? Date.now() : atMs
  if (!Number.isFinite(at)) return
  await db.ghostLogs.add({ id: crypto.randomUUID(), date, atMs: at, total: Math.floor(total) })
}

export async function listGhostLogs(date: string): Promise<GhostLog[]> {
  const rows = await db.ghostLogs.where('date').equals(date).toArray()
  return rows.sort((a, b) => a.atMs - b.atMs)
}

export async function clearGhostLogs(): Promise<void> {
  await db.ghostLogs.clear()
}
