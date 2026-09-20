import { useRef, useState } from 'react'
import { exportBackup, importBackup, validateBackup } from '../db/backup'

type Props = {
  onDone: () => void
}

export default function SettingsScreen({ onDone }: Props) {
  const [result, setResult] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleExport = async () => {
    const data = await exportBackup()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `schedule-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setResult('書き出しました')
  }

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return
    setResult(null)
    try {
      const text = await file.text()
      const parsed: unknown = JSON.parse(text)
      if (!validateBackup(parsed)) {
        setResult('読み込み失敗: 不正なバックアップデータです')
        return
      }
      const { books, records } = await importBackup(parsed)
      setResult(`読み込みました（参考書 ${books} 冊 / 進捗 ${records} 件）`)
    } catch {
      setResult('読み込み失敗: ファイルを開けませんでした')
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDeleteAll = async () => {
    if (!window.confirm('すべてのデータを削除しますか？この操作は戻せません。')) return
    const { db } = await import('../db/database')
    await db.transaction('rw', db.books, db.records, async () => {
      await db.books.clear()
      await db.records.clear()
    })
    setResult('すべてのデータを削除しました')
  }

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>設定</h1>
      <button data-testid="backup-export" type="button" onClick={() => void handleExport()}>
        バックアップを書き出す
      </button>
      <div>
        <label htmlFor="backup-import">バックアップから読み込み</label>
        <input
          id="backup-import"
          data-testid="backup-import"
          type="file"
          accept="application/json,.json"
          ref={fileInputRef}
          onChange={(e) => void handleImportFile(e.target.files?.[0])}
        />
      </div>
      <button
        data-testid="delete-all"
        type="button"
        onClick={() => void handleDeleteAll()}
        style={{ color: '#b91c1c' }}
      >
        すべてのデータを削除
      </button>
      <p>
        <button onClick={onDone}>戻る</button>
      </p>
      {result && (
        <p data-testid="backup-result" style={{ color: '#2563eb' }}>
          {result}
        </p>
      )}
    </div>
  )
}