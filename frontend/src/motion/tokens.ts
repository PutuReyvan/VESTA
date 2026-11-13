export const motionDurations = {
  fast: 0.18,
  standard: 0.26,
  slow: 0.36,
} as const

export const motionSprings = {
  snappy: { type: 'spring' as const, stiffness: 420, damping: 32, mass: 0.7 },
  smooth: { type: 'spring' as const, stiffness: 280, damping: 30, mass: 0.8 },
  gentle: { type: 'spring' as const, stiffness: 220, damping: 28, mass: 0.9 },
} as const

export const motionEase = [0.22, 1, 0.36, 1] as const
export const motionStagger = 0.04
export const motionStaggerCap = 0.24
