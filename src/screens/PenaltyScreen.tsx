import { useEffect, useState, type CSSProperties } from 'react'
import { db } from '../db/database'
import { getPenaltySettings, setPenaltySettings, listPenalties, type PenaltyEvent, type PenaltySettings } from '../data/penaltyStore'
import { summarizeRecentPenalties } from '../lib/penaltyEvaluate'
import { todayStr } from '../lib/progress'

type Props = {
  onBack: () => void
}

export default function PenaltyScreen({ onBack }: Props) {
  const [events, setEvents] = useState<PenaltyEvent[] | null>(null)
  const [settings, setSettings] = useState<PenaltySettings>(() => {
    try {
      return getPenaltySettings()
    } catch {
      return { severity: 'normal', enabledBanner: true }
    }
  })
  const [titles, setTitles] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    void listPenalties()
      .then((all) => {
        if (!cancelled) setEvents(all)
      })
      .catch(() => {
        if (!cancelled) setEvents([])
      })
    void db.books
      .toArray()
      .then((books) => {
        if (cancelled) return
        const map: Record<string, string> = {}
        for (const b of books) map[b.id] = b.title
        setTitles(map)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const sorted = (events ?? []).slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  // C1: 1日の借金は未記録本の合計のため各本へ按分する(端数は先頭本から+1)。
  // 合計がその日の pageDebt と一致することはテストで保証する。反復の区画は冊ごと。
  const debtByBook = new Map<string, { pages: number; units: number }>()
  for (const e of sorted) {
    const ids = e.missingBookIds
    if (ids.length > 0) {
      const base = Math.floor(e.pageDebt / ids.length)
      let rest = e.pageDebt - base * ids.length
      for (const bookId of ids) {
        const cur = debtByBook.get(bookId) ?? { pages: 0, units: 0 }
        cur.pages += base + (rest > 0 ? 1 : 0)
        if (rest > 0) rest -= 1
        cur.units += e.unitDebt?.[bookId] ?? 0
        debtByBook.set(bookId, cur)
      }
    } else if (e.pageDebt > 0) {
      const cur = debtByBook.get('unknown') ?? { pages: 0, units: 0 }
      cur.pages += e.pageDebt
      debtByBook.set('unknown', cur)
    }
  }

  // C2: Home バナーと一致させるため直近7日集計は共有ヘルパーに寄せる(当日分は除外)。
  const { outstanding, totalPoints, streak, rank } = summarizeRecentPenalties(events ?? [], todayStr())

  const handleSeverity = (v: string) => {
    const severity = (v === 'mild' || v === 'strict' ? v : 'normal') as PenaltySettings['severity']
    const next = { ...settings, severity }
    setSettings(next)
    setPenaltySettings(next)
  }

  const handleToggle = () => {
    const next = { ...settings, enabledBanner: !settings.enabledBanner }
    setSettings(next)
    setPenaltySettings(next)
  }

  const rankBadgeColors: Record<string, string> = {
    S: '#16a34a',
    A: '#2563eb',
    B: '#ca8a04',
    C: '#ea580c',
    D: '#dc2626',
  }

  const cardStyle: CSSProperties = {
    background: '#ffffff',
    border: '1px solid #e5e0e0',
    borderRadius: 10,
    padding: 12,
  }
  const labelStyle: CSSProperties = { fontSize: 12, color: '#6b7280' }
  const valueStyle: CSSProperties = { fontSize: 20, fontWeight: 800 }

  return (
    <div data-testid="penalty-page" style={{ padding: 20, background: '#fef2f2', border: '1px solid #f0a0a0', borderRadius: 8 }}>
      <h1 style={{ fontSize: 20 }}>罰センター</h1>
      <div data-testid="penalty-summary" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={cardStyle}>
          <div style={labelStyle}>連続</div>{' '}
          <div style={valueStyle}>{streak}日</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>罰Pt</div>{' '}
          <div style={valueStyle}>{totalPoints}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>ランク</div>{' '}
          <div style={valueStyle}>
            <span
              style={{
                background: rankBadgeColors[rank] ?? '#6b7280',
                color: '#ffffff',
                borderRadius: 999,
                padding: '2px 8px',
              }}
            >
              {rank}
            </span>
          </div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>借金</div>{' '}
          <div style={{ ...valueStyle, color: outstanding === 0 ? '#16a34a' : undefined }}>{outstanding}ページ</div>
        </div>
      </div>
      <div data-testid="penalty-repay-header" style={{ fontSize: 16, fontWeight: 800, marginTop: 12 }}>
        今日返す: +{outstanding}ページ
      </div>
      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16 }}>借金一覧</h2>
        {debtByBook.size === 0 ? (
          <p style={{ fontSize: 13 }}>借金はありません</p>
        ) : (
          [...debtByBook.entries()].map(([bookId, d]) => (
            <div key={bookId} data-testid={`penalty-debt-${bookId}`} style={{ fontSize: 14, marginBottom: 4 }}>
              {titles[bookId] ?? bookId}: 借金 {d.pages}ページ
              {d.units > 0 ? ` +${d.units}区画` : ''}
            </div>
          ))
        )}
      </section>
      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16 }}>履歴</h2>
        {sorted.length === 0 ? (
          <p style={{ fontSize: 13 }}>履歴はありません</p>
        ) : (
          sorted.map((e) => (
            <div key={e.date} data-testid={`penalty-history-${e.date}`} style={{ fontSize: 14, marginBottom: 4 }}>
              {e.date} サボり +{e.points}pt 借金{e.pageDebt}ページ
            </div>
          ))
        )}
      </section>
      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16 }}>設定</h2>
        <label style={{ fontSize: 14 }}>
          厳しさ:
          <select data-testid="penalty-severity-select" value={settings.severity} onChange={(ev) => handleSeverity(ev.target.value)} style={{ marginLeft: 8 }}>
            <option value="mild">甘口</option>
            <option value="normal">普通</option>
            <option value="strict">鬼</option>
          </select>
        </label>
        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 14 }}>
            <input data-testid="penalty-banner-toggle" type="checkbox" checked={settings.enabledBanner} onChange={handleToggle} />
            バナー表示
          </label>
        </div>
      </section>
      <button data-testid="penalty-back" type="button" onClick={onBack} style={{ marginTop: 12 }}>
        今日に戻る
      </button>
    </div>
  )
}
