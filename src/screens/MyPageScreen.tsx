import { useEffect, useState } from 'react'
import { useBooks } from '../hooks/useBooks'
import { useRecords } from '../hooks/useRecords'
import { useCycleRecords } from '../hooks/useCycleRecords'
import {
  scoreActivityOnDate,
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

type Props = { onBack: () => void; onRanking: () => void; today?: string }

const GRADES = ['高1', '高2', '高3', '浪人']

const cardStyle = {
  marginTop: 8,
  marginBottom: 8,
  padding: '10px 12px',
  borderRadius: 8,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
} as const

export default function MyPageScreen({ onBack, onRanking, today: todayProp }: Props) {
  const { books } = useBooks()
  const { records } = useRecords()
  const { cycleRecords } = useCycleRecords()
  const today = todayProp ?? todayStr()
  const [profile, setProfile] = useState(loadProfile)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(profile)

  const todayPages = scoreActivityOnDate(today, records)
  const totalPages = totalActivity(records)
  const rank = totalPagesToRank(totalPages)
  const [prevRank] = useState<number | null>(() => loadLastRank())
  useEffect(() => {
    saveLastRank(rank)
  }, [rank])
  const deltaText = formatRankDelta(prevRank, rank)
  const tone = deltaTone(prevRank, rank)
  const deviation = rankToDeviation(rank)
  const milestone = nextRankMilestone(rank)
  const milestoneDiff = milestone == null ? 0 : Math.max(0, totalPagesForRank(milestone) - totalPages)

  const diagnosis = overallDiagnosis(books, records, today)
  const dailyQuota = Math.max(1, diagnosis.requiredPerDay)
  const streakScores: Record<string, number> = {}
  for (const d of new Set([...records.map((r) => r.date), ...cycleRecords.map((r) => r.date)])) {
    streakScores[d] = scoreActivityOnDate(d, records)
  }
  const streak = calcStreakDays(streakScores, dailyQuota, today)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = parseDate(today)
    d.setDate(d.getDate() - (6 - i))
    return formatDate(d)
  })
  const last7Values = last7Days.map((d) => scoreActivityOnDate(d, records))

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
          <div data-testid="mypage-rank-delta" style={{ fontSize: 16, fontWeight: 800, color: tone === 'up' ? '#1a7f37' : '#d1242f' }}>
            前回比 {deltaText}
          </div>
        )}
        <div style={{ fontSize: 14, fontWeight: 700 }}>
          {milestone == null
            ? '全国1位をキープ中！'
            : `全国${milestone.toLocaleString()}位（偏差値${rankToDeviation(milestone)}）まであと${milestoneDiff.toLocaleString()}ページ`}
        </div>
        <div data-testid="mypage-total" style={{ fontSize: 14 }}>累計 {totalPages.toLocaleString()}ページ</div>
        <div data-testid="mypage-today" style={{ fontSize: 14 }}>今日 {todayPages.toLocaleString()}ページ</div>
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
