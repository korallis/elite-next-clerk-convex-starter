"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type Connection = { _id: string; name: string };
type Artifact = { artifactKey: string; artifactType: string; payload: any };

export default function DataMapPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connId, setConnId] = useState<string>("");
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);

  useEffect(() => {
    fetch("/api/data-sources")
      .then((r) => r.json())
      .then((d) => setConnections(d.connections ?? []));
  }, []);

  useEffect(() => {
    if (!connId) return;
    fetch(`/api/semantic-artifacts?connectionId=${connId}`)
      .then((r) => r.json())
      .then((d) => setArtifacts(d.artifacts ?? []));
  }, [connId]);

  const tables = useMemo(() => artifacts.filter((a) => a.artifactType === "table"), [artifacts]);

  return (
    <div className="space-y-6 p-4">
      <div>
        <Label htmlFor="connection">Connection</Label>
        <select
          id="connection"
          className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm md:w-80"
          value={connId}
          onChange={(e) => setConnId(e.target.value)}
        >
          <option value="">Select a connection</option>
          {connections.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tables.map((t) => (
          <Card key={t.artifactKey}>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">{t.artifactKey}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-2 text-xs text-muted-foreground">{t.payload.description ?? ""}</p>
              <p className="text-xs">Rows: {t.payload.rowCount ?? "unknown"}</p>
              <p className="text-xs text-muted-foreground">Updated: {formatUpdated(t)}</p>
              <div className="mt-2 text-xs">
                <p className="font-medium">Columns</p>
                <ul className="mt-1 max-h-40 list-disc space-y-1 overflow-auto pl-4">
                  {t.payload.columns?.slice(0, 50).map((c: any) => (
                    <li key={c.name}>
                      {c.name} <span className="text-muted-foreground">({c.dataType})</span>
                    </li>
                  ))}
                </ul>
              </div>
              {Array.isArray(t.payload.foreignKeys) && t.payload.foreignKeys.length > 0 && (
                <div className="mt-3 text-xs">
                  <p className="font-medium">Joins</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {t.payload.foreignKeys.slice(0, 20).map((fk: any, idx: number) => (
                      <li key={idx}>{fk.sourceColumn} → {fk.targetTable}.{fk.targetColumn}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function formatUpdated(a: any) {
  return a.updatedAt ? new Date(a.updatedAt).toLocaleString() : "unknown";
}
