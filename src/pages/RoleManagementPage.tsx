import { useEffect, useState } from 'react'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { APPLICATION_ROLES, type ApplicationRole, type DatabaseClient, type UserRoleRecord } from '../offchain/types'
import { OffchainService } from '../offchain/service'
import { supabase } from '../features/auth/supabase'
import { useAuth } from '../features/auth/useAuth'
import { useWallet } from '../features/wallet/useWallet'

export function RoleManagementPage() {
  const { hasRole } = useAuth()
  const { account } = useWallet()
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
      setRoles(await service.listRoles())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load roles.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (hasRole('company_admin')) queueMicrotask(() => void reload())
  }, [hasRole])

  async function assign() {
    if (!supabase || !walletAddress.trim()) {
      setError('Enter the team member wallet address.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const service = new OffchainService(supabase as unknown as DatabaseClient)
      await service.assignRole(walletAddress.trim(), role)
      setWalletAddress('')
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
      <p className="contract-line">Roles control application access. Ask each team member to sign in once, then assign a role using their wallet address. Smart-contract admin access is still enforced by the wallet on-chain.</p>
      <Card>
        <h2>Assign Role</h2>
        <div className="role-form">
          <input value={walletAddress} onChange={(event) => setWalletAddress(event.target.value)} placeholder="Team member wallet address" aria-label="Team member wallet address" />
          <select value={role} onChange={(event) => setRole(event.target.value as ApplicationRole)} aria-label="Application role">
            {APPLICATION_ROLES.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <Button type="button" onClick={() => void assign()} disabled={loading} icon={<IconPlus size={18} stroke={2} />}>Assign</Button>
        </div>
        {error && <p className="modal-error" role="alert">{error}</p>}
      </Card>
      <Card>
        <h2>Current Roles</h2>
        {loading && <p className="muted">Loading roles...</p>}
        <div className="role-list">
          {roles.map((record) => (
            <div className="role-row" key={`${record.userId}-${record.role}`}>
              <span className="role-user" title={record.walletAddress}>{`${record.walletAddress.slice(0, 6)}...${record.walletAddress.slice(-4)}`}</span>
              <strong>{record.role}</strong>
              <button className="icon-button" type="button" title="Remove role" aria-label={`Remove ${record.role} from ${record.walletAddress}`} disabled={record.walletAddress.toLowerCase() === account?.toLowerCase() && record.role === 'company_admin'} onClick={() => void remove(record)}>
                <IconTrash size={17} stroke={1.8} />
              </button>
            </div>
          ))}
          {!loading && roles.length === 0 && <p className="muted">No role records found.</p>}
        </div>
      </Card>
    </div>
  )
}
