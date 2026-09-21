export type NotifySettings = {
  enabled: boolean
  topic: string
}

export type DiagnosisState = {
  behind: boolean
  requiredPerDay: number
}

const STORAGE_KEY = 'schedule-app-ntfy'
const NTFY_BASE = 'https://ntfy.sh'

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
      JSON.stringify({ enabled: settings.enabled, topic: settings.topic.trim() }),
    )
  } catch {
    // localStorage が利用できない環境では保存しない
  }
}

const encodeTopic = (topic: string) => encodeURIComponent(topic.trim())

export function stateTopicOf(topic: string): string {
  return `${encodeTopic(topic)}-state`
}

export async function publishPush(
  topic: string,
  message: string,
  options: { title?: string } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const res = await fetchImpl(`${NTFY_BASE}/${encodeTopic(topic)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        Title: options.title ?? '参考書スケジュール管理',
      },
      body: message,
    })
    return res.ok
  } catch {
    return false
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