import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Caminhos relativos: o build funciona na raiz ou num subcaminho (ex.: GitHub Pages em /Apps/).
  base: './',
  plugins: [react()],
})
