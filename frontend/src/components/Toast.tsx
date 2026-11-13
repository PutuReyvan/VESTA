import { IconCircleCheck, IconInfoCircle, IconX } from '@tabler/icons-react'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'

export type ToastKind = 'success' | 'info' | 'error'

export function Toast({
  kind,
  title,
  children,
  onDismiss,
}: {
  kind: ToastKind
  title: string
  children?: ReactNode
  onDismiss?: () => void
}) {
  const Icon = kind === 'success' ? IconCircleCheck : IconInfoCircle

  return (
    <motion.div
      className={`toast toast-${kind}`}
      role={kind === 'error' ? 'alert' : 'status'}
      initial={{ opacity: 0, x: 16, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 8, scale: 0.98 }}
      transition={{ duration: 0.22 }}
    >
      <Icon size={20} stroke={2} aria-hidden="true" />
      <div className="toast-copy">
        <strong>{title}</strong>
        {children && <span>{children}</span>}
      </div>
      {onDismiss && (
        <button className="toast-dismiss" type="button" aria-label="Dismiss notification" onClick={onDismiss}>
          <IconX size={17} stroke={2} />
        </button>
      )}
    </motion.div>
  )
}
