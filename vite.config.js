import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { attractions } from './src/attractions.js';

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
              <strong>${a.name}</strong>
            </a>
            <script type="application/ld+json">${JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Place',
              name: a.name,
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
  plugins: [attractionsListPlugin()],
  server: { open: '/leaflet.html' },
  build: {
    rollupOptions: {
      input: {
        legacy: resolve(__dirname, 'index.html'),
        leaflet: resolve(__dirname, 'leaflet.html'),
      },
    },
  },
});
