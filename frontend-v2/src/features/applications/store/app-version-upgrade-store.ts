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

/** Open upgrade dialog (call before closing the save dialog to avoid modal conflicts). */
export function openAppVersionUpgradePrompt(prompt: AppVersionUpgradePrompt): void {
  useAppVersionUpgradeStore.getState().open(prompt)
}
