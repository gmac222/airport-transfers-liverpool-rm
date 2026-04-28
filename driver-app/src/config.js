// API base URL.
//
// Priority:
//   1. VITE_API_BASE build-time override
//   2. In a native Capacitor build, point at the live Vercel deployment
//      (the app is loaded from capacitor:// or file:// origins, so it must
//      use an absolute URL)
//   3. Otherwise (web build served from same origin), use a relative base
//      so /api/* resolves against whichever host is serving the app.

import { Capacitor } from '@capacitor/core';

const FALLBACK_PROD_HOST = 'https://airport-transfers-liverpool-rm.vercel.app';

function pickBase() {
  if (import.meta.env.VITE_API_BASE) return import.meta.env.VITE_API_BASE;
  if (Capacitor.isNativePlatform()) return FALLBACK_PROD_HOST;
  return '';
}

export const API_BASE = pickBase();
