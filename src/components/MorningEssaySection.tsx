import { useMemo, useState } from 'react'
import {
  CORRECTION_PASTE_MIN_LENGTH,
  DEFAULT_ESSAY_PROMPT,
  buildChatGptUrl,
  calcCorrectionRate,
  getWeekDays,
  isCorrectionPasteValid,
  startOfWeekMonday,
} from '../lib/morningEssay'
import {
  getMorningEssayRecord,
  deleteMorningEssayRecord,
  loadMorningEssayRecords,
  saveMorningEssayRecord,
} from '../data/morningEssayStore'
import { todayStr } from '../lib/progress'

type Props = {
  today?: string
}

export default function MorningEssaySection({ today: todayProp }: Props) {
  const today = todayProp ?? todayStr()
  const [tick, setTick] = useState(0)
  const [paste, setPaste] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [weekOpen, setWeekOpen] = useState(false)
  const [promptEditing, setPromptEditing] = useState(false)
  const [promptDraft, setPromptDraft] = useState('')
  const [promptError, setPromptError] = useState<string | null>(null)
  const [addDate, setAddDate] = useState('')
  const [addError, setAddError] = useState<string | null>(null)

  const records = useMemo(() => loadMorningEssayRecords(), [today, tick])
  const current = getMorningEssayRecord(today)
  const choice = current?.choice ?? null

  const refresh = () => setTick((t) => t + 1)

  const choose = (next: 'essay' | 'book') => {
    saveMorningEssayRecord({
      date: today,
      choice: next,
      correctionDone: current?.correctionDone ?? false,
      correctionText: current?.correctionText,
      prompt: current?.prompt ?? DEFAULT_ESSAY_PROMPT,
    })
    setError(null)
    refresh()
  }

  const openChatGpt = () => {
    const prompt = current?.prompt ?? DEFAULT_ESSAY_PROMPT
    window.open(buildChatGptUrl(prompt), '_blank')
    try {
      void navigator.clipboard?.writeText(prompt)
    } catch {
      // コピーに失敗しても起動は続ける
    }
  }

  const saveCorrection = () => {
    if (!isCorrectionPasteValid(paste)) {
      setError(`添削結果を貼ってください（${CORRECTION_PASTE_MIN_LENGTH}文字以上）`)
      return
    }
    saveMorningEssayRecord({
      date: today,
      choice: 'essay',
      correctionDone: true,
      correctionText: paste.trim(),
      prompt: current?.prompt ?? DEFAULT_ESSAY_PROMPT,
    })
    setError(null)
    setPaste('')
    refresh()
  }

  const rate = calcCorrectionRate(records, today)
  const weekDays = useMemo(() => getWeekDays(today), [today])

  const openPromptEditor = () => {
    setPromptDraft(current?.prompt ?? DEFAULT_ESSAY_PROMPT)
    setPromptError(null)
    setPromptEditing(true)
  }

  const savePrompt = () => {
    const text = promptDraft.trim()
    if (!text) {
      setPromptError('指示文を入力してください')
      return
    }
    if (current) {
      saveMorningEssayRecord({ ...current, prompt: text })
    } else {
      saveMorningEssayRecord({
        date: today,
        choice: 'essay',
        correctionDone: false,
        prompt: text,
      })
    }
    setPromptError(null)
    setPromptEditing(false)
    refresh()
  }

  const toggleDayDone = (date: string) => {
    const rec = records.find((r) => r.date === date)
    if (rec?.correctionDone) {
      saveMorningEssayRecord({ ...rec, correctionDone: false })
    } else if (rec) {
      saveMorningEssayRecord({ ...rec, choice: 'essay', correctionDone: true })
    } else {
      saveMorningEssayRecord({
        date,
        choice: 'essay',
        correctionDone: true,
        prompt: DEFAULT_ESSAY_PROMPT,
      })
    }
    refresh()
  }

  const cycleDayChoice = (date: string) => {
    const rec = records.find((r) => r.date === date)
    if (!rec) return
    if (rec.choice === 'essay') {
      saveMorningEssayRecord({
        ...rec,
        choice: 'book',
        correctionDone: false,
        correctionText: undefined,
      })
    } else {
      saveMorningEssayRecord({ ...rec, choice: 'essay' })
    }
    refresh()
  }

  const removeDay = (date: string) => {
    if (!window.confirm(`${date.slice(5).replace('-', '/')} の記録を消しますか？`)) return
    deleteMorningEssayRecord(date)
    refresh()
  }

  const addDay = () => {
    if (!addDate) {
      setAddError('日付を入れてください')
      return
    }
    if (records.some((r) => r.date === addDate)) {
      setAddError('その日はすでにあるよ')
      return
    }
    saveMorningEssayRecord({
      date: addDate,
      choice: 'essay',
      correctionDone: false,
      prompt: DEFAULT_ESSAY_PROMPT,
    })
    setAddError(null)
    setAddDate('')
    refresh()
  }

  return (
    <div
      data-testid="morning-essay-section"
      style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }}
    >
      <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>朝 6:30〜7:00（今日は何をやる？）</h2>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          data-testid="morning-choice-essay"
          type="button"
          onClick={() => choose('essay')}
          style={{ fontWeight: choice === 'essay' ? 800 : 400 }}
        >
          英作文
        </button>
        <button
          data-testid="morning-choice-book"
          type="button"
          onClick={() => choose('book')}
          style={{ fontWeight: choice === 'book' ? 800 : 400 }}
        >
          参考書
        </button>
      </div>

      {choice === 'essay' && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            data-testid="morning-prompt-box"
            role="button"
            tabIndex={0}
            title="タップで編集"
            onClick={() => {
              if (!promptEditing) openPromptEditor()
            }}
            onKeyDown={(e) => {
              if (!promptEditing && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                openPromptEditor()
              }
            }}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface-dim)',
              lineHeight: 1.7,
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>出題の指示文</span>
              <span style={{ fontWeight: 400, fontSize: 10 }}>{promptEditing ? '編集中（ほかタップで自動保存）' : 'タップで編集'}</span>
            </div>
            {promptEditing ? (
              <textarea
                data-testid="morning-prompt-input"
                value={promptDraft}
                onChange={(e) => setPromptDraft(e.target.value)}
                onBlur={() => savePrompt()}
                rows={4}
                autoFocus
                style={{ width: '100%', boxSizing: 'border-box', fontSize: 14, lineHeight: 1.7, margin: 0 }}
              />
            ) : (
              <p data-testid="morning-prompt-preview" style={{ fontSize: 14, margin: 0 }}>
                {current?.prompt ?? DEFAULT_ESSAY_PROMPT}
              </p>
            )}
            {promptEditing && promptError && (
              <p data-testid="morning-prompt-error" style={{ color: 'var(--danger)', fontSize: 13, margin: '4px 0 0' }}>
                {promptError}
              </p>
            )}
          </div>
          <div data-testid="morning-actions" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              data-testid="morning-open-chatgpt"
              type="button"
              style={{ padding: '12px 8px', fontSize: 15, fontWeight: 700 }}
              onClick={() => void openChatGpt()}
            >
              ChatGPTで出題を開く
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              data-testid="morning-correction-input"
              type="text"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder="添削結果を貼ると自動で完了"
              style={{ flex: 1, minWidth: 0, margin: 0 }}
            />
            <button
              data-testid="morning-correction-save"
              type="button"
              style={{ flexShrink: 0, padding: '10px 12px' }}
              onClick={saveCorrection}
            >
              記録
            </button>
          </div>
          {error && (
            <p data-testid="morning-correction-error" style={{ color: 'var(--danger)', fontSize: 13 }}>
              {error}
            </p>
          )}
          {current?.correctionDone && (
            <p data-testid="morning-done" style={{ fontSize: 13, fontWeight: 700 }}>
              今日は添削まで完了！
            </p>
          )}
          <p data-testid="morning-rate" style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
            添削までできた率 {rate.rate}%（{rate.done}/{rate.chosen}）
          </p>
          <button
            data-testid="morning-week-edit-toggle"
            type="button"
            style={{ padding: '10px 8px', fontSize: 14 }}
            onClick={() => setWeekOpen((v) => !v)}
          >
            {weekOpen ? '今週の編集を閉じる' : '今週を編集'}
          </button>
          {weekOpen && (
            <div data-testid="morning-week-editor">
              {weekDays
                .filter((d) => records.some((r) => r.date === d))
                .map((d) => {
                const rec = records.find((r) => r.date === d)
                const done = rec?.correctionDone ?? false
                const isEssay = rec?.choice === 'essay'
                return (
                  <div
                    key={d}
                    data-testid={`morning-day-row-${d}`}
                    style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, fontSize: 13, flexWrap: 'wrap' }}
                  >
                    <span style={{ minWidth: 56 }}>{d.slice(5).replace('-', '/')}</span>
                    <button
                      data-testid={`morning-day-choice-${d}`}
                      type="button"
                      onClick={() => cycleDayChoice(d)}
                    >
                      {isEssay ? '英作文' : '参考書'}
                    </button>
                    {isEssay && (
                      <button
                        data-testid={`morning-day-done-${d}`}
                        type="button"
                        onClick={() => toggleDayDone(d)}
                        style={
                          done
                            ? {
                                background: '#2f9e63',
                                borderColor: '#2f9e63',
                                color: '#fff',
                                fontWeight: 700,
                              }
                            : undefined
                        }
                      >
                        {done ? '済' : '未'}
                      </button>
                    )}
                    <button
                      data-testid={`morning-day-delete-${d}`}
                      type="button"
                      aria-label={`${d.slice(5).replace('-', '/')} の記録を消す`}
                      onClick={() => removeDay(d)}
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                <input
                  data-testid="morning-add-date"
                  type="date"
                  value={addDate}
                  min={startOfWeekMonday(today)}
                  max={weekDays[weekDays.length - 1]}
                  onChange={(e) => setAddDate(e.target.value)}
                  aria-label="追加する日"
                  style={{ flex: 1, minWidth: 0 }}
                />
                <button
                  data-testid="morning-add-save"
                  type="button"
                  style={{ flexShrink: 0 }}
                  onClick={addDay}
                >
                  追加
                </button>
              </div>
              {addError && (
                <p data-testid="morning-add-error" style={{ color: 'var(--danger)', fontSize: 13 }}>
                  {addError}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {choice === 'book' && (
        <p data-testid="morning-book-hint" style={{ fontSize: 13, color: 'var(--text-dim)' }}>
          下の今日の計画から参考書を選んで進めてください。
        </p>
      )}
    </div>
  )
}
