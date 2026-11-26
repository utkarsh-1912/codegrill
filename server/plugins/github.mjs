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
  markdown: 'markdown',
  txt: 'text',
};

const BINARY_EXT_RE = /^(graffle|pdf|zip|tar|gz|tgz|bz2|xz|7z|rar|doc|docx|ppt|pptx|xls|xlsx|key|pages|numbers|sketch|fig|psd|ai|eps|mp4|mov|m4v|webm|avi|mkv|mp3|wav|ogg|flac|ttf|otf|woff|woff2|eot|wasm|bin|exe|dll|so|dylib|class|jar|pyc|o|a|sqlite|sqlite3|db|parquet|pickle|pkl|pt|pth|onnx|pb|h5|hdf5|dmg|iso)$/;

function looksBinaryText(text) {
  if (!text) return false;
  const sample = text.slice(0, 2000);
  if (sample.includes('\u0000')) return true;
  let bad = 0;
  for (let i = 0; i < sample.length; i += 1) {
    const code = sample.charCodeAt(i);
    if (code === 0xfffd || (code < 32 && code !== 9 && code !== 10 && code !== 13)) {
      bad += 1;
    }
  }
  return sample.length > 0 && bad / sample.length > 0.06;
}

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

export function parseGitHubTreeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 4 || parts[2] !== 'tree') return null;
    const [owner, repo, , ref, ...rest] = parts;
    return {
      owner,
      repo,
      ref,
      dirPath: rest.join('/'),
    };
  } catch {
    return null;
  }
}

export function parseGitHubRepoRoot(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length !== 2) return null;
    if (['topics', 'explore', 'marketplace', 'settings', 'orgs', 'search'].includes(parts[0].toLowerCase())) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

export const githubPlugin = {
  id: 'github-content',
  name: 'GitHub Solution, Editorial & Directory Fetcher',
  kind: 'code',
  canHandle(url) {
    return Boolean(toGitHubRawUrl(url) || parseGitHubTreeUrl(url) || parseGitHubRepoRoot(url));
  },
  async fetch(rawUrl, { signal } = {}) {
    const repoRoot = parseGitHubRepoRoot(rawUrl);
    if (repoRoot) {
      const apiEndpoint = `https://api.github.com/repos/${repoRoot.owner}/${repoRoot.repo}/readme`;
      const response = await fetch(apiEndpoint, {
        signal,
        headers: {
          'User-Agent': 'Codegrill-Plugin/1.0',
          Accept: 'application/vnd.github.raw+json',
        },
      });
      if (!response.ok) {
        throw new Error(`GitHub README API returned HTTP ${response.status}`);
      }
      const content = await response.text();
      return {
        plugin: 'github-content',
        kind: 'markdown',
        title: `${repoRoot.owner}/${repoRoot.repo} — README.md`,
        repo: `${repoRoot.owner}/${repoRoot.repo}`,
        filePath: 'README.md',
        language: 'markdown',
        content: content.slice(0, 120000),
        truncated: content.length > 120000,
        sourceUrl: `https://github.com/${repoRoot.owner}/${repoRoot.repo}/blob/HEAD/README.md`,
      };
    }

    const tree = parseGitHubTreeUrl(rawUrl);
    if (tree) {
      const apiPath = tree.dirPath ? `/${tree.dirPath}` : '';
      const apiEndpoint = `https://api.github.com/repos/${tree.owner}/${tree.repo}/contents${apiPath}?ref=${encodeURIComponent(tree.ref)}`;
      const response = await fetch(apiEndpoint, {
        signal,
        headers: {
          'User-Agent': 'Codegrill-Plugin/1.0',
          Accept: 'application/vnd.github+json',
        },
      });
      if (!response.ok) {
        throw new Error(`GitHub API returned HTTP ${response.status}`);
      }
      const list = await response.json();
      const entries = (Array.isArray(list) ? list : [])
        .slice(0, 120)
        .map((entry) => ({
          name: entry.name,
          type: entry.type, // 'file' | 'dir'
          path: entry.path,
          url: entry.html_url || rawUrl,
        }));
      return {
        plugin: 'github-content',
        kind: 'directory',
        title: tree.dirPath || `${tree.owner}/${tree.repo}`,
        repo: `${tree.owner}/${tree.repo}`,
        entries,
        sourceUrl: rawUrl,
      };
    }

    const parsed = toGitHubRawUrl(rawUrl);
    if (!parsed) throw new Error('Unsupported GitHub URL');

    const filename = parsed.filePath.split('/').pop() || 'solution';
    const ext = filename.includes('.') ? filename.split('.').pop().toLowerCase() : '';
    if (/^(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/.test(ext)) {
      return {
        plugin: 'github-content',
        kind: 'image',
        title: filename,
        repo: `${parsed.owner}/${parsed.repo}`,
        filePath: parsed.filePath,
        imageUrl: parsed.rawUrl,
        sourceUrl: rawUrl,
      };
    }

    if (ext === 'apkg') {
      return {
        plugin: 'github-content',
        kind: 'apkg',
        title: filename,
        repo: `${parsed.owner}/${parsed.repo}`,
        filePath: parsed.filePath,
        downloadUrl: parsed.rawUrl,
        sourceUrl: rawUrl,
      };
    }

    if (BINARY_EXT_RE.test(ext)) {
      return {
        plugin: 'github-content',
        kind: 'binary',
        title: filename,
        extension: ext,
        repo: `${parsed.owner}/${parsed.repo}`,
        filePath: parsed.filePath,
        downloadUrl: parsed.rawUrl,
        sourceUrl: rawUrl,
      };
    }

    const response = await fetch(parsed.rawUrl, {
      signal,
      headers: { 'User-Agent': 'Codegrill-Plugin/1.0' },
    });
    if (!response.ok) {
      throw new Error(`GitHub returned HTTP ${response.status}`);
    }
    const text = await response.text();

    if (ext !== 'ipynb' && looksBinaryText(text)) {
      return {
        plugin: 'github-content',
        kind: 'binary',
        title: filename,
        extension: ext || 'bin',
        repo: `${parsed.owner}/${parsed.repo}`,
        filePath: parsed.filePath,
        downloadUrl: parsed.rawUrl,
        sourceUrl: rawUrl,
      };
    }

    if (ext === 'ipynb') {
      try {
        const nb = JSON.parse(text);
        const lang = nb?.metadata?.kernelspec?.language || nb?.metadata?.language_info?.name || 'python';
        const cells = (Array.isArray(nb?.cells) ? nb.cells : []).slice(0, 120).map((cell) => ({
          cell_type: cell.cell_type || 'code',
          source: Array.isArray(cell.source) ? cell.source.join('') : String(cell.source || ''),
          execution_count: cell.execution_count ?? null,
          outputs: Array.isArray(cell.outputs) ? cell.outputs.slice(0, 8) : [],
        }));
        return {
          plugin: 'github-content',
          kind: 'notebook',
          title: filename,
          repo: `${parsed.owner}/${parsed.repo}`,
          filePath: parsed.filePath,
          language: lang,
          cells,
          sourceUrl: rawUrl,
        };
      } catch {
        // Fall through to raw JSON code view if malformed notebook
      }
    }

    const language = EXT_TO_LANG[ext] || 'text';
    const kind = language === 'markdown' ? 'markdown' : ext === 'txt' ? 'text' : 'code';

    return {
      plugin: 'github-content',
      kind,
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
