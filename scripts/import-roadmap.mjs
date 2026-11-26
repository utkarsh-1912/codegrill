import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resourcesFor, safeUrl } from '../src/catalog.mjs';
import { additionalTopics } from './roadmap-topics.mjs';

const seedPath = new URL('../src/multilingual_leetcode_dataset.json', import.meta.url);
const outputPath = new URL('../src/roadmap.generated.json', import.meta.url);
const licensePath = new URL('../public/licenses/neetcode.txt', import.meta.url);
const seed = JSON.parse(await readFile(seedPath, 'utf8'));
const refresh = process.argv.includes('--refresh');
const repos = {
  neetcode: { name: 'neetcode-gh/leetcode', revision: '2736633bf3d8a81115b10f299306be91cf822f39' },
  doocs: { name: 'doocs/leetcode', revision: '7bc7a924fbb7a00df01f90c1568415732b3dd8bd' },
};
const languages = {
  python: 'Python', java: 'Java', cpp: 'C++', javascript: 'JavaScript', typescript: 'TypeScript',
  c: 'C', csharp: 'C#', go: 'Go', ruby: 'Ruby', swift: 'Swift', kotlin: 'Kotlin',
  rust: 'Rust', scala: 'Scala', dart: 'Dart',
};

async function request(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Codegrill roadmap importer' },
    signal: AbortSignal.timeout(35_000),
  });
  if (!response.ok) throw new Error(`${response.status} fetching ${url}`);
  return response;
}

async function repoTree(repo) {
  const ref = refresh ? 'main' : repo.revision;
  const response = await request(`https://api.github.com/repos/${repo.name}/git/trees/${ref}?recursive=1`);
  const { sha, truncated, tree } = await response.json();
  if (truncated || !tree?.length || !/^[a-f0-9]{40}$/.test(sha)) {
    throw new Error('Incomplete GitHub directory for ' + repo.name);
  }
  return { ...repo, revision: sha, tree };
}

function rawFile(repo, file) {
  return `https://raw.githubusercontent.com/${repo.name}/${repo.revision}/${file}`;
}

function githubLink(repo, mode, file) {
  return `https://github.com/${repo.name}/${mode}/${repo.revision}/${file.split('/').map(encodeURIComponent).join('/')}`;
}

function appendResource(resources, locale, field, entry) {
  const group = resources[locale] ??= { youtube: [], articles: [] };
  const videoId = (value) => safeUrl(value)?.searchParams.get('v');
  if (!group[field].some(({ url }) => url === entry.url || (
    field === 'youtube' && videoId(url) && videoId(url) === videoId(entry.url)
  ))) group[field].push(entry);
}

function makeRoadmap(rows) {
  const existing = new Map(seed.roadmap_categories.map((item) => [item.labels.en, item]));
  return [...new Set(rows.map(({ pattern }) => pattern))].map((pattern, index) => {
    const old = existing.get(pattern);
    if (old) return { ...old, order: index + 1 };
    const topic = additionalTopics[pattern];
    if (!topic) throw new Error('Add category labels and prerequisites for ' + pattern);
    const [id, prerequisites, ja, hi, es, zh, ko] = topic;
    return { id, order: index + 1, prerequisites, labels: { en: pattern, ja, hi, es, zh, ko } };
  });
}

const [neetcode, doocs] = await Promise.all(Object.values(repos).map(repoTree));
const [upstream, license] = await Promise.all([
  request(rawFile(neetcode, '.problemSiteData.json')).then((response) => response.json()),
  request(rawFile(neetcode, 'LICENSE')).then((response) => response.text()),
]);
const rows = upstream.filter(({ neetcode150 }) => neetcode150);
const roadmap_categories = makeRoadmap(rows);
const categoryIds = new Map(roadmap_categories.map(({ id, labels }) => [labels.en, id]));
const seedProblems = new Map(seed.problems.map((problem) => [problem.slug, problem]));

const solutionFiles = new Map();
for (const { path, type } of neetcode.tree) {
  const match = /^([^/]+)\/([^/]+)\.[^.]+$/.exec(path);
  if (type !== 'blob' || !match || !Object.hasOwn(languages, match[1])) continue;
  const [, language, code] = match;
  const files = solutionFiles.get(code) ?? [];
  files.push([language, githubLink(neetcode, 'blob', path)]);
  solutionFiles.set(code, files);
}

const editorialFiles = new Map();
for (const { path, type } of doocs.tree) {
  const match = /^solution\/\d+-\d+\/(\d+)\.[^/]+\/README(_EN)?\.md$/.exec(path);
  if (type !== 'blob' || !match) continue;
  const id = Number(match[1]);
  const links = editorialFiles.get(id) ?? {};
  links[match[2] ? 'en' : 'zh'] = githubLink(doocs, 'blob', path);
  editorialFiles.set(id, links);
}

const problems = rows.map((row) => {
  const slug = row.link.replace(/\/$/, '');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !/^\d+-/.test(row.code) ||
      !/^[\w-]{11}$/.test(row.video) || !['Easy', 'Medium', 'Hard'].includes(row.difficulty)) {
    throw new Error('Invalid upstream problem metadata for ' + row.problem);
  }
  const leetcode_id = Number(row.code.split('-', 1)[0]);
  const existing = seedProblems.get(slug);
  const resources = structuredClone(existing?.resources ?? {});
  appendResource(resources, 'en', 'youtube', {
    title: row.problem + ' walkthrough', channel: 'NeetCode', url: 'https://www.youtube.com/watch?v=' + row.video,
  });
  for (const [locale, url] of Object.entries(editorialFiles.get(leetcode_id) ?? {})) {
    appendResource(resources, locale, 'articles', {
      title: locale === 'zh' ? 'Doocs 中文题解' : 'Doocs written solution', platform: 'GitHub', url,
    });
  }
  return {
    ...existing,
    leetcode_id,
    slug,
    difficulty: row.difficulty,
    category_id: categoryIds.get(row.pattern),
    neetcode_lists: row.blind75 ? ['Blind 75', 'NeetCode 150'] : ['NeetCode 150'],
    leetcode_url: `https://leetcode.com/problems/${slug}/`,
    translations: { ...existing?.translations, en: { title: row.problem } },
    resources,
    solutions: Object.fromEntries(solutionFiles.get(row.code) ?? []),
  };
});

const directories = [
  { locale: 'en', name: 'NeetCode curriculum', url: 'https://neetcode.io/roadmap' },
  { locale: 'en', name: 'NeetCode solutions repository', url: githubLink(neetcode, 'tree', '') },
  { locale: 'en', name: 'Doocs English editorial index', url: githubLink(doocs, 'blob', 'solution/README_EN.md') },
  { locale: 'zh', name: 'Doocs 中文题解目录', url: githubLink(doocs, 'blob', 'solution/README.md') },
  ...Object.entries(languages).filter(([id]) => neetcode.tree.some(({ path, type }) => path === id && type === 'tree'))
    .map(([id, language]) => ({ locale: 'en', name: language + ' solution directory', url: githubLink(neetcode, 'tree', id) })),
  ...Object.entries(seed.curated_channels_and_hubs).flatMap(([locale, entries]) => entries.map((entry) => ({
    locale,
    name: entry.name,
    description: entry.focus,
    url: entry.channel_id ? `https://www.youtube.com/channel/${entry.channel_id}/playlists` : entry.sample_url,
  }))),
];
const videoCount = problems.filter(({ resources }) => resourcesFor(resources, 'en').some(({ kind }) => kind === 'video')).length;
const bilingualEditorialCount = problems.filter(({ leetcode_id }) => {
  const links = editorialFiles.get(leetcode_id);
  return links?.en && links.zh;
}).length;
const codeCount = problems.reduce((total, problem) => total + Object.keys(problem.solutions).length, 0);
const allSlugs = new Set(problems.map(({ slug }) => slug));
if (problems.length !== 150 || allSlugs.size !== 150 || roadmap_categories.length !== 18 ||
    videoCount !== 150 || bilingualEditorialCount !== 150 ||
    problems.some(({ solutions }) => !Object.keys(solutions).length) ||
    seed.problems.some(({ slug }) => !allSlugs.has(slug)) ||
    directories.some(({ url }) => !safeUrl(url))) {
  throw new Error(`Incomplete roadmap: ${problems.length} problems, ${roadmap_categories.length} topics, ${videoCount} videos, ${bilingualEditorialCount} bilingual editorials, ${codeCount} code links`);
}

const data = {
  sources: Object.fromEntries([neetcode, doocs].map((repo) => [repo.name, repo.revision])),
  roadmap_categories,
  problems,
  languages,
  directories,
};
const temporaryPath = new URL(outputPath.href + '.tmp');
await mkdir(new URL('.', licensePath), { recursive: true });
await writeFile(licensePath, license);
await writeFile(temporaryPath, JSON.stringify(data, null, 2) + '\n');
await rename(temporaryPath, outputPath);
console.log(`Imported ${problems.length} problems, ${roadmap_categories.length} topics, ${videoCount} walkthroughs, ${bilingualEditorialCount * 2} written solution links, ${codeCount} code links, and ${directories.length} directories.`);
