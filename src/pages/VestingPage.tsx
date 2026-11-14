import { useEffect, useState } from 'react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatCard } from '../components/ui/StatCard'
import { IconCash, IconDeviceFloppy, IconHandStop, IconLock } from '@tabler/icons-react'
import { Stagger, StaggerItem } from '../motion/primitives'
import { motion } from 'motion/react'
import type { ContractSchedule } from '../offchain/types'
import { formatRole, type DatabaseClient, type RecipientProfile } from '../offchain/types'
import { OffchainService } from '../offchain/service'
import { supabase } from '../features/auth/supabase'
import { useAuth } from '../features/auth/useAuth'
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
  shortenAddress,
} from '../features/vesting/contract'

type LoadedSchedule = ContractSchedule & { vested: bigint; claimable: bigint }

function formatDate(timestamp: bigint) {
  return new Date(Number(timestamp) * 1000).toLocaleDateString()
}

export function VestingPage() {
  const { account } = useWallet()
  const { user, roles } = useAuth()
  const [schedules, setSchedules] = useState<LoadedSchedule[]>([])
  const [decimals, setDecimals] = useState(18)
  const [loading, setLoading] = useState(false)
  const [claiming, setClaiming] = useState<bigint | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [now] = useState(() => BigInt(Math.floor(Date.now() / 1000)))
  const [profile, setProfile] = useState<RecipientProfile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [employeeReference, setEmployeeReference] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [tokenBalance, setTokenBalance] = useState<bigint | null>(null)
  const [tokenDecimals, setTokenDecimals] = useState(18)
  const [profileEditorOpen, setProfileEditorOpen] = useState(false)

  useEffect(() => {
    if (!account || !user || !supabase) return
    let cancelled = false

    async function loadProfile() {
      setProfileLoading(true)
      setProfileError(null)
      try {
        const service = new OffchainService(supabase as unknown as DatabaseClient)
        const loaded = await service.getProfile(account)
        if (cancelled) return
        setProfile(loaded)
        setDisplayName(loaded?.displayName ?? '')
        setEmployeeReference(loaded?.employeeReference ?? '')
        setProfileEditorOpen(!loaded)
      } catch (loadError) {
        if (!cancelled) setProfileError(loadError instanceof Error ? loadError.message : 'Failed to read recipient profile.')
      } finally {
        if (!cancelled) setProfileLoading(false)
      }
    }

    void loadProfile()
    return () => {
      cancelled = true
    }
  }, [account, user])

  useEffect(() => {
    if (!account) return
    let cancelled = false

    async function loadTokenBalance() {
      try {
        const token = getTokenContract(getBrowserProvider())
        const [balance, decimalsValue] = await Promise.all([
          token.balanceOf(account) as Promise<bigint>,
          token.decimals() as Promise<number>,
        ])
        if (cancelled) return
        setTokenBalance(BigInt(balance))
        setTokenDecimals(Number(decimalsValue))
      } catch {
        if (!cancelled) setTokenBalance(null)
      }
    }

    void loadTokenBalance()
    return () => { cancelled = true }
  }, [account])

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

  async function saveProfile() {
    if (!account || !user || !supabase) return
    if (!displayName.trim()) {
      setProfileError('Display name is required.')
      return
    }
    setProfileSaving(true)
    setProfileError(null)
    try {
      const service = new OffchainService(supabase as unknown as DatabaseClient)
      const saved = await service.upsertProfile({
        userId: user.id,
        walletAddress: account,
        displayName: displayName.trim(),
        employeeReference: employeeReference.trim() || null,
        metadata: profile?.metadata ?? {},
      })
      setProfile(saved)
      setDisplayName(saved.displayName)
      setEmployeeReference(saved.employeeReference ?? '')
      setProfileEditorOpen(false)
      window.dispatchEvent(new CustomEvent('vesta:profile-updated', { detail: { displayName: saved.displayName } }))
    } catch (saveError) {
      setProfileError(saveError instanceof Error ? saveError.message : 'Failed to save recipient profile.')
    } finally {
      setProfileSaving(false)
    }
  }

  return (
    <div className="page-frame">
      <h1>My Vesting</h1>
      <p className="contract-line" title={managerAddress}>Contract: {managerAddress ? shortenAddress(managerAddress) : 'VITE_CONTRACT_ADDRESS missing'}</p>
      {error && <p className="modal-error" role="alert">{error}</p>}
      {!account && <p className="muted">Connect the beneficiary wallet to load schedules.</p>}
      {(profileEditorOpen || !profile) ? (
        <Card>
          <h2>{profile ? 'Update Profile' : 'Complete Profile'}</h2>
          <p className="contract-line">Save a display name once. It will appear in your profile and member directory.</p>
          <div className="tag-row profile-summary" aria-label="Wallet summary">
            <span title={account ?? undefined}>Wallet {account ? shortenAddress(account) : 'Not connected'}</span>
            <span>Role {roles.length > 0 ? roles.map(formatRole).join(', ') : 'Employee'}</span>
            <span>VESTA {tokenBalance === null ? '—' : formatTokenAmount(tokenBalance, tokenDecimals)}</span>
          </div>
          {profileLoading && <p className="muted">Reading profile...</p>}
          {profileError && <p className="modal-error" role="alert">{profileError}</p>}
          {account && user && supabase ? (
            <div className="profile-form">
              <label className="profile-field">Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" aria-label="Display name" /></label>
              <label className="profile-field">Employee reference <span>(optional)</span><input value={employeeReference} onChange={(event) => setEmployeeReference(event.target.value)} placeholder="Employee reference" aria-label="Employee reference" /></label>
              <div className="profile-actions">
                <Button type="button" onClick={() => void saveProfile()} disabled={profileSaving} icon={<IconDeviceFloppy size={18} stroke={2} />}>
                  {profileSaving ? 'Saving...' : 'Save Profile'}
                </Button>
                {profile && <Button type="button" variant="secondary" onClick={() => setProfileEditorOpen(false)} disabled={profileSaving}>Cancel</Button>}
              </div>
            </div>
          ) : <p className="muted">Login with the wallet to manage your profile.</p>}
        </Card>
      ) : (
        <Card className="profile-saved-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Profile</p>
              <h2>{profile.displayName}</h2>
              <p className="contract-line">{shortenAddress(profile.walletAddress)} · {roles.length > 0 ? roles.map(formatRole).join(', ') : 'Employee'}</p>
            </div>
            <Button type="button" variant="secondary" onClick={() => setProfileEditorOpen(true)}>Update Profile</Button>
          </div>
        </Card>
      )}
      <Card className="assigned-schedules">
        <h2>Schedules Assigned</h2>
        {loading && <p className="muted">Reading live vesting data...</p>}
        {!loading && account && schedules.length === 0 && <p className="muted">Nothing assigned yet.</p>}
      </Card>
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
