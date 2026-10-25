// src/components/LeagueBadgeShelf.tsx
import { useEffect, useState } from 'react'
import {
  LEAGUE_BADGE_DEFS,
  loadLeagueBadges,
  seasonLabel,
  toggleBadgeEquipped,
  type LeagueBadgeState,
} from '../lib/leagueBadges'

type Props = { seasonId: string; div: number }

const cardStyle = {
  marginTop: 8,
  marginBottom: 8,
  padding: '10px 12px',
  borderRadius: 8,
  background: '#151a30',
  border: '1px solid #2a3358',
  color: '#fff',
} as const

export default function LeagueBadgeShelf({ seasonId }: Props) {
  const [state, setState] = useState<LeagueBadgeState>({ awards: [], equipped: [] })
  const [limited, setLimited] = useState(false)
  useEffect(() => {
    try {
      setState(loadLeagueBadges())
    } catch { /* ignore */ }
  }, [seasonId])
  // Spec §8: hide shelf on invalid date (after hooks to keep hook order stable).
  if (typeof seasonId !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(seasonId)) return null
  const byUid = new Map(state.awards.map((a) => [a.uid, a]))
  const onToggle = (uid: string) => {
    try {
      const r = toggleBadgeEquipped(uid)
      setState(loadLeagueBadges())
      setLimited(!r.ok && r.reason === 'full')
    } catch { /* ignore */ }
  }
  return (
    <section data-testid="league-badge-shelf" style={cardStyle}>
      <div style={{ fontWeight: 800, fontSize: 16 }}>リーグバッジ</div>
      <div style={{ fontSize: 12, color: '#9aa3c0' }}>今フェーズの最高グレードを1個獲得（1試合以上が条件）。最大3つまで表示</div>
      <div data-testid="league-badge-equipped" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {[0, 1, 2].map((i) => {
          const uid = state.equipped[i]
          const a = uid ? byUid.get(uid) : undefined
          if (!a) {
            return (
              <div
                key={`empty-${i}`}
                data-testid="league-badge-empty-slot"
                style={{ width: 56, height: 72, borderRadius: 12, border: '2px dashed #2a3358' }}
              />
            )
          }
          const def = LEAGUE_BADGE_DEFS[a.badgeId] ?? LEAGUE_BADGE_DEFS.div3
          return (
            <button
              key={uid}
              type="button"
              data-testid="league-badge"
              data-uid={uid}
              onClick={() => onToggle(uid)}
              aria-label={`${def.name} ${seasonLabel(a.seasonId)}`}
              title={`${def.name} ${seasonLabel(a.seasonId)}`}
              style={{ position: 'relative', padding: 0, background: 'transparent', border: '3px solid #29b6ff', borderRadius: 12, cursor: 'pointer' }}
            >
              <img src={def.img} alt={def.name} width={56} height={56} data-testid={`league-badge-img-${a.badgeId}`} style={{ display: 'block', borderRadius: 8 }} />
              <span
                data-testid="league-badge-slot"
                style={{
                  position: 'absolute',
                  right: 0,
                  bottom: 0,
                  minWidth: 20,
                  height: 20,
                  padding: '0 4px',
                  background: '#29b6ff',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {i + 1}
              </span>
            </button>
          )
        })}
      </div>
      {state.awards.length === 0 ? (
        <div data-testid="league-badge-empty" style={{ fontSize: 13, color: '#9aa3c0', marginTop: 8 }}>
          まだバッジなし、今フェーズの最高グレードを1個獲得（1試合以上が条件）で手に入れよう
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 8, marginTop: 8 }}>
          {state.awards.map((a) => {
            const def = LEAGUE_BADGE_DEFS[a.badgeId] ?? LEAGUE_BADGE_DEFS.div3
            const idx = state.equipped.indexOf(a.uid)
            return (
              <div key={a.uid} data-testid="league-badge-cell" data-uid={a.uid} title={`${def.name} ${seasonLabel(a.seasonId)}`}>
                <button
                  type="button"
                  data-testid="league-badge"
                  onClick={() => onToggle(a.uid)}
                  aria-label={`${def.name} ${seasonLabel(a.seasonId)}`}
                  style={{
                    position: 'relative',
                    padding: 0,
                    background: 'transparent',
                    border: idx !== -1 ? '3px solid #29b6ff' : '1px solid #2a3358',
                    borderRadius: 12,
                    cursor: 'pointer',
                  }}
                >
                  <img src={def.img} alt={def.name} width={56} height={56} data-testid={`league-badge-img-${a.badgeId}`} style={{ display: 'block', borderRadius: 8 }} />
                  {idx !== -1 && (
                    <span
                      data-testid="league-badge-slot"
                      style={{
                        position: 'absolute',
                        right: 0,
                        bottom: 0,
                        minWidth: 20,
                        height: 20,
                        padding: '0 4px',
                        background: '#29b6ff',
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 900,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {idx + 1}
                    </span>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}
      {limited && (
        <div data-testid="league-badge-limit" style={{ fontSize: 13, color: '#ffb020', marginTop: 8 }}>
          表示は3つまでだよ。外してから付けてね
        </div>
      )}
    </section>
  )
}
