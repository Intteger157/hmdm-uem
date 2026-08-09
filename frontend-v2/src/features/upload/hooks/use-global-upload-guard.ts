import { useEffect } from 'react'
import { selectIsGlobalUploading, useGlobalUploadStore } from '@/features/upload/store/global-upload-store'

/** Warn before closing or refreshing the tab while a large upload is in progress. */
export function useGlobalUploadGuard() {
  const isUploading = useGlobalUploadStore(selectIsGlobalUploading)

  useEffect(() => {
    if (!isUploading) {
      return
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isUploading])
}
