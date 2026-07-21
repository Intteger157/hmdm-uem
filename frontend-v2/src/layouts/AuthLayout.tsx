import { Outlet } from '@tanstack/react-router'

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </div>
  )
}
