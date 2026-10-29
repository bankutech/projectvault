import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare({ configPath: fileURLToPath(new URL('./wrangler.jsonc', import.meta.url)) })],
  server: { port: 5173, strictPort: false },
})
