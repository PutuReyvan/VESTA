import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { fadeUp } from '../../motion/variants'

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
        {value}
      </strong>
    </motion.div>
  )
}
