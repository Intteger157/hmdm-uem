import { Toaster as Sonner } from 'sonner'

export function Toaster() {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: 'cn-toast',
        },
      }}
    />
  )
}
