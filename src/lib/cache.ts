/**
 * Cache dos dados lidos do servidor.
 *
 * A app deixa de ir buscar tudo de novo a cada ecrã: o que já foi lido fica em
 * memória enquanto a app está aberta, e no `localStorage` para sobreviver a
 * fechá-la. Ao voltar a um separador mostra-se logo o que se sabe e confirma-se
 * com o servidor por baixo — em vez de um spinner à frente de dados que já
 * tínhamos.
 *
 * O cache é por utilizador (`setScope`) e esvazia-se ao terminar a sessão: num
 * telemóvel partilhado, quem entra a seguir não vê os dados de quem saiu.
 */

const PREFIX = 'gfit.cache.v1.'

/** Uma entrada mais velha do que isto já não se mostra: relê-se primeiro. */
const MAX_AGE = 7 * 24 * 60 * 60 * 1000

/** Um payload grande (a biblioteca de exercícios inteira) não vai para disco. */
const MAX_ENTRY_BYTES = 192 * 1024

interface Entry {
  at: number
  data: unknown
}

let scope: string | null = null
const memory = new Map<string, Entry>()

/**
 * As consultas devolvem `Map`s montados a partir do PostgREST; o JSON puro
 * perdia-os pelo caminho.
 */
function replacer(_key: string, value: unknown) {
  if (value instanceof Map) return { __gfit: 'Map', entries: [...value] }
  if (value instanceof Set) return { __gfit: 'Set', entries: [...value] }
  return value
}

function reviver(_key: string, value: unknown) {
  if (value && typeof value === 'object' && '__gfit' in value) {
    const wrapped = value as { __gfit: string; entries: [] }
    if (wrapped.__gfit === 'Map') return new Map(wrapped.entries)
    if (wrapped.__gfit === 'Set') return new Set(wrapped.entries)
  }
  return value
}

function diskKey(key: string) {
  return `${PREFIX}${scope}::${key}`
}

/**
 * O `localStorage` pode estar fechado (modo privado, permissões): sem ele a
 * app continua a funcionar, só perde o cache entre arranques.
 */
function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * Diz de quem são os dados em cache. Ao mudar de utilizador — ou ao sair —
 * limpa o que ficou do anterior.
 */
export function setScope(next: string | null) {
  if (next === scope) return
  memory.clear()
  if (scope !== null) forgetDisk(scope)
  scope = next
}

function forgetDisk(which: string) {
  const store = storage()
  if (!store) return
  const start = `${PREFIX}${which}::`
  const doomed: string[] = []
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i)
    if (key && key.startsWith(start)) doomed.push(key)
  }
  doomed.forEach((key) => store.removeItem(key))
}

/** Esvazia tudo o que a app guardou, de qualquer utilizador. */
export function clearCache() {
  memory.clear()
  const store = storage()
  if (!store) return
  const doomed: string[] = []
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i)
    if (key && key.startsWith(PREFIX)) doomed.push(key)
  }
  doomed.forEach((key) => store.removeItem(key))
}

export function readCache<T>(key: string): T | undefined {
  if (scope === null) return undefined

  const held = memory.get(key)
  if (held) return held.data as T

  const store = storage()
  if (!store) return undefined

  const raw = store.getItem(diskKey(key))
  if (!raw) return undefined

  try {
    const entry = JSON.parse(raw, reviver) as Entry
    if (Date.now() - entry.at > MAX_AGE) {
      store.removeItem(diskKey(key))
      return undefined
    }
    memory.set(key, entry)
    return entry.data as T
  } catch {
    // Entrada de uma versão anterior da app, ou meia escrita: deitar fora.
    store.removeItem(diskKey(key))
    return undefined
  }
}

export function writeCache(key: string, data: unknown, persist = true) {
  if (scope === null) return

  const entry: Entry = { at: Date.now(), data }
  memory.set(key, entry)
  if (!persist) return

  const store = storage()
  if (!store) return

  try {
    const raw = JSON.stringify(entry, replacer)
    if (raw.length > MAX_ENTRY_BYTES) return
    store.setItem(diskKey(key), raw)
  } catch {
    // Quota cheia: largar o que está em disco e ficar só com a memória. Da
    // próxima escrita já cabe.
    forgetDisk(scope)
  }
}
