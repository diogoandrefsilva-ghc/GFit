/*
 * A barra de estado, o indicador do fundo e o espaço que o ecrã tem de lhes
 * deixar.
 *
 * Com `viewport-fit=cover` a página passa por baixo dos dois, e é o
 * `env(safe-area-inset-*)` que diz quanto espaço reservar. Na app instalada no
 * ecrã principal há iOS que devolvem zero a essa medida — e então o nome do
 * aluno e o título do plano vão parar debaixo das horas, como se vê no
 * editor de planos. Aqui mede-se o que o sistema responde e, se vier a zero
 * com a app instalada, assume-se a barra em vez de a ignorar.
 */

/** Entalhe ou ilha dinâmica. */
const NOTCH_TOP = 54
const NOTCH_BOTTOM = 34
const LANDSCAPE_BOTTOM = 21

/** Telemóvel com botão: barra de estado clássica e nada no fundo. */
const PLAIN_TOP = 20
const PLAIN_BOTTOM = 0

/** Lado mais comprido a partir do qual um ecrã é de certeza sem botão. */
const NOTCH_MIN_SIDE = 812

function isInstalled(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** O que o browser responde a `env(safe-area-inset-*)`, em pixels. */
function measured(): { top: number; bottom: number } {
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;top:0;left:0;width:0;visibility:hidden;pointer-events:none;' +
    'padding-top:env(safe-area-inset-top,0px);' +
    'padding-bottom:env(safe-area-inset-bottom,0px);'
  document.body.appendChild(probe)
  const style = window.getComputedStyle(probe)
  const top = Number.parseFloat(style.paddingTop) || 0
  const bottom = Number.parseFloat(style.paddingBottom) || 0
  probe.remove()
  return { top, bottom }
}

/** Deitado a barra de estado sai da frente; o resto depende do feitio do ecrã. */
function assumed(): { top: number; bottom: number } {
  const landscape = window.innerWidth > window.innerHeight
  const notched = Math.max(window.screen.width, window.screen.height) >= NOTCH_MIN_SIDE

  if (!notched) return { top: landscape ? 0 : PLAIN_TOP, bottom: PLAIN_BOTTOM }
  // Deitado, o indicador do fundo passa a uma risca mais fina.
  return landscape
    ? { top: 0, bottom: LANDSCAPE_BOTTOM }
    : { top: NOTCH_TOP, bottom: NOTCH_BOTTOM }
}

function apply(): void {
  const root = document.documentElement
  const real = measured()

  // Fora da app instalada — ou quando o sistema dá mesmo a medida — manda o
  // `env()` do CSS, que é sempre mais fiável do que qualquer palpite nosso.
  if (!isInstalled() || real.top > 0) {
    root.style.removeProperty('--safe-top')
    root.style.removeProperty('--safe-bottom')
    return
  }

  const guess = assumed()
  root.style.setProperty('--safe-top', `${guess.top}px`)
  root.style.setProperty('--safe-bottom', `${Math.max(real.bottom, guess.bottom)}px`)
}

export function watchSafeArea(): void {
  apply()
  window.addEventListener('resize', apply)
  window.addEventListener('orientationchange', apply)
}
