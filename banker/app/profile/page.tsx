import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ProfileForm } from "@/components/dashboard/profile-form";

export const metadata = {
  title: "Profile & Settings | NorthMaple Bank",
  description: "Manage your personal profile and account settings."
};

export default function ProfilePage() {
  return (
    <DashboardShell>
      <div className="flex w-full max-w-4xl flex-col gap-6 animate-fade-in-up">
        <div className="glass-card rounded-2xl p-6 border-bank-200/50">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-bank-700">Settings</p>
          <h2 className="mt-2 text-3xl font-semibold text-ink">Profile & Preferences</h2>
          <p className="mt-2 text-sm text-slate-600">
            Manage your personal contact information and application state.
          </p>
        </div>

        <ProfileForm />
      </div>
    </DashboardShell>
  );
}
