import { useEffect, useState } from 'react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatCard } from '../components/ui/StatCard'
import { IconCash, IconLock, IconHandStop } from '@tabler/icons-react'
import { Stagger, StaggerItem } from '../motion/primitives'
import { motion } from 'motion/react'
import type { ContractSchedule } from '../offchain/types'
import { useWallet } from '../features/wallet/useWallet'
import {
  formatTokenAmount,
  getBrowserProvider,
  getManagerContract,
  getScheduleStatus,
  getSigner,
  getTokenContract,
  managerAddress,
  readSchedule,
} from '../features/vesting/contract'

type LoadedSchedule = ContractSchedule & { vested: bigint; claimable: bigint }

function formatDate(timestamp: bigint) {
  return new Date(Number(timestamp) * 1000).toLocaleDateString()
}

export function VestingPage() {
  const { account } = useWallet()
  const [schedules, setSchedules] = useState<LoadedSchedule[]>([])
  const [decimals, setDecimals] = useState(18)
  const [loading, setLoading] = useState(false)
  const [claiming, setClaiming] = useState<bigint | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [now] = useState(() => BigInt(Math.floor(Date.now() / 1000)))

  useEffect(() => {
    let cancelled = false

    async function loadSchedules() {
      if (!account) {
        setSchedules([])
        return
      }

      setLoading(true)
      setError(null)
      try {
        const provider = getBrowserProvider()
        const manager = getManagerContract(provider)
        const tokenContract = getTokenContract(provider)
        const tokenDecimals = await tokenContract.decimals() as number
        const ids = await manager.getBeneficiarySchedules(account) as bigint[]
        const loaded = await Promise.all(ids.map(async (id) => {
          const schedule = await readSchedule(manager, BigInt(id))
          return {
            ...schedule,
            vested: BigInt(await manager.vestedAmount(schedule.scheduleId)),
            claimable: BigInt(await manager.claimableAmount(schedule.scheduleId)),
          }
        }))

        if (cancelled) return
        setDecimals(Number(tokenDecimals))
        setSchedules(loaded)
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Failed to read your vesting schedules.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadSchedules()
    return () => {
      cancelled = true
    }
  }, [account, refresh])

  async function claim(scheduleId: bigint) {
    setClaiming(scheduleId)
    setError(null)
    try {
      const manager = getManagerContract(await getSigner())
      const transaction = await manager.claim(scheduleId)
      await transaction.wait()
      setRefresh((current) => current + 1)
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : 'Claim transaction failed.')
    } finally {
      setClaiming(null)
    }
  }

  return (
    <div className="page-frame">
      <h1>My Vesting</h1>
      <p className="contract-line">Contract: {managerAddress || 'VITE_CONTRACT_ADDRESS missing'}</p>
      {error && <p className="modal-error" role="alert">{error}</p>}
      {!account && <p className="muted">Connect the beneficiary wallet to load schedules.</p>}
      {loading && <p className="muted">Reading live vesting data...</p>}
      {!loading && account && schedules.length === 0 && <p className="muted">No schedules are assigned to this wallet.</p>}
      <Stagger className="vesting-grid">
        {schedules.map((schedule) => {
          const status = getScheduleStatus(schedule, now)
          const elapsed = now > schedule.start ? now - schedule.start : 0n
          const progress = schedule.duration > 0n
            ? Math.min(12, Math.floor(Number((elapsed * 12n) / schedule.duration)))
            : 0
          const canClaim = schedule.claimable > 0n
          return (
          <StaggerItem key={schedule.scheduleId.toString()}>
          <Card>
            <h2>Schedule #{schedule.scheduleId.toString()}</h2>
            <div className="tag-row"><span>Starts {formatDate(schedule.start)}</span><span>{Math.floor(Number(schedule.duration) / 86400)} days</span><span>Cliff {Math.floor(Number(schedule.cliff) / 86400)} days</span></div>
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
              <StatCard label="Vested" value={formatTokenAmount(schedule.vested, decimals)} icon={<IconLock size={17} stroke={1.8} />} />
              <StatCard label="Released" value={formatTokenAmount(schedule.released, decimals)} icon={<IconCash size={17} stroke={1.8} />} />
              <StatCard label="Claimable" value={formatTokenAmount(schedule.claimable, decimals)} icon={<IconHandStop size={17} stroke={1.8} />} accent />
            </div>
            <Button variant={canClaim ? 'success' : 'secondary'} disabled={!canClaim || claiming !== null} className="full-width" icon={<IconHandStop size={18} stroke={2} />} onClick={() => void claim(schedule.scheduleId)}>
              {claiming === schedule.scheduleId ? 'Confirming...' : canClaim ? 'Claim' : status}
            </Button>
          </Card>
          </StaggerItem>
          )
        })}
      </Stagger>
    </div>
  )
}
