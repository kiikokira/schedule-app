export type Profile = {
  nickname: string
  grade: string
  university: string
  faculty: string
  department: string
}

const KEY = 'schedule-app-profile'

const DEFAULT_PROFILE: Profile = {
  nickname: '',
  grade: '',
  university: '',
  faculty: '',
  department: '',
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_PROFILE }
    const parsed = JSON.parse(raw) as Partial<Profile>
    return { ...DEFAULT_PROFILE, ...parsed }
  } catch {
    return { ...DEFAULT_PROFILE }
  }
}

export function saveProfile(p: Profile): void {
  localStorage.setItem(KEY, JSON.stringify(p))
}
