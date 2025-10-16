import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { listOrgConnections, listSemanticSyncRuns } from "@/lib/convexServerClient";
import { ConnectionsClient, type ConnectionView } from "./connections-client";

export default async function ConnectionsPage() {
  const { orgId } = await auth();
  if (!orgId) {
    redirect("/onboarding");
  }

  const connections = await listOrgConnections(orgId);
  const views: ConnectionView[] = [];

  for (const connection of connections as any[]) {
    const runs = await listSemanticSyncRuns({
      orgId,
      connectionId: String(connection._id),
      limit: 1,
    });
    const latestRun = Array.isArray(runs) && runs.length > 0 ? runs[0] : null;
    views.push({
      id: String(connection._id),
      name: connection.name,
      driver: connection.driver,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
      lastVerifiedAt: connection.lastVerifiedAt ?? null,
      lastError: connection.lastError ?? null,
      selectionMode: (connection.selectionMode ?? "all") as "all" | "include" | "exclude",
      selectedTables: connection.selectedTables ?? [],
      excludedTables: connection.excludedTables ?? [],
      syncRequestedAt: connection.syncRequestedAt ?? null,
      latestRun: latestRun
        ? {
            id: String(latestRun._id),
            status: latestRun.status,
            startedAt: latestRun.startedAt,
            completedAt: latestRun.completedAt ?? null,
            error: latestRun.error ?? null,
          }
        : null,
    });
  }

  return <ConnectionsClient initialConnections={views} />;
}
