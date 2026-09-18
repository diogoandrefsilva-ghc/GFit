import raw from '@/assets/corpo-gfit.svg?raw'

export type BodyView = 'front' | 'back'
export type BodySex = 'M' | 'F' | null | undefined

/**
 * Os 15 grupos desenhados no `corpo-gfit.svg`. São, de propósito, exactamente
 * os slugs da tabela `gfit.muscles`: o que o exercício diz que trabalha é o
 * que o corpo acende, sem tabela de conversão pelo meio.
 */
export const BODY_MUSCLES = [
  'abs',
  'adutores',
  'biceps',
  'dorsal',
  'gemeos',
  'gluteo',
  'lombares',
  'ombro_frontal',
  'ombro_medio',
  'ombro_posterior',
  'peito',
  'posterior_de_coxa',
  'quadriceps',
  'trapezio',
  'triceps',
] as const

/** As duas vistas vivem no mesmo ficheiro, nas mesmas coordenadas locais. */
export const VIEW_BOX = '-10 0 220 460'

let views: Record<BodyView, string> | null = null
let inView: Record<BodyView, Set<string>> | null = null

/**
 * O SVG entra como texto e é partido uma vez nas duas vistas. Tem de ficar
 * inline no DOM — com `<img src>` o CSS da app não lhe chegava e não havia
 * como pintar nada.
 */
export function markup(view: BodyView): string {
  if (!views) {
    const doc = new DOMParser().parseFromString(raw, 'image/svg+xml')
    const inner = (id: string) =>
      doc.querySelector(`[id="${id}"]`)?.innerHTML ?? ''
    views = { front: inner('body-front'), back: inner('body-back') }
  }
  return views[view]
}

/**
 * Que grupos é que cada vista desenha. Sai do próprio ficheiro em vez de uma
 * lista à parte: se o desenho mudar de mãos, isto acompanha sozinho.
 */
export function musclesInView(view: BodyView): Set<string> {
  if (!inView) {
    const doc = new DOMParser().parseFromString(raw, 'image/svg+xml')
    const slugs = (id: string) =>
      new Set(
        [...(doc.querySelector(`[id="${id}"]`)?.querySelectorAll('[data-muscle]') ?? [])]
          .map((node) => node.getAttribute('data-muscle') ?? '')
          .filter(Boolean),
      )
    inView = { front: slugs('body-front'), back: slugs('body-back') }
  }
  return inView[view]
}

/**
 * A vista que melhor mostra um exercício: a que soma mais peso muscular.
 * `trapezio` e `ombro_medio` estão nas duas, por isso não desempatam.
 */
export function bestView(weights: Map<string, number>): BodyView {
  let front = 0
  let back = 0
  for (const [slug, weight] of weights) {
    if (musclesInView('front').has(slug)) front += weight
    if (musclesInView('back').has(slug)) back += weight
  }
  return back > front ? 'back' : 'front'
}
