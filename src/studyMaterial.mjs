// Codegrill's built-in original study material for multi-domain roadmap checklist items.
// Supports Markdown tables, code blocks, and Mermaid architecture diagrams.

const GUIDES = {
  'sd-networking-lb:0': `# Vertical vs. Horizontal Scaling & Stateless Services

## Core Trade-offs
| Dimension | Vertical Scaling (Scale Up) | Horizontal Scaling (Scale Out) |
| --- | --- | --- |
| **Mechanism** | Bigger CPU, RAM, NVMe on one host | More commodity nodes behind a load balancer |
| **Limit** | Hard hardware ceiling & high cost | Near-linear scaling for stateless workloads |
| **Availability** | Single point of failure | Survives node & AZ failures |

## Making Services Stateless
- Never store session state or uploaded files on local web-server memory/disk.
- Externalize sessions to **Redis**, files to **Object Storage (S3/GCS)**, and relational state to **PostgreSQL/MySQL**.
- **Interview takeaway:** Start with stateless web tiers behind a load balancer so autoscaling groups can add or drain instances in seconds.`,

  'sd-networking-lb:1': `# L4 vs. L7 Load Balancing

\`\`\`mermaid
flowchart LR
  C["Clients"] --> L4["L4 Load Balancer (TCP/UDP)"]
  L4 --> L7["L7 Reverse Proxy (HTTP/gRPC)"]
  L7 --> A["Service A (/api/orders)"]
  L7 --> B["Service B (/api/search)"]
\`\`\`

- **Layer 4 (Transport):** Routes on IP + Port without terminating TLS or inspecting HTTP headers. Ultra-low latency; ideal for raw TCP, WebSockets, or front-door VIPs.
- **Layer 7 (Application):** Terminates TLS, inspects URL path, cookies, JWT headers, and routes intelligently (canary rollouts, rate limiting, gRPC multiplexing).
- **Algorithms:** Round Robin, Least Connections (best for uneven request durations), and Consistent Hashing (best when backend caches benefit from affinity).`,

  'sd-networking-lb:2': `# CDN Push vs. Pull Strategies

- **Pull CDN (Origin-Pull):** Edge PoP fetches an asset from origin on the first cache miss and caches it according to \`Cache-Control: public, max-age=...\`. Best for high-traffic web assets & images with minimal ops overhead.
- **Push CDN:** Origin proactively uploads content to edge nodes. Best for large, infrequently updated binaries or pre-warming global video launches.
- **Cache Busting:** Use content-hashed filenames (\`app.9f3a2c.js\`) with \`immutable\` headers so you rarely need expensive global CDN purges.`,

  'sd-networking-lb:3': `# Back-of-the-Envelope Capacity Estimation

## Fast Mental Reference
- **1 day** ≈ \`86,400\` seconds ≈ \`10^5\` seconds
- **1M requests/day** ≈ \`12 QPS\` (peak ≈ \`2–3×\` average = \`~30 QPS\`)
- **100M DAU × 20 reads/day** = \`2B reads/day\` ≈ \`23,000 QPS\` (peak ≈ \`60k QPS\`)
- **Storage:** \`1 KB\` per JSON record × \`100M\` records = \`100 GB\` raw (budget \`3×\` for replication + indexes = \`300 GB\`).

**Interview tip:** Always state your assumptions clearly, round aggressively to powers of 10, and tie the final number directly to an architectural decision (e.g., *"300 GB fits on a single Postgres primary; 30 TB requires sharding"*).`,

  'sd-caching:0': `# Caching Patterns: Cache-Aside vs. Write-Through vs. Write-Back

\`\`\`mermaid
sequenceDiagram
  participant App
  participant Cache as Redis Cache
  participant DB as Primary DB
  App->>Cache: GET key
  alt Cache Hit
    Cache-->>App: value
  else Cache Miss
    App->>DB: SELECT row
    DB-->>App: row
    App->>Cache: SET key value (TTL)
  end
\`\`\`

- **Cache-Aside (Lazy Loading):** App reads cache first; on miss, reads DB and populates cache. Resilient to cache outages, but first request pays a miss penalty.
- **Write-Through:** App writes to cache and DB synchronously. Strong consistency, higher write latency.
- **Write-Back (Write-Behind):** App writes to cache immediately; async worker flushes to DB. Ultra-fast writes, risk of data loss if cache crashes before flush.`,

  'sd-caching:1': `# Preventing Cache Stampedes (Thundering Herd)

When a hot key expires, thousands of concurrent requests miss simultaneously and hammer the database.

1. **Single-Flight / Mutex Lock:** Only one request per key fetches from DB while others wait briefly or read stale data.
2. **TTL Jitter:** Randomize expiration (\`baseTTL + random(0, 15%)\`) so bulk-loaded keys don't expire at the exact same second.
3. **Probabilistic Early Refresh (XFetch):** Recompute popular keys asynchronously *before* their TTL hits zero.`,

  'sd-caching:2': `# Hot Keys & Multi-Region Cache Invalidation

- **Hot Key Mitigation:** Add a tiny local in-process LRU cache (e.g., 5-second TTL) in front of Redis, or replicate the hot key across \`N\` suffixed shards (\`key#0..N-1\`) and read randomly.
- **Cross-Region Invalidation:** Publish database CDC events (Debezium → Kafka) so each region's consumer invalidates or refreshes its local Redis cluster asynchronously.`,

  'sd-data-sharding:0': `# Synchronous vs. Asynchronous Replication & Lag

- **Synchronous:** Primary waits for at least one replica ACK before committing. Zero data loss on failover, but higher write latency and reduced availability if the replica stalls.
- **Asynchronous:** Primary commits immediately and streams WAL logs to replicas. Fast writes, but replicas can lag behind.
- **Handling Read-Your-Own-Writes:** Route a user's own reads to the primary (or track their last LSN/write timestamp) for a short window after a write.`,

  'sd-data-sharding:1': `# Consistent Hashing with Virtual Nodes

\`\`\`mermaid
flowchart LR
  K["Key hash(k)"] --> R["Hash Ring (0..2^32-1)"]
  R --> N1["Node A (vnodes 1..100)"]
  R --> N2["Node B (vnodes 1..100)"]
  R --> N3["Node C (vnodes 1..100)"]
\`\`\`

- Naive \`hash(key) % N\` remaps almost every key when a node is added or removed.
- **Consistent Hashing** places nodes and keys on a ring; adding/removing a node moves only \`~1/N\` of keys.
- **Virtual Nodes (vnodes):** Assign 100–200 points per physical server so data distribution stays balanced even with heterogeneous hardware.`,

  'sd-data-sharding:2': `# Choosing Shard Keys & Avoiding Hotspots

- Pick a high-cardinality shard key aligned with your most frequent query pattern (e.g., \`tenant_id\` or \`user_id\`, **never** monotonically increasing \`created_at\` which sends 100% of writes to the newest shard).
- **Cross-shard queries:** Avoid distributed joins; denormalize or maintain a separate secondary index / search cluster (Elasticsearch) for global queries.`,

  'sd-cap-consensus:0': `# CAP & PACELC in Real Systems

- During a **network partition (P)**, a distributed store must choose **Consistency (C)** (reject writes/reads that might be stale) or **Availability (A)** (serve potentially stale data).
- **PACELC** extends CAP: *Even when there is no partition (E), you still trade off Latency (L) vs. Consistency (C).*
- **Examples:** Banking ledgers & inventory locks → **CP/PC** (Spanner, CockroachDB, Postgres). Social feeds & shopping carts → **AP/EL** (DynamoDB, Cassandra).`,

  'sd-cap-consensus:1': `# Quorum Reads & Writes (N, R, W)

Given \`N\` replicas, write quorum \`W\`, and read quorum \`R\`:
- **Strong consistency overlap:** \`W + R > N\` guarantees at least one replica in the read quorum holds the latest acknowledged write.
- **Common configs for \`N = 3\`:**
  - Balanced: \`W = 2, R = 2\` (survives 1 node failure)
  - Fast reads: \`W = 3, R = 1\` (writes stall if 1 node is down)
  - Fast writes: \`W = 1, R = 3\``,

  'sd-cap-consensus:2': `# Raft Leader Election & Split-Brain Prevention

\`\`\`mermaid
stateDiagram-v2
  [*] --> Follower
  Follower --> Candidate : Election timeout
  Candidate --> Leader : Majority votes
  Candidate --> Follower : Higher term discovered
  Leader --> Follower : Higher term discovered
\`\`\`

- Every Raft term has at most **one** leader because a candidate needs votes from a strict majority (\`> N/2\`).
- Leaders send periodic heartbeats; if an old partitioned leader cannot reach a majority, it cannot commit new log entries, preventing split-brain.`,

  'sd-messaging-async:0': `# Kafka vs. RabbitMQ

| Feature | Apache Kafka | RabbitMQ |
| --- | --- | --- |
| **Model** | Pull-based append-only log | Push-based smart message broker |
| **Replayability** | Consumers reset offsets to replay history | Messages deleted once ACKed |
| **Throughput** | Millions of events/sec (partitioned) | Tens of thousands/sec, rich routing |
| **Best for** | Event streaming, CDC, analytics, audit logs | Task queues, complex routing, per-message TTL |`,

  'sd-messaging-async:1': `# Idempotency & Transactional Outbox Pattern

- Networks retry — design every mutating consumer to be **idempotent** using a client-generated \`idempotency_key\` stored with a \`UNIQUE\` constraint.
- **Transactional Outbox:** Write the business entity AND an outbox event row in the **same local DB transaction**. A background relay (or Debezium CDC) publishes outbox rows to Kafka, preventing dual-write inconsistency.`,

  'sd-messaging-async:2': `# Backpressure, Exponential Backoff & Dead-Letter Queues

- **Backpressure:** Bound in-flight concurrency and use pull-based consumers so slow downstream dependencies don't OOM upstream workers.
- **Retries:** Apply **exponential backoff with jitter** (\`min(cap, base * 2^attempt) * rand()\`) to avoid retry storms.
- **DLQ:** After \`K\` failed attempts, route poison messages to a Dead-Letter Queue with full error metadata for inspection and replay.`,

  'lld-solid:0': `# SOLID Principles in Practice

- **S — Single Responsibility:** A class should have one reason to change (separate \`OrderValidator\`, \`PriceCalculator\`, and \`OrderRepository\`).
- **O — Open/Closed:** Open for extension, closed for modification — add new discount types via a \`DiscountStrategy\` interface instead of growing an \`if/else\` chain.
- **L — Liskov Substitution:** Subtypes must honor parent contracts without throwing unexpected exceptions.
- **I — Interface Segregation:** Prefer small role-focused interfaces (\`Printable\`, \`Scannable\`) over fat god-interfaces.
- **D — Dependency Inversion:** Depend on abstractions (inject \`PaymentGateway\`), not concrete SDK classes.`,

  'db-sql-windows:0': `# SQL Window Functions Cheat Sheet

\`\`\`sql
-- Top 2 highest-paid employees per department
WITH ranked AS (
  SELECT
    department_id,
    name,
    salary,
    DENSE_RANK() OVER (
      PARTITION BY department_id
      ORDER BY salary DESC
    ) AS rnk
  FROM employees
)
SELECT department_id, name, salary
FROM ranked
WHERE rnk <= 2;
\`\`\`

- \`ROW_NUMBER()\`: unique sequential rank \`1, 2, 3, 4\`
- \`RANK()\`: ties share rank, skips next (\`1, 1, 3\`)
- \`DENSE_RANK()\`: ties share rank, no gaps (\`1, 1, 2\`)
- \`LAG()\` / \`LEAD()\`: access previous/next row in the partition without a self-join.`,

  'db-indexing-explain:0': `# Composite Indexes & Left-Most Prefix Rule

An index on \`(tenant_id, status, created_at)\` accelerates:
- \`WHERE tenant_id = 7\` ✅
- \`WHERE tenant_id = 7 AND status = 'OPEN'\` ✅
- \`WHERE tenant_id = 7 AND status = 'OPEN' AND created_at > '2026-01-01'\` ✅
- \`WHERE status = 'OPEN'\` ❌ (skips left-most column)

**Rule of thumb:** Place **equality (\`=\`)** columns first, then **range (\`>\`, \`<\`, \`BETWEEN\`)** or **sort (\`ORDER BY\`)** columns last.`,

  'os-sync-deadlocks:1': `# Coffman Deadlock Conditions & Prevention

Deadlock requires **all four** conditions simultaneously:
1. **Mutual Exclusion** (non-shareable resource)
2. **Hold and Wait** (holding one lock while requesting another)
3. **No Preemption** (locks cannot be forcibly taken)
4. **Circular Wait** (\`T1 → L2\`, \`T2 → L1\`)

**Practical fix:** Break **Circular Wait** by enforcing a strict global **lock acquisition order** (e.g., always lock accounts by ascending \`account_id\`) or using \`tryLock\` with timeout.`,

  'ai-rag-retrieval:0': `# Production RAG Architecture

\`\`\`mermaid
flowchart LR
  Q["User Query"] --> R1["BM25 Lexical Search"]
  Q --> R2["Vector ANN (HNSW)"]
  R1 --> F["Reciprocal Rank Fusion"]
  R2 --> F
  F --> RR["Cross-Encoder Reranker"]
  RR --> LLM["LLM + Grounded Citations"]
\`\`\`

- **Chunking:** Use semantic/structure-aware chunks (300–600 tokens with 10–15% overlap) and attach document ACL metadata.
- **Hybrid Search:** Combine BM25 (exact identifiers, error codes) + dense embeddings (semantic meaning) via RRF, then rerank the top 20 down to 5.`,

  'beh-star-stories:0': `# Mastering the STAR Behavioral Framework

- **S — Situation (15%):** Brief context (team size, scale, business stakes).
- **T — Task (10%):** Your exact ownership and goal.
- **A — Action (55%):** What **you** specifically designed, decided, or unblocked (use **"I"**, explain trade-offs considered).
- **R — Result (20%):** Quantified outcome (e.g., *"cut p99 latency from 480ms to 95ms, saving $18k/mo"*) + what you institutionalized afterward.`,
};

export function getChecklistStudyGuide(topic, index) {
  const key = `${topic.id}:${index}`;
  if (GUIDES[key]) return GUIDES[key];

  const itemText = topic.checklist?.[index] || topic.title;
  const prompts = (topic.interviewPrompts || []).map((p) => `- ${p}`).join('\n');
  const resources = (topic.resources || []).map((r) => `- [${r.title}](${r.url})`).join('\n');

  return `# ${itemText}

> **Topic:** ${topic.title}

## Overview
${topic.summary}

## How to Master This Concept
- **Define the problem & invariants:** Explain *why* this mechanism exists and what breaks without it at scale.
- **Analyze trade-offs:** Compare latency, throughput, consistency, operational complexity, and cost against the main alternative.
- **Walk through a concrete failure mode:** Describe how the system behaves under high load, partial failure, or bad input.

${prompts ? `## Practice Interview Prompts\n${prompts}\n` : ''}${resources ? `## Further Reading\n${resources}\n` : ''}`;
}
