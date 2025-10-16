import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { decryptJson } from "@/lib/encryption";
import type { ConnectionConfig } from "@/convex/validators/connection";

let convexClient: ConvexHttpClient | null = null;

function normalizeConvexUrl(raw: string): string {
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }
  if (raw.startsWith("dev:") || raw.startsWith("prod:")) {
    const slug = raw.split(":")[1];
    return `https://${slug}.convex.cloud`;
  }
  if (raw.startsWith("localhost") || /^[\d.]+(?::\d+)?$/.test(raw)) {
    return raw.startsWith("http") ? raw : `http://${raw}`;
  }
  return raw;
}

function getConvexUrl(): string {
  const candidates = [process.env.NEXT_PUBLIC_CONVEX_URL, process.env.CONVEX_DEPLOYMENT];
  for (const candidate of candidates) {
    if (candidate) {
      return normalizeConvexUrl(candidate);
    }
  }
  throw new Error("Missing CONVEX_DEPLOYMENT or NEXT_PUBLIC_CONVEX_URL env var");
}

function getConvexAdminToken(): string {
  const token = process.env.CONVEX_ADMIN_TOKEN;
  if (!token) {
    throw new Error("CONVEX_ADMIN_TOKEN env var is required");
  }
  return token;
}

export function getConvexClient(): ConvexHttpClient {
  if (!convexClient) {
    convexClient = new ConvexHttpClient(getConvexUrl());
  }
  return convexClient;
}

export async function createOrgConnection(args: {
  orgId: string;
  name: string;
  encryptedConfig: { algorithm: string; iv: string; ciphertext: string; tag: string };
  createdBy: string;
  selectedTables?: string[];
  excludedTables?: string[];
  selectionMode?: "all" | "include" | "exclude";
}): Promise<string> {
  const client = getConvexClient();
  const adminToken = getConvexAdminToken();
  const result = await client.mutation(api.orgConnections.create, {
    adminToken,
    orgId: args.orgId,
    name: args.name,
    driver: "mssql",
    encryptedConfig: args.encryptedConfig as any,
    createdBy: args.createdBy,
    selectedTables: args.selectedTables,
    excludedTables: args.excludedTables,
    selectionMode: args.selectionMode,
  });
  return (result as any).id ?? (result as unknown as string);
}

export async function getOrgConnection(args: {
  orgId: string;
  connectionId: string;
  includeConfig?: boolean;
}) {
  const client = getConvexClient();
  const adminToken = getConvexAdminToken();
  const doc = await client.query(api.orgConnections.get, {
    adminToken,
    orgId: args.orgId,
    connectionId: args.connectionId as never,
    includeEncrypted: args.includeConfig ?? false,
  });
  if (!doc) return null as any;
  if (!args.includeConfig) return doc as any;
  const encrypted = (doc as any).encryptedConfig;
  const config = decryptJson<ConnectionConfig>(encrypted);
  const { encryptedConfig: _drop, ...rest } = doc as any;
  return { ...rest, config };
}

export async function listOrgConnections(orgId: string) {
  const client = getConvexClient();
  const adminToken = getConvexAdminToken();
  return client.query(api.orgConnections.list, { adminToken, orgId });
}

export async function markConnectionSyncRequested(args: {
  orgId: string;
  connectionId: string;
  requestedAt: number;
}) {
  const client = getConvexClient();
  const adminToken = getConvexAdminToken();
  await client.mutation(api.orgConnections.markSyncRequested, {
    adminToken,
    orgId: args.orgId,
    connectionId: args.connectionId as never,
    requestedAt: args.requestedAt,
  });
}

export async function getActiveConnectionDraft(args: {
  orgId: string;
  userId: string;
}) {
  const client = getConvexClient();
  const adminToken = getConvexAdminToken();
  return client.query(api.connectionDrafts.getActiveForUser, {
    adminToken,
    orgId: args.orgId,
    userId: args.userId,
  });
}

export async function getConnectionDraft(args: {
  orgId: string;
  draftId: string;
}) {
  const client = getConvexClient();
  const adminToken = getConvexAdminToken();
  return client.query(api.connectionDrafts.get, {
    adminToken,
    orgId: args.orgId,
    draftId: args.draftId as never,
  });
}

export async function saveConnectionDraft(args: {
  orgId: string;
  userId: string;
  draftId?: string;
  name?: string;
  step?: number;
  encryptedConfig?: { algorithm: string; iv: string; ciphertext: string; tag: string };
  selectedTables?: string[];
  selectionMode?: "all" | "include" | "exclude";
}): Promise<string> {
  const client = getConvexClient();
  const adminToken = getConvexAdminToken();
  const result = await client.mutation(api.connectionDrafts.save, {
    adminToken,
    orgId: args.orgId,
    userId: args.userId,
    draftId: args.draftId as never,
    name: args.name,
    step: args.step,
    encryptedConfig: args.encryptedConfig as any,
    selectedTables: args.selectedTables,
    selectionMode: args.selectionMode,
  });
  return (result as string) ?? (result as any);
}

export async function removeConnectionDraft(args: {
  orgId: string;
  userId: string;
  draftId: string;
}) {
  const client = getConvexClient();
  const adminToken = getConvexAdminToken();
  await client.mutation(api.connectionDrafts.remove, {
    adminToken,
    orgId: args.orgId,
    userId: args.userId,
    draftId: args.draftId as never,
  });
}

export async function listSemanticSyncRuns(args: {
  orgId: string;
  connectionId: string;
  limit?: number;
}) {
  const client = getConvexClient();
  const adminToken = getConvexAdminToken();
  return client.query(api.semanticSyncRuns.listRecent, {
    adminToken,
    orgId: args.orgId,
    connectionId: args.connectionId as never,
    limit: args.limit,
  });
}

export async function recordConnectionVerification(args: {
  orgId: string;
  connectionId: string;
  lastVerifiedAt?: number;
  lastError?: string;
}) {
  const client = getConvexClient();
  const adminToken = getConvexAdminToken();
  await client.mutation(api.orgConnections.updateVerification, {
    adminToken,
    orgId: args.orgId,
    connectionId: args.connectionId as never,
    lastVerifiedAt: args.lastVerifiedAt,
    lastError: args.lastError,
  });
}

export async function upsertSemanticArtifact(args: {
  orgId: string;
  connectionId: string;
  artifactType: string;
  artifactKey: string;
  version: number;
  payload: unknown;
  embeddingId?: string | null;
}) {
  const client = getConvexClient();
  const adminToken = getConvexAdminToken();
  await client.mutation(api.semanticArtifacts.upsert, {
    adminToken,
    orgId: args.orgId,
    connectionId: args.connectionId as never,
    artifactType: args.artifactType,
    artifactKey: args.artifactKey,
    version: args.version,
    payloadJson: JSON.stringify(args.payload),
    embeddingId: args.embeddingId ?? undefined,
  });
}

export async function createSyncRun(args: { orgId: string; connectionId: string }) {
  const client = getConvexClient();
  const adminToken = getConvexAdminToken();
  const result = await client.mutation(api.semanticSyncRuns.create, {
    adminToken,
    orgId: args.orgId,
    connectionId: args.connectionId as never,
  });
  return (result as unknown as string) ?? (result as any)?.id;
}

export async function markSyncRunCompleted(runId: string) {
  const client = getConvexClient();
  const adminToken = getConvexAdminToken();
  await client.mutation(api.semanticSyncRuns.complete, {
    adminToken,
    runId: runId as never,
  });
}

export async function markSyncRunFailed(runId: string, error: string) {
  const client = getConvexClient();
  const adminToken = getConvexAdminToken();
  await client.mutation(api.semanticSyncRuns.fail, {
    adminToken,
    runId: runId as never,
    error,
  });
}

export async function upsertSyncStage(args: {
  runId: string;
  stage: string;
  status: "pending" | "running" | "completed" | "failed";
  error?: string;
  metrics?: Record<string, unknown>;
}) {
  const client = getConvexClient();
  const adminToken = getConvexAdminToken();
  await client.mutation(api.semanticSyncStages.upsert, {
    adminToken,
    runId: args.runId as never,
    stage: args.stage,
    status: args.status,
    error: args.error,
    metrics: args.metrics ? JSON.stringify(args.metrics) : undefined,
  });
}

export async function listSyncStages(runId: string) {
  const client = getConvexClient();
  const adminToken = getConvexAdminToken();
  return client.query(api.semanticSyncStages.listByRun, {
    adminToken,
    runId: runId as never,
  });
}

export async function listSemanticArtifacts(args: {
  orgId: string;
  connectionId: string;
  artifactType?: string;
}) {
  const client = getConvexClient();
  const adminToken = getConvexAdminToken();
  return client.query(api.semanticArtifacts.listByConnection, {
    adminToken,
    orgId: args.orgId,
    connectionId: args.connectionId as never,
    artifactType: args.artifactType,
  });
}

// Semantic Catalog v2 helpers
export async function listSemanticCatalog(args: { orgId: string; connectionId: string }) {
  const client = getConvexClient();
  const adminToken = getConvexAdminToken();
  // Using any-cast because generated types are generic any in this repo
  return client.query((api as any).semanticCatalog.listCatalog, {
    adminToken,
    orgId: args.orgId,
    connectionId: args.connectionId as never,
  });
}

export async function upsertSemanticOverride(args: {
  orgId: string;
  connectionId: string;
  kind: string; // boost|ban|synonym|join
  target: string; // e.g. table:schema.table
  payload?: unknown;
}) {
  const client = getConvexClient();
  const adminToken = getConvexAdminToken();
  await client.mutation((api as any).semanticCatalog.upsertOverride, {
    adminToken,
    orgId: args.orgId,
    connectionId: args.connectionId as never,
    kind: args.kind,
    target: args.target,
    payloadJson: args.payload ? JSON.stringify(args.payload) : undefined,
  });
}

export async function recordQueryAudit(args: {
  orgId: string;
  connectionId: string;
  userId: string;
  question: string;
  sql: string;
  rowCount: number;
  durationMs: number;
  status: "success" | "error";
  error?: string;
}) {
  const client = getConvexClient();
  const adminToken = getConvexAdminToken();
  await client.mutation(api.queryAudits.record, {
    adminToken,
    orgId: args.orgId,
    connectionId: args.connectionId as never,
    userId: args.userId,
    question: args.question,
    sql: args.sql,
    rowCount: args.rowCount,
    durationMs: args.durationMs,
    status: args.status,
    error: args.error,
  });
}

export async function countOrgQueries(args: { orgId: string; windowMs: number }) {
  const client = getConvexClient();
  const adminToken = getConvexAdminToken();
  return client.query(api.queryAudits.countRecentByOrg, {
    adminToken,
    orgId: args.orgId,
    windowMs: args.windowMs,
  });
}

export async function countOrgErrors(args: { orgId: string; windowMs: number }) {
  const client = getConvexClient();
  const adminToken = getConvexAdminToken();
  return client.query(api.queryAudits.countRecentErrorsByOrg, {
    adminToken,
    orgId: args.orgId,
    windowMs: args.windowMs,
  });
}

export async function getOrgSettings(orgId: string): Promise<{ rateLimitDaily?: number; errorWindowLimit?: number } | null> {
  const client = getConvexClient();
  const adminToken = getConvexAdminToken();
  const doc = await client.query((api as any).orgSettings.get, { adminToken, orgId } as any).catch(() => null as any);
  const settings = (doc as any)?.settings ?? null;
  if (!settings) return null;
  return settings as any;
}

export async function setOrgSettings(orgId: string, settings: Record<string, unknown>) {
  const client = getConvexClient();
  const adminToken = getConvexAdminToken();
  await client.mutation((api as any).orgSettings.upsert, { adminToken, orgId, settingsJson: JSON.stringify(settings) } as any);
}
