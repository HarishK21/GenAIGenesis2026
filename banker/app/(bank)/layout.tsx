import { DashboardShell } from "@/components/layout/dashboard-shell";

export default function BankLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
