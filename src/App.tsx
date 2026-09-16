import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { Login } from '@/auth/Login'
import { AwaitingInvite } from '@/auth/AwaitingInvite'
import { Loading } from '@/components/Screen'
import { AthleteShell } from '@/athlete/AthleteShell'
import { Today } from '@/athlete/Today'
import { WorkoutHome } from '@/athlete/WorkoutHome'
import { Measurements } from '@/athlete/Measurements'
import { Diet } from '@/athlete/Diet'
import { WeeklyFeedbackScreen } from '@/athlete/WeeklyFeedback'

// O treino a decorrer e os ecrãs do treinador só se carregam quando fazem
// falta: um aluno nunca chega a descarregar os editores de plano e de dieta.
const WorkoutSession = lazy(() =>
  import('@/athlete/WorkoutSession').then((m) => ({ default: m.WorkoutSession })),
)
const CoachShell = lazy(() =>
  import('@/coach/CoachShell').then((m) => ({ default: m.CoachShell })),
)
const Athletes = lazy(() =>
  import('@/coach/Athletes').then((m) => ({ default: m.Athletes })),
)
const AthleteDetail = lazy(() =>
  import('@/coach/AthleteDetail').then((m) => ({ default: m.AthleteDetail })),
)
const PlanEditor = lazy(() =>
  import('@/coach/PlanEditor').then((m) => ({ default: m.PlanEditor })),
)
const DietEditor = lazy(() =>
  import('@/coach/DietEditor').then((m) => ({ default: m.DietEditor })),
)
const ExerciseLibrary = lazy(() =>
  import('@/coach/ExerciseLibrary').then((m) => ({ default: m.ExerciseLibrary })),
)
const Profile = lazy(() =>
  import('@/shared/Profile').then((m) => ({ default: m.Profile })),
)

export function App() {
  const { session, profile, loading, error, isCoach, awaitingInvite } = useAuth()

  if (loading) {
    return (
      <div className="app">
        <Loading label="A carregar" />
      </div>
    )
  }

  if (!session) return <Login />

  if (error) {
    return (
      <div className="app">
        <div className="screen screen--plain">
          <p className="error-banner">{error}</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="app">
        <Loading label="A preparar o perfil" />
      </div>
    )
  }

  if (awaitingInvite) return <AwaitingInvite />

  return (
    <Suspense
      fallback={
        <div className="app">
          <Loading label="A carregar" />
        </div>
      }
    >
      {isCoach ? (
        <Routes>
          <Route element={<CoachShell />}>
            <Route path="/alunos" element={<Athletes />} />
            <Route path="/alunos/:athleteId" element={<AthleteDetail />} />
            <Route path="/exercicios" element={<ExerciseLibrary />} />
            <Route path="/perfil" element={<Profile />} />
          </Route>
          <Route path="/planos/:planId" element={<PlanEditor />} />
          <Route path="/dietas/:dietPlanId" element={<DietEditor />} />
          <Route path="*" element={<Navigate to="/alunos" replace />} />
        </Routes>
      ) : (
        <Routes>
          <Route element={<AthleteShell />}>
            <Route path="/hoje" element={<Today />} />
            <Route path="/treino" element={<WorkoutHome />} />
            <Route path="/medidas" element={<Measurements />} />
            <Route path="/dieta" element={<Diet />} />
            <Route path="/semana" element={<WeeklyFeedbackScreen />} />
            <Route path="/perfil" element={<Profile />} />
          </Route>
          <Route path="/treino/:sessionId" element={<WorkoutSession />} />
          <Route path="*" element={<Navigate to="/hoje" replace />} />
        </Routes>
      )}
    </Suspense>
  )
}
