import { useState } from 'react'
import { useRecords } from '../hooks/useRecords'
import { scoreActivityOnDate, todayStr } from '../lib/progress'
import { RANK_POPULATION, totalActivity, totalPagesToRank, rankToDeviation } from '../lib/ranking'
import { loadProfile, saveProfile } from '../data/profileStore'
import { ALL_UNIVERSITIES, facultiesFor } from '../data/universities'

type Props = { onBack: () => void; onRanking: () => void; today?: string }

const GRADES = ['高1', '高2', '高3', '浪人']

export default function MyPageScreen({ onBack, onRanking, today: todayProp }: Props) {
  const { records } = useRecords()
  const today = todayProp ?? todayStr()
  const [profile, setProfile] = useState(loadProfile)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(profile)

  const todayPages = scoreActivityOnDate(today, records)
  const totalPages = totalActivity(records)
  const rank = totalPagesToRank(totalPages)
  const deviation = rankToDeviation(rank)

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
  const displayUniv = profile.university || '未設定'
  const displayFaculty = profile.faculty || '未設定'

  return (
    <div data-testid="mypage-page" style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>マイページ</h1>
      <section style={{ marginTop: 8 }}>
        <div data-testid="mypage-total" style={{ fontSize: 14 }}>累計 {totalPages.toLocaleString()}ページ</div>
        <div data-testid="mypage-today" style={{ fontSize: 14 }}>今日 {todayPages.toLocaleString()}ページ</div>
        <div data-testid="mypage-rank" style={{ fontSize: 14 }}>
          全国{RANK_POPULATION.toLocaleString()}人中 {rank.toLocaleString()}位（偏差値{deviation}）
        </div>
      </section>
      {!editing ? (
        <section data-testid="mypage-view" style={{ marginTop: 12 }}>
          <div>ニックネーム：{profile.nickname || '未設定'}</div>
          <div>学年：{profile.grade || '未設定'}</div>
          <div>志望校：{displayUniv} {displayFaculty}</div>
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
