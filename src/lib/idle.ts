/**
 * Corre uma tarefa quando o browser estiver parado — e, se não houver
 * `requestIdleCallback` (Safari mais antigo, que é meio parque de telemóveis),
 * pouco depois. Devolve a função que cancela.
 */
export function whenIdle(task: () => void, timeout = 2000): () => void {
  const idle = window.requestIdleCallback
  if (typeof idle === 'function') {
    const handle = idle(task, { timeout })
    return () => window.cancelIdleCallback?.(handle)
  }
  const handle = window.setTimeout(task, 300)
  return () => window.clearTimeout(handle)
}
