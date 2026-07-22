import { Outlet } from '@tanstack/react-router'
import { ThemeIconToggle } from '@/components/theme-toggle'

export function AuthLayout() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="absolute right-4 top-4">
        <ThemeIconToggle />
      </div>
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </div>
  )
}
