import {
  BrowserProvider,
  Contract,
  EventLog,
  ZeroAddress,
  formatUnits,
  getAddress,
  isAddress,
  isError,
  parseUnits,
  type ContractTransactionResponse,
  type Eip1193Provider,
} from 'ethers'
import type { TransactionState } from '../../types/app'

const VESTA_ABI = [
  'function token() view returns (address)',
  'function admin() view returns (address)',
  'function nextScheduleId() view returns (uint256)',
  'function createBatch(address tokenAddress, address[] beneficiaries, uint256[] allocations, uint64[] starts, uint64[] cliffs, uint64[] durations)',
  'function getSchedule(uint256 scheduleId) view returns (tuple(uint256 scheduleId, address beneficiary, uint256 allocation, uint64 start, uint64 cliff, uint64 duration, uint256 released))',
  'function getBeneficiarySchedules(address beneficiary) view returns (uint256[])',
  'function vestedAmount(uint256 scheduleId) view returns (uint256)',
  'function claimableAmount(uint256 scheduleId) view returns (uint256)',
  'function claim(uint256 scheduleId)',
  'event BatchCreated(address indexed admin, uint256 indexed firstScheduleId, uint256 scheduleCount, uint256 totalAllocation)',
] as const

const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
] as const

const MAX_UINT64 = (1n << 64n) - 1n
export const MAX_BATCH_ROWS = 20

export interface VestingSchedule {
  id: string
  beneficiary: string
  allocation: string
  vested: string
  released: string
  claimable: string
  start: number
  cliff: number
  duration: number
  status: 'In Cliff' | 'Active' | 'Claimable' | 'Released'
}

export interface BatchEvent {
  id: number
  firstScheduleId: string
  scheduleCount: string
  totalAllocation: string
}

export interface OverviewData {
  contractAddress: string
  tokenAddress: string
  tokenSymbol: string
  admin: string
  isAdmin: boolean
  lockedBalance: string
  totalReleased: string
  schedules: VestingSchedule[]
  batches: BatchEvent[]
}

export interface MyVestingData {
  contractAddress: string
  tokenSymbol: string
  schedules: VestingSchedule[]
}

export interface CreateBatchData {
  contractAddress: string
  tokenAddress: string
  tokenSymbol: string
  tokenDecimals: number
  walletBalance: string
  allowance: string
  allowanceBaseUnits: bigint
  admin: string
  isAdmin: boolean
}

export interface BatchRowInput {
  beneficiary: string
  amount: string
  start: string
  cliff: string
  duration: string
}

export interface BatchValidation {
  isValid: boolean
  total: string
  totalBaseUnits: bigint | null
  rowErrors: string[][]
  error: string | null
}

export interface TransactionUpdate {
  state: TransactionState
  message: string
}

interface PreparedBatch {
  beneficiaries: string[]
  allocations: bigint[]
  starts: bigint[]
  cliffs: bigint[]
  durations: bigint[]
  total: bigint
}

interface ContractContext {
  provider: BrowserProvider
  contractAddress: string
  contract: Contract
}

interface LoadedSchedule extends VestingSchedule {
  releasedBaseUnits: bigint
}

class RevertedTransactionError extends Error {}

export function getVestaContractAddress(): string {
  const configuredAddress = import.meta.env.VITE_VESTA_CONTRACT_ADDRESS
  if (!configuredAddress) {
    throw new Error('VITE_VESTA_CONTRACT_ADDRESS is not configured.')
  }
  if (!isAddress(configuredAddress)) {
    throw new Error('VITE_VESTA_CONTRACT_ADDRESS is not a valid address.')
  }
  return getAddress(configuredAddress)
}

export async function loadVestingAccess(account: string) {
  const { contractAddress, contract } = await getContractContext(account)
  const admin = getAddress(await contract.admin())
  return {
    contractAddress,
    admin,
    isAdmin: sameAddress(account, admin),
  }
}

export async function loadOverview(account: string): Promise<OverviewData> {
  const { contractAddress, contract } = await getContractContext(account)
  const [tokenAddressValue, adminValue, nextScheduleIdValue] = await Promise.all([
    contract.token(),
    contract.admin(),
    contract.nextScheduleId(),
  ])
  const tokenAddress = getAddress(tokenAddressValue)
  const admin = getAddress(adminValue)
  const token = new Contract(tokenAddress, ERC20_ABI, contract.runner)
  const [tokenSymbol, tokenDecimals] = await loadTokenMetadata(token)
  const isAdmin = sameAddress(account, admin)

  if (!isAdmin) {
    return {
      contractAddress,
      tokenAddress,
      tokenSymbol,
      admin,
      isAdmin,
      lockedBalance: '0',
      totalReleased: '0',
      schedules: [],
      batches: [],
    }
  }

  const scheduleCount = toSafeNumber(nextScheduleIdValue, 'schedule count')
  const [lockedBalanceValue, loadedSchedules, batchLogs] = await Promise.all([
    token.balanceOf(contractAddress),
    Promise.all(
      Array.from({ length: scheduleCount }, (_, id) =>
        loadSchedule(contract, BigInt(id), tokenDecimals),
      ),
    ),
    contract.queryFilter(contract.filters.BatchCreated()),
  ])
  const totalReleased = loadedSchedules.reduce(
    (total, schedule) => total + schedule.releasedBaseUnits,
    0n,
  )
  const schedules: VestingSchedule[] = loadedSchedules
  const batches = batchLogs
    .filter((event): event is EventLog => event instanceof EventLog)
    .map((event, index) => ({
      id: index + 1,
      firstScheduleId: event.args.firstScheduleId.toString(),
      scheduleCount: event.args.scheduleCount.toString(),
      totalAllocation: formatUnits(event.args.totalAllocation, tokenDecimals),
    }))
    .reverse()

  return {
    contractAddress,
    tokenAddress,
    tokenSymbol,
    admin,
    isAdmin,
    lockedBalance: formatUnits(lockedBalanceValue, tokenDecimals),
    totalReleased: formatUnits(totalReleased, tokenDecimals),
    schedules,
    batches,
  }
}

export async function loadMyVesting(account: string): Promise<MyVestingData> {
  const { contractAddress, contract } = await getContractContext(account)
  const tokenAddress = getAddress(await contract.token())
  const token = new Contract(tokenAddress, ERC20_ABI, contract.runner)
  const [tokenSymbol, tokenDecimals] = await loadTokenMetadata(token)
  const scheduleIds = (await contract.getBeneficiarySchedules(account)) as bigint[]
  const loadedSchedules = await Promise.all(
    scheduleIds.map((scheduleId) => loadSchedule(contract, scheduleId, tokenDecimals)),
  )
  const schedules: VestingSchedule[] = loadedSchedules

  return { contractAddress, tokenSymbol, schedules }
}

export async function loadCreateBatch(account: string): Promise<CreateBatchData> {
  const { contractAddress, contract } = await getContractContext(account)
  const [tokenAddressValue, adminValue] = await Promise.all([
    contract.token(),
    contract.admin(),
  ])
  const tokenAddress = getAddress(tokenAddressValue)
  const admin = getAddress(adminValue)
  const token = new Contract(tokenAddress, ERC20_ABI, contract.runner)
  const [[tokenSymbol, tokenDecimals], walletBalanceValue, allowanceValue] = await Promise.all([
    loadTokenMetadata(token),
    token.balanceOf(account),
    token.allowance(account, contractAddress),
  ])

  return {
    contractAddress,
    tokenAddress,
    tokenSymbol,
    tokenDecimals,
    walletBalance: formatUnits(walletBalanceValue, tokenDecimals),
    allowance: formatUnits(allowanceValue, tokenDecimals),
    allowanceBaseUnits: allowanceValue,
    admin,
    isAdmin: sameAddress(account, admin),
  }
}

export function validateBatchRows(
  rows: BatchRowInput[],
  tokenDecimals: number,
): BatchValidation {
  const { prepared, rowErrors, error } = prepareBatch(rows, tokenDecimals)
  return {
    isValid: prepared !== null,
    total: prepared ? formatUnits(prepared.total, tokenDecimals) : '—',
    totalBaseUnits: prepared?.total ?? null,
    rowErrors,
    error,
  }
}

export async function createBatch(
  account: string,
  rows: BatchRowInput[],
  onUpdate: (update: TransactionUpdate) => void,
): Promise<void> {
  const { provider, contractAddress, contract } = await getContractContext(account)
  const [tokenAddressValue, adminValue] = await Promise.all([
    contract.token(),
    contract.admin(),
  ])
  const tokenAddress = getAddress(tokenAddressValue)
  if (!sameAddress(account, adminValue)) {
    throw new Error('Only the on-chain VESTA admin can create a batch.')
  }

  const readToken = new Contract(tokenAddress, ERC20_ABI, provider)
  const [, tokenDecimals] = await loadTokenMetadata(readToken)
  const { prepared, error, rowErrors } = prepareBatch(rows, tokenDecimals)
  if (!prepared) {
    const firstRowError = rowErrors.flat()[0]
    throw new Error(firstRowError ?? error ?? 'The batch is invalid.')
  }

  const signer = await provider.getSigner(account)
  const token = new Contract(tokenAddress, ERC20_ABI, signer)
  const writableContract = new Contract(contractAddress, VESTA_ABI, signer)
  const allowance = await readToken.allowance(account, contractAddress)

  if (allowance < prepared.total) {
    onUpdate({ state: 'loading', message: 'Confirm the token approval in your wallet.' })
    const approval = (await token.approve(
      contractAddress,
      prepared.total,
    )) as ContractTransactionResponse
    await waitForTransaction(approval, 'Token approval', onUpdate)
  }

  onUpdate({ state: 'loading', message: 'Confirm batch creation in your wallet.' })
  const transaction = (await writableContract.createBatch(
    tokenAddress,
    prepared.beneficiaries,
    prepared.allocations,
    prepared.starts,
    prepared.cliffs,
    prepared.durations,
  )) as ContractTransactionResponse
  await waitForTransaction(transaction, 'Batch creation', onUpdate)
  onUpdate({ state: 'success', message: 'Batch created successfully.' })
}

export async function claimSchedule(
  account: string,
  scheduleId: string,
  onUpdate: (update: TransactionUpdate) => void,
): Promise<void> {
  const { provider, contractAddress, contract } = await getContractContext(account)
  const schedule = await contract.getSchedule(scheduleId)
  if (!sameAddress(account, schedule.beneficiary)) {
    throw new Error('The connected wallet is not this schedule beneficiary.')
  }

  const signer = await provider.getSigner(account)
  const writableContract = new Contract(contractAddress, VESTA_ABI, signer)
  onUpdate({ state: 'loading', message: `Confirm claim for schedule #${scheduleId}.` })
  const transaction = (await writableContract.claim(scheduleId)) as ContractTransactionResponse
  await waitForTransaction(transaction, 'Claim', onUpdate)
  onUpdate({ state: 'success', message: `Schedule #${scheduleId} claimed successfully.` })
}

export function getVestingFailure(error: unknown): TransactionUpdate {
  if (error instanceof RevertedTransactionError || isError(error, 'CALL_EXCEPTION')) {
    return { state: 'reverted', message: getErrorMessage(error) }
  }
  if (isError(error, 'ACTION_REJECTED') || hasErrorCode(error, 4001)) {
    return { state: 'rejected', message: 'The wallet request was rejected.' }
  }
  return { state: 'error', message: getErrorMessage(error) }
}

export function getVestingErrorMessage(error: unknown): string {
  return getErrorMessage(error)
}

async function getContractContext(account: string): Promise<ContractContext> {
  const injectedProvider = window.ethereum
  if (!injectedProvider) {
    throw new Error('No EIP-1193 wallet provider was detected.')
  }
  if (!isAddress(account)) {
    throw new Error('The connected wallet account is invalid.')
  }

  const provider = new BrowserProvider(injectedProvider as Eip1193Provider)
  const accounts = (await provider.send('eth_accounts', [])) as string[]
  if (!accounts.some((walletAccount) => sameAddress(walletAccount, account))) {
    throw new Error('The connected wallet account is no longer available.')
  }

  const contractAddress = getVestaContractAddress()
  return {
    provider,
    contractAddress,
    contract: new Contract(contractAddress, VESTA_ABI, provider),
  }
}

async function loadTokenMetadata(token: Contract): Promise<[string, number]> {
  const [symbol, decimalsValue] = await Promise.all([token.symbol(), token.decimals()])
  const decimals = Number(decimalsValue)
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new Error('The vesting token returned invalid decimals.')
  }
  return [symbol, decimals]
}

async function loadSchedule(
  contract: Contract,
  scheduleId: bigint,
  tokenDecimals: number,
): Promise<LoadedSchedule> {
  const [schedule, vestedValue, claimableValue] = await Promise.all([
    contract.getSchedule(scheduleId),
    contract.vestedAmount(scheduleId),
    contract.claimableAmount(scheduleId),
  ])
  const allocation = BigInt(schedule.allocation)
  const released = BigInt(schedule.released)
  const vested = BigInt(vestedValue)
  const claimable = BigInt(claimableValue)
  const start = toSafeNumber(schedule.start, 'schedule start')
  const cliff = toSafeNumber(schedule.cliff, 'schedule cliff')
  const duration = toSafeNumber(schedule.duration, 'schedule duration')
  const now = Math.floor(Date.now() / 1000)

  let status: VestingSchedule['status']
  if (released >= allocation) status = 'Released'
  else if (now < cliff) status = 'In Cliff'
  else if (claimable > 0n) status = 'Claimable'
  else status = 'Active'

  return {
    id: BigInt(schedule.scheduleId).toString(),
    beneficiary: getAddress(schedule.beneficiary),
    allocation: formatUnits(allocation, tokenDecimals),
    vested: formatUnits(vested, tokenDecimals),
    released: formatUnits(released, tokenDecimals),
    claimable: formatUnits(claimable, tokenDecimals),
    start,
    cliff,
    duration,
    status,
    releasedBaseUnits: released,
  }
}

function prepareBatch(
  rows: BatchRowInput[],
  tokenDecimals: number,
): {
  prepared: PreparedBatch | null
  rowErrors: string[][]
  error: string | null
} {
  if (rows.length === 0) {
    return { prepared: null, rowErrors: [], error: 'Add at least one schedule.' }
  }
  if (rows.length > MAX_BATCH_ROWS) {
    return {
      prepared: null,
      rowErrors: rows.map(() => []),
      error: `A batch can contain at most ${MAX_BATCH_ROWS} schedules.`,
    }
  }

  const beneficiaries: string[] = []
  const allocations: bigint[] = []
  const starts: bigint[] = []
  const cliffs: bigint[] = []
  const durations: bigint[] = []
  const rowErrors = rows.map((row) => {
    const errors: string[] = []
    let beneficiary: string | null = null
    let allocation: bigint | null = null

    if (!isAddress(row.beneficiary) || sameAddress(row.beneficiary, ZeroAddress)) {
      errors.push('Enter a valid non-zero beneficiary address.')
    } else {
      beneficiary = getAddress(row.beneficiary)
    }

    try {
      allocation = parseUnits(row.amount.trim(), tokenDecimals)
      if (allocation <= 0n) errors.push('Allocation must be greater than zero.')
    } catch {
      errors.push(`Enter an allocation with at most ${tokenDecimals} decimal places.`)
    }

    const start = parseUint64(row.start, 'Start', errors, false)
    const duration = parseUint64(row.duration, 'Duration', errors, false)
    if (start !== null && duration !== null && start + duration > MAX_UINT64) {
      errors.push('Start plus duration exceeds the uint64 range.')
    }

    const cliff = row.cliff.trim() === ''
      ? start
      : parseUint64(row.cliff, 'Cliff', errors, true)
    if (start !== null && cliff !== null && cliff < start) {
      errors.push('Cliff must be at or after start.')
    }
    if (
      start !== null &&
      cliff !== null &&
      duration !== null &&
      cliff > start + duration
    ) {
      errors.push('Cliff must not be after the vesting end.')
    }

    if (
      errors.length === 0 &&
      beneficiary &&
      allocation !== null &&
      start !== null &&
      cliff !== null &&
      duration !== null
    ) {
      beneficiaries.push(beneficiary)
      allocations.push(allocation)
      starts.push(start)
      cliffs.push(cliff)
      durations.push(duration)
    }
    return errors
  })

  if (rowErrors.some((errors) => errors.length > 0)) {
    return { prepared: null, rowErrors, error: 'Fix the invalid schedule rows.' }
  }

  return {
    prepared: {
      beneficiaries,
      allocations,
      starts,
      cliffs,
      durations,
      total: allocations.reduce((total, allocation) => total + allocation, 0n),
    },
    rowErrors,
    error: null,
  }
}

function parseUint64(
  value: string,
  label: string,
  errors: string[],
  allowZero: boolean,
): bigint | null {
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) {
    errors.push(`${label} must be an absolute Unix time or duration in seconds.`)
    return null
  }
  const parsed = BigInt(trimmed)
  if ((!allowZero && parsed === 0n) || parsed > MAX_UINT64) {
    errors.push(`${label} must be a positive uint64 value.`)
    return null
  }
  return parsed
}

async function waitForTransaction(
  transaction: ContractTransactionResponse,
  label: string,
  onUpdate: (update: TransactionUpdate) => void,
) {
  onUpdate({ state: 'pending', message: `${label} is pending on-chain.` })
  const receipt = await transaction.wait()
  if (!receipt || receipt.status !== 1) {
    throw new RevertedTransactionError(`${label} reverted on-chain.`)
  }
}

function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase()
}

function toSafeNumber(value: bigint, label: string): number {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`The ${label} is outside the supported range.`)
  }
  return number
}

function hasErrorCode(error: unknown, code: number): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  )
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    if ('shortMessage' in error && typeof error.shortMessage === 'string') {
      return error.shortMessage
    }
    if ('reason' in error && typeof error.reason === 'string') {
      return error.reason
    }
  }
  if (error instanceof Error && error.message) return error.message
  return 'The VESTA request failed.'
}
