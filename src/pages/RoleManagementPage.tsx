import { useEffect, useMemo, useState } from 'react'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import {
  APPLICATION_ROLES,
  formatRole,
  type ApplicationRole,
  type DatabaseClient,
  type RecipientProfile,
  type UserRoleRecord,
} from '../offchain/types'
import { OffchainService } from '../offchain/service'
import { supabase } from '../features/auth/supabase'
import { useAuth } from '../features/auth/useAuth'
import { useWallet } from '../features/wallet/useWallet'
import { shortenAddress } from '../features/vesting/contract'

export function RoleManagementPage() {
  const { hasRole } = useAuth()
  const { account } = useWallet()
  const [profiles, setProfiles] = useState<RecipientProfile[]>([])
  const [roles, setRoles] = useState<UserRoleRecord[]>([])
  const [walletAddress, setWalletAddress] = useState('')
  const [role, setRole] = useState<ApplicationRole>('employee')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    if (!supabase) return
    setLoading(true)
    setError(null)
    try {
      const service = new OffchainService(supabase as unknown as DatabaseClient)
      const [loadedProfiles, loadedRoles] = await Promise.all([
        service.listProfiles(),
        service.listRoles(),
      ])
      setProfiles(loadedProfiles)
      setRoles(loadedRoles)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load members.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (hasRole('company_admin')) queueMicrotask(() => void reload())
  }, [hasRole])

  const selectedProfile = profiles.find((profile) => profile.walletAddress === walletAddress)
  const memberRoles = useMemo(() => {
    const byWallet = new Map<string, ApplicationRole[]>()
    for (const record of roles) {
      const key = record.walletAddress.toLowerCase()
      byWallet.set(key, [...(byWallet.get(key) ?? []), record.role])
    }
    return byWallet
  }, [roles])

  async function assign() {
    if (!supabase || !walletAddress) {
      setError('Select a registered member first.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const service = new OffchainService(supabase as unknown as DatabaseClient)
      await service.assignRole(walletAddress, role)
      await reload()
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : 'Failed to assign role.')
      setLoading(false)
    }
  }

  async function remove(record: UserRoleRecord) {
    if (!supabase) return
    setLoading(true)
    setError(null)
    try {
      const service = new OffchainService(supabase as unknown as DatabaseClient)
      await service.removeRole(record.walletAddress, record.role)
      await reload()
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Failed to remove role.')
      setLoading(false)
    }
  }

  if (!hasRole('company_admin')) {
    return <div className="page-frame"><h1>Role Management</h1><p className="modal-error">Only company admins can manage roles.</p></div>
  }

  return (
    <div className="page-frame">
      <h1>Role Management</h1>
      <p className="contract-line">Select a registered member by name. The wallet address remains the identity used for on-chain access.</p>
      <Card>
        <h2>Assign Role</h2>
        <div className="role-form">
          <select value={walletAddress} onChange={(event) => setWalletAddress(event.target.value)} aria-label="Registered member">
            <option value="">Select member</option>
            {profiles.map((profile) => <option key={profile.walletAddress} value={profile.walletAddress}>{profile.displayName} · {shortenAddress(profile.walletAddress)}</option>)}
          </select>
          <select value={role} onChange={(event) => setRole(event.target.value as ApplicationRole)} aria-label="Application role">
            {APPLICATION_ROLES.map((option) => <option key={option} value={option}>{formatRole(option)}</option>)}
          </select>
          <Button type="button" onClick={() => void assign()} disabled={loading || !walletAddress} icon={<IconPlus size={18} stroke={2} />}>Assign</Button>
        </div>
        {selectedProfile && <p className="role-selection"><strong>{selectedProfile.displayName}</strong><span>{shortenAddress(selectedProfile.walletAddress)}</span></p>}
        {profiles.length === 0 && !loading && <p className="muted">No completed profiles yet. Each member must sign in and save a name first.</p>}
        {error && <p className="modal-error" role="alert">{error}</p>}
      </Card>
      <Card>
        <h2>Registered Members</h2>
        {loading && <p className="muted">Loading members...</p>}
        <div className="member-list">
          {profiles.map((profile) => {
            const profileRoles = memberRoles.get(profile.walletAddress.toLowerCase()) ?? []
            return (
              <div className="member-card" key={profile.walletAddress}>
                <div>
                  <strong>{profile.displayName}</strong>
                  <span title={profile.walletAddress}>{shortenAddress(profile.walletAddress)}</span>
                </div>
                <div className="member-roles">
                  {profileRoles.length > 0 ? profileRoles.map((memberRole) => {
                    const record = roles.find((entry) => entry.walletAddress.toLowerCase() === profile.walletAddress.toLowerCase() && entry.role === memberRole)
                    return record ? (
                      <span className="role-chip" key={`${record.walletAddress}-${record.role}`}>
                        {formatRole(record.role)}
                        <button type="button" title={`Remove ${formatRole(record.role)}`} aria-label={`Remove ${formatRole(record.role)} from ${profile.displayName}`} disabled={record.walletAddress.toLowerCase() === account?.toLowerCase() && record.role === 'company_admin'} onClick={() => void remove(record)}>
                          <IconTrash size={14} stroke={2} />
                        </button>
                      </span>
                    ) : null
                  }) : <span className="muted">No role assigned</span>}
                </div>
              </div>
            )
          })}
          {!loading && profiles.length === 0 && <p className="muted">No registered members found.</p>}
        </div>
      </Card>
    </div>
  )
}
