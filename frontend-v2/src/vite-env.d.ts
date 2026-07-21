/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string
  readonly VITE_BACKEND_URL: string
  readonly VITE_WINDOWS_MDM_ENABLED: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
