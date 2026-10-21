import { useEffect, useMemo, useState } from 'react'
import { useRecords } from '../hooks/useRecords'
import { scoreActivityOnDate, todayStr } from '../lib/progress'
import { RANK_POPULATION, totalPagesToRank, totalActivity, totalPagesForRank, nextRankMilestone, rankToDeviation, sampleNearBoard, sampleTopRivals } from '../lib/ranking'
import { seasonDayIndex, seasonIdForDate } from '../lib/seasonLeague'
import { generateRivals, rivalPagesForDay } from '../lib/seasonRivals'
import { loadSeasonState } from '../data/seasonStore'
import { levelForExp } from '../lib/seasonExp'

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
  const [tab, setTab] = useState<'national' | 'league' | 'rpg'>('national')
  const seasonState = loadSeasonState(today)
  const leagueDay = seasonDayIndex(today)
  const prevDate = new Date(Date.parse(today + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10)
  const myLeaguePages = scoreActivityOnDate(today, records)
  const myPrevPages = scoreActivityOnDate(prevDate, records)
  const leagueRows = [
    { id: 'you', name: 'あなた', pages: myLeaguePages, prev: myPrevPages, you: true },
    ...generateRivals(seasonIdForDate(today), seasonState.div).map((r) => ({
      id: r.id,
      name: r.name,
      pages: rivalPagesForDay(r, leagueDay),
      prev: leagueDay > 0 ? rivalPagesForDay(r, leagueDay - 1) : rivalPagesForDay(r, leagueDay),
      you: false as const,
    })),
  ].sort((a, b) => b.pages - a.pages)
  const leagueLevel = levelForExp(seasonState.exp)
  return (
    <div data-testid="ranking-page" style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>仮想全国ランキング</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button data-testid="national-tab" type="button" onClick={() => setTab('national')}>
          全国
        </button>
        <button data-testid="league-tab" type="button" onClick={() => setTab('league')}>
          リーグ
        </button>
        <button data-testid="rpg-tab" type="button" onClick={() => setTab('rpg')}>
          RPG
        </button>
      </div>
      {tab === 'national' && (
        <>
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
      <section data-testid="ranking-sources" style={{ marginTop: 12, fontSize: 12, color: 'var(--text-dim)' }}>
        母集団の根拠：文部科学省「高等教育の現状について」／ベネッセ教育総合研究所（大学生130人調査）／代々木ゼミナール目安／坪田塾コラム／SFC公式合格体験記・合格者体験談
      </section>
        </>
      )}
      {tab === 'league' && (
        <div data-testid="league-board" style={{ marginTop: 8 }}>
          <p style={{ fontWeight: 700 }}>
            Div.{seasonState.div} 第{leagueDay + 1}節（全28節）
          </p>
          {leagueRows.map((row, i) => {
            const diff = row.pages - row.prev
            const mark = diff > 0 ? `▲${diff}` : diff < 0 ? `▼${-diff}` : '―'
            return (
              <div
                key={row.id}
                data-testid={row.you ? 'league-row-you' : `league-row-${row.id}`}
                style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, fontWeight: row.you ? 800 : undefined }}
              >
                <span style={{ minWidth: '3em', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{i + 1}位</span>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
                <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{row.pages}ページ</span>
                <span style={{ minWidth: '3em', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{mark}</span>
              </div>
            )
          })}
        </div>
      )}
      {tab === 'rpg' && (
        <div style={{ marginTop: 8 }}>
          <p data-testid="rpg-level" style={{ fontWeight: 700 }}>
            Lv.{leagueLevel}
          </p>
          <p style={{ fontSize: 14 }}>
            Div.{seasonState.div} EXP.{seasonState.exp}
          </p>
        </div>
      )}
      <button data-testid="ranking-back" type="button" onClick={onBack}>
        戻る
      </button>
    </div>
  )
}
