import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Check if local SSL certificates exist
const certPath = path.resolve(__dirname, 'certs/cert.pem')
const keyPath = path.resolve(__dirname, 'certs/key.pem')
const hasCerts = fs.existsSync(certPath) && fs.existsSync(keyPath)

export default defineConfig({
  plugins: [react()],
  server: {
    // Only attach https certs locally if the files exist
    https: hasCerts
      ? {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath),
        }
      : false,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})