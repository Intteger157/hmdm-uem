/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string
  readonly VITE_WINDOWS_API_BASE: string
  readonly VITE_BACKEND_URL: string
  readonly VITE_WINDOWS_MDM_ENABLED: string
  readonly VITE_USE_MOCK: string
  readonly VITE_MOCK_PLATFORM_SCOPE: string
  readonly VITE_MOCK_ACCESS_LEVEL: string
  readonly VITE_MOCK_SUPER_ADMIN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
