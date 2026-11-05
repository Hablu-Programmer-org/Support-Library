import path from "node:path";
import { writeFile } from "node:fs/promises";

import dotenv from "dotenv";

import { validateEnv } from "../lib/env";
import { checkSupportReadiness } from "../lib/db";
import { closeAccessEmailTransport } from "../lib/services/n8n-email";
import {
  claimDueAccessEmailJob,
  processAccessEmailJob,
  reapExhaustedAccessEmailJob,
  recoverClaimedAccessEmailJob,
} from "../lib/services/access-email-outbox";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
validateEnv();

const IDLE_DELAY_MS = 2_000;
const ERROR_DELAY_MS = 5_000;
const HEARTBEAT_PATH = "/tmp/access-email-worker.heartbeat";
let stopping = false;
const mode = process.argv.includes("--check-config")
  ? "check-config"
  : process.argv.includes("--check")
  ? "check"
  : process.argv.includes("--once")
    ? "once"
    : "run";

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function log(event: Record<string, unknown>) {
  console.info(JSON.stringify({ service: "access-email-worker", ...event }));
}

async function heartbeat() {
  await writeFile(HEARTBEAT_PATH, new Date().toISOString(), { encoding: "utf8", mode: 0o600 });
}

async function processOne() {
  if (await reapExhaustedAccessEmailJob()) return true;
  const job = await claimDueAccessEmailJob();
  if (!job) return false;
  const startedAt = Date.now();
  try {
    const outcome = await processAccessEmailJob(job);
    log({
      event: "delivery_finished",
      jobId: job._id.toString(),
      notificationType: job.notificationType,
      generation: job.generation,
      attempt: job.attempts,
      outcome,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    let outcome = "LEASE_RECOVERY";
    try {
      outcome = await recoverClaimedAccessEmailJob(job);
    } catch {
      // The lease remains bounded; another worker can recover it after DB service returns.
    }
    log({
      event: "delivery_error",
      jobId: job._id.toString(),
      notificationType: job.notificationType,
      generation: job.generation,
      attempt: job.attempts,
      outcome,
      errorCode: error instanceof Error ? error.name : "UNKNOWN",
      durationMs: Date.now() - startedAt,
    });
    await wait(ERROR_DELAY_MS);
  }
  return true;
}

async function main() {
  if (mode === "check-config") {
    log({ event: "config_ok" });
    return;
  }
  await checkSupportReadiness();
  if (mode === "check") {
    log({ event: "check_ok" });
    return;
  }
  await heartbeat();
  log({ event: "started" });
  if (mode === "once") {
    await processOne();
    await heartbeat();
    return;
  }
  while (!stopping) {
    try {
      const processed = await processOne();
      await heartbeat();
      if (!processed) await wait(IDLE_DELAY_MS);
    } catch (error) {
      log({
        event: "loop_error",
        errorCode: error instanceof Error ? error.name : "UNKNOWN",
      });
      await wait(ERROR_DELAY_MS);
    }
  }
}

function stop(signal: string) {
  if (stopping) return;
  stopping = true;
  closeAccessEmailTransport();
  log({ event: "stopping", signal });
}

process.on("SIGTERM", () => stop("SIGTERM"));
process.on("SIGINT", () => stop("SIGINT"));

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(JSON.stringify({
      service: "access-email-worker",
      event: "fatal",
      errorCode: error instanceof Error ? error.name : "UNKNOWN",
    }));
    process.exit(1);
  });
