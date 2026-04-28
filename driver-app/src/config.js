// API base URL — points to the Vercel deployment for the existing /api/* endpoints.
// Override at build time with VITE_API_BASE in .env.production.
export const API_BASE =
  import.meta.env.VITE_API_BASE || 'https://airport-transfers-liverpool-rm.vercel.app';
