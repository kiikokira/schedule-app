import { useRef, useState } from 'react'
import { exportBackup, importBackup, validateBackup } from '../db/backup'
import { getBooksApiKey, setBooksApiKey } from '../api/googleBooks'
import {
  getNotifySettings,
  setNotifySettings,
  publishPush,
} from '../lib/notify'
import { getAiSettings, setAiSettings, chatWithModel, pingEndpoint, GEMINI_COMPAT_ENDPOINT, GEMINI_EXAMPLE_MODEL, OPENROUTER_ENDPOINT, OPENROUTER_EXAMPLE_MODEL, DEFAULT_ENDPOINT } from '../lib/ai'

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
  const [aiTestResult, setAiTestResult] = useState<string | null>(null)
  const [aiTesting, setAiTesting] = useState(false)
  const [aiPingResult, setAiPingResult] = useState<string | null>(null)
  const [aiPinging, setAiPinging] = useState(false)
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

  const handleTestAi = async () => {
    const endpoint = aiEndpoint.trim()
    const apiKey = aiApiKey.trim()
    const model = aiModel.trim()
    if (!endpoint || !apiKey || !model) {
      setAiTestResult('エンドポイント・APIキー・モデル名を入力してください')
      return
    }
    setAiTesting(true)
    setAiTestResult(null)
    const res = await chatWithModel(
      { endpoint, apiKey, model },
      '接続テスト用のシステムプロンプトです。',
      [{ role: 'user', content: '接続テスト' }],
      { timeoutMs: 20000 },
    )
    setAiTesting(false)
    if (res.ok) {
      setAiTestResult('接続テスト成功：オンラインAIに接続できました')
    } else if (res.reason === 'timeout') {
      setAiTestResult('接続テスト失敗：タイムアウトしました（高精度モデルは時間がかかります）')
    } else if (res.reason === 'http') {
      setAiTestResult(`接続テスト失敗：HTTP ${res.status ?? '?'}（APIキー・モデル名を確認してください）`)
    } else {
      setAiTestResult('接続テスト失敗：ネットワークに届きませんでした（WiFi・モバイル回線を確認してください）')
    }
  }

  const handlePingAi = async () => {
    const endpoint = aiEndpoint.trim()
    if (!endpoint) {
      setAiPingResult('エンドポイントURLを入力してください')
      return
    }
    setAiPinging(true)
    setAiPingResult(null)
    const res = await pingEndpoint(endpoint)
    setAiPinging(false)
    if (res.reachable) {
      setAiPingResult('到達OK：エンドポイントに届きました。問題はAPIキー・モデル名です')
    } else {
      setAiPingResult('到達NG：この回線では届きません。WiFiオフ（モバイル回線）等で試してください')
    }
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
          空き時間の終了直後に「今日の学習を記録しましたか？」の通知を送ります（15分ごとの確認のため、最大15分ほど遅れることがあります）。
          届くには次の3つが必要です: (1)リポジトリの Secrets に NTFY_TOPIC を設定する、
          (2)ここに入力するトピックと Secrets の値を同じにする、
          (3)スマホに ntfy の受信アプリを入れて同じトピックを購読する。
          その日の時間帯を使うには「今日の計画」を一度開いてください（開いたときに終了予定を登録します）。
          アプリを開いている間は終了時刻ちょうどに通知します。トピックは例:
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
        <label htmlFor="ai-preset">プリセット</label>
        <select
          id="ai-preset"
          data-testid="ai-preset"
          defaultValue={aiEndpoint === GEMINI_COMPAT_ENDPOINT ? 'gemini' : aiEndpoint === OPENROUTER_ENDPOINT ? 'openrouter' : 'openai'}
          onChange={(e) => {
            if (e.target.value === 'gemini') {
              setAiEndpoint(GEMINI_COMPAT_ENDPOINT)
              if (!aiModel.trim()) setAiModel(GEMINI_EXAMPLE_MODEL)
            } else if (e.target.value === 'openrouter') {
              setAiEndpoint(OPENROUTER_ENDPOINT)
              if (!aiModel.trim()) setAiModel(OPENROUTER_EXAMPLE_MODEL)
            } else {
              setAiEndpoint(DEFAULT_ENDPOINT)
            }
          }}
        >
          <option value="openai">OpenAI本家</option>
          <option value="gemini">Gemini無料枠（OpenAI互換）</option>
          <option value="openrouter">OpenRouter無料モデル（登録のみ）</option>
        </select>
        <p data-testid="ai-description" style={{ fontSize: 13, color: 'var(--text-dim)' }}>
          オンラインでの自由文相談に使う高精度AI接続（OpenAI互換API）。WiFi・モバイル回線どちらでも利用可（GBを消費します。1回数KB〜数十KB程度）。未設定でもオフラインの内蔵AI（定型文＋自動提案）は動きます。期限は変更されません。APIキーはこの端末内だけに保存されます。高精度モデルは応答が遅く料金・GBが増えます（軽量例: gpt-4o-mini／高精度例: gpt-4o）。無料枠はGoogle AI Studioで無料キーを作成し、モデル名は一覧で確認してください。無料枠は回数制限があります。プロジェクト作成でつまずく場合はOpenRouterの無料登録（キー発行のみ・`:free`モデル）が簡単です。
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
          placeholder="sk-... / AIza...（無料枠はAIzaから始まるキー）"
          autoComplete="off"
        />
        <label htmlFor="ai-model">モデル名</label>
        <input
          id="ai-model"
          data-testid="ai-model"
          type="text"
          value={aiModel}
          onChange={(e) => setAiModel(e.target.value)}
          placeholder="例: gpt-4o-mini（軽量）/ gpt-4o（高精度）"
          autoComplete="off"
        />
        <button data-testid="ai-save" type="button" onClick={handleSaveAi}>
          設定を保存
        </button>
        <button data-testid="ai-test" type="button" onClick={() => void handleTestAi()} disabled={aiTesting}>
          接続テスト
        </button>
        <button data-testid="ai-ping" type="button" onClick={() => void handlePingAi()} disabled={aiPinging}>
          到達確認
        </button>
        {aiTestResult && (
          <p data-testid="ai-test-result" style={{ color: 'var(--accent-strong)' }}>
            {aiTestResult}
          </p>
        )}
        {aiPingResult && (
          <p data-testid="ai-ping-result" style={{ color: 'var(--accent-strong)' }}>
            {aiPingResult}
          </p>
        )}
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