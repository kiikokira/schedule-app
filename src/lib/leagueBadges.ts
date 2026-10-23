export type LeagueBadgeDiv = 1 | 2 | 3
export type LeagueBadgeId = 'div1' | 'div2' | 'div3'
export type LeagueBadgeAward = { uid: string; badgeId: LeagueBadgeId; div: LeagueBadgeDiv; seasonId: string; awardedAt: string }
export type LeagueBadgeState = { awards: LeagueBadgeAward[]; equipped: string[] }

export const MAX_EQUIPPED_BADGES = 3
const KEY = 'schedule-app-league-badges-v1'
const SEASON_RE = /^\d{4}-\d{2}-\d{2}$/

export const LEAGUE_BADGE_DEFS: Record<LeagueBadgeDiv, { badgeId: LeagueBadgeId; name: string; from: string; to: string; rim: string }> = {
  1: { badgeId: 'div1', name: 'Div1到達', from: '#ff5a52', to: '#b81f1f', rim: '#e8c47a' },
  2: { badgeId: 'div2', name: 'Div2到達', from: '#ffb020', to: '#c96a00', rim: '#e8c47a' },
  3: { badgeId: 'div3', name: 'Div3到達', from: '#3ddc74', to: '#0f8a3d', rim: '#c0c0c0' },
}

export function badgeIdForDiv(div: number): LeagueBadgeId | null {
  if (div === 1) return 'div1'
  if (div === 2) return 'div2'
  if (div === 3) return 'div3'
  return null
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
      ? p.awards.filter((a) => a && typeof a.uid === 'string' && (a.div === 1 || a.div === 2 || a.div === 3) && typeof a.seasonId === 'string' && a.uid === `${a.seasonId}:div${a.div}` && a.badgeId === `div${a.div}`)
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

// 条件を満たすシーズンにバッジを付与（冪等）。新規付与したuidを返す。
export function ensureLeagueBadgeForSeason(seasonId: string, div: number): string[] {
  try {
    if (typeof seasonId !== 'string' || !SEASON_RE.test(seasonId)) return []
    if (div !== 1 && div !== 2 && div !== 3) return []
    const uid = `${seasonId}:div${div}`
    const s = loadLeagueBadges()
    if (s.awards.some((a) => a.uid === uid)) return []
    s.awards.push({ uid, badgeId: `div${div}` as LeagueBadgeId, div, seasonId, awardedAt: new Date().toISOString() })
    saveLeagueBadges(s)
    return [uid]
  } catch {
    return []
  }
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
