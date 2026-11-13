export const mockContractAddress = '0x91Ab12BEF28A1DF'
export const mockTokenAddress = '0x91Ab12BEF28A1DF'

export const mockSchedules = [
  {
    id: 1,
    beneficiary: '0x91Ab1...F28AIDF',
    allocation: '2.000',
    vested: '1.000',
    released: '1.000',
    status: 'Released',
  },
  {
    id: 2,
    beneficiary: '0x91Ab1...F28AIDF',
    allocation: '2.000',
    vested: '1.000',
    released: '1.000',
    status: 'In Cliff',
  },
]

export const mockVestingCards = [
  {
    id: 1,
    start: '2026-06-01',
    duration: '12 Month',
    cliff: 'Cliff 3 Month',
    vested: '1.160',
    released: '800',
    claimable: '360',
    progress: 7,
    claimEnabled: true,
  },
  {
    id: 2,
    start: '2026-06-01',
    duration: '12 Month',
    cliff: 'Cliff 3 Month',
    vested: '0',
    released: '0',
    claimable: '0',
    progress: 0,
    claimEnabled: false,
  },
]
