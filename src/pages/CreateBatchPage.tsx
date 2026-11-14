import { useEffect, useMemo, useState } from 'react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import { IconArrowLeft, IconCheck, IconCircleCheck, IconPlus, IconScale, IconTrash, IconWallet } from '@tabler/icons-react'
import { useWallet } from '../features/wallet/useWallet'
import { buildBatchPayload } from '../features/vesting/batchValidation'
import {
  formatTokenAmount,
  getBrowserProvider,
  getManagerContract,
  getSigner,
  getTokenContract,
  isOnChainAdmin,
  managerAddress,
  parseTokenAmount,
  shortenAddress,
  tokenAddress,
} from '../features/vesting/contract'

type BatchRow = {
  beneficiary: string
  allocation: string
  start: string
  durationDays: string
  cliffDays: string
}

function emptyRow(beneficiary = ''): BatchRow {
  return {
    beneficiary,
    allocation: '',
    start: '',
    durationDays: '',
    cliffDays: '',
  }
}

export function CreateBatchPage({ onBack }: { onBack?: () => void }) {
  const { account, status } = useWallet()
  const [rows, setRows] = useState<BatchRow[]>([emptyRow()])
  const [decimals, setDecimals] = useState(18)
  const [balance, setBalance] = useState(0n)
  const [allowance, setAllowance] = useState(0n)
  const [maxBatchSize, setMaxBatchSize] = useState<number | null>(null)
  const [managerAdmin, setManagerAdmin] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [action, setAction] = useState<'idle' | 'approving' | 'creating'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadWalletState() {
      if (!account || status !== 'connected') {
        setManagerAdmin(null)
        setMaxBatchSize(null)
        setBalance(0n)
        setAllowance(0n)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const provider = getBrowserProvider()
        const manager = getManagerContract(provider)
        const token = getTokenContract(provider)
        const [admin, tokenDecimals, tokenBalance, currentAllowance, batchSize] = await Promise.all([
          manager.admin() as Promise<string>,
          token.decimals() as Promise<number>,
          token.balanceOf(account) as Promise<bigint>,
          token.allowance(account, managerAddress) as Promise<bigint>,
          manager.MAX_BATCH_SIZE() as Promise<bigint>,
        ])
        if (cancelled) return
        setManagerAdmin(admin)
        setDecimals(Number(tokenDecimals))
        setBalance(BigInt(tokenBalance))
        setAllowance(BigInt(currentAllowance))
        setMaxBatchSize(Number(batchSize))
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Failed to read token and manager state.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadWalletState()
    return () => {
      cancelled = true
    }
  }, [account, refresh, status])

  const effectiveRows = useMemo(
    () => rows.map((row, index) => index === 0 && !row.beneficiary && account ? { ...row, beneficiary: account } : row),
    [account, rows],
  )

  const totalAllocation = useMemo(() => {
    try {
      return effectiveRows.reduce((total, row) => total + parseTokenAmount(row.allocation, decimals), 0n)
    } catch {
      return null
    }
  }, [decimals, effectiveRows])

  const isAdmin = Boolean(account && managerAdmin && isOnChainAdmin(account, managerAdmin))
  const needsApproval = totalAllocation === null || allowance < totalAllocation
  const hasCompleteRows = effectiveRows.length > 0 && effectiveRows.every((row) => row.beneficiary && row.allocation && row.start && row.durationDays && row.cliffDays !== '')

  function updateRow(index: number, field: keyof BatchRow, value: string) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row))
  }

  async function submitBatch() {
    if (!account) return
    setError(null)
    setTxHash(null)
    setConfirmed(false)

    const run = async () => {
      if (!maxBatchSize || effectiveRows.length > maxBatchSize) throw new Error(`A batch cannot exceed the contract limit of ${maxBatchSize ?? 'unknown'} schedules.`)
      const payload = buildBatchPayload(effectiveRows, decimals)
      if (payload.totalAllocation > balance) throw new Error('The admin wallet does not have enough VESTA tokens.')
      const requiredAllowance = payload.totalAllocation
      const signer = await getSigner()
      const token = getTokenContract(signer)
      const currentAllowance = BigInt(await token.allowance(account, managerAddress))

      if (currentAllowance < requiredAllowance) {
        setAction('approving')
        const approval = await token.approve(managerAddress, requiredAllowance)
        setTxHash(approval.hash)
        await approval.wait()
      }

      setAction('creating')
      const manager = getManagerContract(signer)
      const transaction = await manager.createBatch(
        tokenAddress,
        payload.beneficiaries,
        payload.allocations,
        payload.starts,
        payload.cliffs,
        payload.durations,
      )
      setTxHash(transaction.hash)
      await transaction.wait()
      setConfirmed(true)
      setRefresh((current) => current + 1)
    }

    try {
      // Prevent two VESTA tabs for the same wallet from overwriting each
      // other's exact ERC-20 allowance between approval and createBatch.
      const locks = (navigator as Navigator & { locks?: LockManager }).locks
      if (locks) {
        await locks.request(`vesta-batch:${account.toLowerCase()}`, { mode: 'exclusive' }, run)
      } else {
        await run()
      }
    } catch (batchError) {
      setError(batchError instanceof Error ? batchError.message : 'Create batch transaction failed.')
    } finally {
      setAction('idle')
    }
  }

  return (
    <div className="page-frame create-batch-page">
      <button className="back-button" type="button" onClick={onBack}><IconArrowLeft size={17} stroke={2} /> Back</button>
      <h1>Create Batch</h1>
      <p className="contract-line" title={managerAddress}>Manager: {managerAddress ? shortenAddress(managerAddress) : 'VITE_CONTRACT_ADDRESS missing'}</p>
      <p className="contract-line" title={tokenAddress}>Token: {tokenAddress ? shortenAddress(tokenAddress) : 'VITE_TOKEN_ADDRESS missing'}</p>
      <p className="contract-line" title={managerAdmin ?? undefined}>On-chain admin: {managerAdmin ? shortenAddress(managerAdmin) : 'Loading...'} · {isAdmin ? 'This wallet can create batches' : 'This wallet cannot create batches'}</p>
      <p className="contract-line">Every valid row is funded and created together. If any row fails, the batch reverts.</p>
      {loading && <p className="muted">Reading token balance and allowance...</p>}
      {error && <p className="modal-error" role="alert">{error}</p>}
      {txHash && <p className="contract-line">{confirmed ? 'Confirmed transaction: ' : 'Pending transaction: '}<a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer">View on Sepolia Etherscan</a></p>}
      <div className="stepper">
        <span className={needsApproval ? 'step active' : 'step'}>Approve Token</span>
        <span className="step-dots">••••</span>
        <span className={!needsApproval ? 'step active' : 'step'}>Create Batch</span>
      </div>
      <h2>Summary</h2>
      <Card className="stats-grid batch-summary">
        <StatCard label="Total Allocation" value={totalAllocation === null ? '—' : formatTokenAmount(totalAllocation, decimals)} icon={<IconScale size={17} stroke={1.8} />} />
        <StatCard label="Wallet Balance" value={formatTokenAmount(balance, decimals)} icon={<IconWallet size={17} stroke={1.8} />} />
        <StatCard label="Current Allowance" value={formatTokenAmount(allowance, decimals)} icon={<IconCircleCheck size={17} stroke={1.8} />} />
      </Card>
      <Card>
        <div className="section-heading">
          <h2>All Schedules</h2>
          <button className="back-button" type="button" disabled={!maxBatchSize || rows.length >= maxBatchSize} onClick={() => setRows((current) => maxBatchSize && current.length < maxBatchSize ? [...current, emptyRow()] : current)}>
            <IconPlus size={17} stroke={2} /> Add Row
          </button>
        </div>
        <div className="batch-form">
          {effectiveRows.map((row, index) => (
            <div className="batch-row" key={`row-${index + 1}`}>
              <label className="batch-field">Beneficiary<input value={row.beneficiary} onChange={(event) => updateRow(index, 'beneficiary', event.target.value)} placeholder="Wallet address" aria-label="Beneficiary" /></label>
              <label className="batch-field">Allocation (VESTA)<input value={row.allocation} onChange={(event) => updateRow(index, 'allocation', event.target.value)} type="number" min="0" placeholder="Amount" aria-label="Allocation" /></label>
              <label className="batch-field">Start<input value={row.start} onChange={(event) => updateRow(index, 'start', event.target.value)} type="datetime-local" aria-label="Start" /></label>
              <label className="batch-field">Duration (days)<input value={row.durationDays} onChange={(event) => updateRow(index, 'durationDays', event.target.value)} type="number" min="1" step="1" placeholder="Days" aria-label="Duration in days" /></label>
              <label className="batch-field">Cliff (days)<input value={row.cliffDays} onChange={(event) => updateRow(index, 'cliffDays', event.target.value)} type="number" min="0" step="1" placeholder="Days" aria-label="Cliff in days" /></label>
              <button className="icon-button" type="button" aria-label={`Remove row ${index + 1}`} disabled={effectiveRows.length === 1} onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}>
                <IconTrash size={17} stroke={1.8} />
              </button>
            </div>
          ))}
        </div>
        <Button
          variant="success"
          className="full-width"
          icon={<IconCheck size={18} stroke={2} />}
          disabled={!account || status !== 'connected' || !isAdmin || !maxBatchSize || !hasCompleteRows || totalAllocation === null || totalAllocation <= 0n || action !== 'idle'}
          onClick={() => void submitBatch()}
        >
          {action === 'approving' ? 'Approving...' : action === 'creating' ? 'Creating...' : needsApproval ? 'Approve & Create' : 'Create Batch'}
        </Button>
      </Card>
    </div>
  )
}
