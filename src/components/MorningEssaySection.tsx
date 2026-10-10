import { useMemo, useState } from 'react'
import {
  CORRECTION_PASTE_MIN_LENGTH,
  DEFAULT_ESSAY_PROMPT,
  WEEKLY_ESSAY_GOAL,
  buildChatGptUrl,
  calcCorrectionRate,
  countWeeklyCorrections,
  isCorrectionPasteValid,
  isWeeklyGoalAchieved,
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

  const weeklyCount = countWeeklyCorrections(records, today)
  const achieved = isWeeklyGoalAchieved(records, today)
  const rate = calcCorrectionRate(records, today)

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
          <p data-testid="morning-weekly-status" style={{ fontSize: 13, marginTop: 8 }}>
            今週 {weeklyCount}/{WEEKLY_ESSAY_GOAL}{achieved ? ' 達成！' : ''}
          </p>
          <p data-testid="morning-rate" style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            添削までできた率 {rate.rate}%（{rate.done}/{rate.chosen}）
          </p>
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
