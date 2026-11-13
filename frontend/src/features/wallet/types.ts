export interface Eip1193Provider {
  isMetaMask?: boolean
  request(args: {
    method: string
    params?: readonly unknown[]
  }): Promise<unknown>
  on?(event: string, handler: (...args: unknown[]) => void): void
  removeListener?(event: string, handler: (...args: unknown[]) => void): void
}

export type WalletStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'wrong-network'
  | 'rejected'
  | 'error'

export interface WalletState {
  account: string | null
  chainId: number | null
  status: WalletStatus
  error: string | null
}
