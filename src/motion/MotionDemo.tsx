import { useState } from 'react'
import { Button } from '../components/ui/Button'
import {
  AnimatedNumber,
  PageTransition,
  Presence,
  Pressable,
  Reveal,
  Skeleton,
  Stagger,
  StaggerItem,
} from './primitives'

export function MotionDemo() {
  const [present, setPresent] = useState(true)
  const [number, setNumber] = useState(1200)

  return (
    <PageTransition>
      <div className="motion-demo">
        <h1>Motion foundation demo</h1>
        <p className="muted">Development-only preview of the shared motion primitives.</p>
        <Reveal className="motion-demo-card">
          <h2>Reveal</h2>
          <p>Enters when it reaches the viewport.</p>
        </Reveal>
        <Stagger className="motion-demo-grid">
          <StaggerItem><div className="motion-demo-card">Stagger item 1</div></StaggerItem>
          <StaggerItem><div className="motion-demo-card">Stagger item 2</div></StaggerItem>
          <StaggerItem><div className="motion-demo-card">Stagger item 3</div></StaggerItem>
        </Stagger>
        <div className="motion-demo-actions">
          <Pressable className="button button-primary">Pressable</Pressable>
          <Button type="button" onClick={() => setPresent((current) => !current)}>
            Toggle Presence
          </Button>
          <Button type="button" onClick={() => setNumber((current) => current === 1200 ? 8000 : 1200)}>
            <AnimatedNumber value={number} format={(value) => value.toLocaleString()} />
          </Button>
        </div>
        <Presence present={present}>
          <div className="motion-demo-card">Presence content</div>
        </Presence>
        <Skeleton className="motion-demo-skeleton" />
      </div>
    </PageTransition>
  )
}
