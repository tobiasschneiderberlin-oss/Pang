"use client";

import { X, Instagram, Linkedin, Phone, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CollectorContact {
  instagram?: string;
  linkedin?: string;
  phone?: string;
  email?: string;
}

export interface CollectorData {
  id: string;
  name: string;
  initials: string;
  location?: string;
  collectingSince: number;
  worksCount: number;
  artistsCount: number;
  contact?: CollectorContact;
}

interface CollectorCardProps {
  collector: CollectorData;
  isOpen: boolean;
  onClose: () => void;
}

export function CollectorCard({ collector, isOpen, onClose }: CollectorCardProps) {
  if (!isOpen) return null;

  const hasContact = collector.contact && (
    collector.contact.instagram || 
    collector.contact.linkedin || 
    collector.contact.phone || 
    collector.contact.email
  );

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      
      {/* Card */}
      <div className="fixed left-4 right-4 top-1/2 -translate-y-1/2 z-50 max-w-sm mx-auto">
        <div className="bg-card rounded-2xl shadow-xl overflow-hidden">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-muted/50 hover:bg-muted transition-colors"
          >
            <X size={16} className="text-muted-foreground" />
          </button>

          <div className="p-6">
            {/* Header: Avatar + Name */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xl font-semibold text-accent-foreground">
                  {collector.initials}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-semibold">{collector.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {collector.location && `${collector.location} · `}
                  Collecting since {collector.collectingSince}
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-5 pt-5 border-t border-border">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{collector.worksCount}</span> works · {' '}
                <span className="font-medium text-foreground">{collector.artistsCount}</span> artists
              </p>
            </div>

            {/* Contact Links */}
            {hasContact && (
              <div className="mt-5 pt-5 border-t border-border">
                <div className="flex gap-3">
                  {collector.contact?.instagram && (
                    <a
                      href={`https://instagram.com/${collector.contact.instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-11 h-11 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"
                      aria-label="Instagram"
                    >
                      <Instagram size={20} className="text-foreground" />
                    </a>
                  )}
                  {collector.contact?.linkedin && (
                    <a
                      href={`https://linkedin.com/in/${collector.contact.linkedin}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-11 h-11 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"
                      aria-label="LinkedIn"
                    >
                      <Linkedin size={20} className="text-foreground" />
                    </a>
                  )}
                  {collector.contact?.email && (
                    <a
                      href={`mailto:${collector.contact.email}`}
                      className="w-11 h-11 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"
                      aria-label="Email"
                    >
                      <Mail size={20} className="text-foreground" />
                    </a>
                  )}
                  {collector.contact?.phone && (
                    <a
                      href={`tel:${collector.contact.phone}`}
                      className="w-11 h-11 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"
                      aria-label="Phone"
                    >
                      <Phone size={20} className="text-foreground" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
