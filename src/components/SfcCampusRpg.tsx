// SFCキャンパス2D RPGの画面。HUD・クエストシート・全体マップ・十字キーを
// マップカードの中にまとめ、ゲームループは SfcCampusCanvas に任せる。
import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import SfcCampusCanvas from './SfcCampusCanvas'
import type { CampusQuestSlot } from '../lib/sfcCampusQuests'
import { questPanelState, questSummary, visibleSlots } from '../lib/sfcCampusQuests'
import type { PadState } from '../lib/sfcCampusMovement'
import { SPAWN, type Hotspot } from '../lib/sfcCampusMap'
import SfcCampusFullMap from './SfcCampusFullMap'

type Props = {
  level: number
  title: string
  expInLevel: number
  todayPages: number
  totalPages: number
  slots: CampusQuestSlot[]
  slotsDone?: boolean
  bulletin?: string
  onOpenToday: () => void
  onOpenBook: (bookId: string) => void
}

type Direction = 'up' | 'down' | 'left' | 'right'
type Panel = { kind: 'quest' } | { kind: 'info'; hotspot: Hotspot }

const NAVY = '#1e2a5a'
const GOLD = '#eab308'
const WHITE = '#ffffff'

const DIRECTIONS: Record<Direction, readonly [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
}

const BUTTON_BASE: CSSProperties = {
  minHeight: 44,
  minWidth: 44,
  border: `2px solid ${GOLD}`,
  borderRadius: 10,
  background: NAVY,
  color: WHITE,
  fontWeight: 800,
  fontSize: 14,
  cursor: 'pointer',
  touchAction: 'none',
}

export default function SfcCampusRpg({
  level,
  title,
  expInLevel,
  todayPages,
  totalPages,
  slots,
  slotsDone = false,
  bulletin,
  onOpenToday,
  onOpenBook,
}: Props) {
  const padRef = useRef<PadState>({ dx: 0, dy: 0 })
  const pressedRef = useRef<Set<Direction>>(new Set())
  const [nearby, setNearby] = useState<Hotspot | null>(null)
  const [panel, setPanel] = useState<Panel | null>(null)
  const [mapOpen, setMapOpen] = useState(false)
  const [area, setArea] = useState('SFCキャンパス')
  const [player, setPlayer] = useState({ x: SPAWN.x, y: SPAWN.y })

  const syncPad = (): void => {
    let dx = 0
    let dy = 0
    for (const dir of pressedRef.current) {
      const v = DIRECTIONS[dir]
      dx += v[0]
      dy += v[1]
    }
    padRef.current = { dx, dy }
  }

  const handlePointerDown = (dir: Direction) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    pressedRef.current.add(dir)
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // jsdom 等、ポインタキャプチャ非対応環境では無視する。
    }
    syncPad()
  }

  const handlePointerUp = (dir: Direction) => () => {
    pressedRef.current.delete(dir)
    syncPad()
  }

  const openFor = (hotspot: Hotspot | null): void => {
    if (!hotspot) return
    setPanel(hotspot.kind === 'quest' ? { kind: 'quest' } : { kind: 'info', hotspot })
  }

  const closePanel = (): void => setPanel(null)

  const state = questPanelState(slots, slotsDone)
  const slotsView = visibleSlots(slots)

  return (
    <div data-testid="sfc-campus-rpg" style={{ maxWidth: 720, margin: '0 auto', padding: 8, color: WHITE }}>
      <div
        data-testid="sfc-map-card"
        style={{
          position: 'relative',
          height: 'min(62vh, 560px)',
          minHeight: 360,
          borderRadius: 16,
          overflow: 'hidden',
          border: `2px solid ${GOLD}`,
          background: '#0b1f16',
          touchAction: 'none',
          overscrollBehavior: 'contain',
        }}
      >
        <div style={{ position: 'absolute', inset: 0 }}>
          <SfcCampusCanvas
            padRef={padRef}
            paused={panel !== null || mapOpen}
            onNearbyChange={setNearby}
            onAction={() => openFor(nearby)}
            onAreaChange={setArea}
            onPlayerMove={(x, y) => setPlayer({ x, y })}
            onCancel={() => {
              setPanel(null)
              setMapOpen(false)
            }}
          />
        </div>

        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '10px 12px max(12px, env(safe-area-inset-top))',
            background: 'rgba(30,42,90,0.92)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
            pointerEvents: 'none',
          }}
        >
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span data-testid="sfc-hud-area" style={{ fontSize: 12, fontWeight: 700 }}>
              📍 {area}
            </span>
            <span data-testid="sfc-hud-level" style={{ fontSize: 16, fontWeight: 900 }}>
              Lv.{level} {title}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span data-testid="sfc-hud-exp" style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                EXP {expInLevel}/1000
              </span>
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  width: 72,
                  height: 8,
                  borderRadius: 4,
                  background: 'rgba(255,255,255,0.25)',
                  overflow: 'hidden',
                }}
              >
                <span style={{ display: 'block', width: `${expInLevel / 10}%`, height: '100%', background: GOLD }} />
              </span>
            </div>
            <span data-testid="sfc-hud-pages" style={{ fontSize: 12, fontWeight: 700 }}>
              今日 {todayPages}p / 累計 {totalPages}p
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, pointerEvents: 'auto' }}>
            <button
              type="button"
              data-testid="sfc-map-button"
              onClick={() => setMapOpen(true)}
              style={BUTTON_BASE}
            >
              全体マップ
            </button>
            <button
              type="button"
              data-testid="sfc-quest-button"
              onClick={() => setPanel({ kind: 'quest' })}
              style={BUTTON_BASE}
            >
              クエスト {questSummary(slots, slotsDone)}
            </button>
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            left: 8,
            bottom: 'max(12px, env(safe-area-inset-bottom))',
            zIndex: 10,
            display: 'grid',
            gridTemplateAreas: '". up ." "left . right" ". down ."',
            gap: 2,
            touchAction: 'none',
          }}
        >
          {(['up', 'left', 'right', 'down'] as Direction[]).map((dir) => (
            <button
              key={dir}
              type="button"
              data-testid={`sfc-dpad-${dir}`}
              aria-label={{ up: '上へ', down: '下へ', left: '左へ', right: '右へ' }[dir]}
              onPointerDown={handlePointerDown(dir)}
              onPointerUp={handlePointerUp(dir)}
              onPointerCancel={handlePointerUp(dir)}
              onLostPointerCapture={handlePointerUp(dir)}
              style={{
                ...BUTTON_BASE,
                gridArea: dir,
                width: '44px',
                height: '44px',
                minWidth: '44px',
                minHeight: '44px',
                padding: 0,
                fontSize: 18,
                touchAction: 'none',
              }}
            >
              {{ up: '↑', down: '↓', left: '←', right: '→' }[dir]}
            </button>
          ))}
        </div>

        {nearby ? (
          <div
            data-testid="sfc-nearby"
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              bottom: 'max(16px, env(safe-area-inset-bottom))',
              zIndex: 10,
              padding: '6px 10px',
              borderRadius: 999,
              background: 'rgba(30,42,90,0.92)',
              border: `1px solid ${GOLD}`,
              fontSize: 13,
              fontWeight: 800,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            E {nearby.title}
          </div>
        ) : null}

        <button
          type="button"
          data-testid="sfc-action-button"
          aria-label="調べる"
          disabled={nearby === null}
          onClick={() => openFor(nearby)}
          style={{
            ...BUTTON_BASE,
            position: 'absolute',
            right: 12,
            bottom: 'max(12px, env(safe-area-inset-bottom))',
            zIndex: 10,
            width: 56,
            height: 56,
            minWidth: 56,
            minHeight: 56,
            borderRadius: '50%',
            fontSize: 22,
            opacity: nearby ? 1 : 0.45,
          }}
        >
          E
        </button>

        {panel ? (
          <>
            <div
              aria-hidden="true"
              onClick={closePanel}
              style={{ position: 'absolute', inset: 0, zIndex: 14, background: 'rgba(3,10,24,0.55)' }}
            />
            <div
              data-testid={panel.kind === 'quest' ? 'sfc-quest-panel' : 'sfc-info-panel'}
              role="dialog"
              aria-modal="true"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 15,
                maxHeight: '70%',
                overflowY: 'auto',
                padding: '12px 12px max(12px, env(safe-area-inset-bottom))',
                borderTop: `3px solid ${GOLD}`,
                borderRadius: '16px 16px 0 0',
                background: '#f8fafc',
                color: '#111827',
              }}
            >
              {panel.kind === 'quest' ? (
                <div data-testid="sfc-quest-sheet">
                  <strong style={{ fontSize: 15, color: NAVY }}>🏫 並木道の看板クエスト</strong>
                  {state === 'done' ? (
                    <div data-testid="campus-done" style={{ marginTop: 8, fontWeight: 900, color: NAVY }}>
                      🎉 全完了！鴨池テラスで祝おう
                    </div>
                  ) : state === 'empty' ? (
                    <div data-testid="campus-empty" style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 14 }}>今日の枠はまだありません。図書館で自習しよう</div>
                      <button
                        type="button"
                        onClick={onOpenToday}
                        style={{ ...BUTTON_BASE, marginTop: 8, width: '100%', background: NAVY }}
                      >
                        今日の計画を開く
                      </button>
                    </div>
                  ) : (
                    <div data-testid="campus-slots" style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {slotsView.map((slot, i) => (
                        <button
                          key={`${slot.title}-${i}`}
                          type="button"
                          data-testid={`campus-slot-${i}`}
                          onClick={() => {
                            if (slot.bookId) onOpenBook(slot.bookId)
                            else onOpenToday()
                          }}
                          style={{ ...BUTTON_BASE, width: '100%', textAlign: 'left', background: '#eef2ff', color: '#111827' }}
                        >
                          {slot.title}
                        </button>
                      ))}
                    </div>
                  )}
                  {bulletin ? (
                    <div
                      data-testid="campus-bulletin"
                      style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: NAVY, color: WHITE, fontSize: 13, fontWeight: 700 }}
                    >
                      📋 {bulletin}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div>
                  <strong style={{ fontSize: 16, color: NAVY }}>{panel.hotspot.title}</strong>
                  <p style={{ margin: '8px 0', fontSize: 14 }}>{panel.hotspot.text}</p>
                  <button
                    type="button"
                    onClick={onOpenToday}
                    style={{ ...BUTTON_BASE, width: '100%', background: NAVY }}
                  >
                    今日の計画を開く
                  </button>
                </div>
              )}
              <button
                type="button"
                data-testid="sfc-close-panel"
                onClick={closePanel}
                style={{ ...BUTTON_BASE, marginTop: 10, width: '100%', background: '#475569' }}
              >
                閉じる
              </button>
            </div>
          </>
        ) : null}

        {mapOpen ? (
          <SfcCampusFullMap
            playerX={player.x}
            playerY={player.y}
            onClose={() => setMapOpen(false)}
          />
        ) : null}
      </div>

      <p style={{ margin: '8px 4px', textAlign: 'center', color: NAVY, fontSize: 12, fontWeight: 700 }}>
        十字キー/WASD/タップで移動・近くでE
      </p>
    </div>
  )
}
