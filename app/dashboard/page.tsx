import { AnalyticsDashboard } from "@/components/dashboard/AnalyticsDashboard";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

export default async function Page() {
  const { orgId } = await auth();
  if (!orgId) {
    redirect("/onboarding");
  }
  return <AnalyticsDashboard />;
}
