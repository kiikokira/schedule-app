import type { AdvisorReport } from './advisor'

export type AiSettings = { endpoint: string; apiKey: string; model: string }

export const DEFAULT_ENDPOINT = 'https://api.openai.com/v1/chat/completions'

export const GEMINI_COMPAT_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
export const GEMINI_EXAMPLE_MODEL = 'gemini-2.0-flash'
export const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
export const OPENROUTER_EXAMPLE_MODEL = 'qwen/qwen3.8-27b:free'
export const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
export const GROQ_EXAMPLE_MODEL = 'llama-3.1-8b-instant'

const STORAGE_KEY = 'ai-settings'

export function isSafeAiEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint)
    if (u.protocol === 'https:' && u.hostname !== '') return true
    if (u.protocol === 'http:') {
      const host = u.hostname
      if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1') {
        return true
      }
    }
    return false
  } catch {
    return false
  }
}

export function isKnownAiEndpoint(endpoint: string): boolean {
  return (
    endpoint === DEFAULT_ENDPOINT ||
    endpoint === GEMINI_COMPAT_ENDPOINT ||
    endpoint === OPENROUTER_ENDPOINT ||
    endpoint === GROQ_ENDPOINT
  )
}

/**
 * APIキーの無害化。コピペ混入の空白・改行・不可視文字・非ASCIIを除去し、
 * HTTPヘッダに載せられる印字可能ASCIIのみにする。正規キー（英数・記号）は不変。
 */
export function sanitizeAiKey(raw: string): string {
  return raw
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[^\x21-\x7E]/g, '')
}

export function getAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<AiSettings>
      return {
        endpoint:
          typeof p.endpoint === 'string' && p.endpoint.trim() !== ''
            ? p.endpoint.trim()
            : DEFAULT_ENDPOINT,
        apiKey: typeof p.apiKey === 'string' ? p.apiKey : '',
        model: typeof p.model === 'string' ? p.model.trim() : '',
      }
    }
  } catch {
    // localStorage が使えない環境では既定値
  }
  return { endpoint: DEFAULT_ENDPOINT, apiKey: '', model: '' }
}

export function setAiSettings(s: { endpoint: string; apiKey: string; model: string }): void {
  try {
    const apiKey = sanitizeAiKey(s.apiKey)
    if (!apiKey) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ endpoint: s.endpoint.trim(), apiKey, model: s.model.trim() }),
    )
  } catch {
    // localStorage が使えない環境では保存しない
  }
}

export function isAiConfigured(s: AiSettings): boolean {
  return s.apiKey.trim() !== '' && s.model.trim() !== '' && s.endpoint.trim() !== ''
}

export type ChatResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'network' | 'http' | 'timeout'; status?: number; detail?: string }

function toDetail(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`.slice(0, 200)
  return String(e).slice(0, 200)
}

export async function chatWithModel(
  settings: AiSettings,
  systemPrompt: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  opts?: { timeoutMs?: number },
): Promise<ChatResult> {
  const timeoutMs = opts?.timeoutMs ?? 60000
  if (!isSafeAiEndpoint(settings.endpoint)) {
    return { ok: false, reason: 'network', detail: 'unsafe endpoint' }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const apiKey = sanitizeAiKey(settings.apiKey)
  let res: Response
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }
  let isOpenRouter = false
  try {
    isOpenRouter = new URL(settings.endpoint).hostname === 'openrouter.ai'
  } catch {
    isOpenRouter = false
  }
  if (isOpenRouter) {
    headers['HTTP-Referer'] = 'https://kiikokira.github.io/schedule-app/'
    headers['X-OpenRouter-Title'] = '参考書スケジュール管理'
  }
  try {
    res = await fetch(settings.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: settings.model,
        messages: [{ role: 'system', content: systemPrompt }, ...history],
        temperature: 0,
        max_tokens: 512,
      }),
      signal: controller.signal,
    })
  } catch (e) {
    clearTimeout(timer)
    if (e instanceof Error && e.name === 'AbortError') {
      return { ok: false, reason: 'timeout', detail: toDetail(e) }
    }
    return { ok: false, reason: 'network', detail: toDetail(e) }
  }
  clearTimeout(timer)
  if (!res.ok) {
    let detail: string | undefined
    try {
      const text = await res.text()
      if (text) detail = text.slice(0, 200)
    } catch {
      detail = undefined
    }
    return { ok: false, reason: 'http', status: res.status, detail }
  }
  try {
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const text = data.choices?.[0]?.message?.content
    if (typeof text !== 'string' || text.length === 0) {
      return { ok: false, reason: 'http', status: res.status }
    }
    return { ok: true, text }
  } catch {
    return { ok: false, reason: 'http', status: res.status }
  }
}

export type PingResult = { ok: true; reachable: boolean }

/**
 * 鍵不要の到達性診断。設定エンドポイントのベースにある /models へGETし、
 * 何らかのHTTP応答が返れば到達可（401等も到達扱い）。throw・タイムアウトは未到達。
 */
export async function pingEndpoint(
  endpoint: string,
  opts?: { timeoutMs?: number },
): Promise<PingResult> {
  if (!isSafeAiEndpoint(endpoint)) {
    return { ok: true, reachable: false }
  }
  const timeoutMs = opts?.timeoutMs ?? 15000
  const base = endpoint.replace(/\/chat\/completions\/?$/, '')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    await fetch(`${base}/models`, { method: 'GET', signal: controller.signal })
    clearTimeout(timer)
    return { ok: true, reachable: true }
  } catch {
    clearTimeout(timer)
    return { ok: true, reachable: false }
  }
}

export function buildSystemPrompt(
  report: AdvisorReport,
  opCtx?: { slots: { id: string; weekday: number | null; date: string | null; start: string; end: string }[]; books: { id: string; title: string }[] },
): string {
  const lines = report.books.map((a) => {
    const judge =
      a.status === 'ok' ? '順調' : a.status === 'behind' ? '遅れ' : '危険（このままだと期限に届かない）'
    return `${a.title}: 残り${a.remainingPages}ページ・期限まで${a.daysUntilDeadline}日・1日${a.needPerDay}ページ必要・遅れ${a.behindPages}ページ・判定 ${judge}`
  })
  return [
    'あなたは学習スケジュールの調整アシスタントです。',
    '【ルール】期限内は絶対に変更してはいけません（期限・開始日は変更しません）。回答は最短・簡潔に。',
    '具体的な配分やページ数の数値提案はせず、アドバイスだけを答えてください（数値はアプリが自動決定します）。',
    '反復モードの本は集計対象外です。',
    ...(opCtx
      ? [
          '【操作案内】時間帯や参考書の変更指示には、アドバイスに加えて操作案JSONを ```json フェンスで1件だけ添えてください。',
          '使える操作: pin_book（時間帯の学習内容を指定の本に変更）/ unpin_book（固定解除）/ add_availability（時間帯追加）/ remove_availability（時間帯削除）。',
          '形式: {"op":"pin_book","slotId":"時間帯ID","bookId":"参考書ID"} / {"op":"unpin_book","slotId":"時間帯ID"} / {"op":"add_availability","weekday":1-6またはnull,"date":"YYYY-MM-DDまたはnull","start":"HH:MM","end":"HH:MM","bookId":"任意"} / {"op":"remove_availability","slotId":"時間帯ID"}。',
          '該当しない指示には操作案を付けず、その旨を一言添えてください。期限・開始日の変更要求には応じず断ってください。',
          `【時間帯一覧】${opCtx.slots.map((s) => `${s.id}: ${s.date ?? ['日曜', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜'][s.weekday ?? 0] ?? '毎日'} ${s.start}-${s.end}`).join(' / ') || 'なし'}`,
          `【参考書一覧】${opCtx.books.map((b) => `${b.id}: ${b.title}`).join(' / ') || 'なし'}`,
        ]
      : []),
    '【現状分析】',
    report.summaryText,
    ...lines,
    `【今日の配分提案】${report.proposal.todayMessage}`,
    `【ペース目標提案】${report.proposal.paceMessage}`,
  ].join('\n')
}
