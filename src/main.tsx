import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { App } from './App'
import '@/styles/base.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* HashRouter: o GitHub Pages não reescreve rotas para o index.html. */}
    <HashRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
)
