import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import Link from "next/link";

interface EmptyStateProps {
  icon?: LucideIcon;
  illustration?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export function EmptyState({ 
  icon: Icon, 
  illustration,
  title, 
  description, 
  action,
  className 
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-8 text-center", className)}>
      {illustration ? (
        <div className="mb-6 w-32 h-32 flex items-center justify-center">
          {illustration}
        </div>
      ) : Icon ? (
        <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-4">
          <Icon size={24} className="text-muted-foreground" />
        </div>
      ) : null}
      
      <h3 className="text-base font-medium mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-[240px] text-balance">
        {description}
      </p>
      {action && (
        action.href ? (
          <Link
            href={action.href}
            className="mt-5 px-5 py-2.5 bg-accent text-accent-foreground rounded-full text-sm font-medium active:scale-95 transition-transform"
          >
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="mt-5 px-5 py-2.5 bg-accent text-accent-foreground rounded-full text-sm font-medium active:scale-95 transition-transform"
          >
            {action.label}
          </button>
        )
      )}
    </div>
  );
}
