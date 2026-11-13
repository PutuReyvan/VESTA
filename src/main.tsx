import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { WalletProvider } from './features/wallet/WalletProvider'
import { MotionConfig } from 'motion/react'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <WalletProvider>
        <App />
      </WalletProvider>
    </MotionConfig>
  </StrictMode>,
)
