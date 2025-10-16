"use client";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useClerk, useOrganization, OrganizationSwitcher } from "@clerk/nextjs";
import { IconBuilding } from "@tabler/icons-react";
import { useMemo } from "react";

export function NavWorkspace() {
  const { organization } = useOrganization();
  const { openOrganizationProfile } = useClerk();

  const orgName = useMemo(() => organization?.name ?? organization?.slug ?? "No active organization", [organization]);
  const hasOrganization = Boolean(organization);

  return (
    <SidebarGroup className="pb-2">
      <SidebarGroupLabel>Workspace</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="justify-start gap-2 text-left">
              <IconBuilding className="size-4" />
              <div className="flex flex-col text-sm">
                <span className="font-semibold leading-tight">{orgName}</span>
                <span className="text-xs text-muted-foreground">
                  {hasOrganization ? "Active organization" : "Finish onboarding to create one"}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <OrganizationSwitcher
              appearance={{
                elements: {
                  rootBox: "w-full",
                },
              }}
              hidePersonal={false}
              afterSwitchOrganizationUrl="/onboarding"
            />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-center"
              disabled={!hasOrganization}
              onClick={() => hasOrganization && openOrganizationProfile()}
            >
              Manage workspace
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
