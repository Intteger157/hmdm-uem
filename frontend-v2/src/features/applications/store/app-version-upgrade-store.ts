import { create } from 'zustand'
import type { Application } from '@/features/applications/api/applications-api'

export interface AppVersionUpgradePrompt {
  application: Application
  versionLabel: string
}

interface AppVersionUpgradeState {
  prompt: AppVersionUpgradePrompt | null
  open: (prompt: AppVersionUpgradePrompt) => void
  dismiss: () => void
}

export const useAppVersionUpgradeStore = create<AppVersionUpgradeState>((set) => ({
  prompt: null,

  open: (prompt) => {
    set({ prompt })
  },

  dismiss: () => {
    set({ prompt: null })
  },
}))

/** Open after the save dialog closes so two modals do not fight for focus. */
export function openAppVersionUpgradePrompt(prompt: AppVersionUpgradePrompt): void {
  window.setTimeout(() => {
    useAppVersionUpgradeStore.getState().open(prompt)
  }, 150)
}
