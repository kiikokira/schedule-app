// ビルド時に一意なIDが埋め込まれる（vite.config.ts の define を参照）。
// 未定義の環境では 'dev' にフォールバックする。
function currentBuildId(): string {
  try {
    if (typeof __APP_BUILD_ID__ !== 'undefined' && __APP_BUILD_ID__) {
      return __APP_BUILD_ID__
    }
  } catch {
    // 定義が無い環境ではフォールバックする
  }
  return 'dev'
}

export const APP_BUILD_ID: string = currentBuildId()

// 前回起動時とビルドが違えば「開いていない間に更新された」ので
// 青ドットを出す。初回（未記録）は出さない。
export function shouldShowUpdateDot(lastSeen: string | null, current: string): boolean {
  return lastSeen !== null && lastSeen !== current
}
