import type { WorldDef, WorldId } from '../lib/rpgWorlds'

type Props = {
  worlds: WorldDef[]
  unlocked: number
  selected: WorldId
  onSelect: (id: WorldId) => void
  disabled: boolean
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
              <span style={{ fontSize: 22, lineHeight: 1 }}>{locked ? '🔒' : w.theme === 'grass' ? '🌳' : w.theme === 'desert' ? '🌵' : w.theme === 'snow' ? '⛄' : w.theme === 'sea' ? '🌴' : w.theme === 'forest' ? '🌲' : w.theme === 'rock' ? '⛰️' : w.theme === 'cloud' ? '☁️' : w.theme === 'lava' ? '🌋' : '🌈'}</span>
              <span style={{ fontSize: 11 }}>{locked ? `Lv${(w.id - 1) * 10 + 1}〜` : w.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
