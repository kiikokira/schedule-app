// src/components/LeagueBadge.tsx
import { LEAGUE_BADGE_DEFS, type LeagueBadgeDiv } from '../lib/leagueBadges'

type Props = {
  div: LeagueBadgeDiv
  seasonLabel: string
  equipped?: boolean
  slotNumber?: number
  isNew?: boolean
  size?: number
  onClick?: () => void
}

export default function LeagueBadge({ div, seasonLabel, equipped, slotNumber, isNew, size = 64, onClick }: Props) {
  const def = LEAGUE_BADGE_DEFS[div]
  return (
    <button
      type="button"
      data-testid="league-badge"
      data-div={String(div)}
      onClick={onClick}
      aria-label={`${def.name} ${seasonLabel}`}
      style={{
        position: 'relative',
        width: size,
        height: size + 16,
        padding: 0,
        background: 'transparent',
        border: 'none',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <span
        style={{
          display: 'block',
          width: size,
          height: size,
          borderRadius: '50%',
          padding: 3,
          background: `conic-gradient(from 210deg, ${def.rim}, #fff8, ${def.rim})`,
          outline: equipped ? '3px solid #29b6ff' : 'none',
          outlineOffset: 1,
        }}
      >
        <span
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: `radial-gradient(circle at 35% 30%, ${def.from}, ${def.to})`,
          }}
        >
          <svg viewBox="0 0 64 64" width={size * 0.52} height={size * 0.52} aria-hidden="true">
            <path
              d="M32 8 L49 15 V32 C49 44 41 51 32 54 C23 51 15 44 15 32 V15 Z"
              fill="none"
              stroke="#fff"
              strokeWidth={4}
              strokeLinejoin="round"
            />
            <text x={32} y={41} textAnchor="middle" fontSize={26} fontWeight={900} fill="#fff">
              {div}
            </text>
          </svg>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{seasonLabel}</span>
        </span>
      </span>
      {equipped && slotNumber != null && (
        <span
          data-testid="league-badge-slot"
          style={{
            position: 'absolute',
            right: 0,
            bottom: 12,
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
          {slotNumber}
        </span>
      )}
      {isNew && (
        <span
          data-testid="league-badge-new"
          style={{
            position: 'absolute',
            left: 2,
            top: 2,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#29b6ff',
          }}
        />
      )}
    </button>
  )
}
