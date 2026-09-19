/**
 * Escolha de um entre poucos. Ao contrário das etiquetas soltas, o carril
 * fechado diz de relance quantas hipóteses há e que só uma vale de cada vez.
 */
export function Segmented<T extends string | null>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: readonly (readonly [T, string])[]
  onChange: (value: T) => void
  label?: string
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map(([option, text]) => (
        <button
          key={String(option)}
          type="button"
          className={`segmented__opt ${option === value ? 'is-on' : ''}`}
          aria-pressed={option === value}
          onClick={() => option !== value && onChange(option)}
        >
          {text}
        </button>
      ))}
    </div>
  )
}
