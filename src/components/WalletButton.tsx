import { useState } from 'react'
import { Button } from './ui/Button'
import { useWallet } from '../features/wallet/useWallet'
import { WalletConnectModal } from './WalletConnectModal'
import { IconWallet } from '@tabler/icons-react'
import { useAuth } from '../features/auth/useAuth'

export function WalletButton() {
  const { account, disconnect, status } = useWallet()
  const { signOut } = useAuth()
  const [isModalOpen, setIsModalOpen] = useState(false)

  async function handleClick() {
    if (account) {
      await signOut()
      disconnect()
      return
    }

    setIsModalOpen(true)
  }

  return (
    <>
      <Button type="button" onClick={handleClick}>
      <IconWallet size={18} stroke={1.8} aria-hidden="true" />
      {status === 'connecting'
        ? 'Connecting...'
        : account
          ? `${account.slice(0, 6)}...${account.slice(-4)}`
          : 'Connect Wallet'}
      </Button>
      {isModalOpen && (
        <WalletConnectModal
          onClose={() => {
            setIsModalOpen(false)
          }}
        />
      )}
    </>
  )
}
