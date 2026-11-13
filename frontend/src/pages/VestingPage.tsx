import { useEffect, useState } from 'react'
import { IconCash, IconHandStop, IconLock } from '@tabler/icons-react'
import { motion } from 'motion/react'
import { TxStatus } from '../components/TxStatus'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import {
  claimSchedule,
  getVestingErrorMessage,
  getVestingFailure,
  loadMyVesting,
  type MyVestingData,
  type TransactionUpdate,
  type VestingSchedule,
} from '../features/vesting'
import { useWallet } from '../features/wallet/useWallet'
import { Stagger, StaggerItem } from '../motion/primitives'

interface VestingResult {
  account: string
  data?: MyVestingData
  error?: string
}

export function VestingPage() {
  const { account, status: walletStatus } = useWallet()
  const [result, setResult] = useState<VestingResult | null>(null)
  const [claims, setClaims] = useState<Record<string, TransactionUpdate>>({})

  useEffect(() => {
    if (!account || walletStatus !== 'connected') return

    let cancelled = false
    loadMyVesting(account)
      .then((vesting) => {
        if (cancelled) return
        setResult({ account, data: vesting })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setResult({ account, error: getVestingErrorMessage(error) })
      })

    return () => {
      cancelled = true
    }
  }, [account, walletStatus])

  async function handleClaim(scheduleId: string) {
    if (!account) return
    setClaims((current) => ({
      ...current,
      [scheduleId]: { state: 'loading', message: `Preparing claim for schedule #${scheduleId}...` },
    }))
    try {
      await claimSchedule(account, scheduleId, (update) => {
        setClaims((current) => ({ ...current, [scheduleId]: update }))
      })
      setResult({ account, data: await loadMyVesting(account) })
    } catch (error) {
      const failure = getVestingFailure(error)
      setClaims((current) => ({ ...current, [scheduleId]: failure }))
    }
  }

  if (!account) {
    return (
      <div className="page-frame">
        <h1>My Vesting</h1>
        <TxStatus state="disconnected" message="Connect your wallet to load your schedules." />
      </div>
    )
  }
  if (walletStatus !== 'connected') {
    return <div className="page-frame"><h1>My Vesting</h1><TxStatus state="error" message="Switch to the configured network to load VESTA." /></div>
  }
  if (!result || result.account !== account) {
    return <div className="page-frame"><h1>My Vesting</h1><TxStatus state="loading" message="Loading your on-chain vesting schedules..." /></div>
  }
  if (result.error || !result.data) {
    return <div className="page-frame"><h1>My Vesting</h1><TxStatus state="error" message={result.error ?? 'Unable to load VESTA.'} /></div>
  }
  const data = result.data

  return (
    <div className="page-frame">
      <h1>My Vesting</h1>
      <p className="contract-line">Contract: {data.contractAddress}</p>
      {data.schedules.length === 0 ? (
        <Card><p className="empty-state">This wallet has no vesting schedules.</p></Card>
      ) : (
        <Stagger className="vesting-grid">
          {data.schedules.map((schedule) => {
            const claim = claims[schedule.id]
            const claimable = schedule.status === 'Claimable'
            const busy = claim?.state === 'loading' || claim?.state === 'pending'
            const progress = getProgress(schedule)

            return (
              <StaggerItem key={schedule.id}>
                <Card>
                  <h2>Schedule #{schedule.id}</h2>
                  <div className="tag-row">
                    <span>Start {formatDate(schedule.start)}</span>
                    <span>{formatDuration(schedule.duration)}</span>
                    <span>{schedule.cliff === schedule.start ? 'No cliff' : `Cliff ${formatDate(schedule.cliff)}`}</span>
                  </div>
                  <div className="progress-row">
                    {Array.from({ length: 12 }, (_, index) => (
                      <motion.span
                        className={index < progress ? 'filled' : ''}
                        initial={{ scaleX: index < progress ? 0 : 1 }}
                        animate={{ scaleX: 1 }}
                        style={{ transformOrigin: 'left center' }}
                        key={index}
                      />
                    ))}
                  </div>
                  <div className="stats-grid compact">
                    <StatCard label={`Vested (${data.tokenSymbol})`} value={schedule.vested} icon={<IconLock size={17} stroke={1.8} />} />
                    <StatCard label={`Released (${data.tokenSymbol})`} value={schedule.released} icon={<IconCash size={17} stroke={1.8} />} />
                    <StatCard label={`Claimable (${data.tokenSymbol})`} value={schedule.claimable} icon={<IconHandStop size={17} stroke={1.8} />} accent />
                  </div>
                  <Button
                    type="button"
                    variant={claimable ? 'success' : 'secondary'}
                    disabled={!claimable || busy}
                    className="full-width"
                    icon={<IconHandStop size={18} stroke={2} />}
                    onClick={() => handleClaim(schedule.id)}
                  >
                    {busy ? 'Claim in progress...' : claimable ? 'Claim' : claimLabel(schedule)}
                  </Button>
                  {claim && <TxStatus state={claim.state} message={claim.message} />}
                </Card>
              </StaggerItem>
            )
          })}
        </Stagger>
      )}
    </div>
  )
}

function getProgress(schedule: VestingSchedule) {
  const elapsed = Math.floor(Date.now() / 1000) - schedule.start
  if (elapsed <= 0) return 0
  return Math.min(12, Math.floor((elapsed / schedule.duration) * 12))
}

function claimLabel(schedule: VestingSchedule) {
  if (schedule.status === 'Released') return 'Fully released'
  if (schedule.status === 'In Cliff') return `Available ${formatDate(schedule.cliff)}`
  return 'Nothing to claim'
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(timestamp * 1000)
}

function formatDuration(seconds: number) {
  const days = seconds / 86_400
  return Number.isInteger(days) ? `${days} day${days === 1 ? '' : 's'}` : `${seconds} seconds`
}
