import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { useHaptic } from "@/hooks/use-haptic";

interface AppButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "tertiary" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  fullWidth?: boolean;
  haptic?: "light" | "medium" | "success" | "error" | false;
  children: React.ReactNode;
}

const variantClasses = {
  primary: "bg-accent text-accent-foreground font-semibold",
  secondary: "bg-muted text-foreground font-medium",
  tertiary: "bg-transparent text-accent font-medium",
  ghost: "bg-transparent text-muted-foreground hover:text-foreground font-medium",
};

const sizeClasses = {
  sm: "px-3 py-1.5 text-xs rounded-lg",
  md: "px-5 py-2.5 text-sm rounded-full",
  lg: "px-6 py-3 text-base rounded-full",
};

export function AppButton({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  haptic = "light",
  className,
  disabled,
  onClick,
  children,
  ...props
}: AppButtonProps) {
  const { triggerLight, triggerMedium, triggerSuccess, triggerError } = useHaptic();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (haptic && !disabled && !loading) {
      if (haptic === "light") triggerLight();
      else if (haptic === "medium") triggerMedium();
      else if (haptic === "success") triggerSuccess();
      else if (haptic === "error") triggerError();
    }
    onClick?.(e);
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 transition-all",
        "active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        className
      )}
      disabled={disabled || loading}
      onClick={handleClick}
      {...props}
    >
      {loading && <Spinner className="w-4 h-4" />}
      {children}
    </button>
  );
}
