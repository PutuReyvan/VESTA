import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { fadeUp } from '../../motion/variants'
import { AnimatedNumber } from '../../motion/primitives'

export function StatCard({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string
  value: string
  icon: ReactNode
  accent?: boolean
}) {
  return (
    <motion.div className="stat-card" variants={fadeUp}>
      <div className="stat-label">
        <span className="stat-icon" aria-hidden="true">{icon}</span>
        {label}
      </div>
      <strong className={accent ? 'stat-value accent' : 'stat-value'}>
        <AnimatedNumber
          value={Number(value)}
          format={(current) => {
            const decimalPlaces = value.includes('.') ? value.split('.')[1].length : 0
            return current.toFixed(decimalPlaces)
          }}
        />
      </strong>
    </motion.div>
  )
}
