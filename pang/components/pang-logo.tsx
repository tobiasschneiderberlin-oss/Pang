"use client";

import { cn } from "@/lib/utils";

interface PangLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  color?: "dark" | "light" | "primary";
}

const sizes = {
  sm: { svg: 32, text: "text-lg" },
  md: { svg: 48, text: "text-2xl" },
  lg: { svg: 80, text: "text-4xl" },
  xl: { svg: 120, text: "text-5xl" },
};

export function PangLogo({ 
  className, 
  size = "md", 
  showText = false,
  color = "dark" 
}: PangLogoProps) {
  const { svg, text } = sizes[size];
  
  const fillColor = color === "dark" ? "#000000" : color === "light" ? "#FFFFFF" : "currentColor";
  
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      {/* Three overlapping ovals - the PANG/Pillowtalk logo */}
      <svg 
        width={svg} 
        height={svg * 0.75} 
        viewBox="0 0 120 90" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className={cn(color === "primary" && "text-primary")}
      >
        <ellipse 
          cx="35" 
          cy="45" 
          rx="22" 
          ry="38" 
          fill={fillColor}
          transform="rotate(-10 35 45)"
        />
        <ellipse 
          cx="60" 
          cy="45" 
          rx="20" 
          ry="36" 
          fill={fillColor}
        />
        <ellipse 
          cx="85" 
          cy="45" 
          rx="22" 
          ry="38" 
          fill={fillColor}
          transform="rotate(10 85 45)"
        />
      </svg>
      
      {showText && (
        <span className={cn(
          "font-sans font-medium tracking-tight lowercase",
          text,
          color === "dark" && "text-black",
          color === "light" && "text-white",
          color === "primary" && "text-primary"
        )}>
          pang
        </span>
      )}
    </div>
  );
}
