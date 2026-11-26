export const ROADMAP_DOMAINS = [
  {
    id: 'dsa',
    labels: {
      en: 'DSA & Algorithms',
      ja: 'DSA・アルゴリズム',
      hi: 'DSA और एल्गोरिदम',
      es: 'DSA y Algoritmos',
      zh: '算法与数据结构',
      ko: 'DSA 및 알고리즘',
    },
  },
  {
    id: 'system-design',
    labels: {
      en: 'System Design (HLD)',
      ja: 'システム設計 (HLD)',
      hi: 'सिस्टम डिज़ाइन (HLD)',
      es: 'Diseño de Sistemas',
      zh: '系统设计 (HLD)',
      ko: '시스템 디자인 (HLD)',
    },
  },
  {
    id: 'lld',
    labels: {
      en: 'Low-Level Design',
      ja: '詳細設計 (LLD)',
      hi: 'लो-लेवल डिज़ाइन (LLD)',
      es: 'Diseño de Bajo Nivel',
      zh: '底层设计 (LLD)',
      ko: '저수준 설계 (LLD)',
    },
  },
  {
    id: 'databases',
    labels: {
      en: 'SQL & Databases',
      ja: 'SQL・データベース',
      hi: 'SQL और डेटाबेस',
      es: 'SQL y Bases de Datos',
      zh: 'SQL 与数据库内核',
      ko: 'SQL 및 데이터베이스',
    },
  },
  {
    id: 'concurrency',
    labels: {
      en: 'Concurrency & OS',
      ja: '並行処理・OS',
      hi: 'कंकरेंसी और OS',
      es: 'Concurrencia y SO',
      zh: '并发与操作系统',
      ko: '동시성 및 OS',
    },
  },
  {
    id: 'ai-behavioral',
    labels: {
      en: 'AI Systems & Behavioral',
      ja: 'AI設計・行動面接',
      hi: 'AI सिस्टम और बिहेवियरल',
      es: 'IA y Conductual',
      zh: 'AI 系统与行为面试',
      ko: 'AI 시스템 & 인성 면접',
    },
  },
];

export const DOMAIN_TOPICS = {
  'system-design': [
    {
      id: 'sd-networking-lb',
      title: 'Scalability, DNS, CDN & Load Balancing',
      summary: 'Vertical vs. horizontal scaling, latency vs. throughput, L4/L7 load balancers, reverse proxies, and CDN caching.',
      prerequisites: [],
      checklist: [
        'Compare vertical vs. horizontal scaling and stateless services',
        'Explain L4 (TCP) vs. L7 (HTTP) load balancing algorithms',
        'Design CDN push vs. pull strategies for static & edge media',
        'Run back-of-the-envelope QPS, bandwidth, and storage estimates',
      ],
      interviewPrompts: ['Estimate storage & QPS for a 100M DAU photo service', 'Choose L4 vs. L7 load balancing for WebSockets'],
      resources: [
        { title: 'System Design Primer — Scalability & Load Balancers', url: 'https://github.com/donnemartin/system-design-primer/blob/master/README.md', platform: 'GitHub' },
        { title: 'System Design Guide — Networking & CDN', url: 'https://github.com/karanpratapsingh/system-design/blob/master/README.md', platform: 'GitHub' },
      ],
    },
    {
      id: 'sd-caching',
      title: 'Caching Strategies & Eviction',
      summary: 'Cache-aside, write-through, write-behind, LRU/LFU eviction, TTL jitter, and mitigating cache stampedes.',
      prerequisites: ['sd-networking-lb'],
      checklist: [
        'Contrast cache-aside, read-through, write-through, and write-back',
        'Prevent cache stampede / thundering herd with locks or jitter',
        'Handle hot keys and cache invalidation across regions',
      ],
      interviewPrompts: ['How do you prevent stale reads in cache-aside?', 'Mitigate a celebrity hot-key problem in Redis'],
      resources: [
        { title: 'System Design Primer — Caching', url: 'https://github.com/donnemartin/system-design-primer/blob/master/README.md', platform: 'GitHub' },
      ],
    },
    {
      id: 'sd-data-sharding',
      title: 'Replication, Partitioning & Sharding',
      summary: 'Leader-follower vs. multi-leader replication, consistent hashing with virtual nodes, and avoiding shard hotspots.',
      prerequisites: ['sd-networking-lb'],
      checklist: [
        'Explain synchronous vs. asynchronous replication & lag handling',
        'Implement consistent hashing with virtual nodes for rebalancing',
        'Choose shard keys to avoid hotspots and cross-shard joins',
      ],
      interviewPrompts: ['Design a sharding key for a multi-tenant SaaS database', 'Handle replication lag after a user updates their profile'],
      resources: [
        { title: 'System Design Guide — Sharding & Consistent Hashing', url: 'https://github.com/karanpratapsingh/system-design/blob/master/README.md', platform: 'GitHub' },
      ],
    },
    {
      id: 'sd-cap-consensus',
      title: 'CAP, PACELC, Quorum & Consensus',
      summary: 'Consistency vs. availability trade-offs during partitions, R + W > N quorums, vector clocks, and Raft leader election.',
      prerequisites: ['sd-data-sharding'],
      checklist: [
        'Apply CAP and PACELC to real payment vs. social-feed systems',
        'Calculate quorum read/write trade-offs (N, R, W)',
        'Explain Raft leader election, heartbeats, and split-brain prevention',
      ],
      interviewPrompts: ['Why choose CP for ledger transfers and AP for shopping carts?', 'Explain how Raft handles a partitioned leader'],
      resources: [
        { title: 'System Design Primer — Consistency Patterns', url: 'https://github.com/donnemartin/system-design-primer/blob/master/README.md', platform: 'GitHub' },
      ],
    },
    {
      id: 'sd-messaging-async',
      title: 'Message Queues, Event Streaming & Idempotency',
      summary: 'Kafka vs. RabbitMQ, consumer groups, dead-letter queues, outbox pattern, and idempotency keys for at-least-once delivery.',
      prerequisites: ['sd-caching'],
      checklist: [
        'Compare pull-based log streaming (Kafka) vs. push brokers (RabbitMQ)',
        'Design idempotent consumers & transactional outbox pattern',
        'Handle backpressure, retries with exponential backoff, and DLQs',
      ],
      interviewPrompts: ['Guarantee exactly-once payment processing over at-least-once queues', 'Design an order notification pipeline'],
      resources: [
        { title: 'System Design Guide — Asynchronism & Queues', url: 'https://github.com/karanpratapsingh/system-design/blob/master/README.md', platform: 'GitHub' },
      ],
    },
    {
      id: 'sd-rate-limiting',
      title: 'Rate Limiting, API Gateway & Resilience',
      summary: 'Token bucket, leaky bucket, sliding window counters in Redis, circuit breakers, and graceful degradation.',
      prerequisites: ['sd-caching'],
      checklist: [
        'Compare token bucket, fixed window, and sliding window log/counter',
        'Implement distributed atomic rate limiting with Redis Lua scripts',
        'Design circuit breakers, bulkheads, and load shedding',
      ],
      interviewPrompts: ['Design a distributed API rate limiter for 10M req/sec'],
      resources: [
        { title: 'System Design Primer — Solutions Index', url: 'https://github.com/donnemartin/system-design-primer/tree/master/solutions/system_design', platform: 'GitHub' },
      ],
    },
    {
      id: 'sd-blueprint-read',
      title: 'Blueprint: URL Shortener & News Feed',
      summary: 'Read-heavy architectures: Base62/Snowflake ID generation, fan-out on write vs. fan-out on read for hybrid social feeds.',
      prerequisites: ['sd-caching', 'sd-data-sharding'],
      checklist: [
        'Design collision-free ID generation (Snowflake / KGS / Base62)',
        'Compare fan-out on write vs. fan-out on read for celebrity accounts',
        'Optimize feed pagination with cursor-based queries',
      ],
      interviewPrompts: ['Design TinyURL with analytics', 'Design Twitter/X Home Timeline'],
      resources: [
        { title: 'Design Pastebin / URL Shortener', url: 'https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/pastebin/README.md', platform: 'GitHub' },
        { title: 'Design Twitter Timeline', url: 'https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/twitter/README.md', platform: 'GitHub' },
      ],
    },
    {
      id: 'sd-blueprint-write',
      title: 'Blueprint: Chat System & Metrics Monitoring',
      summary: 'Write-heavy & real-time architectures: persistent WebSockets, presence service, message ordering, and time-series ingestion.',
      prerequisites: ['sd-messaging-async', 'sd-cap-consensus'],
      checklist: [
        'Manage stateful WebSocket gateways & service discovery',
        'Guarantee per-conversation message ordering and offline sync',
        'Design time-series rollups, downsampling, and alerting pipelines',
      ],
      interviewPrompts: ['Design WhatsApp / Slack group chat', 'Design a distributed metrics & alerting platform'],
      resources: [
        { title: 'System Design Solutions Directory', url: 'https://github.com/donnemartin/system-design-primer/tree/master/solutions/system_design', platform: 'GitHub' },
      ],
    },
    {
      id: 'sd-blueprint-geo',
      title: 'Blueprint: Uber / Nearby Places & Video Streaming',
      summary: 'Geospatial indexing (Geohash, QuadTree, S2/H3), real-time driver matching, and adaptive bitrate (HLS/DASH) pipelines.',
      prerequisites: ['sd-blueprint-read', 'sd-rate-limiting'],
      checklist: [
        'Compare Geohash, QuadTree, and H3 for moving vs. static points',
        'Design transcoding DAGs and adaptive bitrate streaming (HLS/DASH)',
        'Handle regional failover and multi-region active-active routing',
      ],
      interviewPrompts: ['Design Uber driver-rider matching', 'Design YouTube / Netflix video upload & playback'],
      resources: [
        { title: 'System Design Primer — Full Repository', url: 'https://github.com/donnemartin/system-design-primer', platform: 'GitHub' },
      ],
    },
  ],

  lld: [
    {
      id: 'lld-solid',
      title: 'OOD Foundations & SOLID Principles',
      summary: 'Encapsulation, composition over inheritance, and refactoring real code for Single Responsibility, Open/Closed, and DIP.',
      prerequisites: [],
      checklist: [
        'Apply Single Responsibility & Open/Closed to extensible business rules',
        'Prefer composition over deep inheritance hierarchies',
        'Define clean interfaces and dependency inversion for testability',
      ],
      interviewPrompts: ['Refactor a monolithic payment processor using SOLID'],
      resources: [
        { title: 'Awesome Low-Level Design Guide', url: 'https://github.com/ashishps1/awesome-low-level-design/blob/main/README.md', platform: 'GitHub' },
      ],
    },
    {
      id: 'lld-creational',
      title: 'Creational Patterns (Factory, Builder, Singleton)',
      summary: 'Decoupling object creation for complex configurations, pluggable providers, and thread-safe singletons.',
      prerequisites: ['lld-solid'],
      checklist: [
        'Implement Factory Method & Abstract Factory for multi-provider SDKs',
        'Use Builder for immutable objects with optional parameters',
        'Write thread-safe double-checked Singleton / module singleton',
      ],
      interviewPrompts: ['Design a pluggable notification sender (Email/SMS/Push)'],
      resources: [
        { title: 'Awesome LLD — Design Patterns', url: 'https://github.com/ashishps1/awesome-low-level-design/tree/main/design-patterns', platform: 'GitHub' },
      ],
    },
    {
      id: 'lld-structural-behavioral',
      title: 'Structural & Behavioral Patterns',
      summary: 'Strategy, Observer, Decorator, State, Command, and Chain of Responsibility for clean runtime extensibility.',
      prerequisites: ['lld-solid'],
      checklist: [
        'Use Strategy for swappable pricing, routing, or eviction policies',
        'Use State machine pattern for order/vending/elevator lifecycles',
        'Use Observer / Event Bus for decoupled side effects',
      ],
      interviewPrompts: ['Model a Vending Machine using the State pattern', 'Design a middleware pipeline using Chain of Responsibility'],
      resources: [
        { title: 'Awesome LLD — Patterns Directory', url: 'https://github.com/ashishps1/awesome-low-level-design/tree/main/design-patterns', platform: 'GitHub' },
      ],
    },
    {
      id: 'lld-parking-elevator',
      title: 'Machine Coding: Parking Lot & Elevator System',
      summary: 'Class diagrams, spot assignment strategies, multi-floor scheduling algorithms (SCAN/LOOK), and clean separation of concerns.',
      prerequisites: ['lld-creational', 'lld-structural-behavioral'],
      checklist: [
        'Model vehicle types, spot allocation strategies, and ticketing',
        'Design concurrent entry/exit gates without double-booking spots',
        'Implement Elevator Dispatcher with pluggable scheduling strategy',
      ],
      interviewPrompts: ['Design a multi-level Parking Lot with dynamic pricing', 'Design an Elevator Control System for 20 floors'],
      resources: [
        { title: 'LLD Solutions — Parking Lot & Elevator', url: 'https://github.com/ashishps1/awesome-low-level-design/tree/main/problems', platform: 'GitHub' },
      ],
    },
    {
      id: 'lld-booking-splitwise',
      title: 'Machine Coding: BookMyShow & Splitwise',
      summary: 'Seat-locking with TTL, optimistic vs. pessimistic concurrency, expense split strategies, and debt-simplification graphs.',
      prerequisites: ['lld-parking-elevator'],
      checklist: [
        'Prevent double-booking seats using timed locks + payment confirmation',
        'Implement Equal, Exact, and Percentage split strategies',
        'Minimize cash-flow transactions across group balances',
      ],
      interviewPrompts: ['Design BookMyShow with concurrent seat selection', 'Design Splitwise with balance simplification'],
      resources: [
        { title: 'LLD Problems Repository', url: 'https://github.com/ashishps1/awesome-low-level-design/tree/main/problems', platform: 'GitHub' },
      ],
    },
    {
      id: 'lld-cache-ratelimiter',
      title: 'Machine Coding: LRU/LFU Cache & Rate Limiter',
      summary: 'O(1) doubly-linked list + hash map caches, thread-safe eviction, and modular token/sliding-window rate limiters.',
      prerequisites: ['lld-structural-behavioral'],
      checklist: [
        'Implement generic thread-safe LRU and LFU caches in O(1)',
        'Decouple eviction policy via Strategy interface',
        'Build a multi-tier in-memory Rate Limiter with clock injection for tests',
      ],
      interviewPrompts: ['Design an extensible Cache supporting LRU, LFU, and TTL'],
      resources: [
        { title: 'Awesome LLD — Full Repository', url: 'https://github.com/ashishps1/awesome-low-level-design', platform: 'GitHub' },
      ],
    },
  ],

  databases: [
    {
      id: 'db-sql-windows',
      title: 'Advanced SQL, Joins & Window Functions',
      summary: 'Master ROW_NUMBER, RANK, DENSE_RANK, LAG/LEAD, running totals, and anti-joins used in analytics interviews.',
      prerequisites: [],
      checklist: [
        'Solve top-N-per-group problems with ROW_NUMBER and DENSE_RANK',
        'Compute rolling averages and session gaps with LAG / LEAD',
        'Write clean LEFT JOIN / NOT EXISTS anti-joins without NULL traps',
      ],
      interviewPrompts: ['Find the 2nd highest salary per department', 'Compute 7-day rolling active user retention'],
      resources: [
        { title: 'Tech Interview Handbook — Engineering Guides', url: 'https://github.com/yangshun/tech-interview-handbook/blob/main/README.md', platform: 'GitHub' },
      ],
    },
    {
      id: 'db-ctes-modeling',
      title: 'Recursive CTEs & Schema Modeling',
      summary: 'Hierarchical queries, normalization (1NF–3NF) vs. intentional denormalization, and star schemas.',
      prerequisites: ['db-sql-windows'],
      checklist: [
        'Write recursive CTEs for org charts, categories, and graph paths',
        'Balance normalization vs. read-optimized denormalization',
        'Design composite primary keys, foreign keys, and soft-delete patterns',
      ],
      interviewPrompts: ['Query an entire reporting hierarchy using a recursive CTE'],
      resources: [
        { title: 'System Design Primer — Databases', url: 'https://github.com/donnemartin/system-design-primer/blob/master/README.md', platform: 'GitHub' },
      ],
    },
    {
      id: 'db-indexing-explain',
      title: 'B-Trees, Composite Indexes & EXPLAIN Plans',
      summary: 'Left-most prefix rule, covering indexes, index-only scans, and diagnosing slow sequential scans via EXPLAIN ANALYZE.',
      prerequisites: ['db-sql-windows'],
      checklist: [
        'Order composite index columns by equality first, then range',
        'Identify sequential scans, hash joins, and sort spills in EXPLAIN ANALYZE',
        'Understand write amplification and when indexes hurt throughput',
      ],
      interviewPrompts: ['Why does an index on (a, b) speed up WHERE a = 1 AND b > 5 but not WHERE b = 5?'],
      resources: [
        { title: 'System Design Guide — Indexing & Storage', url: 'https://github.com/karanpratapsingh/system-design/blob/master/README.md', platform: 'GitHub' },
      ],
    },
    {
      id: 'db-acid-isolation',
      title: 'ACID, MVCC & Transaction Isolation',
      summary: 'Read Committed, Repeatable Read, Serializable, MVCC snapshots, dirty/phantom reads, and optimistic vs. pessimistic locking.',
      prerequisites: ['db-indexing-explain'],
      checklist: [
        'Map each isolation level to dirty, non-repeatable, and phantom reads',
        'Explain MVCC snapshot isolation and write skew anomalies',
        'Choose SELECT FOR UPDATE vs. version-column optimistic locking',
      ],
      interviewPrompts: ['Prevent double-spending in an account transfer using isolation & locking'],
      resources: [
        { title: 'System Design Primer — SQL & ACID', url: 'https://github.com/donnemartin/system-design-primer/blob/master/README.md', platform: 'GitHub' },
      ],
    },
    {
      id: 'db-storage-nosql',
      title: 'Storage Engines (LSM vs. B+Tree) & NoSQL',
      summary: 'Write-ahead logs (WAL), SSTables & compaction vs. B+Tree pages, and selecting Key-Value, Document, Wide-Column, or Graph stores.',
      prerequisites: ['db-acid-isolation', 'db-ctes-modeling'],
      checklist: [
        'Contrast LSM-Tree write throughput (Cassandra/RocksDB) vs. B+Tree read latency (Postgres)',
        'Explain Write-Ahead Logging (WAL) for crash recovery',
        'Pick Redis vs. MongoDB vs. Cassandra vs. Neo4j by access pattern',
      ],
      interviewPrompts: ['Why do write-heavy time-series databases prefer LSM-Trees?'],
      resources: [
        { title: 'System Design Primer — NoSQL Overview', url: 'https://github.com/donnemartin/system-design-primer/blob/master/README.md', platform: 'GitHub' },
      ],
    },
  ],

  concurrency: [
    {
      id: 'os-threads-processes',
      title: 'Processes, Threads & Context Switching',
      summary: 'Address spaces, stacks vs. heap, kernel vs. user threads, goroutines/coroutines, and context-switch overhead.',
      prerequisites: [],
      checklist: [
        'Compare process isolation vs. shared-memory thread communication',
        'Explain context switch cost (registers, TLB, CPU cache invalidation)',
        'Understand M:N green threads / coroutines vs. OS threads',
      ],
      interviewPrompts: ['Why can Go spawn 100k goroutines when OS threads top out much lower?'],
      resources: [
        { title: 'System Design Guide — Concurrency Fundamentals', url: 'https://github.com/karanpratapsingh/system-design/blob/master/README.md', platform: 'GitHub' },
      ],
    },
    {
      id: 'os-sync-deadlocks',
      title: 'Mutexes, Semaphores & Deadlock Prevention',
      summary: 'Critical sections, condition variables, read-write locks, Coffman deadlock conditions, and lock ordering.',
      prerequisites: ['os-threads-processes'],
      checklist: [
        'Distinguish Mutex (ownership) from Semaphore (signaling/permits)',
        'List the 4 Coffman conditions and break deadlocks with lock ordering',
        'Use Read-Write locks safely without writer starvation',
      ],
      interviewPrompts: ['Solve Dining Philosophers without deadlock or starvation'],
      resources: [
        { title: 'Tech Interview Handbook — CS Fundamentals', url: 'https://github.com/yangshun/tech-interview-handbook/blob/main/README.md', platform: 'GitHub' },
      ],
    },
    {
      id: 'os-patterns-lockfree',
      title: 'Producer-Consumer, Thread Pools & CAS',
      summary: 'Bounded blocking queues, executor pools, work stealing, atomic Compare-And-Swap (CAS), and ABA problem.',
      prerequisites: ['os-sync-deadlocks'],
      checklist: [
        'Implement a thread-safe bounded Producer-Consumer queue',
        'Size CPU-bound vs. I/O-bound thread pools cleanly',
        'Explain atomic CAS operations and lock-free counters',
      ],
      interviewPrompts: ['Implement a bounded blocking queue with condition variables'],
      resources: [
        { title: 'Awesome LLD — Concurrency Problems', url: 'https://github.com/ashishps1/awesome-low-level-design/tree/main/problems', platform: 'GitHub' },
      ],
    },
    {
      id: 'os-async-eventloop',
      title: 'Async I/O, Event Loops & Networking',
      summary: 'epoll/kqueue multiplexing, Node.js/Netty event loops, TCP 3-way handshake, TLS 1.3, HTTP/2 multiplexing, and WebSockets.',
      prerequisites: ['os-threads-processes'],
      checklist: [
        'Explain how a single-threaded event loop handles 100k concurrent sockets',
        'Trace a full HTTPS request (DNS → TCP → TLS → HTTP/2)',
        'Compare polling, long-polling, SSE, and WebSockets',
      ],
      interviewPrompts: ['What happens step-by-step when you type a URL in the browser?'],
      resources: [
        { title: 'System Design Primer — Networking & HTTP', url: 'https://github.com/donnemartin/system-design-primer/blob/master/README.md', platform: 'GitHub' },
      ],
    },
  ],

  'ai-behavioral': [
    {
      id: 'ai-rag-retrieval',
      title: 'LLM Foundations, RAG & Hybrid Search',
      summary: 'Chunking strategies, dense embeddings + BM25 hybrid retrieval, reranking, context window budgets, and citations.',
      prerequisites: [],
      checklist: [
        'Design document ingestion, semantic chunking, and metadata filtering',
        'Combine BM25 lexical search with vector ANN (HNSW) + cross-encoder reranking',
        'Mitigate hallucinations with grounded citations and refusal thresholds',
      ],
      interviewPrompts: ['Design an enterprise RAG search assistant with ACL permissions'],
      resources: [
        { title: 'AI & System Design Primer', url: 'https://github.com/donnemartin/system-design-primer/blob/master/README.md', platform: 'GitHub' },
      ],
    },
    {
      id: 'ai-agents-evals',
      title: 'AI Agents, Tool Calling & Evaluation',
      summary: 'Structured outputs, tool-use loops, sandboxing, guardrails, offline golden eval sets, and latency/cost optimization.',
      prerequisites: ['ai-rag-retrieval'],
      checklist: [
        'Design deterministic tool schemas, retries, and human-in-the-loop approvals',
        'Build automated eval harnesses (precision, recall, faithfulness, latency)',
        'Optimize TTFT and cost with prompt caching, routing, and streaming',
      ],
      interviewPrompts: ['How do you evaluate and safely ship a coding or support AI agent?'],
      resources: [
        { title: 'System Design Guide — Production Architecture', url: 'https://github.com/karanpratapsingh/system-design/blob/master/README.md', platform: 'GitHub' },
      ],
    },
    {
      id: 'beh-star-stories',
      title: 'STAR Storytelling & Impact Bank',
      summary: 'Build 6–8 reusable engineering stories covering scale, ownership, trade-offs, and quantified business outcomes.',
      prerequisites: [],
      checklist: [
        'Draft 6 STAR stories with clear personal "I" actions and metrics',
        'Keep each answer crisp (2–3 minutes) with deep-dive follow-ups ready',
        'Prepare a 60-second pitch tailored to your target seniority level',
      ],
      interviewPrompts: ['Tell me about your most technically challenging project'],
      resources: [
        { title: 'Tech Interview Handbook — Behavioral Guide', url: 'https://github.com/yangshun/tech-interview-handbook/blob/main/README.md', platform: 'GitHub' },
      ],
    },
    {
      id: 'beh-conflict-leadership',
      title: 'Conflict, Failure Ownership & Bar Raiser',
      summary: 'Navigating disagreements with PMs/staff engineers, owning production outages, handling ambiguity, and mentoring.',
      prerequisites: ['beh-star-stories'],
      checklist: [
        'Prepare an outage/failure story focused on root cause & permanent guardrails',
        'Prepare a constructive disagreement story backed by data & trade-offs',
        'Articulate cross-team influence, design reviews, and mentorship impact',
      ],
      interviewPrompts: ['Tell me about a time you disagreed with a senior engineer or PM', 'Describe a production incident you owned'],
      resources: [
        { title: 'Tech Interview Handbook — Behavioral Questions', url: 'https://github.com/yangshun/tech-interview-handbook/blob/main/README.md', platform: 'GitHub' },
      ],
    },
  ],
};

export function buildDomainRoadmap(domainId, checkedItems = {}) {
  const rawTopics = DOMAIN_TOPICS[domainId] || [];
  const byId = new Map(rawTopics.map((t) => [t.id, t]));
  const depths = new Map();

  function depthFor(id, stack = new Set()) {
    if (depths.has(id)) return depths.get(id);
    if (stack.has(id) || !byId.has(id)) return 0;
    stack.add(id);
    const prereqs = byId.get(id).prerequisites || [];
    const d = prereqs.length ? Math.max(...prereqs.map((p) => depthFor(p, stack) + 1)) : 0;
    stack.delete(id);
    depths.set(id, d);
    return d;
  }

  const enriched = rawTopics.map((topic) => {
    const total = topic.checklist.length;
    const done = topic.checklist.filter((_, idx) => Boolean(checkedItems[`${topic.id}:${idx}`])).length;
    return {
      ...topic,
      depth: depthFor(topic.id),
      total,
      done,
      complete: total > 0 && done === total,
    };
  });

  const completeMap = new Map(enriched.map((t) => [t.id, t.complete]));
  return enriched.map((topic) => ({
    ...topic,
    ready: (topic.prerequisites || []).every((pid) => completeMap.get(pid)),
  }));
}
