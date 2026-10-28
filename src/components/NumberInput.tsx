import { useEffect, useState } from 'react'
import { num, parseDecimal } from '@/lib/format'

/**
 * Um campo de número que aceita vírgula. O `type="number"` do browser não a
 * aceita em metade dos telemóveis — o valor chega vazio e o que se escreveu
 * desaparece ao gravar —, e o teclado numérico do iPhone nem sequer a mostra.
 *
 * Guarda o texto tal como se escreve ("72," a meio de "72,5") e só entrega o
 * número ao formulário.
 */
export function NumberInput({
  value,
  onChange,
  decimals = 1,
  placeholder,
  ariaLabel,
}: {
  value: number | null | undefined
  onChange: (value: number | null) => void
  /** Casas decimais aceites. Zero pede o teclado sem vírgula. */
  decimals?: number
  placeholder?: string
  ariaLabel?: string
}) {
  const show = (current: number | null | undefined) =>
    current === null || current === undefined
      ? ''
      : num(Number(current), decimals).replace(/,0+$/, '')

  const [text, setText] = useState(() => show(value))

  // Quem muda o valor por fora (um cálculo, outra revisão) manda no campo,
  // desde que não seja o mesmo número que já lá está escrito.
  useEffect(() => {
    setText((current) => (parseDecimal(current) === (value ?? null) ? current : show(value)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <input
      className="input"
      type="text"
      inputMode={decimals > 0 ? 'decimal' : 'numeric'}
      autoComplete="off"
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={text}
      onChange={(event) => {
        const next = event.target.value
        setText(next)
        const parsed = parseDecimal(next)
        onChange(
          parsed === null
            ? null
            : decimals > 0
              ? Math.round(parsed * 10 ** decimals) / 10 ** decimals
              : Math.round(parsed),
        )
      }}
      onBlur={() => setText(show(value))}
    />
  )
}
