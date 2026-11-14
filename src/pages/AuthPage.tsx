import { useState } from 'react'
import { Button } from '../components/ui/Button'
import { Logo } from '../components/ui/Logo'
import { useAuth } from '../features/auth/useAuth'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = error.message
    if (typeof message === 'string' && message.length > 0) return message
  }
  return 'Wallet sign-in failed.'
}

export function AuthPage({
  mode,
  error,
}: {
  mode: 'login' | 'sign-up'
  error?: string | null
}) {
  const isLogin = mode === 'login'
  const { signInWithWallet } = useAuth()
  const [pending, setPending] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  async function handleSignIn() {
    setPending(true)
    setLocalError(null)
    try {
      await signInWithWallet()
    } catch (signInError) {
      setLocalError(getErrorMessage(signInError))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-panel">
        <Logo />
        <h1>{isLogin ? 'Welcome Back to Vesta!' : 'Create Your Vesta Account'}</h1>
        <p className="muted">Sign in using your Ethereum wallet. No password required.</p>
        <Button type="button" className="full-width" onClick={handleSignIn} disabled={pending}>
          {pending ? 'Waiting for wallet...' : 'Login with Wallet'}
        </Button>
        {(localError || error) && <p className="modal-error" role="alert">{localError || error}</p>}
        <p className="auth-switch">First visit? Wallet sign-in creates the account automatically.</p>
      </section>
      <div className="auth-art" aria-hidden="true" />
    </div>
  )
}
