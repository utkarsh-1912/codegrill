(() => {
  const DEFAULT_ORIGIN = 'https://codegrill.vercel.app';
  if (document.getElementById('codegrill-track-fab')) return;

  function detectSlug() {
    const { hostname, pathname } = window.location;
    if (hostname.includes('leetcode.com')) {
      const m = /^\/problems\/([^/]+)/.exec(pathname);
      return m ? m[1] : '';
    }
    if (hostname.includes('codeforces.com')) {
      const m = /^\/problemset\/problem\/(\d+)\/([A-Za-z0-9]+)/.exec(pathname);
      return m ? `cf-${m[1]}${m[2].toLowerCase()}` : '';
    }
    if (hostname.includes('hackerrank.com')) {
      const m = /^\/challenges\/([^/]+)/.exec(pathname);
      return m ? `hr-${m[1]}` : '';
    }
    return '';
  }

  const slug = detectSlug();
  if (!slug) return;

  const btn = document.createElement('button');
  btn.id = 'codegrill-track-fab';
  btn.type = 'button';
  btn.textContent = 'Track in CodeGrill';
  Object.assign(btn.style, {
    position: 'fixed',
    right: '18px',
    bottom: '18px',
    zIndex: '2147483647',
    padding: '9px 14px',
    border: '0',
    borderRadius: '999px',
    background: '#d94e1f',
    color: '#fff7ee',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
  });

  btn.addEventListener('click', async () => {
    const storage = typeof chrome !== 'undefined' && chrome.storage?.sync
      ? await new Promise((resolve) => chrome.storage.sync.get(['apiBaseUrl', 'authToken'], resolve))
      : {};
    const origin = (storage.apiBaseUrl || DEFAULT_ORIGIN).replace(/\/+$/, '');
    const today = new Date().toISOString().slice(0, 10);

    if (storage.authToken) {
      try {
        btn.textContent = 'Syncing...';
        const res = await fetch(`${origin}/api/progress/import`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${storage.authToken}`,
          },
          body: JSON.stringify({
            completed: [slug],
            activity: { [today]: 1 },
          }),
        });
        if (res.ok) {
          btn.textContent = 'Tracked in CodeGrill';
          btn.style.background = '#15803d';
          return;
        }
      } catch {
        // Fall back to opening CodeGrill directly
      }
    }

    window.open(`${origin}/problems?problem=${encodeURIComponent(slug)}`, '_blank', 'noopener,noreferrer');
  });

  document.body.appendChild(btn);
})();
