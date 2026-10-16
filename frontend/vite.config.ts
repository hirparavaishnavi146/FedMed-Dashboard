import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Vite configuration.
// The dev server port is fixed at 5173 so the documented commands always point
// at the same address, and it binds to 127.0.0.1 explicitly: the default
// "localhost" can bind to IPv6 only on Windows, which makes
// http://127.0.0.1:5173 appear to be down even while the server is running.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  // A production bundle that talks to the real API must be told where that API is.
  // Without this check, services/api.ts would silently fall back to
  // http://127.0.0.1:8000 — which, in a visitor's browser, means the visitor's own
  // machine. The symptom is a vague "Failed to fetch" with no obvious cause, so
  // failing the build is the honest outcome. The local fallback stays for dev.
  if (
    mode === 'production' &&
    env.VITE_USE_DEMO_DATA === 'false' &&
    !env.VITE_API_BASE_URL &&
    env.VITE_API_SAME_ORIGIN !== 'true'
  ) {
    throw new Error(
      'VITE_USE_DEMO_DATA=false requires VITE_API_BASE_URL in a production build, ' +
        'otherwise the deployed site would call http://127.0.0.1:8000. ' +
        'Set VITE_API_BASE_URL to the deployed API URL (e.g. https://api.example.org), ' +
        'or VITE_API_SAME_ORIGIN=true when the API serves these pages itself.',
    );
  }

  // Where the site is served from. "/" for Vercel and local development. A GitHub
  // Pages project site lives under /<repo>/, so its workflow sets
  // VITE_BASE_PATH=/FedMed-Axlero-Internship/ and every asset URL is rewritten to
  // match. Without this the built index.html would request /assets/... at the
  // domain root, which Pages does not serve, and the page would load blank.
  const base = env.VITE_BASE_PATH || '/';

  return {
    base,
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
    },
    preview: {
      host: '127.0.0.1',
      port: 4173,
      strictPort: true,
    },
  };
});
