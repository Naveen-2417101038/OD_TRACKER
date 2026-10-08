import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],

    // ── Development proxy ────────────────────────────────────────────────────
    // In dev mode, Vite forwards /api/* to the local Flask backend so the
    // frontend never has a hard-coded localhost URL.
    // In production the frontend is served as static files and all API calls
    // go directly to the VITE_API_BASE_URL origin.
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://127.0.0.1:5000',
          changeOrigin: true,
          secure: false,
        }
      }
    },

    // ── Build output ─────────────────────────────────────────────────────────
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          }
        }
      }
    }
  }
})
