import AutoDashboardClient from "./auto-dashboard-client";

export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <div className="p-4">
      <AutoDashboardClient />
    </div>
  );
}
