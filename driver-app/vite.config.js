import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Two build modes:
//   - default (web):    base '/driver-app/' → outDir '../driver-app-build'
//                       served by Vercel at https://your-host/driver-app/
//   - CAPACITOR=1:      base './' → outDir 'dist'
//                       used by `npx cap sync` for native builds
const isCapacitor = process.env.CAPACITOR === '1';

export default defineConfig({
  plugins: [react()],
  base: isCapacitor ? './' : '/driver-app/',
  build: {
    outDir: isCapacitor
      ? 'dist'
      : path.resolve(__dirname, '../driver-app-build'),
    emptyOutDir: true
  }
});
