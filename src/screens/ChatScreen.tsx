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
import {
  parseOperationReply,
  describeOperation,
  applyOperation,
  buildOpContext,
  type AiOperation,
} from '../lib/aiOperations'
import { listChatHistory, appendChatHistory } from '../data/chatHistoryStore'
import LongText from '../components/LongText'
import { calcTotalDone, todayStr } from '../lib/progress'

type Props = {
  onBack: () => void
  onHistory?: () => void
  today?: string
}

type ChatMessage = {
  id: string
  role: 'assistant' | 'user'
  text: string
  withProposal?: boolean
  kind?: 'chat' | 'notice'
}

const CHIPS: { testid: string; label: string }[] = [
  { testid: 'chip-behind', label: '遅れている本は?' },
  { testid: 'chip-priority', label: '今日は何を優先すべき?' },
  { testid: 'chip-pace', label: 'ペースは間に合っている?' },
  { testid: 'chip-replan', label: '配分を見直して' },
]

export function describeAiError(reason: 'network' | 'http' | 'timeout', status?: number): string {
  if (reason === 'timeout') {
    return 'オンラインAIの応答がタイムアウトしました（高精度モデルは30秒以上かかる場合があります）。再試行してください。'
  }
  if (reason === 'http') {
    const hint =
      status === 401
        ? 'APIキー・モデル名を確認してください。'
        : status === 402
          ? '支払い・利用枠を確認してください。'
          : status === 404
            ? 'モデル名・エンドポイントを確認してください。'
            : status === 429
              ? '利用制限のため時間をおいて再試行してください。'
              : ''
    return `オンラインAIでエラーが発生しました（HTTP ${status ?? '?'}）。${hint}定型文もご利用ください。`
  }
  return 'オンラインAIに接続できませんでした（ネットワーク未接続の可能性があります。WiFi・モバイル回線を確認してください）。定型文（下のボタン）をご利用ください。'
}

export default function ChatScreen({ onBack, onHistory, today: todayProp }: Props) {
  const today = todayProp ?? todayStr()
  const { saveBook } = useBooks()
  const [report, setReport] = useState<AdvisorReport | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [configured] = useState(() => isAiConfigured(getAiSettings()))
  const [online, setOnline] = useState(() =>
    typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
      ? navigator.onLine
      : true,
  )
  const [lastError, setLastError] = useState<{ reason: 'network' | 'http' | 'timeout'; status?: number; detail?: string } | null>(null)
  const [lastFailedInput, setLastFailedInput] = useState('')
  const [pendingOp, setPendingOp] = useState<{ op: AiOperation; description: string } | null>(null)
  const [historyExpanded, setHistoryExpanded] = useState(false)
  const VISIBLE_COUNT = 5

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

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
      const [saved, r] = await Promise.all([listChatHistory(), loadReport()])
      if (cancelled || !r) return
      setReport(r)
      setMessages([
        ...saved.map(
          (s) => ({ id: s.id, role: s.role, text: s.text, kind: s.kind ?? 'chat' }) as ChatMessage,
        ),
        { id: crypto.randomUUID(), role: 'assistant', text: r.summaryText, withProposal: r.books.length > 0 } as ChatMessage,
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

  const pushAndSave = (m: Omit<ChatMessage, 'id'>, kind: 'chat' | 'notice' = 'chat') => {
    push({ ...m, kind })
    void appendChatHistory({ role: m.role, text: m.text, kind }).catch(() => {})
  }

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
      pushAndSave({ role: 'assistant', text, withProposal: r.books.length > 0 }, 'notice')
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
    pushAndSave({ role: 'user', text: label })
    if (testid === 'chip-replan') {
      pushAndSave({ role: 'assistant', text: report.summaryText, withProposal: report.books.length > 0 })
    } else {
      const text = answerOf(testid)
      if (text) pushAndSave({ role: 'assistant', text })
    }
  }

  const requestAi = async (text: string) => {
    if (!report) return
    setLoading(true)
    setPendingOp(null)
    const settings = getAiSettings()
    const history = messages
      .filter((m) => m.role === 'user' || (m.role === 'assistant' && !m.withProposal))
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.text }))
    const [availability, allBooks] = await Promise.all([listAvailability(), db.books.toArray()])
    const targetBooks = allBooks.filter((b) => b.studyMode !== 'cycles')
    const result = await chatWithModel(
      settings,
      buildSystemPrompt(report, {
        slots: availability,
        books: targetBooks.map((b) => ({ id: b.id, title: b.title })),
      }),
      [...history, { role: 'user', content: text }],
    )
    setLoading(false)
    if (result.ok) {
      pushAndSave({ role: 'assistant', text: result.text })
      const parsed = parseOperationReply(result.text)
      if (parsed.ok && parsed.op) {
        const ctx = await buildOpContext()
        setPendingOp({ op: parsed.op, description: describeOperation(parsed.op, ctx) })
      } else if (!parsed.ok) {
        pushAndSave({ role: 'assistant', text: `操作案を読み取れませんでした（${parsed.error}）。もう一度具体的に指示してください。` })
      }
    } else {
      const err = result.ok === false ? result : { reason: 'network' as const }
      setLastError(
        'status' in err
          ? { reason: err.reason, status: err.status, detail: 'detail' in err ? (err.detail as string | undefined) : undefined }
          : { reason: err.reason, detail: 'detail' in err ? (err.detail as string | undefined) : undefined },
      )
      setLastFailedInput(text)
    }
  }

  const sendWithText = async (rawText: string) => {
    const text = rawText.trim()
    if (!text || loading) return
    setInput('')
    pushAndSave({ role: 'user', text })
    setLastError(null)
    await requestAi(text)
  }

  const send = async () => {
    await sendWithText(input)
  }

  const retry = async () => {
    if (!lastFailedInput || loading) return
    setLastError(null)
    const text = lastFailedInput
    setLastFailedInput('')
    pushAndSave({ role: 'user', text })
    await requestAi(text)
  }

  const applyPendingOp = async () => {
    if (!pendingOp) return
    const op = pendingOp.op
    setPendingOp(null)
    const res = await applyOperation(op)
    if (res.ok) {
      pushAndSave({ role: 'assistant', text: `${res.message}。` }, 'notice')
      const r = await loadReport()
      if (r) setReport(r)
    } else {
      pushAndSave({ role: 'assistant', text: `変更できませんでした（${res.error}）。` }, 'notice')
    }
  }

  const cancelPendingOp = () => setPendingOp(null)

  const onHistoryToggle = () => {
    if (onHistory) {
      onHistory()
      return
    }
    setHistoryExpanded((v) => !v)
  }

  const chattedMessages = messages.filter((m) => m.kind !== 'notice')
  const visibleMessages = historyExpanded ? chattedMessages : chattedMessages.slice(-VISIBLE_COUNT)

  return (
    <div data-testid="chat-screen" style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>調整AI</h1>
      <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
        参考書の進捗から配分とペースを提案します。期限は変更されません。
      </p>
      <div data-testid="chat-messages" style={{ marginTop: 12 }}>
        {messages.length > 0 && (
          <button
            data-testid="history-toggle"
            type="button"
            style={{ marginBottom: 8 }}
            onClick={() => onHistoryToggle()}
          >
            {historyExpanded
              ? '履歴を折りたたむ'
              : '履歴'}
          </button>
        )}
        {visibleMessages.map((m) => (
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
            {m.role === 'assistant' && m.withProposal && report && (
              <p data-testid="analysis-summary" style={{ fontWeight: 700, margin: '0 0 4px' }}>
                {report.books.filter((b) => b.status !== 'ok').length === 0
                  ? `全${report.books.length}冊とも順調です。`
                  : `全${report.books.length}冊のうち${report.books.filter((b) => b.status !== 'ok').length}冊が遅れています。`}
              </p>
            )}
            {m.role === 'user' || !m.withProposal ? (
              <LongText text={m.text} />
            ) : (
              report && (
              <div data-testid="proposal-card" style={{ marginTop: 8 }}>
                <p style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700 }}>今日の配分案</p>
                <ul data-testid="proposal-book-list" style={{ margin: '0 0 8px', paddingLeft: 20, lineHeight: 1.8 }}>
                  {report.books.map((b) => (
                    <li key={b.bookId}>
                      {b.title} — 残り{b.daysUntilDeadline}日・残{b.remainingPages}ページ・今日{b.plannedTodayPages}ページ
                      {b.status === 'critical' ? '（危険）' : b.status === 'behind' ? '（遅れ）' : ''}
                    </li>
                  ))}
                </ul>
                {report.proposal.focus.length > 0 && (
                  <p style={{ margin: '0 0 8px' }}>
                    優先する本：{report.proposal.focus.map((id) => report.books.find((b) => b.bookId === id)!.title).join('、')}
                  </p>
                )}
                {report.proposal.relax.length > 0 && (
                  <p style={{ margin: '0 0 8px' }}>
                    控える本：{report.proposal.relax.map((id) => report.books.find((b) => b.bookId === id)!.title).join('、')}
                  </p>
                )}
                <p style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700 }}>ペース案</p>
                <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-dim)' }}>
                  期限に間に合う配分に自動調整します。下のボタンで反映できます。
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button data-testid="apply-today" type="button" style={{ padding: '10px 8px' }} onClick={() => void applyToday()}>
                    今日の配分を反映
                  </button>
                  <button data-testid="apply-pace" type="button" style={{ padding: '10px 8px' }} onClick={() => void applyPace()}>
                    ペース目標を反映
                  </button>
                </div>
              </div>
              )
            )}
          </div>
        ))}
        {pendingOp && (
          <div
            data-testid="op-card"
            style={{
              marginTop: 8,
              padding: 8,
              borderRadius: 8,
              border: '1px solid var(--border)',
            }}
          >
            <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700 }}>変更の提案</p>
            <p data-testid="op-description" style={{ margin: '0 0 4px' }}>
              {pendingOp.description}
            </p>
            <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-dim)' }}>
              この内容で変更しますか？
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button data-testid="op-apply" type="button" style={{ padding: '10px 8px' }} onClick={() => void applyPendingOp()}>
                適用する
              </button>
              <button data-testid="op-cancel" type="button" style={{ padding: '10px 8px' }} onClick={cancelPendingOp}>
                やめる
              </button>
            </div>
          </div>
        )}
        {loading && (
          <p data-testid="chat-loading" style={{ color: 'var(--text-dim)' }}>
            考え中…（高精度モデルは30秒ほどかかる場合があります）
          </p>
        )}
        {lastError && (
          <div style={{ marginTop: 8 }}>
            <p data-testid="chat-error" style={{ color: 'var(--danger)', fontSize: 13 }}>
              {describeAiError(lastError.reason, lastError.status)}
              {lastError.detail ? `［${lastError.detail}］` : ''}
            </p>
            <button data-testid="chat-retry" type="button" onClick={() => void retry()}>
              再試行
            </button>
          </div>
        )}
      </div>
      {configured && (
        <>
          <p data-testid="chat-connection" style={{ color: 'var(--text-dim)', fontSize: 13 }}>
            接続状態: {online ? 'オンライン' : 'オフライン'}（WiFi・モバイル回線どちらでも利用可）
          </p>
          <p data-testid="chat-gb-notice" style={{ color: 'var(--text-dim)', fontSize: 13 }}>
            モバイル回線・無料枠でも利用できます（1回数KB〜数十KB程度の通信・GBを消費します）。無料枠は回数制限があります。高精度モデルは応答に時間がかかります。
          </p>
        </>
      )}
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