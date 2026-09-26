import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { watchSafeArea } from '@/lib/safe-area'
import { applyTheme } from '@/lib/theme'
import { App } from './App'
import '@/styles/base.css'

// Depois de um deploy, os chunks lazy (ecrãs do treinador, sessão de treino,
// etc.) podem apontar para ficheiros que já não existem no servidor. O import
// dinâmico falha ("Importing a module script failed" no Safari) e a
// ErrorBoundary aparecia em vez de simplesmente ir buscar a versão atual.
// A flag evita entrar em loop caso o recarregar não resolva mesmo assim.
const RELOAD_AFTER_CHUNK_ERROR = 'gfit:reloaded-after-chunk-error'
const alreadyReloadedAfterChunkError =
  sessionStorage.getItem(RELOAD_AFTER_CHUNK_ERROR) === '1'
sessionStorage.removeItem(RELOAD_AFTER_CHUNK_ERROR)

window.addEventListener('vite:preloadError', () => {
  if (alreadyReloadedAfterChunkError) return
  sessionStorage.setItem(RELOAD_AFTER_CHUNK_ERROR, '1')
  window.location.reload()
})

// Antes de desenhar seja o que for: é isto que diz aos ecrãs quanto espaço
// deixar à barra de estado e ao indicador do fundo.
watchSafeArea()

// O `index.html` já pôs o tema na raiz; aqui junta-se a forma e as letras.
applyTheme()

const root = document.getElementById('root')!
root.innerHTML = '' // tira o ecrã de arranque do index.html

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      {/* HashRouter: o GitHub Pages não reescreve rotas para o index.html. */}
      <HashRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </HashRouter>
    </ErrorBoundary>
  </StrictMode>,
)
