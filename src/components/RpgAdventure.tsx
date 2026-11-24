import { useEffect, useRef, useState } from 'react'
import {
  WORLD_DEFS,
  unlockedWorldCount,
  worldForLevel,
  worldDef,
  type WorldId,
} from '../lib/rpgWorlds'
import { CAMPUS_WORLD_ID } from '../lib/rpgCampus'
import RpgWorldSelect from './RpgWorldSelect'
import RpgWorld3d from './RpgWorld3d'
import CampusQuestBoard, { type CampusQuestSlot } from './CampusQuestBoard'

export const RPG_ENTER_DELAY_MS = 1600

type Props = {
  level: number
  token: string
  todayPages?: number
  totalPages?: number
  firstBookId?: string | null
  hasBooks?: boolean
  onStageAction?: (stageId: string, target: string, bookId?: string | null) => void
  /** 並木道の看板に出す今日の枠（campus選択時のみ表示）。 */
  slots?: CampusQuestSlot[]
  slotsDone?: boolean
  bulletin?: string
  /** 開くワールド（10=キャンパス）。省略時はレベルから自動決定。 */
  initialWorldId?: number
  onOpenToday?: () => void
  onOpenBook?: (bookId: string) => void
}

type SelectedWorld = WorldId | typeof CAMPUS_WORLD_ID

// 9ワールド（WorldId）とキャンパス（CAMPUS_WORLD_ID=10）を足し合わせた選択状態。
const CAMPUS_DEF = { name: 'SFCキャンパス', sky: ['#8fc7f5', '#e8f4ff'] as [string, string] }

function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  } catch {
    return false
  }
}

export default function RpgAdventure({ level, todayPages = 0, totalPages = 0, firstBookId = null, hasBooks = false, onStageAction, slots, slotsDone, bulletin, initialWorldId, onOpenToday, onOpenBook }: Props) {
  const homeWorld = worldForLevel(level)
  const unlocked = unlockedWorldCount(level)
  const [selected, setSelected] = useState<SelectedWorld>(() => {
    // initialWorldId が campus(10) か 1..9 ならそれを初期表示、それ以外はホームワールド。
    if (initialWorldId === CAMPUS_WORLD_ID) return CAMPUS_WORLD_ID
    if (typeof initialWorldId === 'number' && initialWorldId >= 1 && initialWorldId <= 9) {
      return initialWorldId as WorldId
    }
    return homeWorld
  })
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

  const handleSelect = (id: SelectedWorld) => {
    if (id === selected || busy) return
    setEntering(true)
    later(RPG_ENTER_DELAY_MS, () => {
      setSelected(id)
      setEntering(false)
    })
  }

  const isCampus = selected === CAMPUS_WORLD_ID
  const def = isCampus ? CAMPUS_DEF : worldDef(selected as WorldId)

  return (
    <div>
      {/* キャンパスは9ワールドの外（worldId=10）。レベル・ロックに依存せず常に選択可。 */}
      <button
        type="button"
        data-testid="rpg-campus-card"
        data-selected={isCampus ? 'true' : 'false'}
        disabled={busy}
        onClick={() => handleSelect(CAMPUS_WORLD_ID)}
        style={{
          width: '100%',
          marginBottom: 8,
          padding: '10px 12px',
          minHeight: 44,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          textAlign: 'left',
          borderRadius: 10,
          border: `2px solid ${isCampus ? 'var(--accent-strong)' : 'var(--border)'}`,
          background: `linear-gradient(180deg, ${CAMPUS_DEF.sky[0]}, ${CAMPUS_DEF.sky[1]})`,
          fontWeight: 800,
        }}
      >
        <span style={{ fontSize: 14 }}>🏫 SFCキャンパス</span>
        <span style={{ fontSize: 11, fontWeight: 900, background: '#eab308', color: '#1e2a5a', borderRadius: 4, padding: '0 6px' }}>NEW</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#1e2a5a' }}>今日のクエストを並木道の看板でチェック</span>
      </button>
      {/* campus=10 はどの9ワールドカードにも一致しない（RpgWorldSelectは変更しない）。 */}
      <RpgWorldSelect worlds={WORLD_DEFS} unlocked={unlocked} selected={selected as WorldId} onSelect={handleSelect} disabled={busy} />
      {entering ? (
        <div data-testid="rpg-entering" className="rpg-spin-once" style={{ marginTop: 8, padding: 16, borderRadius: 12, background: `linear-gradient(180deg, ${def.sky[0]}, ${def.sky[1]})`, border: '1px solid var(--border)', textAlign: 'center', fontWeight: 800, fontSize: 20 }}>
          {def.name}へ…
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          {isCampus && (
            <CampusQuestBoard
              slots={slots ?? []}
              slotsDone={slotsDone}
              bulletin={bulletin}
              todayLabel="今日"
              onOpenToday={onOpenToday ?? (() => {})}
              onOpenBook={onOpenBook ?? (() => {})}
            />
          )}
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
