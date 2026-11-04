import { useEffect, useRef, useState } from 'react'
import {
  WORLD_DEFS,
  unlockedWorldCount,
  worldForLevel,
  worldDef,
  type WorldId,
} from '../lib/rpgWorlds'
import RpgWorldSelect from './RpgWorldSelect'
import RpgWorld3d from './RpgWorld3d'

export const RPG_ENTER_DELAY_MS = 1600

type Props = {
  level: number
  token: string
  todayPages?: number
  totalPages?: number
  firstBookId?: string | null
  hasBooks?: boolean
  onStageAction?: (stageId: string, target: string, bookId?: string | null) => void
}

function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  } catch {
    return false
  }
}

export default function RpgAdventure({ level, todayPages = 0, totalPages = 0, firstBookId = null, hasBooks = false, onStageAction }: Props) {
  const homeWorld = worldForLevel(level)
  const unlocked = unlockedWorldCount(level)
  const [selected, setSelected] = useState<WorldId>(homeWorld)
  const [entering, setEntering] = useState(false)
  const timers = useRef<number[]>([])

  useEffect(() => () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }, [])

  const later = (ms: number, fn: () => void) => {
    const t = window.setTimeout(fn, prefersReducedMotion() ? 0 : ms)
    timers.current.push(t)
  }

  const busy = entering

  const handleSelect = (id: WorldId) => {
    if (id === selected || busy) return
    setEntering(true)
    later(RPG_ENTER_DELAY_MS, () => {
      setSelected(id)
      setEntering(false)
    })
  }

  const def = worldDef(selected)

  return (
    <div>
      <RpgWorldSelect worlds={WORLD_DEFS} unlocked={unlocked} selected={selected} onSelect={handleSelect} disabled={busy} />
      {entering ? (
        <div data-testid="rpg-entering" className="rpg-spin-once" style={{ marginTop: 8, padding: 16, borderRadius: 12, background: `linear-gradient(180deg, ${def.sky[0]}, ${def.sky[1]})`, border: '1px solid var(--border)', textAlign: 'center', fontWeight: 800, fontSize: 20 }}>
          {def.name}へ…
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          <RpgWorld3d
            key={selected}
            worldId={selected}
            todayPages={todayPages}
            totalPages={totalPages}
            firstBookId={firstBookId}
            hasBooks={hasBooks}
            onStageAction={onStageAction}
          />
        </div>
      )}
    </div>
  )
}
