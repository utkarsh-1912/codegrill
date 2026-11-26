const EXT_TO_LANG = {
  py: 'python',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  java: 'java',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  c: 'c',
  cs: 'csharp',
  go: 'go',
  rs: 'rust',
  kt: 'kotlin',
  swift: 'swift',
  rb: 'ruby',
  php: 'php',
  scala: 'scala',
  dart: 'dart',
  md: 'markdown',
};

export function toGitHubRawUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.hostname === 'raw.githubusercontent.com') {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length < 4) return null;
      return {
        rawUrl: url.href,
        owner: parts[0],
        repo: parts[1],
        ref: parts[2],
        filePath: parts.slice(3).join('/'),
      };
    }
    if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 5 || parts[2] !== 'blob') return null;
    const [owner, repo, , ref, ...rest] = parts;
    const filePath = rest.join('/');
    return {
      rawUrl: `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filePath}`,
      owner,
      repo,
      ref,
      filePath,
    };
  } catch {
    return null;
  }
}

export const githubPlugin = {
  id: 'github-content',
  name: 'GitHub Solution & Editorial Fetcher',
  kind: 'code',
  canHandle(url) {
    return Boolean(toGitHubRawUrl(url));
  },
  async fetch(rawUrl, { signal } = {}) {
    const parsed = toGitHubRawUrl(rawUrl);
    if (!parsed) throw new Error('Unsupported GitHub URL');

    const response = await fetch(parsed.rawUrl, {
      signal,
      headers: { 'User-Agent': 'Codegrill-Plugin/1.0' },
    });
    if (!response.ok) {
      throw new Error(`GitHub returned HTTP ${response.status}`);
    }
    const text = await response.text();
    const filename = parsed.filePath.split('/').pop() || 'solution';
    const ext = filename.includes('.') ? filename.split('.').pop().toLowerCase() : '';
    const language = EXT_TO_LANG[ext] || 'text';
    const isMarkdown = language === 'markdown';

    return {
      plugin: 'github-content',
      kind: isMarkdown ? 'markdown' : 'code',
      title: filename,
      repo: `${parsed.owner}/${parsed.repo}`,
      filePath: parsed.filePath,
      language,
      content: text.slice(0, 120000),
      truncated: text.length > 120000,
      sourceUrl: rawUrl,
    };
  },
};
