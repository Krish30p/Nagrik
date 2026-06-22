import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
// envDir: '..' tells Vite to load .env from the root Nagrik/ folder
// (one level up from frontend/) — single source of truth for all env vars.
export default defineConfig({
  plugins: [react()],
  envDir: path.resolve(__dirname, '..'),
})
