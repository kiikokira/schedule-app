import { db } from '../db/database'

export type ChatHistoryEntry = {
  id: string
  at: string
  role: 'assistant' | 'user'
  text: string
}

export const CHAT_HISTORY_LIMIT = 50

export async function listChatHistory(): Promise<ChatHistoryEntry[]> {
  return db.chatMessages.orderBy('at').toArray()
}

export async function appendChatHistory(entry: {
  role: 'assistant' | 'user'
  text: string
}): Promise<void> {
  await db.chatMessages.add({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    ...entry,
  })
  const count = await db.chatMessages.count()
  if (count > CHAT_HISTORY_LIMIT) {
    const oldest = await db.chatMessages.orderBy('at').limit(count - CHAT_HISTORY_LIMIT).primaryKeys()
    await db.chatMessages.bulkDelete(oldest)
  }
}

export async function clearChatHistory(): Promise<void> {
  await db.chatMessages.clear()
}
