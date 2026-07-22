import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.VITE_BACKEND_URL ?? 'http://localhost:8080'
  const windowsBackendUrl = env.VITE_WINDOWS_BACKEND_URL ?? 'http://localhost:8082'

  return {
    base: '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/rest/windows': {
          target: windowsBackendUrl,
          changeOrigin: true,
        },
        '/rest': {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
  }
})
