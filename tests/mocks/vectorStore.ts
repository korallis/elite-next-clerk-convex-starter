export async function upsertVectors(orgId: string, records: Array<{ key: string; vector: number[]; metadata: Record<string, unknown> }>) {
  return records.map((r) => r.key);
}

export async function searchTopK(orgId: string, queryVector: number[], topK = 10) {
  return [] as Array<{ id: string; score: number; payload?: Record<string, unknown> }>;
}
