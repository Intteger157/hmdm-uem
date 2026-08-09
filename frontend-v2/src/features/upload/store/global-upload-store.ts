import axios from 'axios'
import { create } from 'zustand'
import type { UploadProgressState } from '@/features/windows/applications/utils/installer-upload'
import { uploadStoredFile } from '@/features/windows/files/api/windows-files-api'

export type GlobalUploadStatus = 'uploading' | 'success' | 'error'

export interface GlobalUploadItem {
  fileName: string
  fileSize: number
  progress: UploadProgressState
  status: GlobalUploadStatus
}

interface GlobalUploadState {
  upload: GlobalUploadItem | null
  startStoredFileUpload: (file: File) => void
  cancelUpload: () => void
  dismiss: () => void
}

let abortController: AbortController | null = null
let dismissTimer: ReturnType<typeof setTimeout> | null = null

function clearDismissTimer() {
  if (dismissTimer) {
    clearTimeout(dismissTimer)
    dismissTimer = null
  }
}

function scheduleAutoDismiss(set: (partial: Partial<GlobalUploadState>) => void) {
  clearDismissTimer()
  dismissTimer = setTimeout(() => {
    set({ upload: null })
    dismissTimer = null
  }, 3000)
}

export const useGlobalUploadStore = create<GlobalUploadState>((set, get) => ({
  upload: null,

  startStoredFileUpload: (file: File) => {
    if (get().upload?.status === 'uploading') {
      return
    }

    clearDismissTimer()
    abortController?.abort()
    abortController = new AbortController()
    const controller = abortController

    set({
      upload: {
        fileName: file.name,
        fileSize: file.size,
        progress: { percent: 0, loaded: 0, total: file.size },
        status: 'uploading',
      },
    })

    void uploadStoredFile(file, {
      signal: controller.signal,
      onUploadProgress: (progress) => {
        if (get().upload?.status !== 'uploading') {
          return
        }
        set((state) =>
          state.upload ? { upload: { ...state.upload, progress } } : state,
        )
      },
    })
      .then(() => {
        if (abortController !== controller) {
          return
        }
        set((state) =>
          state.upload
            ? {
                upload: {
                  ...state.upload,
                  status: 'success',
                  progress: {
                    ...state.upload.progress,
                    percent: 100,
                    loaded: state.upload.fileSize,
                    total: state.upload.fileSize,
                  },
                },
              }
            : state,
        )
        scheduleAutoDismiss(set)
      })
      .catch((error: unknown) => {
        if (abortController !== controller) {
          return
        }
        if (axios.isCancel(error)) {
          set({ upload: null })
          return
        }
        set((state) =>
          state.upload
            ? { upload: { ...state.upload, status: 'error' } }
            : {
                upload: {
                  fileName: file.name,
                  fileSize: file.size,
                  progress: { percent: 0, loaded: 0, total: file.size },
                  status: 'error',
                },
              },
        )
      })
      .finally(() => {
        if (abortController === controller) {
          abortController = null
        }
      })
  },

  cancelUpload: () => {
    abortController?.abort()
    abortController = null
    clearDismissTimer()
    set({ upload: null })
  },

  dismiss: () => {
    clearDismissTimer()
    set({ upload: null })
  },
}))

export function selectIsGlobalUploading(state: GlobalUploadState): boolean {
  return state.upload?.status === 'uploading'
}
