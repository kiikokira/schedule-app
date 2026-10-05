import { useEffect, useState } from 'react'
import { JAPAN_MATCHES, generatedAt, daysUntil } from '../data/japanMatches'
import { watchMatch, skipMatch, restoreMatch, getWatchDecision, type WatchDecision } from '../lib/matchBlock'
import { todayStr } from '../lib/progress'

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

  return (
    <div data-testid="japan-page" style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20, backgroundColor: '#1d4ed8', color: '#fff', padding: '4px 8px' }}>
        日本代表戦
      </h1>
      {next && (
        <div data-testid="japan-next" style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 16 }}>次の試合</h2>
          <div>{next.opponent}</div>
          <div>{next.competition}</div>
          {next.venue && <div>{next.venue}</div>}
          <div>
            {next.date} {next.kickoff}キックオフ
          </div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{countdownText(next.date)}</div>
        </div>
      )}
      {JAPAN_MATCHES.map((m) => (
        <div key={m.id} data-testid={`japan-match-${m.id}`} style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700 }}>
            {m.date} vs {m.opponent}（{m.competition}）
          </div>
          {m.venue && <div>{m.venue}</div>}
          <div>{m.kickoff}キックオフ</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{countdownText(m.date)}</div>
          <button data-testid={`japan-watch-${m.id}`} type="button" onClick={() => void handleWatch(m.id)}>
            観る
          </button>
          <button data-testid={`japan-skip-${m.id}`} type="button" onClick={() => void handleSkip(m.id)}>
            観ない
          </button>
          {decisions[m.id] === 'watch' && (
            <>
              <div data-testid={`japan-blocked-${m.id}`}>観戦のため確保中</div>
              <button data-testid={`japan-restore-${m.id}`} type="button" onClick={() => void handleRestore(m.id)}>
                元に戻す
              </button>
            </>
          )}
        </div>
      ))}
      <p>JFA公式発表ベース・更新：{generatedAt.slice(0, 10)}</p>
      {error && <p data-testid="japan-error">{error}</p>}
      <button data-testid="japan-back" type="button" onClick={onBack}>
        戻る
      </button>
    </div>
  )
}
