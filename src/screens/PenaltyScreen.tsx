import { useEffect, useState } from 'react'
import { db } from '../db/database'
import { getPenaltySettings, setPenaltySettings, listPenalties, type PenaltyEvent, type PenaltySettings } from '../data/penaltyStore'
import { MAX_PAGE_DEBT, calcStreak, calcTotalPoints, rankForPoints } from '../lib/penalty'

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

  const debtByBook = new Map<string, { pages: number; units: number }>()
  for (const e of sorted) {
    for (const bookId of e.missingBookIds) {
      const cur = debtByBook.get(bookId) ?? { pages: 0, units: 0 }
      cur.pages += e.pageDebt
      cur.units += e.unitDebt?.[bookId] ?? 0
      debtByBook.set(bookId, cur)
    }
    if (e.missingBookIds.length === 0 && e.pageDebt > 0) {
      const cur = debtByBook.get('unknown') ?? { pages: 0, units: 0 }
      cur.pages += e.pageDebt
      debtByBook.set('unknown', cur)
    }
  }

  const outstanding = Math.min(
    sorted.reduce((s, e) => s + e.pageDebt, 0),
    MAX_PAGE_DEBT,
  )
  const totalPoints = calcTotalPoints(
    sorted.map((e) => ({ date: e.date, points: e.points })),
    0,
  )
  const rank = rankForPoints(totalPoints)
  const streak = calcStreak(
    sorted.length === 0
      ? [{ date: '', isMiss: false, hasPlan: false }]
      : sorted.map((e) => ({ date: e.date, isMiss: true, hasPlan: true })),
  )

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

  return (
    <div data-testid="penalty-page" style={{ padding: 16, background: '#fef2f2', border: '1px solid #f0a0a0', borderRadius: 8 }}>
      <h1 style={{ fontSize: 20 }}>罰センター</h1>
      <p style={{ fontSize: 14 }}>
        連続 {streak}日 | 罰Pt {totalPoints} | ランク {rank} | 借金 {outstanding}ページ
      </p>
      <section>
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
      <section>
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
      <section>
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
