import { useRef, useState } from 'react'
import { exportBackup, importBackup, validateBackup } from '../db/backup'
import { getBooksApiKey, setBooksApiKey } from '../api/googleBooks'
import {
  getNotifySettings,
  setNotifySettings,
  publishPush,
} from '../lib/notify'
import { getAiSettings, setAiSettings } from '../lib/ai'

type Props = {
  onDone: () => void
}

export default function SettingsScreen({ onDone }: Props) {
  const [result, setResult] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState(getBooksApiKey())
  const [ntfyTopic, setNtfyTopic] = useState(getNotifySettings().topic)
  const [ntfyEnabled, setNtfyEnabled] = useState(getNotifySettings().enabled)
  const [ntfyTestResult, setNtfyTestResult] = useState<string | null>(null)
  const [aiEndpoint, setAiEndpoint] = useState(getAiSettings().endpoint)
  const [aiApiKey, setAiApiKey] = useState(getAiSettings().apiKey)
  const [aiModel, setAiModel] = useState(getAiSettings().model)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleExport = async () => {
    const data = await exportBackup()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `schedule-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
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

  const handleSaveApiKey = () => {
    setBooksApiKey(apiKey)
    setResult('Google Books APIキーを保存しました')
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

  const handleSaveNtfy = () => {
    setNotifySettings({ enabled: ntfyEnabled, topic: ntfyTopic })
    setNtfyTestResult(null)
    setResult('リマインダー通知の設定を保存しました')
  }

  const handleTestNtfy = async () => {
    const topic = ntfyTopic.trim()
    if (!topic) {
      setNtfyTestResult('トピックを入力してください')
      return
    }
    const result = await publishPush(topic, 'テスト通知です（参考書スケジュール管理）')
    setNtfyTestResult(
      result.ok
        ? 'テスト通知を送信しました'
        : result.reason === 'network'
          ? '送信に失敗しました（ネットワークでntfy.shに届きませんでした。インターネット接続を確認してください）'
          : `送信に失敗しました（ntfy.sh が HTTP ${result.status ?? '?'} を返しました。トピック名を確認してください）`,
    )
  }

  const handleSaveAi = () => {
    setAiSettings({ endpoint: aiEndpoint, apiKey: aiApiKey, model: aiModel })
    setResult('調整AIの設定を保存しました')
  }

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>設定</h1>
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16 }}>Google Books 検索</h2>
        <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
          Google Booksで参考書を検索するためのAPIキー。発行方法は docs/usage.md を参照してください。
        </p>
        <label htmlFor="google-books-api-key">APIキー（任意）</label>
        <input
          id="google-books-api-key"
          data-testid="google-books-api-key"
          type="text"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="AIza...（未設定なら空のまま）"
          autoComplete="off"
        />
        <button data-testid="save-google-books-api-key" type="button" onClick={handleSaveApiKey}>
          APIキーを保存
        </button>
      </section>
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16 }}>リマインダー通知（Push）</h2>
        <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
          毎日20:00に「今日の学習を記録しましたか？」の通知を送ります。進捗が遅れている場合は、
          その内容に変わります。アプリを閉じていても届くには ntfy
          の受信アプリをインストールし、同じトピックを購読してください。トピックは例:
          my-schedule3 のような文字列です(アドレス欄をコピーした場合もそのまま入力できます)。テスト通知は
          ntfy.sh へ直接送信するため、ネットワークから ntfy.sh
          に繋がらない環境では失敗します。
        </p>
        <label htmlFor="ntfy-topic">トピック名</label>
        <input
          id="ntfy-topic"
          data-testid="ntfy-topic"
          type="text"
          value={ntfyTopic}
          onChange={(e) => setNtfyTopic(e.target.value)}
          placeholder="例: my-study-reminder"
          autoComplete="off"
        />
        <div>
          <label htmlFor="ntfy-enabled">通知を有効にする</label>
          <input
            id="ntfy-enabled"
            data-testid="ntfy-enabled"
            type="checkbox"
            checked={ntfyEnabled}
            onChange={(e) => setNtfyEnabled(e.target.checked)}
          />
        </div>
        <button data-testid="ntfy-save" type="button" onClick={handleSaveNtfy}>
          設定を保存
        </button>
        <button data-testid="ntfy-test" type="button" onClick={() => void handleTestNtfy()}>
          テスト通知を送る
        </button>
        {ntfyTestResult && (
          <p data-testid="ntfy-result" style={{ color: 'var(--accent-strong)' }}>
            {ntfyTestResult}
          </p>
        )}
      </section>
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16 }}>調整AI（オンライン）</h2>
        <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
          オンラインでの自由文相談に使う高精度AI接続（OpenAI互換API）。未設定でもオフラインの内蔵AI（定型文＋自動提案）は動きます。期限は変更されません。APIキーはこの端末内だけに保存されます。
        </p>
        <label htmlFor="ai-endpoint">エンドポイントURL</label>
        <input
          id="ai-endpoint"
          data-testid="ai-endpoint"
          type="text"
          value={aiEndpoint}
          onChange={(e) => setAiEndpoint(e.target.value)}
          autoComplete="off"
        />
        <label htmlFor="ai-api-key">APIキー</label>
        <input
          id="ai-api-key"
          data-testid="ai-api-key"
          type="password"
          value={aiApiKey}
          onChange={(e) => setAiApiKey(e.target.value)}
          placeholder="sk-..."
          autoComplete="off"
        />
        <label htmlFor="ai-model">モデル名</label>
        <input
          id="ai-model"
          data-testid="ai-model"
          type="text"
          value={aiModel}
          onChange={(e) => setAiModel(e.target.value)}
          placeholder="例: gpt-5-mini"
          autoComplete="off"
        />
        <button data-testid="ai-save" type="button" onClick={handleSaveAi}>
          設定を保存
        </button>
      </section>
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
        style={{ color: 'var(--danger)' }}
      >
        すべてのデータを削除
      </button>
      <p>
        <button onClick={onDone}>戻る</button>
      </p>
      {result && (
        <p data-testid="backup-result" style={{ color: 'var(--accent-strong)' }}>
          {result}
        </p>
      )}
    </div>
  )
}