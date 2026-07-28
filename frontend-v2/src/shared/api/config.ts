export const API_BASE = import.meta.env.VITE_API_BASE ?? '/rest'

/** Go server-windows routes (always /rest/windows at the gateway unless overridden). */
export const WINDOWS_API_BASE = import.meta.env.VITE_WINDOWS_API_BASE ?? '/rest/windows'
