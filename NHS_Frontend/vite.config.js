import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Server 10.10.10.16: the site on :3100, the backend (NHS-Backend) on :8100.
// On another computer: HOST=localhost API_URL=http://localhost:8081 npm run dev
const host = process.env.HOST || '10.10.10.16';
const api = process.env.API_URL || 'http://10.10.10.16:8100';

// The browser only ever talks to Vite, which forwards /api to the backend (no CORS needed).
// strictPort: fail instead of silently moving to another port.
const site = { host, port: 3100, strictPort: true, proxy: { '/api': api } };

export default defineConfig({
  plugins: [react()],
  server: site,
  preview: site,
});
