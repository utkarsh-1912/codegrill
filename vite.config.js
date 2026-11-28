import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.{js,mjs,jsx}'],
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
