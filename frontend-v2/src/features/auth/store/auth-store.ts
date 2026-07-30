import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Platform } from '@/shared/api/types/platform'
import type { User } from '@/shared/api/types/user'
import { isLikelyConsoleJwt } from '@/shared/lib/jwt-utils'
import { hasPermission as checkPermission } from '@/shared/lib/permissions'
import { isConsoleAccess, type ConsoleAccess } from '@/shared/lib/console-access'
import { scopeAllowsPlatform, scopedPlatform } from '@/shared/lib/platform-scope'

interface AuthState {
  jwt: string | null
  user: User | null
  /** Null until resolved, or when the Go server could not be reached. */
  access: ConsoleAccess | null
  setAuth: (jwt: string, user: User, access?: ConsoleAccess | null) => void
  setUser: (user: User) => void
  setAccess: (access: ConsoleAccess | null) => void
  logout: () => void
  isAuthenticated: () => boolean
  hasPermission: (permission: string) => boolean
  /** Whether the operator's role may manage the given device ecosystem. */
  allowsPlatform: (platform: Platform) => boolean
  /** The ecosystem the operator is locked to, or null when they manage both. */
  scopedPlatform: () => Platform | null
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      jwt: null,
      user: null,
      access: null,
      setAuth: (jwt, user, access = null) => set({ jwt, user, access }),
      setUser: (user) => set({ user }),
      setAccess: (access) => set({ access }),
      logout: () => set({ jwt: null, user: null, access: null }),
      isAuthenticated: () => Boolean(get().jwt && get().user),
      hasPermission: (permission) => checkPermission(get().user, permission),
      allowsPlatform: (platform) => scopeAllowsPlatform(get().access?.platformScope, platform),
      scopedPlatform: () => scopedPlatform(get().access?.platformScope),
    }),
    {
      name: 'hmdm-auth-v2',
      partialize: (state) => ({
        jwt: state.jwt,
        user: state.user,
        // Persisted so a reload does not flash navigation and buttons the role
        // cannot use while the profile request is still in flight.
        access: state.access,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.jwt && !isLikelyConsoleJwt(state.jwt)) {
          state.jwt = null
          state.user = null
          state.access = null
        }
        // Also clears the shape persisted before access levels were stored, so a
        // session carried across the upgrade re-reads its role instead of
        // trusting a half-populated object.
        if (state && !isConsoleAccess(state.access)) {
          state.access = null
        }
      },
    },
  ),
)
