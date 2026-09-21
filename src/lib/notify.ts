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

export async function publishPush(
  topic: string,
  message: string,
  options: { title?: string } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<PublishResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetchImpl(`${NTFY_BASE}/${encodeTopic(topic)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        Title: options.title ?? '参考書スケジュール管理',
      },
      body: message,
      cache: 'no-store',
      signal: controller.signal,
    })
    if (res.ok) return { ok: true }
    return { ok: false, reason: 'http', status: res.status }
  } catch {
    return { ok: false, reason: 'network', status: null }
  } finally {
    clearTimeout(timer)
  }
}

export async function publishState(
  topic: string,
  state: DiagnosisState,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const res = await fetchImpl(`${NTFY_BASE}/${stateTopicOf(topic)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TTL': '172800',
      },
      body: JSON.stringify({ ...state, savedAt: new Date().toISOString() }),
    })
    return res.ok
  } catch {
    return false
  }
}