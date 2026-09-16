import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { DATABASE_URL } from "./config";
import { uuid } from "./ids";
import type {
  AssetVersion,
  AuditEvent,
  AuthNonce,
  Commitment,
  CommitmentQuote,
  GenerationJob,
  ModerationDecision,
  PublicationRequest,
  Report,
  RightsAttestation,
  SourceFile,
  Submission,
  User,
  WalletLink,
  WorldAsset,
} from "./types";

export type Database = {
  users: User[];
  walletLinks: WalletLink[];
  submissions: Submission[];
  sourceFiles: SourceFile[];
  rightsAttestations: RightsAttestation[];
  generationJobs: GenerationJob[];
  assetVersions: AssetVersion[];
  publicationRequests: PublicationRequest[];
  moderationDecisions: ModerationDecision[];
  commitmentQuotes: CommitmentQuote[];
  commitments: Commitment[];
  worldAssets: WorldAsset[];
  reports: Report[];
  auditEvents: AuditEvent[];
  nonces: AuthNonce[];
  publicIdSeq: number;
  manifestVersion: number;
};

const EMPTY: Database = {
  users: [],
  walletLinks: [],
  submissions: [],
  sourceFiles: [],
  rightsAttestations: [],
  generationJobs: [],
  assetVersions: [],
  publicationRequests: [],
  moderationDecisions: [],
  commitmentQuotes: [],
  commitments: [],
  worldAssets: [],
  reports: [],
  auditEvents: [],
  nonces: [],
  publicIdSeq: 1000,
  manifestVersion: 0,
};

const FILE = join(process.cwd(), "data", "store.json");
let mutex: Promise<unknown> = Promise.resolve();

function lock<T>(fn: () => Promise<T>): Promise<T> {
  const run = mutex.then(fn, fn);
  mutex = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function loadFile(): Promise<Database> {
  try {
    const raw = await readFile(FILE, "utf8");
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    return structuredClone(EMPTY);
  }
}

async function saveFile(db: Database): Promise<void> {
  await mkdir(dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(db, null, 2));
  await rename(tmp, FILE);
}

export async function withStore<T>(fn: (db: Database) => Promise<T> | T): Promise<T> {
  if (DATABASE_URL.startsWith("postgres")) {
    return withPostgres(fn);
  }
  return lock(async () => {
    const db = await loadFile();
    const result = await fn(db);
    await saveFile(db);
    return result;
  });
}

export async function readStore<T>(fn: (db: Database) => Promise<T> | T): Promise<T> {
  if (DATABASE_URL.startsWith("postgres")) {
    return withPostgres(fn);
  }
  const db = await loadFile();
  return fn(db);
}

async function withPostgres<T>(fn: (db: Database) => Promise<T> | T): Promise<T> {
  const postgres = (await import("postgres")).default;
  const sql = postgres(DATABASE_URL, { max: 1 });
  try {
    await sql`CREATE TABLE IF NOT EXISTS world_creator_state (id int PRIMARY KEY, data jsonb NOT NULL)`;
    const rows = await sql<{ data: Database }[]>`SELECT data FROM world_creator_state WHERE id = 1`;
    const db: Database = rows[0]?.data ? { ...EMPTY, ...rows[0].data } : structuredClone(EMPTY);
    const result = await fn(db);
    await sql`
      INSERT INTO world_creator_state (id, data) VALUES (1, ${sql.json(db as never)})
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data
    `;
    return result;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export function appendAudit(
  db: Database,
  event: Omit<AuditEvent, "id" | "timestamp"> & { timestamp?: string }
): void {
  db.auditEvents.push({
    id: uuid(),
    timestamp: event.timestamp || new Date().toISOString(),
    actor: event.actor,
    entityType: event.entityType,
    entityId: event.entityId,
    eventType: event.eventType,
    metadata: event.metadata,
  });
}

export function nextPublicId(db: Database): string {
  db.publicIdSeq += 1;
  return `DFW-${String(db.publicIdSeq).padStart(4, "0")}`;
}

export function upsertUser(
  db: Database,
  discordUserId: string,
  discordUsername: string
): User {
  const existing = db.users.find((u) => u.discordUserId === discordUserId);
  if (existing) {
    existing.discordUsername = discordUsername;
    return existing;
  }
  const user: User = {
    id: uuid(),
    discordUserId,
    discordUsername,
    createdAt: new Date().toISOString(),
    status: "active",
  };
  db.users.push(user);
  return user;
}
