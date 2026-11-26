// Complete Interview Tracks content registry:
// - Enriches all 12 dataset modules (System Design, LLD, AI Engineer, FDE) with built-in Markdown/Mermaid/KaTeX study guides,
//   interview practice questions with answer rubrics, related coding problems, and gap-filling videos/docs.
// - Adds dedicated modules for DSA & Behavioral/Leadership tracks so every allocation weight has full content.

export const EXTRA_TRACK_MODULES = [
  {
    id: 'dsa-core-patterns',
    track: 'dsa',
    roles: ['sde', 'ai_engineer', 'fde'],
    levels: ['junior', 'mid', 'senior', 'staff'],
    titles: {
      en: 'Core DSA Patterns & Complexity Mastery',
      ja: '主要DSAパターンと計算量マスター',
      hi: 'कोर DSA पैटर्न और कॉम्प्लेक्सिटी मास्टरी',
      es: 'Patrones Clave de DSA y Complejidad',
      zh: '核心算法模式与复杂度精通',
      ko: '핵심 DSA 패턴 및 복잡도 마스터',
    },
    resources: {
      en: {
        youtube: [
          {
            title: 'NeetCode 150 — Coding Interview Patterns Overview',
            channel: 'NeetCode',
            url: 'https://www.youtube.com/watch?v=3OamzN90kPg',
          },
          {
            title: 'Dynamic Programming Patterns for Coding Interviews',
            channel: 'NeetCode',
            url: 'https://www.youtube.com/watch?v=Y0lT9Fck7qI',
          },
        ],
        articles: [
          {
            platform: 'codegrill',
            title: 'Codegrill Docs — Core DSA Patterns & Behavioral Playbook',
            url: '/docs/dsa/patterns-and-behavioral.md',
          },
          {
            platform: 'github',
            title: 'doocs/leetcode — Multilingual Algorithm Solutions',
            url: 'https://github.com/doocs/leetcode/tree/main/solution',
          },
          {
            platform: 'github',
            title: 'ashishps1/awesome-leetcode-resources — Curated DSA Patterns',
            url: 'https://github.com/ashishps1/awesome-leetcode-resources/blob/main/README.md',
          },
          {
            platform: 'github',
            title: 'yangshun/tech-interview-handbook — Study Guide',
            url: 'https://github.com/yangshun/tech-interview-handbook/blob/main/README.md',
          },
        ],
      },
    },
  },
  {
    id: 'behavioral-leadership-star',
    track: 'behavioral_leadership',
    roles: ['sde', 'ai_engineer', 'fde'],
    levels: ['junior', 'mid', 'senior', 'staff'],
    titles: {
      en: 'Behavioral Interviews, STAR Stories & Engineering Leadership',
      ja: '行動面接・STAR法・エンジニアリングリーダーシップ',
      hi: 'बिहेवियरल इंटरव्यू, STAR स्टोरीज़ और लीडरशिप',
      es: 'Entrevistas Conductuales, STAR y Liderazgo Técnico',
      zh: '行为面试、STAR 故事与技术领导力',
      ko: '행동 면접, STAR 스토리 및 엔지니어링 리더십',
    },
    resources: {
      en: {
        youtube: [
          {
            title: 'How to Ace Behavioral Interviews for Software Engineers',
            channel: 'Exponent',
            url: 'https://www.youtube.com/watch?v=PJKYqLP6MRE',
          },
          {
            title: 'Staff Engineer Leadership & Cross-Team Influence',
            channel: 'TechLead / Exponent',
            url: 'https://www.youtube.com/watch?v=qSJAvd5Mgio',
          },
        ],
        articles: [
          {
            platform: 'codegrill',
            title: 'Codegrill Docs — Behavioral STAR+R Leadership Playbook',
            url: '/docs/dsa/patterns-and-behavioral.md',
          },
          {
            platform: 'github',
            title: 'ashishps1/awesome-behavioral-interviews — STAR Question Bank',
            url: 'https://github.com/ashishps1/awesome-behavioral-interviews/blob/main/README.md',
          },
          {
            platform: 'github',
            title: 'charlax/engineering-management — Leadership Handbook',
            url: 'https://github.com/charlax/engineering-management/blob/master/README.md',
          },
        ],
      },
    },
  },
];

export const TRACK_MODULE_CONTENT = {
  'dsa-core-patterns': {
    roomMode: 'dsa',
    relatedProblems: ['two-sum', 'longest-substring-without-repeating-characters', 'lru-cache', 'course-schedule', 'merge-k-sorted-lists'],
    guide: `## Pattern Recognition Map

Most coding interview problems reduce to 8 high-leverage patterns. Recognize the **input constraint** first:

| Constraint | Likely Time Target | Go-To Patterns |
| --- | --- | --- |
| $n \\le 20$ | $O(2^n)$ or $O(n!)$ | Backtracking, Bitmask DP |
| $n \\le 10^3$ | $O(n^2)$ | 2D DP, Interval DP, Floyd-Warshall |
| $n \\le 10^5$ | $O(n \\log n)$ or $O(n)$ | Sliding Window, Two Pointers, Heap, Monotonic Stack, Binary Search on Answer |
| $n \\le 10^9$ | $O(\\log n)$ or $O(1)$ | Math, Binary Search, Matrix Exponentiation |

\`\`\`mermaid
flowchart LR
    Input["Read Constraints"] --> Sorted{"Sorted or Monotonic?"}
    Sorted -->|Yes| BS["Binary Search / Two Pointers"]
    Sorted -->|No| Graph{"Relationships / Dependencies?"}
    Graph -->|Yes| G["BFS / DFS / Topo Sort / Union-Find"]
    Graph -->|No| Opt{"Optimal Substructure?"}
    Opt -->|Yes| DP["Greedy or DP"]
    Opt -->|No| Hash["HashMap / Heap / Stack"]
\`\`\`

### Verbal Execution Checklist
1. Restate the problem and confirm edge cases (empty input, negatives, duplicates, overflow).
2. State brute force first ($O(n^2)$) and pinpoint the redundant work.
3. Dry-run your optimal algorithm on a tricky 4-element test case before coding.`,
    questions: [
      {
        q: 'When should you choose a Monotonic Stack over a Heap or Sliding Window?',
        tag: 'Pattern Selection',
        answer: 'Use a Monotonic Stack when you need the next/previous greater or smaller element in $O(n)$ amortized time (each element is pushed and popped at most once). Use a Heap when you need global min/max across arbitrary insertions/deletions in $O(\\log n)$.',
      },
      {
        q: 'How do you recognize a "Binary Search on Answer" problem?',
        tag: 'Binary Search',
        answer: 'Look for phrases like "minimize the maximum" or "maximize the minimum" where a feasibility check `canAchieve(mid)` is monotonic (false...false, true...true) and runs in $O(n)$.',
      },
      {
        q: 'When does BFS guarantee shortest path vs requiring Dijkstra?',
        tag: 'Graphs',
        answer: 'Unweighted graphs (or uniform edge weights) use BFS in $O(V + E)$. Non-negative variable weights require Dijkstra with a min-heap in $O((V + E) \\log V)$. Negative weights require Bellman-Ford.',
      },
      {
        q: 'How do you convert top-down memoization to space-optimized bottom-up DP?',
        tag: 'Dynamic Programming',
        answer: 'Identify the topological order of states, replace recursion with nested loops, and if row `i` only depends on row `i - 1`, collapse the 2D table to two 1D rows (or one row iterated backwards).',
      },
    ],
  },

  'behavioral-leadership-star': {
    roomMode: 'behavioral',
    relatedProblems: [],
    guide: `## The STAR+R Framework

Strong senior/staff behavioral answers spend **15% on Situation/Task**, **65% on Action**, and **20% on Result + Reflection**.

\`\`\`mermaid
flowchart LR
    S["Situation (2 sentences)"] --> T["Task (Your ownership)"]
    T --> A["Action (Trade-offs & 'I')"]
    A --> R["Result (Metrics + Reflection)"]
\`\`\`

### Build a 6-Story Matrix Before Interviews
Prepare 6 deeply practiced stories that can flex across any prompt:
1. **Ambiguous technical project** you scoped and shipped end-to-end.
2. **Production incident / outage** where you led root-cause mitigation and postmortem.
3. **Disagreement with a senior engineer or PM** resolved with data and prototypes.
4. **Technical mistake / failure** and the systemic guardrail you added afterward.
5. **Mentorship or cross-team alignment** that multiplied team velocity.
6. **Hard trade-off** (shipping fast vs paying down tech debt).`,
    questions: [
      {
        q: 'Tell me about a time you disagreed with a technical decision made by your lead or PM.',
        tag: 'Conflict & Influence',
        answer: 'Frame around shared user/business goals, bring concrete benchmarks or a small spike prototype, acknowledge valid counter-arguments, and describe how you aligned or committed constructively.',
      },
      {
        q: 'Describe a production outage you caused or helped resolve under pressure.',
        tag: 'Ownership',
        answer: 'Highlight immediate customer mitigation (rollback/feature flag) before deep debugging, clear stakeholder communication, blameless postmortem, and automated regression checks added.',
      },
      {
        q: 'Give an example of shipping a project with ambiguous requirements and a tight deadline.',
        tag: 'Execution',
        answer: 'Explain how you broke ambiguity into explicit milestones, cut non-essential scope with stakeholder sign-off, and delivered an observable MVP early.',
      },
      {
        q: 'Tell me about a time you gave difficult feedback or mentored a struggling teammate.',
        tag: 'Leadership',
        answer: 'Show empathy, specific observable examples (not personality labels), actionable pairing/review plan, and measurable growth over time.',
      },
    ],
  },

  'sd-fundamentals': {
    roomMode: 'hld',
    relatedProblems: ['lru-cache', 'insert-delete-getrandom-o1'],
    extraArticles: [
      {
        platform: 'codegrill',
        title: 'Codegrill Docs — Distributed System Design Fundamentals (with SVG Diagram)',
        url: '/docs/system-design/fundamentals.md',
      },
      {
        platform: 'github',
        title: 'ByteByteGoHq — Top 5 Caching Strategies',
        url: 'https://github.com/ByteByteGoHq/system-design-101/blob/main/data/guides/top-5-caching-strategies.md',
      },
    ],
    guide: `## Distributed System Building Blocks

Every high-level design interview combines the same 7 core primitives:

\`\`\`mermaid
flowchart LR
    Client --> DNS["DNS + CDN"]
    DNS --> LB["L7 Load Balancer"]
    LB --> API["Stateless API Fleet"]
    API --> Cache[("Redis / Memcached")]
    API --> DB[("Sharded SQL / NoSQL")]
    API --> MQ["Kafka / SQS"]
    MQ --> Worker["Async Workers"]
\`\`\`

### Back-of-the-Envelope Cheat Sheet
- $1 \\text{ day} \\approx 86{,}400 \\text{ s} \\approx 10^5 \\text{ s}$
- $1 \\text{M req/day} \\approx 12 \\text{ QPS}$; peak $\\approx 2\\text{–}3\\times$ average
- L1 cache: $1 \\text{ ns}$, RAM: $100 \\text{ ns}$, SSD read: $100 \\mu\\text{s}$, Same-AZ RTT: $0.5 \\text{ ms}$, Cross-region RTT: $50\\text{–}150 \\text{ ms}$

### Core Trade-offs to Articulate
- **Consistency vs Availability (CAP / PACELC)**: Strong consistency (payments, inventory) vs eventual consistency (feeds, likes).
- **Caching patterns**: Cache-Aside (read-heavy), Write-Through (consistent), Write-Back (write-heavy with durability risk).
- **Sharding**: Consistent hashing with virtual nodes prevents hot shards and minimizes key movement on rebalance.`,
    questions: [
      {
        q: 'When would you choose L4 (TCP) vs L7 (HTTP) load balancing?',
        tag: 'Networking',
        answer: 'L4 is faster with lower CPU overhead (routes by IP/port, ideal for WebSockets/gRPC passthrough). L7 inspects HTTP headers, paths, cookies, and supports TLS termination, rate limiting, and canary routing.',
      },
      {
        q: 'How do you prevent cache stampede (thundering herd) when a hot key expires?',
        tag: 'Caching',
        answer: 'Use request coalescing (singleflight/mutex lock per key), probabilistic early expiration, background refresh before TTL expiry, and jittered TTLs.',
      },
      {
        q: 'Compare leader-follower replication vs multi-leader vs leaderless (Dynamo-style) databases.',
        tag: 'Storage',
        answer: 'Leader-follower gives simple consistency with read scaling; multi-leader lowers multi-region write latency but needs conflict resolution (CRDTs/LWW); leaderless uses quorum $W + R > N$ for high availability.',
      },
      {
        q: 'Why do consistent hashing rings use virtual nodes?',
        tag: 'Sharding',
        answer: 'Physical nodes alone cause uneven key distribution and hot spots when a node fails. Virtual nodes spread each server across dozens of ring positions, balancing load evenly and speeding up recovery.',
      },
    ],
  },

  'sd-url-shortener': {
    roomMode: 'hld',
    relatedProblems: ['encode-and-decode-tinyurl', 'lru-cache'],
    extraArticles: [
      {
        platform: 'codegrill',
        title: 'Codegrill Docs — URL Shortener Complete Blueprint',
        url: '/docs/system-design/url-shortener.md',
      },
    ],
    guide: `## URL Shortener Architecture (TinyURL / Bitly)

### Capacity Math
- Suppose $100 \\text{M}$ new URLs/month $\\approx 40 \\text{ writes/sec}$; with 100:1 read-to-write ratio $\\rightarrow 4{,}000 \\text{ reads/sec}$ (peak $\\approx 10{,}000 \\text{ QPS}$).
- A 7-character Base62 code ($[0\\text{-}9, a\\text{-}z, A\\text{-}Z]$) yields $62^7 \\approx 3.52 \\times 10^{12}$ unique keys — enough for 100+ years.

\`\`\`mermaid
flowchart LR
    User --> CDN["Edge / API Gateway"]
    CDN --> ReadAPI["Redirect Service (301/302)"]
    CDN --> WriteAPI["Shorten Service"]
    ReadAPI --> Redis[("Redis Cache")]
    Redis -->|Miss| DB[("Key-Value Store")]
    WriteAPI --> KGS["Snowflake / Counter Range"]
    WriteAPI --> DB
\`\`\`

### Key Design Decisions
- **301 (Permanent) vs 302 (Temporary)**: Use \`302\` if you need click analytics on every redirect; \`301\` reduces server load via browser caching.
- **ID Generation**: Pre-allocated counter ranges per app server (via ZooKeeper/etcd) or Snowflake 64-bit IDs encoded in Base62 — zero collision retries!`,
    questions: [
      {
        q: 'Why is 302 Found preferred over 301 Moved Permanently for Bitly-style analytics?',
        tag: 'HTTP Semantics',
        answer: 'Browsers aggressively cache 301 redirects locally and skip your server on subsequent clicks, breaking click-count, geo, and referrer analytics. 302 forces hits through your redirect service.',
      },
      {
        q: 'Compare hashing (MD5/SHA256 truncated) vs distributed counter + Base62 for short code generation.',
        tag: 'ID Generation',
        answer: 'Truncating a hash risks collisions requiring DB existence checks or Bloom filters. A range-allocated counter + Base62 guarantees uniqueness with zero round-trips; obfuscate sequential IDs with a Feistel cipher if predictability is undesirable.',
      },
      {
        q: 'How do you handle custom aliases and link expiration (TTL)?',
        tag: 'Data Model',
        answer: 'Store custom aliases in the same unique key index with length/character validation. Handle expiration via lazy check on read (`expires_at < now`) plus an async background sweeper to reclaim storage.',
      },
    ],
  },

  'sd-news-feed-twitter': {
    roomMode: 'hld',
    relatedProblems: ['design-twitter', 'merge-k-sorted-lists'],
    guide: `## Social News Feed (Fan-out on Write vs Read)

\`\`\`mermaid
flowchart TD
    Post["User Publishes Post"] --> Router{"Follower Count > 100k?"}
    Router -->|No: Normal User| FOW["Fan-out on Write → Push post_id to Followers' Redis Timelines"]
    Router -->|Yes: Celebrity| FOR["Skip Push → Merge on Read"]
    Feed["User Opens Feed"] --> ReadCache["Read Precomputed Redis List"]
    ReadCache --> Merge["K-Way Merge with Followed Celebrities"]
    Merge --> Hydrate["Hydrate Post & Author Metadata"]
\`\`\`

### Hybrid Fan-out Strategy
- **Fan-out on Write (Push)**: Ultra-fast reads ($O(1)$ Redis \`LRANGE\`), great for normal users (<100k followers).
- **Fan-out on Read (Pull)**: Avoids 50M-write storms when a celebrity posts.
- **Hybrid**: Push for normal users, pull-and-merge (K-way merge by Snowflake timestamp) for celebrity accounts.`,
    questions: [
      {
        q: 'Why does pure fan-out-on-write fail for celebrity accounts?',
        tag: 'Scalability',
        answer: 'A single tweet from an account with 50M followers triggers 50M Redis writes, saturating worker queues and causing massive feed delivery lag (hotkey problem). Hybrid fan-out solves this.',
      },
      {
        q: 'How should cursor-based pagination work so new posts do not cause duplicate items?',
        tag: 'API Design',
        answer: 'Use opaque cursor tokens based on monotonic Snowflake `post_id` (`before_id`), never `OFFSET/LIMIT`. Snowflake IDs embed timestamp + shard + sequence, guaranteeing stable ordering.',
      },
      {
        q: 'How do you hydrate millions of post IDs into full objects (text, media, like counts) quickly?',
        tag: 'Caching',
        answer: 'Batch-fetch post objects and user profiles from a distributed cache (Redis/Memcached) with MGET, fall back to DB only for misses, and serve media via CDN URLs.',
      },
    ],
  },

  'sd-realtime-chat-collab': {
    roomMode: 'hld',
    relatedProblems: ['lru-cache', 'design-add-and-search-words-data-structure'],
    extraArticles: [
      {
        platform: 'codegrill',
        title: 'Codegrill Docs — Realtime Chat, News Feed & Streaming',
        url: '/docs/system-design/realtime-and-media.md',
      },
      {
        platform: 'github',
        title: 'ByteByteGoHq — Design WhatsApp / Discord Chat System',
        url: 'https://github.com/ByteByteGoHq/system-design-101/blob/main/data/guides/how-do-we-design-a-chat-application-like-whatsapp-facebook-messenger-or-discord.md',
      },
      {
        platform: 'github',
        title: 'ByteByteGoHq — Polling vs SSE vs WebSockets',
        url: 'https://github.com/ByteByteGoHq/system-design-101/blob/main/data/guides/shortlong-polling-sse-websocket.md',
      },
    ],
    guide: `## Real-Time Chat (WhatsApp) & Collaborative Editing (Google Docs)

\`\`\`mermaid
flowchart LR
    A["Client A"] <-->|WebSocket| GW1["Chat Gateway 1"]
    B["Client B"] <-->|WebSocket| GW2["Chat Gateway 2"]
    GW1 --> Reg[("Session Registry: user → gateway")]
    GW1 --> Kafka["Message Bus"] --> GW2
    GW1 --> MsgDB[("Cassandra / ScyllaDB")]
    GW2 --> Push["APNs / FCM Offline Push"]
\`\`\`

### Delivery Guarantees & Ordering
- **At-least-once delivery + idempotency**: Clients attach a UUID \`client_msg_id\`; receivers deduplicate and send \`ACK\` (sent → delivered → read).
- **Group chat fan-out**: Small groups (<500) push via message bus; huge channels use pull/topic subscriptions.
- **Collaborative editing**: Compare **OT (Operational Transformation)** (centralized server transforms concurrent ops, used in Google Docs) vs **CRDTs** (mathematically commutative state/ops, ideal for local-first & P2P offline sync).`,
    questions: [
      {
        q: 'How does Chat Gateway 1 find which gateway holds Client B’s active WebSocket?',
        tag: 'Routing',
        answer: 'Maintain a fast in-memory session registry (Redis) mapping `user_id -> gateway_node_id` with heartbeat TTLs. If Client B is offline, persist the message and trigger APNs/FCM push notification.',
      },
      {
        q: 'When should you pick CRDTs vs Operational Transformation (OT) for collaborative docs?',
        tag: 'Consistency',
        answer: 'Choose OT when you have a single authoritative server and want smaller metadata overhead; choose CRDTs (e.g., Yjs, Automerge) for offline-first editing, decentralized sync, and simpler convergence guarantees.',
      },
      {
        q: 'How do you handle presence ("online" / "last seen") without overwhelming the database?',
        tag: 'Presence',
        answer: 'Send lightweight heartbeats every 15–30s to a Redis presence store with short TTLs; broadcast status changes lazily only to active conversation participants rather than all contacts.',
      },
    ],
  },

  'sd-video-streaming': {
    roomMode: 'hld',
    relatedProblems: ['task-scheduler', 'lru-cache'],
    extraArticles: [
      {
        platform: 'codegrill',
        title: 'Codegrill Docs — Video Streaming & Adaptive Bitrate',
        url: '/docs/system-design/realtime-and-media.md',
      },
      {
        platform: 'github',
        title: 'ByteByteGoHq — How YouTube Handles Massive Video Uploads',
        url: 'https://github.com/ByteByteGoHq/system-design-101/blob/main/data/guides/how-does-youtube-handle-massive-video-content-upload.md',
      },
      {
        platform: 'github',
        title: 'ByteByteGoHq — Live Streaming & CDN Explained',
        url: 'https://github.com/ByteByteGoHq/system-design-101/blob/main/data/guides/live-streaming-explained.md',
      },
    ],
    guide: `## Video Streaming Pipeline (YouTube / Netflix)

\`\`\`mermaid
flowchart LR
    Creator --> Upload["Resumable Chunk Upload"]
    Upload --> Raw[("Object Storage: Raw")]
    Raw --> DAG["Transcoding DAG Workers"]
    DAG --> Split["GOP Split + 1080p/720p/480p Encode"]
    Split --> HLS[("HLS / DASH Segments + Manifest")]
    HLS --> CDN["Multi-Tier CDN Edge"] --> Viewer["Adaptive Bitrate Player"]
\`\`\`

### Key Concepts
- **Resumable Uploads**: Split large files into 5–10 MB chunks with checksums so dropped connections resume from the last chunk.
- **DAG Parallel Transcoding**: Split video at Group-of-Pictures (GOP) boundaries and transcode chunks in parallel across resolutions (360p–4K) and codecs (H.264, VP9, AV1).
- **Adaptive Bitrate (ABR)**: Serve HLS/DASH manifests so the player dynamically switches segment quality every 2–6 seconds based on buffer health and bandwidth.`,
    questions: [
      {
        q: 'Why split raw video into GOP chunks before transcoding instead of encoding the full file on one worker?',
        tag: 'Pipeline',
        answer: 'Parallelizing GOP chunks across a worker fleet cuts encoding latency for a 1-hour video from hours to minutes and isolates retries to a single failed chunk.',
      },
      {
        q: 'How do you optimize CDN storage costs when 95% of views hit 5% of videos?',
        tag: 'CDN & Cost',
        answer: 'Push popular videos proactively to ISP edge PoPs; serve long-tail videos on-demand from regional origin shields and transcode niche resolutions/codecs lazily only after a view threshold.',
      },
    ],
  },

  'lld-ood-patterns': {
    roomMode: 'lld',
    relatedProblems: ['lru-cache', 'min-stack', 'design-add-and-search-words-data-structure'],
    extraArticles: [
      {
        platform: 'codegrill',
        title: 'Codegrill Docs — LLD & OOD Pattern Matrix (with SVG Diagram)',
        url: '/docs/lld/ood-patterns-playbook.md',
      },
      {
        platform: 'github',
        title: 'ashishps1/awesome-low-level-design — Machine Coding Problems',
        url: 'https://github.com/ashishps1/awesome-low-level-design/tree/main/problems',
      },
    ],
    guide: `## Low-Level Design & OOD Blueprint

\`\`\`mermaid
classDiagram
    class PaymentProcessor {
      +process(order)
    }
    class PricingStrategy {
      <<interface>>
      +calculate(order)
    }
    class HourlyPricing
    class FlatRatePricing
    PaymentProcessor --> PricingStrategy
    PricingStrategy <|.. HourlyPricing
    PricingStrategy <|.. FlatRatePricing
\`\`\`

### 5-Step LLD Interview Flow
1. **Clarify core use cases & actors** (avoid over-engineering unasked features).
2. **Identify nouns (entities) & verbs (behaviors)** + invariants.
3. **Apply SOLID & targeted patterns**: Strategy (swappable policies), State (lifecycle transitions), Factory (creation), Observer (events), Decorator (composable features).
4. **Address concurrency**: Fine-grained locks (e.g., per-spot or per-account lock), optimistic concurrency (\`version\` field), and idempotency keys.
5. **Trace one end-to-end flow** and explain how a new requirement plugs in without modifying existing classes (Open/Closed Principle).`,
    questions: [
      {
        q: 'Design a Multi-Floor Parking Lot with different vehicle sizes, hourly pricing, and concurrent entry gates.',
        tag: 'Classic LLD',
        answer: 'Separate `ParkingFloor`, `ParkingSpot`, `Ticket`, `PricingStrategy`, and `SpotAllocationStrategy`. Prevent double-booking a spot using atomic compare-and-swap or per-spot locks.',
      },
      {
        q: 'When does the State pattern beat a `switch` statement on an enum?',
        tag: 'Design Patterns',
        answer: 'When transitions have complex per-state rules and side effects (e.g., Elevator, Vending Machine, Order lifecycle). Each state encapsulates valid transitions and throws on invalid actions.',
      },
      {
        q: 'How do you make an in-memory Rate Limiter SDK thread-safe under high contention?',
        tag: 'Concurrency',
        answer: 'Use striped locks or `ConcurrentHashMap.compute` keyed by `clientId` so different users never block each other, paired with monotonic clock (`System.nanoTime()` / `performance.now()`) to avoid wall-clock drift.',
      },
    ],
  },

  'ai-roadmap-foundations': {
    roomMode: 'hld',
    relatedProblems: [],
    guide: `## Production AI Engineering Foundations

\`\`\`mermaid
flowchart LR
    Prompt["System + User Prompt"] --> Router["Model Router"]
    Router --> Context["Context Builder (RAG + Memory)"]
    Context --> LLM["LLM Inference (Streaming)"]
    LLM --> Guard["Structured Output + Guardrails"]
    Guard --> Trace["Observability & Eval Loop"]
\`\`\`

### Production AI Pillars
- **Context Engineering**: Token budgets, prompt versioning, structured JSON schemas, and deterministic few-shot examples.
- **Inference Economics**: Balance TTFT (Time to First Token), throughput (tokens/sec), KV-cache prefix reuse, and model tiering (small router/classifier + frontier reasoning model).
- **Reliability**: Retries with exponential backoff, fallback providers, timeout budgets, and strict output validation.`,
    questions: [
      {
        q: 'How do you reduce Time to First Token (TTFT) and inference cost for a production LLM app?',
        tag: 'Inference',
        answer: 'Keep static system instructions at the front to maximize KV-cache prompt prefix hits, route simple intents to smaller/faster models, stream SSE tokens immediately, and cache frequent semantic queries.',
      },
      {
        q: 'When should you choose Prompting + RAG vs Fine-Tuning?',
        tag: 'Architecture',
        answer: 'Use RAG when knowledge changes frequently or needs citations/permissions. Use fine-tuning to teach consistent style, domain-specific formatting, or distill a frontier model into a smaller low-latency model.',
      },
    ],
  },

  'ai-rag-retrieval': {
    roomMode: 'hld',
    relatedProblems: ['top-k-frequent-elements', 'implement-trie-prefix-tree'],
    extraArticles: [
      {
        platform: 'codegrill',
        title: 'Codegrill Docs — Production Hybrid RAG Pipeline (with SVG Diagram)',
        url: '/docs/ai/rag-hybrid-search.md',
      },
      {
        platform: 'github',
        title: 'NirDiamant/RAG_Techniques — All 40+ RAG Notebooks',
        url: 'https://github.com/NirDiamant/RAG_Techniques/tree/main/all_rag_techniques',
      },
    ],
    extraVideos: [
      {
        title: 'RAG From Scratch — Indexing, Retrieval, Hybrid Search & Reranking',
        channel: 'LangChain',
        url: 'https://www.youtube.com/watch?v=sVcwVQRHIc8',
      },
    ],
    guide: `## Production RAG: Hybrid Search & Reranking

\`\`\`mermaid
flowchart LR
    Query --> Rewrite["Query Rewrite / HyDE"]
    Rewrite --> BM25["Sparse Search (BM25)"]
    Rewrite --> Dense["Dense Vector Search (HNSW)"]
    BM25 --> RRF["Reciprocal Rank Fusion"]
    Dense --> RRF
    RRF --> Rerank["Cross-Encoder Reranker (Top-5)"]
    Rerank --> Gen["Grounded LLM + Citations"]
\`\`\`

### Why Hybrid Retrieval Wins
- **Dense embeddings** capture semantic synonyms ("car" ↔ "automobile") but miss exact error codes, SKUs, and acronyms.
- **BM25 (sparse)** nails exact keyword & identifier matches.
- **Reciprocal Rank Fusion (RRF)**: $\\text{score}(d) = \\sum \\frac{1}{k + \\text{rank}(d)}$ merges both lists cleanly before a cross-encoder reranker picks the final top-K chunks.
- **Chunking**: Prefer structure-aware chunking (headings, code blocks) with 10–15% overlap and parent-document metadata.`,
    questions: [
      {
        q: 'How do you enforce per-user document ACLs (permissions) inside a vector database?',
        tag: 'Security & RAG',
        answer: 'Attach `tenant_id` / `allowed_groups` metadata to every chunk and apply **pre-filtering** during index search (never post-filtering after top-K, which can leak existence or return zero allowed results).',
      },
      {
        q: 'How do you diagnose whether a RAG failure is a retrieval bug or a generation hallucination?',
        tag: 'Evaluation',
        answer: 'Separate retrieval metrics (Recall@K, MRR, NDCG against golden chunk IDs) from generation metrics (faithfulness / groundedness and answer relevance). Fix retrieval first before tuning prompts.',
      },
    ],
  },

  'ai-system-design-gateway': {
    roomMode: 'hld',
    relatedProblems: ['lru-cache', 'task-scheduler'],
    guide: `## AI Gateway, Semantic Caching & Guardrails

\`\`\`mermaid
flowchart LR
    App --> GW["LLM Gateway"]
    GW --> RL["Token Rate Limiter"]
    GW --> SC["Semantic Cache (Cosine > 0.96)"]
    SC -->|Miss| InGuard["Input Guardrails (PII / Injection)"]
    InGuard --> Providers["Multi-Provider Pool + Circuit Breaker"]
    Providers --> OutGuard["Output Schema + Safety Check"]
    OutGuard --> Telemetry["Latency / Cost / Token Logs"]
\`\`\`

### Gateway Responsibilities
- **Token-aware Rate Limiting**: Limit by estimated input + max output tokens per tenant, not just request count.
- **Resilience**: Provider circuit breakers, automatic failover across regions/models, and streaming SSE pass-through.
- **Guardrails**: PII redaction, prompt-injection classifiers, and JSON schema validation with bounded repair retries.`,
    questions: [
      {
        q: 'What are the risks of semantic caching for LLM responses, and how do you mitigate them?',
        tag: 'Caching',
        answer: 'False-positive cache hits can return wrong answers for subtly different queries (e.g., negation or different user context). Mitigate with high similarity thresholds, tenant/user scoping, and disabling semantic cache for personalized or time-sensitive queries.',
      },
      {
        q: 'How do you design token-based rate limiting when you only know exact output tokens after generation finishes?',
        tag: 'Rate Limiting',
        answer: 'Reserve an estimated token budget upfront (`prompt_tokens + estimated_completion`), then reconcile (refund or deduct the delta) from the tenant’s token bucket once the stream finishes.',
      },
    ],
  },

  'ai-evals-agents': {
    roomMode: 'hld',
    relatedProblems: ['course-schedule', 'evaluate-reverse-polish-notation'],
    extraArticles: [
      {
        platform: 'codegrill',
        title: 'Codegrill Docs — LLM Gateways, Evals & FDE Playbook',
        url: '/docs/ai/llm-gateway-evals-fde.md',
      },
      {
        platform: 'github',
        title: 'Anthropic Claude Cookbooks — Agentic Workflow Patterns',
        url: 'https://github.com/anthropics/claude-cookbooks/blob/main/patterns/agents/README.md',
      },
      {
        platform: 'github',
        title: 'Anthropic Claude Cookbooks — Building Evals (.ipynb)',
        url: 'https://github.com/anthropics/claude-cookbooks/blob/main/misc/building_evals.ipynb',
      },
    ],
    guide: `## LLM Evals & Reliable Agentic Workflows

\`\`\`mermaid
flowchart LR
    Task --> Plan["Planner / Tool Router"]
    Plan --> Tool["Sandboxed Tool Call"]
    Tool --> Obs["Observation + State Update"]
    Obs --> Check{"Done or Max Steps?"}
    Check -->|No| Plan
    Check -->|Yes| Eval["Offline + Online Eval Suite"]
\`\`\`

### Building Evals That Actually Catch Regressions
1. **Golden Dataset**: Curate 50–200 real production edge cases (not just synthetic happy paths).
2. **Layered Graders**: Deterministic checks first (JSON schema, code tests, SQL execution), LLM-as-a-Judge with clear rubrics second, human calibration third.
3. **Agent Safety**: Bound max turns, enforce tool-call schemas, require human confirmation for destructive writes, and log full step traces.`,
    questions: [
      {
        q: 'How do you prevent infinite loops and runaway costs in multi-step tool-using agents?',
        tag: 'Agents',
        answer: 'Enforce strict `max_steps`, total token/dollar budgets, per-tool timeouts, duplicate tool-call cycle detection, and graceful fallback summaries when a budget is reached.',
      },
      {
        q: 'How do you calibrate an LLM-as-a-Judge evaluator so it correlates with human ratings?',
        tag: 'Evals',
        answer: 'Use binary or 1–3 rubric criteria with explicit few-shot examples, test pairwise ordering swaps to cancel position bias, and measure Cohen’s kappa against a human-labeled validation set.',
      },
    ],
  },

  'fde-interview-loop': {
    roomMode: 'behavioral',
    relatedProblems: ['two-sum', 'lru-cache'],
    guide: `## Forward Deployed Engineer (FDE) Interview Loop

FDE roles (Palantir, OpenAI, Anthropic, Scale) blend **customer discovery**, **rapid systems prototyping**, and **production software engineering**.

\`\`\`mermaid
flowchart LR
    D["1. Customer Discovery"] --> P["2. Decomposition & Scoping"]
    P --> B["3. Working Prototype"]
    B --> S["4. Production Hardening"]
\`\`\`

### What Interviewers Evaluate
- **Decomposition**: Turning a vague business pain point ("our ops team spends 40 hrs/week triaging tickets") into concrete data sources, SLAs, and a 2-week pilot milestone.
- **Pragmatic Coding**: Writing clean, testable integration code (API ingestion, dirty-data handling, retries) quickly.
- **Executive & Technical Communication**: Explaining trade-offs clearly to both a VP and a platform engineer.`,
    questions: [
      {
        q: 'A hospital network says their intake workflow is too slow. How do you run the first 30-minute discovery session?',
        tag: 'Decomposition',
        answer: 'Map the current end-to-end workflow and bottleneck metrics, identify data systems (EHR/APIs) and compliance constraints (HIPAA), define a measurable pilot KPI, and propose a narrow 2-week proof of value.',
      },
      {
        q: 'How do you decide when to build a custom customer integration vs push a generalized feature back into the core product?',
        tag: 'Product Judgment',
        answer: 'Ship a cleanly isolated adapter to unblock the customer quickly; once 2–3 customers share the same pattern, abstract the common interface into the core platform to avoid bespoke maintenance debt.',
      },
    ],
  },

  'fde-agent-customer-integration': {
    roomMode: 'hld',
    relatedProblems: ['merge-intervals', 'course-schedule'],
    extraVideos: [
      {
        title: 'Building Effective AI Agents — Patterns & Production Deployment',
        channel: 'Anthropic / AI Engineer',
        url: 'https://www.youtube.com/watch?v=LP5OCa20Zpg',
      },
    ],
    guide: `## Ambiguous Problem Decomposition & Production Agent Deployment

\`\`\`mermaid
flowchart LR
    Legacy["Customer Legacy DB / APIs"] --> Adapter["Typed Connector + Schema Validator"]
    Adapter --> Agent["Workflow Agent (Human-in-the-Loop)"]
    Agent --> Audit["Audit Log + Confidence Threshold"]
    Audit -->|High Confidence| Auto["Auto-Execute"]
    Audit -->|Low Confidence| Review["Ops Review Queue"]
\`\`\`

### Enterprise Deployment Playbook
- **Shadow Mode First**: Run the AI workflow in read-only shadow mode alongside human operators to benchmark accuracy before enabling writes.
- **Human-in-the-Loop (HITL)**: Route low-confidence or high-impact actions to an approval queue with clear citations.
- **Dirty Data Resilience**: Validate external webhook/CSV payloads strictly, quarantine malformed records to a dead-letter queue, and design idempotent replay jobs.`,
    questions: [
      {
        q: 'How do you roll out an AI automation agent safely into a risk-averse enterprise customer environment?',
        tag: 'Deployment',
        answer: 'Follow a 3-phase rollout: (1) Shadow mode to measure precision/recall on real traffic, (2) Co-pilot / human-approval mode for writes with full audit logs, (3) Gradual auto-execution for high-confidence slices with instant kill switches.',
      },
      {
        q: 'A customer’s legacy API has undocumented rate limits and occasional 500 errors. How do you build a reliable connector?',
        tag: 'Integration',
        answer: 'Implement adaptive rate limiting with exponential backoff + jitter, circuit breaking, idempotency keys on writes, dead-letter queuing for poison payloads, and alerting on schema drift.',
      },
    ],
  },
};

export function getAllTrackModules(seed) {
  const base = [
    ...(seed?.system_design_modules || []),
    ...(seed?.ai_engineer_modules || []),
    ...(seed?.fde_modules || []),
  ];
  const existingIds = new Set(base.map((m) => m.id));
  const merged = [...base, ...EXTRA_TRACK_MODULES.filter((m) => !existingIds.has(m.id))];

  return merged.map((mod) => {
    const content = TRACK_MODULE_CONTENT[mod.id] || {};
    const enRes = mod.resources?.en || { youtube: [], articles: [] };
    const mergedYoutube = [...(enRes.youtube || []), ...(content.extraVideos || [])];
    const mergedArticles = [...(enRes.articles || []), ...(content.extraArticles || [])];
    return {
      ...mod,
      resources: {
        ...mod.resources,
        en: {
          ...enRes,
          youtube: mergedYoutube,
          articles: mergedArticles,
        },
      },
      studyGuide: content.guide || '',
      questions: content.questions || [],
      relatedProblems: content.relatedProblems || [],
      roomMode: content.roomMode || 'hld',
    };
  });
}
