import { Button } from '../components/ui/Button'
import { Logo } from '../components/ui/Logo'
import type { AppRoute } from '../types/app'

export function AuthPage({
  mode,
  onNavigate,
}: {
  mode: 'login' | 'sign-up'
  onNavigate: (route: AppRoute) => void
}) {
  const isLogin = mode === 'login'

  return (
    <div className="auth-page">
      <section className="auth-panel">
        <Logo />
        <h1>{isLogin ? 'Welcome Back to Vesta!' : 'Create Your Vesta Account'}</h1>
        <p className="muted">
          {isLogin ? 'Enter the fields below to continue' : 'Enter the fields below to get started'}
        </p>
        {!isLogin && (
          <div className="form-row">
            <label>
              First Name
              <input placeholder="Enter your first name" />
            </label>
            <label>
              Last Name
              <input placeholder="Enter your last name" />
            </label>
          </div>
        )}
        <label>
          Email Address
          <input type="email" placeholder="Enter your email address" />
        </label>
        <label>
          Password
          <input type="password" placeholder="Enter your password" />
        </label>
        <Button type="button" className="full-width" onClick={() => onNavigate(isLogin ? 'overview' : 'login')}>
          {isLogin ? 'Login' : 'Sign Up'}
        </Button>
        <p className="auth-switch">
          {isLogin ? 'Doesn’t Have an Account?' : 'Already Have an Account?'}{' '}
          <button onClick={() => onNavigate(isLogin ? 'sign-up' : 'login')}>
            {isLogin ? 'Sign Up' : 'Login'}
          </button>
        </p>
      </section>
      <div className="auth-art" aria-hidden="true" />
    </div>
  )
}
