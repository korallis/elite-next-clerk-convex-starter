import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getActiveConnectionDraft } from "@/lib/convexServerClient";
import { decryptJson } from "@/lib/encryption";
import { ConnectionWizardClient, type WizardDraft } from "./connection-wizard-client";

export default async function NewConnectionPage() {
  const { orgId, userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }
  if (!orgId) {
    redirect("/onboarding");
  }

  const draftDoc = await getActiveConnectionDraft({ orgId, userId });
  let initialDraft: WizardDraft | null = null;
  if (draftDoc) {
    initialDraft = {
      id: String(draftDoc._id),
      name: draftDoc.name ?? "",
      step: draftDoc.step ?? 1,
      selectionMode: draftDoc.selectionMode ?? "all",
      selectedTables: draftDoc.selectedTables ?? [],
      config: draftDoc.encryptedConfig ? decryptJson(draftDoc.encryptedConfig) : null,
      updatedAt: draftDoc.updatedAt,
    };
  }

  return <ConnectionWizardClient initialDraft={initialDraft} />;
}
