// src/lib/ghost.ts
export type GhostLogPoint = { atMs: number; total: number }

export type GhostCurve =
  | { kind: 'none' }
  | { kind: 'uniform'; total: number }
  | { kind: 'events'; points: { elapsedMin: number; total: number }[]; total: number }

export function findGhostDate(totals: Record<string, number>, today: string): string | null {
  let best: string | null = null
  let bestTotal = -1
  for (const [date, total] of Object.entries(totals)) {
    if (date >= today) continue
    if (!Number.isFinite(total) || total <= 0) continue
    if (total > bestTotal || (total === bestTotal && (best === null || date > best))) {
      best = date
      bestTotal = total
    }
  }
  return best
}

function cleanEvents(events: GhostLogPoint[]): { elapsedMin: number; total: number }[] {
  const valid = events.filter((e) => Number.isFinite(e.atMs) && Number.isFinite(e.total) && e.total >= 0)
  if (valid.length < 2) return []
  const sorted = [...valid].sort((a, b) => a.atMs - b.atMs)
  const first = sorted[0].atMs
  const points = sorted.map((e) => ({ elapsedMin: Math.max(0, Math.round((e.atMs - first) / 60000)), total: Math.floor(e.total) }))
  const deduped: { elapsedMin: number; total: number }[] = []
  for (const p of points) {
    const last = deduped[deduped.length - 1]
    if (last && last.elapsedMin === p.elapsedMin) {
      last.total = p.total
    } else {
      deduped.push({ ...p })
    }
  }
  return deduped.length >= 2 ? deduped : []
}

export function buildGhostCurve(opts: { total: number; events: GhostLogPoint[] }): GhostCurve {
  const total = Number.isFinite(opts.total) && opts.total > 0 ? Math.floor(opts.total) : 0
  if (total <= 0) return { kind: 'none' }
  const points = cleanEvents(opts.events ?? [])
  if (points.length < 2) return { kind: 'uniform', total }
  return { kind: 'events', points, total }
}

export function ghostTotalAt(curve: GhostCurve, elapsedMin: number, todayTotalMinutes: number): number {
  if (curve.kind === 'none') return 0
  if (!Number.isFinite(elapsedMin) || elapsedMin <= 0) return 0
  if (curve.kind === 'uniform') {
    if (!Number.isFinite(todayTotalMinutes) || todayTotalMinutes <= 0) return 0
    if (elapsedMin >= todayTotalMinutes) return curve.total
    return Math.floor((curve.total * elapsedMin) / todayTotalMinutes)
  }
  const pts = curve.points
  if (elapsedMin >= pts[pts.length - 1].elapsedMin) return curve.total
  for (let i = 1; i < pts.length; i++) {
    if (elapsedMin <= pts[i].elapsedMin) {
      const a = pts[i - 1]
      const b = pts[i]
      const span = b.elapsedMin - a.elapsedMin
      if (span <= 0) return b.total
      const ratio = (elapsedMin - a.elapsedMin) / span
      return Math.floor(a.total + (b.total - a.total) * ratio)
    }
  }
  return curve.total
}

export function todaySlotBounds(slots: { startMin: number; endMin: number }[]): { startMin: number; totalMinutes: number } | null {
  if (slots.length === 0) return null
  const sorted = [...slots].sort((a, b) => a.startMin - b.startMin)
  const startMin = sorted[0].startMin
  const totalMinutes = sorted.reduce((s, x) => s + Math.max(0, x.endMin - x.startMin), 0)
  if (!Number.isFinite(startMin) || totalMinutes <= 0) return null
  return { startMin, totalMinutes }
}
