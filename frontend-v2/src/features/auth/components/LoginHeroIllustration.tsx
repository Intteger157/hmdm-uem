/** Pure SVG endpoint network — slow orbit, pulsing links, no external assets. */
export function LoginHeroIllustration() {
  return (
    <svg
      viewBox="0 0 520 520"
      className="h-auto w-full max-w-[min(100%,420px)]"
      aria-hidden
      role="presentation"
    >
      <defs>
        <radialGradient id="login-hub-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(59,130,246,0.35)" />
          <stop offset="100%" stopColor="rgba(59,130,246,0)" />
        </radialGradient>
        <linearGradient id="login-line-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(59,130,246,0.55)" />
          <stop offset="100%" stopColor="rgba(124,58,237,0.35)" />
        </linearGradient>
        <linearGradient id="login-node-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <filter id="login-soft-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx="260" cy="260" r="200" fill="url(#login-hub-glow)" className="login-pulse-soft" />

      <circle
        cx="260"
        cy="260"
        r="168"
        fill="none"
        stroke="rgba(255,255,255,0.04)"
        strokeWidth="1"
        strokeDasharray="4 8"
        className="login-orbit-ring"
      />
      <circle
        cx="260"
        cy="260"
        r="118"
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth="1"
        strokeDasharray="2 6"
        className="login-orbit-ring-reverse"
      />

      <g className="login-orbit-slow" style={{ transformOrigin: '260px 260px' }}>
        <ConnectionLine x1={260} y1={260} x2={260} y2={92} />
        <ConnectionLine x1={260} y1={260} x2={407} y2={176} />
        <ConnectionLine x1={260} y1={260} x2={407} y2={344} />
        <ConnectionLine x1={260} y1={260} x2={260} y2={428} />
        <ConnectionLine x1={260} y1={260} x2={113} y2={344} />
        <ConnectionLine x1={260} y1={260} x2={113} y2={176} />

        <DeviceNode cx={260} cy={92} variant="laptop" />
        <DeviceNode cx={407} cy={176} variant="phone" />
        <DeviceNode cx={407} cy={344} variant="desktop" />
        <DeviceNode cx={260} cy={428} variant="laptop" />
        <DeviceNode cx={113} cy={344} variant="phone" />
        <DeviceNode cx={113} cy={176} variant="desktop" />
      </g>

      <g filter="url(#login-soft-glow)">
        <circle cx="260" cy="260" r="52" fill="#0c0c0f" stroke="url(#login-node-grad)" strokeWidth="1.5" />
        <circle cx="260" cy="260" r="38" fill="rgba(59,130,246,0.08)" />
        <circle cx="260" cy="260" r="10" fill="url(#login-node-grad)" className="login-pulse-core" />
        <circle cx="260" cy="260" r="22" fill="none" stroke="rgba(59,130,246,0.25)" strokeWidth="1" />
      </g>
    </svg>
  )
}

function ConnectionLine({
  x1,
  y1,
  x2,
  y2,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
}) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke="url(#login-line-grad)"
      strokeWidth="1"
      strokeOpacity="0.45"
      className="login-flow-line"
    />
  )
}

function DeviceNode({
  cx,
  cy,
  variant,
}: {
  cx: number
  cy: number
  variant: 'laptop' | 'phone' | 'desktop'
}) {
  const sizes = {
    laptop: { w: 28, h: 18, rx: 3 },
    phone: { w: 14, h: 24, rx: 3 },
    desktop: { w: 24, h: 20, rx: 3 },
  } as const

  const { w, h, rx } = sizes[variant]
  const x = cx - w / 2
  const y = cy - h / 2

  return (
    <g className="login-node-pulse">
      <rect
        x={x - 6}
        y={y - 6}
        width={w + 12}
        height={h + 12}
        rx={8}
        fill="rgba(59,130,246,0.06)"
      />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={rx}
        fill="#101014"
        stroke="url(#login-node-grad)"
        strokeWidth="1"
        strokeOpacity="0.7"
      />
      <circle cx={cx} cy={cy} r="2.5" fill="url(#login-node-grad)" opacity="0.9" />
    </g>
  )
}
