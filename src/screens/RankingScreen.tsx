import { useEffect, useMemo, useState } from 'react'
import { useRecords } from '../hooks/useRecords'
import { scoreActivityOnDate, todayStr } from '../lib/progress'
import { RANK_POPULATION, totalPagesToRank, totalActivity, totalPagesForRank, nextRankMilestone, rankToDeviation, sampleNearBoard, sampleTopRivals } from '../lib/ranking'
import { loadMockHistory, recordMockIfNeeded, type MockRecord } from '../lib/mockHistory'
import { listBadges } from '../lib/mockBadges'
import MockHistoryChart from '../components/MockHistoryChart'

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
  const totalPages = totalActivity(records)
  const rank = totalPagesToRank(totalPages)
  const deviation = rankToDeviation(rank)
  void nowMin
  const rivals = useMemo(() => sampleNearBoard(totalPages, rank, today, 15), [totalPages, rank, today])
  const topRivals = useMemo(() => sampleTopRivals(today, 10), [today])
  const milestone = nextRankMilestone(rank)
  const milestoneDiff = milestone == null ? 0 : Math.max(0, totalPagesForRank(milestone) - totalPages)
  const dayOfMonth = Number(today.slice(8, 10))
  const isMockWeek = dayOfMonth >= 1 && dayOfMonth <= 7
  const level = deviation >= 60 ? 'A' : deviation >= 55 ? 'B' : deviation >= 50 ? 'C' : deviation >= 45 ? 'D' : 'E'
  const [mockHistory, setMockHistory] = useState<MockRecord[]>(() => loadMockHistory())
  useEffect(() => {
    setMockHistory(recordMockIfNeeded(today, rank, deviation, totalPages))
  }, [today, rank, deviation, totalPages])
  const badges = useMemo(() => listBadges(mockHistory), [mockHistory])
  const prevDev = mockHistory.length >= 2 ? mockHistory[mockHistory.length - 2].deviation : null
  const devDelta = prevDev == null || mockHistory.length === 0 ? null : Math.round((mockHistory[mockHistory.length - 1].deviation - prevDev) * 10) / 10
  return (
    <div data-testid="ranking-page" style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>仮想全国ランキング</h1>
      <p data-testid="ranking-summary" style={{ fontWeight: 700 }}>
        全国{RANK_POPULATION.toLocaleString()}人中 {rank.toLocaleString()}位（偏差値{rankToDeviation(rank)}） 累計{totalPages.toLocaleString()}ページ（今日{todayPages.toLocaleString()}ページ）
      </p>
      {milestone == null ? (
        <p data-testid="ranking-reach">全国1位をキープ中！</p>
      ) : (
        <p data-testid="ranking-reach">
          全国{milestone.toLocaleString()}位（偏差値{rankToDeviation(milestone)}）まであと{milestoneDiff.toLocaleString()}ページ
        </p>
      )}
      {rivals.map((r, i) => (
        <div
          key={`${r.rank}-${i}`}
          data-testid={`ranking-rival-${i}`}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr) 6.5em 7em',
            columnGap: 8,
            alignItems: 'center',
            fontSize: 14,
            fontWeight: r.you ? 800 : undefined,
            background: r.you ? '#eef3ff' : undefined,
          }}
        >
          <span data-testid="rival-name" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.you ? (
              'あなた'
            ) : (
              <>
                <span data-testid="rival-univ">{r.name}</span>
                <span data-testid="rival-faculty" style={{ marginLeft: 4 }}>{r.faculty}</span>
              </>
            )}
            {!r.you && (
              <span data-testid="rival-grade" style={{ marginLeft: 4, padding: '0 4px', fontSize: 11, fontWeight: 400, color: 'var(--text-dim)', border: '1px solid var(--border)', borderRadius: 6, whiteSpace: 'nowrap' }}>
                {r.grade}
              </span>
            )}
          </span>
          <span data-testid="rival-pages" style={{ textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontWeight: 400 }}>
            {r.pages.toLocaleString()}ページ
          </span>
          <span data-testid="rival-rank" style={{ textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontWeight: 800, color: '#111' }}>
            {r.rank.toLocaleString()}位
          </span>
        </div>
      ))}
      <section data-testid="ranking-top" style={{ marginTop: 12 }}>
        <h2 style={{ fontSize: 15 }}>全国トップ10</h2>
        {topRivals.map((r, i) => (
          <div key={`top-${r.rank}`}             data-testid={`ranking-top-${i}`}
            style={{ display: 'grid', gridTemplateColumns: '2.8em minmax(0,1fr) 7em', columnGap: 8, alignItems: 'center', fontSize: 14 }}
          >
            <span data-testid="top-rank" style={{ textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
              {r.rank}位
            </span>
            <span data-testid="top-name" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span data-testid="top-univ">{r.name}</span>
              <span data-testid="top-faculty" style={{ marginLeft: 4 }}>{r.faculty}</span>
              <span data-testid="top-grade" style={{ marginLeft: 4, padding: '0 4px', fontSize: 11, color: 'var(--text-dim)', border: '1px solid var(--border)', borderRadius: 6, whiteSpace: 'nowrap' }}>
                {r.grade}
              </span>
            </span>
            <span data-testid="top-pages" style={{ textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
              {r.pages.toLocaleString()}ページ
            </span>
          </div>
        ))}
      </section>
      {isMockWeek && (
        <section data-testid="ranking-mockweek" style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 800 }}>全国模試ウィーク確定：{rank.toLocaleString()}位（偏差値{deviation}）</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>到達度目安：{level}</div>
        </section>
      )}
      <section data-testid="mock-history" style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 800 }}>仮想模試 成績表</div>
        {mockHistory.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>まだ初記録がありません。来月の第1週で初記録！</div>
        ) : (
          <>
            <MockHistoryChart history={mockHistory} />
            <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              {devDelta == null ? '初記録おめでとう！' : `前回比 ${devDelta >= 0 ? '＋' : ''}${devDelta}`}
            </div>
          </>
        )}
      </section>
      <section data-testid="mock-badges" style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 800 }}>称号バッジ</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {badges.map((b) => (
            <div
              key={b.id}
              data-testid={`mock-badge-${b.id}`}
              style={{
                padding: '6px 10px',
                borderRadius: 999,
                fontSize: 12,
                border: '1px solid var(--border)',
                background: b.unlocked ? '#fff4d6' : 'var(--surface)',
                opacity: b.unlocked ? 1 : 0.6,
              }}
              title={b.hint}
            >
              {b.unlocked ? `★${b.name}` : `${b.name}（${b.hint}）`}
            </div>
          ))}
        </div>
      </section>
      <section data-testid="ranking-sources" style={{ marginTop: 12, fontSize: 12, color: 'var(--text-dim)' }}>
        母集団の根拠：文部科学省「高等教育の現状について」／ベネッセ教育総合研究所（大学生130人調査）／代々木ゼミナール目安／坪田塾コラム／SFC公式合格体験記・合格者体験談
      </section>
      <button data-testid="ranking-back" type="button" onClick={onBack}>
        戻る
      </button>
    </div>
  )
}
