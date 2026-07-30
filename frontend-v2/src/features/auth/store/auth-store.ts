import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Platform } from '@/shared/api/types/platform'
import type { User } from '@/shared/api/types/user'
import { isLikelyConsoleJwt } from '@/shared/lib/jwt-utils'
import { hasPermission as checkPermission } from '@/shared/lib/permissions'
import {
  isPlatformScope,
  scopeAllowsPlatform,
  scopedPlatform,
  type PlatformScope,
} from '@/shared/lib/platform-scope'

interface AuthState {
  jwt: string | null
  user: User | null
  /** Null until resolved, or when the Go server could not be reached. */
  platformScope: PlatformScope | null
  setAuth: (jwt: string, user: User, platformScope?: PlatformScope | null) => void
  setUser: (user: User) => void
  setPlatformScope: (platformScope: PlatformScope | null) => void
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
      platformScope: null,
      setAuth: (jwt, user, platformScope = null) => set({ jwt, user, platformScope }),
      setUser: (user) => set({ user }),
      setPlatformScope: (platformScope) => set({ platformScope }),
      logout: () => set({ jwt: null, user: null, platformScope: null }),
      isAuthenticated: () => Boolean(get().jwt && get().user),
      hasPermission: (permission) => checkPermission(get().user, permission),
      allowsPlatform: (platform) => scopeAllowsPlatform(get().platformScope, platform),
      scopedPlatform: () => scopedPlatform(get().platformScope),
    }),
    {
      name: 'hmdm-auth-v2',
      partialize: (state) => ({
        jwt: state.jwt,
        user: state.user,
        // Persisted so a reload does not flash navigation the role cannot use
        // while the profile request is still in flight.
        platformScope: state.platformScope,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.jwt && !isLikelyConsoleJwt(state.jwt)) {
          state.jwt = null
          state.user = null
          state.platformScope = null
        }
        if (state && !isPlatformScope(state.platformScope)) {
          state.platformScope = null
        }
      },
    },
  ),
)
