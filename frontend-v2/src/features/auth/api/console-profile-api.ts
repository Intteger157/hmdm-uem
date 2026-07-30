import axios from 'axios'
import { WINDOWS_API_BASE } from '@/shared/api/config'
import { attachAuthToken } from '@/shared/api/setup-auth-interceptors'
import { isMockApiEnabled } from '@/shared/api/mock-utils'
import { mockFetchConsoleProfile } from '@/shared/api/mocks/auth'
import type { ConsoleProfile } from '@/shared/api/types/console-profile'
import { toConsoleAccess, type ConsoleAccess } from '@/shared/lib/console-access'

export type { ConsoleProfile }

// Deliberately without the logout-on-401 response interceptor: the console must
// stay usable when the Go service is down or its JWT secret drifts from Java's,
// and a redirect to /login here would loop instead of surfacing the problem.
const profileApi = axios.create({
  baseURL: WINDOWS_API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

attachAuthToken(profileApi)

/**
 * Reads the RBAC dimensions of the signed-in operator's role.
 *
 * The Java /private/users/current payload has no scope or level columns, and the
 * role list is not a substitute because it exposes every other role too.
 */
export async function fetchConsoleProfile(): Promise<ConsoleProfile> {
  if (isMockApiEnabled()) {
    return mockFetchConsoleProfile()
  }

  const response = await profileApi.get<ConsoleProfile>('/me')
  return response.data
}

/**
 * Resolves the caller's scope and level, or null when they cannot be determined.
 *
 * Callers treat null as the least privilege, so a failure here locks the console
 * down rather than opening it up. That makes the failure worth reporting: an
 * operator who suddenly sees a read-only console needs the reason to be visible
 * somewhere, and silently returning null gives no way to tell a genuine Observer
 * role apart from an unreachable /me.
 */
export async function fetchConsoleAccess(): Promise<ConsoleAccess | null> {
  try {
    return toConsoleAccess(await fetchConsoleProfile())
  } catch (err) {
    const status = axios.isAxiosError(err) ? err.response?.status : undefined
    console.error(
      `[rbac] could not read ${WINDOWS_API_BASE}/me${status ? ` (HTTP ${status})` : ''}; ` +
        'the console will stay restricted until the role resolves',
      err,
    )
    return null
  }
}
