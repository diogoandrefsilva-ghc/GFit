/*
 * A barra de estado, o indicador do fundo e o espaço que o ecrã tem de lhes
 * deixar.
 *
 * Com `viewport-fit=cover` a página pode passar por baixo dos dois, e é o
 * `env(safe-area-inset-*)` que diz quanto espaço reservar. Na app instalada no
 * ecrã principal há iOS que devolvem zero a essa medida mesmo com a página a
 * passar por baixo das horas — e então o nome do aluno e o título do plano vão
 * parar debaixo delas. Aqui mede-se o que o sistema responde e, quando vier a
 * zero a enganar, assume-se a barra em vez de a ignorar.
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

/** Arredondamentos entre a janela e o ecrã que não querem dizer nada. */
const SLACK = 8

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

/**
 * A página passa por baixo da barra de estado, ou já começa por baixo dela?
 *
 * Com `apple-mobile-web-app-status-bar-style` em `default` — o que a GFit usa —
 * o iOS entrega à app instalada uma janela que arranca debaixo das horas, e
 * responde zero ao `env()` porque não há mesmo nada a reservar. Reservar a
 * barra à mesma era o que fazia o cabeçalho crescer uma barra de estado
 * inteira. A diferença está na altura: só quem passa por baixo é tão alto
 * como o ecrã.
 */
function coversScreen(): boolean {
  const landscape = window.innerWidth > window.innerHeight
  const long = Math.max(window.screen.width, window.screen.height)
  const short = Math.min(window.screen.width, window.screen.height)
  return window.innerHeight >= (landscape ? short : long) - SLACK
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

/*
 * Medido à partida e a cada rotação, nunca quando o teclado sobe: com o
 * teclado aberto a janela encolhe e isto diria que a página já não chega ao
 * topo do ecrã, tirando o espaço à barra a meio de se escrever.
 */
let underStatusBar = false

function apply(): void {
  const root = document.documentElement
  const real = measured()

  // Fora da app instalada, quando o sistema dá mesmo a medida, ou quando a
  // janela nem chega ao topo do ecrã — aí o zero é a resposta certa —, manda o
  // `env()` do CSS, que é sempre mais fiável do que qualquer palpite nosso.
  if (!isInstalled() || real.top > 0 || !underStatusBar) {
    root.style.removeProperty('--safe-top')
    root.style.removeProperty('--safe-bottom')
    return
  }

  const guess = assumed()
  root.style.setProperty('--safe-top', `${guess.top}px`)
  root.style.setProperty('--safe-bottom', `${Math.max(real.bottom, guess.bottom)}px`)
}

/** A janela só muda de tamanho depois do evento da rotação. */
function remeasure(): void {
  window.setTimeout(() => {
    underStatusBar = coversScreen()
    apply()
  }, 0)
}

export function watchSafeArea(): void {
  underStatusBar = coversScreen()
  apply()
  window.addEventListener('resize', apply)
  window.addEventListener('orientationchange', remeasure)
}
