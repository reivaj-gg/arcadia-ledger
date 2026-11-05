import { defineConfig } from 'vite';

/**
 * Vite is the *client* build only.
 *
 * There is deliberately no `define` block injecting the Model API key: any
 * value placed there is inlined into the shipped JavaScript, and a leaked key
 * in a public repo is a leaked key. The key lives in the Node
 * process started by `server/index.ts`; the browser talks to it through the
 * `/api` proxy below, so in production the same paths can be served by a
 * reverse proxy without touching a single line of client code.
 */
const API_TARGET = process.env.ARCADIA_API_ORIGIN ?? 'http://127.0.0.1:8787';

export default defineConfig({
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: false,
        // Audio and screenshots travel as base64 JSON. Keep the default
        // timeouts generous: Muse Voice Transcribe can take tens of seconds
        // on a 10-minute WAV, and a premature 504 would look like a model
        // failure when it is really a proxy failure.
        timeout: 120_000,
        proxyTimeout: 120_000,
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    // The 3D scene is the bulk of the bundle and is not needed to render the
    // ledger. Splitting them keeps first paint honest on slow connections.
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
});
