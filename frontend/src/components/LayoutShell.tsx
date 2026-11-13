import { useState, type ReactNode } from 'react'
import type { AppRoute } from '../types/app'
import { WalletButton } from './WalletButton'
import { Logo } from './ui/Logo'
import { NetworkGuard } from './NetworkGuard'
import {
  IconDots,
  IconLayoutSidebar,
  IconPlus,
  IconUser,
  IconUsers,
} from '@tabler/icons-react'
import { useWallet } from '../features/wallet/useWallet'
import { AnimatePresence, motion } from 'motion/react'

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
            key={account ? 'create-batch' : 'connect-wallet'}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            {account ? (
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
            <span>Sepolia</span><small>0x98AB...62JKL</small>
          </motion.div>
          <div className="profile-card">
            <div className="avatar">L</div>
            <div>
              <strong>Leonardo</strong>
              <small>le1e02@gmail.com</small>
            </div>
            <span className="profile-menu">
              <IconDots size={20} stroke={2} />
            </span>
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
