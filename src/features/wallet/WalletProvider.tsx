import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { WalletContext } from './WalletContext'
import {
  formatWalletError,
  getExpectedChainId,
  parseChainId,
  SEPOLIA_CHAIN_HEX,
} from './network'
import type { Eip1193Provider, WalletState } from './types'

function getProvider(): Eip1193Provider | null {
  const provider = window.ethereum
  return provider && typeof provider.request === 'function' ? provider : null
}

function getErrorCode(error: unknown): number | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return typeof error.code === 'number' ? error.code : null
  }
  return null
}

export function WalletProvider({ children }: PropsWithChildren) {
  const expectedChainId = getExpectedChainId()
  const [state, setState] = useState<WalletState>({
    account: null,
    chainId: null,
    status: 'disconnected',
    error: null,
  })

  const disconnect = useCallback(() => {
    setState({
      account: null,
      chainId: null,
      status: 'disconnected',
      error: null,
    })
  }, [])

  const updateChain = useCallback(
    (chainIdValue: unknown) => {
      const chainId = parseChainId(chainIdValue)
      setState((current) => ({
        ...current,
        chainId,
        status:
          current.account && chainId === expectedChainId
            ? 'connected'
            : current.account
              ? 'wrong-network'
              : 'disconnected',
        error: null,
      }))
    },
    [expectedChainId],
  )

  const connect = useCallback(async () => {
    const provider = getProvider()
    if (!provider) {
      setState((current) => ({
        ...current,
        status: 'error',
        error: 'MetaMask was not detected. Install the MetaMask extension to continue.',
      }))
      return
    }

    setState((current) => ({ ...current, status: 'connecting', error: null }))

    try {
      const accounts = (await provider.request({
        method: 'eth_requestAccounts',
      })) as unknown
      const account = Array.isArray(accounts) && typeof accounts[0] === 'string'
        ? accounts[0]
        : null
      const chainId = parseChainId(await provider.request({ method: 'eth_chainId' }))

      if (!account) {
        throw new Error('The wallet returned no account.')
      }

      setState({
        account,
        chainId,
        status: chainId === expectedChainId ? 'connected' : 'wrong-network',
        error: null,
      })
    } catch (error) {
      const status = getErrorCode(error) === 4001 ? 'rejected' : 'error'
      setState((current) => ({
        ...current,
        status,
        error: formatWalletError(error),
      }))
    }
  }, [expectedChainId])

  const switchToExpectedNetwork = useCallback(async () => {
    const provider = getProvider()
    if (!provider) {
      setState((current) => ({
        ...current,
        status: 'error',
        error: 'MetaMask was not detected. Install the MetaMask extension to continue.',
      }))
      return
    }

    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: expectedChainId === 11155111 ? SEPOLIA_CHAIN_HEX : `0x${expectedChainId.toString(16)}` }],
      })
      updateChain(await provider.request({ method: 'eth_chainId' }))
    } catch (error) {
      setState((current) => ({
        ...current,
        status: 'error',
        error: formatWalletError(error),
      }))
    }
  }, [expectedChainId, updateChain])

  useEffect(() => {
    const provider = getProvider()
    if (!provider?.on) return

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0]
      const account = Array.isArray(accounts) && typeof accounts[0] === 'string'
        ? accounts[0]
        : null
      if (!account) {
        disconnect()
        return
      }

      setState((current) => ({
        ...current,
        account,
        status:
          current.chainId === expectedChainId ? 'connected' : 'wrong-network',
        error: null,
      }))
    }
    const handleChainChanged = (...args: unknown[]) => updateChain(args[0])

    provider.on('accountsChanged', handleAccountsChanged)
    provider.on('chainChanged', handleChainChanged)
    return () => {
      provider.removeListener?.('accountsChanged', handleAccountsChanged)
      provider.removeListener?.('chainChanged', handleChainChanged)
    }
  }, [disconnect, expectedChainId, updateChain])

  const value = useMemo(
    () => ({
      ...state,
      isMetaMaskAvailable: Boolean(getProvider()?.isMetaMask),
      connect,
      disconnect,
      switchToExpectedNetwork,
    }),
    [connect, disconnect, state, switchToExpectedNetwork],
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}
