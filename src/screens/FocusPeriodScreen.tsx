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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const resetForm = () => {
    setTitle('')
    setStartDate(todayStr())
    setEndDate('')
    setSelected(new Set())
    setEditingId(null)
  }

  const toggleBook = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const validate = (): string | null => {
    if (!title.trim()) return '名前を入力してください'
    if (!startDate || !endDate) return '開始日と終了日を入力してください'
    if (endDate < startDate) return '終了日は開始日以降を指定してください'
    if (selected.size === 0) return '学習する参考書を1冊以上選んでください'
    return null
  }

  const handleAdd = () => {
    const message = validate()
    if (message) {
      setError(message)
      return
    }
    setError(null)
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
    resetForm()
  }

  const handleEditStart = (p: FocusPeriod) => {
    setError(null)
    setEditingId(p.id)
    setTitle(p.title)
    setStartDate(p.startDate)
    setEndDate(p.endDate)
    setSelected(new Set(p.bookIds))
  }

  const handleSave = () => {
    const message = validate()
    if (message) {
      setError(message)
      return
    }
    setError(null)
    const next = periods.map((p) =>
      p.id === editingId
        ? { ...p, title: title.trim(), startDate, endDate, bookIds: [...selected] }
        : p,
    )
    saveFocusPeriods(next)
    setPeriods(next)
    resetForm()
  }

  const handleCancel = () => {
    setError(null)
    resetForm()
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
                data-testid={`focus-edit-${p.id}`}
                type="button"
                onClick={() => handleEditStart(p)}
              >
                編集
              </button>
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
        {editingId === null ? (
          <button data-testid="focus-add" type="button" onClick={handleAdd}>
            追加
          </button>
        ) : (
          <>
            <button data-testid="focus-save" type="button" onClick={handleSave}>
              保存
            </button>
            <button data-testid="focus-cancel" type="button" onClick={handleCancel}>
              キャンセル
            </button>
          </>
        )}
      </section>
      <p>
        <button data-testid="focus-back" type="button" onClick={onBack}>
          戻る
        </button>
      </p>
    </div>
  )
}
