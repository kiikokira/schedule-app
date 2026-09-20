import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'
import { createElement, type ReactNode } from 'react'

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