import { useMemo, useState } from 'react'
import {
  CORRECTION_PASTE_MIN_LENGTH,
  DEFAULT_ESSAY_PROMPT,
  buildChatGptUrl,
  calcCorrectionRate,
  getWeekDays,
  isCorrectionPasteValid,
} from '../lib/morningEssay'
import {
  getMorningEssayRecord,
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
        <div style={{ marginTop: 12 }}>
          <p data-testid="morning-prompt-preview" style={{ fontSize: 13 }}>
            {current?.prompt ?? DEFAULT_ESSAY_PROMPT}
          </p>
          <button
            data-testid="morning-prompt-edit-toggle"
            type="button"
            style={{ fontSize: 13 }}
            onClick={() => (promptEditing ? setPromptEditing(false) : openPromptEditor())}
          >
            {promptEditing ? '指示文の編集を閉じる' : '指示文を編集'}
          </button>
          {promptEditing && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <textarea
                data-testid="morning-prompt-input"
                value={promptDraft}
                onChange={(e) => setPromptDraft(e.target.value)}
                rows={3}
                style={{ flex: 1, fontSize: 13 }}
              />
              <button data-testid="morning-prompt-save" type="button" onClick={savePrompt}>
                保存
              </button>
            </div>
          )}
          {promptEditing && promptError && (
            <p data-testid="morning-prompt-error" style={{ color: 'var(--danger)', fontSize: 13 }}>
              {promptError}
            </p>
          )}
          <button data-testid="morning-open-chatgpt" type="button" onClick={() => void openChatGpt()}>
            ChatGPTで出題を開く
          </button>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              data-testid="morning-correction-input"
              type="text"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder="添削結果を貼ると自動で完了"
              style={{ flex: 1 }}
            />
            <button data-testid="morning-correction-save" type="button" onClick={saveCorrection}>
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
          <p data-testid="morning-rate" style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            添削までできた率 {rate.rate}%（{rate.done}/{rate.chosen}）
          </p>
          <button
            data-testid="morning-week-edit-toggle"
            type="button"
            style={{ marginTop: 4, fontSize: 13 }}
            onClick={() => setWeekOpen((v) => !v)}
          >
            {weekOpen ? '今週の編集を閉じる' : '今週を編集'}
          </button>
          {weekOpen && (
            <div data-testid="morning-week-editor" style={{ marginTop: 8 }}>
              {weekDays.map((d) => {
                const rec = records.find((r) => r.date === d)
                const done = rec?.correctionDone ?? false
                return (
                  <div
                    key={d}
                    data-testid={`morning-day-row-${d}`}
                    style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, fontSize: 13 }}
                  >
                    <span style={{ minWidth: 88 }}>{d.slice(5).replace('-', '/')}</span>
                    <button
                      data-testid={`morning-day-done-${d}`}
                      type="button"
                      onClick={() => toggleDayDone(d)}
                    >
                      {done ? '済' : '未'}
                    </button>
                  </div>
                )
              })}
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
