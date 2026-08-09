import { create } from 'zustand'

export type PostUploadResourceKind = 'application' | 'file'

export interface PostUploadAssignmentRequest {
  kind: PostUploadResourceKind
  resourceId: number
  resourceName: string
}

interface PostUploadAssignmentState {
  request: PostUploadAssignmentRequest | null
  openApplicationAssignment: (appId: number, appName: string) => void
  openFileAssignment: (fileId: number, fileName: string) => void
  dismiss: () => void
}

export const usePostUploadAssignmentStore = create<PostUploadAssignmentState>((set) => ({
  request: null,

  openApplicationAssignment: (appId, appName) => {
    set({
      request: {
        kind: 'application',
        resourceId: appId,
        resourceName: appName.trim(),
      },
    })
  },

  openFileAssignment: (fileId, fileName) => {
    set({
      request: {
        kind: 'file',
        resourceId: fileId,
        resourceName: fileName.trim(),
      },
    })
  },

  dismiss: () => {
    set({ request: null })
  },
}))
