import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { Toaster } from '@/components/ui/sonner'
import { router } from '@/router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export function AppProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  )
}
