import type { ReactNode } from 'react'
import { Card } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import { mockContractAddress, mockSchedules, mockTokenAddress } from '../mocks/vesting'
import { IconCalendar, IconCash, IconLock, IconUsers, IconCircleCheck } from '@tabler/icons-react'
import { Reveal, Stagger, StaggerItem } from '../motion/primitives'

export function OverviewPage() {
  return (
    <PageFrame title="Welcome Back, Leonardo">
      <p className="contract-line">Contract: {mockContractAddress}</p>
      <p className="contract-line">Token: {mockTokenAddress}</p>
      <Stagger className="card stats-grid">
        <StatCard label="Locked In Contract" value="8.000" icon={<IconLock size={17} stroke={1.8} />} />
        <StatCard label="Total Released" value="1.200" icon={<IconCash size={17} stroke={1.8} />} />
        <StatCard label="Schedule" value="4" icon={<IconCalendar size={17} stroke={1.8} />} />
        <StatCard label="Batches" value="2" icon={<IconUsers size={17} stroke={1.8} />} />
      </Stagger>
      <Reveal>
        <Card>
        <h2>All Schedules</h2>
        <div className="table">
          <div className="table-row table-header">
            <span>ID</span><span>Beneficiary</span><span>Allocation</span>
            <span>Vested</span><span>Released</span><span>Status</span>
          </div>
          <Stagger className="table-row-stagger">
          {mockSchedules.map((schedule) => (
            <StaggerItem className="table-row" key={schedule.id}>
              <span>#{schedule.id}</span><span>{schedule.beneficiary}</span>
              <span>{schedule.allocation}</span><span>{schedule.vested}</span>
              <span>{schedule.released}</span><span className={schedule.status === 'Released' ? 'status-pill active' : 'status-pill cliff'}><IconCircleCheck size={15} stroke={2} />{schedule.status}</span>
            </StaggerItem>
          ))}
          </Stagger>
        </div>
        </Card>
      </Reveal>
      <Reveal>
      <Card>
        <h2>Batch History</h2>
        <div className="table">
          <div className="table-row table-header">
            <span>Batch</span><span>Schedule</span><span>Allocation</span><span>Beneficiary</span>
          </div>
          <div className="table-row"><span>#2</span><span>2</span><span>2.000</span><span>0x91Ab1...F28AIDF</span></div>
          <div className="table-row"><span>#1</span><span>2</span><span>2.000</span><span>0x91Ab1...F28AIDF</span></div>
        </div>
      </Card>
      </Reveal>
    </PageFrame>
  )
}

function PageFrame({ title, children }: { title: string; children: ReactNode }) {
  return <div className="page-frame"><h1>{title}</h1>{children}</div>
}
