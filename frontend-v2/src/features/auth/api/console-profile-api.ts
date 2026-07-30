import axios from 'axios'
import { WINDOWS_API_BASE } from '@/shared/api/config'
import { attachAuthToken } from '@/shared/api/setup-auth-interceptors'
import { isMockApiEnabled } from '@/shared/api/mock-utils'
import { mockFetchConsoleProfile } from '@/shared/api/mocks/auth'
import type { ConsoleProfile } from '@/shared/api/types/console-profile'
import { isPlatformScope, type PlatformScope } from '@/shared/lib/platform-scope'

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
 * Reads the platform scope of the signed-in operator.
 *
 * The Java /private/users/current payload has no scope columns, and the role
 * list is not a substitute because it exposes every other role too.
 */
export async function fetchConsoleProfile(): Promise<ConsoleProfile> {
  if (isMockApiEnabled()) {
    return mockFetchConsoleProfile()
  }

  const response = await profileApi.get<ConsoleProfile>('/me')
  return response.data
}

/**
 * Resolves the caller's scope, or null when it cannot be determined.
 *
 * Callers treat null as "unrestricted": the servers still reject out-of-scope
 * requests, so a transient Go outage must not blank out the navigation.
 */
export async function fetchPlatformScope(): Promise<PlatformScope | null> {
  try {
    const profile = await fetchConsoleProfile()
    return isPlatformScope(profile.platformScope) ? profile.platformScope : null
  } catch {
    return null
  }
}
