"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Bell, HelpCircle, LogOut, Palette } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("pang-onboarded");
    localStorage.removeItem("pang-user-name");
    localStorage.removeItem("pang-collector-style");
    router.replace("/onboarding");
  };

  return (
    <main className="min-h-dvh bg-background">
      {/* Header */}
      <header className="px-4 pt-12 pb-3">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors -ml-2"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-2xl font-semibold">Settings</h1>
        </div>
      </header>

      <div className="px-4 pb-8">
        {/* Account section */}
        <section className="mt-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1 mb-2">Account</h3>
          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
            <SettingsRow icon={<Bell size={18} />} label="Notifications" href="/settings/notifications" />
          </div>
        </section>

        {/* Preferences section */}
        <section className="mt-6">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1 mb-2">Preferences</h3>
          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
            <SettingsRow icon={<Palette size={18} />} label="Appearance" href="/settings/appearance" />
          </div>
        </section>

        {/* Support section */}
        <section className="mt-6">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1 mb-2">Support</h3>
          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
            <SettingsRow icon={<HelpCircle size={18} />} label="Help Center" href="/settings/help" />
          </div>
        </section>

        {/* Logout */}
        <section className="mt-6">
          <button 
            onClick={handleLogout}
            className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-3 text-destructive"
          >
            <LogOut size={18} />
            <span className="font-medium">Log out</span>
          </button>
        </section>

        {/* Version */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          PANG v1.0.0
        </p>
      </div>
    </main>
  );
}

function SettingsRow({ 
  icon, 
  label, 
  href,
  badge 
}: { 
  icon: React.ReactNode; 
  label: string; 
  href?: string;
  badge?: string;
}) {
  const router = useRouter();
  
  const handleClick = () => {
    if (href) router.push(href);
  };

  return (
    <button 
      onClick={handleClick}
      className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-muted/50 transition-colors"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 text-left text-sm">{label}</span>
      {badge && (
        <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
          {badge}
        </span>
      )}
      <ChevronRight size={16} className="text-muted-foreground" />
    </button>
  );
}
