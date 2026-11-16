import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';

export default defineConfig({
  site: 'https://nao-mei.github.io',
  base: '/LFAQ',
  trailingSlash: 'always',
  integrations: [svelte()],
});
