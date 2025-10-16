import * as React from "react"

import { NavDocuments } from "@/app/dashboard/nav-documents"
import { NavMain } from "@/app/dashboard/nav-main"
import { NavSecondary } from "@/app/dashboard/nav-secondary"
import { NavUser } from "@/app/dashboard/nav-user"
import { NavWorkspace } from "@/app/dashboard/nav-workspace"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { ChatMaxingIconColoured } from "@/components/logo"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { auth } from "@clerk/nextjs/server"

const baseNavMain = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: "dashboard",
  },
  {
    title: "Connections",
    url: "/dashboard/connections",
    icon: "database",
  },
  {
    title: "Stakeholder Metrics",
    url: "/dashboard/stakeholder-metrics",
    icon: "chart",
  },
  {
    title: "Data Map",
    url: "/dashboard/data-map",
    icon: "database",
  },
  {
    title: "Auto Dashboard",
    url: "/dashboard/auto-dashboard",
    icon: "sparkles",
  },
  {
    title: "Ask",
    url: "/dashboard/ask",
    icon: "sparkles",
  },
  {
    title: "Payment gated",
    url: "/dashboard/payment-gated",
    icon: "sparkles",
  },
]

const navSecondary = [
  {
    title: "Settings",
    url: "#",
    icon: "settings",
  },
  {
    title: "Get Help",
    url: "#",
    icon: "help",
  },
  {
    title: "Search",
    url: "#",
    icon: "search",
  },
]

const documents = [
  {
    name: "Data Library",
    url: "#",
    icon: "database",
  },
  {
    name: "Reports",
    url: "#",
    icon: "report",
  },
  {
    name: "Word Assistant",
    url: "#",
    icon: "word",
  },
]

async function buildNavMain() {
  const { orgId } = await auth();
  if (!orgId) {
    return [
      {
        title: "Finish onboarding",
        url: "/onboarding",
        icon: "rocket",
      },
      ...baseNavMain,
    ];
  }
  return baseNavMain;
}

export async function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const navMain = await buildNavMain();
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href="/">
                <ChatMaxingIconColoured className="!size-6" />
                <span className="text-base font-semibold">Starter DIY</span>
                <Badge variant="outline" className="text-muted-foreground  text-xs">Demo</Badge>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavWorkspace />
        <NavMain items={navMain} />
        <NavDocuments items={documents} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
