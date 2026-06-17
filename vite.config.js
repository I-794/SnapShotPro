import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { VitePWA } from 'vite-plugin-pwa';

// Phase 2a — shared HTML partials. Replaces placeholder comments with shared
// markup from site/partials/ at build AND in dev (transformIndexHtml runs for
// every HTML entry), so nav/footer/logo are defined once and stay consistent.
// {{VERSION}} in the footer is filled from package.json so the version is never
// stale. Injection is placeholder-driven: a page only changes if it contains the
// placeholder, so the editor (no placeholders) is left untouched.
function htmlPartials() {
  const dir = resolve(__dirname, 'site/partials');
  const read = (f) => readFileSync(resolve(dir, f), 'utf8');
  return {
    name: 'html-partials',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const version = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')).version;
        return html
          .split('<!--PARTIAL:mark-->').join(read('mark.html'))
          .split('<!--PARTIAL:nav-->').join(read('nav.html'))
          .split('<!--PARTIAL:footer-->').join(read('footer.html').split('{{VERSION}}').join(version));
      }
    }
  };
}

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
        appStoreScreenshots: resolve(__dirname, 'app-store-screenshots/index.html'),
        guide: resolve(__dirname, 'guide/index.html'),
        features: resolve(__dirname, 'features/index.html'),
        gallery: resolve(__dirname, 'gallery/index.html'),
        useCases: resolve(__dirname, 'use-cases/index.html'),
        pricing: resolve(__dirname, 'pricing/index.html'),
        agent: resolve(__dirname, 'agent/index.html'),
        about: resolve(__dirname, 'about/index.html'),
        ai: resolve(__dirname, 'ai/index.html')
      },
      output: {
        manualChunks: {
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-openai': ['openai'],
          'vendor-anthropic': ['@anthropic-ai/sdk'],
          'vendor-three': ['three']
        }
      }
    }
  },
  server: {
    port: 5173,
    open: true,
  },
  plugins: [
    htmlPartials(),
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
