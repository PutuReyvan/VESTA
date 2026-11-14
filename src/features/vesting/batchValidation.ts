import { ZeroAddress, isAddress, parseUnits } from 'ethers'

export type BatchInputRow = {
  beneficiary: string
  allocation: string
  start: string
  durationDays: string
  cliffDays: string
}

const MAX_BATCH_SIZE = 20
const SECONDS_PER_DAY = 86_400n
const UINT64_MAX = (1n << 64n) - 1n
const UINT256_MAX = (1n << 256n) - 1n

function parseDays(value: string, name: string, rowNumber: number) {
  if (!/^\d+$/.test(value)) throw new Error(`${name} in row ${rowNumber} must be a whole number of days.`)
  return BigInt(value) * SECONDS_PER_DAY
}

export function buildBatchPayload(rows: readonly BatchInputRow[], decimals: number) {
  if (rows.length < 1 || rows.length > MAX_BATCH_SIZE) {
    throw new Error(`A batch must contain between 1 and ${MAX_BATCH_SIZE} schedules.`)
  }

  let totalAllocation = 0n
  const payload = rows.map((row, index) => {
    const rowNumber = index + 1
    if (!isAddress(row.beneficiary) || row.beneficiary.toLowerCase() === ZeroAddress) {
      throw new Error(`Invalid beneficiary address in row ${rowNumber}.`)
    }

    let allocation: bigint
    try {
      allocation = parseUnits(row.allocation, decimals)
    } catch {
      throw new Error(`Allocation in row ${rowNumber} must be a valid token amount.`)
    }
    if (allocation <= 0n) throw new Error(`Allocation in row ${rowNumber} must be greater than zero.`)
    if (allocation > UINT256_MAX) throw new Error(`Allocation in row ${rowNumber} exceeds uint256.`)

    const startMilliseconds = Date.parse(row.start)
    if (!Number.isFinite(startMilliseconds)) throw new Error(`Start in row ${rowNumber} must be a valid date.`)
    const start = BigInt(Math.floor(startMilliseconds / 1000))
    if (start <= 0n) throw new Error(`Start in row ${rowNumber} must be after the Unix epoch.`)

    const duration = parseDays(row.durationDays, 'Duration', rowNumber)
    const cliff = parseDays(row.cliffDays, 'Cliff', rowNumber)
    if (duration === 0n) throw new Error(`Duration in row ${rowNumber} must be greater than zero.`)
    if (cliff > duration) throw new Error(`Cliff in row ${rowNumber} cannot exceed duration.`)
    if (start > UINT64_MAX || cliff > UINT64_MAX || duration > UINT64_MAX || start + duration > UINT64_MAX) {
      throw new Error(`Start, cliff, and duration in row ${rowNumber} must fit the contract uint64 bounds.`)
    }

    totalAllocation += allocation
    if (totalAllocation > UINT256_MAX) throw new Error('Total allocation exceeds uint256.')
    return { beneficiary: row.beneficiary, allocation, start, cliff, duration }
  })

  if (totalAllocation <= 0n) throw new Error('Total allocation must be greater than zero.')
  return {
    beneficiaries: payload.map((row) => row.beneficiary),
    allocations: payload.map((row) => row.allocation),
    starts: payload.map((row) => row.start),
    cliffs: payload.map((row) => row.cliff),
    durations: payload.map((row) => row.duration),
    totalAllocation,
  }
}
