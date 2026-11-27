import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'vendor-react';
          if (id.includes('node_modules/@utkristi/ui')) return 'vendor-ui';
          if (id.includes('node_modules/lucide-react')) return 'vendor-icons';
          if (id.includes('multilingual_leetcode_dataset.json') || id.includes('roadmap.generated.json')) return 'data-catalog';
          if (id.includes('/src/i18n.mjs') || id.includes('\\src\\i18n.mjs')) return 'i18n-locales';
          if (id.includes('/src/trackContent.mjs') || id.includes('\\src\\trackContent.mjs')) return 'track-content';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
