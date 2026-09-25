import type { SlotsPayload } from './slotNotify'

export type NotifySettings = {
  enabled: boolean
  topic: string
}

export type DiagnosisState = {
  behind: boolean
  requiredPerDay: number
}

export type PublishResult =
  | { ok: true }
  | { ok: false; reason: 'network' | 'http'; status: number | null }

const STORAGE_KEY = 'schedule-app-ntfy'
const NTFY_BASE = 'https://ntfy.sh'
const REQUEST_TIMEOUT_MS = 10_000

export function getNotifySettings(): NotifySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { enabled: false, topic: '' }
    const parsed = JSON.parse(raw) as Partial<NotifySettings>
    return {
      enabled: parsed.enabled === true,
      topic: typeof parsed.topic === 'string' ? parsed.topic : '',
    }
  } catch {
    return { enabled: false, topic: '' }
  }
}

export function setNotifySettings(settings: NotifySettings): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ enabled: settings.enabled, topic: normalizeTopic(settings.topic) }),
    )
  } catch {
    // localStorage が利用できない環境では保存しない
  }
}

export function normalizeTopic(topic: string): string {
  return topic
    .trim()
    .replace(/^https?:\/\/ntfy\.sh\//i, '')
    .replace(/^ntfy\.sh\//i, '')
    .replace(/\/+$/, '')
}

const encodeTopic = (topic: string) => encodeURIComponent(normalizeTopic(topic))

export function stateTopicOf(topic: string): string {
  return `${encodeTopic(topic)}-state`
}

export function slotsTopicOf(topic: string): string {
  return `${encodeTopic(topic)}-slots`
}

const withTimeout = (controller: AbortController) =>
  setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

// カスタムヘッダーを送らない「シンプルリクエスト(Content-Type: text/plain)」にする。
// CORSプリフライトが不要になり、iOS Safari等でも送信がブロックされにくい。
// タイトルはURLのクエリ(?title=)でntfyへ渡す。
export async function publishPush(
  topic: string,
  message: string,
  options: { title?: string } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<PublishResult> {
  const title = options.title ?? '参考書スケジュール管理'
  const url = `${NTFY_BASE}/${encodeTopic(topic)}${title ? `?title=${encodeURIComponent(title)}` : ''}`
  const controller = new AbortController()
  const timer = withTimeout(controller)
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: message,
      cache: 'no-store',
      signal: controller.signal,
    })
    if (res.ok) return { ok: true }
    return { ok: false, reason: 'http', status: res.status }
  } catch (err) {
    console.info('[notify] publish failed:', err)
    return { ok: false, reason: 'network', status: null }
  } finally {
    clearTimeout(timer)
  }
}

// 状態配信もシンプルリクエストのみにする。ボディ(JSON文字列)はntfyがそのまま保持し、
// サーバー側の jq が読み取れる。TTLはカスタムヘッダーを避けるため既定値(12時間)に任せる。
export async function publishState(
  topic: string,
  state: DiagnosisState,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const controller = new AbortController()
  const timer = withTimeout(controller)
  try {
    const res = await fetchImpl(`${NTFY_BASE}/${stateTopicOf(topic)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({ ...state, savedAt: new Date().toISOString() }),
      cache: 'no-store',
      signal: controller.signal,
    })
    return res.ok
  } catch (err) {
    console.info('[notify] state publish failed:', err)
    return false
  } finally {
    clearTimeout(timer)
  }
}

// その日の空き時間帯の終了予定を -slots トピックへ送る。
// ワークフローが15分ごとに読み、終わった直後の時間帯だけ通知する。
export async function publishSlots(
  topic: string,
  payload: SlotsPayload,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const controller = new AbortController()
  const timer = withTimeout(controller)
  try {
    const res = await fetchImpl(`${NTFY_BASE}/${slotsTopicOf(topic)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: controller.signal,
    })
    return res.ok
  } catch (err) {
    console.info('[notify] slots publish failed:', err)
    return false
  } finally {
    clearTimeout(timer)
  }
}