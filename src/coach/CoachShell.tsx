import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { AppBar } from '@/components/AppBar'
import { TabBar, type Tab } from '@/components/TabBar'
import { whenIdle } from '@/lib/idle'

const TABS: Tab[] = [
  { to: '/inicio', label: 'Início', icon: 'today' },
  { to: '/alunos', label: 'Alunos', icon: 'people' },
  { to: '/calendario', label: 'Calendário', icon: 'calendar' },
  { to: '/exercicios', label: 'Exercícios', icon: 'library' },
  { to: '/perfil', label: 'Perfil', icon: 'person' },
]

export function CoachShell() {
  // Cada ecrã do treinador vive no seu chunk. Trazê-los enquanto a app está
  // parada faz com que o primeiro toque em cada separador não fique à espera
  // de um download.
  useEffect(
    () =>
      whenIdle(() => {
        import('@/coach/Dashboard').catch(() => {})
        import('@/coach/Athletes').catch(() => {})
        import('@/coach/Calendar').catch(() => {})
        import('@/coach/ExerciseLibrary').catch(() => {})
        import('@/shared/Profile').catch(() => {})
      }),
    [],
  )

  return (
    <div className="app">
      <AppBar />
      <Outlet />
      <TabBar tabs={TABS} />
    </div>
  )
}
