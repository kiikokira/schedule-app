export type LeagueBadgeId = 'div3' | 'div2' | 'div1' | 'top1000' | 'top100' | 'top10'
export type LeagueBadgeAward = { uid: string; badgeId: LeagueBadgeId; seasonId: string; awardedAt: string }
export type LeagueBadgeState = { awards: LeagueBadgeAward[]; equipped: string[] }

export const MAX_EQUIPPED_BADGES = 3
const KEY = 'schedule-app-league-badges-v1'
const SEASON_RE = /^\d{4}-\d{2}-\d{2}$/

const GRADE_ORDER: LeagueBadgeId[] = ['div3', 'div2', 'div1', 'top1000', 'top100', 'top10']

export const LEAGUE_BADGE_DEFS: Record<LeagueBadgeId, { badgeId: LeagueBadgeId; name: string; img: string }> = {
  div3: { badgeId: 'div3', name: 'Division 3に到達する', img: './badges/badge-div3.jpg' },
  div2: { badgeId: 'div2', name: 'Division 2に到達する', img: './badges/badge-div2.jpg' },
  div1: { badgeId: 'div1', name: 'Division 1に到達する', img: './badges/badge-div1.jpg' },
  top1000: { badgeId: 'top1000', name: '最終順位 Top 1,000に入賞する', img: './badges/badge-top1000.jpg' },
  top100: { badgeId: 'top100', name: '最終順位 Top 100に入賞する', img: './badges/badge-top100.jpg' },
  top10: { badgeId: 'top10', name: '最終順位 Top 10に入賞する', img: './badges/badge-top10.jpg' },
}

export function seasonLabel(seasonId: string): string {
  if (typeof seasonId !== 'string' || !SEASON_RE.test(seasonId)) return '―'
  return seasonId.slice(2, 4) + '-' + seasonId.slice(5, 7)
}

function emptyState(): LeagueBadgeState {
  return { awards: [], equipped: [] }
}

export function loadLeagueBadges(): LeagueBadgeState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw == null) return emptyState()
    const p = JSON.parse(raw) as Partial<LeagueBadgeState>
    const awards = Array.isArray(p.awards)
      ? p.awards.filter((a) => a && typeof a.uid === 'string' && typeof a.seasonId === 'string' && GRADE_ORDER.includes(a.badgeId) && a.uid === `${a.seasonId}:${a.badgeId}`)
      : []
    const owned = new Set(awards.map((a) => a.uid))
    const equipped = Array.isArray(p.equipped) ? p.equipped.filter((u) => typeof u === 'string' && owned.has(u)).slice(0, MAX_EQUIPPED_BADGES) : []
    return { awards, equipped }
  } catch {
    return emptyState()
  }
}

export function saveLeagueBadges(s: LeagueBadgeState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch { /* ignore */ }
}

// そのフェーズで条件を満たしたうち最も高いグレード1個のみ付与（冪等）。新規付与したuidを返す。
export function awardPhaseBadge(seasonId: string, info: { bestDiv: number; finalRank: number; played: number }): string[] {
  if (!SEASON_RE.test(seasonId)) return []
  if (!Number.isInteger(info.played) || info.played < 1) return []
  const earned: LeagueBadgeId[] = []
  if (info.bestDiv <= 3) earned.push('div3')
  if (info.bestDiv <= 2) earned.push('div2')
  if (info.bestDiv <= 1) earned.push('div1')
  if (info.finalRank <= 1000) earned.push('top1000')
  if (info.finalRank <= 100) earned.push('top100')
  if (info.finalRank <= 10) earned.push('top10')
  if (earned.length === 0) return []
  const top = earned[earned.length - 1]
  const uid = `${seasonId}:${top}`
  const s = loadLeagueBadges()
  if (s.awards.some((a) => a.uid === uid)) return []
  s.awards.push({ uid, badgeId: top, seasonId, awardedAt: new Date().toISOString() })
  saveLeagueBadges(s)
  return [uid]
}

export function toggleBadgeEquipped(uid: string): { ok: boolean; reason?: 'missing' | 'full'; equipped: string[] } {
  try {
    const s = loadLeagueBadges()
    if (!s.awards.some((a) => a.uid === uid)) return { ok: false, reason: 'missing', equipped: s.equipped }
    if (s.equipped.includes(uid)) {
      const equipped = s.equipped.filter((u) => u !== uid)
      saveLeagueBadges({ ...s, equipped })
      return { ok: true, equipped }
    }
    if (s.equipped.length >= MAX_EQUIPPED_BADGES) return { ok: false, reason: 'full', equipped: s.equipped }
    const equipped = [...s.equipped, uid]
    saveLeagueBadges({ ...s, equipped })
    return { ok: true, equipped }
  } catch {
    return { ok: false, reason: 'missing', equipped: [] }
  }
}
