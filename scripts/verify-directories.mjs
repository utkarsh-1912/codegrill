import { readFile } from 'node:fs/promises';
import { safeUrl } from '../src/catalog.mjs';

const { directories } = JSON.parse(await readFile(new URL('../src/roadmap.generated.json', import.meta.url), 'utf8'));
const results = [];
let next = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < directories.length) {
    const directory = directories[next++];
    const url = safeUrl(directory.url);
    if (!url) {
      results.push({ ...directory, outcome: 'invalid URL' });
      continue;
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
      await response.body?.cancel();
      results.push({ ...directory, outcome: response.ok ? 'reachable' : 'HTTP ' + response.status });
    } catch (error) {
      results.push({ ...directory, outcome: error.name === 'TimeoutError' ? 'timed out' : 'network error' });
    }
  }
}));

const unreachable = results.filter(({ outcome }) => outcome !== 'reachable');
console.log(`${results.length - unreachable.length}/${results.length} directory URLs returned HTTP 2xx.`);
for (const { name, outcome, url } of unreachable) console.log(`${outcome} | ${name} | ${url}`);
if (unreachable.length) process.exitCode = 1;
