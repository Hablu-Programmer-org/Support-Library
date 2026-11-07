/**
 * Deploys and verifies the Atlas Search indexes.
 *
 * `db:indexes` only manages Mongoose (B-tree) indexes; Atlas Search indexes are
 * a separate control-plane resource and need either the Atlas Admin API or a
 * database user with `dbAdmin`. The app user deliberately has neither, so this
 * script keeps the definitions in the repo and supports three modes:
 *
 *   npm run search:indexes:print              # print the JSON payloads
 *   npm run search:indexes:verify -- --wait   # read-only ($listSearchIndexes)
 *   npm run search:indexes:apply -- --yes     # create/update via the Atlas API
 *
 * Apply needs ATLAS_PUBLIC_KEY / ATLAS_PRIVATE_KEY / ATLAS_PROJECT_ID /
 * ATLAS_CLUSTER_NAME, and `--confirm=<MONGODB_DB>` so a wrong target is visible.
 */
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const COLLECTION = "support-issues";
const INDEX_DIR = path.resolve(__dirname, "../search/indexes");
const INDEX_FILES = ["issues_public.json", "issues_staff.json"] as const;
const ATLAS_API = "https://cloud.mongodb.com/api/atlas/v1.0";

export function parseSearchIndexFlags(argv: string[] = process.argv) {
  return {
    flags: new Set(argv.slice(2).filter((arg) => arg.startsWith("--"))),
    confirmation: argv
      .find((arg) => arg.startsWith("--confirm="))
      ?.slice("--confirm=".length),
    timeoutSeconds: Number(
      argv.find((arg) => arg.startsWith("--timeout="))?.slice("--timeout=".length) ?? 180,
    ),
  };
}

const { flags, confirmation, timeoutSeconds } = parseSearchIndexFlags();

type IndexDefinition = {
  name: string;
  type: "search";
  definition: Record<string, unknown>;
};

const requiredEnv = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for this mode`);
  return value;
};

const databaseName = () => requiredEnv("MONGODB_DB");

async function loadDefinitions(): Promise<IndexDefinition[]> {
  return Promise.all(
    INDEX_FILES.map(async (file) => {
      const raw = await readFile(path.join(INDEX_DIR, file), "utf8");
      return JSON.parse(raw) as IndexDefinition;
    }),
  );
}

function printDefinitions(definitions: IndexDefinition[]) {
  const database = databaseName();
  for (const definition of definitions) {
    console.info(JSON.stringify({ database, collectionName: COLLECTION, ...definition }, null, 2));
  }
}

/* -------------------------------------------------------------------------- */
/* Atlas Admin API (HTTP Digest auth)                                          */
/* -------------------------------------------------------------------------- */

const md5 = (value: string) => createHash("md5").update(value).digest("hex");

function parseChallenge(header: string) {
  const body = header.replace(/^Digest\s+/i, "");
  const params: Record<string, string> = {};
  for (const match of body.matchAll(/([a-zA-Z0-9_]+)=(?:"([^"]*)"|([^,]*))/g)) {
    params[match[1]!] = match[2] ?? match[3] ?? "";
  }
  return params;
}

function digestAuthorization(
  method: string,
  uri: string,
  challenge: Record<string, string>,
) {
  const user = requiredEnv("ATLAS_PUBLIC_KEY");
  const password = requiredEnv("ATLAS_PRIVATE_KEY");
  const realm = challenge.realm ?? "";
  const nonce = challenge.nonce ?? "";
  const qop = challenge.qop ?? "auth";
  const opaque = challenge.opaque;
  const nc = "00000001";
  const cnonce = randomBytes(8).toString("hex");

  const ha1 = md5(`${user}:${realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);
  const response = md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);

  const parts = [
    `username="${user}"`,
    `realm="${realm}"`,
    `nonce="${nonce}"`,
    `uri="${uri}"`,
    `qop=${qop}`,
    `nc=${nc}`,
    `cnonce="${cnonce}"`,
    `response="${response}"`,
  ];
  if (opaque) parts.push(`opaque="${opaque}"`);
  return `Digest ${parts.join(", ")}`;
}

async function atlasRequest(method: string, pathname: string, body?: unknown) {
  const url = `${ATLAS_API}${pathname}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const payload = body === undefined ? undefined : JSON.stringify(body);

  const unauthenticated = await fetch(url, { method, headers, body: payload });
  if (unauthenticated.status !== 401) return unauthenticated;

  const challenge = parseChallenge(unauthenticated.headers.get("www-authenticate") ?? "");
  const authorization = digestAuthorization(method, pathname, challenge);
  return fetch(url, {
    method,
    headers: { ...headers, Authorization: authorization },
    body: payload,
  });
}

async function atlasErrorMessage(response: Response) {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { detail?: string; error?: string };
    return parsed.detail ?? parsed.error ?? text;
  } catch {
    return text.slice(0, 400);
  }
}

function clusterPath() {
  const groupId = requiredEnv("ATLAS_PROJECT_ID");
  const cluster = requiredEnv("ATLAS_CLUSTER_NAME");
  return `/groups/${groupId}/clusters/${cluster}`;
}

async function applyDefinitions(definitions: IndexDefinition[]) {
  const database = databaseName();
  if (confirmation !== database) {
    throw new Error(`Refusing apply: pass --confirm=${database} to confirm the target database`);
  }

  const listResponse = await atlasRequest(
    "GET",
    `${clusterPath()}/fts/indexes/${database}/${COLLECTION}`,
  );
  if (!listResponse.ok) {
    throw new Error(`Atlas list failed: ${await atlasErrorMessage(listResponse)}`);
  }
  const existing = (await listResponse.json()) as { indexID: string; name: string }[];
  const byName = new Map(existing.map((index) => [index.name, index.indexID]));

  for (const definition of definitions) {
    const indexId = byName.get(definition.name);
    if (indexId) {
      const response = await atlasRequest(
        "PATCH",
        `${clusterPath()}/fts/indexes/${indexId}`,
        { name: definition.name, definition: definition.definition },
      );
      if (!response.ok) {
        throw new Error(`Atlas update failed for ${definition.name}: ${await atlasErrorMessage(response)}`);
      }
      console.info(`[search-indexes] updated ${definition.name}`);
    } else {
      const response = await atlasRequest("POST", `${clusterPath()}/fts/indexes`, {
        database,
        collectionName: COLLECTION,
        ...definition,
      });
      if (!response.ok) {
        throw new Error(`Atlas create failed for ${definition.name}: ${await atlasErrorMessage(response)}`);
      }
      console.info(`[search-indexes] created ${definition.name}`);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Verification (works with the app's readWrite user)                          */
/* -------------------------------------------------------------------------- */

type ListedIndex = {
  name: string;
  status?: string;
  queryable?: boolean;
  latestDefinition?: unknown;
};

async function listIndexes(): Promise<ListedIndex[]> {
  const uri = requiredEnv("MONGODB_URI");
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
  try {
    await client.connect();
    const collection = client.db(databaseName()).collection(COLLECTION);
    const rows = await collection
      .aggregate([{ $listSearchIndexes: {} }])
      .toArray();
    return rows as unknown as ListedIndex[];
  } finally {
    await client.close();
  }
}

async function verify() {
  const wait = flags.has("--wait");
  const deadline = Date.now() + Math.max(0, timeoutSeconds) * 1000;
  for (;;) {
    const rows = await listIndexes();
    const missing = INDEX_FILES.map((file) => file.replace(/\.json$/, "")).filter(
      (name) => !rows.some((row) => row.name === name),
    );
    const notQueryable = rows.filter((row) => row.queryable !== true);
    const summary = rows.map((row) => ({
      name: row.name,
      status: row.status,
      queryable: row.queryable === true,
    }));
    console.info(`[search-indexes] ${databaseName()}.${COLLECTION}`, summary);
    if (missing.length) console.warn(`[search-indexes] missing: ${missing.join(", ")}`);
    if (!missing.length && notQueryable.length === 0) {
      console.info("[search-indexes] all indexes queryable");
      return true;
    }
    if (!wait || Date.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
}

async function main() {
  const definitions = await loadDefinitions();

  if (flags.has("--verify") || flags.has("--wait")) {
    const ok = await verify();
    if (!ok) process.exitCode = 1;
    return;
  }
  if (flags.has("--apply")) {
    if (!flags.has("--yes")) throw new Error("Pass --yes with --apply to confirm the write");
    await applyDefinitions(definitions);
    const ok = await verify();
    if (!ok) process.exitCode = 1;
    return;
  }

  printDefinitions(definitions);
}

/**
 * Runs only when executed as the script itself (`tsx scripts/...`), never when
 * imported by a test — so the flag parser above stays unit-testable.
 */
const isDirectRun =
  process.argv[1]?.replace(/\\/g, "/").endsWith("search-indexes.ts") ?? false;

if (isDirectRun) {
  main()
    .then(() => {
      process.exit(process.exitCode ?? 0);
    })
    .catch((error) => {
      console.error("[search-indexes] failed", error);
      process.exit(1);
    });
}
