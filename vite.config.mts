import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // GitHub Pages supplies /VESTA/ while local Vite development stays at /.
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
})
