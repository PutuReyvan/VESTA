import { useEffect, useState, type ReactNode } from 'react'
import type { AppRoute } from '../types/app'
import { WalletButton } from './WalletButton'
import { Logo } from './ui/Logo'
import { NetworkGuard } from './NetworkGuard'
import {
  IconLayoutSidebar,
  IconPlus,
  IconUser,
  IconUsers,
} from '@tabler/icons-react'
import { useWallet } from '../features/wallet/useWallet'
import { AnimatePresence, motion } from 'motion/react'
import { loadVestingAccess } from '../features/vesting'

export function LayoutShell({
  route,
  onNavigate,
  children,
}: {
  route: AppRoute
  onNavigate: (route: AppRoute) => void
  children: ReactNode
}) {
  const { account, status } = useWallet()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [access, setAccess] = useState<{ account: string; isAdmin: boolean } | null>(null)

  useEffect(() => {
    if (!account || status !== 'connected') return

    let cancelled = false
    loadVestingAccess(account)
      .then((access) => {
        if (!cancelled) setAccess({ account, isAdmin: access.isAdmin })
      })
      .catch(() => {
        if (!cancelled) setAccess({ account, isAdmin: false })
      })
    return () => {
      cancelled = true
    }
  }, [account, status])

  const isAdmin = Boolean(
    account && status === 'connected' && access?.account === account && access.isAdmin,
  )

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
            key={account && isAdmin ? 'create-batch' : 'wallet'}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            {account && isAdmin ? (
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
          <button
            className={route === 'overview' ? 'nav-item active' : 'nav-item'}
            aria-label="Overview"
            onClick={() => onNavigate('overview')}
          >
            <IconUser size={19} stroke={1.8} /> <span>Overview</span>
          </button>
          <button
            className={route === 'my-vesting' ? 'nav-item active' : 'nav-item'}
            aria-label="My Vesting"
            onClick={() => onNavigate('my-vesting')}
          >
            <IconUsers size={19} stroke={1.8} /> <span>My Vesting</span>
          </button>
        </nav>
        <div className="sidebar-footer">
          <motion.div
            className="network-badge"
            animate={{
              backgroundColor: status === 'wrong-network' ? '#fff1c8' : '#dbf8a6',
            }}
            transition={{ duration: 0.2 }}
          >
            <span>{status === 'wrong-network' ? 'Wrong network' : 'Wallet network'}</span>
            <small>{account ? shortAddress(account) : 'Disconnected'}</small>
          </motion.div>
          <div className="profile-card">
            <div className="avatar">{account ? account.slice(2, 4).toUpperCase() : 'V'}</div>
            <div>
              <strong>{account ? shortAddress(account) : 'Wallet not connected'}</strong>
              <small>{account ? isAdmin ? 'On-chain admin' : 'Connected wallet' : 'Connect to continue'}</small>
            </div>
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

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
