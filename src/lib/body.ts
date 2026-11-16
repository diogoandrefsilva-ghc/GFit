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

type Cut = 'full' | 'plain'
type Shape = 'm' | 'f'

const views: Partial<Record<`${BodyView}:${Cut}:${Shape}`, string>> = {}
let inView: Record<BodyView, Set<string>> | null = null

/**
 * O SVG entra como texto e é partido nas duas vistas. Tem de ficar inline no
 * DOM — com `<img src>` o CSS da app não lhe chegava e não havia como pintar
 * nada.
 *
 * Só vai para o DOM a silhueta que se vai ver. O ficheiro traz as duas, e cada
 * músculo desenhado para uma e para outra; escondida por CSS, a que não se vê
 * custava na mesma a criar. Em `plain` saem também as linhas anatómicas, que
 * em miniatura já não se viam. Numa lista de 120 exercícios é a diferença
 * entre a lista aparecer e a lista demorar.
 */
export function markup(view: BodyView, cut: Cut = 'full', sex?: BodySex): string {
  const shape: Shape = sex === 'F' ? 'f' : 'm'
  const other: Shape = shape === 'f' ? 'm' : 'f'
  const key = `${view}:${cut}:${shape}` as const
  const cached = views[key]
  if (cached !== undefined) return cached

  const doc = new DOMParser().parseFromString(raw, 'image/svg+xml')
  const group = doc.querySelector(`[id="${view === 'front' ? 'body-front' : 'body-back'}"]`)
  if (!group) return ''
  group
    .querySelectorAll(`.gfit-v-${other}, .gfit-hair--${other}`)
    .forEach((node) => node.remove())
  if (cut === 'plain') {
    group.querySelectorAll('.gfit-detail').forEach((node) => node.remove())
  }
  const html = group.innerHTML
  views[key] = html
  return html
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
