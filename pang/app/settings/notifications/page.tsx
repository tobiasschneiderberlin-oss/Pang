"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

type NotifSetting = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
};

const INITIAL_SETTINGS: NotifSetting[] = [
  { id: "new_artwork", label: "New Artwork Added", description: "When the gallery adds a new piece to your collection", enabled: true },
  { id: "artwork_updated", label: "Artwork Updated", description: "When details or documents on a piece are changed", enabled: true },
  { id: "collection_shared", label: "Collection Shared", description: "When your collection link is accessed", enabled: false },
  { id: "insurance", label: "Insurance Reminders", description: "Annual reminders to review valuations", enabled: true },
  { id: "news", label: "Artist News", description: "Notable news about artists in your collection", enabled: false },
];

export default function NotificationsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState(INITIAL_SETTINGS);

  const toggle = (id: string) => {
    setSettings(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  return (
    <main className="min-h-dvh bg-background">
      <header className="px-4 pt-12 pb-3">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors -ml-2"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-2xl font-semibold">Notifications</h1>
        </div>
      </header>

      <div className="px-4 pb-8">
        <p className="text-sm text-muted-foreground mb-6">Choose what you want to be notified about.</p>

        <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
          {settings.map(setting => (
            <div key={setting.id} className="flex items-center justify-between px-4 py-4 gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium">{setting.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{setting.description}</p>
              </div>
              <button
                onClick={() => toggle(setting.id)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                  setting.enabled ? "bg-accent" : "bg-muted"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                    setting.enabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
