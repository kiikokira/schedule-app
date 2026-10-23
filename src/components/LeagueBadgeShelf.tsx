// src/components/LeagueBadgeShelf.tsx
import { useEffect, useState } from 'react'
import {
  LEAGUE_BADGE_DEFS,
  ensureLeagueBadgeForSeason,
  loadLeagueBadges,
  seasonLabel,
  toggleBadgeEquipped,
  type LeagueBadgeState,
} from '../lib/leagueBadges'
import LeagueBadge from './LeagueBadge'

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

export default function LeagueBadgeShelf({ seasonId, div }: Props) {
  const [state, setState] = useState<LeagueBadgeState>({ awards: [], equipped: [] })
  const [justGranted, setJustGranted] = useState<string[]>([])
  const [limited, setLimited] = useState(false)
  useEffect(() => {
    try {
      const granted = ensureLeagueBadgeForSeason(seasonId, div)
      setJustGranted(granted)
      setState(loadLeagueBadges())
    } catch { /* ignore */ }
  }, [seasonId, div])
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
      <div style={{ fontSize: 12, color: '#9aa3c0' }}>Div3/Div2/Div1到達で毎シーズン獲得。最大3つまで表示</div>
      <div data-testid="league-badge-equipped" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {[0, 1, 2].map((i) => {
          const uid = state.equipped[i]
          const a = uid ? byUid.get(uid) : undefined
          return a ? (
            <LeagueBadge
              key={uid}
              div={a.div}
              seasonLabel={seasonLabel(a.seasonId)}
              equipped
              slotNumber={i + 1}
              isNew={justGranted.includes(uid)}
              size={56}
              onClick={() => onToggle(uid)}
            />
          ) : (
            <div
              key={`empty-${i}`}
              data-testid="league-badge-empty-slot"
              style={{ width: 56, height: 72, borderRadius: 12, border: '2px dashed #2a3358' }}
            />
          )
        })}
      </div>
      {state.awards.length === 0 ? (
        <div data-testid="league-badge-empty" style={{ fontSize: 13, color: '#9aa3c0', marginTop: 8 }}>
          まだバッジなし、Div3以上でシーズンを迎えると獲得できるよ
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 8, marginTop: 8 }}>
          {state.awards.map((a) => {
            const def = LEAGUE_BADGE_DEFS[a.div]
            const idx = state.equipped.indexOf(a.uid)
            return (
              <div key={a.uid} data-testid="league-badge-cell" data-uid={a.uid} title={`${def.name} ${seasonLabel(a.seasonId)}`}>
                <LeagueBadge
                  div={a.div}
                  seasonLabel={seasonLabel(a.seasonId)}
                  equipped={idx !== -1}
                  slotNumber={idx !== -1 ? idx + 1 : undefined}
                  isNew={justGranted.includes(a.uid)}
                  onClick={() => onToggle(a.uid)}
                />
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
