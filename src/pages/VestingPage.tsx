import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatCard } from '../components/ui/StatCard'
import { mockVestingCards } from '../mocks/vesting'
import { IconCash, IconLock, IconHandStop } from '@tabler/icons-react'
import { Stagger, StaggerItem } from '../motion/primitives'
import { motion } from 'motion/react'

export function VestingPage() {
  return (
    <div className="page-frame">
      <h1>My Vesting</h1>
      <p className="contract-line">Contract: 0x91Ab12BEF28A1DF</p>
      <Stagger className="vesting-grid">
        {mockVestingCards.map((schedule) => (
          <StaggerItem key={schedule.id}>
          <Card>
            <h2>Schedule #{schedule.id}</h2>
            <div className="tag-row"><span>{schedule.start}</span><span>{schedule.duration}</span><span>{schedule.cliff}</span></div>
            <div className="progress-row">
              {Array.from({ length: 12 }, (_, index) => (
                <motion.span
                  className={index < schedule.progress ? 'filled' : ''}
                  initial={{ scaleX: index < schedule.progress ? 0 : 1 }}
                  animate={{ scaleX: 1 }}
                  style={{ transformOrigin: 'left center' }}
                  key={index}
                />
              ))}
            </div>
            <div className="stats-grid compact">
              <StatCard label="Vested" value={schedule.vested} icon={<IconLock size={17} stroke={1.8} />} />
              <StatCard label="Released" value={schedule.released} icon={<IconCash size={17} stroke={1.8} />} />
              <StatCard label="Claimable" value={schedule.claimable} icon={<IconHandStop size={17} stroke={1.8} />} accent />
            </div>
            <Button variant={schedule.claimEnabled ? 'success' : 'secondary'} disabled={!schedule.claimEnabled} className="full-width" icon={<IconHandStop size={18} stroke={2} />}>
              {schedule.claimEnabled ? 'Claim' : 'Starts in 2027-03-01'}
            </Button>
          </Card>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  )
}
