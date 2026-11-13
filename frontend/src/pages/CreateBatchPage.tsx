import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  IconCheck,
  IconCircleCheck,
  IconPlus,
  IconScale,
  IconTrash,
  IconWallet,
} from '@tabler/icons-react'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { TxStatus } from '../components/TxStatus'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import {
  MAX_BATCH_ROWS,
  createBatch,
  getVestingErrorMessage,
  getVestingFailure,
  loadCreateBatch,
  validateBatchRows,
  type BatchRowInput,
  type CreateBatchData,
  type TransactionUpdate,
} from '../features/vesting'
import { useWallet } from '../features/wallet/useWallet'

interface EditableBatchRow extends BatchRowInput {
  id: number
}

interface CreateBatchResult {
  account: string
  data?: CreateBatchData
  error?: string
}

export function CreateBatchPage() {
  const { account, status: walletStatus } = useWallet()
  const nextRowId = useRef(2)
  const [rows, setRows] = useState<EditableBatchRow[]>([emptyRow(1)])
  const [result, setResult] = useState<CreateBatchResult | null>(null)
  const [transaction, setTransaction] = useState<TransactionUpdate | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const data = result?.account === account ? result.data ?? null : null
  const validation = useMemo(
    () => data ? validateBatchRows(rows, data.tokenDecimals) : null,
    [data, rows],
  )

  useEffect(() => {
    if (!account || walletStatus !== 'connected') return

    let cancelled = false
    loadCreateBatch(account)
      .then((batchData) => {
        if (cancelled) return
        setResult({ account, data: batchData })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setResult({ account, error: getVestingErrorMessage(error) })
      })

    return () => {
      cancelled = true
    }
  }, [account, walletStatus])

  function addRow() {
    setRows((current) => {
      if (current.length >= MAX_BATCH_ROWS) return current
      return [...current, emptyRow(nextRowId.current++)]
    })
  }

  function removeRow(id: number) {
    setRows((current) => current.length === 1 ? current : current.filter((row) => row.id !== id))
  }

  function updateRow(id: number, field: keyof BatchRowInput, value: string) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    if (!account || !data || !validation?.isValid) {
      setTransaction({ state: 'error', message: validation?.error ?? 'The batch is not ready.' })
      return
    }

    setTransaction({ state: 'loading', message: 'Preparing the batch transaction...' })
    try {
      await createBatch(account, rows, setTransaction)
      setResult({ account, data: await loadCreateBatch(account) })
    } catch (error) {
      setTransaction(getVestingFailure(error))
    }
  }

  if (!account) {
    return (
      <div className="page-frame create-batch-page">
        <h1>Create Batch</h1>
        <TxStatus state="disconnected" message="Connect the admin wallet to create a batch." />
      </div>
    )
  }
  if (walletStatus !== 'connected') {
    return <div className="page-frame create-batch-page"><h1>Create Batch</h1><TxStatus state="error" message="Switch to the configured network to load VESTA." /></div>
  }
  if (!result || result.account !== account) {
    return <div className="page-frame create-batch-page"><h1>Create Batch</h1><TxStatus state="loading" message="Loading token balance, allowance, and admin access..." /></div>
  }
  if (result.error || !data) {
    return <div className="page-frame create-batch-page"><h1>Create Batch</h1><TxStatus state="error" message={result.error ?? 'Unable to load VESTA.'} /></div>
  }

  if (!data.isAdmin) {
    return (
      <div className="page-frame create-batch-page">
        <h1>Create Batch</h1>
        <p className="contract-line">Contract: {data.contractAddress}</p>
        <TxStatus state="error" message={`Only the on-chain admin ${shortAddress(data.admin)} can create batches.`} />
      </div>
    )
  }

  const approvalRequired = Boolean(
    validation?.totalBaseUnits !== null &&
    validation?.totalBaseUnits !== undefined &&
    data.allowanceBaseUnits < validation.totalBaseUnits,
  )
  const transactionBusy = transaction?.state === 'loading' || transaction?.state === 'pending'
  const createStepActive = !approvalRequired || transaction?.message.toLowerCase().includes('batch')

  return (
    <div className="page-frame create-batch-page">
      <h1>Create Batch</h1>
      <p className="contract-line">Contract: {data.contractAddress}</p>
      <p className="contract-line">Token: {data.tokenAddress} ({data.tokenSymbol})</p>
      <LayoutGroup>
        <div className="stepper">
          <motion.span layout className="step active">Approve Token</motion.span>
          <span className="step-dots">••••</span>
          <motion.span layout className={createStepActive ? 'step active' : 'step'}>Create Batch</motion.span>
        </div>
      </LayoutGroup>
      <h2>Summary</h2>
      <Card className="stats-grid batch-summary">
        <StatCard label={`Total Allocation (${data.tokenSymbol})`} value={validation?.total ?? '—'} icon={<IconScale size={17} stroke={1.8} />} />
        <StatCard label={`Wallet Balance (${data.tokenSymbol})`} value={data.walletBalance} icon={<IconWallet size={17} stroke={1.8} />} />
        <StatCard label={`Current Allowance (${data.tokenSymbol})`} value={data.allowance} icon={<IconCircleCheck size={17} stroke={1.8} />} />
      </Card>
      <Card>
        <div className="section-heading">
          <div>
            <h2>All Schedules</h2>
            <p className="form-help">Times are absolute Unix seconds. Leave cliff blank to use start.</p>
          </div>
          <button className="back-button" type="button" onClick={addRow} disabled={rows.length >= MAX_BATCH_ROWS}>
            <IconPlus size={17} stroke={2} /> Add Row
          </button>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <div className="batch-form">
            <div className="batch-row batch-row-header" aria-hidden="true">
              <span>Beneficiary</span><span>Allocation</span><span>Start</span>
              <span>Cliff (optional)</span><span>Duration</span><span />
            </div>
            <AnimatePresence initial={false}>
              {rows.map((row, index) => (
                <motion.div
                  className="batch-entry"
                  key={row.id}
                  layout
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="batch-row">
                    <input
                      value={row.beneficiary}
                      onChange={(event) => updateRow(row.id, 'beneficiary', event.target.value)}
                      placeholder="0x..."
                      aria-label={`Beneficiary row ${index + 1}`}
                    />
                    <input
                      value={row.amount}
                      onChange={(event) => updateRow(row.id, 'amount', event.target.value)}
                      placeholder="0.00"
                      inputMode="decimal"
                      aria-label={`Allocation row ${index + 1}`}
                    />
                    <input
                      value={row.start}
                      onChange={(event) => updateRow(row.id, 'start', event.target.value)}
                      placeholder="Unix seconds"
                      inputMode="numeric"
                      aria-label={`Start row ${index + 1}`}
                    />
                    <input
                      value={row.cliff}
                      onChange={(event) => updateRow(row.id, 'cliff', event.target.value)}
                      placeholder="Defaults to start"
                      inputMode="numeric"
                      aria-label={`Cliff row ${index + 1}`}
                    />
                    <input
                      value={row.duration}
                      onChange={(event) => updateRow(row.id, 'duration', event.target.value)}
                      placeholder="Seconds"
                      inputMode="numeric"
                      aria-label={`Duration row ${index + 1}`}
                    />
                    <button
                      className="remove-row"
                      type="button"
                      disabled={rows.length === 1}
                      aria-label={`Remove row ${index + 1}`}
                      onClick={() => removeRow(row.id)}
                    >
                      <IconTrash size={17} stroke={1.8} />
                    </button>
                  </div>
                  {submitted && validation?.rowErrors[index]?.length ? (
                    <p className="form-error" role="alert">Row {index + 1}: {validation.rowErrors[index].join(' ')}</p>
                  ) : null}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          {submitted && validation?.error && <p className="form-error" role="alert">{validation.error}</p>}
          <Button
            type="submit"
            variant="success"
            className="full-width"
            icon={<IconCheck size={18} stroke={2} />}
            disabled={transactionBusy}
          >
            {transactionBusy ? 'Transaction in progress...' : approvalRequired ? 'Approve & Create Batch' : 'Create Batch'}
          </Button>
          {transaction && <TxStatus state={transaction.state} message={transaction.message} />}
        </form>
      </Card>
    </div>
  )
}

function emptyRow(id: number): EditableBatchRow {
  return { id, beneficiary: '', amount: '', start: '', cliff: '', duration: '' }
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
