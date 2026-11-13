import { createContext } from 'react'
import type { WalletState } from './types'

export interface WalletContextValue extends WalletState {
  isMetaMaskAvailable: boolean
  connect: () => Promise<void>
  disconnect: () => void
  switchToExpectedNetwork: () => Promise<void>
}

export const WalletContext = createContext<WalletContextValue | null>(null)
