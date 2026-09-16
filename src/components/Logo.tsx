export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="GFit"
    >
      <rect width="48" height="48" rx="12" fill="#16150F" />
      {/* Um haltere: a barra e os dois discos. */}
      <rect x="10" y="21.5" width="28" height="5" rx="2.5" fill="#F4F1EC" />
      <rect x="7" y="17" width="6" height="14" rx="2.5" fill="#FF4A1C" />
      <rect x="35" y="17" width="6" height="14" rx="2.5" fill="#FF4A1C" />
    </svg>
  )
}
