import { useState } from 'react'
import CoverImage from '../components/CoverImage'
import { useBooks } from '../hooks/useBooks'
import { db } from '../db/database'
import { CATALOG } from '../data/catalog'
import { SCHEDULE_PHASES, buildApplyResult } from '../data/schedule'

type Props = {
  onDone: () => void
}

export default function PlanScreen({ onDone }: Props) {
  const { saveBook } = useBooks()
  const [result, setResult] = useState<string | null>(null)

  const apply = async () => {
    const registered = await db.books.orderBy('deadline').toArray()
    const { newBooks, updatedBooks } = buildApplyResult(registered)
    for (const book of newBooks) {
      await saveBook(book, true)
    }
    for (const book of updatedBooks) {
      await saveBook(book, false)
    }
    setResult(
      `登録しました。新規 ${newBooks.length} 冊 / 期限を更新 ${updatedBooks.length} 冊`,
    )
  }

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>学習スケジュールを登録</h1>
      <p style={{ color: 'var(--text-dim)' }}>
        高2春休み前〜高3夏休み中の参考書を、期限つきでまとめて登録できます。
      </p>
      {SCHEDULE_PHASES.map((phase) => (
        <section key={phase.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <h2 style={{ fontSize: 16 }}>
            {phase.label} <span style={{ color: 'var(--text-dim)', fontWeight: 'normal' }}>（期限: {phase.deadline}）</span>
          </h2>
          {phase.bookIds.map((id) => {
            const book = CATALOG.find((c) => c.id === id)
            if (!book) return null
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <CoverImage src={book.coverSrc ?? null} width={40} height={56} />
                <div style={{ flex: 1 }}>
                  <div>{book.title}</div>
                  <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                    {book.subject} / {book.totalPages}ページ
                  </div>
                </div>
              </div>
            )
          })}
        </section>
      ))}
      <button data-testid="apply-schedule" type="button" onClick={() => void apply()}>
        このスケジュールで登録する
      </button>
      {result && (
        <p data-testid="apply-result" style={{ color: 'var(--accent-strong)' }}>
          {result}
        </p>
      )}
      <p>
        <button onClick={onDone}>戻る</button>
      </p>
    </div>
  )
}