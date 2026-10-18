import { useEffect, useMemo, useRef, useState } from 'react'
import { useRecords } from '../hooks/useRecords'
import { scoreActivityOnDate, todayStr } from '../lib/progress'
import { RANK_POPULATION, dailyPagesToRank, rankToDeviation, sampleNearBoard, sampleTopRivals } from '../lib/ranking'

type Props = { onBack: () => void; today?: string }

export default function RankingScreen({ onBack, today: todayProp }: Props) {
  const { records } = useRecords()
  const today = todayProp ?? todayStr()
  const [nowMin, setNowMin] = useState(() => {
    const n = new Date()
    return n.getHours() * 60 + n.getMinutes()
  })
  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date()
      setNowMin(n.getHours() * 60 + n.getMinutes())
    }, 60000)
    return () => clearInterval(id)
  }, [])
  const todayPages = scoreActivityOnDate(today, records)
  const rank = dailyPagesToRank(todayPages, today)
  const deviation = rankToDeviation(rank)
  void nowMin
  const rivals = useMemo(() => sampleNearBoard(todayPages, rank, today, 15), [todayPages, rank, today])
  const topRivals = useMemo(() => sampleTopRivals(today, 10), [today])
  const prevRank = useRef(rank)
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    if (rank < prevRank.current) setToast('ライバルを追い越した！')
    else if (rank > prevRank.current) setToast('ライバルに追い越された…')
    prevRank.current = rank
  }, [rank])
  const ahead = rivals.find((r) => !r.you && r.pages > todayPages)
  const dayOfMonth = Number(today.slice(8, 10))
  const isMockWeek = dayOfMonth >= 1 && dayOfMonth <= 7
  const level = deviation >= 60 ? 'A' : deviation >= 55 ? 'B' : deviation >= 50 ? 'C' : deviation >= 45 ? 'D' : 'E'
  return (
    <div data-testid="ranking-page" style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>仮想全国ランキング</h1>
      <p data-testid="ranking-summary" style={{ fontWeight: 700 }}>
        全国{RANK_POPULATION.toLocaleString()}人中 {rank.toLocaleString()}位（偏差値{rankToDeviation(rank)}）
      </p>
      {toast && <p data-testid="ranking-toast">{toast}</p>}
      {ahead && (
        <p data-testid="ranking-reach">
          あと{ahead.pages - todayPages}ページで{ahead.name}を追い越す
        </p>
      )}
      {rivals.map((r, i) => (
        <div
          key={`${r.rank}-${i}`}
          data-testid={`ranking-rival-${i}`}
          style={{
            fontSize: 14,
            fontWeight: r.you ? 800 : undefined,
            background: r.you ? '#eef3ff' : undefined,
          }}
        >
          {r.you ? 'あなた' : r.name} {r.pages}ページ <span style={{ fontWeight: 800, color: '#111' }}>{r.boardRank}位</span>
        </div>
      ))}
      <section data-testid="ranking-top" style={{ marginTop: 12 }}>
        <h2 style={{ fontSize: 15 }}>全国トップ10</h2>
        {topRivals.map((r, i) => (
          <div key={`top-${r.rank}`} data-testid={`ranking-top-${i}`} style={{ fontSize: 14 }}>
            {r.rank}位 {r.name} {r.pages}ページ
          </div>
        ))}
      </section>
      {isMockWeek && (
        <section data-testid="ranking-mockweek" style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 800 }}>全国模試ウィーク確定：{rank.toLocaleString()}位（偏差値{deviation}）</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>到達度目安：{level}</div>
        </section>
      )}
      <section data-testid="ranking-sources" style={{ marginTop: 12, fontSize: 12, color: 'var(--text-dim)' }}>
        母集団の根拠：文部科学省「高等教育の現状について」／ベネッセ教育総合研究所（大学生130人調査）／代々木ゼミナール目安／坪田塾コラム／SFC公式合格体験記・合格者体験談
      </section>
      <button data-testid="ranking-back" type="button" onClick={onBack}>
        戻る
      </button>
    </div>
  )
}
