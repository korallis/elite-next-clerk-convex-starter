"use client";

import { useEffect, useRef, useState } from "react";
import { useOrganizationList, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

const statusMessages: Record<OnboardingStatus, string> = {
  checking: "Checking your organization setup…",
  activating: "Activating your organization…",
  creating: "Creating your workspace…",
  ready: "All set! Redirecting you to the dashboard…",
  error: "We couldn’t finish setting up your organization. Please contact support.",
};

type OnboardingStatus = "checking" | "activating" | "creating" | "ready" | "error";

export function OnboardingClient() {
  const router = useRouter();
  const { isLoaded: userLoaded, user } = useUser();
  const { isLoaded, userMemberships, createOrganization, setActive } = useOrganizationList();

  const [status, setStatus] = useState<OnboardingStatus>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasHandledRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !userLoaded) return;
    if (hasHandledRef.current) return;
    hasHandledRef.current = true;

    async function ensureOrganization() {
      if (!setActive || !createOrganization) {
        console.error("Clerk organization helpers are unavailable");
        setStatus("error");
        setErrorMessage("Workspace utilities are currently unavailable. Please try again later.");
        return;
      }

      try {
        const memberships = userMemberships?.data ?? [];
        if (memberships.length > 0) {
          setStatus("activating");
          const activeOrgId = memberships[0].organization.id;
          await setActive({ organization: activeOrgId });
          setStatus("ready");
          router.replace("/dashboard");
          return;
        }

        setStatus("creating");
        const defaultName = buildOrganizationName(user?.firstName, user?.lastName, user?.username);
        const organization = await createOrganization({ name: defaultName });
        await setActive({ organization: organization.id });
        setStatus("ready");
        router.replace("/dashboard");
      } catch (error) {
        console.error("Failed to ensure organization", error);
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Unknown error");
      }
    }

    ensureOrganization();
  }, [isLoaded, userLoaded, userMemberships, createOrganization, setActive, router, user]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome to Leo AI Analytics</h1>
        <p className="text-muted-foreground text-sm max-w-md">
          {statusMessages[status]}
        </p>
        {status === "error" && errorMessage && (
          <p className="text-sm text-destructive">{errorMessage}</p>
        )}
      </div>
      {status !== "error" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-2 animate-ping rounded-full bg-primary" />
          <span>Hang tight while we finish setting things up…</span>
        </div>
      )}
    </div>
  );
}

function buildOrganizationName(firstName?: string | null, lastName?: string | null, username?: string | null) {
  const base = [firstName, lastName].filter(Boolean).join(" ");
  if (base) return `${base}'s Workspace`;
  if (username) return `${username}'s Workspace`;
  return "My Organization";
}
