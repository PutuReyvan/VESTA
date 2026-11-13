import { Button } from './ui/Button'
import { useWallet } from '../features/wallet/useWallet'
import { IconAlertTriangle, IconArrowsExchange } from '@tabler/icons-react'
import { AnimatePresence, motion } from 'motion/react'

export function NetworkGuard() {
  const { status, error, switchToExpectedNetwork } = useWallet()

  const wrongNetwork = status === 'wrong-network'
  const visible = status === 'wrong-network' || status === 'error' || status === 'rejected'

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          className={wrongNetwork ? 'wallet-notice wrong-network' : 'wallet-notice'}
          role="alert"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
        >
          <span><IconAlertTriangle size={18} stroke={2} /> {wrongNetwork ? 'Switch MetaMask to Sepolia before using write actions.' : error}</span>
          {wrongNetwork && (
            <Button type="button" variant="secondary" icon={<IconArrowsExchange size={17} stroke={2} />} onClick={switchToExpectedNetwork}>
              Switch Network
            </Button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
