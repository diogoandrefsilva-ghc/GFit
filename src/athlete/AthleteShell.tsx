import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { AppBar } from '@/components/AppBar'
import { TabBar, type Tab } from '@/components/TabBar'
import { whenIdle } from '@/lib/idle'

// Quatro, e não seis: as medidas e o feedback da semana são o Progresso, e o
// Perfil está no avatar da barra de cima, que é onde se procura.
const TABS: Tab[] = [
  { to: '/hoje', label: 'Hoje', icon: 'today' },
  { to: '/treino', label: 'Treino', icon: 'workout' },
  { to: '/dieta', label: 'Dieta', icon: 'plate' },
  { to: '/progresso', label: 'Progresso', icon: 'week' },
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
