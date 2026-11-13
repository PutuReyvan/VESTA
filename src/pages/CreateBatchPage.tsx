import { useState } from 'react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import { IconArrowLeft, IconCheck, IconCircleCheck, IconPlus, IconScale, IconWallet } from '@tabler/icons-react'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'

export function CreateBatchPage() {
  const [rowCount, setRowCount] = useState(3)
  const [approved, setApproved] = useState(false)

  return (
    <div className="page-frame create-batch-page">
      <button className="back-button"><IconArrowLeft size={17} stroke={2} /> Back</button>
      <h1>Create Batch</h1>
      <LayoutGroup>
        <div className="stepper">
          <motion.span layout className={approved ? 'step active' : 'step active'}>Approve Token</motion.span>
          <span className="step-dots">••••</span>
          <motion.span layout className={approved ? 'step active' : 'step'}>Create Batch</motion.span>
        </div>
      </LayoutGroup>
      <h2>Summary</h2>
      <Card className="stats-grid batch-summary">
        <StatCard label="Total Allocation" value="5.500" icon={<IconScale size={17} stroke={1.8} />} />
        <StatCard label="Wallet Balance" value="12.000" icon={<IconWallet size={17} stroke={1.8} />} />
        <StatCard label="Current Allowance" value="0" icon={<IconCircleCheck size={17} stroke={1.8} />} />
      </Card>
      <Card>
        <div className="section-heading"><h2>All Schedules</h2><button className="back-button" onClick={() => setRowCount((count) => Math.min(count + 1, 20))}><IconPlus size={17} stroke={2} /> Add Row</button></div>
        <div className="batch-form">
          <AnimatePresence initial={false}>
          {Array.from({ length: rowCount }, (_, index) => (
            <motion.div
              className="batch-row"
              key={`row-${index + 1}`}
              layout
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.2 }}
            >
              <input value="0x91Ab1....F28AIDF" readOnly aria-label="Beneficiary" />
              <input value="2000" readOnly aria-label="Allocation" />
              <input value="2026-12-01" readOnly aria-label="Start" />
              <input value="12" readOnly aria-label="Month" />
              <input value="3" readOnly aria-label="Cliff" />
            </motion.div>
          ))}
          </AnimatePresence>
        </div>
        <Button variant="success" className="full-width" icon={<IconCheck size={18} stroke={2} />} onClick={() => setApproved(true)}>
          {approved ? 'Create Batch' : 'Approve'}
        </Button>
      </Card>
    </div>
  )
}
