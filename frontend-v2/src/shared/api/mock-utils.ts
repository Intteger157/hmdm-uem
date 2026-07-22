export function isMockApiEnabled(): boolean {
  if (import.meta.env.VITE_USE_MOCK === 'false') {
    return false
  }
  return import.meta.env.VITE_USE_MOCK === 'true' || import.meta.env.DEV
}

export function mockNetworkDelay(): Promise<void> {
  const ms = 500 + Math.floor(Math.random() * 301)
  return new Promise((resolve) => setTimeout(resolve, ms))
}
