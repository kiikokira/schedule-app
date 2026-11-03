import type { WorldDef, WorldId } from '../lib/rpgWorlds'

type Props = {
  worlds: WorldDef[]
  unlocked: number
  selected: WorldId
  onSelect: (id: WorldId) => void
  disabled: boolean
}

function ThemePreview({ world }: { world: WorldDef }) {
  if (world.id === 1) {
    return (
      <img
        src={`${import.meta.env.BASE_URL}rpg/thumb-w1.png`}
        alt={`${world.name}の3Dプレビュー`}
        width="72"
        height="40"
        style={{ borderRadius: 5, objectFit: 'cover', display: 'block' }}
      />
    )
  }
  return (
    <svg viewBox="0 0 48 30" width="40" height="26" role="img" aria-label={`${world.name}のプレビュー`}>
      <rect x="0" y="0" width="48" height="30" rx="5" fill={world.sky[0]} />
      <rect x="0" y="0" width="48" height="16" rx="5" fill={world.sky[1]} opacity="0.7" />
      <ellipse cx="24" cy="26" rx="26" ry="9" fill={world.ground} />
      <path d="M 10 24 L 24 22 L 38 24" fill="none" stroke={world.road} strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="34" cy="13" r="4" fill="#fff" opacity="0.85" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" role="img" aria-label="ロック中">
      <rect x="5" y="10" width="14" height="10" rx="2.4" fill="#6b7280" />
      <path d="M 8 10 V 7.5 a 4 4 0 0 1 8 0 V 10" fill="none" stroke="#4b5563" strokeWidth="2.6" />
      <circle cx="12" cy="14.6" r="1.8" fill="#fff" />
    </svg>
  )
}

export default function RpgWorldSelect({ worlds, unlocked, selected, onSelect, disabled }: Props) {
  return (
    <div data-testid="rpg-world-select">
      <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px' }}>ワールド選択</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {worlds.map((w) => {
          const locked = w.id > unlocked
          const isSelected = w.id === selected
          return (
            <button
              key={w.id}
              type="button"
              data-testid={`rpg-world-card-${w.id}`}
              data-locked={locked ? 'true' : 'false'}
              disabled={locked || disabled}
              onClick={() => onSelect(w.id)}
              style={{
                padding: '8px 4px',
                borderRadius: 10,
                border: `2px solid ${isSelected ? 'var(--accent-strong)' : 'var(--border)'}`,
                background: locked ? '#e5e7eb' : `linear-gradient(180deg, ${w.sky[0]}, ${w.sky[1]})`,
                opacity: locked ? 0.75 : 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                minHeight: 44,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 900, background: '#8a5a2a', color: '#fff', borderRadius: 4, padding: '0 6px' }}>
                W{w.id}
              </span>
              <span style={{ fontSize: 22, lineHeight: 1 }}>{locked ? <LockIcon /> : <ThemePreview world={w} />}</span>
              <span style={{ fontSize: 11 }}>{locked ? `Lv${(w.id - 1) * 10 + 1}〜` : w.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
