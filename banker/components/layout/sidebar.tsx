"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRightLeft, CreditCard, Home, Rows3, Settings, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  telemetryId: string;
}

const navItems: NavItem[] = [
  { label: "Home", href: "/", icon: Home, telemetryId: "nav-home" },
  { label: "Accounts", href: "/accounts", icon: CreditCard, telemetryId: "nav-accounts" },
  { label: "Transfer", href: "/transfer", icon: ArrowRightLeft, telemetryId: "nav-transfer" },
  { label: "Activity", href: "/activity", icon: Rows3, telemetryId: "nav-activity" },
  { label: "Profile & Settings", href: "/profile", icon: Settings, telemetryId: "nav-profile" }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="border-b border-white/20 bg-white/40 backdrop-blur-xl lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r"
      data-telemetry-area="sidebar"
    >
      <div className="flex gap-2 overflow-x-auto px-4 py-4 lg:flex-col lg:gap-1 lg:px-5 lg:py-8">
        {navItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              data-telemetry-id={item.telemetryId}
              data-telemetry-event="nav_click"
              data-telemetry-area="sidebar"
              className={cn(
                "flex min-w-fit items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-all duration-300 lg:min-w-0",
                isActive
                  ? "border-bank-200/50 bg-bank-50/80 text-bank-700 shadow-sm"
                  : "border-transparent text-slate-600 hover:border-white/50 hover:bg-white/60 hover:text-ink hover:-translate-y-0.5"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
