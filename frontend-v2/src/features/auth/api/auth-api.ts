import { api, publicApi } from '@/shared/api/client'
import type { ApiResponse } from '@/shared/api/types/api-response'
import { unwrapApiResponse } from '@/shared/api/types/api-response'
import type { User } from '@/shared/api/types/user'
import { hashPassword } from '@/shared/lib/password'

interface JwtLoginResponse {
  id_token: string
}

export async function loginWithJwt(login: string, plainPassword: string): Promise<string> {
  const response = await publicApi.post<JwtLoginResponse>('/public/jwt/login', {
    login,
    password: hashPassword(plainPassword),
  })

  const token =
    response.data.id_token ??
    response.headers.authorization?.replace(/^Bearer\s+/i, '')

  if (!token) {
    throw new Error('Missing JWT token in login response')
  }

  return token
}

export async function fetchCurrentUser(): Promise<User> {
  const response = await api.get<ApiResponse<User>>('/private/users/current')
  return unwrapApiResponse(response.data)
}
