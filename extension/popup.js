const DEFAULT_ORIGIN = 'https://codegrill.vercel.app';
const apiInput = document.getElementById('apiBaseUrl');
const tokenInput = document.getElementById('authToken');
const statusEl = document.getElementById('status');

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? '#f87171' : '#86efac';
}

if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
  chrome.storage.sync.get(['apiBaseUrl', 'authToken'], (stored) => {
    apiInput.value = stored.apiBaseUrl || DEFAULT_ORIGIN;
    tokenInput.value = stored.authToken || '';
  });
}

document.getElementById('saveBtn').addEventListener('click', () => {
  const apiBaseUrl = (apiInput.value || DEFAULT_ORIGIN).trim().replace(/\/+$/, '');
  const authToken = (tokenInput.value || '').trim();
  if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
    chrome.storage.sync.set({ apiBaseUrl, authToken }, () => {
      setStatus('Saved extension settings.');
    });
  } else {
    setStatus('Chrome storage API unavailable.', true);
  }
});

document.getElementById('testBtn').addEventListener('click', async () => {
  const origin = (apiInput.value || DEFAULT_ORIGIN).trim().replace(/\/+$/, '');
  setStatus('Checking connection...');
  try {
    const res = await fetch(`${origin}/api/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setStatus(`Connected (${data.storage || 'online'}).`);
  } catch (err) {
    setStatus(`Connection failed: ${err?.message || 'unreachable'}`, true);
  }
});
