import { useEffect, useState } from 'react'
import { JAPAN_MATCHES, generatedAt, daysUntil, type JapanMatch } from '../data/japanMatches'
import { watchMatch, skipMatch, restoreMatch, getWatchDecision, type WatchDecision } from '../lib/matchBlock'
import { todayStr, formatJaFullDate } from '../lib/progress'

type Props = {
  onBack: () => void
  today?: string
}

export default function JapanMatchScreen({ onBack, today: todayProp }: Props) {
  const today = todayProp ?? todayStr()
  const [decisions, setDecisions] = useState<Record<string, WatchDecision | null>>(() => {
    const init: Record<string, WatchDecision | null> = {}
    for (const m of JAPAN_MATCHES) init[m.id] = getWatchDecision(m.id)
    return init
  })
  const [error, setError] = useState<string | null>(null)

  // 別ページ遷移時に前画面のスクロール位置が残り途中から表示されるため、先頭から表示する
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const reload = () => {
    const next: Record<string, WatchDecision | null> = {}
    for (const m of JAPAN_MATCHES) next[m.id] = getWatchDecision(m.id)
    setDecisions(next)
  }

  const handleWatch = async (id: string) => {
    const res = await watchMatch(id)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setError(null)
    reload()
  }

  const handleSkip = async (id: string) => {
    const res = await skipMatch(id)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setError(null)
    reload()
  }

  const handleRestore = async (id: string) => {
    const res = await restoreMatch(id)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setError(null)
    reload()
  }

  const countdownText = (date: string): string => {
    const d = daysUntil(date, today)
    return d === 0 ? '今日' : `あと${d}日`
  }

  const upcoming = [...JAPAN_MATCHES].filter((m) => m.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  const next = upcoming[0]
  const rest = upcoming.slice(1)

  const renderActions = (m: JapanMatch, compact = false) => (
    <div style={{ display: 'flex', gap: 8, marginTop: compact ? 8 : 12, flexWrap: 'wrap' }}>
      <button
        data-testid={`japan-watch-${m.id}`}
        type="button"
        onClick={() => void handleWatch(m.id)}
        style={{
          border: '1px solid var(--border)',
          borderRadius: 999,
          padding: '6px 14px',
          background: decisions[m.id] === 'watch' ? '#1d4ed8' : '#fff',
          color: decisions[m.id] === 'watch' ? '#fff' : '#111',
          fontWeight: 700,
        }}
      >
        🔵 観る
      </button>
      <button
        data-testid={`japan-skip-${m.id}`}
        type="button"
        onClick={() => void handleSkip(m.id)}
        style={{
          border: '1px solid var(--border)',
          borderRadius: 999,
          padding: '6px 14px',
          background: '#fff',
        }}
      >
        観ない
      </button>
      {decisions[m.id] === 'watch' && (
        <>
          <div data-testid={`japan-blocked-${m.id}`} style={{ width: '100%', fontSize: 13, color: '#1d4ed8', fontWeight: 700 }}>
            ⚽ 観戦のため確保中 — 一緒に応援しよう！
          </div>
          <button data-testid={`japan-restore-${m.id}`} type="button" onClick={() => void handleRestore(m.id)}>
            元に戻す
          </button>
        </>
      )}
    </div>
  )

  return (
    <div data-testid="japan-page" style={{ padding: 16 }}>
      <div
        style={{
          background: 'linear-gradient(135deg, #0a2a8f 0%, #1d4ed8 55%, #3b82f6 100%)',
          color: '#fff',
          borderRadius: 12,
          padding: '16px 14px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ fontSize: 12, letterSpacing: 2, opacity: 0.9 }}>⚽ SAMURAI BLUE ⚽</div>
        <h1 style={{ fontSize: 22, margin: '4px 0', background: 'transparent', color: '#fff', padding: 0 }}>
          日本代表戦
        </h1>
        <div style={{ fontSize: 13, opacity: 0.95 }}>みんなで応援してサッカーを楽しもう！</div>
        <div style={{ fontSize: 28, position: 'absolute', right: 12, top: 8, opacity: 0.9 }}>📣⚽🇯🇵</div>
      </div>

      {next && (
        <div
          data-testid="japan-next"
          style={{
            marginTop: 16,
            border: '2px solid #1d4ed8',
            borderRadius: 12,
            padding: 14,
            background: '#eef4ff',
          }}
        >
          <h2 style={{ fontSize: 14, margin: 0, color: '#1d4ed8' }}>🔥 次の試合 🔥</h2>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 8 }}>vs {next.opponent}</div>
          <div style={{ fontSize: 13 }}>{next.competition}</div>
          {next.venue && <div style={{ fontSize: 13 }}>📍 {next.venue}</div>}
          <div style={{ fontSize: 14, marginTop: 6, fontWeight: 700 }}>
            {formatJaFullDate(next.date)} {next.kickoff}キックオフ
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, marginTop: 4 }}>
            {countdownText(next.date) === '今日' ? '⚽ 今日は決戦！' : `⚽ ${countdownText(next.date)}`}
          </div>
          {renderActions(next)}
        </div>
      )}
      {rest.map((m) => (
        <div
          key={m.id}
          data-testid={`japan-match-${m.id}`}
          style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'var(--surface)' }}
        >
          <div style={{ fontWeight: 700 }}>
            {formatJaFullDate(m.date)} vs {m.opponent}（{m.competition}）
          </div>
          {m.venue && <div>📍 {m.venue}</div>}
          <div>{m.kickoff}キックオフ</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>⚽ {countdownText(m.date)}</div>
          {renderActions(m, true)}
        </div>
      ))}
      <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>JFA公式発表ベース・更新：{formatJaFullDate(generatedAt.slice(0, 10))}</p>
      {error && <p data-testid="japan-error">{error}</p>}
      <button data-testid="japan-back" type="button" onClick={onBack}>
        戻る
      </button>
    </div>
  )
}
