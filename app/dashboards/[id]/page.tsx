import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { ChartRenderer } from "@/components/dashboard/ChartRenderer";

async function getTiles(id: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/dashboards/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()).tiles as Array<any>;
}

export default async function DashboardPage({ params }: { params: { id: string } }) {
  const { userId, orgId } = auth();
  if (!userId || !orgId) notFound();
  const tiles = await getTiles(params.id);
  if (!tiles) notFound();
  return (
    <div className="space-y-6 p-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tiles.map((tile) => {
          const spec = safeParse(tile.chartSpec);
          return (
            <div key={tile._id} className="rounded-lg border border-border/50 bg-card p-4">
              <h3 className="mb-2 text-sm font-semibold">{tile.title}</h3>
              <ChartRenderer spec={spec} rows={[]} />
              <pre className="mt-2 line-clamp-3 whitespace-pre-wrap break-all text-xs text-muted-foreground">
                {tile.sql}
              </pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function safeParse(text: string) {
  try { return JSON.parse(text); } catch { return { type: "table" }; }
}
