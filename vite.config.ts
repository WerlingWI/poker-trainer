import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  // Relative Basis, damit ein Build auch aus dem Dateisystem heraus funktioniert.
  base: './',
  worker: { format: 'es' },
});
