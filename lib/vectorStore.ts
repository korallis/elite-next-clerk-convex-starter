export type VectorRecord = {
  key: string;
  vector: number[];
  metadata: Record<string, unknown>;
};

export async function upsertVectors(
  _orgId: string,
  records: VectorRecord[]
): Promise<Array<string | null>> {
  // Placeholder implementation. Integrate with Qdrant or pgvector later.
  return records.map(() => null);
}
