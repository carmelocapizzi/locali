import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configuration Vite pour l'app Locali
export default defineConfig({
  // base relative → fonctionne en local, sur Netlify ET sur GitHub Pages (sous-chemin /repo/)
  base: './',
  plugins: [react()],
  server: { port: 5173, open: true },
});
