import { defineConfig } from 'vite';
import { resolve } from 'path';
import { VitePWA } from 'vite-plugin-pwa';

// Replaces __OG_BASE__ in HTML with the absolute site URL so social embeds
// (Discord, X, Slack) resolve og:image/og:url. On Vercel this comes from the
// build environment automatically; override locally with OG_BASE_URL.
function ogBase() {
  const raw =
    process.env.OG_BASE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
    (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
    '';
  const base = raw.replace(/\/+$/, '');
  return {
    name: 'og-base',
    transformIndexHtml(html) {
      return html.split('__OG_BASE__').join(base);
    }
  };
}

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        editor: resolve(__dirname, 'editor/index.html'),
        changelog: resolve(__dirname, 'changelog/index.html'),
        privacy: resolve(__dirname, 'privacy/index.html'),
        appStoreScreenshots: resolve(__dirname, 'app-store-screenshots/index.html')
      },
      output: {
        manualChunks: {
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-openai': ['openai'],
          'vendor-anthropic': ['@anthropic-ai/sdk']
        }
      }
    }
  },
  server: {
    port: 5173,
    open: true,
  },
  plugins: [
    ogBase(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'SnapShot-Pro',
        short_name: 'SnapShot-Pro',
        description: 'Pro screenshot & image editor — filters, frames, AI background removal, annotations, mockups, and more.',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: 'pwa-512.svg', sizes: '512x512', type: 'image/svg+xml' },
          { src: 'pwa-512-maskable.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://cdn.jsdelivr.net' || url.origin === 'https://staticimgly.com' || url.origin === 'https://unpkg.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdn-models',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ]
      }
    })
  ]
});
