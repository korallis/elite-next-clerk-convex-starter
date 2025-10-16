import { AppSidebar } from "@/app/dashboard/app-sidebar";
import AskClient from "./ask-client";

export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <div className="grid grid-cols-1 gap-4 p-4">
      <AskClient />
    </div>
  );
}
