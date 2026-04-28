"use client";

import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingActionProps {
  onClick?: () => void;
  isOpen?: boolean;
  className?: string;
}

export function FloatingAction({ onClick, isOpen = false, className }: FloatingActionProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full",
        "bg-foreground text-background",
        "flex items-center justify-center",
        "shadow-lg shadow-black/20",
        "transition-all duration-300 ease-out",
        "hover:scale-105 active:scale-95",
        "safe-area-inset-bottom",
        className
      )}
      aria-label={isOpen ? "Close menu" : "Add new"}
    >
      <span className={cn(
        "transition-transform duration-300",
        isOpen && "rotate-45"
      )}>
        {isOpen ? <X size={24} /> : <Plus size={24} />}
      </span>
    </button>
  );
}
