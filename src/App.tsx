import { useState, useEffect } from 'react'
import HomeScreen from './screens/HomeScreen'
import BookDetailScreen from './screens/BookDetailScreen'
import BookFormScreen from './screens/BookFormScreen'
import SettingsScreen from './screens/SettingsScreen'
import PlanScreen from './screens/PlanScreen'
import TodayPlanScreen from './screens/TodayPlanScreen'
import RebalanceScreen from './screens/RebalanceScreen'
import { useBooks } from './hooks/useBooks'
import { prunePastOverrides } from './data/dayplanStore'
import { todayStr } from './lib/progress'
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

export default function App() {
  const { books } = useBooks()
  const [route, setRoute] = useState<Route>({ name: 'home' })

  // 起動時に過去日の「当日上書き」を、ユーザーが画面を見る前にバックグラウンドで削除する
  useEffect(() => {
    void prunePastOverrides(todayStr())
  }, [])

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