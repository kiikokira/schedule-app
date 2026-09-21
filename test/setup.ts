import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { configure } from '@testing-library/react'

// Windows上の並行テストで非同期DB操作が遅れることがあるため、waitFor等の
// 既定タイムアウトを引き上げて計測環境依存のflakyを避ける
configure({ asyncUtilTimeout: 5000 })

// jsdom には IndexedDB が無いため、fake-indexeddb で代替する
import 'fake-indexeddb/auto'

// jsdom には Canvas が無いため、グラフ描画はダミーに差し替える
vi.mock('react-chartjs-2', () => ({
  Line: ({ children }: { children?: ReactNode }) =>
    createElement('div', { 'data-testid': 'line-mock' }, children),
}))

// vite-plugin-pwa の仮想モジュールは vitest では解決されないためモックする
vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn().mockResolvedValue({}),
}))