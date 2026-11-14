import { useEffect, useMemo, useState } from 'react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import { IconArrowLeft, IconCheck, IconCircleCheck, IconPlus, IconScale, IconWallet } from '@tabler/icons-react'
import { useWallet } from '../features/wallet/useWallet'
import {
  formatTokenAmount,
  getBrowserProvider,
  getManagerContract,
  getSigner,
  getTokenContract,
  isOnChainAdmin,
  managerAddress,
  parseTokenAmount,
  tokenAddress,
} from '../features/vesting/contract'

type BatchRow = {
  beneficiary: string
  allocation: string
  start: string
  durationDays: string
  cliffDays: string
}

function defaultStart() {
  const date = new Date(Date.now() + 60_000)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function emptyRow(beneficiary = ''): BatchRow {
  return {
    beneficiary,
    allocation: '100',
    start: defaultStart(),
    durationDays: '30',
    cliffDays: '0',
  }
}

export function CreateBatchPage() {
  const { account } = useWallet()
  const [rows, setRows] = useState<BatchRow[]>([emptyRow()])
  const [decimals, setDecimals] = useState(18)
  const [balance, setBalance] = useState(0n)
  const [allowance, setAllowance] = useState(0n)
  const [managerAdmin, setManagerAdmin] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [action, setAction] = useState<'idle' | 'approving' | 'creating'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadWalletState() {
      if (!account) return
      setLoading(true)
      setError(null)
      try {
        const provider = getBrowserProvider()
        const manager = getManagerContract(provider)
        const token = getTokenContract(provider)
        const [admin, tokenDecimals, tokenBalance, currentAllowance] = await Promise.all([
          manager.admin() as Promise<string>,
          token.decimals() as Promise<number>,
          token.balanceOf(account) as Promise<bigint>,
          token.allowance(account, managerAddress) as Promise<bigint>,
        ])
        if (cancelled) return
        setManagerAdmin(admin)
        setDecimals(Number(tokenDecimals))
        setBalance(BigInt(tokenBalance))
        setAllowance(BigInt(currentAllowance))
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
  }, [account, refresh])

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

  function updateRow(index: number, field: keyof BatchRow, value: string) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row))
  }

  function buildPayload() {
    if (!totalAllocation || totalAllocation <= 0n) throw new Error('Total allocation must be greater than zero.')
    if (totalAllocation > balance) throw new Error('The admin wallet does not have enough VESTA tokens.')

    const payload = effectiveRows.map((row) => {
      if (!/^0x[0-9a-fA-F]{40}$/.test(row.beneficiary)) throw new Error(`Invalid beneficiary address: ${row.beneficiary}`)
      const start = Math.floor(new Date(row.start).getTime() / 1000)
      const durationDays = Number(row.durationDays)
      const cliffDays = Number(row.cliffDays)
      if (!Number.isFinite(start) || !Number.isFinite(durationDays) || !Number.isFinite(cliffDays)) throw new Error('Start, duration, and cliff must be valid numbers.')
      if (durationDays <= 0 || cliffDays < 0 || cliffDays > durationDays) throw new Error('Cliff must be between zero and duration.')
      return {
        beneficiary: row.beneficiary,
        allocation: parseTokenAmount(row.allocation, decimals),
        start: BigInt(start),
        cliff: BigInt(Math.floor(cliffDays * 86_400)),
        duration: BigInt(Math.floor(durationDays * 86_400)),
      }
    })

    return {
      beneficiaries: payload.map((row) => row.beneficiary),
      allocations: payload.map((row) => row.allocation),
      starts: payload.map((row) => row.start),
      cliffs: payload.map((row) => row.cliff),
      durations: payload.map((row) => row.duration),
    }
  }

  async function approve() {
    setAction('approving')
    setError(null)
    setTxHash(null)
    try {
      const token = getTokenContract(await getSigner())
      const transaction = await token.approve(managerAddress, totalAllocation)
      setTxHash(transaction.hash)
      await transaction.wait()
      setRefresh((current) => current + 1)
    } catch (approvalError) {
      setError(approvalError instanceof Error ? approvalError.message : 'Token approval failed.')
    } finally {
      setAction('idle')
    }
  }

  async function createBatch() {
    setAction('creating')
    setError(null)
    setTxHash(null)
    try {
      const payload = buildPayload()
      const manager = getManagerContract(await getSigner())
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
      setRefresh((current) => current + 1)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Create batch transaction failed.')
    } finally {
      setAction('idle')
    }
  }

  return (
    <div className="page-frame create-batch-page">
      <button className="back-button" type="button"><IconArrowLeft size={17} stroke={2} /> Back</button>
      <h1>Create Batch</h1>
      <p className="contract-line">Manager: {managerAddress || 'VITE_CONTRACT_ADDRESS missing'}</p>
      <p className="contract-line">Token: {tokenAddress || 'VITE_TOKEN_ADDRESS missing'}</p>
      <p className="contract-line">On-chain admin: {managerAdmin || 'Loading...'} · {isAdmin ? 'This wallet can create batches' : 'This wallet cannot create batches'}</p>
      {loading && <p className="muted">Reading token balance and allowance...</p>}
      {error && <p className="modal-error" role="alert">{error}</p>}
      {txHash && <p className="contract-line">Transaction: {txHash}</p>}
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
          <button className="back-button" type="button" onClick={() => setRows((current) => current.length >= 20 ? current : [...current, emptyRow(account ?? '')])}>
            <IconPlus size={17} stroke={2} /> Add Row
          </button>
        </div>
        <div className="batch-form">
          {effectiveRows.map((row, index) => (
            <div className="batch-row" key={`row-${index + 1}`}>
              <input value={row.beneficiary} onChange={(event) => updateRow(index, 'beneficiary', event.target.value)} placeholder="Beneficiary 0x..." aria-label="Beneficiary" />
              <input value={row.allocation} onChange={(event) => updateRow(index, 'allocation', event.target.value)} type="number" min="0" placeholder="VESTA" aria-label="Allocation" />
              <input value={row.start} onChange={(event) => updateRow(index, 'start', event.target.value)} type="datetime-local" aria-label="Start" />
              <input value={row.durationDays} onChange={(event) => updateRow(index, 'durationDays', event.target.value)} type="number" min="1" placeholder="Duration days" aria-label="Duration in days" />
              <input value={row.cliffDays} onChange={(event) => updateRow(index, 'cliffDays', event.target.value)} type="number" min="0" placeholder="Cliff days" aria-label="Cliff in days" />
            </div>
          ))}
        </div>
        <Button
          variant="success"
          className="full-width"
          icon={<IconCheck size={18} stroke={2} />}
          disabled={!account || !isAdmin || totalAllocation === null || action !== 'idle'}
          onClick={() => void (needsApproval ? approve() : createBatch())}
        >
          {action === 'approving' ? 'Approving...' : action === 'creating' ? 'Creating...' : needsApproval ? 'Approve' : 'Create Batch'}
        </Button>
      </Card>
    </div>
  )
}
