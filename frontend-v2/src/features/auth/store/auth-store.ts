import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/shared/api/types/user'
import { hasPermission as checkPermission } from '@/shared/lib/permissions'

interface AuthState {
  jwt: string | null
  user: User | null
  setAuth: (jwt: string, user: User) => void
  setUser: (user: User) => void
  logout: () => void
  isAuthenticated: () => boolean
  hasPermission: (permission: string) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      jwt: null,
      user: null,
      setAuth: (jwt, user) => set({ jwt, user }),
      setUser: (user) => set({ user }),
      logout: () => set({ jwt: null, user: null }),
      isAuthenticated: () => Boolean(get().jwt && get().user),
      hasPermission: (permission) => checkPermission(get().user, permission),
    }),
    {
      name: 'hmdm-auth-v2',
      partialize: (state) => ({ jwt: state.jwt, user: state.user }),
    },
  ),
)
