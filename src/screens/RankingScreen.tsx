import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useBooks } from '../hooks/useBooks'
import { useRecords } from '../hooks/useRecords'
import { useCycleRecords } from '../hooks/useCycleRecords'
import { combinedActivityOnDate, totalCycleUnits, pagesRecordsForTotals, cycleRecordsForTotals, todayStr } from '../lib/progress'
import { RANK_POPULATION, totalPagesToRank, totalActivity, totalPagesForRank, nextRankMilestone, rankToDeviation, sampleNearBoard, sampleTopRivals } from '../lib/ranking'
import { seasonDayIndex, seasonIdForDate, seasonStartForDate, seasonEndForDate, leaguePopulationFor, leagueRankForPages, leagueRankForRating, decideRoundOutcome, tallyToResults, PROMOTION_LINES, STAY_LINES } from '../lib/seasonLeague'
import { loadSeasonState, saveSeasonState, finalizeRoundEarly } from '../data/seasonStore'
import { loadProfile } from '../data/profileStore'
import { levelForExp } from '../lib/seasonExp'
import { parseSlotKey } from '../lib/slotLeague'

type Props = { onBack: () => void; today?: string }

// Divロゴ画像（添付の10枚を public/divs/div-1.jpg〜div-10.jpg として配置して使用）
export function divEmblemSrc(div: number): string {
  const n = Math.min(10, Math.max(1, Math.round(div)))
  return `./divs/div-${n}.png?v=3`
}

// 選択中のタブだけ種別に調和する色にする。全国は白背景用（白＋濃枠）、リーグ/RPGはダーク背景用。非選択は既定のまま。
function tabStyle(active: boolean, variant: 'national' | 'league' | 'rpg' = 'national'): CSSProperties | undefined {
  if (!active) return undefined
  if (variant === 'league') return { background: '#151a30', color: '#ffe600', border: '1px solid #ffe600', fontWeight: 800 }
  if (variant === 'rpg') return { background: '#1e2a5a', color: '#fff', border: '1px solid #fff', fontWeight: 800 }
  return { background: '#ffffff', color: '#111111', border: '2px solid #111111', fontWeight: 800 }
}

export default function RankingScreen({ onBack, today: todayProp }: Props) {
  const { books } = useBooks()
  const { records } = useRecords()
  const { cycleRecords } = useCycleRecords()
  const today = todayProp ?? todayStr()
  // 集計は現存する本に属する行だけにする（反復本への誤ページ記録・削除済み本の残留を除外）。
  const validRecords = useMemo(() => pagesRecordsForTotals(records, books), [records, books])
  const validCycles = useMemo(() => cycleRecordsForTotals(cycleRecords, books), [cycleRecords, books])
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
  const todayPages = combinedActivityOnDate(today, validRecords, validCycles)
  const totalPages = totalActivity(validRecords) + totalCycleUnits(validCycles)
  const rank = totalPagesToRank(totalPages)
  const deviation = rankToDeviation(rank)
  void nowMin
  const rivals = useMemo(() => sampleNearBoard(totalPages, rank, today, 5), [totalPages, rank, today])
  const topRivals = useMemo(() => sampleTopRivals(today, 10), [today])
  const milestone = nextRankMilestone(rank)
  const milestoneDiff = milestone == null ? 0 : Math.max(0, totalPagesForRank(milestone) - totalPages)
  const dayOfMonth = Number(today.slice(8, 10))
  const isMockWeek = dayOfMonth >= 1 && dayOfMonth <= 7
  const level = deviation >= 60 ? 'A' : deviation >= 55 ? 'B' : deviation >= 50 ? 'C' : deviation >= 45 ? 'D' : 'E'
  const [playMode] = useState(() => loadProfile().playMode)
  const showLeague = playMode !== 'rpg'
  const showRpg = playMode !== 'league'
  const [tab, setTab] = useState<'national' | 'league' | 'rpg'>(() => {
    return playMode === 'league' ? 'league' : playMode === 'rpg' ? 'rpg' : 'national'
  })
  const [emblemBroken, setEmblemBroken] = useState(false)
  useEffect(() => {
    if (!showLeague && tab === 'league') setTab('rpg')
    else if (!showRpg && tab === 'rpg') setTab('league')
  }, [showLeague, showRpg, tab])
  const [seasonTick, setSeasonTick] = useState(0)
  const seasonState = useMemo(() => {
    try {
      return loadSeasonState(today)
    } catch {
      return { seasonId: '2026-09-01', div: 10, highestDiv: 10, phaseBestDiv: 10, rating: 0, ratedUpTo: null, round: { w: 0, d: 0, l: 0, lastDate: null }, exp: 0, days: {} as Record<string, number>, slotMatches: {} }
    }
  }, [today, seasonTick])
  const leagueDay = useMemo(() => {
    try {
      return seasonDayIndex(today)
    } catch {
      return 0
    }
  }, [today])
  useEffect(() => {
    setEmblemBroken(false)
  }, [seasonState.div])
  const mySeasonCumPages = useMemo(() => {
    try {
      // 自分の今季累計はDBから今季範囲で直接合計する。
      // seasonState.days（ホーム画面の訪問時にしか書かれないキャッシュ）や
      // 全期間合計に依存すると、履歴・成績の数字が食い違う。
      const start = seasonStartForDate(today)
      const base = Date.parse(start + 'T00:00:00Z')
      const dateFor = (d: number) => {
        if (!Number.isFinite(base)) return today
        return new Date(base + d * 86400000).toISOString().slice(0, 10)
      }
      const dailyAt = (d: number) => {
        try {
          return combinedActivityOnDate(dateFor(d), validRecords, validCycles)
        } catch {
          return 0
        }
      }
      let myCum = 0
      try {
        for (let d = 0; d <= leagueDay; d++) myCum += dailyAt(d)
      } catch {
        myCum = 0
      }
      return myCum
    } catch {
      try {
        return combinedActivityOnDate(today, validRecords, validCycles)
      } catch {
        return 0
      }
    }
  }, [today, validRecords, validCycles, leagueDay])
  const seasonCum = mySeasonCumPages
  const pop = useMemo(() => {
    try {
      return leaguePopulationFor(seasonState.seasonId ?? seasonIdForDate(today))
    } catch {
      return 2000000
    }
  }, [seasonState.seasonId, today])
  const isPointsDiv = seasonState.div >= 4
  // Div4〜10は勝ち点のみ。Div3〜1はレーティング基準順位（1900→約100万、2000→70万切り、popで変動）。
  const headerRating = seasonState.rating
  const leagueRankVal = isPointsDiv ? leagueRankForPages(seasonCum, pop) : leagueRankForRating(seasonState.rating, pop)
  const leagueWins = seasonState.round?.w ?? 0
  const phaseNo = useMemo(() => {
    try {
      const diff = Math.floor((Date.parse(today + 'T00:00:00Z') - Date.parse('2026-09-01T00:00:00Z')) / 86400000)
      if (!Number.isFinite(diff) || diff < 0) return 1
      return Math.floor(diff / 28) + 1
    } catch {
      return 1
    }
  }, [today])
  const phaseRange = useMemo(() => {
    try {
      const fmt = (d: string) => d.replaceAll('-', '/')
      return { start: fmt(seasonStartForDate(today)), end: fmt(seasonEndForDate(today)) }
    } catch {
      return { start: today.replaceAll('-', '/'), end: today.replaceAll('-', '/') }
    }
  }, [today])
  const leagueDaily = useMemo(() => {
    try {
      const entries = Object.entries(seasonState.slotMatches ?? {})
        .sort(([a], [b]) => {
          const pa = parseSlotKey(a)
          const pb = parseSlotKey(b)
          if (pa && pb) {
            if (pa.date !== pb.date) return pa.date < pb.date ? -1 : 1
            if (pa.startMin !== pb.startMin) return pa.startMin - pb.startMin
            return pa.endMin - pb.endMin
          }
          return a < b ? -1 : a > b ? 1 : 0
        })
        .slice(-5)
        .map(([, m]) => ({ date: m.date, pages: m.my, average: 0, opponent: m.oppName, opponentPages: m.opp, result: m.result, unit: m.unit }))
      return entries
    } catch { return [] }
  }, [seasonState.slotMatches])
  const leagueRecord = useMemo(() => {
    const wins = leagueDaily.filter((d) => d.result === 'win').length
    const draws = leagueDaily.filter((d) => d.result === 'draw').length
    const losses = leagueDaily.filter((d) => d.result === 'loss').length
    const played = wins + draws + losses
    return { wins, draws, losses, played, rate: played > 0 ? Math.round((wins / played) * 100) : 0 }
  }, [leagueDaily])
  const leagueLevel = (() => {
    try {
      return levelForExp(seasonState.exp)
    } catch {
      return 1
    }
  })()
  const isRpg = tab === 'rpg' && showRpg
  const isLeague = tab === 'league' && showLeague
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
          : isLeague
            ? 'linear-gradient(160deg, #000 55%, #0b1e78 140%)'
            : undefined,
      }}
    >
      <h1 style={{ fontSize: 20, color: isRpg || isLeague ? '#fff' : undefined, textShadow: isRpg || isLeague ? '0 1px 4px rgba(0,0,0,0.4)' : undefined }}>仮想全国ランキング</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button data-testid="national-tab" type="button" onClick={() => setTab('national')} style={tabStyle(tab === 'national', 'national')} aria-current={tab === 'national' ? 'page' : undefined}>
          全国
        </button>
        {showLeague && (
          <button data-testid="league-tab" type="button" onClick={() => setTab('league')} style={tabStyle(tab === 'league', 'league')} aria-current={tab === 'league' ? 'page' : undefined}>
            リーグ
          </button>
        )}
        {showRpg && (
          <button data-testid="rpg-tab" type="button" onClick={() => setTab('rpg')} style={tabStyle(tab === 'rpg', 'rpg')} aria-current={tab === 'rpg' ? 'page' : undefined}>
            RPG
          </button>
        )}
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
      {tab === 'league' && showLeague && (
        <div data-testid="league-board" style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {isPointsDiv ? (
          <section
            data-testid="league-points-card"
            style={{ padding: '14px 12px', borderRadius: 12, background: '#1e1f22', border: '1px solid #333', color: '#fff' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                data-testid="league-div-emblem-wrap"
                style={{ width: 54, height: 54, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
              {emblemBroken ? (
                <div
                  style={{
                    width: 54, height: 54, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 26, fontWeight: 900, color: '#fff', background: '#2b3a8f', border: '2px solid #fff',
                  }}
                  role="img" aria-label={`Division ${seasonState.div}エンブレム`}
                >
                  {seasonState.div}
                </div>
              ) : (
                <img
                  data-testid="league-div-emblem"
                  src={divEmblemSrc(seasonState.div)}
                  alt={`Division ${seasonState.div}エンブレム`}
                  width={54}
                  height={54}
                  style={{ width: 54, height: 54, objectFit: 'contain', flexShrink: 0, display: 'block', border: 'none', background: 'transparent' }}
                  onError={() => setEmblemBroken(true)}
                />
              )}
              </div>
              <div>
                <div data-testid="league-division" style={{ fontWeight: 900, fontSize: 24, color: '#ffe600', lineHeight: 1.1 }}>
                  Division {seasonState.div}
                </div>
                <div data-testid="league-phase" style={{ fontSize: 13, color: '#d7ff00', marginTop: 2, fontWeight: 700 }}>
                  フェーズ{phaseNo}: {phaseRange.start}〜{phaseRange.end}
                </div>
              </div>
            </div>
            {(() => {
              const t = seasonState.round ?? { w: 0, d: 0, l: 0, lastDate: null }
              const played = Math.min(10, t.w + t.d + t.l)
              const pts = t.w * 3 + t.d
              const promo = PROMOTION_LINES[seasonState.div] ?? 0
              const stay = STAY_LINES[seasonState.div]
              const maxScale = Math.max(promo + 4, pts + 2, 1)
              const fillPct = Math.min(100, Math.max(0, (pts / maxScale) * 100))
              const stayPct = stay == null ? null : Math.min(100, Math.max(0, (stay / maxScale) * 100))
              const promoPct = Math.min(100, Math.max(0, (promo / maxScale) * 100))
              const outcome = decideRoundOutcome(seasonState.div, tallyToResults(t))
              const statusText = outcome === 'promote' ? '昇格が確定しました' : outcome === 'stay' ? '残留が確定しました' : outcome === 'relegate' ? '降格が確定しました' : ''
              return (
                <>
                  <div data-testid="league-points" style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginTop: 12 }}>
                    現在の勝ち点: {pts}
                  </div>
                  <div data-testid="league-gauge" style={{ marginTop: 8 }}>
                    <div style={{ position: 'relative', height: 28, background: '#4b4d52', borderRadius: 2, overflow: 'hidden' }}>
                      <div data-testid="league-gauge-fill" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${fillPct}%`, background: '#2fd44f' }} />
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', color: '#fff', fontWeight: 700, fontSize: 16, padding: '0 8px', justifyContent: 'space-between' }}>
                        <span>0</span>
                        {stayPct != null && <span data-testid="league-gauge-stay-mark">{stay}</span>}
                        <span data-testid="league-gauge-promo-mark">{promo}</span>
                      </div>
                      {stayPct != null && <div style={{ position: 'absolute', left: `${stayPct}%`, top: 0, bottom: 0, borderLeft: '2px dashed rgba(255,255,255,0.9)' }} />}
                      <div style={{ position: 'absolute', left: `${promoPct}%`, top: 0, bottom: 0, borderLeft: '2px dashed rgba(255,255,255,0.9)' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      {stayPct != null ? (
                        <>
                          <div style={{ width: `${stayPct}%`, textAlign: 'center' }} data-testid="league-gauge-label-relegate">
                            <div data-testid="league-gauge-bracket-relegate" style={{ borderBottom: '2px solid #ff3b30', borderLeft: '2px solid #ff3b30', borderRight: '2px solid #ff3b30', height: 6 }} />
                            <div style={{ color: '#ff3b30', fontWeight: 800, fontSize: 14, paddingTop: 2 }}>降格</div>
                          </div>
                          <div style={{ width: `${Math.max(0, promoPct - (stayPct ?? 0))}%`, textAlign: 'center' }} data-testid="league-gauge-label-stay">
                            <div data-testid="league-gauge-bracket-stay" style={{ borderBottom: '2px solid #2fd44f', borderLeft: '2px solid #2fd44f', borderRight: '2px solid #2fd44f', height: 6 }} />
                            <div style={{ color: '#2fd44f', fontWeight: 800, fontSize: 14, paddingTop: 2 }}>残留</div>
                          </div>
                          <div style={{ flex: 1, textAlign: 'center' }} data-testid="league-gauge-label-promote">
                            <div data-testid="league-gauge-bracket-promote" style={{ borderBottom: '2px solid #2fd44f', borderLeft: '2px solid #2fd44f', borderRight: '2px solid #2fd44f', height: 6 }} />
                            <div style={{ color: '#2fd44f', fontWeight: 800, fontSize: 14, paddingTop: 2 }}>昇格</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ width: `${promoPct}%`, textAlign: 'center' }} data-testid="league-gauge-label-stay">
                            <div data-testid="league-gauge-bracket-stay" style={{ borderBottom: '2px solid #2fd44f', borderLeft: '2px solid #2fd44f', borderRight: '2px solid #2fd44f', height: 6 }} />
                            <div style={{ color: '#2fd44f', fontWeight: 800, fontSize: 14, paddingTop: 2 }}>残留</div>
                          </div>
                          <div style={{ flex: 1, textAlign: 'center' }} data-testid="league-gauge-label-promote">
                            <div data-testid="league-gauge-bracket-promote" style={{ borderBottom: '2px solid #2fd44f', borderLeft: '2px solid #2fd44f', borderRight: '2px solid #2fd44f', height: 6 }} />
                            <div style={{ color: '#2fd44f', fontWeight: 800, fontSize: 14, paddingTop: 2 }}>昇格</div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div data-testid="league-matches" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 8, borderTop: '1px solid #333' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>🏆 試合数</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{played}/10</span>
                  </div>
                  {statusText && <div data-testid="league-decision" style={{ fontSize: 15, color: '#9a9a9a', marginTop: 12 }}>{statusText}</div>}
                  {outcome === 'promote' && (t.w + t.d + t.l) < 10 && (
                    <button data-testid="league-skip" type="button" onClick={() => { try { saveSeasonState(finalizeRoundEarly(loadSeasonState(today), today)); setSeasonTick((v) => v + 1) } catch { /* ignore */ } }} style={{ background: 'transparent', border: 'none', color: '#3b82f6', fontWeight: 800, fontSize: 17, padding: '4px 0 0', cursor: 'pointer', textAlign: 'left' }}>
                      残りの試合をスキップ
                    </button>
                  )}
                </>
              )
            })()}
          </section>
          ) : (
          <section
            style={{ padding: '14px 12px', borderRadius: 16, background: '#151a30', border: '1px solid #2a3358', color: '#fff' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                data-testid="league-div-emblem-wrap"
                style={{ width: 54, height: 54, borderRadius: 16, overflow: 'hidden', flexShrink: 0, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
              {emblemBroken ? (
                <div
                  style={{
                    width: 54, height: 54, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 26, fontWeight: 900, color: '#fff', background: 'linear-gradient(180deg, #2b3a8f, #10163a)', border: '2px solid #ffe600',
                  }}
                  role="img" aria-label={`Division ${seasonState.div}エンブレム`}
                >
                  {seasonState.div}
                </div>
              ) : (
                <img
                  data-testid="league-div-emblem"
                  src={divEmblemSrc(seasonState.div)}
                  alt={`Division ${seasonState.div}エンブレム`}
                  width={54}
                  height={54}
                  style={{ width: 54, height: 54, objectFit: 'contain', flexShrink: 0, display: 'block', border: 'none', background: 'transparent' }}
                  onError={() => setEmblemBroken(true)}
                />
              )}
              </div>
              <div>
                <div data-testid="league-division" style={{ fontWeight: 900, fontSize: 24, color: '#ffe600', lineHeight: 1.1 }}>
                  Division {seasonState.div}
                </div>
                <div data-testid="league-phase" style={{ fontSize: 13, color: '#ffe600', marginTop: 2 }}>
                  フェーズ{phaseNo}: {phaseRange.start}〜{phaseRange.end}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 44, height: 44, borderRadius: '50%', background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} role="img" aria-label="レーティング">
                  <svg data-testid="league-rating-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="3,19 9,13 13,16 19,7" />
                    <polyline points="14,7 19,7 19,12" />
                  </svg>
                </span>
                <span>
                  <span style={{ display: 'block', fontSize: 12, color: '#9aa3c0' }}>レーティング</span>
                  <span data-testid="league-rating" style={{ fontSize: 22, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
                    {headerRating.toLocaleString()}
                  </span>
                </span>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 44, height: 44, borderRadius: '50%', background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }} role="img" aria-label="順位">👑</span>
                <span>
                  <span style={{ display: 'block', fontSize: 12, color: '#9aa3c0' }}>順位</span>
                  <span data-testid="league-rank" style={{ fontSize: 20, fontWeight: 900, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {`${leagueRankVal.toLocaleString()}位`}
                  </span>
                </span>
              </div>
            </div>
            <div data-testid="league-wins" style={{ fontSize: 13, color: '#fff', marginTop: 4, fontWeight: 800 }}>
              ○{leagueWins}勝
            </div>
          </section>
          )}
          <div data-testid="league-panel-info" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <section
            style={{ padding: '12px', borderRadius: 16, background: '#151a30', border: '1px solid #2a3358', color: '#fff' }}
          >
            <div data-testid="league-reward" style={{ fontSize: 14 }}>
              <span style={{ fontWeight: 800 }}>🏆 メイン報酬　</span>
              {seasonState.div > 1 ? `Division ${seasonState.div - 1}への昇格` : 'Div.1制覇の称号'}
            </div>
          </section>
          </div>
          <div data-testid="league-panel-record" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <section
            data-testid="league-record"
            style={{ padding: '12px', borderRadius: 16, background: '#151a30', border: '1px solid #2a3358', color: '#fff' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 800 }}>成績</span>
              <span style={{ fontSize: 12, color: '#9aa3c0' }}>（勝率 {leagueRecord.played > 0 ? `${leagueRecord.rate}%` : '―'}）</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, textAlign: 'center' }}>
              {[
                { label: '勝利', n: leagueRecord.wins, bg: '#2fd44f', fg: '#06210f' },
                { label: '引分', n: leagueRecord.draws, bg: '#6b7280', fg: '#fff' },
                { label: '敗戦', n: leagueRecord.losses, bg: '#ff4d5e', fg: '#fff' },
              ].map((c) => (
                <div key={c.label} style={{ flex: 1 }}>
                  <div style={{ background: c.bg, color: c.fg, borderRadius: 4, padding: '6px 0', fontWeight: 800, fontSize: 13 }}>
                    {c.label}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{c.n}</div>
                </div>
              ))}
            </div>
          </section>
          <section
            data-testid="league-history"
            style={{ padding: '12px', borderRadius: 16, background: '#151a30', border: '1px solid #2a3358', color: '#fff' }}
          >
            <div style={{ fontWeight: 800, marginBottom: 8 }}>対戦履歴（直近{Math.min(5, leagueDaily.length)}節）</div>
            {leagueDaily.length === 0 ? (
              <div data-testid="league-history-empty" style={{ fontSize: 13, color: '#9aa3c0' }}>
                まだ対戦がありません。記録すると反映されます。
              </div>
            ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              {leagueDaily.slice(-5).map((d, i) => (
                <div key={`${d.date}-${i}`} data-testid={`league-history-${i}`} style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: '#9aa3c0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.opponent}</div>
                  <div
                    style={{
                      borderRadius: 4, padding: '6px 0', fontWeight: 900, fontSize: 15, marginTop: 2, fontVariantNumeric: 'tabular-nums',
                      background: d.result === 'win' ? '#2fd44f' : d.result === 'loss' ? '#ff4d5e' : '#6b7280',
                      color: d.result === 'win' ? '#06210f' : '#fff',
                    }}
                  >
                    {`${d.pages}-${d.opponentPages}${d.unit === 'words' ? '語' : d.unit === 'sections' ? '区画' : 'ページ'}`}
                  </div>
                </div>
              ))}
            </div>
            )}
          </section>
            </div>
        </div>
      )}
      {tab === 'rpg' && showRpg && (
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
      {!isLeague && (
        <button data-testid="ranking-back" type="button" onClick={onBack}>
          戻る
        </button>
      )}
    </div>
  )
}
