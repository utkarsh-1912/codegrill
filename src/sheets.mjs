import { CODEFORCES_PROBLEMS, HACKERRANK_PROBLEMS } from './externalProblems.mjs';

const CODEFORCES_CORE_SLUGS = CODEFORCES_PROBLEMS.map((p) => p.slug);
const HACKERRANK_KIT_SLUGS = HACKERRANK_PROBLEMS.map((p) => p.slug);

// Popular curated interview series/sheets mapped cleanly onto the verified 150-problem catalog,
// plus Grind-75-style dynamic weekly schedule generation and custom user series helpers.

const BLIND_75_SLUGS = [
  'contains-duplicate', 'valid-anagram', 'two-sum', 'group-anagrams', 'top-k-frequent-elements',
  'product-of-array-except-self', 'encode-and-decode-strings', 'longest-consecutive-sequence',
  'valid-palindrome', '3sum', 'container-with-most-water',
  'best-time-to-buy-and-sell-stock', 'longest-substring-without-repeating-characters',
  'longest-repeating-character-replacement', 'minimum-window-substring',
  'valid-parentheses',
  'find-minimum-in-rotated-sorted-array', 'search-in-rotated-sorted-array',
  'reverse-linked-list', 'merge-two-sorted-lists', 'reorder-list', 'remove-nth-node-from-end-of-list',
  'linked-list-cycle', 'merge-k-sorted-lists',
  'invert-binary-tree', 'maximum-depth-of-binary-tree', 'same-tree', 'subtree-of-another-tree',
  'lowest-common-ancestor-of-a-binary-search-tree', 'binary-tree-level-order-traversal',
  'validate-binary-search-tree', 'kth-smallest-element-in-a-bst',
  'construct-binary-tree-from-preorder-and-inorder-traversal', 'binary-tree-maximum-path-sum',
  'serialize-and-deserialize-binary-tree',
  'implement-trie-prefix-tree', 'design-add-and-search-words-data-structure', 'word-search-ii',
  'find-median-from-data-stream',
  'combination-sum', 'word-search',
  'number-of-islands', 'clone-graph', 'pacific-atlantic-water-flow', 'course-schedule',
  'number-of-connected-components-in-an-undirected-graph', 'graph-valid-tree', 'alien-dictionary',
  'climbing-stairs', 'house-robber', 'house-robber-ii', 'longest-palindromic-substring',
  'palindromic-substrings', 'decode-ways', 'coin-change', 'maximum-product-subarray',
  'word-break', 'longest-increasing-subsequence',
  'unique-paths', 'longest-common-subsequence',
  'maximum-subarray', 'jump-game',
  'insert-interval', 'merge-intervals', 'non-overlapping-intervals', 'meeting-rooms', 'meeting-rooms-ii',
  'rotate-image', 'spiral-matrix', 'set-matrix-zeroes',
  'number-of-1-bits', 'counting-bits', 'reverse-bits', 'missing-number', 'sum-of-two-integers',
];

const GRIND_75_SLUGS = [
  'two-sum', 'valid-parentheses', 'merge-two-sorted-lists', 'best-time-to-buy-and-sell-stock',
  'valid-palindrome', 'invert-binary-tree', 'valid-anagram', 'binary-search',
  'lowest-common-ancestor-of-a-binary-search-tree', 'balanced-binary-tree', 'linked-list-cycle',
  'climbing-stairs', 'reverse-linked-list', 'diameter-of-binary-tree', 'maximum-depth-of-binary-tree',
  'contains-duplicate', 'maximum-subarray', 'insert-interval', 'k-closest-points-to-origin',
  'longest-substring-without-repeating-characters', '3sum', 'binary-tree-level-order-traversal',
  'clone-graph', 'evaluate-reverse-polish-notation', 'course-schedule', 'implement-trie-prefix-tree',
  'coin-change', 'product-of-array-except-self', 'min-stack', 'validate-binary-search-tree',
  'number-of-islands', 'rotting-oranges', 'search-in-rotated-sorted-array', 'combination-sum',
  'permutations', 'merge-intervals', 'time-based-key-value-store', 'word-break',
  'partition-equal-subset-sum', 'spiral-matrix', 'subsets', 'binary-tree-right-side-view',
  'longest-palindromic-substring', 'unique-paths', 'construct-binary-tree-from-preorder-and-inorder-traversal',
  'container-with-most-water', 'letter-combinations-of-a-phone-number', 'word-search',
  'kth-smallest-element-in-a-bst', 'minimum-window-substring', 'serialize-and-deserialize-binary-tree',
  'trapping-rain-water', 'find-median-from-data-stream', 'word-ladder', 'largest-rectangle-in-histogram',
  'merge-k-sorted-lists', 'lru-cache', 'task-scheduler', 'daily-temperatures', 'house-robber',
  'gas-station', 'longest-consecutive-sequence', 'rotate-image', 'jump-game', 'add-two-numbers',
  'generate-parentheses', 'longest-increasing-subsequence', 'edit-distance', 'top-k-frequent-elements',
  'course-schedule-ii', 'pacific-atlantic-water-flow', 'remove-nth-node-from-end-of-list',
  'find-the-duplicate-number', 'sliding-window-maximum', 'median-of-two-sorted-arrays',
];

const STRIVER_SDE_SLUGS = [
  'set-matrix-zeroes', 'maximum-subarray', 'best-time-to-buy-and-sell-stock', 'rotate-image',
  'merge-intervals', 'find-the-duplicate-number', 'search-a-2d-matrix', 'powx-n',
  'unique-paths', 'two-sum', 'longest-consecutive-sequence', 'longest-substring-without-repeating-characters',
  'reverse-linked-list', 'merge-two-sorted-lists', 'remove-nth-node-from-end-of-list',
  'add-two-numbers', 'linked-list-cycle', 'reverse-nodes-in-k-group', 'copy-list-with-random-pointer',
  '3sum', 'trapping-rain-water',
  'subsets', 'subsets-ii', 'combination-sum', 'combination-sum-ii', 'palindrome-partitioning',
  'permutations', 'n-queens',
  'search-in-rotated-sorted-array', 'median-of-two-sorted-arrays', 'koko-eating-bananas',
  'kth-largest-element-in-an-array', 'find-median-from-data-stream', 'top-k-frequent-elements',
  'valid-parentheses', 'lru-cache', 'largest-rectangle-in-histogram', 'sliding-window-maximum', 'min-stack',
  'rotting-oranges', 'longest-palindromic-substring', 'valid-anagram',
  'binary-tree-right-side-view', 'binary-tree-level-order-traversal', 'maximum-depth-of-binary-tree',
  'diameter-of-binary-tree', 'balanced-binary-tree', 'same-tree', 'binary-tree-maximum-path-sum',
  'construct-binary-tree-from-preorder-and-inorder-traversal', 'serialize-and-deserialize-binary-tree',
  'validate-binary-search-tree', 'lowest-common-ancestor-of-a-binary-search-tree', 'kth-smallest-element-in-a-bst',
  'clone-graph', 'course-schedule', 'number-of-islands', 'network-delay-time', 'min-cost-to-connect-all-points',
  'maximum-product-subarray', 'longest-increasing-subsequence', 'longest-common-subsequence',
  'edit-distance', 'coin-change', 'partition-equal-subset-sum', 'word-break',
  'implement-trie-prefix-tree', 'word-search-ii', 'single-number', 'counting-bits',
];

const STRIVER_A2Z_CORE_SLUGS = [
  'contains-duplicate', 'two-sum', 'maximum-subarray', 'best-time-to-buy-and-sell-stock',
  'longest-consecutive-sequence', 'set-matrix-zeroes', 'rotate-image', 'spiral-matrix', '3sum', 'merge-intervals',
  'binary-search', 'search-in-rotated-sorted-array', 'find-minimum-in-rotated-sorted-array',
  'koko-eating-bananas', 'search-a-2d-matrix', 'median-of-two-sorted-arrays',
  'valid-anagram', 'valid-palindrome', 'longest-palindromic-substring',
  'reverse-linked-list', 'linked-list-cycle', 'remove-nth-node-from-end-of-list',
  'add-two-numbers', 'reverse-nodes-in-k-group', 'copy-list-with-random-pointer',
  'powx-n', 'generate-parentheses', 'subsets', 'combination-sum', 'combination-sum-ii',
  'subsets-ii', 'letter-combinations-of-a-phone-number', 'palindrome-partitioning', 'word-search', 'n-queens',
  'single-number', 'number-of-1-bits', 'counting-bits', 'missing-number',
  'valid-parentheses', 'min-stack', 'daily-temperatures', 'trapping-rain-water',
  'largest-rectangle-in-histogram', 'sliding-window-maximum', 'lru-cache',
  'longest-substring-without-repeating-characters', 'longest-repeating-character-replacement', 'minimum-window-substring',
  'kth-largest-element-in-an-array', 'merge-k-sorted-lists', 'task-scheduler', 'hand-of-straights',
  'kth-largest-element-in-a-stream', 'find-median-from-data-stream', 'top-k-frequent-elements',
  'jump-game', 'jump-game-ii', 'insert-interval', 'non-overlapping-intervals', 'meeting-rooms-ii',
  'maximum-depth-of-binary-tree', 'balanced-binary-tree', 'diameter-of-binary-tree',
  'binary-tree-maximum-path-sum', 'same-tree', 'binary-tree-right-side-view',
  'binary-tree-level-order-traversal', 'construct-binary-tree-from-preorder-and-inorder-traversal',
  'serialize-and-deserialize-binary-tree', 'validate-binary-search-tree',
  'kth-smallest-element-in-a-bst', 'lowest-common-ancestor-of-a-binary-search-tree',
  'number-of-islands', 'rotting-oranges', 'surrounded-regions', 'word-ladder',
  'course-schedule', 'course-schedule-ii', 'alien-dictionary', 'network-delay-time',
  'cheapest-flights-within-k-stops', 'min-cost-to-connect-all-points', 'swim-in-rising-water',
  'climbing-stairs', 'house-robber', 'house-robber-ii', 'unique-paths', 'partition-equal-subset-sum',
  'coin-change', 'coin-change-ii', 'target-sum', 'longest-common-subsequence',
  'distinct-subsequences', 'edit-distance', 'best-time-to-buy-and-sell-stock-with-cooldown',
  'longest-increasing-subsequence', 'burst-balloons', 'implement-trie-prefix-tree',
];

const FAANG_30_SLUGS = [
  'two-sum', 'group-anagrams', 'product-of-array-except-self', 'longest-consecutive-sequence',
  '3sum', 'container-with-most-water', 'trapping-rain-water',
  'longest-substring-without-repeating-characters', 'minimum-window-substring',
  'valid-parentheses', 'largest-rectangle-in-histogram',
  'search-in-rotated-sorted-array', 'median-of-two-sorted-arrays',
  'reverse-linked-list', 'lru-cache', 'merge-k-sorted-lists',
  'binary-tree-level-order-traversal', 'validate-binary-search-tree',
  'binary-tree-maximum-path-sum', 'serialize-and-deserialize-binary-tree',
  'implement-trie-prefix-tree', 'find-median-from-data-stream',
  'word-search', 'number-of-islands', 'course-schedule', 'word-ladder',
  'coin-change', 'longest-increasing-subsequence', 'edit-distance', 'merge-intervals',
];

export const BUILTIN_SHEETS = [
  {
    id: 'codegrill-150',
    source: 'Codegrill',
    badge: 'Complete',
    plannerSupported: true,
    names: {
      en: 'Codegrill 150 Roadmap',
      ja: 'Codegrill 150 ロードマップ',
      hi: 'कोडग्रिल 150 रोडमैप',
      es: 'Ruta Codegrill 150',
      zh: 'Codegrill 150 完整路線',
      ko: 'Codegrill 150 로드맵',
    },
    descriptions: {
      en: 'All 150 pattern-connected problems across 18 core interview topics.',
      ja: '18の主要トピックにわたる全150問の完全ロードマップ。',
      hi: '18 मुख्य इंटरव्यू टॉपिक्स में सभी 150 पैटर्न-आधारित प्रश्न।',
      es: 'Los 150 problemas conectados por patrones en 18 temas clave.',
      zh: '涵蓋 18 個核心面試主題的全部 150 道模式化題目。',
      ko: '18개 핵심 면접 주제에 걸친 150개 패턴 기반 문제 전체.',
    },
    slugs: null, // null means all problems in catalog
  },
  {
    id: 'striver-a2z-core',
    source: 'takeUforward / Striver',
    badge: 'Step-by-step',
    plannerSupported: true,
    names: {
      en: "Striver's A2Z Core Sheet",
      ja: 'Striver A2Z コアシート',
      hi: 'स्ट्राइवर A2Z कोर शीट',
      es: 'Hoja Core A2Z de Striver',
      zh: 'Striver A2Z 核心題單',
      ko: 'Striver A2Z 핵심 시트',
    },
    descriptions: {
      en: 'Step-by-step beginner-to-advanced DSA progression inspired by takeUforward A2Z.',
      ja: 'takeUforward A2Zに着想を得た基礎から応用までの段階的DSAコース。',
      hi: 'takeUforward A2Z से प्रेरित शुरुआती से एडवांस्ड DSA प्रगति पथ।',
      es: 'Progresión DSA paso a paso de básico a avanzado inspirada en takeUforward A2Z.',
      zh: '受 takeUforward A2Z 啟發、由淺入深的系統化 DSA 進階路線。',
      ko: 'takeUforward A2Z에서 영감을 받은 초급부터 고급까지 단계별 DSA 과정.',
    },
    slugs: STRIVER_A2Z_CORE_SLUGS,
  },
  {
    id: 'striver-sde-sheet',
    source: 'takeUforward / Striver',
    badge: 'Interview Sprint',
    plannerSupported: true,
    names: {
      en: "Striver's SDE Sheet Core",
      ja: 'Striver SDE コアシート',
      hi: 'स्ट्राइवर SDE शीट कोर',
      es: 'Hoja SDE Core de Striver',
      zh: 'Striver SDE 核心衝刺單',
      ko: 'Striver SDE 핵심 시트',
    },
    descriptions: {
      en: 'High-frequency product-company SDE interview questions curated for rapid revision.',
      ja: 'プロダクト企業のSDE面接で頻出の重要問題を厳選した復習シート。',
      hi: 'प्रोडक्ट कंपनियों के SDE इंटरव्यू के लिए उच्च-आवृत्ति और त्वरित पुनरावृत्ति प्रश्न।',
      es: 'Preguntas frecuentes de entrevistas SDE para repaso rápido.',
      zh: '專為軟體工程師面試高頻考點設計的快速複習清單。',
      ko: '제품 기반 기업 SDE 면접의 빈출 핵심 문제를 모은 빠른 복습 시트.',
    },
    slugs: STRIVER_SDE_SLUGS,
  },
  {
    id: 'blind-75',
    source: 'Blind 75',
    badge: 'Classic',
    plannerSupported: true,
    names: {
      en: 'Blind 75 Essentials',
      ja: 'Blind 75 必須問題',
      hi: 'ब्लाइंड 75 आवश्यक प्रश्न',
      es: 'Esenciales Blind 75',
      zh: 'Blind 75 經典必刷',
      ko: 'Blind 75 핵심 문제',
    },
    descriptions: {
      en: 'The iconic 75 must-know coding interview problems covering high-yield patterns.',
      ja: 'コーディング面接の定番パターンを網羅する名作75問。',
      hi: 'उच्च-उपज इंटरव्यू पैटर्न को कवर करने वाले प्रसिद्ध 75 अनिवार्य प्रश्न।',
      es: 'Los 75 problemas icónicos imprescindibles para entrevistas técnicas.',
      zh: '涵蓋高頻面試解題模式的經典 75 道必刷題。',
      ko: '핵심 코딩 면접 패턴을 다루는 대표적인 75개 필수 문제.',
    },
    slugs: BLIND_75_SLUGS,
  },
  {
    id: 'grind-75',
    source: 'Tech Interview Handbook',
    badge: 'Time-boxed',
    plannerSupported: true,
    names: {
      en: 'Grind 75 Weekly Planner',
      ja: 'Grind 75 週間プランナー',
      hi: 'ग्राइंड 75 साप्ताहिक प्लानर',
      es: 'Planificador Semanal Grind 75',
      zh: 'Grind 75 週計畫題單',
      ko: 'Grind 75 주간 플래너',
    },
    descriptions: {
      en: 'Balanced weekly study schedule customizable by target weeks and hours per week.',
      ja: '目標週数と週あたり学習時間に合わせて自動分割できる実践シート。',
      hi: 'लक्ष्य सप्ताह और प्रति सप्ताह घंटों के अनुसार अनुकूलन योग्य अध्ययन योजना।',
      es: 'Plan semanal equilibrado personalizable por semanas y horas disponibles.',
      zh: '可依目標週數與每週學習時數自動排程的平衡刷題計畫。',
      ko: '목표 주수와 주당 학습 시간에 맞춰 자동 배분되는 균형 잡힌 학습 시트.',
    },
    slugs: GRIND_75_SLUGS,
  },
  {
    id: 'faang-30',
    source: 'Rapid Revision',
    badge: '30 High-ROI',
    plannerSupported: false,
    names: {
      en: 'FAANG 30 Rapid Revision',
      ja: 'FAANG 30 直前総復習',
      hi: 'FAANG 30 त्वरित रिवीजन',
      es: 'Repaso Rápido FAANG 30',
      zh: 'FAANG 30 考前速刷',
      ko: 'FAANG 30 단기 핵심 복습',
    },
    descriptions: {
      en: '30 highest-signal problems to review in the final week before interviews.',
      ja: '面接直前の1週間で総仕上げするための最重要30問。',
      hi: 'इंटरव्यू से पहले अंतिम सप्ताह में दोहराने के लिए 30 सबसे महत्वपूर्ण प्रश्न।',
      es: 'Los 30 problemas de mayor impacto para repasar la última semana.',
      zh: '面試前一週最值得反覆複習的 30 道高含金量代表題。',
      ko: '면접 직전 마지막 주에 집중 복습할 최고 효율 30문제.',
    },
    slugs: FAANG_30_SLUGS,
  },
  {
    id: 'codeforces-core',
    source: 'Codeforces',
    badge: '800–1900',
    plannerSupported: true,
    names: {
      en: 'Codeforces Competitive Core',
      ja: 'Codeforces 競技プログラミング厳選',
      hi: 'कोडफोर्सेस कॉम्पिटिटिव कोर',
      es: 'Núcleo Competitivo Codeforces',
      zh: 'Codeforces 竞赛核心题单',
      ko: 'Codeforces 알고리즘 핵심',
    },
    descriptions: {
      en: 'Classic Codeforces problems progressing from 800 to 1900 rating across greedy, binary search, DP, and graphs.',
      ja: 'レート800〜1900の貪欲法・二分探索・DP・グラフを網羅するCodeforces定番問題集。',
      hi: '800 से 1900 रेटिंग तक ग्रीडी, बाइनरी सर्च, DP और ग्राफ के प्रमुख कोडफोर्सेस प्रश्न।',
      es: 'Problemas clásicos de Codeforces de rating 800 a 1900 en greedy, búsqueda binaria, DP y grafos.',
      zh: '从 800 到 1900 分段的 Codeforces 经典题目，覆盖贪心、二分、DP 与图论。',
      ko: '레이팅 800~1900 구간의 그리디, 이분 탐색, DP, 그래프 핵심 Codeforces 문제집.',
    },
    slugs: CODEFORCES_CORE_SLUGS,
  },
  {
    id: 'hackerrank-kit',
    source: 'HackerRank',
    badge: 'Interview Kit',
    plannerSupported: true,
    names: {
      en: 'HackerRank Interview Prep Kit',
      ja: 'HackerRank 面接対策キット',
      hi: 'हैकररैंक इंटरव्यू प्रेप किट',
      es: 'Kit de Entrevista HackerRank',
      zh: 'HackerRank 面试准备精选',
      ko: 'HackerRank 면접 대비 키트',
    },
    descriptions: {
      en: 'High-signal HackerRank interview classics covering arrays, heaps, tries, graphs, and dynamic programming.',
      ja: '配列・ヒープ・Trie・グラフ・DPを網羅するHackerRank面接対策の定番問題。',
      hi: 'एरे, हीप, ट्राई, ग्राफ और डायनेमिक प्रोग्रामिंग के प्रमुख हैकररैंक इंटरव्यू प्रश्न।',
      es: 'Clásicos de entrevistas en HackerRank sobre arreglos, heaps, tries, grafos y programación dinámica.',
      zh: '涵盖数组、堆、字典树、图论与动态规划的 HackerRank 高频面试经典题。',
      ko: '배열, 힙, 트라이, 그래프, DP를 아우르는 HackerRank 대표 면접 문제.',
    },
    slugs: HACKERRANK_KIT_SLUGS,
  },
];

export function resolveSheetProblems(sheet, allProblems) {
  if (!sheet) return [];
  if (sheet.slugs === null) return allProblems;
  const bySlug = new Map(allProblems.map((p) => [p.slug, p]));
  return sheet.slugs.map((slug) => bySlug.get(slug)).filter(Boolean);
}

export function buildWeeklyPlan(
  sheetProblems,
  weeks = 8,
  hoursPerWeek = 8,
  difficultyMinutes = { Easy: 20, Medium: 35, Hard: 50 },
) {
  const safeWeeks = Math.max(1, Math.min(52, Number(weeks) || 8));
  const targetMinutesPerWeek = Math.max(60, (Number(hoursPerWeek) || 8) * 60);
  const plan = Array.from({ length: safeWeeks }, (_, index) => ({
    week: index + 1,
    problems: [],
    estimatedMinutes: 0,
  }));

  // Distribute sequentially respecting weekly time budget, overflowing evenly if needed
  let weekIndex = 0;
  for (const problem of sheetProblems) {
    const mins = difficultyMinutes[problem.difficulty] ?? 30;
    while (
      weekIndex < safeWeeks - 1 &&
      plan[weekIndex].problems.length > 0 &&
      plan[weekIndex].estimatedMinutes + mins > targetMinutesPerWeek
    ) {
      weekIndex += 1;
    }
    plan[weekIndex].problems.push(problem);
    plan[weekIndex].estimatedMinutes += mins;
  }

  return plan.filter((bucket) => bucket.problems.length > 0);
}

export function normalizeCustomSheet(input, validSlugs) {
  const name = String(input?.name ?? '').trim().slice(0, 80);
  const description = String(input?.description ?? '').trim().slice(0, 220);
  const rawSlugs = Array.isArray(input?.slugs) ? input.slugs : [];
  const slugs = [...new Set(rawSlugs.filter((slug) => validSlugs.has(slug)))];
  if (!name) throw new Error('Series name is required');
  if (!slugs.length) throw new Error('Select at least one problem');
  const id = input?.id && /^custom-[a-z0-9-]{4,40}$/.test(input.id)
    ? input.id
    : `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    custom: true,
    source: 'Custom Series',
    badge: 'Custom',
    plannerSupported: true,
    names: { en: name },
    descriptions: { en: description || `${slugs.length} curated problems.` },
    slugs,
    createdAt: input?.createdAt || new Date().toISOString(),
  };
}
