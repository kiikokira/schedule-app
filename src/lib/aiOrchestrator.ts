// src/lib/aiOrchestrator.ts
import type { AdvisorReportV2 } from './advisorV2'
import type { ChatResult } from './ai'

export const FREE_FALLBACK_ORDER = ['groq-free', 'gemini-free', 'openrouter-free']

export function buildSystemPromptV2(report: AdvisorReportV2): string {
  const vel = Object.entries(report.velocities).map(([id, v]) => {
    const b = report.books.find((x) => x.bookId === id)
    return `${b?.title ?? id}: 実績${v.medianPagesPerDay}p/日・達成${v.probability}・${v.stalled ? '停滞中' : '継続中'}`
  })
  return [
    'あなたは学習スケジュールの調整アシスタントです。',
    '【ルール】期限・開始日は絶対に変更しません。曖昧な指示には1回だけ確認質問をします。',
    '自由文の困りごとを最優先で解決し、根拠（実績ペース・達成確率）を添えて簡潔に答えてください。',
    '【操作案内】時間帯や参考書の変更指示には、アドバイスに加えて操作案JSONを ```json フェンスで1件だけ添えてください。',
    '使える操作: pin_book / unpin_book / add_availability / remove_availability / set_priority / set_ratio / focus_book / relax_book / shift_today / rebalance_week。',
    '期限・開始日の変更要求には応じず断ってください。',
    '【現状分析】',
    report.summaryText,
    ...vel,
    `【今日の配分提案】${report.proposal.todayMessage}`,
    `【ペース目標提案】${report.proposal.paceMessage}`,
  ].join('\n')
}

export async function runFreeChat(
  profile: { id: string },
  system: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  fetchers: Record<string, (sys: string, hist: typeof history) => Promise<ChatResult>>,
): Promise<{ profileId: string; result: ChatResult }> {
  const order = [profile.id, ...FREE_FALLBACK_ORDER.filter((id) => id !== profile.id)]
  let last: ChatResult = { ok: false, reason: 'http', status: 429 }
  for (const id of order) {
    const fn = fetchers[id]
    if (!fn) continue
    const r = await fn(system, history)
    if (r.ok) return { profileId: id, result: r }
    if (!(r.ok === false && (r.reason === 'http' && (r as { status?: number }).status === 429 || r.reason === 'timeout'))) {
      return { profileId: id, result: r }
    }
    last = r
  }
  return { profileId: profile.id, result: last }
}
