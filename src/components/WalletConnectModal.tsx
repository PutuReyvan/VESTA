import { IconNetwork, IconWallet, IconX } from '@tabler/icons-react'
import { useEffect } from 'react'
import { motion } from 'motion/react'
import metamaskFox from '../assets/metamask-fox.svg'
import { Button } from './ui/Button'
import { useWallet } from '../features/wallet/useWallet'

export function WalletConnectModal({ onClose }: { onClose: () => void }) {
  const { connect, error, status } = useWallet()
  const isConnecting = status === 'connecting'
  const contractAddress =
    import.meta.env.VITE_CONTRACT_ADDRESS || '0x987BA...L0D'

  useEffect(() => {
    if (status === 'connected') onClose()
  }, [onClose, status])

  async function handleConnect() {
    await connect()
  }

  return (
    <motion.div
      className="wallet-modal-backdrop"
      role="presentation"
      onMouseDown={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
    >
      <motion.section
        className="wallet-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        <button className="modal-close" type="button" aria-label="Close" onClick={onClose}>
          <IconX size={18} stroke={2} />
        </button>
        <div className="metamask-mark" aria-hidden="true">
          <img src={metamaskFox} alt="" />
        </div>
        <h2 id="wallet-modal-title">Connect Your Wallet</h2>
        <p className="modal-description">
          Connect MetaMask to view your vesting schedules.
          <br />
          Admins can also create and fund batches.
        </p>
        <Button type="button" className="full-width" onClick={handleConnect} disabled={isConnecting}>
          {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
        </Button>
        {error && <p className="modal-error" role="alert">{error}</p>}
        <p className="install-extension">
          No MetaMask?{' '}
          <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">
            Install Extension
          </a>
        </p>
        <div className="modal-divider" />
        <div className="wallet-detail">
          <span><IconNetwork size={18} stroke={1.8} /> Network</span>
          <strong>Ethereum Sepolia</strong>
        </div>
        <div className="wallet-detail">
          <span><IconWallet size={18} stroke={1.8} /> Contract</span>
          <strong>{contractAddress}</strong>
        </div>
      </motion.section>
    </motion.div>
  )
}
