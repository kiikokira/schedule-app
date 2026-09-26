import { useState, useEffect } from 'react'
import HomeScreen from './screens/HomeScreen'
import BookDetailScreen from './screens/BookDetailScreen'
import BookFormScreen from './screens/BookFormScreen'
import SettingsScreen from './screens/SettingsScreen'
import PlanScreen from './screens/PlanScreen'
import TodayPlanScreen from './screens/TodayPlanScreen'
import RebalanceScreen from './screens/RebalanceScreen'
import ChatScreen from './screens/ChatScreen'
import { useBooks } from './hooks/useBooks'
import { listAvailability, prunePastOverrides } from './data/dayplanStore'
import { todayStr } from './lib/progress'
import { getNotifySettings } from './lib/notify'
import { buildSlotsPayload } from './lib/slotNotify'
import { publishSlotsOnce } from './lib/slotsPublish'
import { slotsForDate } from './lib/dayplan'
import './styles.css'

type Route =
  | { name: 'home' }
  | { name: 'today' }
  | { name: 'detail'; bookId: string }
  | { name: 'add' }
  | { name: 'edit'; bookId: string }
  | { name: 'rebalance'; bookId: string }
  | { name: 'settings' }
  | { name: 'plan' }
  | { name: 'ai' }

export default function App() {
  const { books, refresh } = useBooks()
  const [route, setRoute] = useState<Route>({ name: 'home' })

  // 起動時に過去日の「当日上書き」を、ユーザーが画面を見る前にバックグラウンドで削除する
  useEffect(() => {
    void prunePastOverrides(todayStr())
  }, [])

  // 起動時にその日の終了予定を登録する。「今日の計画」を開かなくても
  // リマインダーのワークフローが時間帯を拾えるようにする。
  // 同内容の再送は publishSlotsOnce 側で抑止される。
  useEffect(() => {
    const notify = getNotifySettings()
    if (!notify.enabled || !notify.topic.trim()) return
    const today = todayStr()
    void listAvailability().then((availability) => {
      const payload = buildSlotsPayload(today, slotsForDate(availability, today), [], books)
      void publishSlotsOnce(notify.topic, payload)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (route.name === 'edit') {
      void refresh()
    }
  }, [route, refresh])

  const editBook = route.name === 'edit' ? books.find((b) => b.id === route.bookId) : undefined

  return (
    <>
      <header className="app-header">
        <span className="app-title">スケジュール管理</span>
      </header>
      <main>
        {route.name === 'home' && (
          <HomeScreen onOpenBook={(id) => setRoute({ name: 'detail', bookId: id })} />
        )}
        {route.name === 'detail' && (
          <BookDetailScreen
            bookId={route.bookId}
            onBack={() => setRoute({ name: 'home' })}
            onEdit={(id) => setRoute({ name: 'edit', bookId: id })}
          />
        )}
        {route.name === 'edit' && editBook && (
          <BookFormScreen
            key={editBook.id}
            book={editBook}
            onDone={() => setRoute({ name: 'home' })}
            onRebalance={(bookId) => setRoute({ name: 'rebalance', bookId })}
          />
        )}
        {route.name === 'rebalance' && (
          <RebalanceScreen
            bookId={route.bookId}
            onBack={() => setRoute({ name: 'home' })}
            onSchedule={() => setRoute({ name: 'today' })}
          />
        )}
        {route.name === 'add' && (
          <BookFormScreen book={null} onDone={() => setRoute({ name: 'home' })} />
        )}
        {route.name === 'settings' && <SettingsScreen onDone={() => setRoute({ name: 'home' })} />}
        {route.name === 'ai' && <ChatScreen onBack={() => setRoute({ name: 'home' })} />}
        {route.name === 'plan' && <PlanScreen onDone={() => setRoute({ name: 'home' })} />}
        {route.name === 'today' && (
          <TodayPlanScreen
            onBack={() => setRoute({ name: 'home' })}
            onSettings={() => setRoute({ name: 'plan' })}
          />
        )}
      </main>
      <footer className="app-footer">
        {route.name === 'home' && (
          <>
            <button data-testid="nav-today" onClick={() => setRoute({ name: 'today' })}>
              今日の計画
            </button>
            <button data-testid="nav-plan" onClick={() => setRoute({ name: 'plan' })}>
              スケジュールで参考書を追加
            </button>
            <button data-testid="nav-ai" onClick={() => setRoute({ name: 'ai' })}>
              調整AI
            </button>
            <button data-testid="nav-add" onClick={() => setRoute({ name: 'add' })}>
              ＋ 参考書を追加
            </button>
          </>
        )}
        {route.name !== 'home' && (
          <button data-testid="nav-home" onClick={() => setRoute({ name: 'home' })}>
            ホーム
          </button>
        )}
        {route.name !== 'settings' && (
          <button data-testid="nav-settings" onClick={() => setRoute({ name: 'settings' })}>
            設定
          </button>
        )}
      </footer>
    </>
  )
}