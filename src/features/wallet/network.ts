export const SEPOLIA_CHAIN_ID = 11155111
export const SEPOLIA_CHAIN_HEX = `0x${SEPOLIA_CHAIN_ID.toString(16)}`

export function getExpectedChainId(): number {
  const configuredChainId = Number(import.meta.env.VITE_CHAIN_ID)
  return Number.isInteger(configuredChainId) && configuredChainId > 0
    ? configuredChainId
    : SEPOLIA_CHAIN_ID
}

export function parseChainId(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null

  const parsed = typeof value === 'string' ? Number.parseInt(value, 16) : value
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export function formatWalletError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = error.code
    if (code === 4001) return 'Wallet connection was rejected.'
    if (code === -32002) return 'A wallet request is already in progress.'
  }

  if (error instanceof Error && error.message) return error.message
  return 'Unable to connect to the wallet.'
}
