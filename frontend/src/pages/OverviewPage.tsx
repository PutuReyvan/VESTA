import { useEffect, useState, type ReactNode } from 'react'
import { IconCalendar, IconCash, IconCircleCheck, IconLock, IconUsers } from '@tabler/icons-react'
import { TxStatus } from '../components/TxStatus'
import { Card } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import {
  getVestingErrorMessage,
  loadOverview,
  type OverviewData,
} from '../features/vesting'
import { useWallet } from '../features/wallet/useWallet'
import { Reveal, Stagger, StaggerItem } from '../motion/primitives'

interface OverviewResult {
  account: string
  data?: OverviewData
  error?: string
}

export function OverviewPage() {
  const { account, status: walletStatus } = useWallet()
  const [result, setResult] = useState<OverviewResult | null>(null)

  useEffect(() => {
    if (!account || walletStatus !== 'connected') return

    let cancelled = false
    loadOverview(account)
      .then((overview) => {
        if (cancelled) return
        setResult({ account, data: overview })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setResult({ account, error: getVestingErrorMessage(error) })
      })

    return () => {
      cancelled = true
    }
  }, [account, walletStatus])

  if (!account) {
    return (
      <PageFrame title="VESTA Overview">
        <TxStatus state="disconnected" message="Connect your wallet to load the admin overview." />
      </PageFrame>
    )
  }
  if (walletStatus !== 'connected') {
    return <PageFrame title="VESTA Overview"><TxStatus state="error" message="Switch to the configured network to load VESTA." /></PageFrame>
  }
  if (!result || result.account !== account) {
    return <PageFrame title="VESTA Overview"><TxStatus state="loading" message="Loading contract, token, and schedule data..." /></PageFrame>
  }
  if (result.error || !result.data) {
    return <PageFrame title="VESTA Overview"><TxStatus state="error" message={result.error ?? 'Unable to load VESTA.'} /></PageFrame>
  }
  const data = result.data

  if (!data.isAdmin) {
    return (
      <PageFrame title="VESTA Overview">
        <p className="contract-line">Contract: {data.contractAddress}</p>
        <TxStatus
          state="error"
          message={`Admin access required. On-chain admin: ${shortAddress(data.admin)}`}
        />
      </PageFrame>
    )
  }

  return (
    <PageFrame title="VESTA Overview">
      <p className="contract-line">Contract: {data.contractAddress}</p>
      <p className="contract-line">Token: {data.tokenAddress} ({data.tokenSymbol})</p>
      <Stagger className="card stats-grid">
        <StatCard label={`Locked (${data.tokenSymbol})`} value={data.lockedBalance} icon={<IconLock size={17} stroke={1.8} />} />
        <StatCard label={`Total Released (${data.tokenSymbol})`} value={data.totalReleased} icon={<IconCash size={17} stroke={1.8} />} />
        <StatCard label="Schedules" value={String(data.schedules.length)} icon={<IconCalendar size={17} stroke={1.8} />} />
        <StatCard label="Batches" value={String(data.batches.length)} icon={<IconUsers size={17} stroke={1.8} />} />
      </Stagger>
      <Reveal>
        <Card>
          <h2>All Schedules</h2>
          <div className="table">
            <div className="table-row table-header">
              <span>ID</span><span>Beneficiary</span><span>Allocation</span>
              <span>Vested</span><span>Released</span><span>Status</span>
            </div>
            {data.schedules.length === 0 ? (
              <p className="empty-state">No schedules have been created.</p>
            ) : (
              <Stagger className="table-row-stagger">
                {data.schedules.map((schedule) => (
                  <StaggerItem className="table-row" key={schedule.id}>
                    <span>#{schedule.id}</span><span title={schedule.beneficiary}>{shortAddress(schedule.beneficiary)}</span>
                    <span>{schedule.allocation}</span><span>{schedule.vested}</span>
                    <span>{schedule.released}</span>
                    <span className={`status-pill ${schedule.status === 'In Cliff' ? 'cliff' : 'active'}`}>
                      <IconCircleCheck size={15} stroke={2} />{schedule.status}
                    </span>
                  </StaggerItem>
                ))}
              </Stagger>
            )}
          </div>
        </Card>
      </Reveal>
      <Reveal>
        <Card>
          <h2>Batch History</h2>
          <div className="table">
            <div className="table-row table-header batch-history-row">
              <span>Batch</span><span>First Schedule</span><span>Schedules</span><span>Allocation</span>
            </div>
            {data.batches.length === 0 ? (
              <p className="empty-state">No batches have been created.</p>
            ) : data.batches.map((batch) => (
              <div className="table-row batch-history-row" key={batch.id}>
                <span>#{batch.id}</span><span>#{batch.firstScheduleId}</span>
                <span>{batch.scheduleCount}</span><span>{batch.totalAllocation} {data.tokenSymbol}</span>
              </div>
            ))}
          </div>
        </Card>
      </Reveal>
    </PageFrame>
  )
}

function PageFrame({ title, children }: { title: string; children: ReactNode }) {
  return <div className="page-frame"><h1>{title}</h1>{children}</div>
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
