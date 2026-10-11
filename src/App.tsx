import { useState, useEffect } from 'react'
import HomeScreen from './screens/HomeScreen'
import BookDetailScreen from './screens/BookDetailScreen'
import BookFormScreen from './screens/BookFormScreen'
import SettingsScreen from './screens/SettingsScreen'
import PlanScreen from './screens/PlanScreen'
import TodayPlanScreen from './screens/TodayPlanScreen'
import RebalanceScreen from './screens/RebalanceScreen'
import ChatScreen from './screens/ChatScreen'
import HistoryScreen from './screens/HistoryScreen'
import FocusPeriodScreen from './screens/FocusPeriodScreen'
import SchoolScreen from './screens/SchoolScreen'
import JapanMatchScreen from './screens/JapanMatchScreen'
import { useBooks } from './hooks/useBooks'
import { listAvailability, prunePastOverrides } from './data/dayplanStore'
import { todayStr, formatDate } from './lib/progress'
import { getNotifySettings } from './lib/notify'
import { buildSlotsPayload } from './lib/slotNotify'
import { publishSlotsOnce, syncSlotSchedules } from './lib/slotsPublish'
import { slotsForDate } from './lib/dayplan'
import { takeAutoSnapshotIfNeeded } from './data/autoBackup'
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
  | { name: 'ai-history' }
  | { name: 'focus' }
  | { name: 'school' }
  | { name: 'japan' }

export default function App() {
  const { books, refresh } = useBooks()
  const [route, setRoute] = useState<Route>({ name: 'home' })

  // 起動時に過去日の「当日上書き」を、ユーザーが画面を見る前にバックグラウンドで削除する
  useEffect(() => {
    void prunePastOverrides(todayStr())
  }, [])

  // 起動時に1日1回だけ自動バックアップを取る（ボタン操作なし）
  useEffect(() => {
    void takeAutoSnapshotIfNeeded().catch(() => {})
  }, [])

  // 起動時にその日から3日分の開始予定を登録・予約投稿する。「今日の計画」を開かなくても
  // 開始10分前の通知が届くようにする。同じ予約IDの再送は置換になるため、
  // アプリを開くたび・複数端末でも二重送信しない。ntfyの予約上限が3日のため3日分。
  useEffect(() => {
    const notify = getNotifySettings()
    if (!notify.enabled || !notify.topic.trim()) return
    void listAvailability().then((availability) => {
      const base = new Date()
      for (let offset = 0; offset < 3; offset++) {
        const d = new Date(base)
        d.setDate(d.getDate() + offset)
        const date = formatDate(d)
        const payload = buildSlotsPayload(date, slotsForDate(availability, date), [], books)
        if (offset === 0) void publishSlotsOnce(notify.topic, payload)
        void syncSlotSchedules(notify.topic, payload)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (route.name === 'edit') {
      void refresh()
    }
  }, [route, refresh])

  // SPAでは画面遷移してもスクロール位置が残るため、遷移時は先頭から表示する
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route.name])

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
        {route.name === 'ai' && (
          <ChatScreen onBack={() => setRoute({ name: 'home' })} onHistory={() => setRoute({ name: 'ai-history' })} />
        )}
        {route.name === 'ai-history' && <HistoryScreen onBack={() => setRoute({ name: 'ai' })} />}
        {route.name === 'focus' && <FocusPeriodScreen onBack={() => setRoute({ name: 'home' })} />}
        {route.name === 'plan' && <PlanScreen onDone={() => setRoute({ name: 'home' })} onFocus={() => setRoute({ name: 'focus' })} onJapan={() => setRoute({ name: 'japan' })} />}
        {route.name === 'today' && (
          <TodayPlanScreen
            onBack={() => setRoute({ name: 'home' })}
            onSettings={() => setRoute({ name: 'plan' })}
            onSchool={() => setRoute({ name: 'school' })}
            onRebalance={(bookId) => setRoute({ name: 'rebalance', bookId })}
          />
        )}
        {route.name === 'school' && (
          <SchoolScreen onBack={() => setRoute({ name: 'today' })} />
        )}
        {route.name === 'japan' && (
          <JapanMatchScreen onBack={() => setRoute({ name: 'plan' })} />
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