import { useState } from 'react'
import { useBooks } from '../hooks/useBooks'
import {
  loadFocusPeriods,
  saveFocusPeriods,
  type FocusPeriod,
} from '../data/focusPeriods'
import { todayStr } from '../lib/progress'

type Props = {
  onBack: () => void
}

export default function FocusPeriodScreen({ onBack }: Props) {
  const { books } = useBooks()
  const [periods, setPeriods] = useState<FocusPeriod[]>(() => loadFocusPeriods())
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState(() => todayStr())
  const [endDate, setEndDate] = useState('')
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [error, setError] = useState<string | null>(null)

  const toggleBook = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const handleAdd = () => {
    setError(null)
    if (!title.trim()) {
      setError('名前を入力してください')
      return
    }
    if (!startDate || !endDate) {
      setError('開始日と終了日を入力してください')
      return
    }
    if (endDate < startDate) {
      setError('終了日は開始日以降を指定してください')
      return
    }
    if (selected.size === 0) {
      setError('学習する参考書を1冊以上選んでください')
      return
    }
    const next: FocusPeriod[] = [
      ...periods,
      {
        id: crypto.randomUUID(),
        title: title.trim(),
        startDate,
        endDate,
        bookIds: [...selected],
      },
    ]
    saveFocusPeriods(next)
    setPeriods(next)
    setTitle('')
    setSelected(new Set())
  }

  const handleDelete = (id: string, label: string) => {
    if (!window.confirm(`「${label}」を削除しますか？`)) return
    const next = periods.filter((p) => p.id !== id)
    saveFocusPeriods(next)
    setPeriods(next)
  }

  return (
    <div data-testid="focus-screen" style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>テスト期間</h1>
      <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
        期間中は今日の計画に選んだ参考書だけが表示されます。期間外の期限は変わりません。
      </p>
      {periods.length === 0 ? (
        <p data-testid="focus-empty" style={{ color: 'var(--text-dim)', fontSize: 13 }}>
          テスト期間はまだありません。
        </p>
      ) : (
        <div style={{ marginBottom: 16 }}>
          {periods.map((p) => (
            <div
              key={p.id}
              data-testid={`focus-row-${p.id}`}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8 }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{p.title}</div>
                <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                  {p.startDate}〜{p.endDate}・{p.bookIds.length}冊
                </div>
              </div>
              <button
                data-testid={`focus-delete-${p.id}`}
                type="button"
                onClick={() => handleDelete(p.id, p.title)}
                style={{ color: 'var(--danger)' }}
              >
                削除
              </button>
            </div>
          ))}
        </div>
      )}
      <section style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
        <h2 style={{ fontSize: 16 }}>期間を追加</h2>
        <div>
          <label htmlFor="focus-title">名前</label>
          <input
            id="focus-title"
            data-testid="focus-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: 中間テスト"
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <label>
            開始
            <input
              data-testid="focus-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label>
            終了
            <input
              data-testid="focus-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        </div>
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: 13 }}>学習する参考書</p>
          {books.map((b) => (
            <label key={b.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
              <input
                data-testid={`focus-book-${b.id}`}
                type="checkbox"
                checked={selected.has(b.id)}
                onChange={() => toggleBook(b.id)}
              />
              {b.title}
            </label>
          ))}
        </div>
        {error && (
          <p data-testid="focus-error" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}
        <button data-testid="focus-add" type="button" onClick={handleAdd}>
          追加
        </button>
      </section>
      <p>
        <button data-testid="focus-back" type="button" onClick={onBack}>
          戻る
        </button>
      </p>
    </div>
  )
}
