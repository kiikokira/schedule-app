import { useEffect, useRef, useState } from 'react'
import {
  WORLD_DEFS,
  nodeForLevel,
  unlockedWorldCount,
  worldForLevel,
  worldDef,
  type EdgeKind,
  type WorldId,
} from '../lib/rpgWorlds'
import RpgMap, { type PlayingState } from './RpgMap'
import RpgWorldSelect from './RpgWorldSelect'

export const RPG_ENTER_DELAY_MS = 1600
export const RPG_EDGE_MS: Record<EdgeKind, number> = { walk: 550, ladder: 750, jump: 700 }

type Props = {
  level: number
  token: string
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

export default function RpgAdventure({ level, token }: Props) {
  const homeWorld = worldForLevel(level)
  const unlocked = unlockedWorldCount(level)
  const [selected, setSelected] = useState<WorldId>(homeWorld)
  const [entering, setEntering] = useState(false)
  const [playing, setPlaying] = useState<PlayingState>(null)
  const timers = useRef<number[]>([])

  useEffect(() => () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }, [])

  const later = (ms: number, fn: () => void) => {
    const t = window.setTimeout(fn, prefersReducedMotion() ? 0 : ms)
    timers.current.push(t)
  }

  const targetOf = (worldId: WorldId): number =>
    worldId < homeWorld ? 9 : nodeForLevel(worldId, level)

  const busy = entering || playing !== null

  const handleSelect = (id: WorldId) => {
    if (id === selected || busy) return
    setPlaying(null)
    setEntering(true)
    later(RPG_ENTER_DELAY_MS, () => {
      setSelected(id)
      setEntering(false)
    })
  }

  const handlePlay = () => {
    if (busy) return
    const def = worldDef(selected)
    const target = targetOf(selected)
    const step = (idx: number) => {
      if (idx >= target) {
        setPlaying(null)
        return
      }
      const kind = def.edges[idx].kind
      later(RPG_EDGE_MS[kind], () => {
        if (idx + 1 >= target) {
          setPlaying(null)
          return
        }
        setPlaying({ nodeIndex: idx + 1, edgeKind: def.edges[idx + 1].kind })
        step(idx + 1)
      })
    }
    if (target === 0) {
      setPlaying(null)
      return
    }
    setPlaying({ nodeIndex: 0, edgeKind: def.edges[0].kind })
    step(0)
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
          <RpgMap world={def} level={level} token={token} playing={playing} />
          <button
            data-testid="rpg-play"
            type="button"
            onClick={handlePlay}
            disabled={busy}
            style={{ marginTop: 8, width: '100%' }}
          >
            {playing !== null ? 'ぼうけん中…' : 'ぼうけんスタート'}
          </button>
        </div>
      )}
    </div>
  )
}
