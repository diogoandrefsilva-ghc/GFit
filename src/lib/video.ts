/**
 * Reprodução de vídeo dentro da app.
 *
 * Os vídeos da base são links do YouTube de terceiros. Alojá-los seria violar
 * direitos de autor, por isso usa-se o leitor do YouTube — mas embebido numa
 * janela por cima do treino, em vez de atirar o aluno para fora da app a meio
 * de uma série.
 *
 * O domínio nocookie evita o rastreio antes de a pessoa tocar em play.
 */

/** Extrai o identificador do vídeo dos formatos que a base tem. */
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null

  const patterns = [
    /youtu\.be\/([\w-]{6,})/, //            youtu.be/WcUsU8gNmGI
    /youtube\.com\/shorts\/([\w-]{6,})/, // youtube.com/shorts/pXQojCQjmZA
    /youtube\.com\/embed\/([\w-]{6,})/, //  youtube.com/embed/ID
    /[?&]v=([\w-]{6,})/, //                 youtube.com/watch?v=ID
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

/**
 * URL para o iframe.
 *
 * `playsinline` é o que impede o iOS de tomar conta do ecrã inteiro, `rel=0`
 * limita as sugestões do fim ao mesmo canal, e `modestbranding` reduz o
 * logótipo.
 */
export function youtubeEmbedUrl(
  url: string | null | undefined,
  { autoplay = false } = {},
): string | null {
  const id = youtubeId(url)
  if (!id) return null

  const params = new URLSearchParams({
    playsinline: '1',
    rel: '0',
    modestbranding: '1',
    autoplay: autoplay ? '1' : '0',
  })
  return `https://www.youtube-nocookie.com/embed/${id}?${params}`
}

export function hasPlayableVideo(url: string | null | undefined): boolean {
  return youtubeId(url) !== null
}
