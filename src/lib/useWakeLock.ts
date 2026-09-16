import { useEffect, useRef } from 'react'

interface WakeLockSentinel {
  release: () => Promise<void>
}

/**
 * Mantém o ecrã aceso enquanto o treino corre.
 *
 * Sem isto o telemóvel adormece a meio de uma prancha e a pessoa perde a
 * contagem. Onde não houver suporte (iOS anterior ao 16.4), não acontece nada —
 * o treino funciona na mesma.
 */
export function useWakeLock(active: boolean): void {
  const sentinel = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!active) return

    const api = (
      navigator as unknown as {
        wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> }
      }
    ).wakeLock
    if (!api) return

    let cancelled = false

    const acquire = async () => {
      try {
        const lock = await api.request('screen')
        if (cancelled) {
          void lock.release()
          return
        }
        sentinel.current = lock
      } catch {
        // Negado ou indisponível: segue sem bloqueio.
      }
    }

    void acquire()

    // Trocar de app liberta o bloqueio; ao voltar, pede-se outra vez.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !cancelled) void acquire()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel.current?.release()
      sentinel.current = null
    }
  }, [active])
}
