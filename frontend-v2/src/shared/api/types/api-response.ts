export type ResponseStatus = 'OK' | 'WARNING' | 'ERROR'

export interface ApiResponse<T = unknown> {
  status: ResponseStatus
  message?: string
  data?: T
}

export class ApiError extends Error {
  readonly messageKey: string | undefined

  constructor(messageKey: string | undefined) {
    super(messageKey ?? 'error.internal.server')
    this.name = 'ApiError'
    this.messageKey = messageKey
  }
}

export function unwrapApiResponse<T>(response: ApiResponse<T>): T {
  if (response.status === 'OK') {
    return response.data as T
  }
  throw new ApiError(response.message)
}
