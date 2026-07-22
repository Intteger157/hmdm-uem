import { useLayoutEffect } from 'react'

/** Forces the document to light theme while mounted (restores on unmount). */
export function useForceLightTheme(): void {
  useLayoutEffect(() => {
    const root = document.documentElement
    const hadDark = root.classList.contains('dark')

    root.classList.remove('dark')

    return () => {
      if (hadDark) {
        root.classList.add('dark')
      }
    }
  }, [])
}
