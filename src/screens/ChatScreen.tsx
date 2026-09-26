import { useEffect, useState } from 'react'
import { useBooks } from '../hooks/useBooks'
import { db } from '../db/database'
import { listAvailability, addAdjustment } from '../data/dayplanStore'
import {
  buildAdvisorReport,
  answerBehind,
  answerPriority,
  answerPace,
  type AdvisorReport,
} from '../lib/advisor'
import { getAiSettings, isAiConfigured, chatWithModel, buildSystemPrompt } from '../lib/ai'
import { calcTotalDone, todayStr } from '../lib/progress'

type Props = {
  onBack: () => void
  today?: string
}

type ChatMessage = {
  id: string
  role: 'assistant' | 'user'
  text: string
  withProposal?: boolean
}

const CHIPS: { testid: string; label: string }[] = [
  { testid: 'chip-behind', label: '遅れている本は?' },
  { testid: 'chip-priority', label: '今日は何を優先すべき?' },
  { testid: 'chip-pace', label: 'ペースは間に合っている?' },
  { testid: 'chip-replan', label: '配分を見直して' },
]

export default function ChatScreen({ onBack, today: todayProp }: Props) {
  const today = todayProp ?? todayStr()
  const { saveBook } = useBooks()
  const [report, setReport] = useState<AdvisorReport | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [configured] = useState(() => isAiConfigured(getAiSettings()))

  const loadReport = async (): Promise<AdvisorReport | null> => {
    const [availability, allBooks, allRecords] = await Promise.all([
      listAvailability(),
      db.books.toArray(),
      db.records.toArray(),
    ])
    const targetBooks = allBooks.filter((b) => b.studyMode !== 'cycles')
    const donePagesByBook = Object.fromEntries(
      targetBooks.map((b) => [b.id, calcTotalDone(b, allRecords)]),
    )
    return buildAdvisorReport({ today, books: targetBooks, donePagesByBook, availability })
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const r = await loadReport()
      if (cancelled || !r) return
      setReport(r)
      setMessages([
        { id: crypto.randomUUID(), role: 'assistant', text: r.summaryText, withProposal: r.books.length > 0 },
      ])
    })()
    return () => {
      cancelled = true
    }
    // books/records は Hook で読み込み後に再描画される。availability の1回読み込みで完結する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const push = (m: Omit<ChatMessage, 'id'>) =>
    setMessages((prev) => [...prev, { ...m, id: crypto.randomUUID() }])

  const applyToday = async () => {
    if (!report) return
    const changes: { id: string; priority?: number }[] = []
    for (const id of report.proposal.focus) changes.push({ id, priority: 0 })
    for (const id of report.proposal.relax) changes.push({ id, priority: 2 })
    for (const c of changes) {
      const book = await db.books.get(c.id)
      if (!book || book.priority === c.priority) continue
      await saveBook(
        { ...book, priority: c.priority, updatedAt: new Date().toISOString() },
        false,
      )
      await addAdjustment({
        id: crypto.randomUUID(),
        date: today,
        bookId: c.id,
        kind: 'priority',
        value: c.priority as number,
      })
    }
    await afterApply(`${report.proposal.todayMessage}\n今日の配分を反映しました。`)
  }

  const applyPace = async () => {
    if (!report) return
    for (const r of report.proposal.ratios) {
      const book = await db.books.get(r.bookId)
      if (!book || book.allottedRatio === r.ratio) continue
      await saveBook(
        { ...book, allottedRatio: r.ratio, updatedAt: new Date().toISOString() },
        false,
      )
      await addAdjustment({
        id: crypto.randomUUID(),
        date: today,
        bookId: r.bookId,
        kind: 'ratio',
        value: r.ratio,
      })
    }
    await afterApply(`${report.proposal.paceMessage}\nペース目標を反映しました。`)
  }

  const afterApply = async (text: string) => {
    const r = await loadReport()
    if (r) {
      setReport(r)
      push({ role: 'assistant', text, withProposal: r.books.length > 0 })
    }
  }

  const answerOf = (testid: string): string | null => {
    if (!report) return null
    if (testid === 'chip-behind') return answerBehind(report)
    if (testid === 'chip-priority') return answerPriority(report)
    if (testid === 'chip-pace') return answerPace(report)
    return null
  }

  const onChip = (testid: string) => {
    if (!report) return
    const label = CHIPS.find((c) => c.testid === testid)!.label
    push({ role: 'user', text: label })
    if (testid === 'chip-replan') {
      push({ role: 'assistant', text: report.summaryText, withProposal: report.books.length > 0 })
    } else {
      const text = answerOf(testid)
      if (text) push({ role: 'assistant', text })
    }
  }

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    push({ role: 'user', text })
    if (!report) return
    setLoading(true)
    const settings = getAiSettings()
    const history = messages
      .filter((m) => m.role === 'user' || (m.role === 'assistant' && !m.withProposal))
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.text }))
    const result = await chatWithModel(settings, buildSystemPrompt(report), [
      ...history,
      { role: 'user', content: text },
    ])
    setLoading(false)
    if (result.ok) {
      push({ role: 'assistant', text: result.text })
    } else {
      push({
        role: 'assistant',
        text: 'オンラインAIに接続できませんでした。定型文（下のボタン）をご利用ください。',
      })
    }
  }

  return (
    <div data-testid="chat-screen" style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>調整AI</h1>
      <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
        参考書の進捗から配分とペースを提案します。期限は変更されません。
      </p>
      <div data-testid="chat-messages" style={{ marginTop: 12 }}>
        {messages.map((m) => (
          <div
            key={m.id}
            data-testid={m.role === 'user' ? 'chat-user-msg' : 'chat-assistant-msg'}
            style={{
              whiteSpace: 'pre-wrap',
              marginBottom: 8,
              padding: 8,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: m.role === 'user' ? 'var(--surface-dim)' : undefined,
            }}
          >
            {m.role === 'assistant' && m.withProposal && (
              <p data-testid="analysis-summary" style={{ fontWeight: 700, margin: '0 0 4px' }}>
                {m.text}
              </p>
            )}
            {m.role === 'user' || !m.withProposal ? (
              m.text
            ) : (
              <div data-testid="proposal-card" style={{ marginTop: 8 }}>
                <p style={{ margin: '0 0 8px', fontSize: 13 }}>{m.text.split('\n').slice(1).join('\n')}</p>
                <p style={{ margin: '0 0 8px' }}>{report?.proposal.todayMessage}</p>
                <p style={{ margin: '0 0 8px' }}>{report?.proposal.paceMessage}</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button data-testid="apply-today" type="button" onClick={() => void applyToday()}>
                    今日の配分を反映
                  </button>
                  <button data-testid="apply-pace" type="button" onClick={() => void applyPace()}>
                    ペース目標を反映
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <p data-testid="chat-loading" style={{ color: 'var(--text-dim)' }}>
            考え中…
          </p>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        {CHIPS.map((c) => (
          <button key={c.testid} data-testid={c.testid} type="button" onClick={() => onChip(c.testid)}>
            {c.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input
          data-testid="chat-input"
          type="text"
          value={input}
          disabled={!configured}
          placeholder="オンラインAIと自由に相談（設定で接続すると使えます）"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void send()
          }}
        />
        <button data-testid="chat-send" type="button" disabled={!configured || loading} onClick={() => void send()}>
          送信
        </button>
      </div>
      {!configured && (
        <p data-testid="chat-offline-notice" style={{ color: 'var(--text-dim)', fontSize: 13 }}>
          オフラインAIモードです。上の定型文ボタンで相談できます。設定画面からオンラインAIを登録すると自由文でも相談できます。
        </p>
      )}
      <p>
        <button data-testid="chat-back" onClick={onBack}>戻る</button>
      </p>
    </div>
  )
}