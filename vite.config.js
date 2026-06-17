import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
const { attractions } = JSON.parse(readFileSync(new URL('./public/attractions.json', import.meta.url), 'utf-8'));

const LOCALES = ['en', 'zh-TW', 'zh-CN'];

// Inject a crawlable HTML list of attractions into index.html at build/dev time.
// This is the SEO-friendly source of truth: search engines see real markup,
// Leaflet enhances it client-side.
function attractionsListPlugin() {
  const byCategory = attractions.reduce((acc, a) => {
    (acc[a.category] ||= []).push(a);
    return acc;
  }, {});

  const html = Object.entries(byCategory).map(([cat, items]) => `
    <section>
      <h2>${cat}</h2>
      <ul>
        ${items.map(a => `
          <li>
            <a href="#pin-${a.id}" data-attraction-id="${a.id}">
              <strong>${a.booths[0].name}</strong>
            </a>
            <script type="application/ld+json">${JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Place',
              name: a.booths[0].name,
              additionalType: cat,
              identifier: a.id,
            })}</script>
          </li>`).join('')}
      </ul>
    </section>`).join('');

  return {
    name: 'attractions-list',
    transformIndexHtml(input) {
      return input.replace('<!--ATTRACTIONS_LIST-->', html);
    },
  };
}

export default defineConfig({
  // plugins: [localeRoutingPlugin()],
  plugins: [],
  server: { open: '/en' },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
});

function localeRoutingPlugin() {
  return {
    name: 'locale-routing',

    // Dev: rewrite /{locale}/... → /
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const seg = req.url?.split('/')[1]?.split(/[?#]/)[0];
        if (LOCALES.includes(seg)) {
          req.url = '/' + req.url.slice(1 + seg.length);
        }
        next();
      });
    },

    // Build: copy dist/index.html → dist/{locale}/index.html
    closeBundle() {
      for (const locale of LOCALES) {
        mkdirSync(`dist/${locale}`, { recursive: true });
        copyFileSync('dist/index.html', `dist/${locale}/index.html`);
      }
    },
  };
} 
