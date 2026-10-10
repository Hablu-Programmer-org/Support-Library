/**
 * Search benchmark: measures how the issue search scales as the collection
 * grows, and compares the strategies we could actually ship on plain MongoDB.
 *
 * Production today uses a plain B-tree index on `searchText` plus a
 * case-insensitive *substring* regex. That combination can never use the index
 * for the lookup itself, which is what this script quantifies.
 *
 * Usage:
 *   npm run bench:search            # 5000 docs, 5 iterations per strategy
 *   npm run bench:search -- --docs 20000 --iterations 9
 *
 * Safety: refuses to run against the development database and uses its own
 * throwaway collection, so no real data is read or written.
 */
import { MongoClient, type Collection } from "mongodb";

import { resolveE2EDatabase } from "../e2e/fixtures/test-db";

const COLLECTION = "bench_supportcases";

type BenchDoc = {
  _id: string;
  title: string;
  question: string;
  status: string;
  courseSlug: string;
  batchNo: number;
  tags: string[];
  searchText: string;
  searchTokens: string[];
  deletedAt: null;
  createdAt: Date;
};

type Args = { docs: number; iterations: number; keep: boolean };

const parseArgs = (argv: string[]): Args => {
  const args: Args = { docs: 5000, iterations: 5, keep: false };
  for (let i = 0; i < argv.length; i += 1) {
    const [key, inlineValue] = argv[i].split("=");
    const value = inlineValue ?? argv[i + 1];
    const consume = () => {
      if (inlineValue === undefined) i += 1;
    };

    switch (key) {
      case "--docs":
        args.docs = Number(value);
        consume();
        break;
      case "--iterations":
        args.iterations = Number(value);
        consume();
        break;
      case "--keep":
        args.keep = true;
        break;
      default:
        break;
    }
  }

  if (!Number.isFinite(args.docs) || args.docs < 1) throw new Error("--docs must be >= 1");
  if (!Number.isFinite(args.iterations) || args.iterations < 1) {
    throw new Error("--iterations must be >= 1");
  }
  return args;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Vocabulary that mimics real support traffic, including multi-word tags. */
const TOPICS = [
  "useEffect dependency array loop",
  "nextjs app router hydration mismatch",
  "mongoose populate ref not loading",
  "tailwind dark mode class strategy",
  "react key warning list render",
  "typescript discriminated union narrowing",
  "nextauth jwt session callback",
  "mongodb aggregate group count",
  "zod schema validation error",
  "hero ui modal keyboard focus",
  "axios interceptor retry backoff",
  "state management context rerender",
  "css grid responsive breakpoint",
  "node stream backpressure error",
  "git rebase conflict resolution",
  "regex lookahead validation pattern",
];
const COURSES = ["react-basics", "nextjs-advanced", "node-backend", "typescript-core", "database-design"];
const STATUSES = ["OPEN", "PENDING", "FOLLOW_UP", "SOLVED", "ARCHIVED"];

const tokenize = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);

const buildDoc = (i: number): BenchDoc => {
  const topic = TOPICS[i % TOPICS.length]!;
  const courseSlug = COURSES[i % COURSES.length]!;
  const tags = topic.split(" ").slice(0, 2);
  const searchText = [
    `case ${i}`,
    topic,
    courseSlug,
    `batch ${(i % 12) + 1}`,
    tags.join(" "),
  ].join(" ");

  return {
    _id: `case-${i}`,
    title: `Case ${i}: ${topic}`,
    question: `How do I fix ${topic}?`,
    status: STATUSES[i % STATUSES.length]!,
    courseSlug,
    batchNo: (i % 12) + 1,
    tags,
    searchText,
    searchTokens: tokenize(searchText),
    deletedAt: null,
    createdAt: new Date(2026, 0, 1 + (i % 300)),
  };
};

type Strategy = {
  name: string;
  semantics: string;
  filterFor: (term: string) => Record<string, unknown>;
};

const STRATEGIES: Strategy[] = [
  {
    name: "bson_substring_regex (current)",
    semantics: "case-insensitive substring match anywhere",
    filterFor: (term) => ({ searchText: { $regex: escapeRegex(term), $options: "i" } }),
  },
  {
    name: "bson_anchored_prefix_regex",
    semantics: "case-insensitive prefix match",
    filterFor: (term) => ({ searchText: { $regex: `^${escapeRegex(term)}`, $options: "i" } }),
  },
  {
    name: "bson_token_exact",
    semantics: "exact whole-token match (loses infix matches)",
    filterFor: (term) => ({ searchTokens: tokenize(term)[0] }),
  },
  {
    name: "mongo_text_index",
    semantics: "full-text token match, relevance ranked",
    filterFor: (term) => ({ $text: { $search: term } }),
  },
];

const TERMS = ["useeffect", "hydration", "populate", "mongoose"];

/** Extra doc counts appended after the base seed, to expose the growth curve. */
const SCALING_SIZES = [5_000, 15_000, 30_000];

const ms = (start: bigint) => Number(process.hrtime.bigint() - start) / 1e6;

type Row = {
  strategy: string;
  nReturned: number;
  docsExamined: number;
  keysExamined: number;
  serverMs: number;
  wallMs: number;
  indexUsed: string;
};

type ScalingRow = {
  docs: number;
  docsExamined: number;
  keysExamined: number;
  serverMs: number;
  wallMs: number;
};

const explainOnce = async (collection: Collection<BenchDoc>, filter: Record<string, unknown>) => {
  const explained = await collection.find(filter).explain("executionStats");
  const stats = explained.executionStats as {
    nReturned: number;
    totalDocsExamined: number;
    totalKeysExamined: number;
    executionTimeMillis: number;
  };
  const stage = explained.queryPlanner?.winningPlan as
    | { inputStage?: { indexName?: string }; stage?: string }
    | undefined;
  const indexUsed = stage?.inputStage?.indexName ?? stage?.stage ?? "COLLSCAN";
  return { ...stats, indexUsed };
};

/**
 * `executionTimeMillis` from a single explain is noisy on a shared cluster, so
 * take the best of a few runs. Docs/keys examined are deterministic.
 */
const explainStable = async (
  collection: Collection<BenchDoc>,
  filter: Record<string, unknown>,
  repeats = 3,
) => {
  let best = await explainOnce(collection, filter);
  for (let i = 1; i < repeats; i += 1) {
    const next = await explainOnce(collection, filter);
    if (next.executionTimeMillis < best.executionTimeMillis) best = next;
  }
  return best;
};

const timeQuery = async (
  collection: Collection<BenchDoc>,
  filter: Record<string, unknown>,
  iterations: number,
) => {
  let total = 0;
  for (let i = 0; i < iterations; i += 1) {
    const start = process.hrtime.bigint();
    await collection.find(filter).limit(20).toArray();
    total += ms(start);
  }
  return Number((total / iterations).toFixed(1));
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const { devDb, testDb } = resolveE2EDatabase();

  if (devDb && testDb === devDb) {
    throw new Error("Refusing to benchmark against the development database.");
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is missing. Configure .env.local first.");

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
  await client.connect();
  const db = client.db(testDb);
  const collection = db.collection<BenchDoc>(COLLECTION);

  console.log(`benchmark db : ${testDb}  (dev db ${devDb ?? "unset"})`);
  console.log(`collection   : ${COLLECTION}`);
  console.log(`documents    : ${args.docs}`);
  console.log(`iterations   : ${args.iterations} per strategy per term`);
  console.log(`terms        : ${TERMS.join(", ")}\n`);

  const rows: Row[] = [];
  const scalingRows: ScalingRow[] = [];
  let networkBaseline = 0;

  try {
    await collection.deleteMany({});
    await collection.insertMany(Array.from({ length: args.docs }, (_, i) => buildDoc(i)));
    await collection.createIndex({ searchText: 1 }, { name: "searchText_btree" });
    await collection.createIndex({ searchTokens: 1 }, { name: "searchTokens_btree" });
    await collection.createIndex({ searchText: "text" }, { name: "searchText_text" });

    for (const strategy of STRATEGIES) {
      for (const term of TERMS) {
        const filter = strategy.filterFor(term);
        // Warm up so we measure steady state, not first-call planning cost.
        await collection.find(filter).limit(20).toArray();

        const explained = await explainStable(collection, filter);
        const wallMs = await timeQuery(collection, filter, args.iterations);

        rows.push({
          strategy: strategy.name,
          nReturned: explained.nReturned,
          docsExamined: explained.totalDocsExamined,
          keysExamined: explained.totalKeysExamined,
          serverMs: explained.executionTimeMillis,
          wallMs,
          indexUsed: explained.indexUsed,
        });

        console.log(
          `${strategy.name.padEnd(32)} "${term}" -> n=${String(explained.nReturned).padStart(4)} ` +
            `examined=${String(explained.totalDocsExamined).padStart(5)} ` +
            `keys=${String(explained.totalKeysExamined).padStart(5)} ` +
            `server=${String(explained.executionTimeMillis).padStart(4)}ms ` +
            `wall=${wallMs.toFixed(1)}ms via ${explained.indexUsed}`,
        );
      }
    }

    // Wall-clock is dominated by the round trip to a remote cluster, so measure
    // that fixed cost separately. Without it the wall numbers are unreadable.
    let baselineTotal = 0;
    for (let i = 0; i < args.iterations; i += 1) {
      const start = process.hrtime.bigint();
      await collection.findOne({ _id: "case-1" });
      baselineTotal += ms(start);
    }
    networkBaseline = baselineTotal / args.iterations;

    // The decisive evidence: how the shipped strategy behaves as cases pile up.
    const scaleFilter = STRATEGIES[0]!.filterFor(TERMS[0]!);
    let seeded = args.docs;
    for (const size of SCALING_SIZES) {
      // Each round adds fresh ids, otherwise the _id index rejects the insert.
      await collection.insertMany(Array.from({ length: size }, (_, i) => buildDoc(seeded + i)));
      seeded += size;

      const explained = await explainStable(collection, scaleFilter);
      const wallMs = await timeQuery(collection, scaleFilter, args.iterations);
      scalingRows.push({
        docs: seeded,
        keysExamined: explained.totalKeysExamined,
        docsExamined: explained.totalDocsExamined,
        serverMs: explained.executionTimeMillis,
        wallMs,
      });
      console.log(`scaling: ${seeded} docs -> keys=${explained.totalKeysExamined} server=${explained.executionTimeMillis}ms`);
    }

    const byStrategy = new Map<string, Row[]>();
    for (const row of rows) {
      const list = byStrategy.get(row.strategy) ?? [];
      list.push(row);
      byStrategy.set(row.strategy, list);
    }

    console.log("\n## Average per query\n");
    console.log("| strategy | semantics | docs examined | keys examined | server ms | wall ms | index |");
    console.log("| --- | --- | --- | --- | --- | --- | --- |");
    for (const strategy of STRATEGIES) {
      const list = byStrategy.get(strategy.name)!;
      const avg = (pick: (row: Row) => number) =>
        Number((list.reduce((sum, row) => sum + pick(row), 0) / list.length).toFixed(1));
      const indexNames = new Set(list.map((row) => row.indexUsed));
      console.log(
        `| ${strategy.name} | ${strategy.semantics} | ${avg((r) => r.docsExamined)} | ` +
          `${avg((r) => r.keysExamined)} | ${avg((r) => r.serverMs)} | ${avg((r) => r.wallMs)} | ` +
          `${[...indexNames].join(", ")} |`,
      );
    }

    console.log(`\nNetwork baseline: ${networkBaseline.toFixed(1)}ms for a single _id lookup.`);
    console.log(
      "Wall-clock above is dominated by that round trip, so judge the strategies\n" +
        "by the server-side columns and by the scaling curve.",
    );

    console.log("\n## Scaling of the current substring-regex strategy\n");
    console.log("| total docs | keys examined | docs examined | server ms | wall ms |");
    console.log("| --- | --- | --- | --- | --- | --- |");
    for (const row of scalingRows) {
      console.log(
        `| ${row.docs} | ${row.keysExamined} | ${row.docsExamined} | ${row.serverMs} | ${row.wallMs} |`,
      );
    }

    if (!args.keep) {
      await collection.deleteMany({});
      console.log(`\nCleaned ${COLLECTION} (pass --keep to retain the seeded docs).`);
    } else {
      console.log(`\nLeft ${COLLECTION} in place for inspection.`);
    }
  } finally {
    // Always release the connection, otherwise a failure hangs the process.
    await client.close();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});