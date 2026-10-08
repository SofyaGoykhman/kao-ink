import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

export default defineConfig({
  integrations: [preact()],
  i18n: {
    locales: ['ru', 'en'],
    defaultLocale: 'ru',
    routing: { prefixDefaultLocale: true, redirectToDefaultLocale: false },
  },
});
