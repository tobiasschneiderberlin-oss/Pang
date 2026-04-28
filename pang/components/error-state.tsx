import { cn } from "@/lib/utils";
import { AlertCircle, RotateCcw } from "lucide-react";

interface ErrorStateProps {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  type?: "error" | "warning" | "info";
  className?: string;
}

export function ErrorState({ 
  title, 
  description, 
  action,
  type = "error",
  className 
}: ErrorStateProps) {
  const bgColor = type === "error" ? "bg-red-50" : type === "warning" ? "bg-yellow-50" : "bg-blue-50";
  const borderColor = type === "error" ? "border-red-200" : type === "warning" ? "border-yellow-200" : "border-blue-200";
  const textColor = type === "error" ? "text-red-800" : type === "warning" ? "text-yellow-800" : "text-blue-800";
  const accentColor = type === "error" ? "text-red-600" : type === "warning" ? "text-yellow-600" : "text-blue-600";

  return (
    <div className={cn(
      "rounded-2xl border p-6",
      bgColor,
      borderColor,
      className
    )}>
      <div className="flex gap-4">
        <div className="flex-shrink-0">
          <AlertCircle size={20} className={cn("mt-0.5", accentColor)} />
        </div>
        <div className="flex-1">
          <h3 className={cn("font-semibold text-sm", textColor)}>
            {title}
          </h3>
          <p className={cn("text-sm mt-1 opacity-90", textColor)}>
            {description}
          </p>
          {action && (
            <button
              onClick={action.onClick}
              className={cn(
                "mt-3 inline-flex items-center gap-2 text-sm font-medium",
                accentColor,
                "hover:opacity-80 transition-opacity"
              )}
            >
              <RotateCcw size={14} />
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
