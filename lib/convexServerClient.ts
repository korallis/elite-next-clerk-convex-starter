import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { decryptJson } from "@/lib/encryption";
import type { ConnectionConfig } from "@/convex/validators/connection";

let convexClient: ConvexHttpClient | null = null;

function getConvexUrl(): string {
  const url = process.env.CONVEX_DEPLOYMENT ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("Missing CONVEX_DEPLOYMENT or NEXT_PUBLIC_CONVEX_URL env var");
  }
  return url;
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
