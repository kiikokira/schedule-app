import { beforeEach, describe, it, expect } from 'vitest'
import { db } from '../db/database'
import {
  listChatHistory,
  appendChatHistory,
  clearChatHistory,
  CHAT_HISTORY_LIMIT,
} from './chatHistoryStore'

beforeEach(async () => {
  await db.chatMessages.clear()
})

describe('chatHistoryStore', () => {
  it('returns an empty list initially', async () => {
    expect(await listChatHistory()).toEqual([])
  })

  it('appends entries in order', async () => {
    await appendChatHistory({ role: 'user', text: 'こんにちは' })
    await appendChatHistory({ role: 'assistant', text: 'こんばんは' })
    const all = await listChatHistory()
    expect(all.map((e) => e.text)).toEqual(['こんにちは', 'こんばんは'])
  })

  it('trims to the limit, dropping the oldest', async () => {
    for (let i = 0; i < CHAT_HISTORY_LIMIT + 5; i++) {
      await appendChatHistory({ role: 'user', text: `msg-${i}` })
    }
    const all = await listChatHistory()
    expect(all).toHaveLength(CHAT_HISTORY_LIMIT)
    expect(all[0].text).toBe('msg-5')
    expect(all[all.length - 1].text).toBe(`msg-${CHAT_HISTORY_LIMIT + 4}`)
  })

  it('clears all entries', async () => {
    await appendChatHistory({ role: 'user', text: 'x' })
    await clearChatHistory()
    expect(await listChatHistory()).toEqual([])
  })
})
