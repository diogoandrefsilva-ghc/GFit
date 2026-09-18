import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { AppBar } from '@/components/AppBar'
import { TabBar, type Tab } from '@/components/TabBar'
import { whenIdle } from '@/lib/idle'

const TABS: Tab[] = [
  { to: '/hoje', label: 'Hoje', icon: 'today' },
  { to: '/treino', label: 'Treino', icon: 'workout' },
  { to: '/dieta', label: 'Dieta', icon: 'plate' },
  { to: '/medidas', label: 'Medidas', icon: 'ruler' },
  { to: '/semana', label: 'Semana', icon: 'week' },
  { to: '/perfil', label: 'Perfil', icon: 'person' },
]

export function AthleteShell() {
  // O treino a decorrer e o perfil vivem no seu chunk: trazê-los enquanto a
  // app está parada evita a espera no toque, já dentro do ginásio.
  useEffect(
    () =>
      whenIdle(() => {
        import('@/athlete/WorkoutSession').catch(() => {})
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
