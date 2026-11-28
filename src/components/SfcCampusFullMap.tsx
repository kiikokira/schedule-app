// 全体マップ。本体と同じ地形描画を縮小し、自分の位置とホットスポットを重ねる。
import { useEffect, useRef } from 'react'
import { drawCampusBase } from '../lib/sfcCampusArt'
import { HOTSPOTS, LABELS, MAP_H, MAP_W } from '../lib/sfcCampusMap'

type Props = {
  playerX: number
  playerY: number
  onClose: () => void
}

const NAVY = '#1e2a5a'
const GOLD = '#eab308'

export default function SfcCampusFullMap({ playerX, playerY, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const base = document.createElement('canvas')
    base.width = MAP_W
    base.height = MAP_H
    const baseCtx = base.getContext('2d')
    if (!baseCtx) return
    drawCampusBase(baseCtx)
    canvas.width = MAP_W
    canvas.height = MAP_H
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, MAP_W, MAP_H)
    ctx.drawImage(base, 0, 0)
  }, [])

  return (
    <div
      data-testid="sfc-map-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        background: `linear-gradient(180deg, ${NAVY} 0%, #0b1f16 100%)`,
        touchAction: 'pan-y',
        overscrollBehavior: 'contain',
      }}
    >
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '10px 12px',
          background: NAVY,
          borderBottom: `1px solid ${GOLD}`,
        }}
      >
        <strong style={{ fontSize: 16 }}>🗺️ SFCキャンパス全体マップ</strong>
        <button
          type="button"
          data-testid="sfc-map-close"
          onClick={onClose}
          style={{
            minHeight: 44,
            minWidth: 44,
            border: `2px solid ${GOLD}`,
            borderRadius: 10,
            background: '#475569',
            color: '#fff',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          閉じる
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 12px 12px' }}>
        <div
          style={{
            position: 'relative',
            width: 'min(100%, 380px)',
            aspectRatio: `${MAP_W} / ${MAP_H}`,
            alignSelf: 'center',
            flexShrink: 0,
            borderRadius: 8,
            border: `1px solid ${GOLD}`,
            background: '#0b1f16',
            overflow: 'hidden',
          }}
        >
          <canvas
            data-testid="sfc-full-map-canvas"
            aria-label="SFCキャンパス全体マップ"
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block', imageRendering: 'pixelated' }}
          />
          {HOTSPOTS.map((h) => (
            <span
              key={h.id}
              data-testid="sfc-full-map-hotspot"
              aria-label={h.title}
              style={{
                position: 'absolute',
                left: `${(h.x / MAP_W) * 100}%`,
                top: `${(h.y / MAP_H) * 100}%`,
                width: 8,
                height: 8,
                marginLeft: -4,
                marginTop: -4,
                borderRadius: '50%',
                background: GOLD,
                border: '1px solid #1e2a5a',
              }}
            />
          ))}
          <span
            data-testid="sfc-full-map-player"
            aria-label="現在地"
            style={{
              position: 'absolute',
              left: `${(playerX / MAP_W) * 100}%`,
              top: `${(playerY / MAP_H) * 100}%`,
              width: 10,
              height: 10,
              marginLeft: -5,
              marginTop: -5,
              borderRadius: '50%',
              background: '#f8fafc',
              border: `2px solid ${NAVY}`,
            }}
          />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {LABELS.filter((label) => label.text).map((label, i) => (
            <span
              key={`${label.text}-${i}`}
              style={{
                padding: '4px 8px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.14)',
                border: '1px solid rgba(234,179,8,0.6)',
                fontSize: 11,
                whiteSpace: 'nowrap',
              }}
            >
              {label.text}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
