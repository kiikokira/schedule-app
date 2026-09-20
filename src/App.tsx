import { useState } from 'react'
import HomeScreen from './screens/HomeScreen'
import BookDetailScreen from './screens/BookDetailScreen'
import BookFormScreen from './screens/BookFormScreen'
import SettingsScreen from './screens/SettingsScreen'
import PlanScreen from './screens/PlanScreen'
import { useBooks } from './hooks/useBooks'
import { usePwaReload } from './hooks/usePwaReload'
import './styles.css'

type Route =
  | { name: 'home' }
  | { name: 'detail'; bookId: string }
  | { name: 'add' }
  | { name: 'edit'; bookId: string }
  | { name: 'settings' }
  | { name: 'plan' }

export default function App() {
  const { books } = useBooks()
  const [route, setRoute] = useState<Route>({ name: 'home' })
  const { needsRefresh, reload } = usePwaReload()

  const editBook = route.name === 'edit' ? books.find((b) => b.id === route.bookId) : undefined

  return (
    <>
      {needsRefresh && (
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            padding: 8,
            background: 'var(--gold)',
            color: '#202020',
          }}
        >
          アプリが更新されました。
          <button onClick={() => void reload()}>更新する</button>
        </div>
      )}
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
          <BookFormScreen book={editBook} onDone={() => setRoute({ name: 'home' })} />
        )}
        {route.name === 'add' && (
          <BookFormScreen book={null} onDone={() => setRoute({ name: 'home' })} />
        )}
        {route.name === 'settings' && <SettingsScreen onDone={() => setRoute({ name: 'home' })} />}
        {route.name === 'plan' && <PlanScreen onDone={() => setRoute({ name: 'home' })} />}
      </main>
      <footer className="app-footer">
        {route.name === 'home' && (
          <>
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