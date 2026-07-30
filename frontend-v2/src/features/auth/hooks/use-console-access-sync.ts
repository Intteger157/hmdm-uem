import { useEffect } from 'react'
import { fetchConsoleAccess } from '@/features/auth/api/console-profile-api'
import { useAuthStore } from '@/features/auth/store/auth-store'

/**
 * Re-reads the RBAC dimensions of a restored session.
 *
 * The persisted values can be stale because an administrator may have re-scoped
 * or re-levelled the role since the last sign-in. A failed lookup keeps the
 * stored values rather than widening the console, so a brief Go outage does not
 * reveal the ecosystem or the actions the operator cannot use.
 */
export function useConsoleAccessSync(): void {
  const jwt = useAuthStore((s) => s.jwt)

  useEffect(() => {
    if (!jwt) {
      return
    }

    let cancelled = false
    void fetchConsoleAccess().then((access) => {
      if (!cancelled && access != null) {
        useAuthStore.getState().setAccess(access)
      }
    })

    return () => {
      cancelled = true
    }
  }, [jwt])
}
