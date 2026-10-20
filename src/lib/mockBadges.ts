import type { MockRecord } from './mockHistory'

export type Badge = { id: string; name: string; unlocked: boolean; hint: string }

function isConsecutive3(history: MockRecord[]): boolean {
  if (history.length < 3) return false
  const sorted = [...history].sort((a, b) => (a.ym < b.ym ? -1 : 1))
  const last3 = sorted.slice(-3)
  const [a, b, c] = last3.map((r) => r.ym)
  const nextYm = (ym: string): string => {
    const y = Number(ym.slice(0, 4))
    const m = Number(ym.slice(5, 7))
    const nm = m === 12 ? 1 : m + 1
    const ny = m === 12 ? y + 1 : y
    return `${ny}-${String(nm).padStart(2, '0')}`
  }
  return nextYm(a) === b && nextYm(b) === c
}

export function listBadges(history: MockRecord[]): Badge[] {
  const sorted = [...history].sort((a, b) => (a.ym < b.ym ? -1 : 1))
  const latest = sorted[sorted.length - 1]
  const prev = sorted[sorted.length - 2]
  const first = sorted.length >= 1
  const streak3 = isConsecutive3(sorted)
  const best = latest != null && sorted.length > 1 && latest.deviation > Math.max(...sorted.slice(0, -1).map((r) => r.deviation))
  const jump = latest != null && prev != null && latest.deviation - prev.deviation >= 3
  const top10 = latest != null && latest.rank <= 20000
  return [
    { id: 'first', name: '初陣', unlocked: first, hint: first ? '模試デビュー！' : '第1週に記録で獲得' },
    { id: 'streak3', name: '3連続受験', unlocked: streak3, hint: streak3 ? '3ヶ月連続！' : `あと${Math.max(0, 3 - sorted.length)}ヶ月で獲得` },
    { id: 'best', name: '自己ベスト', unlocked: best, hint: best ? '過去最高を更新！' : '偏差値の最高更新で獲得' },
    { id: 'jump', name: 'ジャンプ賞', unlocked: jump, hint: jump ? '前回比+3達成！' : '前回比+3で獲得' },
    { id: 'top10', name: '上位10%', unlocked: top10, hint: top10 ? '2万位以内！' : '20,000位以内で獲得' },
  ]
}
