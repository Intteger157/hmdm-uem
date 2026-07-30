import { useEffect } from 'react'
import { fetchPlatformScope } from '@/features/auth/api/console-profile-api'
import { useAuthStore } from '@/features/auth/store/auth-store'

/**
 * Re-reads the platform scope of a restored session.
 *
 * The persisted scope can be stale because an administrator may have re-scoped
 * the role since the last sign-in. A failed lookup keeps the stored value rather
 * than widening the navigation, so a brief Go outage does not reveal the
 * ecosystem the operator cannot manage.
 */
export function usePlatformScopeSync(): void {
  const jwt = useAuthStore((s) => s.jwt)

  useEffect(() => {
    if (!jwt) {
      return
    }

    let cancelled = false
    void fetchPlatformScope().then((scope) => {
      if (!cancelled && scope != null) {
        useAuthStore.getState().setPlatformScope(scope)
      }
    })

    return () => {
      cancelled = true
    }
  }, [jwt])
}
