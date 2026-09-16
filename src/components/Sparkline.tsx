import './sparkline.css'

interface Props {
  values: (number | null)[]
  /** Segunda série, desenhada mais fina — tipicamente a média móvel. */
  overlay?: (number | null)[]
  height?: number
  label?: string
}

/**
 * Gráfico de linha minúsculo. Sem eixos nem legendas: serve para ver a
 * direção do peso ao longo das semanas, não para ler valores exatos.
 */
export function Sparkline({ values, overlay, height = 72, label }: Props) {
  const present = values.filter((value): value is number => value !== null)
  if (present.length < 2) {
    return <div className="sparkline sparkline--empty">Ainda sem dados que cheguem</div>
  }

  const all = [...present, ...(overlay ?? []).filter((v): v is number => v !== null)]
  const min = Math.min(...all)
  const max = Math.max(...all)
  const span = max - min || 1
  const width = 100

  const toPath = (series: (number | null)[]) => {
    const points: string[] = []
    series.forEach((value, index) => {
      if (value === null) return
      const x = (index / (series.length - 1)) * width
      const y = height - ((value - min) / span) * (height - 8) - 4
      points.push(`${points.length === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
    })
    return points.join(' ')
  }

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ height }}
      role="img"
      aria-label={label ?? 'Evolução'}
    >
      <path className="sparkline__line" d={toPath(values)} />
      {overlay && <path className="sparkline__overlay" d={toPath(overlay)} />}
    </svg>
  )
}
