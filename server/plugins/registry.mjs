import { youtubePlugin } from './youtube.mjs';
import { githubPlugin } from './github.mjs';
import { articlePlugin } from './article.mjs';

export function createPluginRegistry(
  plugins = [youtubePlugin, githubPlugin, articlePlugin],
  { cacheTtlMs = 10 * 60 * 1000, fetchTimeoutMs = 9000 } = {},
) {
  const cache = new Map();

  return {
    list() {
      return plugins.map(({ id, name, kind }) => ({ id, name, kind }));
    },
    resolve(url) {
      return plugins.find((plugin) => plugin.canHandle(url)) ?? null;
    },
    async fetch(url, options = {}) {
      const plugin = this.resolve(url);
      if (!plugin) {
        throw new Error('No plugin can handle this URL');
      }
      const cacheKey = `${plugin.id}:${options.locale || 'en'}:${url}`;
      const cached = cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return { ...cached.data, cached: true };
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), fetchTimeoutMs);
      try {
        const data = await plugin.fetch(url, { ...options, signal: controller.signal });
        cache.set(cacheKey, { data, expiresAt: Date.now() + cacheTtlMs });
        return { ...data, cached: false };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
