import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const nextRoot = path.resolve(__dirname, '../anime-selection-interface')

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': nextRoot,
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'framer-motion': path.resolve(__dirname, 'node_modules/framer-motion'),
      'lucide-react': path.resolve(__dirname, 'node_modules/lucide-react'),
      'clsx': path.resolve(__dirname, 'node_modules/clsx'),
      'tailwind-merge': path.resolve(__dirname, 'node_modules/tailwind-merge'),
      'class-variance-authority': path.resolve(__dirname, 'node_modules/class-variance-authority'),
    },
  },
  server: {
    fs: {
      allow: [nextRoot, path.resolve(__dirname)],
    },
  },
  optimizeDeps: {
    include: ['framer-motion', 'lucide-react'],
  },
  publicDir: path.resolve(nextRoot, 'public'),
})
