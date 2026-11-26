const videoHosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);

export function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

export function resourcesFor(resources, locale, defaultLocale = 'en') {
  const collect = (language) => {
    const group = resources?.[language];
    return [
      ...(group?.youtube ?? []).map((item) => ({ ...item, kind: 'video' })),
      ...(group?.articles ?? []).map((item) => ({ ...item, kind: 'article' })),
    ].flatMap((item) => {
      if (typeof item.url === 'string' && item.url.startsWith('/docs/')) {
        return [{ ...item, url: item.url, locale: language }];
      }
      const url = safeUrl(item.url);
      if (!url) return [];
      if (language !== locale && item.kind === 'video' && videoHosts.has(url.hostname)) {
        url.searchParams.set('cc_lang_pref', locale);
        url.searchParams.set('cc_load_policy', '1');
      }
      return [{ ...item, url: url.href, locale: language }];
    });
  };
  const preferred = collect(locale);
  return preferred.length || locale === defaultLocale ? preferred : collect(defaultLocale);
}

export function roadmapFor(categories, problems, completed) {
  const byTopic = new Map(categories.map((category) => [category.id, []]));
  for (const problem of problems) byTopic.get(problem.category_id)?.push(problem);
  const counts = new Map([...byTopic].map(([id, list]) => [
    id,
    { total: list.length, done: list.filter((problem) => completed.has(problem.slug)).length },
  ]));
  const depths = new Map();
  const visiting = new Set();
  const byId = new Map(categories.map((category) => [category.id, category]));

  function depthFor(id) {
    if (depths.has(id)) return depths.get(id);
    if (visiting.has(id) || !byId.has(id)) throw new Error('Invalid roadmap prerequisites');
    visiting.add(id);
    const depth = Math.max(0, ...byId.get(id).prerequisites.map((parent) => depthFor(parent) + 1));
    visiting.delete(id);
    depths.set(id, depth);
    return depth;
  }

  return [...categories].sort((a, b) => a.order - b.order).map((category) => {
    const count = counts.get(category.id);
    return {
      ...category,
      ...count,
      depth: depthFor(category.id),
      complete: count.total > 0 && count.done === count.total,
      ready: category.prerequisites.every((id) => {
        const parent = counts.get(id);
        return parent && parent.done === parent.total;
      }),
    };
  });
}

export function matchingProblems(problems, categories, { query, difficulty, topic, locale }) {
  const needle = query.trim().toLocaleLowerCase(locale);
  const labels = new Map(categories.map((category) => [category.id, Object.values(category.labels)]));
  return problems.filter((problem) => (
    (!topic || problem.category_id === topic) &&
    (!difficulty || problem.difficulty === difficulty) &&
    (!needle || [
      problem.leetcode_id,
      problem.slug,
      ...Object.values(problem.translations).map(({ title }) => title),
      ...(labels.get(problem.category_id) ?? []),
    ].some((value) => String(value).toLocaleLowerCase(locale).includes(needle)))
  ));
}
