import { useEffect, useState, type ReactNode } from 'react'
import type { AppRoute } from '../types/app'
import { WalletButton } from './WalletButton'
import { Logo } from './ui/Logo'
import { NetworkGuard } from './NetworkGuard'
import {
  IconDots,
  IconLayoutSidebar,
  IconPlus,
  IconShield,
  IconUser,
  IconUsers,
} from '@tabler/icons-react'
import { useWallet } from '../features/wallet/useWallet'
import { useAuth } from '../features/auth/useAuth'
import { supabase } from '../features/auth/supabase'
import { OffchainService } from '../offchain/service'
import type { DatabaseClient } from '../offchain/types'
import { formatRole } from '../offchain/types'
import { AnimatePresence, motion } from 'motion/react'
import { formatTokenAmount, getBrowserProvider, getTokenContract, shortenAddress } from '../features/vesting/contract'

export function LayoutShell({
  route,
  onNavigate,
  children,
}: {
  route: AppRoute
  onNavigate: (route: AppRoute) => void
  children: ReactNode
}) {
  const { account, status, disconnect } = useWallet()
  const { roles, signOut, hasRole } = useAuth()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const canCreateBatch = hasRole('company_admin')
  const canViewOverview = hasRole('company_admin') || hasRole('hr_operator') || hasRole('auditor')
  const canViewVesting = hasRole('company_admin') || hasRole('hr_operator') || hasRole('employee') || roles.length === 0
  const canManageRoles = hasRole('company_admin')
  const walletLabel = account ? shortenAddress(account) : 'Unknown wallet'
  const roleLabel = roles.length > 0 ? roles.map(formatRole).join(', ') : 'No role assigned'
  const networkLabel = status === 'wrong-network' ? 'Wrong network' : 'Sepolia'
  const [tokenBalance, setTokenBalance] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)

  useEffect(() => {
    if (!account || !supabase) return
    let cancelled = false
    async function loadProfileName() {
      try {
        const service = new OffchainService(supabase as unknown as DatabaseClient)
        const profile = await service.getProfile(account)
        if (!cancelled) setDisplayName(profile?.displayName ?? null)
      } catch {
        if (!cancelled) setDisplayName(null)
      }
    }
    void loadProfileName()
    const handleProfileUpdated = (event: Event) => {
      const name = (event as CustomEvent<{ displayName?: unknown }>).detail?.displayName
      if (typeof name === 'string') setDisplayName(name || null)
    }
    window.addEventListener('vesta:profile-updated', handleProfileUpdated)
    return () => {
      cancelled = true
      window.removeEventListener('vesta:profile-updated', handleProfileUpdated)
    }
  }, [account])

  useEffect(() => {
    if (!account) return
    let cancelled = false
    async function loadBalance() {
      try {
        const provider = getBrowserProvider()
        const token = getTokenContract(provider)
        const [balance, decimals] = await Promise.all([
          token.balanceOf(account) as Promise<bigint>,
          token.decimals() as Promise<number>,
        ])
        if (!cancelled) setTokenBalance(formatTokenAmount(BigInt(balance), Number(decimals)))
      } catch {
        if (!cancelled) setTokenBalance(null)
      }
    }
    void loadBalance()
    return () => { cancelled = true }
  }, [account])

  async function switchAccount() {
    await signOut()
    disconnect()
  }

  return (
    <div className="app-shell">
      <aside className={sidebarCollapsed ? 'sidebar collapsed' : 'sidebar'}>
        <div className="sidebar-brand">
          <Logo />
          <button
            className="icon-button"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!sidebarCollapsed}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          >
            <IconLayoutSidebar size={21} stroke={1.8} />
          </button>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            className="sidebar-action"
            key={account && canCreateBatch ? 'create-batch' : 'wallet'}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            {account && canCreateBatch ? (
              <button className="button button-primary" onClick={() => onNavigate('create-batch')}>
                <IconPlus size={18} stroke={2} />
                Create Batch
              </button>
            ) : (
              <WalletButton />
            )}
          </motion.div>
        </AnimatePresence>
        <p className="sidebar-heading">Essentials</p>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {canViewOverview && <button
            className={route === 'overview' ? 'nav-item active' : 'nav-item'}
            aria-label="Overview"
            onClick={() => onNavigate('overview')}
          >
            <IconUser size={19} stroke={1.8} /> <span>Overview</span>
          </button>}
          {canViewVesting && <button
            className={route === 'my-vesting' ? 'nav-item active' : 'nav-item'}
            aria-label="My Vesting"
            onClick={() => onNavigate('my-vesting')}
          >
            <IconUsers size={19} stroke={1.8} /> <span>My Vesting</span>
          </button>}
          {canManageRoles && <button
            className={route === 'role-management' ? 'nav-item active' : 'nav-item'}
            aria-label="Role Management"
            onClick={() => onNavigate('role-management')}
          >
            <IconShield size={19} stroke={1.8} /> <span>Role Management</span>
          </button>}
        </nav>
        {import.meta.env.DEV && (
          <div className="preview-nav">
            <p className="sidebar-heading">Preview pages</p>
            <button onClick={() => onNavigate('login')}>Login</button>
            <button onClick={() => onNavigate('sign-up')}>Sign Up</button>
          </div>
        )}
        <div className="sidebar-footer">
          <motion.div
            className="network-badge"
            animate={{
              backgroundColor: status === 'wrong-network' ? '#fff1c8' : '#dbf8a6',
            }}
            transition={{ duration: 0.2 }}
          >
            <span>{networkLabel}</span><small>{account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Wallet not connected'}</small>
          </motion.div>
          <div className="profile-card">
            <div className="avatar">{(displayName?.[0] ?? 'L').toUpperCase()}</div>
            <div>
              <strong>{displayName ?? walletLabel}</strong>
              <small>{walletLabel}</small>
              <small>{roleLabel}</small>
              <small>{tokenBalance === null ? 'VESTA balance loading...' : `${tokenBalance} VESTA`}</small>
            </div>
            <button className="profile-menu" type="button" onClick={() => void switchAccount()} aria-label="Switch account" title="Switch account">
              <IconDots size={20} stroke={2} />
            </button>
          </div>
        </div>
      </aside>
      <main className="main-content">
        <NetworkGuard />
        {children}
      </main>
    </div>
  )
}
