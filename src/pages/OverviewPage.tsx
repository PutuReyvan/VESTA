import { useEffect, useState, type ReactNode } from 'react'
import type { ContractSchedule } from '../offchain/types'
import { Card } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import { IconCalendar, IconCash, IconLock, IconUsers, IconCircleCheck } from '@tabler/icons-react'
import { Reveal, Stagger, StaggerItem } from '../motion/primitives'
import { useWallet } from '../features/wallet/useWallet'
import {
  formatTokenAmount,
  getBrowserProvider,
  getManagerContract,
  getScheduleStatus,
  getTokenContract,
  isOnChainAdmin,
  managerAddress,
  readSchedule,
  tokenAddress,
} from '../features/vesting/contract'

type LoadedSchedule = ContractSchedule & { vested: bigint; claimable: bigint }

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function OverviewPage() {
  const { account } = useWallet()
  const [schedules, setSchedules] = useState<LoadedSchedule[]>([])
  const [decimals, setDecimals] = useState(18)
  const [managerAdmin, setManagerAdmin] = useState<string | null>(null)
  const [managerBalance, setManagerBalance] = useState<bigint>(0n)
  const [batchCount, setBatchCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now] = useState(() => BigInt(Math.floor(Date.now() / 1000)))

  useEffect(() => {
    let cancelled = false

    async function loadContractData() {
      if (!account) {
        setSchedules([])
        setManagerAdmin(null)
        setManagerBalance(0n)
        setBatchCount(null)
        return
      }

      setLoading(true)
      setError(null)
      try {
        const provider = getBrowserProvider()
        const manager = getManagerContract(provider)
        const token = getTokenContract(provider)
        const [admin, nextId, tokenDecimals, balance] = await Promise.all([
          manager.admin() as Promise<string>,
          manager.nextScheduleId() as Promise<bigint>,
          token.decimals() as Promise<number>,
          token.balanceOf(managerAddress) as Promise<bigint>,
        ])
        const count = Number(nextId)
        if (count > 1000) throw new Error('Refusing to load more than 1,000 schedules in one browser request.')

        const loaded = await Promise.all(
          Array.from({ length: count }, (_, index) => readSchedule(manager, BigInt(index)).then(async (schedule) => ({
            ...schedule,
            vested: BigInt(await manager.vestedAmount(schedule.scheduleId)),
            claimable: BigInt(await manager.claimableAmount(schedule.scheduleId)),
          })),
        ))

        let batches: number | null = null
        try {
          batches = (await manager.queryFilter(manager.filters.BatchCreated())).length
        } catch {
          // Some public RPC endpoints restrict historical log queries. Schedule
          // data remains authoritative when this count is unavailable.
        }

        if (cancelled) return
        setDecimals(Number(tokenDecimals))
        setManagerAdmin(admin)
        setManagerBalance(BigInt(balance))
        setBatchCount(batches)
        setSchedules(loaded)
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Failed to read the Sepolia contract.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadContractData()
    return () => {
      cancelled = true
    }
  }, [account])

  const totalReleased = schedules.reduce((total, schedule) => total + schedule.released, 0n)
  const isAdmin = Boolean(account && managerAdmin && isOnChainAdmin(account, managerAdmin))

  return (
    <PageFrame title="VESTA Overview">
      <p className="contract-line">Contract: {managerAddress || 'VITE_CONTRACT_ADDRESS missing'}</p>
      <p className="contract-line">Token: {tokenAddress || 'VITE_TOKEN_ADDRESS missing'}</p>
      {managerAdmin && (
        <p className="contract-line">
          On-chain admin: {shortenAddress(managerAdmin)} · {isAdmin ? 'Connected wallet is admin' : 'Connected wallet is not admin'}
        </p>
      )}
      {loading && <p className="muted">Reading live Sepolia data...</p>}
      {error && <p className="modal-error" role="alert">{error}</p>}
      {!account && <p className="muted">Connect the wallet to read the deployed contract.</p>}
      <Stagger className="card stats-grid">
        <StatCard label="Locked In Contract" value={formatTokenAmount(managerBalance, decimals)} icon={<IconLock size={17} stroke={1.8} />} />
        <StatCard label="Total Released" value={formatTokenAmount(totalReleased, decimals)} icon={<IconCash size={17} stroke={1.8} />} />
        <StatCard label="Schedules" value={String(schedules.length)} icon={<IconCalendar size={17} stroke={1.8} />} />
        <StatCard label="Batches" value={batchCount === null ? '—' : String(batchCount)} icon={<IconUsers size={17} stroke={1.8} />} />
      </Stagger>
      <Reveal>
        <Card>
        <h2>All Schedules</h2>
        <div className="table">
          <div className="table-row table-header">
            <span>ID</span><span>Beneficiary</span><span>Allocation</span>
            <span>Vested</span><span>Released</span><span>Status</span>
          </div>
          {schedules.length === 0 && !loading && <p className="muted">No schedules found on this deployment.</p>}
          <Stagger className="table-row-stagger">
          {schedules.map((schedule) => {
            const status = getScheduleStatus(schedule, now)
            return (
              <StaggerItem className="table-row" key={schedule.scheduleId.toString()}>
                <span>#{schedule.scheduleId.toString()}</span><span>{shortenAddress(schedule.beneficiary)}</span>
                <span>{formatTokenAmount(schedule.allocation, decimals)}</span><span>{formatTokenAmount(schedule.vested, decimals)}</span>
                <span>{formatTokenAmount(schedule.released, decimals)}</span><span className={status === 'Released' ? 'status-pill active' : 'status-pill cliff'}><IconCircleCheck size={15} stroke={2} />{status}</span>
              </StaggerItem>
            )
          })}
          </Stagger>
        </div>
        </Card>
      </Reveal>
    </PageFrame>
  )
}

function PageFrame({ title, children }: { title: string; children: ReactNode }) {
  return <div className="page-frame"><h1>{title}</h1>{children}</div>
}
