import {
  BrowserProvider,
  Contract,
  formatUnits,
  isAddress,
  parseUnits,
  type ContractRunner,
} from 'ethers'
import type { ContractSchedule } from '../../offchain/types'

const managerAbi = [
  'function token() view returns (address)',
  'function admin() view returns (address)',
  'function nextScheduleId() view returns (uint256)',
  'function createBatch(address tokenAddress,address[] beneficiaries,uint256[] allocations,uint64[] starts,uint64[] cliffs,uint64[] durations)',
  'function getSchedule(uint256) view returns (tuple(uint256 scheduleId,address beneficiary,uint256 allocation,uint64 start,uint64 cliff,uint64 duration,uint256 released))',
  'function getBeneficiarySchedules(address) view returns (uint256[])',
  'function vestedAmount(uint256) view returns (uint256)',
  'function claimableAmount(uint256) view returns (uint256)',
  'function claim(uint256)',
  'event BatchCreated(address indexed admin,uint256 scheduleCount,uint256 totalAllocation)',
] as const

const tokenAbi = [
  'function approve(address spender,uint256 amount) returns (bool)',
  'function allowance(address owner,address spender) view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
] as const

export const chainId = Number(import.meta.env.VITE_CHAIN_ID || 11155111)
export const managerAddress = import.meta.env.VITE_CONTRACT_ADDRESS || ''
export const tokenAddress = import.meta.env.VITE_TOKEN_ADDRESS || ''

function getEthereum(): NonNullable<Window['ethereum']> {
  if (!window.ethereum || typeof window.ethereum.request !== 'function') {
    throw new Error('MetaMask is not connected in this browser.')
  }
  return window.ethereum
}

export function getBrowserProvider() {
  return new BrowserProvider(getEthereum() as never)
}

export function getManagerContract(runner: ContractRunner) {
  assertAddress(managerAddress, 'VITE_CONTRACT_ADDRESS')
  return new Contract(managerAddress, managerAbi, runner)
}

export function getTokenContract(runner: ContractRunner) {
  assertAddress(tokenAddress, 'VITE_TOKEN_ADDRESS')
  return new Contract(tokenAddress, tokenAbi, runner)
}

export async function getSigner() {
  return getBrowserProvider().getSigner()
}

export async function readSchedule(manager: Contract, scheduleId: bigint): Promise<ContractSchedule> {
  const raw = await manager.getSchedule(scheduleId)
  return {
    scheduleId: BigInt(raw.scheduleId),
    beneficiary: raw.beneficiary,
    allocation: BigInt(raw.allocation),
    start: BigInt(raw.start),
    cliff: BigInt(raw.cliff),
    duration: BigInt(raw.duration),
    released: BigInt(raw.released),
  }
}

export function formatTokenAmount(amount: bigint, decimals: number) {
  const [whole, fraction = ''] = formatUnits(amount, decimals).split('.')
  const trimmedFraction = fraction.slice(0, 4).replace(/0+$/, '')
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole
}

export function parseTokenAmount(value: string, decimals: number) {
  return parseUnits(value || '0', decimals)
}

export function assertAddress(value: string, name: string) {
  if (!isAddress(value)) throw new Error(`${name} is missing or invalid.`)
}

export function isOnChainAdmin(wallet: string, admin: string) {
  return wallet.toLowerCase() === admin.toLowerCase()
}

export function getScheduleStatus(schedule: ContractSchedule, now = BigInt(Math.floor(Date.now() / 1000))) {
  if (schedule.released >= schedule.allocation) return 'Released'
  if (now < schedule.start + schedule.cliff) return 'In Cliff'
  if (now >= schedule.start + schedule.duration) return 'Claimable'
  return 'Vesting'
}
