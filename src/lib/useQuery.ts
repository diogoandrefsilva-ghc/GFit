import { useCallback, useEffect, useRef, useState } from 'react'
import { readCache, writeCache } from './cache'
import { describeError } from './supabase'

interface State<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export interface QueryResult<T> extends State<T> {
  /** Relê do servidor sem tirar do ecrã o que lá está. */
  reload: () => void
  /** Substitui o que está no ecrã já, antes de o servidor confirmar. */
  mutate: (update: T | ((current: T) => T)) => void
  /** Há uma leitura a decorrer por baixo do que já se vê. */
  refreshing: boolean
}

interface Options {
  /**
   * `false` para o que não vale a pena guardar em disco entre arranques —
   * resultados de pesquisa, que mudam a cada letra escrita.
   */
  persist?: boolean
}

/**
 * Carregamento de dados sem trazer uma biblioteca inteira para uma app deste
 * tamanho.
 *
 * O que manda é o cache: se já se sabe a resposta, ela aparece no primeiro
 * render e a consulta corre por baixo para confirmar. `loading` só é `true`
 * quando não há mesmo nada para mostrar — é o que evita o spinner a tapar o
 * ecrã de cada vez que se toca num separador ou se grava alguma coisa.
 *
 * `key` identifica a consulta e faz de lista de dependências: muda a chave,
 * corre outra vez.
 */
export function useQuery<T>(
  key: unknown[],
  run: () => Promise<T>,
  options: Options = {},
): QueryResult<T> {
  const persist = options.persist ?? true
  const cacheKey = JSON.stringify(key)

  const [state, setState] = useState<State<T>>(() => {
    const cached = readCache<T>(cacheKey)
    return cached === undefined
      ? { data: null, loading: true, error: null }
      : { data: cached, loading: false, error: null }
  })
  const [refreshing, setRefreshing] = useState(false)

  // Uma consulta lenta que chegue depois de outra mais recente não pode
  // sobrepor-se ao resultado bom.
  const generation = useRef(0)
  const runRef = useRef(run)
  runRef.current = run
  const keyRef = useRef(cacheKey)
  keyRef.current = cacheKey
  const persistRef = useRef(persist)
  persistRef.current = persist

  const load = useCallback(() => {
    const mine = ++generation.current
    const forKey = keyRef.current
    setRefreshing(true)

    runRef.current()
      .then((data) => {
        writeCache(forKey, data, persistRef.current)
        if (mine !== generation.current) return
        setState({ data, loading: false, error: null })
        setRefreshing(false)
      })
      .catch((caught) => {
        if (mine !== generation.current) return
        setRefreshing(false)
        // Falhar a confirmar não apaga o que já se via: sem rede, a app
        // continua a mostrar o que sabe. O erro só toma conta do ecrã quando
        // não há nada para mostrar.
        setState((previous) =>
          previous.data === null
            ? { data: null, loading: false, error: describeError(caught) }
            : previous,
        )
      })
  }, [])

  const settled = useRef(cacheKey)

  useEffect(() => {
    // Na primeira montagem o estado já saiu do cache; só quando a chave muda
    // (outro aluno, outra semana) é que há outro ponto de partida a pôr.
    if (settled.current !== cacheKey) {
      settled.current = cacheKey
      const cached = readCache<T>(cacheKey)
      setState(
        cached === undefined
          ? { data: null, loading: true, error: null }
          : { data: cached, loading: false, error: null },
      )
    }
    load()

    const counter = generation
    return () => {
      // Ao desmontar, invalida o pedido em curso para não haver setState tardio.
      counter.current++
    }
  }, [cacheKey, load])

  const mutate = useCallback(
    (update: T | ((current: T) => T)) => {
      setState((previous) => {
        if (previous.data === null) return previous
        const next =
          typeof update === 'function'
            ? (update as (current: T) => T)(previous.data)
            : update
        writeCache(keyRef.current, next, persistRef.current)
        return { data: next, loading: false, error: null }
      })
    },
    [],
  )

  return { ...state, refreshing, reload: load, mutate }
}

/**
 * Levanta o erro do PostgREST para o useQuery o apanhar, e devolve os dados já
 * sem o `null` que só lá está para o caso de erro.
 */
export function unwrap<T>({ data, error }: { data: T; error: unknown }): NonNullable<T> {
  if (error) throw error
  return data as NonNullable<T>
}
