import { useState } from 'react'
import './App.css'
import { LayoutShell } from './components/LayoutShell'
import { CreateBatchPage } from './pages/CreateBatchPage'
import { OverviewPage } from './pages/OverviewPage'
import { VestingPage } from './pages/VestingPage'
import type { AppRoute } from './types/app'
import { MotionDemo } from './motion/MotionDemo'
import { AnimatePresence } from 'motion/react'
import { PageTransition } from './motion/primitives'

function App() {
  const [route, setRoute] = useState<AppRoute>('overview')

  if (import.meta.env.DEV && window.location.search.includes('motion-demo')) {
    return <MotionDemo />
  }

  const page = (
    <LayoutShell route={route} onNavigate={setRoute}>
      {route === 'overview' && <OverviewPage />}
      {route === 'my-vesting' && <VestingPage />}
      {route === 'create-batch' && <CreateBatchPage />}
    </LayoutShell>
  )

  return (
    <AnimatePresence mode="wait" initial={false}>
      <PageTransition key={route}>{page}</PageTransition>
    </AnimatePresence>
  )
}

export default App
