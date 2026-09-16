import { Outlet } from 'react-router-dom'
import { TabBar, type Tab } from '@/components/TabBar'

const TABS: Tab[] = [
  { to: '/alunos', label: 'Alunos', icon: 'people' },
  { to: '/exercicios', label: 'Exercícios', icon: 'library' },
]

export function CoachShell() {
  return (
    <div className="app">
      <Outlet />
      <TabBar tabs={TABS} />
    </div>
  )
}
