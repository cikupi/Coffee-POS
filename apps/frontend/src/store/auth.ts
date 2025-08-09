import { create } from 'zustand'

export type Role = 'ADMIN' | 'KASIR' | 'BARISTA'

export type User = {
  id: string
  name: string
  email: string
  role: Role
}

type AuthState = {
  token: string | null
  user: User | null
  setAuth: (token: string, user: User) => void
  clear: () => void
}

export const useAuth = create<AuthState>((set) => ({
  token: null,
  user: null,
  setAuth: (token, user) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pos_token', token)
      localStorage.setItem('pos_user', JSON.stringify(user))
    }
    set({ token, user })
  },
  clear: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pos_token')
      localStorage.removeItem('pos_user')
    }
    set({ token: null, user: null })
  },
}))

export function hydrateAuthFromStorage() {
  if (typeof window === 'undefined') return
  const token = localStorage.getItem('pos_token')
  const userStr = localStorage.getItem('pos_user')
  if (token && userStr) {
    try {
      const user = JSON.parse(userStr) as User
      useAuth.setState({ token, user })
    } catch {}
  }
}
