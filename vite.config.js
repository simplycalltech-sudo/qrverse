import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // 👇 This ensures Vite ignores your backup folder
  optimizeDeps: {
    exclude: ['src/backup'],
  },

  // 👇 Extra safety to make Rollup ignore backup files
  build: {
    rollupOptions: {
      // Prevent scanning or bundling anything inside backup/
      external: [],
      onwarn(warning, warn) {
        // Suppress missing export warnings from old backups
        if (
          warning.message.includes('backup') ||
          warning.message.includes('src/backup')
        ) {
          return
        }
        warn(warning)
      },
    },
    sourcemap: false, // Faster build; disable if not needed
    emptyOutDir: true, // Clears /dist before each build
  },

  // 👇 Optional: cleaner console & better DX
  server: {
    open: true, // Opens browser on local dev
    port: 5173, // Change if needed
  },

  // 👇 Base path (important if deploying to a subpath)
  base: './',
})
