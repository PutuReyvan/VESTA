import { useState } from 'react'
import './App.css'
import { LayoutShell } from './components/LayoutShell'
import { AuthPage } from './pages/AuthPage'
import { LandingPage } from './pages/LandingPage'
import { CreateBatchPage } from './pages/CreateBatchPage'
import { OverviewPage } from './pages/OverviewPage'
import { VestingPage } from './pages/VestingPage'
import { RoleManagementPage } from './pages/RoleManagementPage'
import type { AppRoute } from './types/app'
import { MotionDemo } from './motion/MotionDemo'
import { AnimatePresence } from 'motion/react'
import { PageTransition } from './motion/primitives'
import { useAuth } from './features/auth/useAuth'
import { getAuthAccessState } from './features/auth/AuthContext'
import { Button } from './components/ui/Button'
import { Logo } from './components/ui/Logo'

function App() {
  const [route, setRoute] = useState<AppRoute>('overview')
  const [showLanding, setShowLanding] = useState(true)
  const {
    loading,
    session,
    error,
    identityStatus,
    identityError,
    roles,
    hasRole,
    retryIdentityInitialization,
    signOut,
  } = useAuth()
  const canCreateBatch = hasRole('company_admin')
  const canViewOverview = hasRole('company_admin') || hasRole('hr_operator') || hasRole('auditor')
  const canViewVesting = hasRole('company_admin') || hasRole('hr_operator') || hasRole('employee')
  const canManageRoles = hasRole('company_admin')
  const authAccessState = getAuthAccessState({
    loading,
    authenticated: Boolean(session),
    identityStatus,
    roleCount: roles.length,
  })

  if (import.meta.env.DEV && window.location.search.includes('motion-demo')) {
    return <MotionDemo />
  }

  if (authAccessState === 'loading') {
    return (
      <div className="auth-page">
        <section className="auth-panel">
          <Logo />
          <p className="muted">
            {session ? 'Verifying wallet identity and roles...' : 'Loading session...'}
          </p>
        </section>
        <div className="auth-art" aria-hidden="true" />
      </div>
    )
  }

  if (authAccessState === 'login') {
    return showLanding ? (
      <LandingPage onLaunch={() => setShowLanding(false)} />
    ) : (
      <AuthPage mode="login" error={error} onBack={() => setShowLanding(true)} />
    )
  }

  if (authAccessState === 'identity-error' || authAccessState === 'no-role') {
    const identityFailed = authAccessState === 'identity-error'
    return (
      <div className="auth-page">
        <section className="auth-panel">
          <Logo />
          <h1>{identityFailed ? 'We could not verify your access' : 'No role assigned'}</h1>
          <p className="muted">
            {identityFailed
              ? 'Vesta could not verify your wallet identity and roles. Retry the check or log out and sign in again.'
              : 'Your wallet is verified, but no application role is assigned. Ask an administrator to assign one, then check again.'}
          </p>
          {identityFailed && (
            <p className="modal-error" role="alert">
              {error ?? identityError ?? 'Identity verification failed.'}
            </p>
          )}
          <Button
            type="button"
            className="full-width"
            onClick={() => void retryIdentityInitialization().catch(() => undefined)}
          >
            {identityFailed ? 'Retry verification' : 'Check roles again'}
          </Button>
          <Button
            type="button"
            className="full-width"
            variant="ghost"
            onClick={() => void signOut().catch(() => undefined)}
          >
            Log out
          </Button>
        </section>
        <div className="auth-art" aria-hidden="true" />
      </div>
    )
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
        {activeRoute === 'create-batch' && <CreateBatchPage onBack={() => setRoute('overview')} />}
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
