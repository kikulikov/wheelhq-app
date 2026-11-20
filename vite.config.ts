import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { injectPixel, resolvePixelTag } from './src/lib/analytics.ts';

const csp =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://wheelhq.goatcounter.com; connect-src 'self' https://data.alpaca.markets https://paper-api.alpaca.markets https://api.alpaca.markets https://wheelhq-datasets.onrender.com https://datasets.wheelhq.xyz; base-uri 'none'; form-action 'self'; object-src 'none'";

const SITE_URL = 'https://wheelhq.xyz';
const analyticsEnabled = process.env.VITE_ANALYTICS === '1';

export default defineConfig({
  base: './',
  plugins: [
    tailwindcss({ optimize: false }),
    svelte(),
    {
      name: 'inject-seo',
      transformIndexHtml(html, context) {
        const serving = Boolean(context.server);
        const analytics = resolvePixelTag({ enabled: analyticsEnabled, serving, path: '/' });
        const withSite = html
          .replaceAll('%SITE_URL%', SITE_URL)
          .replace('<!-- %ANALYTICS% -->', analytics);
        if (serving) return withSite;
        return withSite.replace(
          '<head>',
          `<head>\n<meta http-equiv="Content-Security-Policy" content="${csp}">`,
        );
      },
    },
    {
      name: 'inject-about-analytics',
      closeBundle() {
        if (!analyticsEnabled) return;
        const file = fileURLToPath(new URL('./dist/about/index.html', import.meta.url));
        if (!existsSync(file)) return;
        const tag = resolvePixelTag({ enabled: true, serving: false, path: '/about/' });
        const html = readFileSync(file, 'utf8');
        const next = injectPixel(html, tag);
        if (next !== html) writeFileSync(file, next);
      },
    },
    {
      name: 'about-directory-index',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === '/about/' || req.url === '/about') {
            req.url = '/about/index.html';
          }
          next();
        });
      },
    },
  ],
  publicDir: 'static',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssMinify: 'esbuild',
    sourcemap: true,
  },
});
