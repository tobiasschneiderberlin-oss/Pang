"use client";

import { Trophy, Palette, Calendar, Globe, Heart, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Milestone {
  id: string;
  title: string;
  description: string;
  icon: typeof Trophy;
  achieved: boolean;
  progress?: number;
  total?: number;
}

interface CollectorMilestonesProps {
  totalWorks: number;
  totalArtists: number;
  nationalities: number;
  collectionStartDate?: Date;
}

export function CollectorMilestones({
  totalWorks,
  totalArtists,
  nationalities,
  collectionStartDate,
}: CollectorMilestonesProps) {
  const daysSinceStart = collectionStartDate
    ? Math.floor((Date.now() - collectionStartDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const milestones: Milestone[] = [
    {
      id: "first-work",
      title: "first acquisition",
      description: "Added your first artwork",
      icon: Sparkles,
      achieved: totalWorks >= 1,
    },
    {
      id: "emerging-collector",
      title: "emerging collector",
      description: "Collect 5 artworks",
      icon: Heart,
      achieved: totalWorks >= 5,
      progress: Math.min(totalWorks, 5),
      total: 5,
    },
    {
      id: "ten-works",
      title: "serious collector",
      description: "Collect 10 artworks",
      icon: Trophy,
      achieved: totalWorks >= 10,
      progress: Math.min(totalWorks, 10),
      total: 10,
    },
    {
      id: "diverse-taste",
      title: "diverse taste",
      description: "Collect works from 5 different artists",
      icon: Palette,
      achieved: totalArtists >= 5,
      progress: Math.min(totalArtists, 5),
      total: 5,
    },
    {
      id: "international",
      title: "international eye",
      description: "Collect works from 3 nationalities",
      icon: Globe,
      achieved: nationalities >= 3,
      progress: Math.min(nationalities, 3),
      total: 3,
    },
    {
      id: "anniversary",
      title: "one year journey",
      description: "Collecting for one year",
      icon: Calendar,
      achieved: daysSinceStart >= 365,
      progress: Math.min(daysSinceStart, 365),
      total: 365,
    },
  ];

  const achievedCount = milestones.filter((m) => m.achieved).length;
  const nextMilestone = milestones.find((m) => !m.achieved);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">milestones</p>
            <p className="text-2xl font-light mt-1">
              <span className="text-accent">{achievedCount}</span>
              <span className="text-muted-foreground">/{milestones.length}</span>
            </p>
          </div>
          <div className="w-16 h-16 relative">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="text-muted"
              />
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray={`${(achievedCount / milestones.length) * 100} 100`}
                strokeLinecap="round"
                className="text-accent"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Next milestone */}
      {nextMilestone && (
        <div className="bg-accent/10 border border-accent/20 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center">
              <nextMilestone.icon size={18} className="text-accent" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-accent uppercase tracking-wider">next milestone</p>
              <p className="font-medium">{nextMilestone.title}</p>
              {nextMilestone.progress !== undefined && nextMilestone.total && (
                <div className="mt-2">
                  <div className="h-1.5 bg-accent/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all"
                      style={{ width: `${(nextMilestone.progress / nextMilestone.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {nextMilestone.progress} / {nextMilestone.total}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* All milestones */}
      <div className="space-y-3">
        {milestones.map((milestone) => (
          <div
            key={milestone.id}
            className={cn(
              "border rounded-xl p-4 flex items-center gap-4 transition-colors",
              milestone.achieved ? "bg-card border-accent/30" : "bg-card/50 border-border opacity-60"
            )}
          >
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                milestone.achieved ? "bg-accent" : "bg-muted"
              )}
            >
              <milestone.icon
                size={18}
                className={milestone.achieved ? "text-accent-foreground" : "text-muted-foreground"}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{milestone.title}</p>
              <p className="text-xs text-muted-foreground">{milestone.description}</p>
            </div>
            {milestone.achieved && (
              <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-accent-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
