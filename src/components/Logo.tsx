const BASE = import.meta.env.BASE_URL

/**
 * A marca. `mark` são as silhuetas (o mesmo desenho do ícone da app), boa a
 * partir de ~28 px; `full` traz a palavra por baixo, para o ecrã de entrada.
 */
export function Logo({
  size = 36,
  variant = 'mark',
}: {
  size?: number
  variant?: 'mark' | 'full'
}) {
  const src = variant === 'full' ? `${BASE}logo-gfit.png` : `${BASE}icon-192.png`

  return (
    <img
      className={`logo logo--${variant}`}
      src={src}
      width={size}
      height={size}
      alt="GFit"
      decoding="async"
    />
  )
}
