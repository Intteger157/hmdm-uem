import { Outlet } from '@tanstack/react-router'
import { ThemeToggle } from '@/components/theme-toggle'

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="absolute right-4 top-4 w-44">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </div>
  )
}
