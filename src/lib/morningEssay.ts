import { parseDate, formatDate } from './progress'

export const MORNING_SLOT_START = '06:30'
export const MORNING_SLOT_END = '07:00'

export const WEEKLY_ESSAY_GOAL = 3

export const CORRECTION_PASTE_MIN_LENGTH = 20

export const DEFAULT_ESSAY_PROMPT =
  '前の内容と違う高2年11月ベネッセ模試に出そうな英文に直せる日本語の読むものを400字程度で書いて用意して。解答は書かないで'

export type MorningChoice = 'essay' | 'book'

export type MorningEssayRecord = {
  date: string
  choice: MorningChoice
  correctionDone: boolean
  correctionText?: string
  prompt?: string
}

export function buildChatGptUrl(prompt: string): string {
  return `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`
}

export function isCorrectionPasteValid(text: string): boolean {
  return text.trim().length >= CORRECTION_PASTE_MIN_LENGTH
}

export function startOfWeekMonday(dateStr: string): string {
  const d = parseDate(dateStr)
  const day = d.getDay()
  const diffToMonday = (day + 6) % 7
  d.setDate(d.getDate() - diffToMonday)
  return formatDate(d)
}

function weekDates(dateStr: string): Set<string> {
  const monday = parseDate(startOfWeekMonday(dateStr))
  const set = new Set<string>()
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    set.add(formatDate(d))
  }
  return set
}

export function weeklyRecords(records: MorningEssayRecord[], today: string): MorningEssayRecord[] {
  const week = weekDates(today)
  return records.filter((r) => week.has(r.date))
}

export function countWeeklyCorrections(records: MorningEssayRecord[], today: string): number {
  return weeklyRecords(records, today).filter((r) => r.correctionDone).length
}

export function isWeeklyGoalAchieved(records: MorningEssayRecord[], today: string): boolean {
  return countWeeklyCorrections(records, today) >= WEEKLY_ESSAY_GOAL
}

export function calcCorrectionRate(
  records: MorningEssayRecord[],
  today: string,
): { chosen: number; done: number; rate: number } {
  const week = weeklyRecords(records, today).filter((r) => r.choice === 'essay')
  const chosen = week.length
  const done = week.filter((r) => r.correctionDone).length
  const rate = chosen === 0 ? 0 : Math.round((done / chosen) * 100)
  return { chosen, done, rate }
}
