interface LogoProps {
  size?: number
}

/** Marca do Pavio: um candle com a chama no pavio. */
export function Logo({ size = 24 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--text)" />
      <path
        d="M16 4.5c1.9 2.2 2.6 3.9 2.1 5.3-.4 1.1-1.2 1.7-2.1 1.7s-1.7-.6-2.1-1.7c-.5-1.4.2-3.1 2.1-5.3Z"
        fill="var(--brand)"
      />
      <path d="M16 12v3M16 25v3" stroke="var(--bg)" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="12" y="15" width="8" height="10" rx="1.5" fill="var(--bg)" />
    </svg>
  )
}
