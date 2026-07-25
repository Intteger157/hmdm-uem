import axios from 'axios'

export function getWindowsApiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) {
    return fallback
  }

  const payload = error.response?.data
  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim()
  }

  if (payload && typeof payload === 'object' && 'error' in payload) {
    const message = payload.error
    if (typeof message === 'string' && message.trim()) {
      return message.trim()
    }
  }

  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = payload.message
    if (typeof message === 'string' && message.trim()) {
      return message.trim()
    }
  }

  if (error.message.trim()) {
    return error.message.trim()
  }

  return fallback
}

export function isDuplicateApplicationNameError(message: string): boolean {
  return /already exists/i.test(message)
}
