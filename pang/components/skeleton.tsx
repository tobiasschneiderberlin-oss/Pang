"use client";

import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse bg-muted rounded-lg",
        className
      )}
    />
  );
}

export function ArtworkSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="aspect-square rounded-2xl" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function ArtworkDetailSkeleton() {
  return (
    <div className="min-h-dvh bg-background">
      <Skeleton className="w-full aspect-[3/4]" />
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <div className="space-y-2 mt-8">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-card border border-border rounded-2xl p-4">
        <Skeleton className="h-10 w-16 mb-2" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="bg-card border border-border rounded-2xl p-4">
        <Skeleton className="h-10 w-16 mb-2" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}
