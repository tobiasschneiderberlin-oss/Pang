"use client";

import { useState } from "react";
import { X, Link2, Mail, MessageCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  url?: string;
}

export function ShareSheet({ isOpen, onClose, title, subtitle, url }: ShareSheetProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleNativeShare = async () => {
    // Use a property-existence check rather than a truthy check. The DOM
    // typings declare `navigator.share` as an always-defined method, which
    // means `if (navigator.share)` is flagged by TS as a condition that's
    // always true — `'share' in navigator` is the correct feature gate.
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title,
          text: subtitle,
          url: shareUrl,
        });
        onClose();
      } catch {
        // User cancelled or share failed — no recovery needed.
      }
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl p-6 pb-8 safe-area-inset-bottom animate-in slide-in-from-bottom duration-300">
        {/* Handle */}
        <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-6" />
        
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="font-medium text-lg lowercase">{title}</h3>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 -m-2">
            <X size={20} className="text-muted-foreground" />
          </button>
        </div>

        {/* Share options */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <ShareOption
            icon={<Link2 size={24} />}
            label={copied ? "copied!" : "copy link"}
            onClick={handleCopy}
            active={copied}
          />
          <ShareOption
            icon={<Mail size={24} />}
            label="email"
            onClick={() => window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(shareUrl)}`)}
          />
          <ShareOption
            icon={<MessageCircle size={24} />}
            label="message"
            onClick={() => window.open(`sms:?body=${encodeURIComponent(`${title}: ${shareUrl}`)}`)}
          />
          {typeof navigator !== "undefined" && "share" in navigator && (
            <ShareOption
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 12V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 6L12 2L8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 2V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              }
              label="more"
              onClick={handleNativeShare}
            />
          )}
        </div>

        {/* URL preview */}
        <div className="bg-muted rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Link2 size={18} className="text-accent" />
          </div>
          <p className="text-sm text-muted-foreground truncate flex-1">{shareUrl}</p>
          <button
            onClick={handleCopy}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all",
              copied 
                ? "bg-accent text-accent-foreground" 
                : "bg-foreground text-background"
            )}
          >
            {copied ? <Check size={16} /> : "copy"}
          </button>
        </div>
      </div>
    </>
  );
}

function ShareOption({ 
  icon, 
  label, 
  onClick,
  active = false
}: { 
  icon: React.ReactNode; 
  label: string; 
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center gap-2"
    >
      <div className={cn(
        "w-14 h-14 rounded-2xl flex items-center justify-center transition-colors",
        active ? "bg-accent text-accent-foreground" : "bg-muted text-foreground"
      )}>
        {icon}
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </button>
  );
}
