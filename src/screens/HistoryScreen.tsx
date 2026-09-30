import { useEffect, useState } from 'react'
import { listChatHistory, type ChatHistoryEntry } from '../data/chatHistoryStore'
import { formatDate, formatJaDate } from '../lib/progress'
import LongText from '../components/LongText'

type Props = {
  onBack: () => void
}

export default function HistoryScreen({ onBack }: Props) {
  const [entries, setEntries] = useState<ChatHistoryEntry[] | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const all = await listChatHistory()
      if (!cancelled) setEntries(all)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div data-testid="history-screen" style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>履歴一覧</h1>
      {entries === null ? (
        <p>読み込み中…</p>
      ) : entries.filter((e) => e.kind !== 'notice').length === 0 ? (
        <p data-testid="history-empty" style={{ color: 'var(--text-dim)', fontSize: 13 }}>
          履歴はまだありません。
        </p>
      ) : (
        <div data-testid="history-list" style={{ marginTop: 12 }}>
          {(() => {
            const groups = new Map<string, ChatHistoryEntry[]>()
            for (const e of entries.filter((e) => e.kind !== 'notice')) {
              const day = formatDate(new Date(e.at.split('#')[0]))
              const list = groups.get(day) ?? []
              list.push(e)
              groups.set(day, list)
            }
            return [...groups].map(([day, list]) => (
              <div key={day}>
                <h2 data-testid={`history-date-${day}`} style={{ fontSize: 15, margin: '12px 0 4px' }}>
                  {formatJaDate(day)}
                </h2>
                {list.map((e) => (
                  <div
                    key={e.id}
                    data-testid={e.role === 'user' ? 'history-user-msg' : 'history-assistant-msg'}
                    style={{
                      whiteSpace: 'pre-wrap',
                      marginBottom: 8,
                      padding: 8,
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: e.role === 'user' ? 'var(--surface-dim)' : undefined,
                    }}
                  >
                    <LongText text={e.text} />
                  </div>
                ))}
              </div>
            ))
          })()}
        </div>
      )}
      <p>
        <button data-testid="history-back" type="button" onClick={onBack}>
          折りたたむ
        </button>
      </p>
    </div>
  )
}
