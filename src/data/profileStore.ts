export type PlayMode = 'league' | 'rpg' | 'both'

export type Profile = {
  nickname: string
  grade: string
  university: string
  faculty: string
  department: string
  playMode: PlayMode
}

const KEY = 'schedule-app-profile'

const DEFAULT_PROFILE: Profile = {
  nickname: '',
  grade: '',
  university: '',
  faculty: '',
  department: '',
  playMode: 'both',
}

const PLAY_MODES: PlayMode[] = ['league', 'rpg', 'both']

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_PROFILE }
    const parsed = JSON.parse(raw) as Partial<Profile>
    const merged = { ...DEFAULT_PROFILE, ...parsed }
    if (!PLAY_MODES.includes(merged.playMode)) merged.playMode = 'both'
    return merged
  } catch {
    return { ...DEFAULT_PROFILE }
  }
}

export function saveProfile(p: Profile): void {
  localStorage.setItem(KEY, JSON.stringify(p))
}
