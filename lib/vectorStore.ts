import { Api as QdrantApi, Distance } from "qdrant-client";

type QdrantClient = QdrantApi<unknown>;

export type VectorRecord = {
  key: string;
  vector: number[];
  metadata: Record<string, unknown>;
};

function getQdrantClient(): QdrantClient | null {
  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;
  if (!url || !apiKey) return null;
  return new QdrantApi<unknown>({
    baseUrl: url,
    baseApiParams: {
      headers: {
        "api-key": apiKey,
      },
    },
  });
}

function collectionNameForOrg(orgId: string) {
  return `catalog_${orgId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

async function ensureCollection(client: QdrantClient, collection: string, dim: number) {
  try {
    const exists = await client.collections.getCollection(collection).catch(() => null);
    if (!exists?.data) {
      await client.collections.createCollection(collection, {
        vectors: { size: dim, distance: Distance.Cosine },
      });
    }
  } catch (error) {
    throw new Error(`Qdrant ensureCollection failed: ${(error as Error).message}`);
  }
}

export async function upsertVectors(
  orgId: string,
  records: VectorRecord[]
): Promise<Array<string | null>> {
  const client = getQdrantClient();
  if (!client || records.length === 0) return records.map(() => null);

  const collection = collectionNameForOrg(orgId);
  const dim = records[0].vector.length || Number(process.env.EMBEDDING_DIM || 3072);
  await ensureCollection(client, collection, dim);

  const points = records.map((r) => ({
    id: r.key,
    vector: r.vector,
    payload: r.metadata,
  }));

  await client.collections.upsertPoints(collection, { points });
  return records.map((r) => r.key);
}

export async function searchTopK(
  orgId: string,
  queryVector: number[],
  topK = 10
): Promise<{ id: string; score: number; payload?: Record<string, unknown> }[]> {
  const client = getQdrantClient();
  if (!client) return [];
  const collection = collectionNameForOrg(orgId);
  const res = await client.collections.searchPoints(collection, {
    vector: queryVector,
    limit: topK,
    with_payload: { include: ["*"] },
  });
  const results = Array.isArray(res.data?.result) ? res.data.result : [];
  return results.map((p: any) => ({
    id: String(p.id),
    score: p.score ?? 0,
    payload: (p.payload as Record<string, unknown>) ?? {},
  }));
}
