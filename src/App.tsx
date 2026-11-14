import { useState } from 'react'
import './App.css'
import { LayoutShell } from './components/LayoutShell'
import { AuthPage } from './pages/AuthPage'
import { CreateBatchPage } from './pages/CreateBatchPage'
import { OverviewPage } from './pages/OverviewPage'
import { VestingPage } from './pages/VestingPage'
import { RoleManagementPage } from './pages/RoleManagementPage'
import type { AppRoute } from './types/app'
import { MotionDemo } from './motion/MotionDemo'
import { AnimatePresence } from 'motion/react'
import { PageTransition } from './motion/primitives'
import { useAuth } from './features/auth/useAuth'

function App() {
  const [route, setRoute] = useState<AppRoute>('overview')
  const { loading, session, error, roles, hasRole } = useAuth()
  const canCreateBatch = hasRole('company_admin')
  const canViewOverview = hasRole('company_admin') || hasRole('hr_operator') || hasRole('auditor')
  const canViewVesting = hasRole('company_admin') || hasRole('hr_operator') || hasRole('employee') || roles.length === 0
  const canManageRoles = hasRole('company_admin')

  if (import.meta.env.DEV && window.location.search.includes('motion-demo')) {
    return <MotionDemo />
  }

  if (loading) return <div className="auth-page"><p className="muted">Loading session...</p></div>

  if (!session) {
    return <AuthPage mode="login" error={error} />
  }

  const activeRoute = route === 'create-batch' && !canCreateBatch
    ? (canViewOverview ? 'overview' : 'my-vesting')
    : route === 'role-management' && !canManageRoles
      ? (canViewOverview ? 'overview' : 'my-vesting')
      : route === 'overview' && !canViewOverview
        ? (canViewVesting ? 'my-vesting' : 'overview')
        : route === 'my-vesting' && !canViewVesting
          ? 'overview'
          : route
  const page =
    activeRoute === 'login' || activeRoute === 'sign-up' ? (
      <AuthPage mode={activeRoute} />
    ) : (
      <LayoutShell route={activeRoute} onNavigate={setRoute}>
        {activeRoute === 'overview' && <OverviewPage />}
        {activeRoute === 'my-vesting' && <VestingPage />}
        {activeRoute === 'create-batch' && <CreateBatchPage />}
        {activeRoute === 'role-management' && <RoleManagementPage />}
      </LayoutShell>
    )

  return (
    <AnimatePresence mode="wait" initial={false}>
      <PageTransition key={activeRoute}>{page}</PageTransition>
    </AnimatePresence>
  )
}

export default App
