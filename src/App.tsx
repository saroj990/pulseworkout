import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AppShell } from './components/AppShell'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { DashboardPage } from './pages/DashboardPage'
import { LogWorkoutPage } from './pages/LogWorkoutPage'
import { HistoryPage, WorkoutDetailPage } from './pages/HistoryPage'
import { GoalsPage } from './pages/GoalsPage'
import { SettingsPage } from './pages/SettingsPage'
import { PlansPage } from './pages/PlansPage'
import { WaterPage } from './pages/WaterPage'

function Protected({ children }: { children: React.ReactNode }) {
  const { user, preferences, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="font-display text-xl font-bold text-[var(--brand)]">Pulse</div>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (!preferences?.onboardingDone) return <Navigate to="/onboarding" replace />
  return children
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, preferences, loading } = useAuth()
  if (loading) return null
  if (user && !preferences?.onboardingDone) return <Navigate to="/onboarding" replace />
  if (user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnly>
              <LoginPage />
            </PublicOnly>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnly>
              <RegisterPage />
            </PublicOnly>
          }
        />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route
          element={
            <Protected>
              <AppShell />
            </Protected>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/log" element={<LogWorkoutPage />} />
          <Route path="/water" element={<WaterPage />} />
          <Route path="/plans" element={<PlansPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/history/:id" element={<WorkoutDetailPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
