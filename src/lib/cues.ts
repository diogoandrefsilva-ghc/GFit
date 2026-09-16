/**
 * Sinais de transição do treino guiado.
 *
 * O som é gerado pelo browser em vez de vir de ficheiros: não há nada para
 * descarregar, funciona sem rede e não engorda a app. O iOS só deixa tocar som
 * depois de um toque do utilizador, por isso o contexto abre-se no "Começar".
 */

let context: AudioContext | null = null

export function primeAudio(): void {
  if (context) {
    if (context.state === 'suspended') void context.resume()
    return
  }
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (Ctor) context = new Ctor()
  } catch {
    context = null
  }
}

function beep(frequency: number, seconds: number, delay = 0): void {
  if (!context) return
  try {
    const start = context.currentTime + delay
    const oscillator = context.createOscillator()
    const gain = context.createGain()

    oscillator.frequency.value = frequency
    oscillator.type = 'sine'

    // Uma subida e descida rápidas evitam o estalido de um som que corta a seco.
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(0.32, start + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds)

    oscillator.connect(gain).connect(context.destination)
    oscillator.start(start)
    oscillator.stop(start + seconds + 0.02)
  } catch {
    // Sem som é apenas menos cómodo, não é um erro que valha a pena mostrar.
  }
}

function buzz(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // O Safari do iOS não vibra. Fica só o som.
  }
}

/** Contagem decrescente dos últimos segundos. */
export function cueTick(): void {
  beep(660, 0.08)
  buzz(30)
}

/** Começou o trabalho. */
export function cueStart(): void {
  beep(880, 0.16)
  buzz([0, 60, 40, 60])
}

/** Acabou o trabalho, vem descanso. */
export function cueRest(): void {
  beep(440, 0.2)
  buzz(80)
}

/** Treino terminado. */
export function cueFinish(): void {
  beep(660, 0.14)
  beep(880, 0.14, 0.16)
  beep(1100, 0.3, 0.32)
  buzz([0, 100, 60, 100, 60, 200])
}
