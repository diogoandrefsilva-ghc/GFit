import { useEffect } from 'react'
import { youtubeEmbedUrl } from '@/lib/video'
import './video-modal.css'

/**
 * O vídeo do exercício sem sair da app. Fecha-se com o botão, com o fundo ou
 * com Escape — a meio de um treino ninguém quer andar à procura da saída.
 */
export function VideoModal({
  url,
  title,
  onClose,
}: {
  url: string | null
  title: string
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)

    // Sem isto a página por baixo continua a deslizar enquanto o vídeo corre.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  const embed = youtubeEmbedUrl(url, { autoplay: true })

  return (
    <div className="video" role="dialog" aria-label={`Vídeo: ${title}`}>
      <button
        type="button"
        className="video__scrim"
        onClick={onClose}
        aria-label="Fechar vídeo"
      />
      <div className="video__sheet">
        <div className="video__head">
          <h2 className="video__title">{title}</h2>
          <button type="button" className="video__close" onClick={onClose}>
            Fechar
          </button>
        </div>

        {embed ? (
          <div className="video__frame">
            <iframe
              src={embed}
              title={title}
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        ) : (
          <p className="video__missing">Este exercício ainda não tem vídeo.</p>
        )}
      </div>
    </div>
  )
}
