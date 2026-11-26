const defaultRoomsUrl = 'https://utkristi-colabs.vercel.app/';
const roomIdPattern = /^[a-zA-Z0-9_-]{1,128}$/;
const roomAlphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function roomsDirectory(config = defaultRoomsUrl) {
  try {
    const url = new URL(config);
    return url.protocol === 'https:' && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

export function roomEditor(id, directory) {
  return directory && roomIdPattern.test(id) ? new URL('/editor/' + id, directory) : null;
}

export function newRoomId() {
  return Array.from(crypto.getRandomValues(new Uint32Array(8)), (value) => (
    roomAlphabet[value % roomAlphabet.length]
  )).join('');
}

export function roomInvite(value, directory) {
  const invite = value.trim();
  if (roomIdPattern.test(invite)) return roomEditor(invite, directory);
  const url = roomsDirectory(invite);
  if (!directory || url?.origin !== directory.origin) return null;
  const [, id] = /^\/editor\/([^/]+)\/?$/.exec(url.pathname) ?? [];
  if (id && roomIdPattern.test(id)) return url;
  return roomEditor(url.searchParams.get('room') ?? '', directory);
}

export function studyLocation(hash, problemSlugs) {
  const [page, query] = hash.slice(1).split('?', 2);
  const problem = new URLSearchParams(query).get('problem');
  return {
    page,
    problem: (page === 'problems' || page === 'rooms') && problemSlugs.has(problem) ? problem : '',
  };
}

export function problemShareUrl(address, slug) {
  const url = new URL(address);
  url.search = '';
  url.hash = 'problems?' + new URLSearchParams({ problem: slug });
  return url.href;
}
