import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { App } from './App'
import '@/styles/base.css'

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
