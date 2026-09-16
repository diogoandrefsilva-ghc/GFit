import { useCallback, useEffect, useRef, useState } from 'react'
import { describeError } from './supabase'

interface State<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/**
 * Carregamento de dados sem trazer uma biblioteca inteira para uma app deste
 * tamanho: corre a consulta, guarda o resultado e dá um `reload()`.
 *
 * `deps` é a lista de dependências, como no useEffect.
 */
export function useQuery<T>(
  run: () => Promise<T>,
  deps: unknown[] = [],
): State<T> & { reload: () => void; setData: (value: T) => void } {
  const [state, setState] = useState<State<T>>({
    data: null,
    loading: true,
    error: null,
  })

  // Uma consulta lenta que chegue depois de outra mais recente não pode
  // sobrepor-se ao resultado bom.
  const generation = useRef(0)
  const runRef = useRef(run)
  runRef.current = run

  const load = useCallback(() => {
    const mine = ++generation.current
    setState((previous) => ({ ...previous, loading: true, error: null }))

    runRef.current()
      .then((data) => {
        if (mine === generation.current) setState({ data, loading: false, error: null })
      })
      .catch((caught) => {
        if (mine === generation.current) {
          setState({ data: null, loading: false, error: describeError(caught) })
        }
      })
  }, [])

  useEffect(() => {
    load()
    const counter = generation
    return () => {
      // Ao desmontar, invalida o pedido em curso para não haver setState tardio.
      counter.current++
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  const setData = useCallback((value: T) => {
    setState({ data: value, loading: false, error: null })
  }, [])

  return { ...state, reload: load, setData }
}

/**
 * Levanta o erro do PostgREST para o useQuery o apanhar, e devolve os dados já
 * sem o `null` que só lá está para o caso de erro.
 */
export function unwrap<T>({ data, error }: { data: T; error: unknown }): NonNullable<T> {
  if (error) throw error
  return data as NonNullable<T>
}
