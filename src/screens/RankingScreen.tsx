import { useEffect, useMemo, useRef, useState } from 'react'
import { useRecords } from '../hooks/useRecords'
import { scoreActivityOnDate, todayStr } from '../lib/progress'
import { RANK_POPULATION, dailyPagesToRank, rankToDeviation, sampleNearRivals } from '../lib/ranking'

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
  void nowMin
  const rivals = useMemo(() => sampleNearRivals(todayPages, today, 30), [todayPages, today])
  const prevRank = useRef(rank)
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    if (rank < prevRank.current) setToast('ライバルを抜いた！')
    else if (rank > prevRank.current) setToast('ライバルに抜かれた…')
    prevRank.current = rank
  }, [rank])
  const ahead = rivals.find((r) => r.pages > todayPages)
  return (
    <div data-testid="ranking-page" style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>仮想全国ランキング</h1>
      <p data-testid="ranking-summary" style={{ fontWeight: 700 }}>
        全国{RANK_POPULATION.toLocaleString()}人中 {rank.toLocaleString()}位（偏差値{rankToDeviation(rank)}）
      </p>
      {toast && <p data-testid="ranking-toast">{toast}</p>}
      {ahead && (
        <p data-testid="ranking-reach">
          あと{ahead.pages - todayPages}ページで{ahead.name}を抜く
        </p>
      )}
      {rivals.map((r, i) => (
        <div key={`${r.name}-${i}`} data-testid={`ranking-rival-${i}`} style={{ fontSize: 14 }}>
          {r.name} {r.pages}ページ
        </div>
      ))}
      <button data-testid="ranking-back" type="button" onClick={onBack}>
        戻る
      </button>
    </div>
  )
}
