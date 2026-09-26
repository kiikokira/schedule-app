import type { AdvisorReport } from './advisor'

export type AiSettings = { endpoint: string; apiKey: string; model: string }

export const DEFAULT_ENDPOINT = 'https://api.openai.com/v1/chat/completions'

const STORAGE_KEY = 'ai-settings'

export function getAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<AiSettings>
      return {
        endpoint: p.endpoint?.trim() || DEFAULT_ENDPOINT,
        apiKey: p.apiKey ?? '',
        model: p.model?.trim() ?? '',
      }
    }
  } catch {
    // localStorage が使えない環境では既定値
  }
  return { endpoint: DEFAULT_ENDPOINT, apiKey: '', model: '' }
}

export function setAiSettings(s: { endpoint: string; apiKey: string; model: string }): void {
  try {
    const apiKey = s.apiKey.trim()
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
  | { ok: false; reason: 'network' | 'http'; status?: number }

export async function chatWithModel(
  settings: AiSettings,
  systemPrompt: string,
  history: { role: 'user' | 'assistant'; content: string }[],
): Promise<ChatResult> {
  let res: Response
  try {
    res = await fetch(settings.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [{ role: 'system', content: systemPrompt }, ...history],
        temperature: 0,
      }),
    })
  } catch {
    return { ok: false, reason: 'network' }
  }
  if (!res.ok) {
    return { ok: false, reason: 'http', status: res.status }
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

export function buildSystemPrompt(report: AdvisorReport): string {
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
    '【現状分析】',
    report.summaryText,
    ...lines,
    `【今日の配分提案】${report.proposal.todayMessage}`,
    `【ペース目標提案】${report.proposal.paceMessage}`,
  ].join('\n')
}
