import { useEffect, useMemo, useState } from 'react'
import { useBooks } from '../hooks/useBooks'
import { useRecords } from '../hooks/useRecords'
import { useCycleRecords } from '../hooks/useCycleRecords'
import {
  combinedActivityOnDate,
  totalCycleUnits,
  pagesRecordsForTotals,
  cycleRecordsForTotals,
  todayStr,
  formatDate,
  parseDate,
  overallDiagnosis,
  calcStreakDays,
} from '../lib/progress'
import {
  RANK_POPULATION,
  totalActivity,
  totalPagesToRank,
  totalPagesForRank,
  nextRankMilestone,
  rankToDeviation,
} from '../lib/ranking'
import { loadProfile, saveProfile } from '../data/profileStore'
import { loadLastRank, saveLastRank } from '../data/lastRankStore'
import { formatRankDelta, deltaTone } from '../lib/rankDelta'
import { ALL_UNIVERSITIES, facultiesFor, formalUniversityName } from '../data/universities'
import ProgressChart from '../components/ProgressChart'
import { loadMockHistory, recordMockIfNeeded, type MockRecord } from '../lib/mockHistory'
import { loadSeasonState } from '../data/seasonStore'
import { levelForExp } from '../lib/seasonExp'
import MockHistoryChart from '../components/MockHistoryChart'
import LeagueBadgeShelf from '../components/LeagueBadgeShelf'

// Appは必ずonBreakdownを渡す。任意化は既存テスト互換のため
type Props = { onBack: () => void; onRanking: () => void; onBreakdown?: () => void; today?: string }

const GRADES = ['高1', '高2', '高3', '浪人']

const cardStyle = {
  marginTop: 8,
  marginBottom: 8,
  padding: '10px 12px',
  borderRadius: 8,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
} as const

export default function MyPageScreen({ onBack, onRanking, onBreakdown, today: todayProp }: Props) {
  const { books } = useBooks()
  const { records } = useRecords()
  const { cycleRecords } = useCycleRecords()
  const today = todayProp ?? todayStr()
  const [profile, setProfile] = useState(loadProfile)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(profile)

  // 集計は現存する本に属する行だけにする（反復本への誤ページ記録・削除済み本の残留を除外）。
  const validRecords = useMemo(() => pagesRecordsForTotals(records, books), [records, books])
  const validCycles = useMemo(() => cycleRecordsForTotals(cycleRecords, books), [cycleRecords, books])
  const todayPages = combinedActivityOnDate(today, validRecords, validCycles)
  const totalPages = totalActivity(validRecords) + totalCycleUnits(validCycles)
  const rank = totalPagesToRank(totalPages, today)
  const [prevRank] = useState<number | null>(() => loadLastRank())
  useEffect(() => {
    saveLastRank(rank)
  }, [rank])
  const deltaText = formatRankDelta(prevRank, rank)
  const tone = deltaTone(prevRank, rank)
  const deviation = rankToDeviation(rank)
  const milestone = nextRankMilestone(rank)
  const milestoneDiff = milestone == null ? 0 : Math.max(0, totalPagesForRank(milestone, today) - totalPages)
  const [mockHistory, setMockHistory] = useState<MockRecord[]>(() => loadMockHistory())
  useEffect(() => {
    setMockHistory(recordMockIfNeeded(today, rank, deviation, totalPages))
  }, [today, rank, deviation, totalPages])
  const prevDev = mockHistory.length >= 2 ? mockHistory[mockHistory.length - 2].deviation : null
  const devDelta = prevDev == null || mockHistory.length === 0 ? null : Math.round((mockHistory[mockHistory.length - 1].deviation - prevDev) * 10) / 10

  const diagnosis = overallDiagnosis(books, records, today)
  const dailyQuota = Math.max(1, diagnosis.requiredPerDay)
  const streakScores: Record<string, number> = {}
  for (const d of new Set([...validRecords.map((r) => r.date), ...validCycles.map((r) => r.date)])) {
    streakScores[d] = combinedActivityOnDate(d, validRecords, validCycles)
  }
  const streak = calcStreakDays(streakScores, dailyQuota, today)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = parseDate(today)
    d.setDate(d.getDate() - (6 - i))
    return formatDate(d)
  })
  const last7Values = last7Days.map((d) => combinedActivityOnDate(d, validRecords, validCycles))

  const startEdit = () => {
    setDraft(profile)
    setEditing(true)
  }
  const cancelEdit = () => {
    setDraft(profile)
    setEditing(false)
  }
  const save = () => {
    saveProfile(draft)
    setProfile(draft)
    setEditing(false)
  }

  const facultyOptions = draft.university ? facultiesFor(draft.university) : []
  const hasUniv = profile.university !== ''
  const season = loadSeasonState(today)

  return (
    <div
      data-testid="mypage-page"
      style={{
        padding: 16,
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #dbe7ff 0%, #eef4ff 38%, #f2f4f8 100%)',
      }}
    >
      <h1 style={{ fontSize: 20 }}>マイページ</h1>
      <section data-testid="mypage-hero" style={cardStyle}>
        {hasUniv ? (
          <>
            <div style={{ fontWeight: 800, fontSize: 20 }}>
              {formalUniversityName(profile.university)}{profile.faculty}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-dim)' }}>
              {[profile.nickname, profile.grade, profile.department].filter(Boolean).join(' / ')}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 800, fontSize: 18 }}>志望校：未設定</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              編集するから志望校を設定して道のりを表示しよう
            </div>
          </>
        )}
      </section>
      <section data-testid="mypage-goal" style={cardStyle}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>志望校への道のり</div>
        <div data-testid="mypage-rank" style={{ fontSize: 14 }}>
          全国{RANK_POPULATION.toLocaleString()}人中 {rank.toLocaleString()}位（偏差値{deviation}）
        </div>
        {deltaText != null && (
          <div data-testid="mypage-rank-delta" style={{ margin: '8px 0' }}>
            {tone === 'flat' ? (
              <span
                style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 800,
                  lineHeight: 1.2,
                  border: '1px solid',
                  borderColor: '#98a2b3',
                  background: '#f1f3f5',
                  color: '#5f6368',
                }}
              >
                — {deltaText}
              </span>
            ) : (
              <>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '6px 14px',
                    borderRadius: 999,
                    fontSize: 20,
                    fontWeight: 900,
                    lineHeight: 1.2,
                    border: '2px solid',
                    borderColor: tone === 'up' ? '#1a7f37' : '#b42318',
                    background: tone === 'up' ? '#e6f4ea' : '#fdecea',
                    color: tone === 'up' ? '#1a7f37' : '#b42318',
                  }}
                >
                  {tone === 'up' ? '▲' : '▼'} {deltaText} {tone === 'up' ? 'UP' : 'DOWN'}
                </span>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
                  前回比 {deltaText}
                  {tone === 'up' ? '：前回よりランクアップ！' : '：前回よりダウン'}
                </div>
              </>
            )}
          </div>
        )}
        <div style={{ fontSize: 14, fontWeight: 700 }}>
          {milestone == null
            ? '全国1位をキープ中！'
            : `全国${milestone.toLocaleString()}位（偏差値${rankToDeviation(milestone)}）まであと${milestoneDiff.toLocaleString()}ページ`}
        </div>
        <div data-testid="mypage-total" style={{ fontSize: 14 }}>累計 {totalPages.toLocaleString()}ページ</div>
        <div data-testid="mypage-today" style={{ fontSize: 14 }}>今日 {todayPages.toLocaleString()}ページ</div>
        <div data-testid="mypage-season">
          {profile.playMode === 'league' ? (
            <>Div.{season.div}</>
          ) : profile.playMode === 'rpg' ? (
            <>Lv.{levelForExp(season.exp)} EXP.{season.exp}</>
          ) : (
            <>Lv.{levelForExp(season.exp)} Div.{season.div} EXP.{season.exp}</>
          )}
        </div>
      </section>
      <LeagueBadgeShelf seasonId={season.seasonId} div={season.div} />
      <section data-testid="mypage-breakdown" style={cardStyle}>
        {onBreakdown ? (
          <button data-testid="mypage-breakdown-open" type="button" onClick={onBreakdown} style={{ fontWeight: 800, fontSize: 16, padding: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', textAlign: 'left' }}>
            累計の内訳 ＞
          </button>
        ) : (
          <div style={{ fontWeight: 800, fontSize: 16 }}>累計の内訳</div>
        )}
      </section>
      <section style={cardStyle}>
        <div data-testid="mypage-streak" style={{ fontWeight: 800, fontSize: 16 }}>
          連続{streak.streak}日
        </div>
        {streak.remaining > 0 && (
          <div style={{ fontSize: 13 }}>今日あと{streak.remaining}ページで継続！</div>
        )}
        <ProgressChart dates={last7Days} values={last7Values} />
      </section>
      <section data-testid="mock-history" style={cardStyle}>
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
      {!editing ? (
        <section data-testid="mypage-view" style={{ marginTop: 12 }}>
          <div>ニックネーム：{profile.nickname || '未設定'}</div>
          <div>学年：{profile.grade || '未設定'}</div>
          <div>志望校：{profile.university ? formalUniversityName(profile.university) : '未設定'} {profile.faculty || '未設定'}</div>
          {profile.department && <div>学科：{profile.department}</div>}
          <button data-testid="mypage-edit" type="button" onClick={startEdit} style={{ marginTop: 8 }}>
            編集する
          </button>
        </section>
      ) : (
        <section data-testid="mypage-form" style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label>
            ニックネーム
            <input data-testid="mypage-nickname" value={draft.nickname} onChange={(e) => setDraft({ ...draft, nickname: e.target.value })} />
          </label>
          <label>
            学年
            <select data-testid="mypage-grade" value={draft.grade} onChange={(e) => setDraft({ ...draft, grade: e.target.value })}>
              <option value="">選択</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </label>
          <label>
            志望大学
            <select
              data-testid="mypage-univ"
              value={draft.university}
              onChange={(e) => setDraft({ ...draft, university: e.target.value, faculty: '' })}
            >
              <option value="">選択</option>
              {ALL_UNIVERSITIES.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </label>
          <label>
            学部
            <select data-testid="mypage-faculty" value={draft.faculty} onChange={(e) => setDraft({ ...draft, faculty: e.target.value })}>
              <option value="">選択</option>
              {facultyOptions.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </label>
          <label>
            学科（任意）
            <input data-testid="mypage-dept" value={draft.department} onChange={(e) => setDraft({ ...draft, department: e.target.value })} placeholder="例：情報学科" />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button data-testid="mypage-save" type="button" onClick={save}>保存</button>
            <button data-testid="mypage-cancel" type="button" onClick={cancelEdit}>キャンセル</button>
          </div>
        </section>
      )}
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button data-testid="mypage-ranking" type="button" onClick={onRanking}>ランキングを見る</button>
        <button data-testid="mypage-back" type="button" onClick={onBack}>戻る</button>
      </div>
    </div>
  )
}
