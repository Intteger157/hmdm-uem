import { Outlet } from '@tanstack/react-router'
import { LoginBackground } from '@/features/auth/components/LoginBackground'
import { LoginHeroSection } from '@/features/auth/components/LoginHeroSection'

export function AuthLayout() {
  return (
    <div className="dark relative min-h-svh overflow-hidden bg-[#090909] text-white">
      <LoginBackground />

      <div className="relative grid min-h-svh lg:grid-cols-[3fr_2fr]">
        <section className="hidden flex-col justify-center px-10 py-12 xl:px-16 xl:py-16 lg:flex">
          <LoginHeroSection />
        </section>

        <section className="flex min-h-svh items-center justify-center px-5 py-10 sm:px-8 lg:px-10 xl:px-14">
          <Outlet />
        </section>
      </div>
    </div>
  )
}
