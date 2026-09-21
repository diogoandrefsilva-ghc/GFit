import { useEffect, type ReactNode } from 'react'
import './sheet.css'

/**
 * Um painel que sobe do fundo com o ecrã ainda à vista por trás. É o gesto de
 * registar qualquer coisa nesta app: o que se está a mudar fica grande no meio
 * do painel, e sai-se pelo "Pronto", pelo fundo ou pelo Escape.
 *
 * Vive à parte de quem o usa porque são vários — os números de um exercício no
 * editor de planos, o peso e o sono no Hoje — e o painel é o mesmo em todos.
 */
export function Sheet({
  title,
  caption,
  done = 'Pronto',
  onClose,
  children,
}: {
  title: string
  caption?: string
  /** O que diz o botão de saída. */
  done?: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)

    // Sem isto o ecrã continua a deslizar por trás do painel.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  return (
    <div className="sheet" role="dialog" aria-label={title}>
      <button
        type="button"
        className="sheet__scrim"
        onClick={onClose}
        aria-label="Fechar"
      />
      <div className="sheet__panel">
        <div className="sheet__grip" />
        <div className="sheet__head">
          <span className="sheet__text">
            <strong className="sheet__title">{title}</strong>
            {caption && <em className="sheet__caption">{caption}</em>}
          </span>
          <button type="button" className="btn btn--sm btn--quiet" onClick={onClose}>
            {done}
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
