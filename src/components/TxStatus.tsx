import type { TransactionState } from '../types/app'
import { AnimatePresence, motion } from 'motion/react'
import { IconLoader2 } from '@tabler/icons-react'

export function TxStatus({
  state,
  message,
}: {
  state: TransactionState
  message?: string
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {state !== 'idle' && (
        <motion.div
          key={state}
          className={`tx-status tx-${state}`}
          role="status"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
        >
          {(state === 'loading' || state === 'pending') && (
            <motion.span
              className="tx-indicator"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
            >
              <IconLoader2 size={16} stroke={2} />
            </motion.span>
          )}
          {message ?? state}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
