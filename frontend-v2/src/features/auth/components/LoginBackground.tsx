/** Full-viewport backdrop: depth, vignette, noise, slow gradient drift. */
export function LoginBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[#090909]" />

      <div
        className="login-gradient-drift absolute -top-1/4 left-1/4 h-[70vh] w-[70vh] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.14)_0%,transparent_68%)] blur-3xl"
      />
      <div
        className="login-gradient-drift-reverse absolute right-0 bottom-0 h-[55vh] w-[55vh] rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.12)_0%,transparent_70%)] blur-3xl"
      />
      <div className="absolute top-1/2 left-1/2 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.04)_0%,transparent_62%)]" />

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.55)_100%)]" />

      <div className="login-noise absolute inset-0 opacity-[0.035]" />

      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="absolute inset-y-0 right-0 hidden w-px bg-gradient-to-b from-transparent via-white/[0.06] to-transparent lg:block" />
    </div>
  )
}
