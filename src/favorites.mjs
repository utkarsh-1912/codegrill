const FAVORITE_CONTENT_KEY = 'codegrill:favorite-content:v1';

export function contentFavId({ url, title }) {
  return String(url || '').trim() || `guide:${String(title || '').trim()}`;
}

export function readFavoriteContent() {
  try {
    const raw = JSON.parse(localStorage.getItem(FAVORITE_CONTENT_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

export function isContentFavorited(item) {
  const id = contentFavId(item);
  if (!id) return false;
  return Boolean(readFavoriteContent()[id]);
}

export function toggleFavoriteContent(item) {
  const id = contentFavId(item);
  if (!id) return { favorited: false, all: readFavoriteContent() };
  const all = readFavoriteContent();
  let favorited = false;
  if (all[id]) {
    delete all[id];
    favorited = false;
  } else {
    all[id] = {
      id,
      url: item.url || '',
      title: item.title || item.url || 'Saved item',
      kind: item.kind || 'article',
      badge: item.badge || '',
      content: item.content || '',
      sourceUrl: item.sourceUrl || item.url || '',
      savedAt: new Date().toISOString(),
    };
    favorited = true;
  }
  try {
    localStorage.setItem(FAVORITE_CONTENT_KEY, JSON.stringify(all));
  } catch {
    // Ignore storage quota errors
  }
  return { favorited, all };
}
