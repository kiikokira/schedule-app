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
  const seasonState = useMemo(() => {
    try {
      return loadSeasonState(today)
    } catch {
      return { seasonId: '2026-09-01', div: 10, exp: 0, days: {} as Record<string, number> }
    }
  }, [today])
  const leagueDay = useMemo(() => {
    try {
      return seasonDayIndex(today)
    } catch {
      return 0
    }
  }, [today])
  const leagueRows = useMemo(() => {
    try {
      const prevDate = (() => {
        try {
          const t = Date.parse(today + 'T00:00:00Z')
          if (!Number.isFinite(t)) return today
          return new Date(t - 86400000).toISOString().slice(0, 10)
        } catch {
          return today
        }
      })()
      const myDaily = scoreActivityOnDate(today, records)
      const myPrevDaily = leagueDay > 0 ? scoreActivityOnDate(prevDate, records) : myDaily
      const dayVals = Object.values(seasonState.days ?? {})
      const myCum = dayVals.length > 0
        ? dayVals.reduce((s, v) => s + v, 0)
        : totalActivity(records) > 0 ? totalActivity(records) : myDaily
      let rivals: ReturnType<typeof generateRivals> = []
      try {
        rivals = generateRivals(seasonIdForDate(today), seasonState.div)
      } catch {
        rivals = []
      }
      const rows = [
        {
          id: 'you', name: 'あなた', pages: myDaily, prev: myPrevDaily, cum: myCum,
          prevCum: leagueDay > 0 ? Math.max(0, myCum - myDaily) : myCum, you: true as const,
        },
        ...rivals.map((r) => {
          let cum = 0
          try {
            for (let d = 0; d <= leagueDay; d++) cum += rivalPagesForDay(r, d)
          } catch {
            cum = 0
          }
          const daily = (() => {
            try {
              return rivalPagesForDay(r, leagueDay)
            } catch {
              return 0
            }
          })()
          const prevDaily = (() => {
            try {
              return leagueDay > 0 ? rivalPagesForDay(r, leagueDay - 1) : daily
            } catch {
              return daily
            }
          })()
          const prevCum = leagueDay > 0 ? Math.max(0, cum - daily) : cum
          return { id: r.id, name: r.name, pages: daily, prev: prevDaily, cum, prevCum, you: false as const }
        }),
      ].sort((a, b) => b.cum - a.cum)
      return rows
    } catch {
      const fallback = scoreActivityOnDate(today, records)
      return [{ id: 'you', name: 'あなた', pages: fallback, prev: fallback, cum: fallback, prevCum: fallback, you: true as const }]
    }
  }, [today, records, leagueDay, seasonState.div, seasonState.days])
  const leagueWins = useMemo(() => {
    const mine = leagueRows.find((r) => r.you)?.cum ?? 0
    return leagueRows.filter((r) => !r.you && r.cum < mine).length
  }, [leagueRows])
  const leagueLevel = (() => {
    try {
      return levelForExp(seasonState.exp)
    } catch {
      return 1
    }
  })()
  const isRpg = tab === 'rpg'
  const expInLevel = ((seasonState.exp % 1000) + 1000) % 1000
  const expToNext = 1000 - expInLevel
  const expPct = Math.min(100, Math.max(0, Math.round((expInLevel / 1000) * 100)))
  const rpgTitle =
    leagueLevel >= 10 ? '伝説の勇者' :
    leagueLevel >= 8 ? '王国騎士' :
    leagueLevel >= 5 ? '荒野の戦士' :
    leagueLevel >= 3 ? '街の守り手' :
    leagueLevel >= 2 ? '駆け出し冒険者' : '見習い勇者'
  const rpgChara =
    leagueLevel >= 10 ? '🐉' :
    leagueLevel >= 8 ? '🦄' :
    leagueLevel >= 5 ? '⚔️' :
    leagueLevel >= 3 ? '🛡️' :
    leagueLevel >= 2 ? '🌱' : '🐣'
  const questCleared = todayPages > 0
  return (
    <div
      data-testid="ranking-page"
      style={{
        padding: 16,
        minHeight: '100vh',
        background: isRpg
          ? 'linear-gradient(180deg, #1e2a5a 0%, #3f56a8 45%, #9fb8ff 100%)'
          : 'linear-gradient(180deg, #dbe7ff 0%, #eef4ff 38%, #f2f4f8 100%)',
      }}
    >
      <h1 style={{ fontSize: 20, color: isRpg ? '#fff' : undefined, textShadow: isRpg ? '0 1px 4px rgba(0,0,0,0.4)' : undefined }}>仮想全国ランキング</h1>
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
            Div.{seasonState.div} 第{leagueDay + 1}節（全28節） <span data-testid="league-wins">○{leagueWins}勝</span>
          </p>
          {leagueRows.map((row, i) => {
            const diff = row.pages - row.prev
            const mark = diff > 0 ? `▲${diff}` : diff < 0 ? `▼${-diff}` : '―'
            return (
              <div
                key={row.id}
                data-testid={row.you ? 'league-row-you' : `league-row-${row.id}`}
                style={{ display: 'grid', gridTemplateColumns: '3em minmax(0,1fr) 9em 3.5em', columnGap: 8, alignItems: 'center', fontSize: 14, fontWeight: row.you ? 800 : undefined }}
              >
                <span style={{ textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{i + 1}位</span>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
                <span style={{ textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{row.cum}pt（今日{row.pages}）</span>
                <span style={{ textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{mark}</span>
              </div>
            )
          })}
        </div>
      )}
      {tab === 'rpg' && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <section
            data-testid="rpg-hero"
            style={{ padding: '14px 12px', borderRadius: 12, background: '#fff', border: '1px solid #d5dbe6', boxShadow: '0 2px 8px rgba(30,42,90,0.25)' }}
          >
            <div style={{ fontSize: 44, lineHeight: 1 }} role="img" aria-label="勇者キャラ">
              {rpgChara}
            </div>
            <p data-testid="rpg-level" style={{ fontWeight: 800, fontSize: 20, margin: '8px 0 2px' }}>
              Lv.{leagueLevel} {rpgTitle}
            </p>
            <p style={{ fontSize: 14, margin: '0 0 8px', color: 'var(--text-dim)' }}>
              Div.{seasonState.div} EXP.{seasonState.exp.toLocaleString()}
            </p>
            <div
              data-testid="rpg-exp-bar"
              role="progressbar"
              aria-valuenow={expPct}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{ height: 14, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden', border: '1px solid #d5dbe6' }}
            >
              <div style={{ width: `${expPct}%`, height: '100%', background: 'linear-gradient(90deg, #5a74c9, #eab308)', transition: 'width 0.3s' }} />
            </div>
            <div data-testid="rpg-next" style={{ fontSize: 13, marginTop: 6 }}>
              次のレベルまであと{expToNext.toLocaleString()}EXP（{expInLevel.toLocaleString()}/1000）
            </div>
          </section>
          <section
            data-testid="rpg-quest"
            style={{ padding: '12px', borderRadius: 12, background: '#fffdf0', border: '2px solid #eab308' }}
          >
            <div style={{ fontWeight: 800, fontSize: 16 }}>📜 今日のクエスト</div>
            <div style={{ fontSize: 14, marginTop: 4 }}>
              今日 {todayPages.toLocaleString()}ページ ／ 累計 {totalPages.toLocaleString()}ページ
            </div>
            <div style={{ fontSize: 14, marginTop: 4 }}>
              Div.{seasonState.div} 第{leagueDay + 1}節（全28節） ○{leagueWins}勝
            </div>
            {questCleared ? (
              <div data-testid="rpg-quest-clear" style={{ marginTop: 8, fontWeight: 800, color: '#1a7f37' }}>
                🎉 クエストクリア！冒険が進んだ！
              </div>
            ) : (
              <div data-testid="rpg-quest-yet" style={{ marginTop: 8, fontSize: 14 }}>
                あと1ページでクエストクリア！本を開いて冒険を進めよう⚔️
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
              ページを読むとEXPがたまり、リーグの順位も上がるよ。1日1ページからでOK！
            </div>
          </section>
        </div>
      )}
      <button data-testid="ranking-back" type="button" onClick={onBack}>
        戻る
      </button>
    </div>
  )
}
