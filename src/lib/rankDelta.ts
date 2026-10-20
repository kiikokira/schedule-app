export function formatRankDelta(prev: number | null, current: number): string | null {
  if (prev == null) return null
  const diff = prev - current
  if (diff === 0) return null
  const sign = diff > 0 ? '+' : '-'
  return `${sign}${Math.abs(diff).toLocaleString()}`
}

export function deltaTone(prev: number | null, current: number): 'up' | 'down' | 'flat' {
  if (prev == null) return 'flat'
  if (prev > current) return 'up'
  if (prev < current) return 'down'
  return 'flat'
}
